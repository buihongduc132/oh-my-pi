import { describe, expect, it } from "bun:test";
import {
	createOpenAIResponsesHistoryPayload,
	getOpenAIResponsesHistoryItems,
	getOpenAIResponsesHistoryPayload,
	isAnthropicOAuthToken,
	normalizeResponsesToolCallId,
	normalizeToolCallId,
	resolveCacheRetention,
	sanitizeOpenAIResponsesHistoryItemsForReplay,
	toBoolean,
	toNumber,
	toPositiveNumber,
	truncateResponseItemId,
} from "@oh-my-pi/pi-ai/utils";

describe("toNumber", () => {
	it("returns number for a finite number", () => {
		expect(toNumber(42)).toBe(42);
		expect(toNumber(3.14)).toBe(3.14);
		expect(toNumber(-100)).toBe(-100);
	});

	it("returns undefined for Infinity", () => {
		expect(toNumber(Infinity)).toBeUndefined();
		expect(toNumber(-Infinity)).toBeUndefined();
	});

	it("returns undefined for NaN", () => {
		expect(toNumber(NaN)).toBeUndefined();
	});

	it("parses a numeric string", () => {
		expect(toNumber("123")).toBe(123);
		expect(toNumber("3.14")).toBe(3.14);
		expect(toNumber("-42")).toBe(-42);
	});

	it("returns undefined for whitespace-only string", () => {
		expect(toNumber("   ")).toBeUndefined();
		expect(toNumber("")).toBeUndefined();
	});

	it("returns undefined for non-numeric string", () => {
		expect(toNumber("hello")).toBeUndefined();
	});

	it("returns undefined for null", () => {
		expect(toNumber(null)).toBeUndefined();
	});

	it("returns undefined for undefined", () => {
		expect(toNumber(undefined)).toBeUndefined();
	});

	it("returns undefined for object", () => {
		expect(toNumber({})).toBeUndefined();
	});
});

describe("toPositiveNumber", () => {
	it("returns the value when positive", () => {
		expect(toPositiveNumber(10, 0)).toBe(10);
		expect(toPositiveNumber(0.001, 0)).toBe(0.001);
	});

	it("returns fallback for zero", () => {
		expect(toPositiveNumber(0, 999)).toBe(999);
	});

	it("returns fallback for negative", () => {
		expect(toPositiveNumber(-5, 42)).toBe(42);
	});

	it("returns fallback for non-number", () => {
		expect(toPositiveNumber("abc" as any, 1)).toBe(1);
		expect(toPositiveNumber(null, 1)).toBe(1);
		expect(toPositiveNumber(undefined, 1)).toBe(1);
	});

	it("returns fallback for Infinity", () => {
		expect(toPositiveNumber(Infinity, 0)).toBe(0);
	});

	it("returns fallback for NaN", () => {
		expect(toPositiveNumber(NaN, 0)).toBe(0);
	});
});

describe("toBoolean", () => {
	it("returns true for true", () => {
		expect(toBoolean(true)).toBe(true);
	});

	it("returns false for false", () => {
		expect(toBoolean(false)).toBe(false);
	});

	it("returns undefined for truthy non-boolean", () => {
		expect(toBoolean("yes")).toBeUndefined();
		expect(toBoolean(1)).toBeUndefined();
	});

	it("returns undefined for falsy non-boolean values", () => {
		expect(toBoolean(null)).toBeUndefined();
		expect(toBoolean(0)).toBeUndefined();
		expect(toBoolean("")).toBeUndefined();
	});
});

describe("normalizeToolCallId", () => {
	it("returns id unchanged when valid", () => {
		expect(normalizeToolCallId("call_123")).toBe("call_123");
	});

	it("replaces invalid characters with underscore", () => {
		expect(normalizeToolCallId("call/123/test")).toBe("call_123_test");
		expect(normalizeToolCallId("a b")).toBe("a_b");
	});

	it("truncates to 64 chars", () => {
		const long = "a".repeat(80);
		expect(normalizeToolCallId(long).length).toBe(64);
	});

	it("passes through already normalized ids", () => {
		expect(normalizeToolCallId("abc_123-DEF")).toBe("abc_123-DEF");
	});
});

describe("normalizeResponsesToolCallId", () => {
	it("splits on pipe and normalizes each part", () => {
		// fc_ prefix is recognized and kept; other prefixes get hashed
		const result = normalizeResponsesToolCallId("call_abc|fc_item");
		expect(result.callId).toBe("call_abc");
		expect(result.itemId).toBe("fc_item");
	});

	it("derives ids from hash when no pipe separator", () => {
		const result = normalizeResponsesToolCallId("someid");
		expect(result.callId.startsWith("call_")).toBe(true);
		expect(result.itemId.startsWith("fc_")).toBe(true);
	});

	it("truncates long non-pipe ids starting with call_", () => {
		const long = `call_this_is_long_id_${"x".repeat(80)}`;
		const result = normalizeResponsesToolCallId(long);
		expect(result.callId.startsWith("call_")).toBe(true);
		expect(result.callId.length).toBeLessThanOrEqual(64);
	});
});

describe("truncateResponseItemId", () => {
	it("returns id unchanged when <= 64 chars", () => {
		const short = "short-id";
		expect(truncateResponseItemId(short, "call")).toBe(short);
	});

	it("truncates to 64 chars and prepends prefix", () => {
		const long = "a".repeat(80);
		const result = truncateResponseItemId(long, "call");
		expect(result.startsWith("call_")).toBe(true);
		expect(result.length).toBeLessThanOrEqual(64);
	});
});

describe("sanitizeOpenAIResponsesHistoryItemsForReplay", () => {
	it("filters out item_reference items", () => {
		const items = [
			{ type: "item_reference", id: "abc" },
			{ type: "message", content: "hello", call_id: "call_1" },
		];
		const result = sanitizeOpenAIResponsesHistoryItemsForReplay(items as any);
		expect(result).toHaveLength(1);
	});

	it("removes id field from items", () => {
		const items = [{ type: "message", id: "some-id", content: "hi" }];
		const result = sanitizeOpenAIResponsesHistoryItemsForReplay(items as any);
		expect(result[0]).not.toHaveProperty("id");
	});

	it("normalizes call_id to consistent names across items", () => {
		const items = [
			{ type: "message", call_id: "call_1" },
			{ type: "message", call_id: "call_1" },
		];
		const result = sanitizeOpenAIResponsesHistoryItemsForReplay(items as any);
		expect((result[0] as any).call_id).toBe((result[1] as any).call_id);
	});
});

describe("createOpenAIResponsesHistoryPayload", () => {
	it("sets correct type and provider", () => {
		const result = createOpenAIResponsesHistoryPayload("openai", []);
		expect(result.type).toBe("openaiResponsesHistory");
		expect(result.provider).toBe("openai");
	});

	it("sets dt flag when incremental=true", () => {
		const result = createOpenAIResponsesHistoryPayload("openai", [], true);
		expect(result.dt).toBe(true);
	});

	it("omits dt flag when incremental=false", () => {
		const result = createOpenAIResponsesHistoryPayload("openai", [], false);
		expect(result.dt).toBeUndefined();
	});

	it("passes items through", () => {
		const items = [{ type: "message", text: "hello" }];
		const result = createOpenAIResponsesHistoryPayload("openai", items as any, false);
		expect(result.items).toBe(items);
	});
});

describe("getOpenAIResponsesHistoryPayload", () => {
	it("returns undefined for non-openaiResponsesHistory type", () => {
		const payload = { type: "other" } as any;
		expect(getOpenAIResponsesHistoryPayload(payload, "openai")).toBeUndefined();
	});

	it("returns undefined when items is not an array", () => {
		const payload = { type: "openaiResponsesHistory", items: "not-an-array" } as any;
		expect(getOpenAIResponsesHistoryPayload(payload, "openai")).toBeUndefined();
	});

	it("returns undefined when provider mismatch", () => {
		const payload = { type: "openaiResponsesHistory", provider: "anthropic", items: [] } as any;
		expect(getOpenAIResponsesHistoryPayload(payload, "openai")).toBeUndefined();
	});

	it("returns payload when provider matches currentProvider", () => {
		const payload = { type: "openaiResponsesHistory", provider: "openai", items: [] as const };
		const result = getOpenAIResponsesHistoryPayload(payload as any, "openai");
		expect(result).toBeDefined();
		expect(result?.provider).toBe("openai");
	});

	it("uses fallbackProvider when payload has no provider", () => {
		const payload = { type: "openaiResponsesHistory", items: [] } as any;
		const result = getOpenAIResponsesHistoryPayload(payload, "openai", "openai");
		expect(result).toBeDefined();
	});
});

describe("getOpenAIResponsesHistoryItems", () => {
	it("delegates to getOpenAIResponsesHistoryPayload and returns items", () => {
		const payload = {
			type: "openaiResponsesHistory",
			provider: "openai",
			items: [{ type: "message", text: "hello" }],
		};
		const result = getOpenAIResponsesHistoryItems(payload as any, "openai");
		expect(result).toHaveLength(1);
	});

	it("returns undefined when provider mismatch", () => {
		const payload = { type: "openaiResponsesHistory", provider: "anthropic", items: [] } as any;
		expect(getOpenAIResponsesHistoryItems(payload, "openai")).toBeUndefined();
	});
});

describe("resolveCacheRetention", () => {
	it("returns passed value if truthy", () => {
		expect(resolveCacheRetention("long")).toBe("long");
		expect(resolveCacheRetention("short")).toBe("short");
	});

	it("returns short when no value and PI_CACHE_RETENTION unset", () => {
		expect(resolveCacheRetention(undefined)).toBe("short");
	});
});

describe("isAnthropicOAuthToken", () => {
	it("returns true for key containing sk-ant-oat", () => {
		expect(isAnthropicOAuthToken("sk-ant-oat03-xxxx")).toBe(true);
	});

	it("returns false for regular API key", () => {
		expect(isAnthropicOAuthToken("sk-ant-api0-xxxx")).toBe(false);
	});

	it("returns false for OpenAI key", () => {
		expect(isAnthropicOAuthToken("sk-xxxx")).toBe(false);
	});
});
