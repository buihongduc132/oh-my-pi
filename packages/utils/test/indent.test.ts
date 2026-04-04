import { afterAll, beforeEach, describe, expect, it } from "bun:test";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { getDefaultTabWidth, getIndentation, setDefaultTabWidth } from "../src/indent";

let originalDefaultTabWidth: number;

describe("setDefaultTabWidth / getDefaultTabWidth", () => {
	beforeEach(() => {
		originalDefaultTabWidth = getDefaultTabWidth();
	});

	afterAll(() => {
		setDefaultTabWidth(originalDefaultTabWidth);
	});

	it("defaults to 3", () => {
		setDefaultTabWidth(3);
		expect(getDefaultTabWidth()).toBe(3);
	});

	it("clamps values above 16 to 16", () => {
		setDefaultTabWidth(999);
		expect(getDefaultTabWidth()).toBe(16);
	});

	it("clamps values below 1 to 1", () => {
		setDefaultTabWidth(-5);
		expect(getDefaultTabWidth()).toBe(1);
	});

	it("clamps non-finite values to 3", () => {
		setDefaultTabWidth(Infinity);
		expect(getDefaultTabWidth()).toBe(3);
		setDefaultTabWidth(NaN);
		expect(getDefaultTabWidth()).toBe(3);
	});

	it("rounds fractional values", () => {
		setDefaultTabWidth(4.7);
		expect(getDefaultTabWidth()).toBe(5);
		setDefaultTabWidth(4.3);
		expect(getDefaultTabWidth()).toBe(4);
	});
});

describe("getIndentation — no file argument", () => {
	beforeEach(() => {
		originalDefaultTabWidth = getDefaultTabWidth();
	});

	afterAll(() => {
		setDefaultTabWidth(originalDefaultTabWidth);
	});

	it("uses the current default tab width", () => {
		setDefaultTabWidth(2);
		expect(getIndentation()).toBe("  ");
		setDefaultTabWidth(4);
		expect(getIndentation()).toBe("    ");
	});
});

// Each test gets its own temp dir to avoid cache pollution between tests.
const tmpDirs: string[] = [];

afterAll(() => {
	for (const d of tmpDirs) {
		try {
			fs.rmSync(d, { recursive: true });
		} catch {
			// ignore
		}
	}
});

function makeTmpDir(): string {
	const d = fs.mkdtempSync(path.join(os.tmpdir(), "indent-test-"));
	tmpDirs.push(d);
	return d;
}

function writeConfig(dir: string, content: string): void {
	fs.writeFileSync(path.join(dir, ".editorconfig"), content);
}

function touchFile(dir: string, filename: string): string {
	const f = path.join(dir, filename);
	fs.writeFileSync(f, "");
	return f;
}

describe("getIndentation — with absolute file path", () => {
	beforeEach(() => {
		originalDefaultTabWidth = getDefaultTabWidth();
		setDefaultTabWidth(3);
	});

	afterAll(() => {
		setDefaultTabWidth(originalDefaultTabWidth);
	});

	it("uses default when no .editorconfig exists", () => {
		const dir = makeTmpDir();
		expect(getIndentation(touchFile(dir, "my-file.ts"))).toBe("   ");
	});

	it("uses indent_size when set to a number", () => {
		const dir = makeTmpDir();
		writeConfig(dir, "root = true\n[*.ts]\nindent_size = 4\n");
		expect(getIndentation(touchFile(dir, "file.ts"))).toBe("    ");
	});

	it("uses indent_size = tab with tab_width fallback to default", () => {
		const dir = makeTmpDir();
		writeConfig(dir, "root = true\n[*.ts]\nindent_style = tab\nindent_size = tab\n");
		// No tab_width → falls back to default (3)
		expect(getIndentation(touchFile(dir, "file.ts"))).toBe("   ");
	});

	it("uses indent_size = tab with explicit tab_width", () => {
		const dir = makeTmpDir();
		writeConfig(dir, "root = true\n[*.ts]\nindent_size = tab\ntab_width = 4\n");
		expect(getIndentation(touchFile(dir, "file.ts"))).toBe("    ");
	});

	it("uses tab_width directly when indent_style = space", () => {
		const dir = makeTmpDir();
		writeConfig(dir, "root = true\n[*.ts]\nindent_style = space\ntab_width = 8\n");
		expect(getIndentation(touchFile(dir, "file.ts"))).toBe("        ");
	});

	it("uses default when no indent-related properties are set", () => {
		const dir = makeTmpDir();
		writeConfig(dir, "root = true\n[*.txt]\ncharset = utf-8\n");
		expect(getIndentation(touchFile(dir, "file.ts"))).toBe("   ");
	});

	it("ignores comment lines (starting with #)", () => {
		const dir = makeTmpDir();
		writeConfig(dir, "# comment\nroot = true\n[*.ts]\nindent_size = 4\n");
		expect(getIndentation(touchFile(dir, "file.ts"))).toBe("    ");
	});

	it("ignores semicolon comment lines", () => {
		const dir = makeTmpDir();
		writeConfig(dir, "; semicolon comment\nroot = true\n[*.ts]\nindent_size = 4\n");
		expect(getIndentation(touchFile(dir, "file.ts"))).toBe("    ");
	});

	it("ignores lines without an equals sign", () => {
		const dir = makeTmpDir();
		writeConfig(dir, "root = true\njust text no equals\n[*.ts]\nindent_size = 4\n");
		expect(getIndentation(touchFile(dir, "file.ts"))).toBe("    ");
	});

	it("ignores empty section patterns", () => {
		const dir = makeTmpDir();
		writeConfig(dir, "root = true\n[]\nindent_size = 4\n[*.ts]\nindent_size = 2\n");
		// First section is empty → ignored; second section applies
		expect(getIndentation(touchFile(dir, "file.ts"))).toBe("  ");
	});

	it("clamps indent_size to safe range 1-16", () => {
		const dir = makeTmpDir();
		writeConfig(dir, "root = true\n[*.ts]\nindent_size = 999\n");
		expect(getIndentation(touchFile(dir, "file.ts"))).toBe("                "); // 16 spaces
	});

	it("ignores non-numeric indent_size", () => {
		const dir = makeTmpDir();
		writeConfig(dir, "root = true\n[*.ts]\nindent_size = abc\n");
		// No valid indent_size → uses default
		expect(getIndentation(touchFile(dir, "file.ts"))).toBe("   ");
	});

	it("subDir config shadows parent config (root not set)", () => {
		const parentDir = makeTmpDir();
		const subDir = path.join(parentDir, "sub");
		fs.mkdirSync(subDir, { recursive: true });
		writeConfig(parentDir, "[*.ts]\nindent_size = 2\n");
		writeConfig(subDir, "[*.ts]\nindent_size = 8\n");
		expect(getIndentation(touchFile(subDir, "file.ts"))).toBe("        ");
	});

	it("root=true in parent stops upward search at that parent", () => {
		const parentDir = makeTmpDir();
		const subDir = path.join(parentDir, "sub");
		fs.mkdirSync(subDir, { recursive: true });
		writeConfig(parentDir, "root = true\n[*.ts]\nindent_size = 2\n");
		writeConfig(subDir, "[*.ts]\nindent_size = 8\n");
		// root=true stops search at parentDir, subDir config is invisible
		expect(getIndentation(touchFile(subDir, "file.ts"))).toBe("        ");
	});

	it("applies exact glob pattern match: *.ts vs *.js", () => {
		const dir = makeTmpDir();
		writeConfig(dir, "root = true\n[*.ts]\nindent_size = 4\n[*.js]\nindent_size = 2\n");
		expect(getIndentation(touchFile(dir, "file.ts"))).toBe("    ");
		expect(getIndentation(touchFile(dir, "file.js"))).toBe("  ");
	});

	it("applies glob pattern with **/*.ts for nested files", () => {
		const dir = makeTmpDir();
		writeConfig(dir, "root = true\n[**/*.ts]\nindent_size = 5\n");
		const nestedDir = path.join(dir, "src", "nested");
		fs.mkdirSync(nestedDir, { recursive: true });
		expect(getIndentation(touchFile(nestedDir, "file.ts"))).toBe("     ");
	});

	it("strips leading / from glob patterns", () => {
		const dir = makeTmpDir();
		writeConfig(dir, "root = true\n[/file.ts]\nindent_size = 7\n");
		expect(getIndentation(touchFile(dir, "file.ts"))).toBe("       ");
	});

	it("is case-insensitive for keys and values", () => {
		const dir = makeTmpDir();
		writeConfig(dir, "Root = TRUE\n[*.TS]\nINDENT_STYLE = SPACE\nINDENT_SIZE = 6\n");
		expect(getIndentation(touchFile(dir, "file.TS"))).toBe("      ");
	});

	it("handles CRLF line endings", () => {
		const dir = makeTmpDir();
		writeConfig(dir, "root = true\r\n[*.ts]\r\nindent_size = 4\r\n");
		expect(getIndentation(touchFile(dir, "file.ts"))).toBe("    ");
	});

	it("tab_width takes priority over indent_size=tab with indentStyle=tab", () => {
		const dir = makeTmpDir();
		writeConfig(dir, "root = true\n[*.ts]\nindent_style = tab\nindent_size = tab\ntab_width = 5\n");
		// indent_size = tab → use tabWidth = 5
		expect(getIndentation(touchFile(dir, "file.ts"))).toBe("     ");
	});

	it("returns default when only indent_style=tab is set without size info", () => {
		const dir = makeTmpDir();
		writeConfig(dir, "root = true\n[*.ts]\nindent_style = tab\n");
		expect(getIndentation(touchFile(dir, "file.ts"))).toBe("   ");
	});
});
