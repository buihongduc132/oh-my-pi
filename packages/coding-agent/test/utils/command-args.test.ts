import { describe, expect, it } from "bun:test";
import { parseCommandArgs, substituteArgs } from "@oh-my-pi/pi-coding-agent/utils/command-args";

// ---------------------------------------------------------------------------
// parseCommandArgs
// ---------------------------------------------------------------------------
describe("parseCommandArgs", () => {
	it("returns empty array for empty string", () => {
		expect(parseCommandArgs("")).toEqual([]);
	});

	it("parses a single unquoted word", () => {
		expect(parseCommandArgs("foo")).toEqual(["foo"]);
	});

	it("parses multiple space-separated words", () => {
		expect(parseCommandArgs("foo bar baz")).toEqual(["foo", "bar", "baz"]);
	});

	it("parses a double-quoted argument preserving spaces", () => {
		expect(parseCommandArgs('"hello world"')).toEqual(["hello world"]);
	});

	it("parses a single-quoted argument preserving spaces", () => {
		expect(parseCommandArgs("'hello world'")).toEqual(["hello world"]);
	});

	it("parses mixed quoted and unquoted arguments", () => {
		expect(parseCommandArgs("cmd --flag 'arg with spaces' -x")).toEqual(["cmd", "--flag", "arg with spaces", "-x"]);
	});

	it("handles multiple spaces between arguments", () => {
		expect(parseCommandArgs("foo    bar")).toEqual(["foo", "bar"]);
	});

	it("handles tabs as separators", () => {
		expect(parseCommandArgs("foo\tbar")).toEqual(["foo", "bar"]);
	});

	it("returns empty array for empty double quotes", () => {
		expect(parseCommandArgs('""')).toEqual([]);
	});

	it("returns empty array for empty single quotes", () => {
		expect(parseCommandArgs("''")).toEqual([]);
	});

	it("handles trailing unclosed quote as valid argument", () => {
		expect(parseCommandArgs('"hello')).toEqual(["hello"]);
	});

	it("preserves spaces inside quotes with trailing spaces", () => {
		expect(parseCommandArgs('"hello  "')).toEqual(["hello  "]);
	});

	it("handles key=value arguments", () => {
		expect(parseCommandArgs("--config=/path/to/file.json")).toEqual(["--config=/path/to/file.json"]);
	});

	it("handles arguments with equals in quotes", () => {
		expect(parseCommandArgs('name="value with = equals"')).toEqual(["name=value with = equals"]);
	});
});

// ---------------------------------------------------------------------------
// substituteArgs
// ---------------------------------------------------------------------------
describe("substituteArgs", () => {
	it("returns content unchanged when no placeholders", () => {
		expect(substituteArgs("hello world", [])).toBe("hello world");
	});

	it("returns content with empty strings for unmatched placeholders when args are empty", () => {
		expect(substituteArgs("use $1 and $2", [])).toBe("use  and ");
	});

	describe("$1, $2, etc. positional substitution", () => {
		it("substitutes single positional placeholder", () => {
			expect(substituteArgs("file: $1", ["test.ts"])).toBe("file: test.ts");
		});

		it("substitutes multiple positional placeholders", () => {
			expect(substituteArgs("$1 $2 $3", ["a", "b", "c"])).toBe("a b c");
		});

		it("substitutes $1 multiple times", () => {
			expect(substituteArgs("src/$1/*.ts and src/$1/*.js", ["utils"])).toBe("src/utils/*.ts and src/utils/*.js");
		});

		it("omits out-of-bounds positional placeholders (replaced with empty string)", () => {
			expect(substituteArgs("$1 $2 $3", ["only-one"])).toBe("only-one  ");
		});

		it("$10 is the 10th positional arg (regex matches 1 or more digits)", () => {
			// With args = ["ten"], index 9 is out of bounds → empty string
			expect(substituteArgs("arg: $10", ["ten"])).toBe("arg: ");
			// With 10+ args, $10 resolves to the 10th
			expect(substituteArgs("arg: $10", ["a0", "a1", "a2", "a3", "a4", "a5", "a6", "a7", "a8", "the-tenth"])).toBe(
				"arg: the-tenth",
			);
		});
	});

	describe("$@[start:length] slice syntax", () => {
		it("returns all args from start when no length given", () => {
			expect(substituteArgs("args: $@[1]", ["a", "b", "c"])).toBe("args: a b c");
		});

		it("returns all args from start when length is empty string (bare colon)", () => {
			expect(substituteArgs("args: $@[2:]", ["a", "b", "c"])).toBe("args: b c");
		});

		it("returns slice of args with positive length", () => {
			expect(substituteArgs("first two: $@[1:2]", ["a", "b", "c"])).toBe("first two: a b");
		});

		it("returns slice from middle", () => {
			expect(substituteArgs("middle: $@[2:2]", ["a", "b", "c"])).toBe("middle: b c");
		});

		it("returns empty string when start exceeds args length", () => {
			expect(substituteArgs("extra: $@[5]", ["a", "b"])).toBe("extra: ");
		});

		// length=0 → parseInt returns 0, condition `length <= 0` is true → returns ""
		it("returns empty string when length is 0", () => {
			expect(substituteArgs("none: $@[1:0]", ["a", "b"])).toBe("none: ");
		});

		// negative length → regex doesn't match → pattern passed through literally
		it("leaves negative length pattern un-substituted (pattern does not match)", () => {
			expect(substituteArgs("negative: $@[1:-1]", ["a", "b"])).toBe("negative: a b[1:-1]");
		});

		it("returns empty string when start is 0 (1-based, invalid)", () => {
			expect(substituteArgs("zero: $@[0]", ["a", "b"])).toBe("zero: ");
		});

		it("handles three-digit start index", () => {
			expect(substituteArgs("third: $@[3]", ["a", "b", "c", "d"])).toBe("third: c d");
		});
	});

	describe("$ARGUMENTS placeholder", () => {
		it("substitutes all args joined by space", () => {
			expect(substituteArgs("ARGS: $ARGUMENTS", ["--flag", "value"])).toBe("ARGS: --flag value");
		});

		it("substitutes $ARGUMENTS with empty array", () => {
			expect(substituteArgs("ARGS: $ARGUMENTS", [])).toBe("ARGS: ");
		});
	});

	describe("$@ placeholder", () => {
		it("substitutes all args joined by space", () => {
			expect(substituteArgs("ARGS: $@", ["--flag", "value"])).toBe("ARGS: --flag value");
		});

		it("substitutes $@ with empty array", () => {
			expect(substituteArgs("ARGS: $@", [])).toBe("ARGS: ");
		});
	});

	describe("substitution order: positional → $@[] → $ARGUMENTS → $@", () => {
		// $ARGUMENTS is substituted AFTER positional, so it appears in the output literally
		// if it came before positional in the template (because positional was already consumed)
		it("substitutes $ARGUMENTS (all args) then $1 (positional, already consumed)", () => {
			const result = substituteArgs("$ARGUMENTS: $1", ["foo", "bar"]);
			// After positional: "$ARGUMENTS: foo" → then $ARGUMENTS: "foo bar: foo"
			expect(result).toBe("foo bar: foo");
		});

		it("positional substitution happens first, then $@ — so $@ sees positional's result", () => {
			// After positional: "file=main.ts extras=main.ts" → then $@ replaces the trailing $@
			expect(substituteArgs("file=$1 extras=$@", ["main.ts", "--verbose", "--debug"])).toBe(
				"file=main.ts extras=main.ts --verbose --debug",
			);
		});

		it("no space added before $ARGUMENTS when args[0] is the entire content", () => {
			expect(substituteArgs("cmd $ARGUMENTS run $1", ["test"])).toBe("cmd test run test");
		});
	});

	describe("no recursive substitution of replacement values", () => {
		it("does not recursively substitute if replacement value contains placeholders", () => {
			// args[0] = "$1" — positional substitution replaces $1 with "$1"
			// The expanded value is NOT re-scanned for $@ or $ARGUMENTS
			expect(substituteArgs("v1=$1 v2=$2", ["$1", "original"])).toBe("v1=$1 v2=original");
		});
	});
});
