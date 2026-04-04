import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import {
	cloneExperimentState,
	computeConfidence,
	createExperimentState,
	createRuntimeStore,
	createSessionRuntime,
	currentResults,
	findBaselineMetric,
	findBaselineResult,
	findBestKeptMetric,
	reconstructControlState,
	reconstructStateFromJsonl,
	sortedMedian,
} from "../../src/autoresearch/state";
import type { ExperimentResult, MetricDirection } from "../../src/autoresearch/types";
import type { SessionEntry } from "../../src/session/session-manager";

function makeResult(overrides: Partial<ExperimentResult> = {}): ExperimentResult {
	return {
		runNumber: null,
		commit: "",
		metric: 0,
		metrics: {},
		status: "keep",
		description: "",
		timestamp: 1000,
		segment: 0,
		confidence: null,
		...overrides,
	};
}

function makeCustomEntry(customType: string, data: unknown): SessionEntry {
	return {
		type: "custom",
		id: `id-${Math.random().toString(36).slice(2)}`,
		parentId: null,
		timestamp: new Date().toISOString(),
		customType,
		data,
	};
}

describe("createExperimentState", () => {
	it("returns correct shape with all fields", () => {
		const state = createExperimentState();

		expect(state).toEqual({
			results: [],
			bestMetric: null,
			bestDirection: "lower",
			metricName: "metric",
			metricUnit: "",
			secondaryMetrics: [],
			name: null,
			currentSegment: 0,
			maxExperiments: null,
			confidence: null,
			benchmarkCommand: null,
			scopePaths: [],
			offLimits: [],
			constraints: [],
			segmentFingerprint: null,
		});
	});
});

describe("createSessionRuntime", () => {
	it("returns correct shape", () => {
		const runtime = createSessionRuntime();

		expect(runtime.autoresearchMode).toBe(false);
		expect(runtime.autoResumeArmed).toBe(false);
		expect(runtime.dashboardExpanded).toBe(false);
		expect(runtime.lastAutoResumePendingRunNumber).toBe(null);
		expect(runtime.lastRunChecks).toBe(null);
		expect(runtime.lastRunDuration).toBe(null);
		expect(runtime.lastRunAsi).toBe(null);
		expect(runtime.lastRunArtifactDir).toBe(null);
		expect(runtime.lastRunNumber).toBe(null);
		expect(runtime.lastRunSummary).toBe(null);
		expect(runtime.runningExperiment).toBe(null);
		expect(runtime.goal).toBe(null);
		expect(runtime.state).toEqual(createExperimentState());
	});
});

describe("cloneExperimentState", () => {
	it("returns a deep copy", () => {
		const original = createExperimentState();
		original.results = [
			makeResult({
				runNumber: 1,
				metric: 42,
				metrics: { accuracy: 0.99 },
				segment: 0,
				status: "keep",
			}),
			makeResult({
				runNumber: 2,
				metric: 38,
				metrics: { accuracy: 0.98 },
				segment: 0,
				status: "keep",
			}),
		];
		original.secondaryMetrics = [{ name: "accuracy", unit: "" }];
		original.scopePaths = ["./src"];
		original.offLimits = ["./node_modules"];
		original.constraints = ["must pass tests"];

		const clone = cloneExperimentState(original);

		// Top-level fields are copied
		expect(clone.results).not.toBe(original.results);
		expect(clone.secondaryMetrics).not.toBe(original.secondaryMetrics);
		expect(clone.scopePaths).not.toBe(original.scopePaths);
		expect(clone.offLimits).not.toBe(original.offLimits);
		expect(clone.constraints).not.toBe(original.constraints);

		// Result objects are deeply cloned
		expect(clone.results[0]).not.toBe(original.results[0]);
		expect(clone.results[0].metrics).not.toBe(original.results[0].metrics);
		expect(clone.results[1].metrics).not.toBe(original.results[1].metrics);

		// Values are correct
		expect(clone.results[0].metric).toBe(42);
		expect(clone.results[0].metrics.accuracy).toBe(0.99);
		expect(clone.results[1].metric).toBe(38);

		// Mutating original does not affect clone
		original.results[0].metric = 999;
		original.results[0].metrics.accuracy = 1.0;
		original.secondaryMetrics = [];
		original.scopePaths = [];
		original.offLimits = [];
		original.constraints = [];

		expect(clone.results[0].metric).toBe(42);
		expect(clone.results[0].metrics.accuracy).toBe(0.99);
		expect(clone.secondaryMetrics).toEqual([{ name: "accuracy", unit: "" }]);
		expect(clone.scopePaths).toEqual(["./src"]);
		expect(clone.offLimits).toEqual(["./node_modules"]);
		expect(clone.constraints).toEqual(["must pass tests"]);
	});

	it("handles results with undefined asi", () => {
		const original = createExperimentState();
		original.results = [makeResult({ metric: 1, status: "keep", asi: undefined })];

		const clone = cloneExperimentState(original);
		expect(clone.results[0].asi).toBeUndefined();
	});

	it("handles results with defined asi", () => {
		const original = createExperimentState();
		original.results = [
			makeResult({
				metric: 1,
				status: "keep",
				asi: { model: "gpt-4", tokens: 123 },
			}),
		];

		const clone = cloneExperimentState(original);
		expect(clone.results[0].asi).toEqual({ model: "gpt-4", tokens: 123 });
		expect(clone.results[0].asi).not.toBe(original.results[0].asi);
	});
});

describe("currentResults", () => {
	it("filters by segment number", () => {
		const results: ExperimentResult[] = [
			makeResult({ metric: 1, segment: 0, status: "keep" }),
			makeResult({ metric: 2, segment: 1, status: "keep" }),
			makeResult({ metric: 3, segment: 0, status: "keep" }),
			makeResult({ metric: 4, segment: 2, status: "keep" }),
			makeResult({ metric: 5, segment: 1, status: "keep" }),
		];

		expect(currentResults(results, 0)).toHaveLength(2);
		expect(currentResults(results, 0).map(r => r.metric)).toEqual([1, 3]);
		expect(currentResults(results, 1)).toHaveLength(2);
		expect(currentResults(results, 1).map(r => r.metric)).toEqual([2, 5]);
		expect(currentResults(results, 2)).toHaveLength(1);
		expect(currentResults(results, 99)).toHaveLength(0);
	});
});

describe("findBaselineResult", () => {
	it("finds baseline (status=keep) result", () => {
		const results: ExperimentResult[] = [
			makeResult({ metric: 1, segment: 0, status: "discard" }),
			makeResult({ metric: 2, segment: 0, status: "keep" }),
			makeResult({ metric: 3, segment: 0, status: "crash" }),
			makeResult({ metric: 4, segment: 1, status: "keep" }),
		];

		expect(findBaselineResult(results, 0)).not.toBeNull();
		expect(findBaselineResult(results, 0)!.metric).toBe(2);
		expect(findBaselineResult(results, 1)).not.toBeNull();
		expect(findBaselineResult(results, 1)!.metric).toBe(4);
	});

	it("returns null when no baseline found", () => {
		expect(findBaselineResult([], 0)).toBeNull();
		const results: ExperimentResult[] = [makeResult({ metric: 1, segment: 0, status: "discard" })];
		expect(findBaselineResult(results, 0)).toBeNull();
	});
});

describe("findBaselineMetric", () => {
	it("returns metric number or null", () => {
		const results: ExperimentResult[] = [
			makeResult({ metric: 10, segment: 0, status: "keep" }),
			makeResult({ metric: 5, segment: 0, status: "discard" }),
		];
		expect(findBaselineMetric(results, 0)).toBe(10);
		expect(findBaselineMetric(results, 1)).toBeNull();
		expect(findBaselineMetric([], 0)).toBeNull();
	});
});

describe("findBestKeptMetric", () => {
	const cases: Array<[string, MetricDirection, number[], number]> = [
		["lower: minimum wins", "lower", [5, 2, 8, 1], 1],
		["higher: maximum wins", "higher", [5, 2, 8, 1], 8],
		["lower: single result", "lower", [42], 42],
		["higher: single result", "higher", [42], 42],
		["lower: equal values", "lower", [3, 3, 3], 3],
	];

	for (const [label, direction, metrics, expected] of cases) {
		it(label, () => {
			const results: ExperimentResult[] = metrics.map(m => makeResult({ metric: m, segment: 0, status: "keep" }));
			expect(findBestKeptMetric(results, 0, direction)).toBe(expected);
		});
	}

	it("skips non-keep results", () => {
		const results: ExperimentResult[] = [
			makeResult({ metric: 10, segment: 0, status: "discard" }),
			makeResult({ metric: 5, segment: 0, status: "keep" }),
			makeResult({ metric: 1, segment: 0, status: "crash" }),
		];
		expect(findBestKeptMetric(results, 0, "lower")).toBe(5);
	});

	it("returns null for empty results", () => {
		expect(findBestKeptMetric([], 0, "lower")).toBeNull();
	});

	it("returns null when no kept results", () => {
		const results: ExperimentResult[] = [makeResult({ metric: 10, segment: 0, status: "discard" })];
		expect(findBestKeptMetric(results, 0, "lower")).toBeNull();
	});
});

describe("sortedMedian", () => {
	it("handles empty array", () => {
		expect(sortedMedian([])).toBe(0);
	});

	it("handles single element", () => {
		expect(sortedMedian([7])).toBe(7);
	});

	it("handles odd length array", () => {
		expect(sortedMedian([3, 1, 2])).toBe(2);
		expect(sortedMedian([10, 20, 30, 40, 50])).toBe(30);
	});

	it("handles even length array", () => {
		expect(sortedMedian([1, 2, 3, 4])).toBe(2.5);
		expect(sortedMedian([10, 20, 30, 40])).toBe(25);
	});

	it("handles negative numbers", () => {
		expect(sortedMedian([-5, -1, -3])).toBe(-3);
		expect(sortedMedian([-10, -5, 0, 5])).toBe(-2.5);
	});

	it("handles duplicate values", () => {
		expect(sortedMedian([5, 5, 5, 5])).toBe(5);
		expect(sortedMedian([5, 5, 5])).toBe(5);
	});

	it("does not mutate the input array", () => {
		const input = [3, 1, 2];
		sortedMedian(input);
		expect(input).toEqual([3, 1, 2]);
	});
});

describe("computeConfidence", () => {
	function makeKeepResult(metric: number, segment: number = 0): ExperimentResult {
		return makeResult({ metric, segment, status: "keep" });
	}

	it("returns null when fewer than 3 results", () => {
		expect(computeConfidence([makeKeepResult(1)], 0, "lower")).toBeNull();
		expect(computeConfidence([makeKeepResult(1), makeKeepResult(2)], 0, "lower")).toBeNull();
	});

	it("returns null when no baseline exists", () => {
		const results: ExperimentResult[] = [makeKeepResult(1), makeKeepResult(2), makeKeepResult(3)];
		expect(computeConfidence(results, 0, "lower")).toBeNull();
	});

	it("returns null when mad is zero", () => {
		// All results have same value → mad = 0
		const results: ExperimentResult[] = [
			makeResult({ metric: 5, segment: 0, status: "keep" }),
			makeResult({ metric: 5, segment: 0, status: "keep" }),
			makeResult({ metric: 5, segment: 0, status: "keep" }),
		];
		expect(computeConfidence(results, 0, "lower")).toBeNull();
	});

	it("returns null when best kept equals baseline", () => {
		// Baseline (first keep) and best kept are the same
		const results: ExperimentResult[] = [
			makeResult({ metric: 5, segment: 0, status: "keep" }),
			makeResult({ metric: 5, segment: 0, status: "keep" }),
			makeResult({ metric: 5, segment: 0, status: "keep" }),
			makeResult({ metric: 5, segment: 0, status: "keep" }),
		];
		expect(computeConfidence(results, 0, "lower")).toBeNull();
	});

	it("returns null when no kept results besides baseline", () => {
		const results: ExperimentResult[] = [
			makeResult({ metric: 10, segment: 0, status: "keep" }),
			makeResult({ metric: 5, segment: 0, status: "discard" }),
			makeResult({ metric: 5, segment: 0, status: "crash" }),
		];
		expect(computeConfidence(results, 0, "lower")).toBeNull();
	});

	it("returns null when best kept is worse than baseline (lower direction)", () => {
		const results: ExperimentResult[] = [
			makeResult({ metric: 10, segment: 0, status: "keep" }), // baseline
			makeResult({ metric: 15, segment: 0, status: "keep" }), // worse (higher)
			makeResult({ metric: 12, segment: 0, status: "keep" }),
		];
		expect(computeConfidence(results, 0, "lower")).toBeNull();
	});

	it("returns null when best kept is worse than baseline (higher direction)", () => {
		const results: ExperimentResult[] = [
			makeResult({ metric: 50, segment: 0, status: "keep" }), // baseline
			makeResult({ metric: 30, segment: 0, status: "keep" }), // worse (lower)
			makeResult({ metric: 40, segment: 0, status: "keep" }),
		];
		expect(computeConfidence(results, 0, "higher")).toBeNull();
	});

	it("returns null when results have metric <= 0", () => {
		const results: ExperimentResult[] = [
			makeResult({ metric: 0, segment: 0, status: "keep" }),
			makeResult({ metric: 0, segment: 0, status: "keep" }),
			makeResult({ metric: 0, segment: 0, status: "keep" }),
		];
		expect(computeConfidence(results, 0, "lower")).toBeNull();
	});

	it("computes a confidence value when conditions are met", () => {
		// Baseline = 10, best kept = 5 (lower direction: better)
		const results: ExperimentResult[] = [
			makeResult({ metric: 10, segment: 0, status: "keep" }), // baseline
			makeResult({ metric: 5, segment: 0, status: "keep" }), // best kept
			makeResult({ metric: 7, segment: 0, status: "keep" }),
			makeResult({ metric: 9, segment: 0, status: "keep" }),
		];
		const confidence = computeConfidence(results, 0, "lower");
		expect(confidence).not.toBeNull();
		expect(typeof confidence).toBe("number");
		expect(confidence!).toBeGreaterThan(0);
	});

	it("uses segment-specific results", () => {
		// Segment 0: only 1 result → null (needs ≥3)
		// Segment 1: 3 results; best kept (4) ≠ baseline (5) → computes confidence
		const results: ExperimentResult[] = [
			makeResult({ metric: 10, segment: 0, status: "keep" }),
			makeResult({ metric: 5, segment: 1, status: "keep" }), // baseline for segment 1
			makeResult({ metric: 4, segment: 1, status: "keep" }), // best kept (lower direction)
			makeResult({ metric: 6, segment: 1, status: "keep" }),
		];
		expect(computeConfidence(results, 0, "lower")).toBeNull();
		expect(computeConfidence(results, 1, "lower")).not.toBeNull();
	});
});

describe("reconstructStateFromJsonl", () => {
	let tmpDir: string;

	beforeEach(() => {
		tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "state-test-"));
	});

	afterEach(() => {
		fs.rmSync(tmpDir, { recursive: true, force: true });
	});

	it("handles non-existent directory", () => {
		const result = reconstructStateFromJsonl("/nonexistent/path/that/does/not/exist");
		expect(result.hasLog).toBe(false);
		expect(result.state.results).toEqual([]);
		expect(result.state.currentSegment).toBe(0);
	});

	it("handles directory without autoresearch.jsonl", () => {
		fs.mkdirSync(path.join(tmpDir, ".autoresearch"), { recursive: true });

		const result = reconstructStateFromJsonl(tmpDir);
		expect(result.hasLog).toBe(false);
		expect(result.state.results).toEqual([]);
	});

	it("parses empty JSONL file", () => {
		fs.writeFileSync(path.join(tmpDir, "autoresearch.jsonl"), "\n\n\n", "utf8");

		const result = reconstructStateFromJsonl(tmpDir);
		expect(result.hasLog).toBe(true);
		expect(result.state.results).toEqual([]);
	});

	it("parses a valid config entry", () => {
		const configLine = JSON.stringify({
			type: "config",
			name: "my-experiment",
			metricName: "latency",
			metricUnit: "ms",
			bestDirection: "lower",
			benchmarkCommand: "make bench",
			secondaryMetrics: ["throughput", "memory_kb"],
			scopePaths: ["./src"],
			offLimits: ["./tests"],
			constraints: ["no regressions"],
			segmentFingerprint: "abc123",
		});
		fs.writeFileSync(path.join(tmpDir, "autoresearch.jsonl"), `${configLine}\n`, "utf8");

		const result = reconstructStateFromJsonl(tmpDir);
		expect(result.state.name).toBe("my-experiment");
		expect(result.state.metricName).toBe("latency");
		expect(result.state.metricUnit).toBe("ms");
		expect(result.state.bestDirection).toBe("lower");
		expect(result.state.benchmarkCommand).toBe("make bench");
		expect(result.state.scopePaths).toEqual(["src"]);
		expect(result.state.offLimits).toEqual(["tests"]);
		expect(result.state.constraints).toEqual(["no regressions"]);
		expect(result.state.segmentFingerprint).toBe("abc123");
	});

	it("parses valid run entries", () => {
		const lines = [
			`${JSON.stringify({ type: "config", metricName: "score", bestDirection: "higher" })}\n`,
			`${JSON.stringify({ run: 1, metric: 10, status: "keep", commit: "abc", timestamp: 1000 })}\n`,
			`${JSON.stringify({ run: 2, metric: 8, status: "keep", commit: "def", timestamp: 2000 })}\n`,
			`${JSON.stringify({ run: 3, metric: 0, status: "discard", commit: "ghi", timestamp: 3000 })}\n`,
		];
		fs.writeFileSync(path.join(tmpDir, "autoresearch.jsonl"), lines.join(""), "utf8");

		const result = reconstructStateFromJsonl(tmpDir);
		expect(result.hasLog).toBe(true);
		expect(result.state.results).toHaveLength(3);
		expect(result.state.results[0]).toMatchObject({ runNumber: 1, metric: 10, status: "keep", commit: "abc" });
		expect(result.state.results[1]).toMatchObject({ runNumber: 2, metric: 8, status: "keep", commit: "def" });
		expect(result.state.results[2]).toMatchObject({ runNumber: 3, metric: 0, status: "discard" });
	});

	it("skips malformed JSON lines", () => {
		const lines = [
			`${JSON.stringify({ type: "config", metricName: "score", bestDirection: "higher" })}\n`,
			"this is not json\n",
			`${JSON.stringify({ run: 1, metric: 5, status: "keep" })}\n`,
			"",
		];
		fs.writeFileSync(path.join(tmpDir, "autoresearch.jsonl"), lines.join(""), "utf8");

		const result = reconstructStateFromJsonl(tmpDir);
		expect(result.state.results).toHaveLength(1);
		expect(result.state.results[0].metric).toBe(5);
	});

	it("increments segment on second config entry", () => {
		const lines = [
			`${JSON.stringify({ type: "config", metricName: "score", bestDirection: "higher" })}\n`,
			`${JSON.stringify({ run: 1, metric: 5, status: "keep" })}\n`,
			`${JSON.stringify({ run: 2, metric: 6, status: "keep" })}\n`,
			`${JSON.stringify({ type: "config", metricName: "score", bestDirection: "higher" })}\n`,
			`${JSON.stringify({ run: 3, metric: 7, status: "keep" })}\n`,
		];
		fs.writeFileSync(path.join(tmpDir, "autoresearch.jsonl"), lines.join(""), "utf8");

		const result = reconstructStateFromJsonl(tmpDir);
		expect(result.state.results).toHaveLength(3);
		// First two runs are segment 0, third run is segment 1
		expect(result.state.results[0].segment).toBe(0);
		expect(result.state.results[1].segment).toBe(0);
		expect(result.state.results[2].segment).toBe(1);
	});

	it("handles run entries with numeric metrics and metrics map", () => {
		const lines = [
			`${JSON.stringify({
				run: 1,
				metric: 42.5,
				metrics: { accuracy: 0.95, memory_kb: 1024 },
				status: "keep",
				commit: "abc",
				timestamp: 1000,
				confidence: 2.5,
				asi: { model: "test-model" },
			})}\n`,
		];
		fs.writeFileSync(path.join(tmpDir, "autoresearch.jsonl"), lines.join(""), "utf8");

		const result = reconstructStateFromJsonl(tmpDir);
		expect(result.state.results[0].metric).toBe(42.5);
		expect(result.state.results[0].metrics).toEqual({ accuracy: 0.95, memory_kb: 1024 });
		expect(result.state.results[0].confidence).toBe(2.5);
		expect(result.state.results[0].asi).toEqual({ model: "test-model" });
	});

	it("guards against prototype pollution in metrics keys", () => {
		const lines = [
			`${JSON.stringify({
				run: 1,
				metric: 5,
				metrics: {
					good_metric: 1,
					__proto__: { foo: "attack" },
					constructor: { prototype: "attack" },
					prototype: { bar: "attack" },
				},
				status: "keep",
			})}\n`,
		];
		fs.writeFileSync(path.join(tmpDir, "autoresearch.jsonl"), lines.join(""), "utf8");

		const result = reconstructStateFromJsonl(tmpDir);
		// Prototype pollution keys should be ignored; good_metric should be present
		expect(result.state.results[0].metrics.good_metric).toBe(1);
		// Use Object.hasOwn to avoid prototype-chain shadowing from Bun's JSON parser
		expect(Object.hasOwn(result.state.results[0].metrics, "__proto__")).toBe(false);
		expect(Object.hasOwn(result.state.results[0].metrics, "constructor")).toBe(false);
		expect(Object.hasOwn(result.state.results[0].metrics, "prototype")).toBe(false);
	});
});

describe("reconstructControlState", () => {
	it("extracts mode and goal from session entries", () => {
		const entries: SessionEntry[] = [
			makeCustomEntry("autoresearch-control", { mode: "on", goal: "improve latency" }),
			makeCustomEntry("other-type", {}),
		];

		const result = reconstructControlState(entries);
		expect(result.autoresearchMode).toBe(true);
		expect(result.goal).toBe("improve latency");
		expect(result.lastMode).toBe("on");
	});

	it("returns false when no control entries", () => {
		const entries: SessionEntry[] = [makeCustomEntry("other-type", {})];
		const result = reconstructControlState(entries);
		expect(result.autoresearchMode).toBe(false);
		expect(result.goal).toBeNull();
		expect(result.lastMode).toBeNull();
	});

	it("handles mode=off", () => {
		const entries: SessionEntry[] = [makeCustomEntry("autoresearch-control", { mode: "off" })];
		const result = reconstructControlState(entries);
		expect(result.autoresearchMode).toBe(false);
		expect(result.lastMode).toBe("off");
	});

	it("handles mode=clear and nulls the goal", () => {
		const entries: SessionEntry[] = [
			makeCustomEntry("autoresearch-control", { mode: "on", goal: "old goal" }),
			makeCustomEntry("autoresearch-control", { mode: "clear" }),
		];

		const result = reconstructControlState(entries);
		expect(result.autoresearchMode).toBe(false);
		expect(result.goal).toBeNull();
		expect(result.lastMode).toBe("clear");
	});

	it("ignores entries with invalid mode", () => {
		const entries: SessionEntry[] = [
			makeCustomEntry("autoresearch-control", { mode: "invalid" as "on" | "off" | "clear" }),
			makeCustomEntry("autoresearch-control", { mode: "on", goal: "valid goal" }),
		];

		const result = reconstructControlState(entries);
		expect(result.goal).toBe("valid goal");
		expect(result.lastMode).toBe("on");
	});

	it("ignores entries with empty/whitespace goal", () => {
		const entries: SessionEntry[] = [
			makeCustomEntry("autoresearch-control", { mode: "on", goal: "  " }),
			makeCustomEntry("autoresearch-control", { mode: "on", goal: "" }),
			makeCustomEntry("autoresearch-control", { mode: "on", goal: "actual goal" }),
		];

		const result = reconstructControlState(entries);
		expect(result.goal).toBe("actual goal");
	});

	it("keeps the first non-empty goal when multiple entries", () => {
		const entries: SessionEntry[] = [
			makeCustomEntry("autoresearch-control", { mode: "on", goal: "first goal" }),
			makeCustomEntry("autoresearch-control", { mode: "on", goal: "second goal" }),
		];

		const result = reconstructControlState(entries);
		expect(result.goal).toBe("second goal");
	});

	it("ignores non-custom entries", () => {
		const entries: SessionEntry[] = [
			{
				type: "message",
				id: "msg-1",
				parentId: null,
				timestamp: new Date().toISOString(),
				message: { role: "user", content: { type: "text", text: "hello" } },
			} as unknown as SessionEntry,
		];

		const result = reconstructControlState(entries);
		expect(result.autoresearchMode).toBe(false);
		expect(result.goal).toBeNull();
	});
});

describe("createRuntimeStore", () => {
	it("clear removes a runtime", () => {
		const store = createRuntimeStore();
		const runtime1 = store.ensure("session-1");
		const runtime2 = store.ensure("session-1");
		expect(runtime1).toBe(runtime2); // same instance

		store.clear("session-1");
		const runtime3 = store.ensure("session-1");
		expect(runtime3).not.toBe(runtime1); // new instance after clear
		expect(runtime3).toEqual(createSessionRuntime());
	});

	it("ensure returns existing runtime for same key", () => {
		const store = createRuntimeStore();
		const runtime1 = store.ensure("session-a");
		const runtime2 = store.ensure("session-a");
		const runtime3 = store.ensure("session-b");

		expect(runtime1).toBe(runtime2);
		expect(runtime1).not.toBe(runtime3);
	});

	it("clear/ensure/get operations are independent across keys", () => {
		const store = createRuntimeStore();

		const r1 = store.ensure("key-1");
		const r2 = store.ensure("key-2");

		store.clear("key-1");

		const r3 = store.ensure("key-1");
		const r4 = store.ensure("key-2");

		expect(r3).not.toBe(r1);
		expect(r4).toBe(r2);
	});

	it("clear is idempotent (clearing non-existent key does not throw)", () => {
		const store = createRuntimeStore();
		expect(() => store.clear("nonexistent")).not.toThrow();
	});
});
