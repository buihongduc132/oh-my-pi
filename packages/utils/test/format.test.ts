import { describe, expect, it } from "bun:test";
import {
	formatAge,
	formatBytes,
	formatCount,
	formatDuration,
	formatNumber,
	formatPercent,
	pluralize,
	truncate,
} from "@oh-my-pi/pi-utils/format";

describe("formatDuration", () => {
	it("formats milliseconds", () => {
		expect(formatDuration(0)).toBe("0ms");
		expect(formatDuration(500)).toBe("500ms");
		expect(formatDuration(999)).toBe("999ms");
	});

	it("formats seconds", () => {
		expect(formatDuration(1000)).toBe("1.0s");
		expect(formatDuration(5500)).toBe("5.5s");
	});

	it("formats minutes", () => {
		expect(formatDuration(60_000)).toBe("1m");
		expect(formatDuration(90_000)).toBe("1m30s");
	});

	it("formats hours", () => {
		expect(formatDuration(3_600_000)).toBe("1h");
		expect(formatDuration(3_900_000)).toBe("1h5m");
	});

	it("formats days", () => {
		expect(formatDuration(86_400_000)).toBe("1d");
		expect(formatDuration(100_800_000)).toBe("1d4h");
	});
});

describe("formatNumber", () => {
	it("leaves small numbers as-is", () => {
		expect(formatNumber(0)).toBe("0");
		expect(formatNumber(999)).toBe("999");
	});

	it("formats thousands", () => {
		expect(formatNumber(1_000)).toBe("1.0K");
		expect(formatNumber(5_000)).toBe("5.0K");
		expect(formatNumber(25_000)).toBe("25K");
	});

	it("formats millions", () => {
		expect(formatNumber(1_000_000)).toBe("1.0M");
		expect(formatNumber(25_000_000)).toBe("25M");
	});

	it("formats billions", () => {
		expect(formatNumber(1_000_000_000)).toBe("1.0B");
		expect(formatNumber(25_000_000_000)).toBe("25B");
	});
});

describe("formatBytes", () => {
	it("formats bytes", () => {
		expect(formatBytes(0)).toBe("0B");
		expect(formatBytes(512)).toBe("512B");
		expect(formatBytes(1023)).toBe("1023B");
	});

	it("formats kilobytes", () => {
		expect(formatBytes(1024)).toBe("1.0KB");
		expect(formatBytes(1536)).toBe("1.5KB");
	});

	it("formats megabytes", () => {
		expect(formatBytes(1_048_576)).toBe("1.0MB");
	});

	it("formats gigabytes", () => {
		expect(formatBytes(1_073_741_824)).toBe("1.0GB");
	});
});

describe("truncate", () => {
	it("returns short strings unchanged", () => {
		expect(truncate("hi", 10)).toBe("hi");
		expect(truncate("hi", 2)).toBe("hi");
	});

	expect(truncate("hello world", 5)).toBe("hell…");
	expect(truncate("hello world", 8)).toBe("hello w…");

	expect(truncate("hello", 3, "..")).toBe("h..");
});

describe("formatCount", () => {
	it("pluralizes correctly", () => {
		expect(formatCount("file", 0)).toBe("0 files");
		expect(formatCount("file", 1)).toBe("1 file");
		expect(formatCount("file", 5)).toBe("5 files");
	});

	it("handles non-finite counts", () => {
		expect(formatCount("file", NaN)).toBe("0 files");
	});
});

describe("formatAge", () => {
	it("returns empty for null/undefined", () => {
		expect(formatAge(null)).toBe("");
		expect(formatAge(undefined)).toBe("");
		expect(formatAge(0)).toBe("");
	});

	it("formats seconds as 'just now'", () => {
		expect(formatAge(30)).toBe("just now");
	});

	it("formats minutes", () => {
		expect(formatAge(120)).toBe("2m ago");
	});

	it("formats hours", () => {
		expect(formatAge(7200)).toBe("2h ago");
	});

	it("formats days", () => {
		expect(formatAge(172_800)).toBe("2d ago");
	});

	it("formats weeks", () => {
		expect(formatAge(1_209_600)).toBe("2w ago"); // 2 weeks
	});

	it("formats months", () => {
		expect(formatAge(5_184_000)).toBe("2mo ago"); // ~60 days
	});
});

describe("pluralize", () => {
	it("returns label unchanged for count 1", () => {
		expect(pluralize("file", 1)).toBe("file");
	});

	it("adds 's' to regular nouns", () => {
		expect(pluralize("file", 2)).toBe("files");
		expect(pluralize("cat", 3)).toBe("cats");
	});

	it("adds 'es' to ch/sh/s/x/z endings", () => {
		expect(pluralize("box", 2)).toBe("boxes");
		expect(pluralize("church", 2)).toBe("churches");
		expect(pluralize("wish", 2)).toBe("wishes");
	});

	it("replaces 'y' with 'ies' for consonant+y", () => {
		expect(pluralize("city", 2)).toBe("cities");
		expect(pluralize("fly", 2)).toBe("flies");
	});
});

describe("formatPercent", () => {
	it("formats as percentage string", () => {
		expect(formatPercent(0.5)).toBe("50.0%");
		expect(formatPercent(0.333)).toBe("33.3%");
		expect(formatPercent(1)).toBe("100.0%");
		expect(formatPercent(0)).toBe("0.0%");
	});
});
