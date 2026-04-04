import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { $env, $pickenv } from "@oh-my-pi/pi-utils";

// ---------------------------------------------------------------------------
// $env
// ---------------------------------------------------------------------------

describe("$env", () => {
	it("is a Record<string, string>", () => {
		expect(typeof $env).toBe("object");
		expect($env).not.toBeNull();
		// Verify it's a plain object (no Array methods, etc.)
		expect(Array.isArray($env)).toBe(false);
	});

	it("has string values for standard env vars", () => {
		// PATH always exists in a Node/Bun environment
		if ($env.PATH !== undefined) {
			expect(typeof $env.PATH).toBe("string");
		}
	});

	it("contains entries", () => {
		const keys = Object.keys($env);
		expect(keys.length).toBeGreaterThan(0);
	});

	it("all values are strings", () => {
		for (const [_key, value] of Object.entries($env)) {
			expect(typeof value).toBe("string");
		}
	});
});

// ---------------------------------------------------------------------------
// $pickenv
// ---------------------------------------------------------------------------

describe("$pickenv", () => {
	// Save and restore relevant env vars
	const originals: Record<string, string | undefined> = {};

	beforeEach(() => {
		originals.TEST_VAR_A = process.env.TEST_VAR_A;
		originals.TEST_VAR_B = process.env.TEST_VAR_B;
		originals.TEST_VAR_C = process.env.TEST_VAR_C;
		delete process.env.TEST_VAR_A;
		delete process.env.TEST_VAR_B;
		delete process.env.TEST_VAR_C;
	});

	afterEach(() => {
		for (const [key, val] of Object.entries(originals)) {
			if (val === undefined) {
				delete process.env[key];
			} else {
				process.env[key] = val;
			}
		}
	});

	it("returns first defined key's value", () => {
		process.env.TEST_VAR_A = "value-a";
		process.env.TEST_VAR_B = "value-b";
		const result = $pickenv("TEST_VAR_A", "TEST_VAR_B", "TEST_VAR_C");
		expect(result).toBe("value-a");
	});

	it("skips undefined and returns next defined key", () => {
		process.env.TEST_VAR_B = "value-b";
		const result = $pickenv("TEST_VAR_A", "TEST_VAR_B", "TEST_VAR_C");
		expect(result).toBe("value-b");
	});

	it("skips empty string", () => {
		process.env.TEST_VAR_A = "";
		process.env.TEST_VAR_B = "value-b";
		const result = $pickenv("TEST_VAR_A", "TEST_VAR_B");
		expect(result).toBe("value-b");
	});

	it("skips whitespace-only string", () => {
		process.env.TEST_VAR_A = "   ";
		process.env.TEST_VAR_B = "value-b";
		const result = $pickenv("TEST_VAR_A", "TEST_VAR_B");
		expect(result).toBe("value-b");
	});

	it("trims whitespace from value", () => {
		process.env.TEST_VAR_A = "  value  ";
		const result = $pickenv("TEST_VAR_A");
		expect(result).toBe("value");
	});

	it("returns undefined when no keys are defined", () => {
		const result = $pickenv("TEST_VAR_A", "TEST_VAR_B", "TEST_VAR_C");
		expect(result).toBeUndefined();
	});

	it("returns undefined when all values are empty strings", () => {
		process.env.TEST_VAR_A = "";
		process.env.TEST_VAR_B = "";
		const result = $pickenv("TEST_VAR_A", "TEST_VAR_B");
		expect(result).toBeUndefined();
	});

	it("handles single key", () => {
		process.env.TEST_VAR_A = "only-one";
		const result = $pickenv("TEST_VAR_A");
		expect(result).toBe("only-one");
	});

	it("handles multiple keys with no matches", () => {
		const result = $pickenv("DOES_NOT_EXIST_1", "DOES_NOT_EXIST_2");
		expect(result).toBeUndefined();
	});

	it("returns value even when key name is falsy-looking", () => {
		process.env.TEST_VAR_A = "zero";
		// 0 is a valid env value
		const val = $pickenv("TEST_VAR_A");
		expect(val).toBe("zero");
	});
});
