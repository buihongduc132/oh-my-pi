import { describe, expect, it } from "bun:test";
import type { Usage } from "@oh-my-pi/pi-ai";
import {
	calculateCost,
	getBundledModel,
	getBundledModels,
	getBundledProviders,
	modelsAreEqual,
} from "@oh-my-pi/pi-ai/models";

describe("getBundledProviders", () => {
	it("returns a non-empty array of provider names", () => {
		const providers = getBundledProviders();
		expect(Array.isArray(providers)).toBe(true);
		expect(providers.length).toBeGreaterThan(0);
	});

	it("contains only string values", () => {
		const providers = getBundledProviders();
		for (const p of providers) {
			expect(typeof p).toBe("string");
		}
	});
});

describe("getBundledModel", () => {
	it("returns a model for a known provider and model id", () => {
		const model = getBundledModel("openai", "gpt-4o");
		expect(model).toBeDefined();
		expect(model.id).toBe("gpt-4o");
		expect(model.provider).toBe("openai");
	});

	it("returns a model with cost data", () => {
		const model = getBundledModel("openai", "gpt-4o");
		expect(model.cost).toBeDefined();
		expect(typeof model.cost.input).toBe("number");
		expect(typeof model.cost.output).toBe("number");
	});

	it("returns undefined for unknown model", () => {
		const model = getBundledModel("openai", "nonexistent-model-xyz");
		expect(model).toBeUndefined();
	});

	it("returns undefined for unknown provider", () => {
		const model = getBundledModel("unknown-provider" as any, "gpt-4o");
		expect(model).toBeUndefined();
	});
});

describe("getBundledModels", () => {
	it("returns an array for a known provider", () => {
		const models = getBundledModels("openai");
		expect(Array.isArray(models)).toBe(true);
		expect(models.length).toBeGreaterThan(0);
	});

	it("each model has required fields", () => {
		const models = getBundledModels("openai");
		for (const model of models) {
			expect(typeof model.id).toBe("string");
			expect(typeof model.provider).toBe("string");
		}
	});

	it("returns empty array for unknown provider", () => {
		const models = getBundledModels("unknown-provider" as any);
		expect(models).toEqual([]);
	});
});

describe("calculateCost", () => {
	function makeUsage(): Usage {
		return {
			input: 1000,
			output: 500,
			cacheRead: 200,
			cacheWrite: 100,
			totalTokens: 1600,
			cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
		};
	}

	it("calculates input cost correctly", () => {
		const model = getBundledModel("openai", "gpt-4o");
		if (!model) return;
		const usage = makeUsage();
		calculateCost(model, usage);
		expect(usage.cost.input).toBeGreaterThan(0);
	});

	it("calculates output cost correctly", () => {
		const model = getBundledModel("openai", "gpt-4o");
		if (!model) return;
		const usage = makeUsage();
		calculateCost(model, usage);
		expect(usage.cost.output).toBeGreaterThan(0);
	});

	it("calculates total as sum of all costs", () => {
		const model = getBundledModel("openai", "gpt-4o");
		if (!model) return;
		const usage = makeUsage();
		calculateCost(model, usage);
		expect(usage.cost.total).toBe(
			usage.cost.input + usage.cost.output + usage.cost.cacheRead + usage.cost.cacheWrite,
		);
	});

	it("returns the cost object (mutates in place)", () => {
		const model = getBundledModel("openai", "gpt-4o");
		if (!model) return;
		const usage = makeUsage();
		const result = calculateCost(model, usage);
		expect(result).toBe(usage.cost);
	});

	it("handles zero usage", () => {
		const model = getBundledModel("openai", "gpt-4o");
		if (!model) return;
		const usage: Usage = {
			input: 0,
			output: 0,
			cacheRead: 0,
			cacheWrite: 0,
			totalTokens: 0,
			cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
		};
		calculateCost(model, usage);
		expect(usage.cost.total).toBe(0);
	});
});

describe("modelsAreEqual", () => {
	it("returns true for two identical models", () => {
		const a = getBundledModel("openai", "gpt-4o");
		const b = getBundledModel("openai", "gpt-4o");
		if (!a || !b) return;
		expect(modelsAreEqual(a, b)).toBe(true);
	});

	it("returns false for models with different providers", () => {
		const a = getBundledModel("openai", "gpt-4o");
		const b = getBundledModel("anthropic", "claude-3-5-sonnet-20241022" as any);
		if (!a || !b) return;
		expect(modelsAreEqual(a, b)).toBe(false);
	});

	it("returns false for models with different ids", () => {
		const a = getBundledModel("openai", "gpt-4o");
		const b = getBundledModel("openai", "gpt-4o-mini");
		if (!a || !b) return;
		expect(modelsAreEqual(a, b)).toBe(false);
	});

	it("returns false when first argument is null", () => {
		const b = getBundledModel("openai", "gpt-4o");
		if (!b) return;
		expect(modelsAreEqual(null, b)).toBe(false);
	});

	it("returns false when second argument is null", () => {
		const a = getBundledModel("openai", "gpt-4o");
		if (!a) return;
		expect(modelsAreEqual(a, null)).toBe(false);
	});

	it("returns false when first argument is undefined", () => {
		const b = getBundledModel("openai", "gpt-4o");
		if (!b) return;
		expect(modelsAreEqual(undefined, b)).toBe(false);
	});

	it("returns false when second argument is undefined", () => {
		const a = getBundledModel("openai", "gpt-4o");
		if (!a) return;
		expect(modelsAreEqual(a, undefined)).toBe(false);
	});

	it("returns false when both are null", () => {
		expect(modelsAreEqual(null, null)).toBe(false);
	});
});
