import { describe, expect, it } from "bun:test";
import { instructionCapability } from "@oh-my-pi/pi-coding-agent/capability/instruction";

describe("instructionCapability", () => {
	it("has correct id and displayName", () => {
		expect((instructionCapability as any).id).toBe("instructions");
		expect((instructionCapability as any).displayName).toBe("Instructions");
	});

	it("generates extension id from name", () => {
		expect(
			(instructionCapability as any).toExtensionId({ name: "setup", path: "", content: "", _source: null as any }),
		).toBe("instruction:setup");
	});

	describe("validate", () => {
		// validate: (instructionCapability as any).validate,

		it("returns undefined for valid instruction", () => {
			const inst = {
				name: "my-instruction",
				path: "/path/to/my-instruction.md",
				content: "# My Instruction",
				_source: null as any,
			};
			expect((instructionCapability as any).validate(inst)).toBeUndefined();
		});

		it("returns 'Missing name' when name is empty", () => {
			const inst = { name: "", path: "/x", content: "hi", _source: null as any };
			expect((instructionCapability as any).validate(inst)).toBe("Missing name");
		});

		it("returns 'Missing path' when path is empty", () => {
			const inst = { name: "x", path: "", content: "hi", _source: null as any };
			expect((instructionCapability as any).validate(inst)).toBe("Missing path");
		});

		it("returns 'Missing content' when content is undefined", () => {
			const inst = { name: "x", path: "/x", _source: null as any } as any;
			expect((instructionCapability as any).validate(inst)).toBe("Missing content");
		});

		it("returns undefined when content is empty string", () => {
			const inst = { name: "x", path: "/x", content: "", _source: null as any };
			expect((instructionCapability as any).validate(inst)).toBeUndefined();
		});
	});
});
