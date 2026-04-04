import { describe, expect, it } from "bun:test";
import type { Api, Model } from "@oh-my-pi/pi-ai";
import { buildNamedToolChoice } from "@oh-my-pi/pi-coding-agent/utils/tool-choice";

function makeModel(api: Api): Model<Api> {
	return { api, id: "test-model", name: "Test Model", provider: "test" } as Model<Api>;
}

describe("buildNamedToolChoice", () => {
	it("returns undefined when model is undefined", () => {
		expect(buildNamedToolChoice("myTool", undefined)).toBeUndefined();
	});

	describe("anthropic-messages", () => {
		it("returns { type: 'tool', name } for anthropic-messages", () => {
			const model = makeModel("anthropic-messages");
			expect(buildNamedToolChoice("myTool", model)).toEqual({ type: "tool", name: "myTool" });
		});
	});

	describe("bedrock-converse-stream", () => {
		it("returns { type: 'tool', name } for bedrock-converse-stream", () => {
			const model = makeModel("bedrock-converse-stream");
			expect(buildNamedToolChoice("myTool", model)).toEqual({ type: "tool", name: "myTool" });
		});
	});

	describe("openai-codex-responses", () => {
		it("returns { type: 'function', name } for openai-codex-responses", () => {
			const model = makeModel("openai-codex-responses");
			expect(buildNamedToolChoice("myTool", model)).toEqual({ type: "function", name: "myTool" });
		});
	});

	describe("openai-responses", () => {
		it("returns { type: 'function', name } for openai-responses", () => {
			const model = makeModel("openai-responses");
			expect(buildNamedToolChoice("myTool", model)).toEqual({ type: "function", name: "myTool" });
		});
	});

	describe("openai-completions", () => {
		it("returns { type: 'function', name } for openai-completions", () => {
			const model = makeModel("openai-completions");
			expect(buildNamedToolChoice("myTool", model)).toEqual({ type: "function", name: "myTool" });
		});
	});

	describe("azure-openai-responses", () => {
		it("returns { type: 'function', name } for azure-openai-responses", () => {
			const model = makeModel("azure-openai-responses");
			expect(buildNamedToolChoice("myTool", model)).toEqual({ type: "function", name: "myTool" });
		});
	});

	describe("google-generative-ai", () => {
		it("returns 'required' for google-generative-ai", () => {
			const model = makeModel("google-generative-ai");
			expect(buildNamedToolChoice("myTool", model)).toBe("required");
		});
	});

	describe("google-gemini-cli", () => {
		it("returns 'required' for google-gemini-cli", () => {
			const model = makeModel("google-gemini-cli");
			expect(buildNamedToolChoice("myTool", model)).toBe("required");
		});
	});

	describe("google-vertex", () => {
		it("returns 'required' for google-vertex", () => {
			const model = makeModel("google-vertex");
			expect(buildNamedToolChoice("myTool", model)).toBe("required");
		});
	});

	it("returns undefined for unknown API", () => {
		const model = makeModel("openai-chat" as Api);
		expect(buildNamedToolChoice("myTool", model)).toBeUndefined();
	});
});
