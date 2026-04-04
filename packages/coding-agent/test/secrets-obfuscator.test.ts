/**
 * Tests for secrets obfuscation: obfuscate/deobfuscate round-trips,
 * regex discovery, and message-level obfuscation.
 */

import { describe, expect, it } from "bun:test";
import type { Message } from "@oh-my-pi/pi-ai";
import { obfuscateMessages, SecretObfuscator } from "../src/secrets/obfuscator";
import { compileSecretRegex } from "../src/secrets/regex";

// ══════════════════════════════════════════════════════════════════════════════
// compileSecretRegex
// ══════════════════════════════════════════════════════════════════════════════

describe("compileSecretRegex", () => {
	it("compiles pattern with explicit flags and enforces global scanning", () => {
		const regex = compileSecretRegex("api[_-]?key\\s*=\\s*\\w+", "gi");
		expect(regex.source).toBe("api[_-]?key\\s*=\\s*\\w+");
		expect(regex.flags).toBe("gi");
	});

	it("adds global flag when not provided", () => {
		const regex = compileSecretRegex("api[_-]?key\\s*=\\s*\\w+", "i");
		expect(regex.source).toBe("api[_-]?key\\s*=\\s*\\w+");
		expect(regex.flags).toBe("gi");
	});

	it("defaults to global flag when no flags provided", () => {
		const regex = compileSecretRegex("api[_-]?key\\s*=\\s*\\w+");
		expect(regex.source).toBe("api[_-]?key\\s*=\\s*\\w+");
		expect(regex.flags).toBe("g");
	});

	it("parses literal regex syntax /pattern/flags", () => {
		const regex = compileSecretRegex("/sk-[A-Z0-9]{10}/i");
		expect(regex.source).toBe("sk-[A-Z0-9]{10}");
		expect(regex.flags).toBe("gi");
	});

	it("rejects invalid regex pattern", () => {
		expect(() => compileSecretRegex("(")).toThrow();
	});

	it("rejects invalid regex flags", () => {
		expect(() => compileSecretRegex("x", "zz")).toThrow();
	});
});

// ══════════════════════════════════════════════════════════════════════════════
// Round-trip: obfuscate → deobfuscate
// ══════════════════════════════════════════════════════════════════════════════

describe("SecretObfuscator round-trip", () => {
	describe("obfuscate → deobfuscate", () => {
		it("round-trips an empty string", () => {
			const obf = new SecretObfuscator([{ type: "plain", mode: "obfuscate", content: "sk-abc123" }]);
			const obfuscated = obf.obfuscate("");
			const deobfuscated = obf.deobfuscate(obfuscated);
			expect(deobfuscated).toBe("");
		});

		it("round-trips plain text with no secrets present", () => {
			const obf = new SecretObfuscator([{ type: "plain", mode: "obfuscate", content: "sk-abc123" }]);
			const text = "Hello, this is a normal message with no secrets.";
			const obfuscated = obf.obfuscate(text);
			const deobfuscated = obf.deobfuscate(obfuscated);
			expect(obfuscated).toBe(text);
			expect(deobfuscated).toBe(text);
		});

		it("round-trips text with a plain-text secret", () => {
			const obf = new SecretObfuscator([{ type: "plain", mode: "obfuscate", content: "sk-abc123" }]);
			const original = "My API key is sk-abc123 and it's secret.";
			const obfuscated = obf.obfuscate(original);
			const deobfuscated = obf.deobfuscate(obfuscated);
			expect(obfuscated).not.toContain("sk-abc123");
			expect(deobfuscated).toBe(original);
		});

		it("round-trips text where the secret is already a placeholder (idempotent obfuscate)", () => {
			const obf = new SecretObfuscator([{ type: "plain", mode: "obfuscate", content: "sk-abc123" }]);
			const text = "Key: <<$env:S0>>";
			// Obfuscating already-obfuscated text should be stable
			const reobfuscated = obf.obfuscate(text);
			expect(reobfuscated).toBe(text);
			expect(obf.deobfuscate(reobfuscated)).toBe("Key: sk-abc123");
		});

		it("round-trips multiple different plain-text secrets", () => {
			const obf = new SecretObfuscator([
				{ type: "plain", mode: "obfuscate", content: "token-aaa" },
				{ type: "plain", mode: "obfuscate", content: "token-bbb" },
			]);
			const original = "First: token-aaa, second: token-bbb";
			const obfuscated = obf.obfuscate(original);
			const deobfuscated = obf.deobfuscate(obfuscated);
			expect(obfuscated).not.toContain("token-aaa");
			expect(obfuscated).not.toContain("token-bbb");
			expect(deobfuscated).toBe(original);
		});

		it("handles a plain-text secret that appears multiple times", () => {
			const obf = new SecretObfuscator([{ type: "plain", mode: "obfuscate", content: "SECRET" }]);
			const original = "SECRET used twice: SECRET and SECRET";
			const obfuscated = obf.obfuscate(original);
			const deobfuscated = obf.deobfuscate(obfuscated);
			expect(deobfuscated).toBe(original);
			expect(obfuscated).not.toContain("SECRET");
		});
	});

	describe("null / undefined / empty handling", () => {
		// The function signature is `obfuscate(text: string)`. These tests confirm
		// the safe equivalent of null/undefined (empty-or-identity behaviour).

		it("obfuscate returns the input unchanged when no secrets are configured", () => {
			const obf = new SecretObfuscator([]);
			expect(obf.obfuscate("")).toBe("");
			expect(obf.obfuscate("hello world")).toBe("hello world");
		});

		it("deobfuscate returns the input unchanged when no secrets are configured", () => {
			const obf = new SecretObfuscator([]);
			expect(obf.deobfuscate("")).toBe("");
			expect(obf.deobfuscate("hello <<$env:S0>>")).toBe("hello <<$env:S0>>");
		});

		it("hasSecrets returns false for empty entry list", () => {
			const obf = new SecretObfuscator([]);
			expect(obf.hasSecrets()).toBe(false);
			expect(obf.obfuscate("any text")).toBe("any text");
			expect(obf.deobfuscate("any text")).toBe("any text");
		});
	});
});

// ══════════════════════════════════════════════════════════════════════════════
// Replace mode (one-way — NOT reversed by deobfuscate)
// ══════════════════════════════════════════════════════════════════════════════

describe("SecretObfuscator replace mode", () => {
	it("replaces with a custom replacement string (not reversed)", () => {
		const obf = new SecretObfuscator([
			{ type: "plain", mode: "replace", content: "my-password", replacement: "[REDACTED]" },
		]);
		const original = "Password: my-password";
		const obfuscated = obf.obfuscate(original);
		const deobfuscated = obf.deobfuscate(obfuscated);
		expect(obfuscated).toBe("Password: [REDACTED]");
		// Replace mode is NOT reversed
		expect(deobfuscated).toBe(obfuscated);
		expect(deobfuscated).not.toBe(original);
	});

	it("replace mode uses auto-generated replacement when no replacement provided", () => {
		const obf = new SecretObfuscator([{ type: "plain", mode: "replace", content: "secret-key-xyz" }]);
		const obfuscated = obf.obfuscate("Key: secret-key-xyz");
		expect(obfuscated).not.toContain("secret-key-xyz");
		expect(obf.deobfuscate(obfuscated)).toBe(obfuscated); // not reversed
	});

	it("replace loop takes precedence over obfuscate loop for the same secret", () => {
		// When two entries share the same secret, replace runs first
		const obf = new SecretObfuscator([
			{ type: "plain", mode: "replace", content: "api-key", replacement: "[KEY]" },
			{ type: "plain", mode: "obfuscate", content: "api-key" },
		]);
		const obfuscated = obf.obfuscate("Key: api-key");
		// Replace runs before obfuscate, so replace wins
		expect(obfuscated).toBe("Key: [KEY]");
	});

	it("regex replace mode replaces without reversible placeholders", () => {
		const obf = new SecretObfuscator([
			{ type: "regex", content: "key=[A-Za-z0-9]+", mode: "replace", replacement: "[API_KEY]" },
		]);
		const original = "key=supersecret";
		const obfuscated = obf.obfuscate(original);
		expect(obfuscated).toBe("[API_KEY]");
		expect(obf.deobfuscate(obfuscated)).toBe(obfuscated); // not reversed
	});
});

// ══════════════════════════════════════════════════════════════════════════════
// Regex entry — discovery & round-trip
// ══════════════════════════════════════════════════════════════════════════════

describe("SecretObfuscator regex discovery", () => {
	it("discovers and round-trips secrets matched by a regex pattern", () => {
		const obf = new SecretObfuscator([{ type: "regex", content: "sk-[A-Z0-9]{20}", mode: "obfuscate" }]);
		const original = "Token: sk-ABCDEFGHIJKLMNOPQRSTU";
		const obfuscated = obf.obfuscate(original);
		const deobfuscated = obf.deobfuscate(obfuscated);
		expect(obfuscated).not.toContain("sk-ABCDEFGHIJKLMNOPQRSTU");
		expect(deobfuscated).toBe(original);
	});

	it("round-trips multiple regex matches in one text", () => {
		const obf = new SecretObfuscator([{ type: "regex", content: "token=[A-Za-z0-9]+", mode: "obfuscate" }]);
		const original = "First token=abc123 and second token=xyz789";
		const obfuscated = obf.obfuscate(original);
		const deobfuscated = obf.deobfuscate(obfuscated);
		expect(deobfuscated).toBe(original);
		expect(obfuscated).not.toContain("token=abc123");
		expect(obfuscated).not.toContain("token=xyz789");
	});

	it("regex entry with invalid pattern does not throw during obfuscation", () => {
		const obf = new SecretObfuscator([
			{ type: "regex", content: "valid-pattern\\d+", mode: "obfuscate" },
			{ type: "regex", content: "(", mode: "obfuscate" }, // invalid — silently skipped
		]);
		const result = obf.obfuscate("pattern123");
		expect(result).toBe(result);
	});

	it("regex entry with zero-length match does not loop forever", () => {
		const obf = new SecretObfuscator([{ type: "regex", content: "x*", mode: "obfuscate" }]);
		const result = obf.obfuscate("hello");
		// Should complete without hanging; zero-length match on non-empty text
		expect(result).toBe("hello");
	});

	it("regex pattern with literal syntax /pattern/flags is parsed correctly", () => {
		const obf = new SecretObfuscator([{ type: "regex", content: "/sk-[A-Z0-9]{10}/i", mode: "obfuscate" }]);
		const original = "Token SK-1234567890";
		const obfuscated = obf.obfuscate(original);
		const deobfuscated = obf.deobfuscate(obfuscated);
		expect(deobfuscated).toBe(original);
	});

	it("regex discovered secrets are stable across multiple obfuscate calls", () => {
		const obf = new SecretObfuscator([{ type: "regex", content: "key=[A-Za-z0-9]+", mode: "obfuscate" }]);
		const first = obf.obfuscate("key=abc");
		const second = obf.obfuscate("key=abc");
		expect(first).toBe(second);
		expect(obf.deobfuscate(first)).toBe("key=abc");
		expect(obf.deobfuscate(second)).toBe("key=abc");
	});

	it("same secret value discovered by regex reuses the plain-text index", () => {
		const obf = new SecretObfuscator([
			{ type: "plain", mode: "obfuscate", content: "KEY-123" },
			{ type: "regex", content: "KEY-[0-9]+", mode: "obfuscate" },
		]);
		const text = "KEY-123";
		const obfuscated = obf.obfuscate(text);
		// Should use the plain-text placeholder (index 0)
		expect(obfuscated).toContain("<<$env:S0>>");
		expect(obf.deobfuscate(obfuscated)).toBe(text);
	});

	it("obfuscates and deobfuscates regex matches with flags", () => {
		const obf = new SecretObfuscator([{ type: "regex", content: "api[_-]?key\\s*=\\s*\\w+", flags: "i" }]);
		const original = "API_KEY=abc and api-key=def";
		const obfuscated = obf.obfuscate(original);
		expect(obfuscated).not.toEqual(original);
		expect(obf.deobfuscate(obfuscated)).toEqual(original);
	});
});

// ══════════════════════════════════════════════════════════════════════════════
// detectSecrets — verifying detection via round-trip
// ══════════════════════════════════════════════════════════════════════════════

describe("SecretObfuscator detectSecrets", () => {
	it("returns empty for text with no matching secrets", () => {
		const obf = new SecretObfuscator([{ type: "regex", content: "sk-[A-Z0-9]+", mode: "obfuscate" }]);
		const text = "This has no secrets at all.";
		const obfuscated = obf.obfuscate(text);
		// No change — nothing matched
		expect(obfuscated).toBe(text);
	});

	it("detects multiple secrets of the same type via regex", () => {
		const obf = new SecretObfuscator([{ type: "regex", content: "token=[A-Za-z0-9]+", mode: "obfuscate" }]);
		const text = "token=a token=b token=c";
		const obfuscated = obf.obfuscate(text);
		// All three should be replaced
		expect(obfuscated).not.toContain("token=a");
		expect(obfuscated).not.toContain("token=b");
		expect(obfuscated).not.toContain("token=c");
		// And round-trip restores all
		expect(obf.deobfuscate(obfuscated)).toBe(text);
	});

	it("detects secrets via plain-text entries", () => {
		const obf = new SecretObfuscator([{ type: "plain", mode: "obfuscate", content: "hunter2" }]);
		const text = "The password is hunter2";
		const obfuscated = obf.obfuscate(text);
		expect(obfuscated).not.toContain("hunter2");
		expect(obf.deobfuscate(obfuscated)).toBe(text);
	});

	it("detects both plain and regex secrets in the same text", () => {
		const obf = new SecretObfuscator([
			{ type: "plain", mode: "obfuscate", content: "static-key" },
			{ type: "regex", content: "dyn=[A-Za-z0-9]+", mode: "obfuscate" },
		]);
		const text = "Static: static-key, dynamic: dyn=abc123";
		const obfuscated = obf.obfuscate(text);
		const deobfuscated = obf.deobfuscate(obfuscated);
		expect(deobfuscated).toBe(text);
		expect(obfuscated).not.toContain("static-key");
		expect(obfuscated).not.toContain("dyn=abc123");
	});
});

// ══════════════════════════════════════════════════════════════════════════════
// Secret replacement patterns — API keys, tokens, passwords
// ══════════════════════════════════════════════════════════════════════════════

describe("SecretObfuscator pattern coverage", () => {
	it("obfuscates and restores an OpenAI-style API key (sk-...)", () => {
		const obf = new SecretObfuscator([{ type: "regex", content: "sk-[A-Za-z0-9_-]{20,}", mode: "obfuscate" }]);
		const original = "Authorization: Bearer sk-abcdefghijklmnopqrstuv";
		const obfuscated = obf.obfuscate(original);
		const deobfuscated = obf.deobfuscate(obfuscated);
		expect(deobfuscated).toBe(original);
		expect(obfuscated).not.toContain("sk-abcdefghijklmnopqrstuv");
	});

	it("obfuscates and restores a GitHub token (ghp_...)", () => {
		const obf = new SecretObfuscator([{ type: "regex", content: "gh[pousr]_[A-Za-z0-9_]{36,}", mode: "obfuscate" }]);
		const original = "ghp_abcdefghijklmnopqrstuvwxyz1234567890ab";
		const text = `Token: ${original}`;
		const obfuscated = obf.obfuscate(text);
		const deobfuscated = obf.deobfuscate(obfuscated);
		expect(deobfuscated).toBe(text);
		expect(obfuscated).not.toContain(original);
	});

	it("obfuscates and restores a password in a URL query param", () => {
		const obf = new SecretObfuscator([{ type: "regex", content: "password=[^&\\s]+", mode: "obfuscate" }]);
		const original = "https://api.example.com/login?password=supersecret&user=admin";
		const obfuscated = obf.obfuscate(original);
		const deobfuscated = obf.deobfuscate(obfuscated);
		expect(deobfuscated).toBe(original);
		expect(obfuscated).not.toContain("supersecret");
	});

	it("obfuscates and restores an AWS-style access key (AKIA...)", () => {
		const obf = new SecretObfuscator([{ type: "regex", content: "AKIA[A-Z0-9]{16}", mode: "obfuscate" }]);
		const original = "AKIATEST1234567890AB";
		const text = `AWS Key: ${original}`;
		const obfuscated = obf.obfuscate(text);
		const deobfuscated = obf.deobfuscate(obfuscated);
		expect(deobfuscated).toBe(text);
		expect(obfuscated).not.toContain(original);
	});

	it("obfuscates and restores a bearer token in an Authorization header", () => {
		const obf = new SecretObfuscator([{ type: "regex", content: "Bearer\\s+[A-Za-z0-9_.-]+", mode: "obfuscate" }]);
		const original = "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9";
		const obfuscated = obf.obfuscate(original);
		const deobfuscated = obf.deobfuscate(obfuscated);
		expect(deobfuscated).toBe(original);
		expect(obfuscated).not.toContain("eyJ");
	});

	it("obfuscates and restores a private key block", () => {
		const obf = new SecretObfuscator([
			{ type: "regex", content: "-----BEGIN [A-Z ]+ PRIVATE KEY-----", mode: "obfuscate" },
		]);
		const original = "-----BEGIN RSA PRIVATE KEY-----\nMIIBOgIBAAJBAL\n-----END RSA PRIVATE KEY-----";
		const text = `Key:\n${original}`;
		const obfuscated = obf.obfuscate(text);
		const deobfuscated = obf.deobfuscate(obfuscated);
		expect(deobfuscated).toBe(text);
		expect(obfuscated).not.toContain("BEGIN RSA PRIVATE KEY");
	});

	it("obfuscates plain-text password entries", () => {
		const obf = new SecretObfuscator([
			{ type: "plain", mode: "obfuscate", content: "hunter2" },
			{ type: "plain", mode: "obfuscate", content: "correct horse battery staple" },
		]);
		const original = "Password: hunter2, Passphrase: correct horse battery staple";
		const obfuscated = obf.obfuscate(original);
		const deobfuscated = obf.deobfuscate(obfuscated);
		expect(deobfuscated).toBe(original);
		expect(obfuscated).not.toContain("hunter2");
		expect(obfuscated).not.toContain("correct horse battery staple");
	});

	it("obfuscates nested secrets in a multi-line config string", () => {
		const obf = new SecretObfuscator([
			{ type: "plain", mode: "obfuscate", content: "db_password" },
			{ type: "regex", content: "api_key[=:][A-Za-z0-9_-]+", mode: "obfuscate" },
		]);
		const original = [
			"database: postgres",
			"db_password: S3cr3t!",
			"api_key:sk-test1234567890abcdef", // no space so [A-Za-z0-9_-]+ matches"
		].join("\n");
		const obfuscated = obf.obfuscate(original);
		const deobfuscated = obf.deobfuscate(obfuscated);
		expect(deobfuscated).toBe(original);
		expect(obfuscated).not.toContain("db_password: S3cr3t!");
		expect(obfuscated).not.toContain("api_key: sk-test1234567890abcdef");
	});
});

// ══════════════════════════════════════════════════════════════════════════════
// deobfuscateObject — deep walk
// ══════════════════════════════════════════════════════════════════════════════

describe("SecretObfuscator deobfuscateObject", () => {
	it("restores secrets nested inside plain objects", () => {
		const obf = new SecretObfuscator([{ type: "plain", mode: "obfuscate", content: "secret-key" }]);
		const obfuscated = {
			key: obf.obfuscate("secret-key"),
			unrelated: "value",
		};
		const restored = obf.deobfuscateObject(obfuscated);
		expect(restored).toEqual({ key: "secret-key", unrelated: "value" });
	});

	it("restores secrets inside arrays", () => {
		const obf = new SecretObfuscator([{ type: "regex", content: "token=[A-Za-z0-9]+", mode: "obfuscate" }]);
		const strings = ["first token=aaa", "second token=bbb"];
		const obfuscatedList = strings.map(s => obf.obfuscate(s));
		const restored = obf.deobfuscateObject(obfuscatedList);
		expect(restored).toEqual(strings);
	});

	it("restores secrets in deeply nested structures", () => {
		const obf = new SecretObfuscator([{ type: "plain", mode: "obfuscate", content: "deep-secret" }]);
		const obfuscated = {
			level1: {
				level2: {
					level3: {
						secret: obf.obfuscate("deep-secret"),
					},
				},
			},
		};
		const restored = obf.deobfuscateObject(obfuscated);
		expect(restored).toEqual({
			level1: {
				level2: {
					level3: {
						secret: "deep-secret",
					},
				},
			},
		});
	});

	it("returns the same object reference when no secrets are configured", () => {
		const obf = new SecretObfuscator([]);
		const obj = { a: 1, b: "hello", c: [1, 2, 3] };
		const result = obf.deobfuscateObject(obj);
		expect(result).toBe(obj);
	});

	it("returns the same reference when no deobfuscation changes are needed", () => {
		const obf = new SecretObfuscator([{ type: "plain", mode: "obfuscate", content: "x" }]);
		// Nothing in this object matches the secret
		const obj = { a: 1 };
		const result = obf.deobfuscateObject(obj);
		expect(result).toBe(obj);
	});

	it("handles mixed types in arrays (non-string values preserved)", () => {
		const obf = new SecretObfuscator([{ type: "plain", mode: "obfuscate", content: "pw" }]);
		const obfuscated = [{ pass: obf.obfuscate("pw") }, 42, null, true, ["nested", obf.obfuscate("pw")]];
		const restored = obf.deobfuscateObject(obfuscated);
		expect(restored).toEqual([{ pass: "pw" }, 42, null, true, ["nested", "pw"]]);
	});
});

// ══════════════════════════════════════════════════════════════════════════════
// obfuscateMessages — LLM message content interception
// ══════════════════════════════════════════════════════════════════════════════

describe("obfuscateMessages", () => {
	it("returns the same reference when no block changed (array content, no secrets)", () => {
		const obf = new SecretObfuscator([{ type: "plain", mode: "obfuscate", content: "secret-key" }]);
		// Message content is a plain string — Array.isArray is false, so fn returns msg unchanged
		// @ts-expect-error — runtime: content is string, not array
		const messages: Message[] = [{ role: "user", content: "Hello world" }];
		const result = obfuscateMessages(obf, messages as any);
		expect(result[0]).toBe(messages[0] as any);
	});

	it("obfuscates text content in user messages (array content)", () => {
		const obf = new SecretObfuscator([{ type: "plain", mode: "obfuscate", content: "secret-key" }]);
		const messages = [{ role: "user", content: [{ type: "text", text: "Here is my key: secret-key" }] }];
		const result = obfuscateMessages(obf, messages as any);
		expect(result).not.toBe(messages);
		const textBlock = (result[0] as any).content.find((b: { type: string }) => b.type === "text");
		expect(textBlock?.text).not.toContain("secret-key");
		expect(obf.deobfuscate(textBlock?.text ?? "")).toContain("secret-key");
	});

	it("returns the same message objects when no block changed (string content)", () => {
		const obf = new SecretObfuscator([{ type: "plain", mode: "obfuscate", content: "secret-key" }]);
		const messages = [{ role: "system", content: "You are helpful." }] as any;
		const result = obfuscateMessages(obf, messages as any);
		// String content: Array.isArray is false → fn returns msg unchanged.
		// map() creates new array but same item refs.
		expect(result[0]).toBe(messages[0] as any);
	});

	it("leaves non-text content blocks unchanged", () => {
		const obf = new SecretObfuscator([{ type: "plain", mode: "obfuscate", content: "secret-key" }]);
		const messages: any = [
			{
				role: "user",
				content: [
					{ type: "text", text: "Here is the key: secret-key" },
					{ type: "image", source: { type: "base64", media_type: "image/png", data: "abc" } } as any,
				] as any,
			},
		] as any;
		const result = obfuscateMessages(obf, messages as any);
		const textBlock = (result[0].content as Array<{ type: string; text?: string }>).find(b => b.type === "text");
		const imageBlock = (result[0] as any).content.find((b: any) => b.type === "image");
		expect(textBlock?.text).not.toContain("secret-key");
		expect(imageBlock).toBeDefined();
	});

	it("handles string content (non-array) gracefully — returns same reference", () => {
		const obf = new SecretObfuscator([{ type: "plain", mode: "obfuscate", content: "x" }]);
		const messages = [{ role: "user", content: "hello" }];
		const result = obfuscateMessages(obf, messages as any);
		expect(result[0]).toBe(messages[0] as any);
	});
});

// ══════════════════════════════════════════════════════════════════════════════
// hasSecrets
// ══════════════════════════════════════════════════════════════════════════════

describe("SecretObfuscator hasSecrets", () => {
	it("returns false when no entries are provided", () => {
		const obf = new SecretObfuscator([]);
		expect(obf.hasSecrets()).toBe(false);
	});

	it("returns true when at least one plain entry is provided", () => {
		const obf = new SecretObfuscator([{ type: "plain", mode: "obfuscate", content: "key" }]);
		expect(obf.hasSecrets()).toBe(true);
	});

	it("returns true when only regex entries are provided", () => {
		const obf = new SecretObfuscator([{ type: "regex", content: "sk-[A-Z0-9]+", mode: "obfuscate" }]);
		expect(obf.hasSecrets()).toBe(true);
	});
});

// ══════════════════════════════════════════════════════════════════════════════
// Edge cases & boundary conditions
// ══════════════════════════════════════════════════════════════════════════════

describe("SecretObfuscator edge cases", () => {
	it("placeholder length: long secrets stay exact, short secrets expand to minimum format", () => {
		const obf = new SecretObfuscator([
			{ type: "plain", mode: "obfuscate", content: "SHORT" }, // 5 chars
			{ type: "plain", mode: "obfuscate", content: "LONGER_SECRET" }, // 13 chars
		]);
		const short = obf.obfuscate("Key: SHORT");
		const long = obf.obfuscate("Key: LONGER_SECRET");
		// buildPlaceholder: bare <<$env:S0>> is 11 chars.
		// SHORT=5 < 11 → no extra padding, placeholder stays bare (11 chars).
		// LONGER_SECRET=13 ≥ 11 → paddingNeeded=2 → total placeholder = 13 (exact).
		expect(short).toBe("Key: <<$env:S0>>");
		expect(long).toBe("Key: <<$env:S1=..>>");
	});

	it("handles an empty secret string gracefully", () => {
		const obf = new SecretObfuscator([{ type: "plain", mode: "obfuscate", content: "" }]);
		const text = "Before and after empty secret";
		const result = obf.obfuscate(text);
		// Empty string search in replaceAll is a no-op by design
		expect(result).toBe(text);
	});

	it("handles a regex that matches the entire input", () => {
		const obf = new SecretObfuscator([{ type: "regex", content: ".+", mode: "obfuscate" }]);
		const original = "everything is secret";
		const obfuscated = obf.obfuscate(original);
		const deobfuscated = obf.deobfuscate(obfuscated);
		expect(deobfuscated).toBe(original);
	});

	it("plain-text secret replaces all occurrences including substrings", () => {
		const obf = new SecretObfuscator([{ type: "plain", mode: "obfuscate", content: "key" }]);
		const original = "Use keyboard for input";
		const obfuscated = obf.obfuscate(original);
		// "key" inside "keyboard" is also replaced — plain match is substring-based
		const deobfuscated = obf.deobfuscate(obfuscated);
		expect(deobfuscated).toBe(original);
	});

	it("regex respects word boundaries when configured", () => {
		const obf = new SecretObfuscator([{ type: "regex", content: "\\bapi_key=[A-Za-z0-9]+\\b", mode: "obfuscate" }]);
		const original = "api_key=secret and api_key_abc is not a match";
		const obfuscated = obf.obfuscate(original);
		const deobfuscated = obf.deobfuscate(obfuscated);
		expect(deobfuscated).toBe(original);
		// Only the standalone "api_key=secret" should be replaced
		expect(obfuscated).not.toContain("api_key=secret");
		// The word-boundary match should not consume "api_key_abc"
		expect(obfuscated).toContain("api_key_abc");
	});

	it("plain secrets are processed longest-first to avoid double-replacement", () => {
		// Longer secrets first prevents "api-key" from consuming chars from "api-key-extra"
		const obf = new SecretObfuscator([
			{ type: "plain", mode: "obfuscate", content: "api-key-extra" },
			{ type: "plain", mode: "obfuscate", content: "api-key" },
		]);
		const original = "api-key and api-key-extra";
		const obfuscated = obf.obfuscate(original);
		const deobfuscated = obf.deobfuscate(obfuscated);
		expect(deobfuscated).toBe(original);
	});
});
