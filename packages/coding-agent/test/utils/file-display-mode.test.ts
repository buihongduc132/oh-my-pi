import { describe, expect, it } from "bun:test";
import { resolveFileDisplayMode } from "@oh-my-pi/pi-coding-agent/utils/file-display-mode";

function makeSettings(overrides: Record<string, unknown> = {}): { get: (key: string) => unknown } {
	return {
		get: (key: string) => {
			if (key in overrides) return overrides[key];
			return undefined;
		},
	};
}

describe("resolveFileDisplayMode", () => {
	describe("hashLines", () => {
		it("returns hashLines: false when hasEditTool is false", () => {
			const session = { hasEditTool: false, settings: makeSettings() };
			const result = resolveFileDisplayMode(session);
			expect(result.hashLines).toBe(false);
		});

		it("returns hashLines: true when readHashLines setting is true", () => {
			const session = { hasEditTool: true, settings: makeSettings({ readHashLines: true }) };
			const result = resolveFileDisplayMode(session);
			expect(result.hashLines).toBe(true);
		});

		it("returns hashLines: true when edit.mode setting is 'hashline'", () => {
			const session = { hasEditTool: true, settings: makeSettings({ "edit.mode": "hashline" }) };
			const result = resolveFileDisplayMode(session);
			expect(result.hashLines).toBe(true);
		});

		it("returns hashLines: false when no hashline setting is true", () => {
			const session = { hasEditTool: true, settings: makeSettings() };
			const result = resolveFileDisplayMode(session);
			expect(result.hashLines).toBe(false);
		});

		it("returns hashLines: false when hasEditTool is true but edit.mode is 'unified'", () => {
			const session = { hasEditTool: true, settings: makeSettings({ "edit.mode": "unified" }) };
			const result = resolveFileDisplayMode(session);
			expect(result.hashLines).toBe(false);
		});
	});

	describe("lineNumbers", () => {
		it("returns lineNumbers: true when hashLines is true", () => {
			const session = { hasEditTool: true, settings: makeSettings({ readHashLines: true }) };
			const result = resolveFileDisplayMode(session);
			expect(result.lineNumbers).toBe(true);
		});

		it("returns lineNumbers: true when readLineNumbers setting is true and hashLines is false", () => {
			const session = { hasEditTool: true, settings: makeSettings({ readLineNumbers: true }) };
			const result = resolveFileDisplayMode(session);
			expect(result.lineNumbers).toBe(true);
		});

		it("returns lineNumbers: false when neither hashLines nor readLineNumbers is set", () => {
			const session = { hasEditTool: true, settings: makeSettings() };
			const result = resolveFileDisplayMode(session);
			expect(result.lineNumbers).toBe(false);
		});
	});

	describe("hasEditTool default", () => {
		it("defaults hasEditTool to true when not provided", () => {
			const session = { settings: makeSettings({ readHashLines: true }) };
			const result = resolveFileDisplayMode(session);
			expect(result.hashLines).toBe(true);
		});
	});

	describe("combined scenarios", () => {
		it("returns both flags true when hashline is active", () => {
			const session = { hasEditTool: true, settings: makeSettings({ readHashLines: true }) };
			const result = resolveFileDisplayMode(session);
			expect(result).toEqual({ hashLines: true, lineNumbers: true });
		});

		it("returns lineNumbers-only mode (no hashlines)", () => {
			const session = { hasEditTool: true, settings: makeSettings({ readLineNumbers: true }) };
			const result = resolveFileDisplayMode(session);
			expect(result).toEqual({ hashLines: false, lineNumbers: true });
		});

		it("hashLines: false regardless of readLineNumbers when hasEditTool is false", () => {
			// hashLines is suppressed in explore/agent mode (no edit tool)
			const session = { hasEditTool: false, settings: makeSettings({ readLineNumbers: true }) };
			const result = resolveFileDisplayMode(session);
			expect(result.hashLines).toBe(false);
			// lineNumbers: true because readLineNumbers is set, even without the edit tool
			expect(result.lineNumbers).toBe(true);
		});
	});
});
