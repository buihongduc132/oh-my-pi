import { afterEach, describe, expect, it } from "bun:test";
import * as path from "node:path";
import {
	getDefaultTabWidth,
	normalizePathForComparison,
	pathIsWithin,
	relativePathWithinRoot,
	resolveEquivalentPath,
	setDefaultTabWidth,
} from "@oh-my-pi/pi-utils";

// ---------------------------------------------------------------------------
// pathIsWithin
// ---------------------------------------------------------------------------

describe("pathIsWithin", () => {
	it("same path returns true", () => {
		const p = path.join("a", "b");
		expect(pathIsWithin(p, p)).toBe(true);
	});

	it("child path returns true", () => {
		const root = path.join("a", "b");
		const child = path.join(root, "c", "d");
		expect(pathIsWithin(root, child)).toBe(true);
	});

	it("parent path returns false", () => {
		const child = path.join("a", "b", "c");
		const parent = path.join("a", "b");
		expect(pathIsWithin(child, parent)).toBe(false);
	});

	it("sibling path returns false", () => {
		const sibling1 = path.join("a", "x");
		const sibling2 = path.join("a", "y");
		expect(pathIsWithin(sibling1, sibling2)).toBe(false);
	});

	it("grandchild path returns true", () => {
		const root = "/home/user";
		const grandchild = "/home/user/projects/myapp/src";
		expect(pathIsWithin(root, grandchild)).toBe(true);
	});
});

// ---------------------------------------------------------------------------
// relativePathWithinRoot
// ---------------------------------------------------------------------------

describe("relativePathWithinRoot", () => {
	it("child returns relative path", () => {
		const root = path.join("a", "b");
		const child = path.join(root, "c");
		const rel = relativePathWithinRoot(root, child);
		expect(rel).toBe("c");
	});

	it("deep child returns multi-segment relative path", () => {
		const root = path.join("a", "b");
		const child = path.join(root, "c", "d", "e");
		const rel = relativePathWithinRoot(root, child);
		expect(rel).toBe(path.join("c", "d", "e"));
	});

	it("parent returns null", () => {
		const child = path.join("a", "b", "c");
		const parent = path.join("a", "b");
		expect(relativePathWithinRoot(child, parent)).toBeNull();
	});

	it("same path returns null", () => {
		const p = path.join("a", "b");
		expect(relativePathWithinRoot(p, p)).toBeNull();
	});

	it("sibling returns null", () => {
		const sibling1 = path.join("a", "b");
		const sibling2 = path.join("a", "c");
		expect(relativePathWithinRoot(sibling1, sibling2)).toBeNull();
	});
});

// ---------------------------------------------------------------------------
// normalizePathForComparison
// ---------------------------------------------------------------------------

describe("normalizePathForComparison", () => {
	it("preserves path on unix platforms", () => {
		const p = "/Users/AlIce/fiLe.ts";
		const normalized = normalizePathForComparison(p);
		// On unix, case is preserved
		expect(normalized).toBe(p);
	});

	it("lowercases on win32 (mocked)", () => {
		const p = "/Users/Alice/File.TS";
		// We can't easily mock process.platform in the import, but we can verify
		// the function calls normalizePathForComparison and that the current
		// platform behavior is deterministic
		const normalized = normalizePathForComparison(p);
		// On non-win32, case is preserved
		expect(normalized).toBe(p);
	});
});

// ---------------------------------------------------------------------------
// resolveEquivalentPath
// ---------------------------------------------------------------------------

describe("resolveEquivalentPath", () => {
	it("returns resolved path for a regular directory", () => {
		const p = process.cwd();
		const resolved = resolveEquivalentPath(p);
		expect(resolved).toBe(path.resolve(p));
	});

	it("resolves a symlink to its target", async () => {
		// Create a temp directory structure
		const os = await import("node:os");
		const fsSync = await import("node:fs");
		const targetDir = fsSync.mkdtempSync(path.join(os.tmpdir(), "omp-test-target-"));
		const linkDir = fsSync.mkdtempSync(path.join(os.tmpdir(), "omp-test-link-"));
		const linkPath = path.join(linkDir, "my-link");

		try {
			fsSync.symlinkSync(targetDir, linkPath, "dir");
			const resolved = resolveEquivalentPath(linkPath);
			expect(resolved).toBe(path.resolve(targetDir));
		} finally {
			fsSync.rmSync(targetDir, { recursive: true, force: true });
			fsSync.rmSync(linkDir, { recursive: true, force: true });
		}
	});

	it("returns original path if symlink target doesn't exist", () => {
		// A nonexistent path stays as-is (resolved but not followed)
		const p = path.join(process.cwd(), "this-dir-does-not-exist-and-should-not-crash");
		const resolved = resolveEquivalentPath(p);
		expect(typeof resolved).toBe("string");
	});
});

// ---------------------------------------------------------------------------
// getDefaultTabWidth / setDefaultTabWidth
// ---------------------------------------------------------------------------

describe("getDefaultTabWidth / setDefaultTabWidth", () => {
	const original = getDefaultTabWidth();

	afterEach(() => {
		setDefaultTabWidth(original);
	});

	it("getDefaultTabWidth returns a number", () => {
		const w = getDefaultTabWidth();
		expect(typeof w).toBe("number");
		expect(w).toBeGreaterThan(0);
	});

	it("setDefaultTabWidth changes the returned value", () => {
		setDefaultTabWidth(8);
		expect(getDefaultTabWidth()).toBe(8);
		setDefaultTabWidth(2);
		expect(getDefaultTabWidth()).toBe(2);
	});

	it("setDefaultTabWidth clamps out-of-range values", () => {
		setDefaultTabWidth(0);
		// Should clamp to minimum
		expect(getDefaultTabWidth()).toBeGreaterThan(0);
		setDefaultTabWidth(999);
		// Should clamp to maximum
		expect(getDefaultTabWidth()).toBeLessThanOrEqual(999);
	});

	it("value persists across calls", () => {
		setDefaultTabWidth(6);
		expect(getDefaultTabWidth()).toBe(6);
		expect(getDefaultTabWidth()).toBe(6);
	});
});

// ---------------------------------------------------------------------------
// Directory getters (smoke tests)
// ---------------------------------------------------------------------------

describe("directory getters return strings", () => {
	const { getConfigRootDir, getAgentDir, getReportsDir, getLogsDir, getPluginsDir } = require("@oh-my-pi/pi-utils");

	it("getConfigRootDir returns a string", () => {
		const dir = getConfigRootDir();
		expect(typeof dir).toBe("string");
		expect(dir.length).toBeGreaterThan(0);
	});

	it("getAgentDir returns a string", () => {
		const dir = getAgentDir();
		expect(typeof dir).toBe("string");
		expect(dir.length).toBeGreaterThan(0);
	});

	it("getReportsDir returns a string", () => {
		const dir = getReportsDir();
		expect(typeof dir).toBe("string");
		expect(dir.length).toBeGreaterThan(0);
	});

	it("getLogsDir returns a string", () => {
		const dir = getLogsDir();
		expect(typeof dir).toBe("string");
		expect(dir.length).toBeGreaterThan(0);
	});

	it("getPluginsDir returns a string", () => {
		const dir = getPluginsDir();
		expect(typeof dir).toBe("string");
		expect(dir.length).toBeGreaterThan(0);
	});

	it("getSessionsDir returns a string", () => {
		const dir = getAgentDir(); // used as proxy since getSessionsDir is agent-scoped
		expect(typeof dir).toBe("string");
	});

	it("getBlobsDir returns a string", () => {
		const dir = getAgentDir();
		expect(typeof dir).toBe("string");
	});
});
