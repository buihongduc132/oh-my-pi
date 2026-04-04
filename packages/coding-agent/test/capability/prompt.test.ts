import { describe, expect, it } from "bun:test";
import { promptCapability } from "@oh-my-pi/pi-coding-agent/capability/prompt";

describe("promptCapability", () => {
	it("has correct id", () => {
		expect((promptCapability as any).id).toBe("prompts");
	});

	it("generates extension id from name", () => {
		expect(
			(promptCapability as any).toExtensionId({ name: "code-review", path: "", content: "", _source: null as any }),
		).toBe("prompt:code-review");
	});

	describe("validate", () => {
		// validate: (promptCapability as any).validate,

		it("returns undefined for valid prompt", () => {
			const prompt = { name: "review", path: "/p", content: "# Review", _source: null as any };
			expect((promptCapability as any).validate(prompt)).toBeUndefined();
		});

		it("returns error for missing name", () => {
			const prompt = { name: "", path: "/p", content: "hi", _source: null as any };
			expect((promptCapability as any).validate(prompt)).toBe("Missing name");
		});

		it("returns error for missing path", () => {
			const prompt = { name: "x", path: "", content: "hi", _source: null as any };
			expect((promptCapability as any).validate(prompt)).toBe("Missing path");
		});
	});
});
