import { describe, expect, it } from "bun:test";
import { renderDashboardLines } from "../../src/autoresearch/dashboard";
import type {
	AutoresearchRuntime,
	ExperimentResult,
	ExperimentState,
	PendingRunSummary,
} from "../../src/autoresearch/types";
import type { Theme } from "../../src/modes/theme/theme";

// ---------------------------------------------------------------------------
// Mock Theme — implements just the subset used by renderDashboardLines: fg()
// ---------------------------------------------------------------------------
class MockTheme implements Partial<Theme> {
	private colors: Map<string, string> = new Map([
		["accent", "\x1b[34m"],
		["borderMuted", "\x1b[90m"],
		["success", "\x1b[32m"],
		["error", "\x1b[31m"],
		["warning", "\x1b[33m"],
		["muted", "\x1b[90m"],
		["dim", "\x1b[2m"],
	]);

	fg(color: string, text: string): string {
		const ansi = this.colors.get(color) ?? "\x1b[0m";
		return `${ansi}${text}\x1b[0m`;
	}

	get spinnerFrames(): string[] {
		return ["-", "\\", "|", "/"];
	}
}

const theme = new MockTheme() as unknown as Theme;

// ---------------------------------------------------------------------------
// Factories
// ---------------------------------------------------------------------------
function makeResult(overrides: Partial<ExperimentResult> = {}): ExperimentResult {
	return {
		runNumber: 1,
		commit: "abc1234",
		metric: 100,
		metrics: {},
		status: "keep",
		description: "test run",
		timestamp: Date.now(),
		segment: 1,
		confidence: null,
		...overrides,
	};
}

function makePendingSummary(overrides: Partial<PendingRunSummary> = {}): PendingRunSummary {
	return {
		checksDurationSeconds: null,
		checksPass: null,
		checksTimedOut: false,
		command: "foo",
		durationSeconds: null,
		parsedAsi: null,
		parsedMetrics: null,
		parsedPrimary: null,
		passed: false,
		runDirectory: "/tmp",
		runNumber: 1,
		...overrides,
	};
}

function makeState(overrides: Partial<ExperimentState> = {}): ExperimentState {
	return {
		results: [],
		bestMetric: null,
		bestDirection: "lower",
		metricName: "latency",
		metricUnit: "ms",
		secondaryMetrics: [],
		name: null,
		currentSegment: 1,
		maxExperiments: null,
		confidence: null,
		benchmarkCommand: null,
		scopePaths: [],
		offLimits: [],
		constraints: [],
		segmentFingerprint: null,
		...overrides,
	};
}

function makeRuntime(overrides: Partial<AutoresearchRuntime> = {}): AutoresearchRuntime {
	return {
		autoresearchMode: false,
		autoResumeArmed: false,
		dashboardExpanded: false,
		lastAutoResumePendingRunNumber: null,
		lastRunChecks: null,
		lastRunDuration: null,
		lastRunAsi: null,
		lastRunArtifactDir: null,
		lastRunNumber: null,
		lastRunSummary: null,
		runningExperiment: null,
		state: makeState(),
		goal: null,
		...overrides,
	};
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe("renderDashboardLines", () => {
	it("returns an array of strings", () => {
		const runtime = makeRuntime({ autoresearchMode: true });
		const result = renderDashboardLines(runtime, 80, theme, 0);
		expect(Array.isArray(result)).toBe(true);
		expect(result.length).toBeGreaterThan(0);
		for (const line of result) {
			expect(typeof line).toBe("string");
		}
	});

	// --- No results + mode on ---
	it("includes 'Baseline: pending' when mode is on and no results", () => {
		const runtime = makeRuntime({ autoresearchMode: true });
		const result = renderDashboardLines(runtime, 80, theme, 0);
		expect(result.some(l => l.includes("Baseline"))).toBe(true);
	});

	// --- No results + mode off ---
	it("includes 'No experiments' when mode is off and no results", () => {
		const runtime = makeRuntime({ autoresearchMode: false });
		const result = renderDashboardLines(runtime, 80, theme, 0);
		expect(result.some(l => l.includes("No experiments"))).toBe(true);
	});

	// --- Pending run: no results → two lines (run number, then result+metric) ---
	it("includes 'Pending run: #N' when lastRunSummary is set (no results)", () => {
		const runtime = makeRuntime({ lastRunSummary: makePendingSummary({ runNumber: 5 }) });
		const result = renderDashboardLines(runtime, 80, theme, 0);
		expect(result.some(l => l.includes("Pending run"))).toBe(true);
	});

	it("shows passed/failed status in pending run line (no results)", () => {
		// No-results format: "Pending run: #3" on one line, "Result: passed" on another
		const runtime = makeRuntime({ lastRunSummary: makePendingSummary({ passed: true, runNumber: 3 }) });
		const result = renderDashboardLines(runtime, 80, theme, 0);
		expect(result.some(l => l.includes("#3"))).toBe(true);
		expect(result.some(l => l.includes("passed"))).toBe(true);
	});

	it("shows metric value in pending run line when parsedPrimary is present (no results)", () => {
		const runtime = makeRuntime({
			state: makeState({ metricName: "score" }),
			lastRunSummary: makePendingSummary({ parsedPrimary: 0.87, passed: true }),
		});
		const result = renderDashboardLines(runtime, 80, theme, 0);
		expect(result.some(l => l.includes("score") && l.includes("0.87"))).toBe(true);
	});

	// --- With results ---
	it("includes result rows when results exist", () => {
		const runtime = makeRuntime({
			state: makeState({ results: [makeResult({ runNumber: 1, status: "keep", metric: 100 })] }),
		});
		const result = renderDashboardLines(runtime, 80, theme, 0);
		expect(result.some(l => l.includes("100"))).toBe(true);
	});

	it("shows crash status in result row", () => {
		const runtime = makeRuntime({
			state: makeState({
				results: [
					makeResult({ runNumber: 1, status: "keep", metric: 100 }),
					makeResult({ runNumber: 2, status: "crash", metric: 0 }),
				],
			}),
		});
		const result = renderDashboardLines(runtime, 80, theme, 0);
		expect(result.some(l => l.includes("crash"))).toBe(true);
	});

	it("shows checks_failed status in result row", () => {
		const runtime = makeRuntime({
			state: makeState({
				results: [
					makeResult({ runNumber: 1, status: "keep", metric: 100 }),
					makeResult({ runNumber: 2, status: "checks_failed", metric: 0 }),
				],
			}),
		});
		const result = renderDashboardLines(runtime, 80, theme, 0);
		expect(result.some(l => l.includes("checks_failed"))).toBe(true);
	});

	// --- Pending run: with results → single combined line ---
	it("includes pending run combined line when results exist", () => {
		const runtime = makeRuntime({
			state: makeState({ results: [makeResult({ runNumber: 1, status: "keep", metric: 100 })] }),
			lastRunSummary: makePendingSummary({ runNumber: 5, passed: false }),
		});
		const result = renderDashboardLines(runtime, 80, theme, 0);
		expect(result.some(l => l.includes("Pending run") && l.includes("#5"))).toBe(true);
	});

	// --- Archived segments ---
	it("shows archived count when results span multiple segments", () => {
		// 2 results in segment 1, 1 in segment 2 → 2 archived
		const runtime = makeRuntime({
			state: makeState({
				results: [
					makeResult({ runNumber: 1, status: "keep", metric: 100, segment: 1 }),
					makeResult({ runNumber: 2, status: "keep", metric: 95, segment: 1 }),
					makeResult({ runNumber: 3, status: "keep", metric: 90, segment: 2 }),
				],
				currentSegment: 2,
			}),
		});
		const result = renderDashboardLines(runtime, 80, theme, 0);
		expect(result.some(l => l.includes("Archived"))).toBe(true);
	});

	// --- Confidence ---
	it("shows confidence multiplier when state.confidence is set", () => {
		const runtime = makeRuntime({
			state: makeState({
				results: [makeResult({ runNumber: 1, status: "keep", metric: 100 })],
				bestMetric: 100,
				confidence: 2.5,
			}),
		});
		const result = renderDashboardLines(runtime, 80, theme, 0);
		expect(result.some(l => l.includes("conf"))).toBe(true);
	});

	// --- maxRows ---
	it("hides older runs when maxRows limits visible rows", () => {
		const results = Array.from({ length: 5 }, (_, i) =>
			makeResult({ runNumber: i + 1, status: "keep", metric: 100 - i }),
		);
		const runtime = makeRuntime({ state: makeState({ results }) });
		const result = renderDashboardLines(runtime, 80, theme, 3);
		expect(result.some(l => l.includes("earlier"))).toBe(true);
	});

	// --- Mode label ---
	it("shows 'Mode:' when mode is off and results exist", () => {
		const runtime = makeRuntime({
			autoresearchMode: false,
			state: makeState({ results: [makeResult()] }),
		});
		const result = renderDashboardLines(runtime, 80, theme, 0);
		expect(result.some(l => l.includes("Mode:"))).toBe(true);
	});

	it("omits 'Mode:' when mode is on", () => {
		const runtime = makeRuntime({
			autoresearchMode: true,
			state: makeState({ results: [makeResult()] }),
		});
		const result = renderDashboardLines(runtime, 80, theme, 0);
		// No line should start with "Mode:"
		expect(result.every(l => !l.includes("Mode:"))).toBe(true);
	});

	// --- Best result ---
	it("shows best result when better than baseline", () => {
		const runtime = makeRuntime({
			state: makeState({
				results: [makeResult({ runNumber: 1, status: "keep", metric: 90 })],
				bestMetric: 100,
				metricUnit: "ms",
			}),
		});
		const result = renderDashboardLines(runtime, 80, theme, 0);
		expect(result.some(l => l.includes("Best"))).toBe(true);
	});

	// --- Width handling ---
	it("handles zero width gracefully", () => {
		const runtime = makeRuntime({ autoresearchMode: true });
		const result = renderDashboardLines(runtime, 0, theme, 0);
		expect(Array.isArray(result)).toBe(true);
	});

	it("handles very narrow width", () => {
		const runtime = makeRuntime({ autoresearchMode: true });
		const result = renderDashboardLines(runtime, 10, theme, 0);
		expect(Array.isArray(result)).toBe(true);
	});
});
