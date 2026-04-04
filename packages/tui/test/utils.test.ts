import { describe, expect, it } from "bun:test";
import {
	applyBackgroundToLine,
	getSegmenter,
	getWordNavKind,
	isPunctuationChar,
	isWhitespaceChar,
	isWordNavJoiner,
	moveWordLeft,
	moveWordRight,
	padding,
	replaceTabs,
	sliceByColumn,
	visibleWidth,
	visibleWidthRaw,
} from "@oh-my-pi/pi-tui/utils";

describe("padding", () => {
	it("returns empty string for n <= 0", () => {
		expect(padding(0)).toBe("");
		expect(padding(-1)).toBe("");
	});

	it("returns correct spaces from pre-allocated buffer for n <= 512", () => {
		expect(padding(1)).toBe(" ");
		expect(padding(5)).toBe("     ");
		expect(padding(512)).toHaveLength(512);
	});

	it("returns correct spaces for n > 512", () => {
		const result = padding(600);
		expect(result).toHaveLength(600);
	});
});

describe("getSegmenter", () => {
	it("returns a segmenter with a segment method", () => {
		const seg = getSegmenter();
		expect(typeof (seg as any).segment).toBe("function");
	});

	it("returns the same instance on repeated calls", () => {
		expect(getSegmenter()).toBe(getSegmenter());
	});
});

describe("visibleWidth", () => {
	it("returns 0 for empty string", () => expect(visibleWidth("")).toBe(0));
	it("returns length for pure ASCII", () => expect(visibleWidth("hello")).toBe(5));
	it("counts a tab as the configured tab width", () => {
		expect(visibleWidth("\t")).toBe(4);
		expect(visibleWidth("a\tb")).toBe(6);
	});
});

describe("visibleWidthRaw", () => {
	it("returns 0 for empty string", () => expect(visibleWidthRaw("")).toBe(0));
	it("returns length for pure ASCII", () => expect(visibleWidthRaw("abc")).toBe(3));
	it("counts tabs with configured tab width", () => {
		expect(visibleWidthRaw("\t")).toBe(4);
		expect(visibleWidthRaw("x\ty")).toBe(6);
	});
});
describe("replaceTabs", () => {
	it("replaces a single tab with the configured tab width (3 spaces)", () => {
		expect(replaceTabs("\t")).toBe("   ");
	});

	it("replaces multiple tabs", () => {
		expect(replaceTabs("a\tb\tc")).toBe("a   b   c");
	});

	it("leaves text without tabs unchanged", () => {
		expect(replaceTabs("hello world")).toBe("hello world");
	});

	it("handles mixed tabs and text", () => {
		expect(replaceTabs("\tfoo\tbar\t")).toBe("   foo   bar   ");
	});

	it("handles empty string", () => {
		expect(replaceTabs("")).toBe("");
	});
});

describe("isWhitespaceChar", () => {
	it("returns true for whitespace", () => {
		expect(isWhitespaceChar(" ")).toBe(true);
		expect(isWhitespaceChar("\t")).toBe(true);
		expect(isWhitespaceChar("\n")).toBe(true);
	});
	it("returns false for non-whitespace", () => {
		expect(isWhitespaceChar("a")).toBe(false);
		expect(isWhitespaceChar("!")).toBe(false);
		expect(isWhitespaceChar("")).toBe(false);
	});
});

describe("isPunctuationChar", () => {
	it("returns true for punctuation", () => {
		expect(isPunctuationChar("(")).toBe(true);
		expect(isPunctuationChar("!")).toBe(true);
		expect(isPunctuationChar(".")).toBe(true);
	});
	it("returns false for non-punctuation", () => {
		expect(isPunctuationChar("a")).toBe(false);
		expect(isPunctuationChar("5")).toBe(false);
		expect(isPunctuationChar(" ")).toBe(false);
	});
});

describe("getWordNavKind", () => {
	it("classifies '_' as delimiter", () => expect(getWordNavKind("_")).toBe("delimiter"));
	it("classifies whitespace as whitespace", () => expect(getWordNavKind(" ")).toBe("whitespace"));
	it("classifies punctuation as delimiter", () => expect(getWordNavKind(".")).toBe("delimiter"));
	it("classifies CJK as cjk", () => expect(getWordNavKind("中")).toBe("cjk"));
	it("classifies letters as word", () => {
		expect(getWordNavKind("a")).toBe("word");
		expect(getWordNavKind("Z")).toBe("word");
		expect(getWordNavKind("5")).toBe("word");
	});
	it("classifies emoji as delimiter", () => expect(getWordNavKind("⭐")).toBe("delimiter"));
	it("returns 'other' for empty string", () => expect(getWordNavKind("")).toBe("other"));
});

describe("isWordNavJoiner", () => {
	it("returns true for joiner characters", () => {
		expect(isWordNavJoiner("'")).toBe(true);
		expect(isWordNavJoiner("-")).toBe(true);
		expect(isWordNavJoiner("\u2010")).toBe(true);
	});
	it("returns false for non-joiners", () => {
		expect(isWordNavJoiner("a")).toBe(false);
		expect(isWordNavJoiner(" ")).toBe(false);
	});
});

describe("moveWordLeft", () => {
	it("returns 0 for empty string", () => expect(moveWordLeft("", 0)).toBe(0));
	it("returns 0 at start", () => expect(moveWordLeft("hello", 0)).toBe(0));
	it("skips whitespace before words", () => {
		const result = moveWordLeft("hello world", 11);
		expect(result).toBeLessThan(11);
	});
	it("handles cursor beyond length", () => {
		const result = moveWordLeft("hello", 100);
		expect(result).toBeGreaterThanOrEqual(0);
	});
});

describe("moveWordRight", () => {
	it("returns len at end of string", () => expect(moveWordRight("hello world", 11)).toBe(11));
	it("moves past word boundary", () => {
		const result = moveWordRight("hello world", 0);
		expect(result).toBeGreaterThan(0);
	});
	it("skips delimiter run", () => {
		const result = moveWordRight("hello...world", 5);
		expect(result).toBeGreaterThan(5);
	});
	it("handles cursor beyond length", () => expect(moveWordRight("hello", 100)).toBe(5));
});

describe("sliceByColumn", () => {
	it("extracts columns from start", () => expect(sliceByColumn("hello world", 0, 5)).toBe("hello"));
	it("extracts columns from offset", () => expect(sliceByColumn("hello world", 6, 5)).toBe("world"));
	it("handles empty line", () => expect(sliceByColumn("", 0, 5)).toBe(""));
});

describe("applyBackgroundToLine", () => {
	it("applies background and pads to width", () => {
		const bg = (text: string) => `\x1b[44m${text}\x1b[0m`;
		const result = applyBackgroundToLine("hi", 10, bg);
		expect(result).toContain("\x1b[44m");
		const visible = result.replace(/\x1b\[[0-9;]*m/g, "");
		expect(visible.length).toBeGreaterThanOrEqual(10);
	});
});
