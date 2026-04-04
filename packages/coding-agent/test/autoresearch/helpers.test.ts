import { describe, expect, it } from "bun:test";
import {
	commas,
	formatElapsed,
	formatNum,
	inferMetricUnitFromName,
	isAutoresearchCommittableFile,
	isAutoresearchLocalStatePath,
	isAutoresearchShCommand,
	mergeAsi,
	normalizeAutoresearchPath,
	parseAsiLines,
	parseMetricLines,
} from "../../src/autoresearch/helpers";

describe("autoresearch/helpers", () => {
	describe("parseMetricLines", () => {
		it("parses valid METRIC lines", () => {
			const output = "METRIC latency=123.45\nMETRIC accuracy=0.99\n";
			const metrics = parseMetricLines(output);
			expect(metrics.get("latency")).toBe(123.45);
			expect(metrics.get("accuracy")).toBe(0.99);
		});

		it("parses key with dots and unicode", () => {
			const output = "METRIC foo_barµ-1=500\n";
			const metrics = parseMetricLines(output);
			expect(metrics.get("foo_barµ-1")).toBe(500);
		});

		it("skips __proto__ key", () => {
			const output = "METRIC __proto__=evil\nMETRIC safe=42\n";
			const metrics = parseMetricLines(output);
			expect(metrics.has("__proto__")).toBe(false);
			expect(metrics.get("safe")).toBe(42);
		});

		it("skips constructor key", () => {
			const output = "METRIC constructor=evil\nMETRIC score=10\n";
			const metrics = parseMetricLines(output);
			expect(metrics.has("constructor")).toBe(false);
			expect(metrics.get("score")).toBe(10);
		});

		it("skips prototype key", () => {
			const output = "METRIC prototype=evil\nMETRIC count=5\n";
			const metrics = parseMetricLines(output);
			expect(metrics.has("prototype")).toBe(false);
			expect(metrics.get("count")).toBe(5);
		});

		it("skips non-finite values", () => {
			const output = "METRIC nan=NaN\nMETRIC inf=Infinity\nMETRIC valid=7\n";
			const metrics = parseMetricLines(output);
			expect(metrics.has("nan")).toBe(false);
			expect(metrics.has("inf")).toBe(false);
			expect(metrics.get("valid")).toBe(7);
		});

		it("returns empty map for empty input", () => {
			expect(parseMetricLines("")).toEqual(new Map());
		});

		it("returns empty map for non-matching lines", () => {
			const output = "METRICfoo=1\nINFO bar=2\n";
			expect(parseMetricLines(output)).toEqual(new Map());
		});
	});

	describe("parseAsiLines", () => {
		it("parses boolean true", () => {
			const output = "ASI enabled=true\n";
			const asi = parseAsiLines(output);
			expect(asi?.enabled).toBe(true);
		});

		it("parses boolean false", () => {
			const output = "ASI disabled=false\n";
			const asi = parseAsiLines(output);
			expect(asi?.disabled).toBe(false);
		});

		it("parses null", () => {
			const output = "ASI nothing=null\n";
			const asi = parseAsiLines(output);
			expect(asi?.nothing).toBe(null);
		});

		it("parses integers and floats", () => {
			const output = "ASI count=42\nASI ratio=3.14\nASI neg=-10\n";
			const asi = parseAsiLines(output);
			expect(asi?.count).toBe(42);
			expect(asi?.ratio).toBe(3.14);
			expect(asi?.neg).toBe(-10);
		});

		it("parses plain strings that look like keywords", () => {
			const output = "ASI tag=true-ish\nASI label=false-other\n";
			const asi = parseAsiLines(output);
			expect(asi?.tag).toBe("true-ish");
			expect(asi?.label).toBe("false-other");
		});

		it("parses JSON object", () => {
			const output = 'ASI meta={"key":"value"}\n';
			const asi = parseAsiLines(output);
			expect(asi?.meta).toEqual({ key: "value" });
		});

		it("parses JSON array", () => {
			const output = "ASI items=[1,2,3]\n";
			const asi = parseAsiLines(output);
			expect(asi?.items).toEqual([1, 2, 3]);
		});

		it("parses JSON string", () => {
			const output = 'ASI name="Alice"\n';
			const asi = parseAsiLines(output);
			expect(asi?.name).toBe("Alice");
		});

		it("falls back to string for invalid JSON", () => {
			const output = "ASI broken={notjson\n";
			const asi = parseAsiLines(output);
			expect(asi?.broken).toBe("{notjson");
		});

		it("skips __proto__, constructor, prototype keys", () => {
			const output = "ASI __proto__=evil\nASI constructor=bad\nASI prototype=worse\nASI safe=gOOD\n";
			const asi = parseAsiLines(output);
			expect(asi?.safe).toBe("gOOD");
			expect(Object.keys(asi ?? {})).not.toContain("__proto__");
		});

		it("returns null when no valid ASI lines found", () => {
			expect(parseAsiLines("")).toBeNull();
			expect(parseAsiLines("INFO foo=bar")).toBeNull();
		});
	});

	describe("mergeAsi", () => {
		it("returns undefined when both are null/undefined", () => {
			expect(mergeAsi(null, undefined)).toBeUndefined();
		});

		it("returns copy of base when override is absent", () => {
			const base = { a: 1, b: "x" };
			const result = mergeAsi(base, undefined);
			expect(result).toEqual({ a: 1, b: "x" });
			// ensure it's a copy, not same reference
			(result as typeof result & { c: number }).c = 99;
			expect(base).not.toHaveProperty("c");
		});

		it("returns copy of override when base is absent", () => {
			const override = { b: 2, c: true };
			const result = mergeAsi(null, override);
			expect(result).toEqual({ b: 2, c: true });
		});

		it("shallow-merges base with override", () => {
			const result = mergeAsi({ a: 1, b: "old" }, { b: "new", c: 3 });
			expect(result).toEqual({ a: 1, b: "new", c: 3 });
		});
	});

	describe("commas", () => {
		it("formats zero", () => {
			expect(commas(0)).toBe("0");
		});

		it("formats positive integer", () => {
			expect(commas(1234)).toBe("1,234");
		});

		it("formats negative integer", () => {
			expect(commas(-1234567)).toBe("-1,234,567");
		});

		it("formats large number", () => {
			expect(commas(1234567890)).toBe("1,234,567,890");
		});
	});

	describe("formatNum", () => {
		it("formats integer with no decimals", () => {
			expect(formatNum(1234, "")).toBe("1,234");
		});

		it("formats float with specified decimals", () => {
			expect(formatNum(1234.567, "")).toBe("1,234.57");
		});

		it("formats negative numbers", () => {
			expect(formatNum(-99.5, "")).toBe("-99.50");
		});
	});

	describe("formatElapsed", () => {
		it("formats zero seconds", () => {
			expect(formatElapsed(0)).toBe("0s");
		});

		it("formats seconds only", () => {
			expect(formatElapsed(45_000)).toBe("45s");
		});

		it("formats minutes and seconds", () => {
			expect(formatElapsed(90_000)).toBe("1m 30s");
		});

		it("formats long duration", () => {
			expect(formatElapsed(125_000)).toBe("2m 05s");
		});
	});

	describe("normalizeAutoresearchPath", () => {
		it("normalizes dot to dot", () => {
			expect(normalizeAutoresearchPath(".")).toBe(".");
		});

		it("normalizes dot-slash to dot", () => {
			expect(normalizeAutoresearchPath("./")).toBe(".");
		});

		it("normalizes leading ./", () => {
			expect(normalizeAutoresearchPath("./foo/bar")).toBe("foo/bar");
		});

		it("normalizes trailing slash", () => {
			expect(normalizeAutoresearchPath("foo/bar/")).toBe("foo/bar");
		});

		it("converts backslashes to forward slashes", () => {
			expect(normalizeAutoresearchPath("foo\\bar\\baz")).toBe("foo/bar/baz");
		});

		it("does not collapse multiple leading slashes", () => {
			expect(normalizeAutoresearchPath("///foo")).toBe("///foo");
		});

		it("normalizes multiple trailing slashes", () => {
			expect(normalizeAutoresearchPath("foo///")).toBe("foo");
		});

		it("trims whitespace", () => {
			expect(normalizeAutoresearchPath("  foo/bar  ")).toBe("foo/bar");
		});
	});

	describe("isAutoresearchCommittableFile", () => {
		it("returns true for autoresearch.md", () => {
			expect(isAutoresearchCommittableFile("autoresearch.md")).toBe(true);
		});

		it("returns true for other committable files", () => {
			expect(isAutoresearchCommittableFile("autoresearch.program.md")).toBe(true);
			expect(isAutoresearchCommittableFile("autoresearch.sh")).toBe(true);
			expect(isAutoresearchCommittableFile("autoresearch.checks.sh")).toBe(true);
			expect(isAutoresearchCommittableFile("autoresearch.ideas.md")).toBe(true);
		});

		it("returns false for non-committable files", () => {
			expect(isAutoresearchCommittableFile("README.md")).toBe(false);
			expect(isAutoresearchCommittableFile("src/index.ts")).toBe(false);
		});

		it("normalizes path before checking", () => {
			expect(isAutoresearchCommittableFile("./autoresearch.md")).toBe(true);
		});
	});

	describe("isAutoresearchLocalStatePath", () => {
		it("returns true for local state files", () => {
			expect(isAutoresearchLocalStatePath("autoresearch.jsonl")).toBe(true);
		});

		it("returns true for .autoresearch directory", () => {
			expect(isAutoresearchLocalStatePath(".autoresearch")).toBe(true);
		});

		it("returns true for subpaths of .autoresearch", () => {
			expect(isAutoresearchLocalStatePath(".autoresearch/runs/0001")).toBe(true);
		});

		it("returns false for unrelated paths", () => {
			expect(isAutoresearchLocalStatePath("src/index.ts")).toBe(false);
			expect(isAutoresearchLocalStatePath(".git/config")).toBe(false);
		});
	});

	describe("isAutoresearchShCommand", () => {
		it("accepts direct ./autoresearch.sh", () => {
			expect(isAutoresearchShCommand("./autoresearch.sh")).toBe(true);
		});

		it("accepts bare /path/autoresearch.sh", () => {
			expect(isAutoresearchShCommand("/usr/local/bin/autoresearch.sh")).toBe(true);
		});

		it("accepts with env variables prefix", () => {
			expect(isAutoresearchShCommand("DEBUG=1 ./autoresearch.sh")).toBe(true);
			expect(isAutoresearchShCommand("FOO=bar BAZ=1 ./autoresearch.sh")).toBe(true);
		});

		it("accepts with time prefix", () => {
			expect(isAutoresearchShCommand("time ./autoresearch.sh")).toBe(true);
			expect(isAutoresearchShCommand("time -p ./autoresearch.sh")).toBe(true);
		});

		it("accepts with nohup prefix", () => {
			expect(isAutoresearchShCommand("nohup ./autoresearch.sh")).toBe(true);
		});

		it("rejects when bash -c is present", () => {
			expect(isAutoresearchShCommand("bash -c ./autoresearch.sh")).toBe(false);
		});

		it("rejects when pipe operator present", () => {
			expect(isAutoresearchShCommand("./autoresearch.sh | grep foo")).toBe(false);
		});

		it("rejects when semicolon chain present", () => {
			expect(isAutoresearchShCommand("./autoresearch.sh; echo done")).toBe(false);
		});

		it("rejects non-script files", () => {
			expect(isAutoresearchShCommand("./index.js")).toBe(false);
			expect(isAutoresearchShCommand("./autoresearch.py")).toBe(false);
		});

		it("rejects empty string", () => {
			expect(isAutoresearchShCommand("")).toBe(false);
		});

		it("rejects command with redirect", () => {
			expect(isAutoresearchShCommand("./autoresearch.sh > output.txt")).toBe(false);
		});
	});

	describe("inferMetricUnitFromName", () => {
		it("infers µs from suffix", () => {
			expect(inferMetricUnitFromName("p50_latency_µs")).toBe("µs");
			expect(inferMetricUnitFromName("total_µs")).toBe("µs");
		});

		it("infers ms from suffix", () => {
			expect(inferMetricUnitFromName("response_ms")).toBe("ms");
			expect(inferMetricUnitFromName("latency_ms")).toBe("ms");
		});

		it("infers s from various suffixes", () => {
			expect(inferMetricUnitFromName("elapsed_s")).toBe("s");
			expect(inferMetricUnitFromName("duration_sec")).toBe("s");
			expect(inferMetricUnitFromName("total_secs")).toBe("s");
		});

		it("infers kb from suffix", () => {
			expect(inferMetricUnitFromName("heap_kb")).toBe("kb");
			expect(inferMetricUnitFromName("sizekb")).toBe("kb");
		});

		it("infers mb from suffix", () => {
			expect(inferMetricUnitFromName("memory_mb")).toBe("mb");
			expect(inferMetricUnitFromName("footprintmb")).toBe("mb");
		});

		it("returns empty string for unrecognized names", () => {
			expect(inferMetricUnitFromName("score")).toBe("");
			expect(inferMetricUnitFromName("count")).toBe("");
		});
	});
});
