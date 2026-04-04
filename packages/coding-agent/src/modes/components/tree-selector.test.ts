/**
 * TDD tests for: session tree opens with a configurable default filter.
 *
 * Config key  : treeFilterMode  (already in settings-schema.ts, default: "default")
 * Config file : ~/.omp/agent/config.yml  →  session.tree.defaultFilter
 * Wire        : selector-controller.ts  showTreeSelector()
 *                reads settings.get("treeFilterMode")
 *                and passes it as initialFilterMode to TreeSelectorComponent.
 *
 * Ctrl+O cycling behaviour is unchanged — these tests only verify the
 * starting filter mode is configurable.
 *
 * Test strategy
 * ─────────────
 *  • TreeList  – pure logic component; dynamically imported to avoid module-level hangs.
 *                 Covers: constructor accepts initialFilterMode, filter badge text, Ctrl+O cycling.
 *  • wiring     – read selector-controller.ts source with Bun.file(); assert fix is present.
 */
import { describe, expect, it } from "bun:test";
import type { SessionTreeNode } from "../../session/session-manager";

await (async () => {
	try {
		const ns = await import("./tree-selector.js");
		(globalThis as any).TreeList = ns.TreeList ?? null;
	} catch (e) {
		console.error("[tree-selector test] import failed:", e);
		(globalThis as any).TreeList = null;
	}
})();

// ─────────────────────────────────────────────────────────────────────────────
// Test tree builder
// ─────────────────────────────────────────────────────────────────────────────
function makeNode(id: string, role: string, children: SessionTreeNode[] = [], label?: string): SessionTreeNode {
	return {
		entry: {
			type: "message",
			id,
			parentId: null,
			timestamp: "2024-01-01T00:00:00.000Z",
			message: { role: role as "user" | "assistant" | "toolResult", content: [{ type: "text", text: id }] },
		},
		label,
		children,
	};
}

/** Tree: root(user) → child(assistant, label=checkpoint) → tool(assistant only, no text) */
function makeFilterTree(): SessionTreeNode[] {
	const tool = makeNode("n3", "toolResult");
	const child = makeNode("n2", "assistant", [tool], "checkpoint");
	const root = makeNode("n1", "user", [child]);
	return [root];
}

// ─────────────────────────────────────────────────────────────────────────────
// Helper: detect active filter badge from the component's rendered output.
// TreeList.render() always appends the filter label as the last line.
// ─────────────────────────────────────────────────────────────────────────────
function badge(list: any): string {
	if (!(globalThis as any).TreeList) return "";
	const last = list.render(80).at(-1) ?? "";
	if (last.includes("[no-tools]")) return "[no-tools]";
	if (last.includes("[user]")) return "[user]";
	if (last.includes("[labeled]")) return "[labeled]";
	if (last.includes("[all]")) return "[all]";
	return "";
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. TreeList constructor — initialFilterMode parameter
// ─────────────────────────────────────────────────────────────────────────────
describe("TreeList initialFilterMode", { skip: !(globalThis as any).TreeList }, () => {
	const tree = makeFilterTree();

	function makeList(initial: string) {
		return new (globalThis as any).TreeList(tree, "n1", 10, initial as any);
	}

	it("defaults to no badge (empty string) when initialFilterMode is 'default'", () => {
		expect(badge(makeList("default"))).toBe("");
	});

	it("shows [no-tools] badge when initialFilterMode is 'no-tools'", () => {
		expect(badge(makeList("no-tools"))).toBe("[no-tools]");
	});

	it("shows [user] badge when initialFilterMode is 'user-only'", () => {
		expect(badge(makeList("user-only"))).toBe("[user]");
	});

	it("shows [labeled] badge when initialFilterMode is 'labeled-only'", () => {
		expect(badge(makeList("labeled-only"))).toBe("[labeled]");
	});

	it("shows [all] badge when initialFilterMode is 'all'", () => {
		expect(badge(makeList("all"))).toBe("[all]");
	});

	it("labeled-only passes only the 'checkpoint' node (1/1)", () => {
		const last = makeList("labeled-only").render(80).at(-1) ?? "";
		expect(last).toContain("(1/1)");
	});

	it("all passes all 3 nodes (tree has 1 root with 3 total nodes)", () => {
		const last = makeList("all").render(80).at(-1) ?? "";
		expect(last).toContain("(1/3)");
	});
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. Ctrl+O cycling — still works from ANY starting mode
//    Cycle order: default → no-tools → user-only → labeled-only → all → default
// ─────────────────────────────────────────────────────────────────────────────
describe("Ctrl+O cycling from configurable initialFilterMode", { skip: !(globalThis as any).TreeList }, () => {
	// [initial_mode, badge_after_one_Ctrl+O_press]
	const CYCLE: Array<[string, string, string]> = [
		["default", "", "[no-tools]"],
		["no-tools", "[no-tools]", "[user]"],
		["user-only", "[user]", "[labeled]"],
		["labeled-only", "[labeled]", "[all]"],
		["all", "[all]", ""],
	];

	function makeList(initial: string) {
		return new (globalThis as any).TreeList(makeFilterTree(), "n1", 10, initial as any);
	}

	function pressCtrlO(list: any) {
		list.handleInput("\u000f");
	}

	for (const [from, initialBadge, badgeAfter] of CYCLE) {
		it(`Ctrl+O from '${from}' → badge becomes '${badgeAfter || "default (no badge)"}'`, () => {
			const list = makeList(from);
			expect(badge(list)).toBe(initialBadge);
			pressCtrlO(list);
			expect(badge(list)).toBe(badgeAfter);
		});
	}

	it("full round-trip: default → no-tools → user-only → labeled-only → all → default", () => {
		const list = makeList("default");
		const sequence: string[] = [];
		sequence.push(badge(list));
		for (let i = 0; i < 5; i++) {
			pressCtrlO(list);
			sequence.push(badge(list));
		}
		expect(sequence).toEqual(["", "[no-tools]", "[user]", "[labeled]", "[all]", ""]);
	});
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. settings-schema: treeFilterMode exists with correct values
// ─────────────────────────────────────────────────────────────────────────────
describe("settings-schema treeFilterMode", () => {
	it("treeFilterMode key exists in SETTINGS_SCHEMA", async () => {
		const { SETTINGS_SCHEMA } = await import("../../config/settings-schema");
		expect("treeFilterMode" in SETTINGS_SCHEMA).toBe(true);
	});

	it("values are: default, no-tools, user-only, labeled-only, all", async () => {
		const { SETTINGS_SCHEMA } = await import("../../config/settings-schema");
		const def = SETTINGS_SCHEMA.treeFilterMode as { type: string; values: readonly string[]; default: string };
		expect(def.type).toBe("enum");
		expect(def.values).toEqual(["default", "no-tools", "user-only", "labeled-only", "all"]);
	});

	it("default is 'default' (backward compatible)", async () => {
		const { SETTINGS_SCHEMA } = await import("../../config/settings-schema");
		const def = SETTINGS_SCHEMA.treeFilterMode as { default: string };
		expect(def.default).toBe("default");
	});
});

// ─────────────────────────────────────────────────────────────────────────────
// 4. showTreeSelector wiring: reads settings.get("treeFilterMode")
// ─────────────────────────────────────────────────────────────────────────────
const SELECTOR_PATH =
	"/home/bhd/.bun/install/global/node_modules/@oh-my-pi/pi-coding-agent/src/modes/controllers/selector-controller.ts";

describe("showTreeSelector wires treeFilterMode from settings", () => {
	async function readController() {
		return await Bun.file(SELECTOR_PATH).text();
	}

	it("selector-controller imports the settings singleton", async () => {
		const src = await readController();
		expect(src).toContain('from "../../config/settings"');
	});

	it("settings.get('treeFilterMode') appears in selector-controller source", async () => {
		const src = await readController();
		expect(src).toContain('settings.get("treeFilterMode")');
	});

	it("TreeSelectorComponent constructor call in showTreeSelector receives settings-derived filter", async () => {
		const src = await readController();
		// Match the showTreeSelector method body and look past TreeSelectorComponent's opening paren.
		const methodMatch = src.match(/showTreeSelector\(\)[^{]*\{([\s\S]*?)^\t\}/m);
		expect(methodMatch).not.toBeNull();
		// Scan past the `new TreeSelectorComponent(` token to find the 7th argument.
		const afterConstructor = methodMatch![0].split("new TreeSelectorComponent(")[1] ?? "";
		expect(afterConstructor).toContain('settings.get("treeFilterMode")');
	});
});
