import { describe, expect, it } from "bun:test";
import type { Hook } from "@oh-my-pi/pi-coding-agent/capability/hook";
import { hookCapability } from "@oh-my-pi/pi-coding-agent/capability/hook";

describe("hookCapability", () => {
	it("has correct id and displayName", () => {
		expect((hookCapability as any).id).toBe("hooks");
		expect((hookCapability as any).displayName).toBe("Hooks");
	});

	it("generates extension id from hook", () => {
		const hook: Hook = {
			name: "before-edit",
			path: "/hooks/before-edit.sh",
			type: "pre",
			tool: "edit",
			level: "project",
			_source: null as any,
		};
		expect((hookCapability as any).toExtensionId(hook)).toBe("hook:pre:edit:before-edit");
	});

	it("generates key from type, tool, and name", () => {
		const hook: Hook = {
			name: "after-patch",
			path: "/hooks/after-patch.sh",
			type: "post",
			tool: "apply",
			level: "user",
			_source: null as any,
		};
		expect((hookCapability as any).key(hook)).toBe("post:apply:after-patch");
	});

	describe("validate", () => {
		const valid: Hook = {
			name: "my-hook",
			path: "/hooks/my-hook.sh",
			type: "pre",
			tool: "edit",
			level: "project",
			_source: null as any,
		};

		it("returns undefined for valid hook", () => {
			expect((hookCapability as any).validate(valid)).toBeUndefined();
		});

		it("returns 'Missing name' when name is empty", () => {
			const hook = { ...valid, name: "" };
			expect((hookCapability as any).validate(hook)).toBe("Missing name");
		});

		it("returns 'Missing path' when path is empty", () => {
			const hook = { ...valid, path: "" };
			expect((hookCapability as any).validate(hook)).toBe("Missing path");
		});

		it("returns 'Invalid type (must be \\'pre\\' or \\'post\\')' for bad type", () => {
			const hook = { ...valid, type: "during" as any };
			expect((hookCapability as any).validate(hook)).toBe("Invalid type (must be 'pre' or 'post')");
		});

		it("returns 'Missing tool' when tool is empty", () => {
			const hook = { ...valid, tool: "" };
			expect((hookCapability as any).validate(hook)).toBe("Missing tool");
		});

		it("accepts 'post' type", () => {
			const hook = { ...valid, type: "post" as const };
			expect((hookCapability as any).validate(hook)).toBeUndefined();
		});

		it("accepts '*' wildcard tool", () => {
			const hook = { ...valid, tool: "*" };
			expect((hookCapability as any).validate(hook)).toBeUndefined();
		});
	});
});
