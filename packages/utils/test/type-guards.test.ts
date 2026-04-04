import { describe, expect, it } from "bun:test";
import { asRecord, isRecord, toError } from "@oh-my-pi/pi-utils";

// ---------------------------------------------------------------------------
// isRecord
// ---------------------------------------------------------------------------

describe("isRecord", () => {
	it("returns true for a plain object", () => {
		expect(isRecord({})).toBe(true);
		expect(isRecord({ a: 1, b: "two" })).toBe(true);
		expect(isRecord(Object.create(null))).toBe(true);
	});

	it("returns false for an array", () => {
		expect(isRecord([])).toBe(false);
		expect(isRecord([1, 2, 3])).toBe(false);
		expect(isRecord(new Array(5))).toBe(false);
	});

	it("returns false for null", () => {
		expect(isRecord(null)).toBe(false);
	});

	it("returns false for primitives", () => {
		expect(isRecord("string")).toBe(false);
		expect(isRecord(42)).toBe(false);
		expect(isRecord(true)).toBe(false);
		expect(isRecord(undefined)).toBe(false);
		expect(isRecord(Symbol("x"))).toBe(false);
		expect(isRecord(() => {})).toBe(false);
	});

	it("returns true for Date / RegExp / Map / Set (plain objects)", () => {
		// Date, RegExp, Map, Set pass the isRecord check
		expect(isRecord(new Date())).toBe(true);
		expect(isRecord(/regex/)).toBe(true);
		expect(isRecord(new Map())).toBe(true);
		expect(isRecord(new Set())).toBe(true);
	});
});

// ---------------------------------------------------------------------------
// asRecord
// ---------------------------------------------------------------------------

describe("asRecord", () => {
	it("returns the object for a plain object", () => {
		const obj = { hello: "world" };
		expect(asRecord(obj)).toBe(obj);
	});

	it("returns null for an array", () => {
		expect(asRecord([])).toBeNull();
		expect(asRecord([1, 2])).toBeNull();
	});

	it("returns null for null", () => {
		expect(asRecord(null)).toBeNull();
	});

	it("returns null for primitives", () => {
		expect(asRecord("string")).toBeNull();
		expect(asRecord(0)).toBeNull();
		expect(asRecord(false)).toBeNull();
		expect(asRecord(undefined)).toBeNull();
	});

	it("narrowed type after null check", () => {
		function test(val: unknown) {
			const rec = asRecord(val);
			if (rec !== null) {
				// rec is narrowed to Record<string, unknown>
				expect(typeof rec).toBe("object");
			}
		}
		test({});
		test(null);
		test("nope");
	});
});

// ---------------------------------------------------------------------------
// toError
// ---------------------------------------------------------------------------

describe("toError", () => {
	it("returns same Error instance unchanged", () => {
		const err = new Error("original message");
		const result = toError(err);
		expect(result).toBe(err);
		expect(result.message).toBe("original message");
	});

	it("returns Error with string as message", () => {
		const result = toError("something went wrong");
		expect(result).toBeInstanceOf(Error);
		expect(result.message).toBe("something went wrong");
	});

	it("returns Error with empty string for ''", () => {
		const result = toError("");
		expect(result).toBeInstanceOf(Error);
		expect(result.message).toBe("");
	});

	it("returns Error with 'null' string for null", () => {
		const result = toError(null);
		expect(result).toBeInstanceOf(Error);
		expect(result.message).toBe("null");
	});

	it("returns Error with 'undefined' string for undefined", () => {
		const result = toError(undefined);
		expect(result).toBeInstanceOf(Error);
		expect(result.message).toBe("undefined");
	});

	it("returns Error with number string for numbers", () => {
		const result = toError(42);
		expect(result).toBeInstanceOf(Error);
		expect(result.message).toBe("42");
	});

	it("preserves Error subclass instance", () => {
		class CustomError extends Error {
			constructor(public readonly code: number) {
				super("custom");
				this.name = "CustomError";
			}
		}
		const err = new CustomError(404);
		const result = toError(err);
		expect(result).toBe(err);
		expect((result as CustomError).code).toBe(404);
	});

	it("converts non-Error to Error via String()", () => {
		// toError uses String(value), not JSON.stringify
		const result1 = toError({ key: "value" });
		expect(result1).toBeInstanceOf(Error);
		expect(result1.message).toBe("[object Object]");

		const result2 = toError([1, 2, 3]);
		expect(result2).toBeInstanceOf(Error);
		expect(result2.message).toBe("1,2,3");
	});
});
