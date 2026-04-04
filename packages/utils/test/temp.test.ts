import { describe, expect, it } from "bun:test";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { TempDir } from "@oh-my-pi/pi-utils";

describe("TempDir.createSync", () => {
	it("creates a real directory", () => {
		const temp = TempDir.createSync();
		try {
			expect(fs.existsSync(temp.path())).toBe(true);
			expect(fs.statSync(temp.path()).isDirectory()).toBe(true);
		} finally {
			temp.removeSync();
		}
	});

	it("path ends with the default pi-temp- prefix", () => {
		const temp = TempDir.createSync();
		try {
			const p = temp.path();
			// The default prefix is os.tmpdir() + path.sep + "pi-temp-"
			expect(p).toContain("pi-temp-");
		} finally {
			temp.removeSync();
		}
	});

	it("uses custom prefix when provided", () => {
		const temp = TempDir.createSync("my-prefix-");
		try {
			const p = temp.path();
			// Custom prefix should appear in path
			expect(p).toContain("my-prefix-");
		} finally {
			temp.removeSync();
		}
	});

	it("prefix starting with @ is used directly under tmpdir", () => {
		const temp = TempDir.createSync("@my-named-dir");
		try {
			const p = temp.path();
			// Should be under tmpdir with the name after @
			expect(p).toContain("my-named-dir");
			expect(p.startsWith(os.tmpdir())).toBe(true);
		} finally {
			temp.removeSync();
		}
	});

	it("each call creates a unique directory", () => {
		const temp1 = TempDir.createSync();
		const temp2 = TempDir.createSync();
		try {
			expect(temp1.path()).not.toBe(temp2.path());
		} finally {
			temp1.removeSync();
			temp2.removeSync();
		}
	});
});

describe("TempDir.create (async)", () => {
	it("creates a real directory", async () => {
		const temp = await TempDir.create();
		try {
			expect(fs.existsSync(temp.path())).toBe(true);
			expect(fs.statSync(temp.path()).isDirectory()).toBe(true);
		} finally {
			await temp.remove();
		}
	});

	it("path ends with pi-temp- prefix", async () => {
		const temp = await TempDir.create();
		try {
			expect(temp.path()).toContain("pi-temp-");
		} finally {
			await temp.remove();
		}
	});
});

describe("TempDir.path() / absolute()", () => {
	it("path() returns a string", () => {
		const temp = TempDir.createSync();
		try {
			const p = temp.path();
			expect(typeof p).toBe("string");
			expect(p.length).toBeGreaterThan(0);
		} finally {
			temp.removeSync();
		}
	});

	it("absolute() returns a string", () => {
		const temp = TempDir.createSync();
		try {
			const p = temp.absolute();
			expect(typeof p).toBe("string");
			expect(p.length).toBeGreaterThan(0);
			// absolute() should be an absolute path
			expect(path.isAbsolute(p)).toBe(true);
		} finally {
			temp.removeSync();
		}
	});

	it("absolute() resolves the path", () => {
		const temp = TempDir.createSync();
		try {
			const p = temp.absolute();
			expect(p).toBe(path.resolve(temp.path()));
		} finally {
			temp.removeSync();
		}
	});
});

describe("TempDir.remove() / removeSync()", () => {
	it("removeSync() removes the directory", () => {
		const temp = TempDir.createSync();
		const p = temp.path();
		expect(fs.existsSync(p)).toBe(true);
		temp.removeSync();
		expect(fs.existsSync(p)).toBe(false);
	});

	it("removeSync() is idempotent (can be called twice)", () => {
		const temp = TempDir.createSync();
		const _p = temp.path();
		temp.removeSync();
		expect(() => temp.removeSync()).not.toThrow();
	});

	it("remove() removes the directory asynchronously", async () => {
		const temp = await TempDir.create();
		const p = temp.path();
		expect(fs.existsSync(p)).toBe(true);
		await temp.remove();
		expect(fs.existsSync(p)).toBe(false);
	});

	it("remove() is idempotent", async () => {
		const temp = await TempDir.create();
		const p = temp.path();
		await temp.remove();
		// Should not throw
		await temp.remove();
		expect(fs.existsSync(p)).toBe(false);
	});
});

describe("TempDir[Symbol.dispose]()", () => {
	it("Symbol.dispose cleans up the directory", () => {
		const temp = TempDir.createSync();
		const p = temp.path();
		expect(fs.existsSync(p)).toBe(true);
		temp[Symbol.dispose]();
		expect(fs.existsSync(p)).toBe(false);
	});

	it("Symbol.dispose does not throw when already removed", () => {
		const temp = TempDir.createSync();
		temp[Symbol.dispose]();
		// Should not throw
		temp[Symbol.dispose]();
	});
});

describe("TempDir[Symbol.asyncDispose]()", () => {
	it("Symbol.asyncDispose cleans up the directory", async () => {
		const temp = await TempDir.create();
		const p = temp.path();
		expect(fs.existsSync(p)).toBe(true);
		await temp[Symbol.asyncDispose]();
		expect(fs.existsSync(p)).toBe(false);
	});

	it("Symbol.asyncDispose does not throw when already removed", async () => {
		const temp = await TempDir.create();
		await temp[Symbol.asyncDispose]();
		// Should not throw
		await temp[Symbol.asyncDispose]();
	});
});

describe("TempDir.join()", () => {
	it("joins paths correctly", () => {
		const temp = TempDir.createSync();
		try {
			const joined = temp.join("subdir", "file.txt");
			const expected = path.join(temp.path(), "subdir", "file.txt");
			expect(joined).toBe(expected);
		} finally {
			temp.removeSync();
		}
	});

	it("join with no args returns the temp path", () => {
		const temp = TempDir.createSync();
		try {
			const joined = temp.join();
			expect(joined).toBe(temp.path());
		} finally {
			temp.removeSync();
		}
	});

	it("join creates a nested path (without creating the dir)", () => {
		const temp = TempDir.createSync();
		try {
			const nested = temp.join("a", "b", "c");
			expect(nested).toBe(path.join(temp.path(), "a", "b", "c"));
		} finally {
			temp.removeSync();
		}
	});
});

describe("toString()", () => {
	it("returns the path as string", () => {
		const temp = TempDir.createSync();
		try {
			const s = temp.toString();
			expect(s).toBe(temp.path());
		} finally {
			temp.removeSync();
		}
	});
});
