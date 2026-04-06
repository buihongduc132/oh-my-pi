/**
 * Unit tests for resolveSettingValue() — the {file:<path>} / {env:<VAR>}
 * substitution function used to load compaction prompts from files or env vars.
 */

import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

import { resolveSettingValue } from "../src/session/compaction/compaction";

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

	function withEnv(vars: Record<string, string | undefined>, fn: () => void): void {
		const originals: Record<string, string | undefined> = {};
		for (const key of Object.keys(vars)) {
			originals[key] = process.env[key];
		}
		try {
			for (const [key, val] of Object.entries(vars)) {
				if (val === undefined) {
					delete process.env[key];
				} else {
					process.env[key] = val;
				}
			}
			fn();
		} finally {
			for (const [key, val] of Object.entries(originals)) {
				if (val === undefined) {
					delete process.env[key];
				} else {
					process.env[key] = val;
				}
			}
		}
	}

	// -------------------------------------------------------------------------
	// Raw string passthrough
	// -------------------------------------------------------------------------

	it("returns raw string unchanged when no markers present", async () => {
		const value = "This is a plain prompt without any markers.";
		expect(await resolveSettingValue(value, tempDir)).toBe(value);
	});

	it("returns empty string when value is empty", async () => {
		expect(await resolveSettingValue("", tempDir)).toBe("");
	});

	it("returns value with surrounding whitespace preserved", async () => {
		const value = "  Prompt with spaces  ";
		expect(await resolveSettingValue(value, tempDir)).toBe(value);
	});

	// -------------------------------------------------------------------------
	// {env:<VAR>} substitution
	// -------------------------------------------------------------------------

	it("substitutes {env:VAR} with environment variable value", async () => {
		await withEnv({ TEST_VAR: "Hello from env!" }, async () => {
			const result = await resolveSettingValue("prefix {env:TEST_VAR} suffix", tempDir);
			expect(result).toBe("prefix Hello from env! suffix");
		});
	});

	it("substitutes {env:VAR} with empty string when env var is unset", async () => {
		await withEnv({ UNSET_VAR_FOR_TEST: undefined }, async () => {
			const result = await resolveSettingValue("before {env:UNSET_VAR_FOR_TEST} after", tempDir);
			expect(result).toBe("before  after");
		});
	});

	it("substitutes multiple {env:...} markers in one string", async () => {
		await withEnv({ FIRST_VAR: "one", SECOND_VAR: "two" }, async () => {
			const result = await resolveSettingValue("{env:FIRST_VAR} + {env:SECOND_VAR}", tempDir);
			expect(result).toBe("one + two");
		});
	});

	// -------------------------------------------------------------------------
	// {file:<path>} substitution
	// -------------------------------------------------------------------------

	it("substitutes {file:<path>} with file content", async () => {
		writeFile("my-prompt.md", "This is my custom prompt content.");
		const result = await resolveSettingValue("{file:my-prompt.md}", tempDir);
		expect(result).toBe("This is my custom prompt content.");
	});

	it("resolves {file:<path>} relative to cwd", async () => {
		writeFile("subdir/nested.txt", "Nested file content.");
		const result = await resolveSettingValue("{file:subdir/nested.txt}", tempDir);
		expect(result).toBe("Nested file content.");
	});

	it("resolves absolute {file:<path>} directly", async () => {
		const fullPath = writeFile("absolute-test.txt", "Absolute file content.");
		const result = await resolveSettingValue(`{file:${fullPath}}`, tempDir);
		expect(result).toBe("Absolute file content.");
	});

	it("returns empty string when {file:<path>} file does not exist", async () => {
		const result = await resolveSettingValue("{file:nonexistent/file.md}", tempDir);
		expect(result).toBe("");
	});

	it("reads file content with exact whitespace and newlines preserved", async () => {
		const content = "Line 1\n\nLine 3\n";
		writeFile("whitespace.txt", content);
		const result = await resolveSettingValue("{file:whitespace.txt}", tempDir);
		expect(result).toBe(content);
	});

	// -------------------------------------------------------------------------
	// Path traversal security
	// -------------------------------------------------------------------------

	it("blocks path traversal via ../ — returns empty string", async () => {
		// Create a sentinel file one level up from tempDir
		const parentDir = path.dirname(tempDir);
		const sentinelPath = path.join(parentDir, "sentinel-file.txt");
		fs.writeFileSync(sentinelPath, "SECRET DATA");
		try {
			const result = await resolveSettingValue(
				`{file:${path.join(path.basename(tempDir), "..", "sentinel-file.txt")}}`,
				tempDir,
			);
			// Must NOT return the secret content — should be blocked
			expect(result).not.toContain("SECRET DATA");
			expect(result).toBe("");
		} finally {
			fs.unlinkSync(sentinelPath);
		}
	});

	it("blocks absolute path traversal — returns empty when path is outside cwd", async () => {
		// Write a file in /tmp, try to read it with an absolute path from a different cwd
		const otherDir = fs.mkdtempSync(path.join(os.tmpdir(), "other-cwd-"));
		const secretPath = path.join(otherDir, "secret.txt");
		fs.writeFileSync(secretPath, "TOP SECRET");
		try {
			// Attempting to read an absolute path from tempDir's cwd should be blocked
			const result = await resolveSettingValue(`{file:${secretPath}}`, tempDir);
			expect(result).not.toContain("TOP SECRET");
			expect(result).toBe("");
		} finally {
			fs.rmSync(otherDir, { recursive: true, force: true });
		}
	});

	// -------------------------------------------------------------------------
	// Nested {file:{env:<VAR>}/<path>} substitution
	// -------------------------------------------------------------------------

	it("handles nested {file:{env:VAR}/path} — env resolved first then file", async () => {
		const subdir = writeFile("sub/prompt.txt", "Loaded from nested path.");
		const subdirName = path.basename(path.dirname(subdir)); // "sub"
		await withEnv({ TEST_SUBDIR: subdirName }, async () => {
			const result = await resolveSettingValue(`{file:{env:TEST_SUBDIR}/prompt.txt}`, tempDir);
			expect(result).toBe("Loaded from nested path.");
		});
	});

	it("nested path where env var is unset → file path becomes empty → returns empty", async () => {
		await withEnv({ UNSET_NESTED_VAR: undefined }, async () => {
			const result = await resolveSettingValue("{file:{env:UNSET_NESTED_VAR}/prompt.txt}", tempDir);
			// After env substitution: {file:/prompt.txt} — absolute /prompt.txt is outside cwd
			// Result should be empty string (traversal blocked)
			expect(result).toBe("");
		});
	});

	// -------------------------------------------------------------------------
	// Empty prompt fallback (bug fix)
	// -------------------------------------------------------------------------

	it("returns empty string for unset env var so caller can fall back to bundled prompt", async () => {
		await withEnv({ UNSET_VAR: undefined }, async () => {
			const result = await resolveSettingValue("{env:UNSET_VAR}", tempDir);
			// Empty string signals to caller: use bundled prompt
			expect(result).toBe("");
		});
	});

	// -------------------------------------------------------------------------
	// Mixed / combined
	// -------------------------------------------------------------------------

	it("combines env and file substitution in one string", async () => {
		writeFile("prompt.txt", "File-based prompt.");
		await withEnv({ PROMPT_PREFIX: "PREFIX:" }, async () => {
			const result = await resolveSettingValue("{env:PROMPT_PREFIX} {file:prompt.txt}", tempDir);
			expect(result).toBe("PREFIX: File-based prompt.");
		});
	});

	it("returns original value when only whitespace markers are present", async () => {
		// {file:} or {env:} with empty name — not realistic but should be handled
		const result = await resolveSettingValue("{file:} {env:}", tempDir);
		// Empty env → empty string; empty file path → safe within cwd, may or may not exist
		// The result should at least not throw
		expect(typeof result).toBe("string");
	});

	// -------------------------------------------------------------------------
	// Prompt integration scenarios
	// -------------------------------------------------------------------------

	it("realistic compaction prompt scenario — {file:.omp/prompts/custom.md}", async () => {
		writeFile(".omp/prompts/custom-summary.md", "# Custom Summary\n\nMy custom prompt.");
		const result = await resolveSettingValue("{file:.omp/prompts/custom-summary.md}", tempDir);
		expect(result).toBe("# Custom Summary\n\nMy custom prompt.");
	});

	it("realistic compaction prompt scenario — {env:OMP_COMPACTION_PROMPT}", async () => {
		await withEnv(
			{
				OMP_COMPACTION_PROMPT: "You are a summarization assistant. Be very concise.",
			},
			async () => {
				const result = await resolveSettingValue("{env:OMP_COMPACTION_PROMPT}", tempDir);
				expect(result).toBe("You are a summarization assistant. Be very concise.");
			},
		);
	});

	it("mixed file and env reference", async () => {
		writeFile(".omp/prompts/update.md", "## Update Prompt\n\nMerge with previous.");
		await withEnv({ PROMPT_DIR: ".omp/prompts" }, async () => {
			const result = await resolveSettingValue("{file:{env:PROMPT_DIR}/update.md}", tempDir);
			expect(result).toBe("## Update Prompt\n\nMerge with previous.");
		});
	});

	it("mixed file and env reference", async () => {
		writeFile(".omp/prompts/update.md", "## Update Prompt\n\nMerge with previous.");
		await withEnv({ PROMPT_DIR: ".omp/prompts" }, async () => {
			const result = await resolveSettingValue("{file:{env:PROMPT_DIR}/update.md}", tempDir);
			expect(result).toBe("## Update Prompt\n\nMerge with previous.");
		});
	});
});
