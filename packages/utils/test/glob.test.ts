import { afterAll, describe, expect, it } from "bun:test";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { globPaths } from "../src/glob";

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------
const tmpDirs: string[] = [];

function makeTmpDir(): string {
	const d = fs.mkdtempSync(path.join(os.tmpdir(), "glob-test-"));
	tmpDirs.push(d);
	return d;
}

function touch(parent: string, filename: string): string {
	const f = path.join(parent, filename);
	fs.writeFileSync(f, "");
	return f;
}

function writeGitignore(parent: string, content: string): void {
	fs.writeFileSync(path.join(parent, ".gitignore"), content);
}

// ---------------------------------------------------------------------------
// Cleanup
// ---------------------------------------------------------------------------
afterAll(() => {
	for (const d of tmpDirs) {
		try {
			fs.rmSync(d, { recursive: true });
		} catch {
			// ignore
		}
	}
});

// ---------------------------------------------------------------------------
// globPaths — basic patterns
// ---------------------------------------------------------------------------
describe("globPaths — basic patterns", () => {
	it("finds files matching a glob pattern", async () => {
		const dir = makeTmpDir();
		touch(dir, "file-a.txt");
		touch(dir, "file-b.txt");
		touch(dir, "other.log");

		const results = await globPaths("**/*.txt", { cwd: dir });
		expect(results.sort()).toEqual(["file-a.txt", "file-b.txt"]);
	});

	it("returns empty array when nothing matches", async () => {
		const dir = makeTmpDir();
		const results = await globPaths("**/*.txt", { cwd: dir });
		expect(results).toEqual([]);
	});

	it("returns paths relative to cwd", async () => {
		const dir = makeTmpDir();
		const subDir = path.join(dir, "src");
		fs.mkdirSync(subDir);
		touch(subDir, "index.ts");
		touch(subDir, "index.js");

		const results = await globPaths("**/*.ts", { cwd: dir });
		expect(results).toEqual(["src/index.ts"]);
	});

	it("respects onlyFiles=false and returns directories too", async () => {
		const dir = makeTmpDir();
		const subDir = path.join(dir, "src");
		fs.mkdirSync(subDir);
		touch(subDir, "index.ts");

		const results = await globPaths("**/src", { cwd: dir, onlyFiles: false });
		expect(results).toEqual(["src"]);
	});

	it("includes dotfiles when dot=true", async () => {
		const dir = makeTmpDir();
		touch(dir, ".env");
		touch(dir, "config.js");

		const [withDot, noDot] = await Promise.all([
			globPaths("**/*", { cwd: dir, dot: true }),
			globPaths("**/*", { cwd: dir, dot: false }),
		]);

		expect(withDot).toContain(".env");
		expect(noDot).not.toContain(".env");
	});

	it("accepts a single pattern string", async () => {
		const dir = makeTmpDir();
		touch(dir, "only.ts");
		touch(dir, "other.txt");

		const results = await globPaths("**/*.ts", { cwd: dir });
		expect(results).toEqual(["only.ts"]);
	});
});

// ---------------------------------------------------------------------------
// globPaths — default exclusions
// ---------------------------------------------------------------------------
describe("globPaths — default exclusions", () => {
	it("excludes .git by default", async () => {
		const dir = makeTmpDir();
		touch(dir, "file.ts");
		fs.mkdirSync(path.join(dir, ".git"));
		touch(path.join(dir, ".git"), "config");

		const results = await globPaths("**/*", { cwd: dir });
		expect(results).not.toContain(".git");
		expect(results).not.toContain(".git/config");
	});

	it("excludes node_modules by default", async () => {
		const dir = makeTmpDir();
		touch(dir, "file.ts");
		fs.mkdirSync(path.join(dir, "node_modules"));
		touch(path.join(dir, "node_modules"), "pkg.js");

		const results = await globPaths("**/*", { cwd: dir });
		expect(results).not.toContain("node_modules");
		expect(results).not.toContain("node_modules/pkg.js");
	});

	it("does NOT exclude node_modules when pattern mentions it", async () => {
		const dir = makeTmpDir();
		fs.mkdirSync(path.join(dir, "node_modules"));
		touch(path.join(dir, "node_modules"), "pkg.js");
		fs.mkdirSync(path.join(dir, ".git"));

		// When the pattern mentions node_modules, default exclusion is lifted
		const results = await globPaths("**/node_modules/**/*.js", { cwd: dir });
		expect(results.some(r => r.includes("node_modules"))).toBe(true);
		// .git is still excluded (no node_modules in pattern)
		expect(results).not.toContain(".git");
	});

	it("applies custom exclude patterns", async () => {
		const dir = makeTmpDir();
		touch(dir, "keep.ts");
		touch(dir, "skip.ts");
		touch(dir, "also-skip.ts");

		const results = await globPaths("**/*.ts", {
			cwd: dir,
			exclude: ["**/skip.ts", "**/also-skip.ts"],
		});
		expect(results).toEqual(["keep.ts"]);
	});

	it("combines default excludes with custom excludes", async () => {
		const dir = makeTmpDir();
		touch(dir, "keep.ts");
		touch(dir, "skip.ts");
		fs.mkdirSync(path.join(dir, "node_modules"));
		touch(path.join(dir, "node_modules"), "pkg.js");

		// node_modules still excluded even with custom exclude list
		const results = await globPaths(["**/*.ts", "**/*.js"], {
			cwd: dir,
			exclude: ["**/skip.ts"],
		});
		expect(results).not.toContain("node_modules/pkg.js");
		expect(results).toContain("keep.ts");
	});

	it("accepts empty pattern array and returns empty result", async () => {
		const dir = makeTmpDir();
		touch(dir, "file.ts");

		const results = await globPaths([], { cwd: dir });
		expect(results).toEqual([]);
	});
});

// ---------------------------------------------------------------------------
// globPaths — multiple patterns
// ---------------------------------------------------------------------------
describe("globPaths — multiple patterns", () => {
	it("returns union of results from multiple patterns", async () => {
		const dir = makeTmpDir();
		touch(dir, "a.ts");
		touch(dir, "b.js");
		touch(dir, "c.txt");

		const results = await globPaths(["**/*.ts", "**/*.js"], { cwd: dir });
		expect(results.sort()).toEqual(["a.ts", "b.js"]);
	});
});

// ---------------------------------------------------------------------------
// globPaths — gitignore integration
// ---------------------------------------------------------------------------
describe("globPaths — gitignore integration", () => {
	it("excludes .env when listed in .gitignore with gitignore=true", async () => {
		const dir = makeTmpDir();
		touch(dir, "tracked.ts");
		touch(dir, ".env");
		writeGitignore(dir, ".env\n");

		const results = await globPaths("**/*", { cwd: dir, gitignore: true });
		expect(results).not.toContain(".env");
		expect(results).toContain("tracked.ts");
	});

	it("does not filter when gitignore=false (default)", async () => {
		const dir = makeTmpDir();
		touch(dir, "secret.env");
		writeGitignore(dir, ".env\n");

		const results = await globPaths("**/*", { cwd: dir, gitignore: false });
		expect(results).toContain("secret.env");
	});

	it("ignores comment lines in .gitignore", async () => {
		const dir = makeTmpDir();
		touch(dir, "keep.txt");
		touch(dir, "skip.log");
		writeGitignore(dir, "# comment\nskip.log\n");

		const results = await globPaths("**/*", { cwd: dir, gitignore: true });
		expect(results).not.toContain("skip.log");
		expect(results).toContain("keep.txt");
	});

	it("ignores negation patterns (unsupported — files remain excluded)", async () => {
		const dir = makeTmpDir();
		touch(dir, "negated.log");
		writeGitignore(dir, "*.log\n!important.log\n");

		// Negation not supported — negated.log is still excluded
		const results = await globPaths("**/*.log", { cwd: dir, gitignore: true });
		expect(results).not.toContain("negated.log");
	});

	it("walks up directory tree collecting .gitignore from parent dirs", async () => {
		const dir = makeTmpDir();
		const subDir = path.join(dir, "sub");
		fs.mkdirSync(subDir);
		touch(dir, "root.ts");
		touch(subDir, "sub.tmp");
		touch(subDir, "sub.ts");
		writeGitignore(dir, "*.tmp\n");

		// Pattern without **/ only matches in cwd (subDir), not parent files
		const results = await globPaths("**/*.tmp", { cwd: subDir, gitignore: true });
		expect(results).not.toContain("sub.tmp");
	});

	it("resolves unrooted pattern * log (without **/) against gitignore cwd, not glob cwd", async () => {
		// This tests whether *.log in subDir/.gitignore applies when globbing from subDir
		const dir = makeTmpDir();
		const subDir = path.join(dir, "sub");
		fs.mkdirSync(subDir);
		touch(subDir, "file.log");
		touch(subDir, "file.ts");
		writeGitignore(subDir, "*.log\n");

		const results = await globPaths("**/*", { cwd: subDir, gitignore: true });
		expect(results).not.toContain("file.log");
		expect(results).toContain("file.ts");
	});

	it("skips rooted /outside.tmp patterns pointing outside glob cwd", async () => {
		const dir = makeTmpDir();
		const subDir = path.join(dir, "sub");
		fs.mkdirSync(subDir);
		touch(subDir, "inside.ts");
		// /outside.tmp points to dir/outside.tmp, outside cwd=subDir → skipped
		writeGitignore(subDir, "/outside.tmp\n");

		const results = await globPaths("**/*", { cwd: subDir, gitignore: true });
		expect(results).toContain("inside.ts");
	});

	it("handles directory patterns (trailing /) as matching dir and contents", async () => {
		const dir = makeTmpDir();
		fs.mkdirSync(path.join(dir, "logs"));
		touch(path.join(dir, "logs"), "app.log");
		touch(dir, "root.log");
		writeGitignore(dir, "logs/\n");

		const results = await globPaths("**/*", { cwd: dir, gitignore: true });
		expect(results).not.toContain("logs");
		expect(results).not.toContain("logs/app.log");
		expect(results).toContain("root.log");
	});

	it("handles missing .gitignore gracefully", async () => {
		const dir = makeTmpDir();
		touch(dir, "file.ts");
		// No .gitignore written — should not throw
		const results = await globPaths("**/*.ts", { cwd: dir, gitignore: true });
		expect(results).toEqual(["file.ts"]);
	});
});

// ---------------------------------------------------------------------------
// globPaths — signal / timeout
// ---------------------------------------------------------------------------
describe("globPaths — signal / timeout", () => {
	it("aborts when signal is already aborted (before any scan)", async () => {
		const dir = makeTmpDir();
		touch(dir, "file.ts");
		const controller = new AbortController();
		controller.abort();

		await expect(globPaths("**/*.ts", { cwd: dir, signal: controller.signal })).rejects.toThrow();
	});
});
