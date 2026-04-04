import { describe, expect, test } from "bun:test";
// fuzzyMatch and fuzzyFilter live in src/utils/fuzzy.ts, which is not re-exported by
// src/index.ts (only src/patch/fuzzy is). Import directly from the source file.
import { fuzzyFilter, fuzzyMatch } from "../../src/utils/fuzzy";

describe("fuzzyMatch", () => {
	test("empty query returns matches:true with score 0", () => {
		const result = fuzzyMatch("", "hello");
		expect(result).toEqual({ matches: true, score: 0 });
	});

	test("query longer than text returns matches:false with score 0", () => {
		const result = fuzzyMatch("hello world", "hi");
		expect(result).toEqual({ matches: false, score: 0 });
	});

	test("query chars not found in order returns matches:false with score 0", () => {
		const result = fuzzyMatch("zlo", "hello");
		expect(result).toEqual({ matches: false, score: 0 });
	});

	test("exact match returns matches:true with score <= 0", () => {
		const result = fuzzyMatch("hello", "hello");
		expect(result.matches).toBe(true);
		expect(result.score).toBeLessThanOrEqual(0);
	});

	test("word boundary bonus: matching at start of word scores better than mid-word", () => {
		// "foo-bar": 'b' at idx 4, preceded by '-' → boundary, score -= 10
		// "foobar":  'b' at idx 3, preceded by 'o'  → not a boundary
		const boundary = fuzzyMatch("bar", "foo-bar");
		const mid = fuzzyMatch("bar", "foobar");
		expect(boundary.matches).toBe(true);
		expect(mid.matches).toBe(true);
		expect(boundary.score).toBeLessThan(mid.score);
	});

	test("consecutive match bonus: 'foo' in 'foobar' scores better than 'f_o_o_bar'", () => {
		// "foobar":     f→0, o→1(consecutive), o→2(consecutive) → score = -25
		// "f_o_o_bar":  f→0, o→2(gap+2,-10), o→4(gap+2)          → score = -16
		const consecutive = fuzzyMatch("foo", "foobar");
		const fragmented = fuzzyMatch("foo", "f_o_o_bar");
		expect(consecutive.matches).toBe(true);
		expect(fragmented.matches).toBe(true);
		expect(consecutive.score).toBeLessThan(fragmented.score);
	});

	test("gap penalty: 'foo' matching 'fxxoo' scores worse than 'foo'", () => {
		// "fxxoo": f→0(boundary), o→3(gap), o→4(consecutive) → gap penalty applied before the first 'o'
		// "foo":    f→0(boundary), o→1(consecutive), o→2(consecutive) → no gaps
		const withGaps = fuzzyMatch("foo", "fxxoo");
		const exact = fuzzyMatch("foo", "foo");
		expect(withGaps.matches).toBe(true);
		expect(exact.matches).toBe(true);
		expect(withGaps.score).toBeGreaterThan(exact.score);
	});

	test("case insensitivity: 'Foo' matches 'foo'", () => {
		const result = fuzzyMatch("Foo", "foo");
		expect(result.matches).toBe(true);
	});
});

describe("fuzzyFilter", () => {
	const items = [
		{ id: 1, name: "foo bar" },
		{ id: 2, name: "baz qux" },
		{ id: 3, name: "FOO bar" }, // matches "foo" and "foo bar" (case-insensitive)
		{ id: 4, name: "alpha beta" },
	];

	test("empty query returns all items unchanged in original order", () => {
		const result = fuzzyFilter(items, "", it => it.name);
		expect(result).toEqual(items);
	});

	test("whitespace-only query returns all items unchanged", () => {
		const result = fuzzyFilter(items, "   ", it => it.name);
		expect(result).toEqual(items);
	});

	test("query with leading whitespace is trimmed before matching", () => {
		// "  foo" → .trim() → "foo" → matches "foo bar" and "FOO bar"
		const result = fuzzyFilter(items, "  foo", it => it.name);
		expect(result.map(it => it.id)).toContainEqual(1);
		expect(result.map(it => it.id)).toContainEqual(3);
		expect(result.map(it => it.id)).not.toContainEqual(2);
	});

	test("single token returns matching items sorted by score", () => {
		const result = fuzzyFilter(items, "foo", it => it.name);
		// id 3 ("FOO bar") and id 1 ("foo bar") both match "foo" with identical score
		// (boundary at idx 0, two consecutive o's → -25 each); both included
		expect(result.map(it => it.id)).toContainEqual(1);
		expect(result.map(it => it.id)).toContainEqual(3);
		// id 2 ("baz qux") and id 4 ("alpha beta") do not contain "foo"
		expect(result.map(it => it.id)).not.toContainEqual(2);
		expect(result.map(it => it.id)).not.toContainEqual(4);
	});

	test("space-separated tokens: all tokens must match", () => {
		const result = fuzzyFilter(items, "foo bar", it => it.name);
		// id 3 ("FOO bar") matches both "foo" and "bar" (case-insensitive) → included
		expect(result.map(it => it.id)).toContainEqual(3);
		// id 1 ("foo bar") also matches both tokens → included
		expect(result.map(it => it.id)).toContainEqual(1);
	});

	test("non-matching items are filtered out", () => {
		const result = fuzzyFilter(items, "xyz", it => it.name);
		expect(result).toEqual([]);
	});

	test("score is sum of individual token match scores", () => {
		const multiTokenItems = [
			{ id: 1, name: "foo bar" },
			{ id: 2, name: "foo baz" },
		];
		// "foo" alone matches both → returns both
		const result = fuzzyFilter(multiTokenItems, "foo", it => it.name);
		expect(result.map(it => it.id)).toContainEqual(1);
		expect(result.map(it => it.id)).toContainEqual(2);
	});

	test("empty items array returns empty array for any query", () => {
		const result = fuzzyFilter([] as { id: number; name: string }[], "foo", it => it.name);
		expect(result).toEqual([]);
	});

	test("empty items array with empty query returns empty array", () => {
		const result = fuzzyFilter([] as { id: number; name: string }[], "", it => it.name);
		expect(result).toEqual([]);
	});

	test("identical scores: both items are included", () => {
		const identical = [
			{ id: 1, name: "aaa" },
			{ id: 2, name: "aaa" },
		];
		const result = fuzzyFilter(identical, "aaa", it => it.name);
		expect(result.map(it => it.id)).toContainEqual(1);
		expect(result.map(it => it.id)).toContainEqual(2);
	});
});
