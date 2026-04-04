import { describe, expect, it } from "bun:test";
import { hasFsCode, isEacces, isEexist, isEisdir, isEnoent, isEnotdir, isEnotempty, isFsError } from "../src/fs-error";

function makeFsError(code: string, message = "test error"): Error & { code: string } {
	const err = new Error(message) as Error & { code: string };
	err.code = code;
	return err;
}

describe("isFsError", () => {
	it("returns true for a plain Error with a code property", () => {
		expect(isFsError(makeFsError("ENOENT"))).toBe(true);
	});

	it("returns false for a plain Error without code", () => {
		expect(isFsError(new Error("plain"))).toBe(false);
	});

	it("returns false for null", () => {
		expect(isFsError(null)).toBe(false);
	});

	it("returns false for undefined", () => {
		expect(isFsError(undefined)).toBe(false);
	});

	it("returns false for a non-object", () => {
		expect(isFsError("not an error")).toBe(false);
		expect(isFsError(42)).toBe(false);
	});

	it("returns false when code is a number instead of string", () => {
		const err = new Error("code is number") as Error & { code: number };
		err.code = 2;
		expect(isFsError(err)).toBe(false);
	});
});

describe("isEnoent", () => {
	it("returns true for ENOENT code", () => {
		expect(isEnoent(makeFsError("ENOENT"))).toBe(true);
	});

	it("returns false for other error codes", () => {
		expect(isEnoent(makeFsError("EACCES"))).toBe(false);
		expect(isEnoent(makeFsError("EISDIR"))).toBe(false);
		expect(isEnoent(makeFsError("ENOTDIR"))).toBe(false);
	});

	it("returns false for a plain Error", () => {
		expect(isEnoent(new Error("no code"))).toBe(false);
	});
});

describe("isEacces", () => {
	it("returns true for EACCES code", () => {
		expect(isEacces(makeFsError("EACCES"))).toBe(true);
	});

	it("returns false for other error codes", () => {
		expect(isEacces(makeFsError("ENOENT"))).toBe(false);
	});
});

describe("isEisdir", () => {
	it("returns true for EISDIR code", () => {
		expect(isEisdir(makeFsError("EISDIR"))).toBe(true);
	});

	it("returns false for other error codes", () => {
		expect(isEisdir(makeFsError("ENOENT"))).toBe(false);
	});
});

describe("isEnotdir", () => {
	it("returns true for ENOTDIR code", () => {
		expect(isEnotdir(makeFsError("ENOTDIR"))).toBe(true);
	});

	it("returns false for other error codes", () => {
		expect(isEnotdir(makeFsError("ENOENT"))).toBe(false);
	});
});

describe("isEexist", () => {
	it("returns true for EEXIST code", () => {
		expect(isEexist(makeFsError("EEXIST"))).toBe(true);
	});

	it("returns false for other error codes", () => {
		expect(isEexist(makeFsError("ENOENT"))).toBe(false);
	});
});

describe("isEnotempty", () => {
	it("returns true for ENOTEMPTY code", () => {
		expect(isEnotempty(makeFsError("ENOTEMPTY"))).toBe(true);
	});

	it("returns false for other error codes", () => {
		expect(isEnotempty(makeFsError("ENOENT"))).toBe(false);
	});
});

describe("hasFsCode", () => {
	it("returns true when error has the given code", () => {
		expect(hasFsCode(makeFsError("ENOENT"), "ENOENT")).toBe(true);
		expect(hasFsCode(makeFsError("EACCES"), "EACCES")).toBe(true);
	});

	it("returns false when error has a different code", () => {
		expect(hasFsCode(makeFsError("ENOENT"), "EACCES")).toBe(false);
	});

	it("returns false for a plain Error", () => {
		expect(hasFsCode(new Error("no code"), "ENOENT")).toBe(false);
	});

	it("returns false for null", () => {
		expect(hasFsCode(null, "ENOENT")).toBe(false);
	});
});
