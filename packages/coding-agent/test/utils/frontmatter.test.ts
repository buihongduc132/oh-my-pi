import { beforeEach, describe, expect, test, vi } from "bun:test";

// Mock the logger to prevent log output during tests
const mockLogger = {
	info: vi.fn(),
	warn: vi.fn(),
	error: vi.fn(),
	debug: vi.fn(),
	verbose: vi.fn(),
};
vi.mock("@oh-my-pi/pi-utils", () => ({
	logger: mockLogger,
	truncate: (s: string, n: number) => (s.length > n ? `${s.slice(0, n)}…` : s),
}));

// Must re-import after mocking
const { parseFrontmatter, FrontmatterError } = await import("../../src/utils/frontmatter");

beforeEach(() => {
	mockLogger.warn.mockClear();
	mockLogger.error.mockClear();
});

describe("parseFrontmatter", () => {
	test("returns empty frontmatter and full body when no frontmatter", () => {
		const content = "Hello world\n\nThis is content.";
		const result = parseFrontmatter(content);
		expect(result.frontmatter).toEqual({});
		expect(result.body).toBe(content);
	});

	test("returns empty frontmatter and empty body for empty string", () => {
		const result = parseFrontmatter("");
		expect(result.frontmatter).toEqual({});
		expect(result.body).toBe("");
	});

	test("parses valid YAML frontmatter", () => {
		const content = `---\ntitle: Test\ncount: 42\n---\nBody content`;
		const result = parseFrontmatter(content);
		expect(result.frontmatter).toEqual({ title: "Test", count: 42 });
		expect(result.body).toBe("Body content");
	});

	test("handles CRLF line endings", () => {
		const content = "---\r\ntitle: Test\r\n---\r\nBody";
		const result = parseFrontmatter(content);
		expect(result.frontmatter).toEqual({ title: "Test" });
		expect(result.body).toBe("Body");
	});

	test("handles lone CR line endings", () => {
		const content = "---\rtitle: Test\r---\rBody";
		const result = parseFrontmatter(content);
		expect(result.frontmatter).toEqual({ title: "Test" });
		expect(result.body).toBe("Body");
	});

	test("returns empty frontmatter when --- is present but no closing ---", () => {
		const content = "---\ntitle: Test\nno closing marker here";
		const result = parseFrontmatter(content);
		expect(result.frontmatter).toEqual({});
		expect(result.body).toBe(content);
	});

	test("strips HTML comments from entire content before body slicing", () => {
		const content = `---\ntitle: Before\n---\n<!-- comment -->\nBody`;
		const result = parseFrontmatter(content);
		expect(result.frontmatter).toEqual({ title: "Before" });
		// stripHtmlComments runs on the whole normalized content before body extraction,
		// so HTML comments in the body are stripped too
		expect(result.body).toBe("Body");
	});

	test("applies fallback values when frontmatter is empty", () => {
		const result = parseFrontmatter("No frontmatter", { fallback: { default: true } });
		expect(result.frontmatter).toEqual({ default: true });
	});

	test("merges fallback with parsed frontmatter (fallback first)", () => {
		const content = `---\ntitle: FromContent\n---\nBody`;
		const result = parseFrontmatter(content, { fallback: { title: "Fallback", extra: "val" } });
		expect(result.frontmatter).toEqual({ title: "FromContent", extra: "val" });
	});

	test("kebab-case keys are normalized to camelCase by default", () => {
		const content = `---\nthinking-level: 2\nmax-retries: 3\n---\nBody`;
		const result = parseFrontmatter(content);
		expect(result.frontmatter).toEqual({ thinkingLevel: 2, maxRetries: 3 });
	});

	test("key normalization is recursive (nested objects and arrays)", () => {
		const content = `---\nouter-key:\n  inner-key: value\n  list-items:\n    - deep-key: x\n---\nBody`;
		const result = parseFrontmatter(content);
		expect(result.frontmatter).toEqual({
			outerKey: {
				innerKey: "value",
				listItems: [{ deepKey: "x" }],
			},
		});
	});

	test("normalize=false skips content normalization but keys are still camelCased", () => {
		const content = `---\nthinking-level: 2\n---\nBody`;
		const result = parseFrontmatter(content, { normalize: false });
		// normalizeKeys always runs on parsed frontmatter regardless of normalize option
		expect(result.frontmatter).toEqual({ thinkingLevel: 2 });
	});

	test("level=off does not log on YAML error", () => {
		const content = `---\nkey: [unclosed\n---\nBody`;
		parseFrontmatter(content, { level: "off" });
		expect(mockLogger.warn).not.toHaveBeenCalled();
	});

	test("level=warn logs on YAML error", () => {
		const content = `---\nkey: [unclosed\n---\nBody`;
		parseFrontmatter(content, { level: "warn" });
		expect(mockLogger.warn).toHaveBeenCalled();
	});

	test("level=fatal throws FrontmatterError on YAML error", () => {
		const content = `---\nkey: [unclosed\n---\nBody`;
		expect(() => parseFrontmatter(content, { level: "fatal" })).toThrow(FrontmatterError);
	});

	test("converts deeply nested kebab keys through normalizeKeys", () => {
		const content = `---\na:\n  nested-key: val\n---\n`;
		const result = parseFrontmatter(content);
		expect(result.frontmatter).toEqual({ a: { nestedKey: "val" } });
	});

	test("fallback keys preserved as-is when no YAML frontmatter present", () => {
		// When no frontmatter block exists, early return skips normalizeKeys on fallback
		const result = parseFrontmatter("plain text", {
			fallback: { "kebab-key": "val" },
		});
		expect(result.frontmatter).toEqual({ "kebab-key": "val" });
	});
});

describe("FrontmatterError", () => {
	test("formats error message with source", () => {
		const cause = new Error("YAML error");
		const err = new FrontmatterError(cause, "my-source");
		expect(err.message).toContain("Failed to parse YAML frontmatter");
		expect(err.message).toContain("my-source");
		expect(err.cause).toBe(cause);
		expect(err.name).toBe("FrontmatterError");
	});

	test("toString() includes source when present", () => {
		const cause = new Error("boom");
		const err = new FrontmatterError(cause, "some-file.md");
		const str = err.toString();
		expect(str).toContain("some-file.md");
		expect(str).toContain("boom");
	});

	test("toString() omits source line when source is undefined", () => {
		const err = new FrontmatterError(new Error("boom"));
		const str = err.toString();
		expect(str).not.toContain("Source:");
		expect(str).toContain("boom");
	});

	test("toString() includes cause stack when available", () => {
		const err = new FrontmatterError(new Error("boom"));
		const str = err.toString();
		expect(str).toContain("Stack:");
	});

	test("toString() falls back to own stack when cause has no stack", () => {
		const err = new FrontmatterError(new Error("boom"));
		Object.defineProperty(err.cause!, "stack", { value: undefined, configurable: true });
		const str = err.toString();
		expect(str).toContain("Stack:");
	});
});
