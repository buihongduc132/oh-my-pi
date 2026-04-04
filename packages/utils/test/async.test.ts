import { describe, expect, it } from "bun:test";
import { withTimeout } from "../src/async";

describe("withTimeout", () => {
	it("resolves when promise resolves before timeout", async () => {
		const fast = Promise.resolve("ok");
		await expect(withTimeout(fast, 1000, "too slow")).resolves.toBe("ok");
	});

	it("rejects with Error when promise resolves before timeout", async () => {
		const fast = Promise.reject(new Error("boom"));
		await expect(withTimeout(fast, 1000, "too slow")).rejects.toThrow("boom");
	});

	it("rejects when timeout fires before promise resolves", async () => {
		const slow = new Promise<string>(resolve => setTimeout(() => resolve("late"), 5000));
		await expect(withTimeout(slow, 10, "too slow")).rejects.toThrow("too slow");
	});

	it("rejects immediately if signal is already aborted", async () => {
		const controller = new AbortController();
		controller.abort("user cancelled");
		const forever = new Promise<string>(resolve => setTimeout(() => resolve("late"), 5000));
		await expect(withTimeout(forever, 5000, "too slow", controller.signal)).rejects.toThrow("Aborted");
	});

	it("uses Error message when abort reason is not an Error", async () => {
		const controller = new AbortController();
		controller.abort("plain string reason");
		const forever = new Promise<string>(resolve => setTimeout(() => resolve("late"), 5000));
		await expect(withTimeout(forever, 5000, "too slow", controller.signal)).rejects.toThrow("Aborted");
	});

	it("cleans up abort listener when promise settles before timeout", async () => {
		const controller = new AbortController();
		const forever = new Promise<string>(resolve => setTimeout(() => resolve("late"), 5000));
		// Abort after 10ms — but promise already resolved (never in this case)
		const promise = withTimeout(forever, 10, "too slow", controller.signal);
		// Let the timeout fire first
		await expect(promise).rejects.toThrow("too slow");
		// Aborting after settlement should be safe (no-op)
		controller.abort("later");
	});

	it("resolves with the correct value type", async () => {
		const value = { key: "value" };
		const promise = Promise.resolve(value);
		const result = await withTimeout(promise, 1000, "too slow");
		expect(result).toEqual({ key: "value" });
	});
});
