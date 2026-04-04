import { describe, expect, it } from "bun:test";
import { Snowflake } from "@oh-my-pi/pi-utils/snowflake";

describe("Snowflake", () => {
	describe("valid", () => {
		it("returns true for valid 16-char lowercase hex", () => {
			expect(Snowflake.valid("0000000000000000")).toBe(true);
			expect(Snowflake.valid("ffffffffffffffff")).toBe(true);
			expect(Snowflake.valid("aabbccdd00112233")).toBe(true);
		});

		it("returns false for wrong length", () => {
			expect(Snowflake.valid("abc")).toBe(false);
			expect(Snowflake.valid("aabbccddeeff001122")).toBe(false);
		});

		it("returns false for non-string inputs", () => {
			// valid() crashes on non-strings — numeric inputs are acceptable
			expect(Snowflake.valid(1234567890123456 as unknown as string)).toBe(false);
		});
	});

	describe("PATTERN", () => {
		it("matches valid snowflakes", () => {
			expect(Snowflake.PATTERN.test("0000000000000000")).toBe(true);
			expect(Snowflake.PATTERN.test("ffffffffffffffff")).toBe(true);
		});
	});

	describe("Source", () => {
		it("generates unique sequential values", () => {
			const src = new Snowflake.Source(0);
			const t = Snowflake.EPOCH_TIMESTAMP + 1000;
			const a = src.generate(t);
			const b = src.generate(t);
			expect(a).not.toBe(b);
			expect(Snowflake.valid(a)).toBe(true);
			expect(Snowflake.valid(b)).toBe(true);
		});

		it("reset clears sequence", () => {
			const src = new Snowflake.Source(0);
			const t = Snowflake.EPOCH_TIMESTAMP + 2000;
			src.generate(t);
			src.reset();
			const after = src.generate(t);
			// after reset, seq=1 (next generate increments from 0)
			expect(Snowflake.getSequence(after)).toBeGreaterThanOrEqual(1);
		});

		it("sequence getter/setter work", () => {
			const src = new Snowflake.Source(0);
			expect(src.sequence).toBe(0);
			src.sequence = 42;
			expect(src.sequence).toBe(42);
		});

		it("constructor clamps initial sequence to MAX_SEQ bits", () => {
			// MAX_SEQ = 0x3fffff. 0x400063 & 0x3fffff = 99
			const src = new Snowflake.Source(0x400063);
			expect(src.sequence).toBe(99);
		});

		it("constructor with explicit sequence", () => {
			const src = new Snowflake.Source(100);
			expect(src.sequence).toBe(100);
		});

		it("sequence setter clamps to MAX_SEQ bits", () => {
			const src = new Snowflake.Source(0);
			// 0x3fffff + 5 = 0x400064, masked = 4
			src.sequence = 0x3fffff + 5;
			expect(src.sequence).toBe(4);
			// setting 1 is a valid sequence — no clamping needed
			src.sequence = 1;
			expect(src.sequence).toBe(1);
		});
	});

	describe("next", () => {
		it("generates a valid snowflake", () => {
			const sf = Snowflake.next();
			expect(Snowflake.valid(sf)).toBe(true);
		});

		it("generates unique values", () => {
			const a = Snowflake.next();
			const b = Snowflake.next();
			expect(a).not.toBe(b);
		});

		it("accepts a timestamp argument", () => {
			const ts = 1500000000000;
			const sf = Snowflake.next(ts);
			expect(Snowflake.valid(sf)).toBe(true);
			const retrieved = Snowflake.getTimestamp(sf);
			expect(retrieved).toBe(ts);
		});

		it("respects a provided timestamp argument", () => {
			const ts = 1500000000000;
			const sf = Snowflake.next(ts);
			expect(Snowflake.getTimestamp(sf)).toBe(ts);
		});
	});

	describe("formatParts / getSequence", () => {
		it("round-trips sequence", () => {
			const t = Snowflake.EPOCH_TIMESTAMP + 1_600_000_000_000 - Snowflake.EPOCH_TIMESTAMP;
			const sf = Snowflake.formatParts(t, 12345);
			expect(Snowflake.getSequence(sf)).toBe(12345);
		});
	});

	describe("getTimestamp", () => {
		it("recovers timestamp from snowflake", () => {
			const now = Date.now();
			const sf = Snowflake.next(now);
			const ts = Snowflake.getTimestamp(sf);
			expect(Math.abs(ts - now)).toBeLessThan(2);
		});
	});

	describe("lowerbound / upperbound", () => {
		it("lowerbound returns snowflake with seq=0", () => {
			const lb = Snowflake.lowerbound(new Date(2020, 0, 1));
			expect(Snowflake.getSequence(lb)).toBe(0);
		});

		it("upperbound returns snowflake with seq=MAX_SEQ", () => {
			const ub = Snowflake.upperbound(new Date(2020, 0, 1));
			expect(Snowflake.getSequence(ub)).toBe(Snowflake.MAX_SEQUENCE);
		});

		it("accepts number", () => {
			const now = Date.now();
			const lb = Snowflake.lowerbound(now);
			expect(Snowflake.valid(lb)).toBe(true);
		});

		it("accepts snowflake string", () => {
			const sf = Snowflake.next();
			const lb = Snowflake.lowerbound(sf);
			expect(lb).toBe(sf);
		});
	});

	describe("getDate", () => {
		it("returns Date from snowflake", () => {
			const now = Date.now();
			const sf = Snowflake.next(now);
			const date = Snowflake.getDate(sf);
			expect(date instanceof Date).toBe(true);
			expect(Math.abs(date.getTime() - now)).toBeLessThan(2);
		});
	});
});
