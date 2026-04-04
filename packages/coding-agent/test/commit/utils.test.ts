import { describe, expect, it } from "bun:test";
import type { AssistantMessage } from "@oh-my-pi/pi-ai";
import {
	extractTextContent,
	extractToolCall,
	normalizeAnalysis,
	parseJsonPayload,
} from "@oh-my-pi/pi-coding-agent/commit/utils";

function makeMsg(contents: any[]): AssistantMessage {
	return {
		type: "assistant",
		id: "msg1",
		role: "assistant",
		content: contents,
	} as any;
}

function makeToolCall(name: string, input: Record<string, unknown> = {}): any {
	return { type: "toolCall" as const, name, input };
}
function makeText(text: string): any {
	return { type: "text" as const, text };
}

describe("extractToolCall", () => {
	it("returns undefined when no tool calls present", () => {
		const msg = makeMsg([makeText("hello")]);
		expect(extractToolCall(msg, "read")).toBeUndefined();
	});

	it("returns the matching tool call", () => {
		const call = makeToolCall("read", { path: "/tmp/foo" });
		const msg = makeMsg([makeText("hi"), call, makeText("after")]);
		const result = extractToolCall(msg, "read");
		expect(result).toBeDefined();
		expect(result!.name).toBe("read");
		expect((result as any).input.path).toBe("/tmp/foo");
	});

	it("returns undefined when no match found", () => {
		const msg = makeMsg([makeToolCall("write"), makeToolCall("read")]);
		expect(extractToolCall(msg, "nonexistent")).toBeUndefined();
	});

	it("returns first matching tool call when multiple present", () => {
		const first = makeToolCall("read", { path: "/first" });
		const second = makeToolCall("read", { path: "/second" });
		const msg = makeMsg([first, second]);
		const result = extractToolCall(msg, "read");
		expect((result as any).input.path).toBe("/first");
	});
});

describe("extractTextContent", () => {
	it("returns empty string for no text", () => {
		const msg = makeMsg([makeToolCall("read")]);
		expect(extractTextContent(msg)).toBe("");
	});

	it("extracts single text block", () => {
		const msg = makeMsg([makeText("hello world")]);
		expect(extractTextContent(msg)).toBe("hello world");
	});

	it("concatenates multiple text blocks", () => {
		const msg = makeMsg([makeText("hello "), makeText("world")]);
		expect(extractTextContent(msg)).toBe("hello world");
	});

	it("trims whitespace", () => {
		const msg = makeMsg([makeText("  hello  \n")]);
		expect(extractTextContent(msg)).toBe("hello");
	});

	it("preserves spacing in text nodes around tool calls", () => {
		const msg = makeMsg([makeText("before "), makeToolCall("read"), makeText(" after")]);
		// Tool calls are skipped, but surrounding text nodes are concatenated
		expect(extractTextContent(msg)).toBe("before  after");
	});
});

describe("parseJsonPayload", () => {
	it("parses a simple object", () => {
		const result = parseJsonPayload('{"name":"test","count":42}');
		expect(result).toEqual({ name: "test", count: 42 });
	});

	it("parses object with surrounding text", () => {
		const result = parseJsonPayload('some text {"name":"test"} more');
		expect(result).toEqual({ name: "test" });
	});

	it("throws when no JSON found", () => {
		expect(() => parseJsonPayload("no json here")).toThrow("No JSON payload");
	});

	it("throws when JSON is incomplete", () => {
		expect(() => parseJsonPayload("{incomplete")).toThrow();
	});
});

describe("normalizeAnalysis", () => {
	it("normalizes a full analysis object", () => {
		const input = {
			type: "feat" as const,
			scope: "api  ",
			details: [
				{ text: "  added login  ", changelog_category: "Added" as const, user_visible: true },
				{ text: "internal refactor", user_visible: false },
			],
			issue_refs: ["#123", "#456"],
		};
		const result = normalizeAnalysis(input);
		expect(result.type).toBe("feat");
		expect(result.scope).toBe("api");
		expect(result.details).toHaveLength(2);
		expect(result.details[0].text).toBe("added login");
		expect(result.details[0].changelogCategory).toBe("Added");
		expect(result.details[0].userVisible).toBe(true);
		expect(result.details[1].userVisible).toBe(false);
		expect(result.issueRefs).toEqual(["#123", "#456"]);
	});

	it("handles null scope", () => {
		const result = normalizeAnalysis({ type: "fix" as const, scope: null, details: [], issue_refs: [] });
		expect(result.scope).toBeNull();
	});

	it("handles undefined issue_refs", () => {
		const result = normalizeAnalysis({ type: "chore" as const, scope: null, details: [], issue_refs: [] });
		expect(result.issueRefs).toEqual([]);
	});

	it("defaults userVisible to false", () => {
		const input = {
			type: "refactor" as const,
			scope: null,
			details: [{ text: "changed" }],
			issue_refs: [],
		};
		const result = normalizeAnalysis(input);
		expect(result.details[0].userVisible).toBe(false);
	});
});
