import { describe, expect, test } from "bun:test";
import { extractFileMentions } from "../../src/utils/file-mentions";

describe("extractFileMentions", () => {
	test("extracts single mention", () => {
		expect(extractFileMentions("check @src/main.ts")).toEqual(["src/main.ts"]);
	});

	test("extracts multiple mentions", () => {
		const mentions = extractFileMentions("use @foo.ts and @bar/baz.ts okay");
		expect(mentions).toEqual(["foo.ts", "bar/baz.ts"]);
	});

	test("is case-sensitive (keeps original casing)", () => {
		expect(extractFileMentions("open @Src/MAIN.ts")).toEqual(["Src/MAIN.ts"]);
	});

	test("returns unique mentions (deduplicates)", () => {
		const mentions = extractFileMentions("@a.ts and @a.ts again");
		expect(mentions).toEqual(["a.ts"]);
	});

	test("accepts mention at start of text (index 0 is treated as boundary)", () => {
		expect(extractFileMentions("@foo.ts")).toEqual(["foo.ts"]);
	});

	test("skips mention after word char (no boundary before @)", () => {
		// 'f' at index 4 is not a boundary → skip "foo.ts"
		expect(extractFileMentions("conf@foo.ts")).toEqual([]);
	});

	test("accepts mention after whitespace", () => {
		expect(extractFileMentions("use @foo.ts")).toEqual(["foo.ts"]);
	});

	test("accepts mention after opening paren", () => {
		expect(extractFileMentions("(@foo.ts)")).toEqual(["foo.ts"]);
	});

	test("accepts mention after opening bracket (boundary)", () => {
		expect(extractFileMentions("[@foo.ts]")).toEqual(["foo.ts"]);
	});

	test("accepts mention after opening brace (boundary)", () => {
		expect(extractFileMentions("{@foo.ts}")).toEqual(["foo.ts"]);
	});

	test("accepts mention after backtick (boundary)", () => {
		expect(extractFileMentions("`@foo.ts`")).toEqual(["foo.ts"]);
	});

	test("accepts mention after double quote (boundary)", () => {
		expect(extractFileMentions('"@foo.ts"')).toEqual(["foo.ts"]);
	});

	test("accepts mention after single quote (boundary)", () => {
		expect(extractFileMentions("'@foo.ts'")).toEqual(["foo.ts"]);
	});

	test("closing paren is not a boundary — it is captured and becomes part of path", () => {
		// ')' is in TRAILING_PUNCTUATION_REGEX so it IS stripped from the path
		expect(extractFileMentions("(@foo.ts)")).toEqual(["foo.ts"]);
		// But in the middle of a token, only the leading boundary '(' triggers
		// The trailing ')' is not stripped when it appears before 'more'
		expect(extractFileMentions("(@foo.ts)more @bar.ts")).toEqual(["foo.ts)more", "bar.ts"]);
	});

	test("strips trailing comma from path", () => {
		expect(extractFileMentions("use @foo.ts, okay")).toEqual(["foo.ts"]);
		expect(extractFileMentions("use {@foo.ts},")).toEqual(["foo.ts"]);
	});

	test("strips multiple trailing punctuation", () => {
		expect(extractFileMentions("use @foo.ts,!")).toEqual(["foo.ts"]);
		expect(extractFileMentions("use @foo.ts;:")).toEqual(["foo.ts"]);
	});

	test("skips path that becomes empty after sanitization", () => {
		// ')' alone: trim → ")", LEADING strips nothing, TRAILING strips ")" → "", returns null → skip
		expect(extractFileMentions("use @)")).toEqual([]);
	});

	test("skips mention that is only punctuation after @", () => {
		// "@)))" → captured ')))', TRAILING strips all → empty → skip
		expect(extractFileMentions("use @)))")).toEqual([]);
	});

	test("accepts complex file paths", () => {
		expect(extractFileMentions("see @src/components/Button/index.tsx")).toEqual(["src/components/Button/index.tsx"]);
		expect(extractFileMentions("read @package.json config")).toEqual(["package.json"]);
		expect(extractFileMentions("check @.env.local")).toEqual([".env.local"]);
	});

	test("handles no mentions", () => {
		expect(extractFileMentions("no mentions here")).toEqual([]);
	});

	test("handles empty string", () => {
		expect(extractFileMentions("")).toEqual([]);
	});

	test("@ inside captured group stops at next @", () => {
		// /@([^\s@]+)/g — captured group excludes @, so second @ ends first match
		expect(extractFileMentions("file @foo@bar.ts")).toEqual(["foo"]);
	});

	test("whitespace between mentions splits into separate captures", () => {
		expect(extractFileMentions("@foo @bar.ts")).toEqual(["foo", "bar.ts"]);
	});

	test("accepts mention after slash (boundary)", () => {
		expect(extractFileMentions("(@src/lib/utils.ts)")).toEqual(["src/lib/utils.ts"]);
	});

	test("accepts mention after opening angle bracket (boundary)", () => {
		expect(extractFileMentions("<@foo.ts>")).toEqual(["foo.ts"]);
	});

	test("multiple boundary types in one string", () => {
		// Each opening bracket char is a boundary; closing chars are not
		// '(@src...' → '(' is boundary → "src" captured; '[' → boundary → "test.ts"; '`' → boundary → "lib/utils.ts"
		// closing ')', ']', ')' are not boundaries (so the second ')' is captured)
		expect(extractFileMentions("(@src `lib/utils.ts`  [@test.ts]  'foo.ts')")).toEqual(["src", "test.ts"]);
	});

	test("deduplication preserves order of first occurrence", () => {
		const mentions = extractFileMentions("@a.ts @b.ts @a.ts @c.ts");
		expect(mentions).toEqual(["a.ts", "b.ts", "c.ts"]);
	});
});
