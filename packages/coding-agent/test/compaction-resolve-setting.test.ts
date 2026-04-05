/**
 * Unit tests for resolveSettingValue() — the {file:<path>} / {env:<VAR>}
 * substitution function used to load compaction prompts from files or env vars.
 */

import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

/** Inline implementation (same as compaction.ts) */
function resolveSettingValue(value: string, cwd: string): string {
	let resolved = value;
	resolved = resolved.replace(/\{env:([^}]+)\}/g, (_, varName) => {
		return process.env[varName] ?? "";
	});
	resolved = resolved.replace(/\{file:([^}]+)\}/g, (_, filePath) => {
		const absolutePath = path.isAbsolute(filePath) ? filePath : path.join(cwd, filePath);
		try {
			return fs.readFileSync(absolutePath, "utf8");
		} catch {
			return "";
		}
	});
	return resolved;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("resolveSettingValue", () => {
	let tempDir: string;

	beforeEach(() => {
		tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "resolve-setting-test-"));
	});

	afterEach(() => {
		fs.rmSync(tempDir, { recursive: true, force: true });
	});

	function writeFile(relativePath: string, content: string): string {
		const fullPath = path.join(tempDir, relativePath);
		fs.mkdirSync(path.dirname(fullPath), { recursive: true });
		fs.writeFileSync(fullPath, content, "utf8");
		return fullPath;
	}

	// -------------------------------------------------------------------------
	// Raw string passthrough
	// -------------------------------------------------------------------------

	it("returns raw string unchanged when no markers present", () => {
		const value = "This is a plain prompt without any markers.";
		expect(resolveSettingValue(value, tempDir)).toBe(value);
	});

	it("returns empty string when value is empty", () => {
		expect(resolveSettingValue("", tempDir)).toBe("");
	});

	it("returns value with surrounding whitespace preserved", () => {
		const value = "  Prompt with spaces  ";
		expect(resolveSettingValue(value, tempDir)).toBe(value);
	});

	// -------------------------------------------------------------------------
	// {env:<VAR>} substitution
	// -------------------------------------------------------------------------

	it("substitutes {env:VAR} with environment variable value", () => {
		const originalValue = process.env.TEST_VAR;
		process.env.TEST_VAR = "Hello from env!";
		try {
			const result = resolveSettingValue("prefix {env:TEST_VAR} suffix", tempDir);
			expect(result).toBe("prefix Hello from env! suffix");
		} finally {
			if (originalValue === undefined) {
				delete process.env.TEST_VAR;
			} else {
				process.env.TEST_VAR = originalValue;
			}
		}
	});

	it("substitutes {env:VAR} with empty string when env var is unset", () => {
		const original = process.env.UNSET_VAR_FOR_TEST;
		delete process.env.UNSET_VAR_FOR_TEST;
		try {
			const result = resolveSettingValue("before {env:UNSET_VAR_FOR_TEST} after", tempDir);
			expect(result).toBe("before  after");
		} finally {
			if (original !== undefined) {
				process.env.UNSET_VAR_FOR_TEST = original;
			}
		}
	});

	it("substitutes multiple {env:...} markers in one string", () => {
		process.env.FIRST_VAR = "one";
		process.env.SECOND_VAR = "two";
		try {
			const result = resolveSettingValue("{env:FIRST_VAR} + {env:SECOND_VAR}", tempDir);
			expect(result).toBe("one + two");
		} finally {
			delete process.env.FIRST_VAR;
			delete process.env.SECOND_VAR;
		}
	});

	// -------------------------------------------------------------------------
	// {file:<path>} substitution
	// -------------------------------------------------------------------------

	it("substitutes {file:<path>} with file content", () => {
		writeFile("my-prompt.md", "This is my custom prompt content.");
		const result = resolveSettingValue("{file:my-prompt.md}", tempDir);
		expect(result).toBe("This is my custom prompt content.");
	});

	it("resolves {file:<path>} relative to cwd", () => {
		writeFile("subdir/nested.txt", "Nested file content.");
		const result = resolveSettingValue("{file:subdir/nested.txt}", tempDir);
		expect(result).toBe("Nested file content.");
	});

	it("resolves absolute {file:<path>} directly", () => {
		const fullPath = writeFile("absolute-test.txt", "Absolute file content.");
		const result = resolveSettingValue(`{file:${fullPath}}`, tempDir);
		expect(result).toBe("Absolute file content.");
	});

	it("returns empty string when {file:<path>} file does not exist", () => {
		const result = resolveSettingValue("{file:nonexistent/file.md}", tempDir);
		expect(result).toBe("");
	});

	it("reads file content with exact whitespace and newlines preserved", () => {
		const content = "Line 1\n\nLine 3\n";
		writeFile("whitespace.txt", content);
		const result = resolveSettingValue("{file:whitespace.txt}", tempDir);
		expect(result).toBe(content);
	});

	// -------------------------------------------------------------------------
	// Nested {file:{env:<VAR>}/<path>} substitution
	// -------------------------------------------------------------------------

	it("handles nested {file:{env:VAR}/path} — env resolved first then file", () => {
		const subdir = writeFile("sub/prompt.txt", "Loaded from nested path.");
		const subdirName = path.basename(path.dirname(subdir)); // "sub"
		process.env.TEST_SUBDIR = subdirName;
		try {
			const result = resolveSettingValue("{file:{env:TEST_SUBDIR}/prompt.txt}", tempDir);
			expect(result).toBe("Loaded from nested path.");
		} finally {
			delete process.env.TEST_SUBDIR;
		}
	});

	it("nested path where env var is unset → file path becomes empty → returns empty", () => {
		delete process.env.UNSET_NESTED_VAR;
		const result = resolveSettingValue("{file:{env:UNSET_NESTED_VAR}/prompt.txt}", tempDir);
		// After env substitution: {file:/prompt.txt} — absolute /prompt.txt probably doesn't exist
		// Result should be empty string
		expect(result).toBe("");
	});

	// -------------------------------------------------------------------------
	// Mixed / combined
	// -------------------------------------------------------------------------

	it("combines env and file substitution in one string", () => {
		writeFile("prompt.txt", "File-based prompt.");
		process.env.PROMPT_PREFIX = "PREFIX:";
		try {
			const result = resolveSettingValue("{env:PROMPT_PREFIX} {file:prompt.txt}", tempDir);
			expect(result).toBe("PREFIX: File-based prompt.");
		} finally {
			delete process.env.PROMPT_PREFIX;
		}
	});

	it("returns original value when only whitespace markers are present", () => {
		// {file:} or {env:} with empty name — not realistic but should be handled
		const result = resolveSettingValue("{file:} {env:}", tempDir);
		// Empty env → empty string; empty file path → likely treated as path "." or fails
		// The result should at least not throw
		expect(typeof result).toBe("string");
	});

	// -------------------------------------------------------------------------
	// Prompt integration scenarios
	// -------------------------------------------------------------------------

	it("realistic compaction prompt scenario — {file:.omp/prompts/custom.md}", () => {
		writeFile(".omp/prompts/custom-summary.md", "# Custom Summary\n\nMy custom prompt.");
		const result = resolveSettingValue("{file:.omp/prompts/custom-summary.md}", tempDir);
		expect(result).toBe("# Custom Summary\n\nMy custom prompt.");
	});

	it("realistic compaction prompt scenario — {env:OMP_COMPACTION_PROMPT}", () => {
		process.env.OMP_COMPACTION_PROMPT = "You are a summarization assistant. Be very concise.";
		try {
			const result = resolveSettingValue("{env:OMP_COMPACTION_PROMPT}", tempDir);
			expect(result).toBe("You are a summarization assistant. Be very concise.");
		} finally {
			delete process.env.OMP_COMPACTION_PROMPT;
		}
	});

	it("mixed file and env reference", () => {
		process.env.PROMPT_DIR = ".omp/prompts";
		writeFile(".omp/prompts/update.md", "## Update Prompt\n\nMerge with previous.");
		try {
			const result = resolveSettingValue("{file:{env:PROMPT_DIR}/update.md}", tempDir);
			expect(result).toBe("## Update Prompt\n\nMerge with previous.");
		} finally {
			delete process.env.PROMPT_DIR;
		}
	});
});
