import { describe, expect, it } from "bun:test";
import type { Extension } from "@oh-my-pi/pi-coding-agent/capability/extension";
import { extensionCapability } from "@oh-my-pi/pi-coding-agent/capability/extension";

describe("extensionCapability", () => {
	it("has correct id and displayName", () => {
		expect((extensionCapability as any).id).toBe("extensions");
		expect((extensionCapability as any).displayName).toBe("Extensions");
	});

	it("generates key from name", () => {
		const ext: Extension = {
			name: "data-fetcher",
			path: "/extensions/data-fetcher",
			manifest: {},
			level: "user",
			_source: null as any,
		};
		expect((extensionCapability as any).key(ext)).toBe("data-fetcher");
	});

	describe("validate", () => {
		const valid: Extension = {
			name: "valid-ext",
			path: "/extensions/valid-ext",
			manifest: {},
			level: "project",
			_source: null as any,
		};

		it("returns undefined for valid extension", () => {
			expect((extensionCapability as any).validate(valid)).toBeUndefined();
		});

		it("returns 'Missing extension name' when name is empty", () => {
			const ext = { ...valid, name: "" };
			expect((extensionCapability as any).validate(ext)).toBe("Missing extension name");
		});

		it("returns 'Missing extension name' when name is undefined", () => {
			const ext = { ...valid, name: undefined as any };
			expect((extensionCapability as any).validate(ext)).toBe("Missing extension name");
		});

		it("returns 'Missing extension path' when path is empty", () => {
			const ext = { ...valid, path: "" };
			expect((extensionCapability as any).validate(ext)).toBe("Missing extension path");
		});
	});

	describe("ExtensionManifest shape", () => {
		it("accepts manifest with mcpServers", () => {
			const ext: Extension = {
				name: "mcp-ext",
				path: "/ext/mcp-ext",
				manifest: {
					name: "mcp-ext",
					description: "Adds an MCP server",
					mcpServers: { myServer: { command: "node", args: ["server.js"] } },
				},
				level: "project",
				_source: null as any,
			};
			expect((extensionCapability as any).validate(ext)).toBeUndefined();
		});

		it("accepts manifest with tools and context", () => {
			const ext: Extension = {
				name: "tool-ext",
				path: "/ext/tool-ext",
				manifest: {
					name: "tool-ext",
					tools: [{ name: "custom-tool" }],
					context: { description: "context" },
				},
				level: "user",
				_source: null as any,
			};
			expect((extensionCapability as any).validate(ext)).toBeUndefined();
		});
	});
});
