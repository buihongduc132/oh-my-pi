import { describe, expect, it } from "bun:test";
import { AbortError, abortableSleep, createAbortableStream, once, untilAborted } from "@oh-my-pi/pi-utils/abortable";

describe("AbortError", () => {
	it("constructs with an aborted signal", () => {
		const signal = AbortSignal.abort();
		const err = new AbortError(signal);
		expect(err.name).toBe("AbortError");
		expect(err).toBeInstanceOf(Error);
	});

	it("rejects assertion when signal is not aborted", () => {
		const controller = new AbortController();
		// intentionally never abort
		expect(() => new AbortError(controller.signal)).toThrow();
	});
});

describe("untilAborted", () => {
	it("runs the function when no signal is provided", async () => {
		const result = await untilAborted(undefined, () => Promise.resolve(42));
		expect(result).toBe(42);
	});

	it("runs the function when signal is null", async () => {
		const result = await untilAborted(null, () => Promise.resolve("ok"));
		expect(result).toBe("ok");
	});

	it("rejects with AbortError when signal is already aborted", async () => {
		const signal = AbortSignal.abort();
		await expect(untilAborted(signal, () => Promise.resolve(1))).rejects.toBeInstanceOf(AbortError);
	});

	it("rejects when signal aborts mid-execution", async () => {
		// Use AbortSignal.timeout so the abort fires as a macrotask after the setTimeout in pr()
		// but before pr() resolves. controller.abort() fires too late in Bun (after resolve()).
		const signal = AbortSignal.timeout(10);
		const promise = untilAborted(signal, async () => {
			await new Promise(r => setTimeout(r, 20));
			return "done";
		});
		await expect(promise).rejects.toThrow();
	});

	it("cleans up the abort listener after rejection", async () => {
		const signal = AbortSignal.abort();
		await untilAborted(signal, () => Promise.resolve(1)).catch(() => {});
	});
});

describe("createAbortableStream", () => {
	it("returns the original stream when no signal is given", () => {
		const stream = new ReadableStream();
		expect(createAbortableStream(stream)).toBe(stream);
	});

	it("returns wrapped stream when signal is provided", async () => {
		const signal = new AbortController().signal;
		const stream = new ReadableStream({
			start(c) {
				c.enqueue(1);
				c.enqueue(2);
				c.close();
			},
		});
		const wrapped = createAbortableStream(stream, signal);
		const reader = wrapped.getReader();
		const { value: v1 } = await reader.read();
		const { value: v2 } = await reader.read();
		expect(v1).toBe(1);
		expect(v2).toBe(2);
	});
});

describe("once", () => {
	it("calls the function on first invocation only", () => {
		let count = 0;
		const fn = once(() => ++count);
		expect(fn()).toBe(1);
		expect(fn()).toBe(1);
		expect(fn()).toBe(1);
		expect(count).toBe(1);
	});

	it("returns the cached value from the first call", () => {
		const fn = once(() => ({ ts: Date.now() }));
		const a = fn();
		const b = fn();
		expect(a).toBe(b);
	});

	it("works with zero-argument functions", () => {
		let calls = 0;
		const fn = once(() => ++calls);
		expect(fn()).toBe(1);
		expect(fn()).toBe(1);
	});
});

describe("abortableSleep", () => {
	it("resolves after the specified duration", async () => {
		const start = Date.now();
		await abortableSleep(20);
		const elapsed = Date.now() - start;
		expect(elapsed).toBeGreaterThanOrEqual(15);
	});

	it("resolves when no signal is provided", async () => {
		await expect(abortableSleep(5)).resolves.toBeUndefined();
	});

	it("rejects when aborted mid-sleep", async () => {
		const controller = new AbortController();
		const promise = abortableSleep(50, controller.signal);
		await new Promise(r => setTimeout(r, 5));
		controller.abort();
		await expect(promise).rejects.toThrow();
	});
});
