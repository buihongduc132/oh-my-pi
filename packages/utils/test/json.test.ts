import { describe, expect, it } from "bun:test";
import { tryParseJson } from "@oh-my-pi/pi-utils/json";

describe("tryParseJson", () => {
	it("parses valid JSON objects", () => {
		const result = tryParseJson<{ name: string }>('{"name":"test"}');
		expect(result).toEqual({ name: "test" });
	});

	it("parses valid JSON arrays", () => {
		const result = tryParseJson<number[]>("[1,2,3]");
		expect(result).toEqual([1, 2, 3]);
	});

	it("parses valid JSON primitives", () => {
		expect(tryParseJson<number>("42")).toBe(42);
		expect(tryParseJson<string>(`"hello"`)).toBe("hello");
		expect(tryParseJson<boolean>("true")).toBe(true);
	});

	it("returns null for invalid JSON", () => {
		expect(tryParseJson("{invalid}")).toBeNull();
		expect(tryParseJson("")).toBeNull();
		expect(tryParseJson("not json")).toBeNull();
	});

	it("returns null for partial JSON", () => {
		expect(tryParseJson('{"name":')).toBeNull();
	});

	it("preserves null literal", () => {
		expect(tryParseJson("null")).toBeNull();
	});
});
