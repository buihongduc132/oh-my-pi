import { describe, expect, it } from "bun:test";
import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import {
	InternalUrlRouter,
	MemoryProtocolHandler,
	parseInternalUrl,
	resolveMemoryUrlToPath,
} from "../../src/internal-urls";
import type { InternalUrl } from "../../src/internal-urls/types";

async function withTempDir<T>(fn: (dir: string) => Promise<T>): Promise<T> {
	const dir = await fs.mkdtemp(path.join(os.tmpdir(), "memory-protocol-"));
	try {
		return await fn(dir);
	} finally {
		await fs.rm(dir, { recursive: true, force: true });
	}
}

function createRouter(memoryRoot: string): InternalUrlRouter {
	const router = new InternalUrlRouter();
	router.register(
		new MemoryProtocolHandler({
			getMemoryRoot: () => memoryRoot,
		}),
	);
	return router;
}

function makeUrl(rawHref: string): InternalUrl {
	return parseInternalUrl(rawHref);
}

// ---------------------------------------------------------------------------
// resolveMemoryUrlToPath
// ---------------------------------------------------------------------------

describe("resolveMemoryUrlToPath", () => {
	const memoryRoot = "/fake/memory/root";

	it("(a) root namespace with no path → defaults to memory_summary.md", () => {
		const url = makeUrl("memory://root");
		const result = resolveMemoryUrlToPath(url, memoryRoot);
		expect(result).toBe(path.resolve(memoryRoot, "memory_summary.md"));
	});

	it("(b) root namespace with path → resolved correctly", () => {
		const url = makeUrl("memory://root/skills/demo/SKILL.md");
		const result = resolveMemoryUrlToPath(url, memoryRoot);
		expect(result).toBe(path.resolve(memoryRoot, "skills/demo/SKILL.md"));
	});

	it("(c) unknown namespace → throws", () => {
		const url = makeUrl("memory://other");
		expect(() => resolveMemoryUrlToPath(url, memoryRoot)).toThrow("Unknown memory namespace: other. Supported: root");
	});

	it("(d) requires namespace → throws if missing", () => {
		// The host is empty when there is no namespace part at all.
		const url = makeUrl("memory://");
		expect(() => resolveMemoryUrlToPath(url, memoryRoot)).toThrow(
			"memory:// URL requires a namespace: memory://root",
		);
	});

	it("(e) invalid URL encoding → throws", () => {
		// %E is an incomplete percent-encoding sequence; decodeURIComponent throws.
		const url = makeUrl("memory://root/%E/secret.md");
		expect(() => resolveMemoryUrlToPath(url, memoryRoot)).toThrow(/Invalid URL encoding in memory:\/\/ path/);
	});
});

// ---------------------------------------------------------------------------
// MemoryProtocolHandler.resolve
// ---------------------------------------------------------------------------

describe("MemoryProtocolHandler", () => {
	it("(a) non-existent memory root → throws with descriptive message", async () => {
		const nonExistent = "/this/path/does/not/exist/at/all";
		const router = createRouter(nonExistent);
		await expect(router.resolve("memory://root")).rejects.toThrow(
			"Memory artifacts are not available for this project yet. Run a session with memories enabled first.",
		);
	});

	it("(b) symlink traversal attempt → throws 'escapes memory root'", async () => {
		if (process.platform === "win32") return;

		await withTempDir(async tempDir => {
			const memoryRoot = path.join(tempDir, "memory");
			const outsideDir = path.join(tempDir, "outside");
			await fs.mkdir(memoryRoot, { recursive: true });
			await fs.mkdir(outsideDir, { recursive: true });
			await Bun.write(path.join(outsideDir, "secret.md"), "secret");
			// Symlink inside memory root that points outside it.
			await fs.symlink(outsideDir, path.join(memoryRoot, "link"));

			const router = createRouter(memoryRoot);
			await expect(router.resolve("memory://root/link/secret.md")).rejects.toThrow(
				"memory:// URL escapes memory root",
			);
		});
	});

	it("(c) non-file target → throws", async () => {
		await withTempDir(async tempDir => {
			const memoryRoot = path.join(tempDir, "memory");
			await fs.mkdir(path.join(memoryRoot, "subdir"), { recursive: true });

			const router = createRouter(memoryRoot);
			await expect(router.resolve("memory://root/subdir")).rejects.toThrow(/memory:\/\/ URL must resolve to a file/);
		});
	});

	it("(d) valid file → returns InternalResource with correct contentType", async () => {
		await withTempDir(async tempDir => {
			const memoryRoot = path.join(tempDir, "memory");
			await fs.mkdir(memoryRoot, { recursive: true });
			await Bun.write(path.join(memoryRoot, "data.json"), '{"key":"value"}');

			const router = createRouter(memoryRoot);
			const resource = await router.resolve("memory://root/data.json");

			expect(resource.content).toBe('{"key":"value"}');
			expect(resource.contentType).toBe("text/plain");
			expect(resource.url).toBe("memory://root/data.json");
			expect(typeof resource.size).toBe("number");
			expect(resource.size).toBeGreaterThan(0);
		});
	});

	it("(e) .md file → contentType=text/markdown", async () => {
		await withTempDir(async tempDir => {
			const memoryRoot = path.join(tempDir, "memory");
			await fs.mkdir(memoryRoot, { recursive: true });
			await Bun.write(path.join(memoryRoot, "memory_summary.md"), "# Summary");

			const router = createRouter(memoryRoot);
			const resource = await router.resolve("memory://root/memory_summary.md");

			expect(resource.content).toBe("# Summary");
			expect(resource.contentType).toBe("text/markdown");
		});
	});

	it("resolves memory://root to memory_summary.md", async () => {
		await withTempDir(async tempDir => {
			const memoryRoot = path.join(tempDir, "memory");
			await fs.mkdir(memoryRoot, { recursive: true });
			await Bun.write(path.join(memoryRoot, "memory_summary.md"), "summary");

			const router = createRouter(memoryRoot);
			const resource = await router.resolve("memory://root");

			expect(resource.content).toBe("summary");
			expect(resource.contentType).toBe("text/markdown");
		});
	});

	it("resolves memory://root/<path> within memory root", async () => {
		await withTempDir(async tempDir => {
			const memoryRoot = path.join(tempDir, "memory");
			const skillPath = path.join(memoryRoot, "skills", "demo", "SKILL.md");
			await fs.mkdir(path.dirname(skillPath), { recursive: true });
			await Bun.write(skillPath, "demo skill");

			const router = createRouter(memoryRoot);
			const resource = await router.resolve("memory://root/skills/demo/SKILL.md");

			expect(resource.content).toBe("demo skill");
			expect(resource.contentType).toBe("text/markdown");
		});
	});

	it("throws for unknown memory namespace", async () => {
		await withTempDir(async tempDir => {
			const memoryRoot = path.join(tempDir, "memory");
			await fs.mkdir(memoryRoot, { recursive: true });

			const router = createRouter(memoryRoot);
			await expect(router.resolve("memory://other/memory_summary.md")).rejects.toThrow(
				"Unknown memory namespace: other. Supported: root",
			);
		});
	});

	it("blocks path traversal attempts", async () => {
		await withTempDir(async tempDir => {
			const memoryRoot = path.join(tempDir, "memory");
			await fs.mkdir(memoryRoot, { recursive: true });

			const router = createRouter(memoryRoot);
			await expect(router.resolve("memory://root/../secret.md")).rejects.toThrow(
				"Path traversal (..) is not allowed in memory:// URLs",
			);
			await expect(router.resolve("memory://root/%2E%2E/secret.md")).rejects.toThrow(
				"Path traversal (..) is not allowed in memory:// URLs",
			);
		});
	});

	it("throws clear error for missing files", async () => {
		await withTempDir(async tempDir => {
			const memoryRoot = path.join(tempDir, "memory");
			await fs.mkdir(memoryRoot, { recursive: true });

			const router = createRouter(memoryRoot);
			await expect(router.resolve("memory://root/missing.md")).rejects.toThrow(
				"Memory file not found: memory://root/missing.md",
			);
		});
	});
});
