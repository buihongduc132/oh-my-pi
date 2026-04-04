import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { detectSupportedImageMimeTypeFromFile } from "../../src/utils/mime";

describe("detectSupportedImageMimeTypeFromFile", () => {
	let tmpDir: string;

	beforeAll(() => {
		tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "mime-test-"));
	});

	afterAll(() => {
		fs.rmSync(tmpDir, { recursive: true });
	});

	const writeFile = (name: string, bytes: number[]) => {
		const filePath = path.join(tmpDir, name);
		fs.writeFileSync(filePath, Buffer.from(bytes));
		return filePath;
	};

	it("returns image/jpeg for JPEG (JFIF) magic bytes", async () => {
		// FF D8 FF E0 ... (JPEG SOI + APP0 marker)
		const bytes = [0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01];
		const filePath = writeFile("jpeg.jpg", bytes);
		await expect(detectSupportedImageMimeTypeFromFile(filePath)).resolves.toBe("image/jpeg");
	});

	it("returns image/png for PNG magic bytes", async () => {
		// 89 50 4E 47 0D 0A 1A 0A ... (PNG signature)
		const bytes = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d];
		const filePath = writeFile("image.png", bytes);
		await expect(detectSupportedImageMimeTypeFromFile(filePath)).resolves.toBe("image/png");
	});

	it("returns image/gif for GIF89a magic bytes", async () => {
		// 47 49 46 38 39 61 ... (GIF89a)
		const bytes = [0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00];
		const filePath = writeFile("image.gif", bytes);
		await expect(detectSupportedImageMimeTypeFromFile(filePath)).resolves.toBe("image/gif");
	});

	it("returns image/gif for GIF87a magic bytes", async () => {
		// 47 49 46 38 37 61 ... (GIF87a)
		const bytes = [0x47, 0x49, 0x46, 0x38, 0x37, 0x61, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00];
		const filePath = writeFile("image87.gif", bytes);
		await expect(detectSupportedImageMimeTypeFromFile(filePath)).resolves.toBe("image/gif");
	});

	it("returns image/webp for WebP (RIFF....WEBP) magic bytes", async () => {
		// 52 49 46 46 ... 57 45 42 50 (RIFF header + WEBP at offset 8)
		const bytes = [0x52, 0x49, 0x46, 0x46, 0x00, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50];
		const filePath = writeFile("image.webp", bytes);
		await expect(detectSupportedImageMimeTypeFromFile(filePath)).resolves.toBe("image/webp");
	});

	it("returns null for an empty file", async () => {
		const filePath = writeFile("empty.bin", []);
		await expect(detectSupportedImageMimeTypeFromFile(filePath)).resolves.toBeNull();
	});

	it("returns null for a non-image file (plain text)", async () => {
		// "hello world"
		const bytes = Array.from(Buffer.from("hello world"));
		const filePath = writeFile("plain.txt", bytes);
		await expect(detectSupportedImageMimeTypeFromFile(filePath)).resolves.toBeNull();
	});

	it("returns null for truncated JPEG bytes (only 2 bytes)", async () => {
		// FF D8 (SOI only — incomplete JPEG, needs at least 3)
		const bytes = [0xff, 0xd8];
		const filePath = writeFile("truncated.jpg", bytes);
		await expect(detectSupportedImageMimeTypeFromFile(filePath)).resolves.toBeNull();
	});

	it("returns null for truncated PNG bytes (only 7 bytes)", async () => {
		// First 7 bytes of PNG signature (needs 8)
		const bytes = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a];
		const filePath = writeFile("truncated.png", bytes);
		await expect(detectSupportedImageMimeTypeFromFile(filePath)).resolves.toBeNull();
	});

	it("returns null for truncated WebP bytes (only 11 bytes)", async () => {
		// 11 of 12 required bytes — missing final byte at offset 11 (0x50)
		const bytes = [0x52, 0x49, 0x46, 0x46, 0x00, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42];
		const filePath = writeFile("truncated.webp", bytes);
		await expect(detectSupportedImageMimeTypeFromFile(filePath)).resolves.toBeNull();
	});
});
