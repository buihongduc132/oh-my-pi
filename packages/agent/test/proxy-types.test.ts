import { describe, expect, it } from "bun:test";
import type { ProxyAssistantMessageEvent, ProxyStreamOptions } from "@oh-my-pi/pi-agent-core/proxy";

describe("ProxyAssistantMessageEvent", () => {
	describe("discriminated union variants", () => {
		it('has "start" variant', () => {
			const event: ProxyAssistantMessageEvent = { type: "start" };
			expect(event.type).toBe("start");
		});

		it('has "text_start" variant', () => {
			const event: ProxyAssistantMessageEvent = {
				type: "text_start",
				contentIndex: 0,
			};
			expect(event.type).toBe("text_start");
			expect(event.contentIndex).toBe(0);
		});

		it('has "text_delta" variant', () => {
			const event: ProxyAssistantMessageEvent = {
				type: "text_delta",
				contentIndex: 0,
				delta: "hello",
			};
			expect(event.type).toBe("text_delta");
			expect(event.delta).toBe("hello");
		});

		it('has "text_end" variant with optional contentSignature', () => {
			const event: ProxyAssistantMessageEvent = {
				type: "text_end",
				contentIndex: 0,
			};
			expect(event.type).toBe("text_end");

			const withSig: ProxyAssistantMessageEvent = {
				type: "text_end",
				contentIndex: 0,
				contentSignature: "sig123",
			};
			expect(withSig.contentSignature).toBe("sig123");
		});

		it('has "thinking_start" variant', () => {
			const event: ProxyAssistantMessageEvent = {
				type: "thinking_start",
				contentIndex: 0,
			};
			expect(event.type).toBe("thinking_start");
		});

		it('has "thinking_delta" variant', () => {
			const event: ProxyAssistantMessageEvent = {
				type: "thinking_delta",
				contentIndex: 0,
				delta: "thinking...",
			};
			expect(event.type).toBe("thinking_delta");
		});

		it('has "thinking_end" variant with optional contentSignature', () => {
			const event: ProxyAssistantMessageEvent = {
				type: "thinking_end",
				contentIndex: 0,
			};
			expect(event.type).toBe("thinking_end");

			const withSig: ProxyAssistantMessageEvent = {
				type: "thinking_end",
				contentIndex: 0,
				contentSignature: "sig456",
			};
			expect(withSig.contentSignature).toBe("sig456");
		});

		it('has "toolcall_start" variant', () => {
			const event: ProxyAssistantMessageEvent = {
				type: "toolcall_start",
				contentIndex: 0,
				id: "call_123",
				toolName: "readFile",
			};
			expect(event.type).toBe("toolcall_start");
			expect(event.id).toBe("call_123");
			expect(event.toolName).toBe("readFile");
		});

		it('has "toolcall_delta" variant', () => {
			const event: ProxyAssistantMessageEvent = {
				type: "toolcall_delta",
				contentIndex: 0,
				delta: '{"path":"/tmp/test"}',
			};
			expect(event.type).toBe("toolcall_delta");
		});

		it('has "toolcall_end" variant', () => {
			const event: ProxyAssistantMessageEvent = {
				type: "toolcall_end",
				contentIndex: 0,
			};
			expect(event.type).toBe("toolcall_end");
		});

		it('has "done" variant with stop/length/toolUse reasons', () => {
			const stopEvent: ProxyAssistantMessageEvent = {
				type: "done",
				reason: "stop",
				usage: {
					input: 100,
					output: 50,
					cacheRead: 0,
					cacheWrite: 0,
					totalTokens: 150,
					cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
				},
			};
			expect(stopEvent.type).toBe("done");
			expect(stopEvent.reason).toBe("stop");
			expect(stopEvent.usage.totalTokens).toBe(150);

			const lengthEvent: ProxyAssistantMessageEvent = {
				type: "done",
				reason: "length",
				usage: {
					input: 0,
					output: 0,
					cacheRead: 0,
					cacheWrite: 0,
					totalTokens: 0,
					cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
				},
			};
			expect(lengthEvent.reason).toBe("length");

			const toolUseEvent: ProxyAssistantMessageEvent = {
				type: "done",
				reason: "toolUse",
				usage: {
					input: 0,
					output: 0,
					cacheRead: 0,
					cacheWrite: 0,
					totalTokens: 0,
					cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
				},
			};
			expect(toolUseEvent.reason).toBe("toolUse");
		});

		it('has "error" variant with aborted/error reasons', () => {
			const abortEvent: ProxyAssistantMessageEvent = {
				type: "error",
				reason: "aborted",
				usage: {
					input: 0,
					output: 0,
					cacheRead: 0,
					cacheWrite: 0,
					totalTokens: 0,
					cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
				},
			};
			expect(abortEvent.type).toBe("error");
			expect(abortEvent.reason).toBe("aborted");

			const errorEvent: ProxyAssistantMessageEvent = {
				type: "error",
				reason: "error",
				errorMessage: "Provider error",
				usage: {
					input: 0,
					output: 0,
					cacheRead: 0,
					cacheWrite: 0,
					totalTokens: 0,
					cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
				},
			};
			expect(errorEvent.reason).toBe("error");
			expect(errorEvent.errorMessage).toBe("Provider error");
		});
	});

	it("has 12 distinct type discriminants", () => {
		const variants = [
			"start",
			"text_start",
			"text_delta",
			"text_end",
			"thinking_start",
			"thinking_delta",
			"thinking_end",
			"toolcall_start",
			"toolcall_delta",
			"toolcall_end",
			"done",
			"error",
		] as const;
		expect(variants).toHaveLength(12);
		for (const v of variants) {
			const event: ProxyAssistantMessageEvent = { type: v } as any;
			expect(event.type).toBe(v);
		}
	});
});

describe("ProxyStreamOptions", () => {
	it("requires authToken and proxyUrl", () => {
		const opts: ProxyStreamOptions = {
			authToken: "tok_abc",
			proxyUrl: "https://genai.example.com",
		};
		expect(opts.authToken).toBe("tok_abc");
		expect(opts.proxyUrl).toBe("https://genai.example.com");
	});

	it("accepts optional SimpleStreamOptions fields", () => {
		const opts: ProxyStreamOptions = {
			authToken: "tok_abc",
			proxyUrl: "https://genai.example.com",
			temperature: 0.7,
			maxTokens: 2048,
		};
		expect(opts.temperature).toBe(0.7);
		expect(opts.maxTokens).toBe(2048);
	});

	it("accepts AbortSignal", () => {
		const controller = new AbortController();
		const opts: ProxyStreamOptions = {
			authToken: "tok_abc",
			proxyUrl: "https://genai.example.com",
			signal: controller.signal,
		};
		expect(opts.signal).toBe(controller.signal);
	});
});
