import { describe, expect, it } from "bun:test";
import { hookFetch } from "@oh-my-pi/pi-utils/hook-fetch";

describe("hookFetch", () => {
	it("intercepts globalThis.fetch with custom handler", async () => {
		let called = false;
		const handler = (_input: string | URL | Request, _init: RequestInit | undefined) => {
			called = true;
			return new Response("intercepted");
		};

		using _hook = hookFetch(handler as any);

		const res = await fetch("http://example.com/test");
		const text = await res.text();

		expect(text).toBe("intercepted");
		expect(called).toBe(true);
	});

	it("passes URL to the handler", async () => {
		const handler = (input: string | URL | Request) => {
			// Verify the URL is passed through
			expect(String(input)).toContain("example.com");
			return new Response("ok");
		};

		using _hook = hookFetch(handler as any);
		await fetch("http://example.com/foo");
	});

	it("can delegate to the original fetch via next()", async () => {
		let delegated = false;
		const handler = (_input: string | URL | Request, _init: RequestInit | undefined, next: any) => {
			delegated = true;
			return next(_input, _init);
		};

		using _hook = hookFetch(handler as any);
		const res = await fetch("http://example.com", { method: "GET" });
		expect(delegated).toBe(true);
		// Response may or may not be ok depending on network, but no crash
		expect(res).toBeInstanceOf(Response);
	});

	it("disposes and restores original fetch", async () => {
		const original = globalThis.fetch;
		{
			using _hook = hookFetch(() => new Response("mocked"));
			expect(globalThis.fetch).not.toBe(original);
		}
		// After dispose, original is restored
		expect(globalThis.fetch).toBe(original);
	});

	it("works with Symbol.dispose (using statement)", () => {
		const original = globalThis.fetch;
		{
			using _hook = hookFetch(() => new Response("x"));
		}
		expect(globalThis.fetch).toBe(original);
	});

	it("handler receives correct HTTP method", async () => {
		const methods: string[] = [];
		const handler = (_input: any, init: RequestInit | undefined) => {
			methods.push(init?.method ?? "GET");
			return new Response("ok");
		};

		using _hook = hookFetch(handler as any);
		await fetch("http://example.com", { method: "POST" });
		await fetch("http://example.com", { method: "DELETE" });

		expect(methods).toContain("POST");
		expect(methods).toContain("DELETE");
	});
});
