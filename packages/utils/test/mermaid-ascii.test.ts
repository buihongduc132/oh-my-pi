import { describe, expect, it } from "bun:test";
import { extractMermaidBlocks, renderMermaidAscii, renderMermaidAsciiSafe } from "../src/mermaid-ascii";

describe("renderMermaidAscii", () => {
	it("renders a valid flowchart", () => {
		const source = "flowchart TD\nA-->B";
		const result = renderMermaidAscii(source);
		expect(typeof result).toBe("string");
		expect(result.length).toBeGreaterThan(0);
	});

	it("renders a valid graph TD", () => {
		const source = "graph TD\nA-->B";
		const result = renderMermaidAscii(source);
		expect(typeof result).toBe("string");
		expect(result.length).toBeGreaterThan(0);
	});
});

describe("renderMermaidAsciiSafe", () => {
	it("returns a string for valid flowchart source", () => {
		const source = "flowchart TD\nA-->B";
		const result = renderMermaidAsciiSafe(source);
		expect(result).toBeString();
		expect(result!.length).toBeGreaterThan(0);
	});

	it("returns null for malformed source", () => {
		expect(renderMermaidAsciiSafe("{{invalid}}")).toBeNull();
	});
});

describe("extractMermaidBlocks", () => {
	it("extracts a mermaid block from markdown", () => {
		const markdown = "```mermaid\ngraph TD\nA-->B\n```";
		const blocks = extractMermaidBlocks(markdown);
		expect(blocks.length).toBe(1);
		// trim() removes leading/trailing whitespace
		expect(blocks[0].source).toBe("graph TD\nA-->B");
		expect(typeof blocks[0].hash).toBe("bigint");
	});

	it("extracts multiple blocks", () => {
		const markdown = "```mermaid\nA-->B\n```text\nfoo\n```";
		const blocks = extractMermaidBlocks(markdown);
		expect(blocks.length).toBe(1);
	});

	it("returns empty array when no mermaid blocks", () => {
		expect(extractMermaidBlocks("no blocks here")).toHaveLength(0);
	});

	it("produces consistent bigint hashes", () => {
		const h1 = extractMermaidBlocks("```mermaid\nA\n```")[0].hash;
		const h2 = extractMermaidBlocks("```mermaid\nA\n```")[0].hash;
		expect(h1).toBe(h2);
		expect(typeof h1).toBe("bigint");
	});

	it("produces different hashes for different sources", () => {
		const h1 = extractMermaidBlocks("```mermaid\nA\n```")[0].hash;
		const h2 = extractMermaidBlocks("```mermaid\nB\n```")[0].hash;
		expect(h1).not.toBe(h2);
	});

	it("handles inline mermaid (no newline after opening fence)", () => {
		const markdown = "```mermaid\na-->b\n```";
		const blocks = extractMermaidBlocks(markdown);
		expect(blocks.length).toBe(1);
		expect(blocks[0].source).toBe("a-->b");
	});
});
