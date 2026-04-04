import { describe, expect, test } from "bun:test";
import * as git from "../../src/autoresearch/git";

/** Helper: builds a porcelain -z NUL-string from individual byte values. */
function nz(...bytes: number[]): string {
	return String.fromCharCode(...bytes);
}

describe("parseDirtyPaths", () => {
	describe("NUL mode", () => {
		// porcelain -z format: XY<space>path\0  (e.g. "M  foo\0")
		// The parser reads 3 chars as statusToken, then finds the next NUL as path end.
		// Renames/copies add a second NUL-terminated path: RN\0old\0new\0

		test("M  foo → [foo]", () => {
			// M(0x4d) space(0x20) space(0x20) f(0x66) o(0x6f) o(0x6f) NUL(0x00)
			const input = nz(0x4d, 0x20, 0x20, 0x66, 0x6f, 0x6f, 0x00);
			expect(git.parseDirtyPaths(input)).toEqual(["foo"]);
		});

		test("?? foo → [foo]", () => {
			// ?(0x3f) ?(0x3f) space(0x20) f(0x66) o(0x6f) o(0x6f) NUL(0x00)
			const input = nz(0x3f, 0x3f, 0x20, 0x66, 0x6f, 0x6f, 0x00);
			expect(git.parseDirtyPaths(input)).toEqual(["foo"]);
		});

		test("RN old\\0new\\0 → [old, new] (Set insertion order)", () => {
			// R(0x52) N(0x4e) NUL(0x00)  o(0x6f) l(0x6c) d(0x64) NUL(0x00)  n(0x6e) e(0x65) w(0x77) NUL(0x00)
			const input = nz(
				0x52,
				0x4e,
				0x00, // RN\0
				0x6f,
				0x6c,
				0x64,
				0x00, // old\0
				0x6e,
				0x65,
				0x77,
				0x00, // new\0
			);
			expect(git.parseDirtyPaths(input)).toEqual(["old", "new"]);
		});

		test("CN old\\0new\\0 → [old, new] (Set insertion order)", () => {
			// C(0x43) N(0x4e) NUL(0x00)  old\0  new\0
			const input = nz(
				0x43,
				0x4e,
				0x00, // CN\0
				0x6f,
				0x6c,
				0x64,
				0x00, // old\0
				0x6e,
				0x65,
				0x77,
				0x00, // new\0
			);
			expect(git.parseDirtyPaths(input)).toEqual(["old", "new"]);
		});

		test("multiple files each terminated by NUL", () => {
			// M  foo\0?? bar\0M  baz\0
			const input = nz(
				0x4d,
				0x20,
				0x20,
				0x66,
				0x6f,
				0x6f,
				0x00, // M  foo\0
				0x3f,
				0x3f,
				0x20,
				0x62,
				0x61,
				0x72,
				0x00, // ?? bar\0
				0x4d,
				0x20,
				0x20,
				0x62,
				0x61,
				0x7a,
				0x00, // M  baz\0
			);
			expect(git.parseDirtyPaths(input)).toEqual(["foo", "bar", "baz"]);
		});

		test("empty string → []", () => {
			expect(git.parseDirtyPaths("")).toEqual([]);
		});
	});

	describe("line mode", () => {
		test("M  foo → [foo]", () => {
			expect(git.parseDirtyPaths("M  foo")).toEqual(["foo"]);
		});

		test("?? foo → [foo]", () => {
			expect(git.parseDirtyPaths("?? foo")).toEqual(["foo"]);
		});

		test("R  old -> new → [old, new] (split order)", () => {
			expect(git.parseDirtyPaths("R  old -> new")).toEqual(["old", "new"]);
		});

		test("multiple lines", () => {
			const output = "M  foo\n?? bar\nM  baz";
			expect(git.parseDirtyPaths(output)).toEqual(["foo", "bar", "baz"]);
		});

		test("short lines (< 4 chars) skipped gracefully", () => {
			expect(git.parseDirtyPaths("M  \n?? \nM  foo")).toEqual(["foo"]);
		});

		test("only whitespace lines → []", () => {
			expect(git.parseDirtyPaths("   \n\t\n")).toEqual([]);
		});
	});

	test("falls back to line mode when no NUL bytes", () => {
		const lineOutput = "M  src/foo\n?? other/bar";
		expect(git.parseDirtyPaths(lineOutput)).toEqual(["src/foo", "other/bar"]);
	});
});

describe("normalizeStatusPath", () => {
	test("plain path unchanged", () => {
		expect(git.normalizeStatusPath("src/foo")).toEqual("src/foo");
	});

	test("trims leading and trailing whitespace", () => {
		expect(git.normalizeStatusPath("  foo  ")).toEqual("foo");
	});

	test("strips outer double-quotes", () => {
		expect(git.normalizeStatusPath('"foo bar"')).toEqual("foo bar");
	});

	test("double-quoted path with slashes", () => {
		expect(git.normalizeStatusPath('"src/foo"')).toEqual("src/foo");
	});

	test("no quotes — just trim then normalize", () => {
		expect(git.normalizeStatusPath("src/foo")).toEqual("src/foo");
	});

	test("backslash separators normalized to forward slashes", () => {
		expect(git.normalizeStatusPath("src\\foo")).toEqual("src/foo");
	});
});

describe("relativizeGitPathToWorkDir", () => {
	test("empty prefix returns path as-is", () => {
		expect(git.relativizeGitPathToWorkDir("src/foo", "")).toBe("src/foo");
	});

	test('"." prefix returns path as-is', () => {
		expect(git.relativizeGitPathToWorkDir("src/foo", ".")).toBe("src/foo");
	});

	test("exact match → dot", () => {
		expect(git.relativizeGitPathToWorkDir("workdir/src", "workdir/src")).toBe(".");
	});

	test("child path → relative", () => {
		expect(git.relativizeGitPathToWorkDir("workdir/src/foo", "workdir/src")).toBe("foo");
	});

	test("deeply nested child path", () => {
		expect(git.relativizeGitPathToWorkDir("workdir/src/foo/bar", "workdir/src")).toBe("foo/bar");
	});

	test("path outside prefix → null", () => {
		expect(git.relativizeGitPathToWorkDir("other/src/foo", "workdir/src")).toBe(null);
	});

	test("backslash prefix normalized before comparison", () => {
		// workdir\\src normalizes to workdir/src, so "workdir/src/foo" is a child
		expect(git.relativizeGitPathToWorkDir("workdir/src/foo", "workdir\\src")).toBe("foo");
	});
});

describe("parseWorkDirDirtyPaths", () => {
	test("simple line with empty prefix", () => {
		expect(git.parseWorkDirDirtyPaths("M  foo", "")).toEqual(["foo"]);
	});

	test("path not under prefix → excluded", () => {
		expect(git.parseWorkDirDirtyPaths("?? other/foo", "workdir")).toEqual([]);
	});

	test("NUL mode path under prefix → relative result", () => {
		// "?? workdir/foo\0" — prefix "workdir" strips it to "foo"
		const input = nz(
			0x3f,
			0x3f,
			0x20, // "?? "
			0x77,
			0x6f,
			0x72,
			0x6b,
			0x64,
			0x69,
			0x72,
			0x2f,
			0x66,
			0x6f,
			0x6f,
			0x00,
		);
		expect(git.parseWorkDirDirtyPaths(input, "workdir")).toEqual(["foo"]);
	});

	test("empty status output → []", () => {
		expect(git.parseWorkDirDirtyPaths("", "workdir")).toEqual([]);
	});

	test("mixed files — only those under prefix included", () => {
		const output = "M  workdir/foo\n?? other/bar\nM  workdir/baz";
		const result = git.parseWorkDirDirtyPaths(output, "workdir");
		expect(result).toEqual(["foo", "baz"]);
	});

	test("NUL mode with rename under prefix", () => {
		// RN workdir/old\0workdir/new\0 — Set insertion order = [old, new]
		const input = nz(
			0x52,
			0x4e,
			0x00, // RN\0
			0x77,
			0x6f,
			0x72,
			0x6b,
			0x64,
			0x69,
			0x72,
			0x2f,
			0x6f,
			0x6c,
			0x64,
			0x00, // workdir/old\0
			0x77,
			0x6f,
			0x72,
			0x6b,
			0x64,
			0x69,
			0x72,
			0x2f,
			0x6e,
			0x65,
			0x77,
			0x00, // workdir/new\0
		);
		expect(git.parseWorkDirDirtyPaths(input, "workdir")).toEqual(["old", "new"]);
	});
});
