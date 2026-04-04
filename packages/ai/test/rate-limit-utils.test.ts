import { describe, expect, it } from "bun:test";
import { calculateRateLimitBackoffMs, isUsageLimitError, parseRateLimitReason } from "@oh-my-pi/pi-ai/rate-limit-utils";

describe("parseRateLimitReason", () => {
	it("returns MODEL_CAPACITY_EXHAUSTED for capacity/overloaded", () => {
		expect(parseRateLimitReason("model overloaded")).toBe("MODEL_CAPACITY_EXHAUSTED");
		expect(parseRateLimitReason("server at capacity")).toBe("MODEL_CAPACITY_EXHAUSTED");
	});

	it("returns MODEL_CAPACITY_EXHAUSTED for 529/503 status", () => {
		expect(parseRateLimitReason("error 529")).toBe("MODEL_CAPACITY_EXHAUSTED");
		expect(parseRateLimitReason("status 503")).toBe("MODEL_CAPACITY_EXHAUSTED");
	});

	it("returns MODEL_CAPACITY_EXHAUSTED for 'resource exhausted'", () => {
		expect(parseRateLimitReason("resource exhausted")).toBe("MODEL_CAPACITY_EXHAUSTED");
	});

	it("returns RATE_LIMIT_EXCEEDED for per minute limits", () => {
		expect(parseRateLimitReason("rate limit per minute exceeded")).toBe("RATE_LIMIT_EXCEEDED");
	});

	it("returns RATE_LIMIT_EXCEEDED for 'too many requests'", () => {
		expect(parseRateLimitReason("too many requests")).toBe("RATE_LIMIT_EXCEEDED");
	});

	it("returns QUOTA_EXHAUSTED for quota/exhausted", () => {
		expect(parseRateLimitReason("quota exceeded")).toBe("QUOTA_EXHAUSTED");
		expect(parseRateLimitReason("usage limit")).toBe("QUOTA_EXHAUSTED");
	});

	it("returns SERVER_ERROR for 500/internal errors", () => {
		expect(parseRateLimitReason("error 500")).toBe("SERVER_ERROR");
		expect(parseRateLimitReason("internal server error")).toBe("SERVER_ERROR");
	});

	it("returns UNKNOWN for unrecognized messages", () => {
		expect(parseRateLimitReason("something unknown")).toBe("UNKNOWN");
	});

	it("is case-insensitive", () => {
		expect(parseRateLimitReason("QUOTA EXCEEDED")).toBe("QUOTA_EXHAUSTED");
	});
});

describe("calculateRateLimitBackoffMs", () => {
	it("QUOTA_EXHAUSTED = 30 minutes", () => {
		expect(calculateRateLimitBackoffMs("QUOTA_EXHAUSTED")).toBe(30 * 60 * 1000);
	});

	it("RATE_LIMIT_EXCEEDED = 30 seconds", () => {
		expect(calculateRateLimitBackoffMs("RATE_LIMIT_EXCEEDED")).toBe(30 * 1000);
	});

	it("SERVER_ERROR = 20 seconds", () => {
		expect(calculateRateLimitBackoffMs("SERVER_ERROR")).toBe(20 * 1000);
	});

	it("MODEL_CAPACITY_EXHAUSTED has jitter in range [45000, 60000]", () => {
		const results = new Set<number>();
		for (let i = 0; i < 20; i++) {
			const backoff = calculateRateLimitBackoffMs("MODEL_CAPACITY_EXHAUSTED");
			results.add(Math.round(backoff / 1000));
		}
		// Base is 45000ms, jitter adds 0-30000ms
		expect(calculateRateLimitBackoffMs("MODEL_CAPACITY_EXHAUSTED")).toBeGreaterThanOrEqual(45000);
		expect(calculateRateLimitBackoffMs("MODEL_CAPACITY_EXHAUSTED")).toBeLessThanOrEqual(75000);
	});

	it("UNKNOWN falls back to QUOTA_EXHAUSTED", () => {
		expect(calculateRateLimitBackoffMs("UNKNOWN")).toBe(30 * 60 * 1000);
	});
});

describe("isUsageLimitError", () => {
	it("detects usage_limit patterns", () => {
		expect(isUsageLimitError("usage_limit_reached")).toBe(true);
	});

	it("detects usage limit patterns", () => {
		expect(isUsageLimitError("usage limit reached")).toBe(true);
	});

	it("detects quota exceeded", () => {
		expect(isUsageLimitError("quota exceeded")).toBe(true);
	});

	it("returns false for non-usage errors", () => {
		expect(isUsageLimitError("rate limit exceeded")).toBe(false);
		expect(isUsageLimitError("server overloaded")).toBe(false);
	});

	it("is case-insensitive", () => {
		expect(isUsageLimitError("USAGE_LIMIT_REACHED")).toBe(true);
	});
});
