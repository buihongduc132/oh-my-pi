import { describe, expect, it } from "bun:test";
import { ThinkingLevel } from "@oh-my-pi/pi-agent-core/thinking";

describe("ThinkingLevel", () => {
	it("exports Inherit", () => {
		expect(String(ThinkingLevel.Inherit)).toBe("inherit");
	});

	it("exports Off", () => {
		expect(String(ThinkingLevel.Off)).toBe("off");
	});

	it("maps Effort.Minimal", () => {
		expect(String(ThinkingLevel.Minimal)).toBe("minimal");
	});

	it("maps Effort.Low", () => {
		expect(String(ThinkingLevel.Low)).toBe("low");
	});

	it("maps Effort.Medium", () => {
		expect(String(ThinkingLevel.Medium)).toBe("medium");
	});

	it("maps Effort.High", () => {
		expect(String(ThinkingLevel.High)).toBe("high");
	});

	it("maps Effort.XHigh", () => {
		expect(String(ThinkingLevel.XHigh)).toBe("xhigh");
	});

	it("all keys map to string values", () => {
		for (const [key, value] of Object.entries(ThinkingLevel)) {
			expect(typeof key).toBe("string");
			expect(typeof value).toBe("string");
		}
	});

	it("Inherit is different from Off", () => {
		expect(ThinkingLevel.Inherit).not.toBe(ThinkingLevel.Off);
	});

	it("Off is different from Minimal", () => {
		expect(ThinkingLevel.Off).not.toBe(ThinkingLevel.Minimal);
	});
});
