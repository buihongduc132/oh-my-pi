import { describe, expect, it } from "bun:test";
import {
	detectLanguageId,
	fileToUri,
	formatDiagnostic,
	formatGroupedDiagnosticMessages,
	severityToIcon,
	severityToString,
	sortDiagnostics,
	uriToFile,
} from "@oh-my-pi/pi-coding-agent/lsp/utils";

describe("detectLanguageId", () => {
	const cases: Array<[string, string]> = [
		["file.ts", "typescript"],
		["file.tsx", "typescriptreact"],
		["file.js", "javascript"],
		["file.jsx", "javascriptreact"],
		["file.mjs", "javascript"],
		["file.rs", "rust"],
		["file.go", "go"],
		["file.py", "python"],
		["file.sh", "shellscript"],
		["file.bash", "shellscript"],
		["file.rb", "ruby"],
		["file.java", "java"],
		["file.kt", "kotlin"],
		["file.cs", "csharp"],
		["file.html", "html"],
		["file.css", "css"],
		["file.scss", "scss"],
		["file.json", "json"],
		["file.yaml", "yaml"],
		["file.yml", "yaml"],
		["file.toml", "toml"],
		["file.md", "markdown"],
		["file.sql", "sql"],
		["file.graphql", "graphql"],
		["file.proto", "protobuf"],
		["file.dockerfile", "dockerfile"],
		["file.tf", "terraform"],
		["file.swift", "swift"],
		["file.dart", "dart"],
	];

	for (const [input, expected] of cases) {
		it(`detects ${expected} for ${input}`, () => {
			expect(detectLanguageId(input)).toBe(expected);
		});
	}

	it("detects Dockerfile regardless of extension", () => {
		expect(detectLanguageId("Dockerfile.prod")).toBe("dockerfile");
	});

	it("detects Makefile", () => {
		expect(detectLanguageId("Makefile")).toBe("makefile");
		expect(detectLanguageId("GNUmakefile")).toBe("makefile");
	});

	it("detects CMake", () => {
		expect(detectLanguageId("CMakeLists.txt")).toBe("cmake");
		expect(detectLanguageId("file.cmake")).toBe("cmake");
	});

	it("returns plaintext for unknown extensions", () => {
		expect(detectLanguageId("file.xyz")).toBe("plaintext");
	});
});

describe("fileToUri / uriToFile round-trip", () => {
	it("round-trips Unix paths", () => {
		const uri = fileToUri("/tmp/test.ts");
		expect(uri.startsWith("file://")).toBe(true);
		expect(uriToFile(uri)).toBe("/tmp/test.ts");
	});

	it("round-trips paths with spaces", () => {
		const uri = fileToUri("/tmp/my file.ts");
		expect(uriToFile(uri)).toBe("/tmp/my file.ts");
	});

	it("uriToFile returns non-file:// URIs unchanged", () => {
		expect(uriToFile("http://example.com")).toBe("http://example.com");
	});
});

describe("severityToString", () => {
	it("1 → error", () => expect(severityToString(1)).toBe("error"));
	it("2 → warning", () => expect(severityToString(2)).toBe("warning"));
	it("3 → info", () => expect(severityToString(3)).toBe("info"));
	it("4 → hint", () => expect(severityToString(4)).toBe("hint"));
	it("undefined → error (default)", () => expect(severityToString(undefined)).toBe("error"));
});

describe("sortDiagnostics", () => {
	function diag(sev: number, line: number, col: number, msg: string) {
		return { severity: sev, range: { start: { line, character: col } }, message: msg } as any;
	}

	it("sorts by severity first", () => {
		const diags = [diag(3, 0, 0, "info"), diag(1, 0, 0, "error"), diag(2, 0, 0, "warn")];
		const sorted = sortDiagnostics(diags);
		expect(sorted[0].message).toBe("error");
		expect(sorted[1].message).toBe("warn");
		expect(sorted[2].message).toBe("info");
	});

	it("sorts by line then column on equal severity", () => {
		const diags = [diag(1, 5, 0, "a"), diag(1, 2, 0, "b"), diag(1, 2, 5, "c")];
		const sorted = sortDiagnostics(diags);
		expect(sorted.map(d => d.message)).toEqual(["b", "c", "a"]);
	});

	it("sorts by message on equal location", () => {
		const diags = [diag(1, 0, 0, "z"), diag(1, 0, 0, "a")];
		const sorted = sortDiagnostics(diags);
		expect(sorted[0].message).toBe("a");
	});
});

describe("severityToIcon", () => {
	it("returns a string", () => {
		const icon = severityToIcon(1);
		expect(typeof icon).toBe("string");
	});

	it("handles undefined severity", () => {
		const icon = severityToIcon(undefined);
		expect(typeof icon).toBe("string");
	});
});

describe("formatDiagnostic", () => {
	it("formats a diagnostic with severity and location", () => {
		const diag = { severity: 1, range: { start: { line: 5, character: 3 } }, message: "test error" } as any;
		const result = formatDiagnostic(diag, "/path/to/file.ts");
		expect(result).toContain("file.ts");
		expect(result).toContain("6:4");
		expect(result).toContain("error");
	});

	it("omits empty source", () => {
		const diag = { severity: 1, range: { start: { line: 0, character: 0 } }, message: "msg" } as any;
		const result = formatDiagnostic(diag, "f.ts");
		expect(result).not.toContain("[]");
	});
});

describe("formatGroupedDiagnosticMessages", () => {
	it("groups messages by file", () => {
		const msgs = ["dir/file.ts:1:1 error message", "dir/file.ts:2:1 another error"];
		const result = formatGroupedDiagnosticMessages(msgs);
		expect(result).toContain("file.ts");
		expect(result).toContain("1:1");
	});

	it("handles ungrouped messages", () => {
		const msgs = ["not a file path message"];
		const result = formatGroupedDiagnosticMessages(msgs);
		expect(result).toContain("not a file path message");
	});

	it("handles empty array", () => {
		const result = formatGroupedDiagnosticMessages([]);
		expect(result).toBe("");
	});
});
