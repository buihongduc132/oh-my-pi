import { describe, expect, it } from "bun:test";
import {
	contractListsEqual,
	contractPathListsEqual,
	normalizeAutoresearchList,
	normalizeContractPathSpec,
	pathMatchesContractPath,
} from "../../src/autoresearch/contract";

describe("autoresearch/contract", () => {
	describe("normalizeAutoresearchList", () => {
		it("removes empty strings", () => {
			const result = normalizeAutoresearchList(["foo", "", "  ", "bar"]);
			expect(result).toEqual(["foo", "bar"]);
		});

		it("trims whitespace", () => {
			const result = normalizeAutoresearchList(["  foo  ", "\tbar\t", "baz"]);
			expect(result).toEqual(["foo", "bar", "baz"]);
		});

		it("removes duplicates (case-sensitive)", () => {
			const result = normalizeAutoresearchList(["foo", "FOO", "foo"]);
			expect(result).toEqual(["foo", "FOO"]);
		});

		it("preserves order of first occurrence", () => {
			const result = normalizeAutoresearchList(["b", "a", "c", "a", "b"]);
			expect(result).toEqual(["b", "a", "c"]);
		});

		it("returns empty array for empty input", () => {
			expect(normalizeAutoresearchList([])).toEqual([]);
		});
	});

	describe("normalizeContractPathSpec", () => {
		it("normalizes dot to dot", () => {
			expect(normalizeContractPathSpec(".")).toBe(".");
		});

		it("normalizes ./ to dot", () => {
			expect(normalizeContractPathSpec("./")).toBe(".");
		});

		it("strips leading ./", () => {
			expect(normalizeContractPathSpec("./foo/bar")).toBe("foo/bar");
		});

		it("strips trailing slashes", () => {
			expect(normalizeContractPathSpec("foo/bar/")).toBe("foo/bar");
		});

		it("converts backslashes to forward slashes", () => {
			expect(normalizeContractPathSpec("foo\\bar\\baz")).toBe("foo/bar/baz");
		});

		it("normalizes path with both leading ./ and trailing slashes", () => {
			expect(normalizeContractPathSpec("./foo/bar///")).toBe("foo/bar");
		});

		it("preserves spaces in path components", () => {
			expect(normalizeContractPathSpec("src/components/Button.tsx")).toBe("src/components/Button.tsx");
		});

		it("trims whitespace", () => {
			expect(normalizeContractPathSpec("  foo/bar  ")).toBe("foo/bar");
		});
	});

	describe("contractListsEqual", () => {
		it("returns true for identical lists", () => {
			expect(contractListsEqual(["a", "b"], ["a", "b"])).toBe(true);
		});

		it("returns false for different lengths", () => {
			expect(contractListsEqual(["a"], ["a", "b"])).toBe(false);
		});

		it("normalizes whitespace before comparing", () => {
			expect(contractListsEqual(["  foo  ", " bar"], ["foo", "bar"])).toBe(true);
		});

		it("removes duplicates before comparing", () => {
			expect(contractListsEqual(["foo", "foo", "bar"], ["foo", "bar"])).toBe(true);
		});

		it("returns false when items differ", () => {
			expect(contractListsEqual(["foo"], ["bar"])).toBe(false);
		});

		it("returns true for two empty lists", () => {
			expect(contractListsEqual([], [])).toBe(true);
		});
	});

	describe("contractPathListsEqual", () => {
		it("returns true for identical normalized paths", () => {
			expect(contractPathListsEqual(["foo"], ["foo"])).toBe(true);
		});

		it("normalizes ./ and trailing slashes", () => {
			expect(contractPathListsEqual(["./foo/"], ["foo"])).toBe(true);
		});

		it("sorts before comparing (order-independent)", () => {
			expect(contractPathListsEqual(["b", "a"], ["a", "b"])).toBe(true);
		});

		it("returns false for different paths", () => {
			expect(contractPathListsEqual(["foo"], ["bar"])).toBe(false);
		});

		it("returns false for different lengths", () => {
			expect(contractPathListsEqual(["a"], ["a", "b"])).toBe(false);
		});
	});

	describe("pathMatchesContractPath", () => {
		it("returns true when spec is dot (matches everything)", () => {
			expect(pathMatchesContractPath("src/index.ts", ".")).toBe(true);
			expect(pathMatchesContractPath("any/path/here", ".")).toBe(true);
		});

		it("returns true for exact match", () => {
			expect(pathMatchesContractPath("src/index.ts", "src/index.ts")).toBe(true);
		});

		it("returns true for path inside directory", () => {
			expect(pathMatchesContractPath("src/components/Button.tsx", "src")).toBe(true);
			expect(pathMatchesContractPath("src/components/foo/Button.tsx", "src/components")).toBe(true);
		});

		it("returns false for non-matching paths", () => {
			expect(pathMatchesContractPath("src/index.ts", "lib")).toBe(false);
			expect(pathMatchesContractPath("src/index.ts", "src/components")).toBe(false);
		});

		it("normalizes slashes before comparing", () => {
			expect(pathMatchesContractPath("foo/bar/baz", "foo/bar")).toBe(true);
		});

		it("normalizes trailing slashes", () => {
			expect(pathMatchesContractPath("foo/bar", "foo/bar/")).toBe(true);
		});
	});
});
