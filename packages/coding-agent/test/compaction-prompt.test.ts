/**
 * Unit tests for compaction prompt injection — verify generateSummary()
 * uses the correct prompt based on priority:
 *
 *   promptOverride > summarizationPrompt/updatePrompt > bundled default
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "bun:test";
import * as ai from "@oh-my-pi/pi-ai";
import { getBundledModel } from "@oh-my-pi/pi-ai/models";
import type { AssistantMessage, Usage } from "@oh-my-pi/pi-ai/types";
import { e2eApiKey } from "./utilities";

import { generateSummary, type SummaryOptions } from "../src/session/compaction/compaction";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createMockUsage(input = 100, output = 50): Usage {
	return {
		input,
		output,
		cacheRead: 0,
		cacheWrite: 0,
		totalTokens: input + output,
		cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
	};
}

function createUserMessage(text: string): AssistantMessage {
	return {
		role: "user",
		content: text,
		timestamp: Date.now(),
	} as AssistantMessage;
}

function createAssistantMessage(text: string, usage: Usage = createMockUsage()): AssistantMessage {
	return {
		role: "assistant",
		content: [{ type: "text", text }],
		usage,
		stopReason: "stop",
		timestamp: Date.now(),
		api: "anthropic-messages",
		provider: "anthropic",
		model: "claude-sonnet-4-5",
	} as AssistantMessage;
}

/**
 * Helper that calls generateSummary with named args so the signature
 * (customInstructions?, previousSummary?, options?) is always correct.
 * Signature: generateSummary(current, model, reserve, apiKey, signal?,
 *              customInstructions?, previousSummary?, options?)
 */
async function callGenerateSummary({
	currentMessages,
	model,
	reserveTokens = 16384,
	apiKey = "test-api-key",
	signal,
	customInstructions,
	previousSummary,
	options,
}: {
	currentMessages: AssistantMessage[];
	model: ReturnType<typeof getBundledModel>;
	reserveTokens?: number;
	apiKey?: string;
	signal?: AbortSignal;
	customInstructions?: string;
	previousSummary?: string;
	options?: SummaryOptions;
}) {
	return generateSummary(
		currentMessages,
		model,
		reserveTokens,
		apiKey,
		signal,
		customInstructions,
		previousSummary,
		options,
	);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("generateSummary prompt selection", () => {
	let completeSimpleSpy: ReturnType<typeof vi.spyOn>;
	let model: ReturnType<typeof getBundledModel>;

	beforeEach(() => {
		vi.restoreAllMocks();
		completeSimpleSpy = vi.spyOn(ai, "completeSimple");
		model = getBundledModel("anthropic", "claude-sonnet-4-5")!;
		if (!model) throw new Error("Model not found");
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	/**
	 * Extract the prompt text from the single completeSimple call.
	 */
	function getPromptText(): string {
		expect(completeSimpleSpy).toHaveBeenCalledTimes(1);
		const call = completeSimpleSpy.mock.calls[0]!;
		const msgs = (call[1] as { messages: Array<{ content: Array<{ text: string }> }> }).messages;
		return msgs[0]!.content[0]!.text;
	}

	it("uses bundled SUMMARIZATION_PROMPT when no previousSummary and no options", async () => {
		const messages: AssistantMessage[] = [
			createUserMessage("Hello") as unknown as AssistantMessage,
			createAssistantMessage("Hi there!"),
		];

		completeSimpleSpy.mockResolvedValueOnce(createAssistantMessage("Summary of the conversation."));

		await callGenerateSummary({
			currentMessages: messages,
			model,
			// no previousSummary, no options → uses bundled initial prompt
		});

		const promptText = getPromptText();

		// Should NOT have <previous-summary> tag → not an update
		expect(promptText).not.toContain("<previous-summary>");
		// Should contain the bundled summarization prompt content
		expect(promptText).toContain("summariz");
	});

	it("uses bundled UPDATE_SUMMARIZATION_PROMPT when previousSummary is provided", async () => {
		const messages: AssistantMessage[] = [
			createUserMessage("Hello") as unknown as AssistantMessage,
			createAssistantMessage("Hi there!"),
		];

		completeSimpleSpy.mockResolvedValueOnce(createAssistantMessage("Updated summary."));

		await callGenerateSummary({
			currentMessages: messages,
			model,
			previousSummary: "Earlier summary of the conversation.",
		});

		const promptText = getPromptText();

		// Should have the <previous-summary> tag → is an update
		expect(promptText).toContain("<previous-summary>");
		expect(promptText).toContain("Earlier summary");
	});

	it("uses options.summarizationPrompt when provided and no previousSummary", async () => {
		const messages: AssistantMessage[] = [
			createUserMessage("Hello") as unknown as AssistantMessage,
			createAssistantMessage("Hi there!"),
		];

		completeSimpleSpy.mockResolvedValueOnce(createAssistantMessage("Custom summary."));

		await callGenerateSummary({
			currentMessages: messages,
			model,
			options: {
				summarizationPrompt: "CUSTOM SUMMARIZATION PROMPT FOR TESTING",
			},
		});

		const promptText = getPromptText();

		// Custom prompt should appear in the final prompt text
		expect(promptText).toContain("CUSTOM SUMMARIZATION PROMPT FOR TESTING");
		// Not an update prompt
		expect(promptText).not.toContain("<previous-summary>");
	});

	it("uses options.updatePrompt when previousSummary is provided", async () => {
		const messages: AssistantMessage[] = [
			createUserMessage("Hello") as unknown as AssistantMessage,
			createAssistantMessage("Hi there!"),
		];

		completeSimpleSpy.mockResolvedValueOnce(createAssistantMessage("Updated summary."));

		await callGenerateSummary({
			currentMessages: messages,
			model,
			previousSummary: "Earlier summary.",
			options: {
				updatePrompt: "CUSTOM UPDATE PROMPT FOR TESTING",
			},
		});

		const promptText = getPromptText();

		expect(promptText).toContain("CUSTOM UPDATE PROMPT FOR TESTING");
		expect(promptText).toContain("<previous-summary>");
	});

	it("promptOverride takes highest priority over summarizationPrompt", async () => {
		const messages: AssistantMessage[] = [
			createUserMessage("Hello") as unknown as AssistantMessage,
			createAssistantMessage("Hi there!"),
		];

		completeSimpleSpy.mockResolvedValueOnce(createAssistantMessage("Override summary."));

		await callGenerateSummary({
			currentMessages: messages,
			model,
			options: {
				summarizationPrompt: "SHOULD NOT APPEAR",
				promptOverride: "HIGHEST PRIORITY OVERRIDE PROMPT",
			},
		});

		const promptText = getPromptText();

		expect(promptText).toContain("HIGHEST PRIORITY OVERRIDE PROMPT");
		expect(promptText).not.toContain("SHOULD NOT APPEAR");
	});

	it("promptOverride takes highest priority over updatePrompt", async () => {
		const messages: AssistantMessage[] = [
			createUserMessage("Hello") as unknown as AssistantMessage,
			createAssistantMessage("Hi there!"),
		];

		completeSimpleSpy.mockResolvedValueOnce(createAssistantMessage("Override update summary."));

		await callGenerateSummary({
			currentMessages: messages,
			model,
			previousSummary: "Earlier summary.",
			options: {
				updatePrompt: "SHOULD NOT APPEAR IN UPDATE",
				promptOverride: "HIGHEST PRIORITY OVERRIDE FOR UPDATE",
			},
		});

		const promptText = getPromptText();

		expect(promptText).toContain("HIGHEST PRIORITY OVERRIDE FOR UPDATE");
		expect(promptText).not.toContain("SHOULD NOT APPEAR IN UPDATE");
	});

	it("customInstructions is appended to basePrompt", async () => {
		const messages: AssistantMessage[] = [
			createUserMessage("Hello") as unknown as AssistantMessage,
			createAssistantMessage("Hi there!"),
		];

		completeSimpleSpy.mockResolvedValueOnce(createAssistantMessage("Summary with extra focus."));

		await callGenerateSummary({
			currentMessages: messages,
			model,
			customInstructions: "Focus extra on the file operations.",
		});

		const promptText = getPromptText();

		// customInstructions should be appended
		expect(promptText).toContain("Additional focus:");
		expect(promptText).toContain("Focus extra on the file operations.");
	});

	it("assembles full promptText with conversation + previousSummary + extraContext + basePrompt", async () => {
		const messages: AssistantMessage[] = [
			createUserMessage("Hello") as unknown as AssistantMessage,
			createAssistantMessage("Hi there!"),
		];

		completeSimpleSpy.mockResolvedValueOnce(createAssistantMessage("Summary."));

		await callGenerateSummary({
			currentMessages: messages,
			model,
			options: {
				summarizationPrompt: "CUSTOM BASE PROMPT",
				extraContext: ["File: src/main.ts was modified"],
			},
		});

		const promptText = getPromptText();

		// All components should be present
		expect(promptText).toContain("<conversation>");
		expect(promptText).toContain("Hello");
		expect(promptText).toContain("Hi there!");
		expect(promptText).toContain("</conversation>");
		expect(promptText).toContain("CUSTOM BASE PROMPT");
		expect(promptText).toContain("src/main.ts");
	});
});

describe("generateSummary priority chain", () => {
	let completeSimpleSpy: ReturnType<typeof vi.spyOn>;
	let model: ReturnType<typeof getBundledModel>;

	beforeEach(() => {
		vi.restoreAllMocks();
		completeSimpleSpy = vi.spyOn(ai, "completeSimple");
		model = getBundledModel("anthropic", "claude-sonnet-4-5")!;
		if (!model) throw new Error("Model not found");
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	function getPromptText(): string {
		expect(completeSimpleSpy).toHaveBeenCalledTimes(1);
		const call = completeSimpleSpy.mock.calls[0]!;
		const msgs = (call[1] as { messages: Array<{ content: Array<{ text: string }> }> }).messages;
		return msgs[0]!.content[0]!.text;
	}

	it("summarizationPrompt is used before bundled default (no previousSummary)", async () => {
		const messages: AssistantMessage[] = [
			createUserMessage("Hello") as unknown as AssistantMessage,
			createAssistantMessage("Hi there!"),
		];

		completeSimpleSpy.mockResolvedValueOnce(createAssistantMessage("Summary."));

		await callGenerateSummary({
			currentMessages: messages,
			model,
			options: { summarizationPrompt: "CUSTOM INITIAL PROMPT VALUE" },
		});

		expect(getPromptText()).toContain("CUSTOM INITIAL PROMPT VALUE");
	});

	it("updatePrompt is used before bundled default (has previousSummary)", async () => {
		const messages: AssistantMessage[] = [
			createUserMessage("Hello") as unknown as AssistantMessage,
			createAssistantMessage("Hi there!"),
		];

		completeSimpleSpy.mockResolvedValueOnce(createAssistantMessage("Summary."));

		await callGenerateSummary({
			currentMessages: messages,
			model,
			previousSummary: "Old summary",
			options: { updatePrompt: "CUSTOM UPDATE PROMPT VALUE" },
		});

		expect(getPromptText()).toContain("CUSTOM UPDATE PROMPT VALUE");
	});

	it("summarizationPrompt is ignored when previousSummary is provided (uses updatePrompt instead)", async () => {
		const messages: AssistantMessage[] = [
			createUserMessage("Hello") as unknown as AssistantMessage,
			createAssistantMessage("Hi there!"),
		];

		completeSimpleSpy.mockResolvedValueOnce(createAssistantMessage("Summary."));

		await callGenerateSummary({
			currentMessages: messages,
			model,
			previousSummary: "Old summary",
			options: {
				summarizationPrompt: "WRONG PROMPT TYPE",
				updatePrompt: "CORRECT UPDATE PROMPT",
			},
		});

		const promptText = getPromptText();
		expect(promptText).toContain("CORRECT UPDATE PROMPT");
		expect(promptText).not.toContain("WRONG PROMPT TYPE");
	});

	it("updatePrompt is ignored when no previousSummary (uses summarizationPrompt instead)", async () => {
		const messages: AssistantMessage[] = [
			createUserMessage("Hello") as unknown as AssistantMessage,
			createAssistantMessage("Hi there!"),
		];

		completeSimpleSpy.mockResolvedValueOnce(createAssistantMessage("Summary."));

		await callGenerateSummary({
			currentMessages: messages,
			model,
			options: {
				updatePrompt: "WRONG - THIS IS AN UPDATE PROMPT",
				summarizationPrompt: "CORRECT INITIAL PROMPT",
			},
		});

		const promptText = getPromptText();
		expect(promptText).toContain("CORRECT INITIAL PROMPT");
		expect(promptText).not.toContain("WRONG - THIS IS AN UPDATE PROMPT");
	});

	it("promptOverride > summarizationPrompt > bundled (no previousSummary)", async () => {
		const messages: AssistantMessage[] = [
			createUserMessage("Hello") as unknown as AssistantMessage,
			createAssistantMessage("Hi there!"),
		];

		completeSimpleSpy.mockResolvedValueOnce(createAssistantMessage("Summary."));

		await callGenerateSummary({
			currentMessages: messages,
			model,
			options: {
				summarizationPrompt: "FALLBACK",
				promptOverride: "TOP_PRIORITY",
			},
		});

		const promptText = getPromptText();
		expect(getPromptText()).toContain("TOP_PRIORITY");
		expect(promptText).not.toContain("FALLBACK");
	});

	it("promptOverride > updatePrompt > bundled (has previousSummary)", async () => {
		const messages: AssistantMessage[] = [
			createUserMessage("Hello") as unknown as AssistantMessage,
			createAssistantMessage("Hi there!"),
		];

		completeSimpleSpy.mockResolvedValueOnce(createAssistantMessage("Summary."));

		await callGenerateSummary({
			currentMessages: messages,
			model,
			previousSummary: "Old",
			options: {
				updatePrompt: "FALLBACK",
				promptOverride: "TOP_PRIORITY",
			},
		});

		const promptText = getPromptText();
		expect(promptText).toContain("TOP_PRIORITY");
		expect(promptText).not.toContain("FALLBACK");
	});
});
