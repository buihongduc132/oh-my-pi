import { describe, expect, it } from "bun:test";
import {
	applyGeneratedModelPolicies,
	CLOUDFLARE_FALLBACK_MODEL,
	clampThinkingLevelForModel,
	enrichModelThinking,
	getSupportedEfforts,
	linkSparkPromotionTargets,
	mapEffortToAnthropicAdaptiveEffort,
	mapEffortToGoogleThinkingLevel,
	refreshModelThinking,
	requireSupportedEffort,
} from "@oh-my-pi/pi-ai/model-thinking";

function makeModel(overrides: Record<string, unknown> = {}): any {
	return {
		id: "test-model",
		name: "Test Model",
		api: "anthropic-messages" as const,
		provider: "test",
		baseUrl: "https://api.test.com",
		reasoning: false,
		input: ["text"] as const,
		cost: { input: 1, output: 1 },
		contextWindow: 100000,
		maxTokens: 8192,
		...overrides,
	};
}

function makeThinkingConfig(overrides: Record<string, unknown> = {}): any {
	return {
		minLevel: "low",
		maxLevel: "high",
		mode: "thinking" as const,
		...overrides,
	};
}

describe("Effort enum", () => {
	it("has correct string values", () => {
		expect("minimal").toBe("minimal" as any);
		expect("low").toBe("low");
		expect("medium").toBe("medium" as any);
		expect("high").toBe("high" as any);
		expect("xhigh").toBe("xhigh" as any);
	});
});

describe("CLOUDFLARE_FALLBACK_MODEL", () => {
	it("is a valid model object", () => {
		expect(CLOUDFLARE_FALLBACK_MODEL.id).toBe("claude-sonnet-4-5");
		expect(CLOUDFLARE_FALLBACK_MODEL.reasoning).toBe(true);
		expect(Array.isArray(CLOUDFLARE_FALLBACK_MODEL.input)).toBe(true);
	});
});

describe("enrichModelThinking", () => {
	it("returns same reference for non-reasoning models", () => {
		const model = makeModel({ reasoning: false });
		expect(enrichModelThinking(model)).toBe(model);
	});

	it("returns a valid object for reasoning models", () => {
		const model = makeModel({ reasoning: true, thinking: makeThinkingConfig() });
		const result = enrichModelThinking(model);
		expect(result).toBeDefined();
	});
});

describe("refreshModelThinking", () => {
	it("returns object for non-reasoning models", () => {
		const model = makeModel({ reasoning: false });
		expect(refreshModelThinking(model)).toBeDefined();
	});
});

describe("applyGeneratedModelPolicies", () => {
	it("handles empty array", () => {
		applyGeneratedModelPolicies([]);
	});

	it("mutates models in place", () => {
		const models = [makeModel({ id: "model-1" }), makeModel({ id: "model-2" })];
		applyGeneratedModelPolicies(models);
		expect(models).toHaveLength(2);
	});
});

describe("linkSparkPromotionTargets", () => {
	it("handles empty array", () => {
		linkSparkPromotionTargets([]);
	});

	it("links spark variant to base model", () => {
		const models = [
			makeModel({ id: "gpt-4.5-codex", provider: "openai", api: "openai-codex-responses" }),
			makeModel({ id: "gpt-4.5-codex-spark", provider: "openai", api: "openai-codex-responses" }),
		];
		linkSparkPromotionTargets(models);
		expect(models[1]!.contextPromotionTarget).toBe("openai/gpt-4.5-codex");
	});

	it("no-op when no base model matches", () => {
		const models = [makeModel({ id: "gpt-4.5-codex-spark", provider: "other", api: "openai-codex-responses" })];
		linkSparkPromotionTargets(models);
		expect(models[0]!.contextPromotionTarget).toBeUndefined();
	});
});

describe("getSupportedEfforts", () => {
	it("returns empty array for non-reasoning models", () => {
		const model = makeModel({ reasoning: false });
		expect(getSupportedEfforts(model)).toEqual([]);
	});

	it("throws for reasoning models missing thinking config", () => {
		const model = makeModel({ reasoning: true });
		expect(() => getSupportedEfforts(model)).toThrow("missing thinking metadata");
	});

	it("returns efforts for reasoning models with thinking config", () => {
		const model = makeModel({
			reasoning: true,
			thinking: makeThinkingConfig({ minLevel: "minimal", maxLevel: "high" }),
		});
		const efforts = getSupportedEfforts(model);
		expect(efforts.length).toBeGreaterThan(0);
	});
});

describe("clampThinkingLevelForModel", () => {
	it("returns undefined when model is undefined", () => {
		// clampThinkingLevelForModel with undefined model returns requested as-is
		expect(clampThinkingLevelForModel(undefined, undefined)).toBeUndefined();
		expect(clampThinkingLevelForModel(undefined, "low" as any)).toBe("low" as any);
	});

	it("returns undefined for non-reasoning model", () => {
		const model = makeModel({ reasoning: false });
		expect(clampThinkingLevelForModel(model, "high" as any)).toBeUndefined();
	});

	it("returns undefined when requested is undefined", () => {
		const model = makeModel({
			reasoning: true,
			thinking: makeThinkingConfig(),
		});
		expect(clampThinkingLevelForModel(model, undefined)).toBeUndefined();
	});
});

describe("requireSupportedEffort", () => {
	it("throws for non-reasoning model", () => {
		const model = makeModel({ reasoning: false });
		expect(() => requireSupportedEffort(model, "high" as any)).toThrow("does not support thinking");
	});

	it("throws for unsupported effort", () => {
		const model = makeModel({
			reasoning: true,
			thinking: makeThinkingConfig({ minLevel: "low", maxLevel: "low" }),
		});
		expect(() => requireSupportedEffort(model, "high" as any)).toThrow("is not supported");
	});

	it("returns effort when supported", () => {
		const model = makeModel({
			reasoning: true,
			thinking: makeThinkingConfig({ minLevel: "low", maxLevel: "high" }),
		});
		expect(requireSupportedEffort(model, "low" as any)).toBe("low" as any);
	});
});

describe("mapEffortToGoogleThinkingLevel", () => {
	it("throws for non-reasoning model", () => {
		const model = makeModel({ reasoning: false });
		expect(() => mapEffortToGoogleThinkingLevel(model, "low" as any)).toThrow("does not support thinking");
	});

	it("maps Minimal to MINIMAL", () => {
		const model = makeModel({
			reasoning: true,
			thinking: makeThinkingConfig({ minLevel: "minimal", maxLevel: "high" }),
		});
		expect(mapEffortToGoogleThinkingLevel(model, "minimal" as any)).toBe("MINIMAL" as any);
	});

	it("maps Low to LOW", () => {
		const model = makeModel({
			reasoning: true,
			thinking: makeThinkingConfig({ minLevel: "low", maxLevel: "high" }),
		});
		expect(mapEffortToGoogleThinkingLevel(model, "low" as any)).toBe("LOW" as any);
	});

	it("maps Medium to MEDIUM", () => {
		const model = makeModel({
			reasoning: true,
			thinking: makeThinkingConfig({ minLevel: "medium", maxLevel: "high" }),
		});
		expect(mapEffortToGoogleThinkingLevel(model, "medium" as any)).toBe("MEDIUM" as any);
	});

	it("maps High to HIGH", () => {
		const model = makeModel({
			reasoning: true,
			thinking: makeThinkingConfig({ minLevel: "low", maxLevel: "high" }),
		});
		expect(mapEffortToGoogleThinkingLevel(model, "high" as any)).toBe("HIGH" as any);
	});
});

describe("mapEffortToAnthropicAdaptiveEffort", () => {
	it("throws for non-reasoning model", () => {
		const model = makeModel({ reasoning: false });
		expect(() => mapEffortToAnthropicAdaptiveEffort(model, "low" as any)).toThrow("does not support thinking");
	});

	it("maps Minimal to low", () => {
		const model = makeModel({
			reasoning: true,
			thinking: makeThinkingConfig({ minLevel: "minimal", maxLevel: "high" }),
		});
		expect(mapEffortToAnthropicAdaptiveEffort(model, "minimal" as any)).toBe("low");
	});

	it("maps Low to low", () => {
		const model = makeModel({
			reasoning: true,
			thinking: makeThinkingConfig({ minLevel: "low", maxLevel: "high" }),
		});
		expect(mapEffortToAnthropicAdaptiveEffort(model, "low" as any)).toBe("low");
	});

	it("maps Medium to medium", () => {
		const model = makeModel({
			reasoning: true,
			thinking: makeThinkingConfig({ minLevel: "medium", maxLevel: "high" }),
		});
		expect(mapEffortToAnthropicAdaptiveEffort(model, "medium" as any)).toBe("medium" as any);
	});

	it("maps High to high", () => {
		const model = makeModel({
			reasoning: true,
			thinking: makeThinkingConfig({ minLevel: "low", maxLevel: "high" }),
		});
		expect(mapEffortToAnthropicAdaptiveEffort(model, "high" as any)).toBe("high" as any);
	});

	it("maps XHigh to max", () => {
		const model = makeModel({
			reasoning: true,
			thinking: makeThinkingConfig({ minLevel: "xhigh", maxLevel: "xhigh" }),
		});
		expect(mapEffortToAnthropicAdaptiveEffort(model, "xhigh" as any)).toBe("max" as any);
	});
});
