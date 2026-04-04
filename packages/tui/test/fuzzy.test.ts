import { describe, expect, it } from "bun:test";
import { fuzzyFilter, fuzzyMatch } from "@oh-my-pi/pi-tui/fuzzy";

describe("fuzzyMatch", () => {
	it("returns matches=true score=0 for empty query", () => {
		const r = fuzzyMatch("", "hello");
		expect(r.matches).toBe(true);
		expect(r.score).toBe(0);
	});

	it("returns matches=false when query is longer than text", () => {
		const r = fuzzyMatch("hello world", "hi");
		expect(r.matches).toBe(false);
	});

	it("matches exact substring", () => {
		const r = fuzzyMatch("hello", "hello world");
		expect(r.matches).toBe(true);
	});

	it("matches characters in order with gaps", () => {
		const r = fuzzyMatch("hw", "hello world");
		expect(r.matches).toBe(true);
	});

	it("gap penalty: wider gaps increase score", () => {
		const r1 = fuzzyMatch("hw", "hellow");
		const r2 = fuzzyMatch("hw", "hellooooooow");
		expect(r1.matches).toBe(true);
		expect(r2.matches).toBe(true);
		expect(r2.score).toBeGreaterThan(r1.score);
	});

	it("handles case insensitivity", () => {
		const r = fuzzyMatch("HELLO", "hello world");
		expect(r.matches).toBe(true);
	});

	it("rejects when query chars not in text in order", () => {
		const r = fuzzyMatch("zz", "hello");
		expect(r.matches).toBe(false);
	});

	it("score is a finite number", () => {
		const r = fuzzyMatch("abc", "abcdef");
		expect(r.matches).toBe(true);
		expect(Number.isFinite(r.score)).toBe(true);
	});
});

describe("fuzzyFilter", () => {
	const items = [
		{ name: "apple" },
		{ name: "apricot" },
		{ name: "banana" },
		{ name: "blueberry" },
		{ name: "cherry" },
	];

	it("returns all items for empty query", () => {
		const r = fuzzyFilter(items, "", i => i.name);
		expect(r).toHaveLength(5);
	});

	it("returns all items for whitespace-only query", () => {
		const r = fuzzyFilter(items, "   ", i => i.name);
		expect(r).toHaveLength(5);
	});

	it("filters by single token", () => {
		const r = fuzzyFilter(items, "ap", i => i.name);
		expect(r.length).toBeLessThan(5);
		expect(r.length).toBeGreaterThan(0);
	});

	it("filters by multiple tokens (AND — all must match)", () => {
		const r = fuzzyFilter(items, "b y", i => i.name);
		expect(r.length).toBeGreaterThan(0);
	});

	it("returns items sorted by best match first", () => {
		const r = fuzzyFilter(items, "ap", i => i.name);
		expect(r[0]?.name).toBe("apple");
	});

	it("returns empty array when nothing matches", () => {
		const r = fuzzyFilter(items, "xyz", i => i.name);
		expect(r).toHaveLength(0);
	});

	it("all results match the query", () => {
		const r = fuzzyFilter(items, "be", i => i.name);
		for (const item of r) {
			const m = fuzzyMatch("be", item.name);
			expect(m.matches).toBe(true);
		}
	});

	it("cjk characters are matched correctly", () => {
		const cjkItems = [{ label: "日本語" }, { label: "中文" }];
		const r = fuzzyFilter(cjkItems, "日", i => i.label);
		expect(r[0]?.label).toBe("日本語");
	});
});
