import { beforeEach, describe, expect, test, vi } from "bun:test";
import { EventBus } from "../../src/utils/event-bus";

const mockLogger = {
	info: vi.fn(),
	warn: vi.fn(),
	error: vi.fn(),
	debug: vi.fn(),
	verbose: vi.fn(),
};
vi.mock("@oh-my-pi/pi-utils", () => ({
	logger: mockLogger,
}));

beforeEach(() => {
	mockLogger.error.mockClear();
});

describe("EventBus", () => {
	test("can be constructed without calling any other method", () => {
		// Exercises the TypeScript-inserted default class constructor
		const bus = new EventBus();
		bus.clear();
		// Simply constructing and calling a method proves the constructor is reachable
	});

	test("emit calls registered handlers with data", () => {
		const bus = new EventBus();
		const received: unknown[] = [];

		bus.on("test", data => received.push(data));
		bus.emit("test", "hello");
		bus.emit("test", 42);

		expect(received).toEqual(["hello", 42]);
	});

	test("multiple handlers on same channel all receive emit", () => {
		const bus = new EventBus();
		const a: unknown[] = [];
		const b: unknown[] = [];

		bus.on("channel", data => a.push(data));
		bus.on("channel", data => b.push(data));
		bus.emit("channel", "msg");

		expect(a).toEqual(["msg"]);
		expect(b).toEqual(["msg"]);
	});

	test("handlers on different channels are isolated", () => {
		const bus = new EventBus();
		const aReceived: unknown[] = [];
		const bReceived: unknown[] = [];

		bus.on("a", data => aReceived.push(data));
		bus.on("b", data => bReceived.push(data));
		bus.emit("a", "only-a");

		// Only 'a' channel handler fires; 'b' handler never fires
		expect(aReceived).toEqual(["only-a"]);
		expect(bReceived).toEqual([]);
	});

	test("off (return value of on) removes the handler", () => {
		const bus = new EventBus();
		const called: unknown[] = [];

		const off = bus.on("test", data => called.push(data));
		bus.emit("test", "first");

		off();
		bus.emit("test", "second");

		expect(called).toEqual(["first"]);
	});

	test("off is safe when channel has no listeners", () => {
		const bus = new EventBus();
		const off = bus.on("test", () => {});
		off(); // remove before any emit
		bus.emit("test", "still works"); // should not throw
		expect(true).toBe(true);
	});

	test("emit does nothing when no handlers registered", () => {
		const bus = new EventBus();
		bus.emit("never-registered", "data"); // should not throw
		expect(true).toBe(true);
	});

	test("handler that throws logs error and does not break emit chain", () => {
		const bus = new EventBus();
		const called: string[] = [];

		bus.on("err", () => {
			throw new Error("handler error");
		});
		bus.on("err", () => called.push("after"));

		bus.emit("err", null);

		expect(called).toEqual(["after"]);
		expect(mockLogger.error).toHaveBeenCalledTimes(1);
		expect(mockLogger.error.mock.calls[0]![0]).toBe("Event handler error");
	});

	test("clear removes all handlers", () => {
		const bus = new EventBus();
		const called: unknown[] = [];

		bus.on("a", () => called.push("a"));
		bus.on("b", () => called.push("b"));
		bus.clear();

		bus.emit("a", 1);
		bus.emit("b", 2);

		expect(called).toEqual([]);
	});

	test("clear is safe when bus is already empty", () => {
		const bus = new EventBus();
		bus.clear(); // should not throw
		expect(true).toBe(true);
	});

	test("off after clear is safe", () => {
		const bus = new EventBus();
		bus.on("test", () => {});
		bus.clear();
		const off = bus.on("test", () => {});
		off(); // should not throw
		expect(true).toBe(true);
	});

	test("handler is called asynchronously", async () => {
		const bus = new EventBus();
		let resolved = false;

		bus.on("async-test", async () => {
			await new Promise(r => setTimeout(r, 1));
			resolved = true;
		});
		bus.emit("async-test", null);

		// emit returns immediately; handler runs async
		expect(resolved).toBe(false);
		await new Promise(r => setTimeout(r, 10));
		expect(resolved).toBe(true);
	});
});
