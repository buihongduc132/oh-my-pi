import { describe, expect, it } from "bun:test";
import type { SSHHost } from "@oh-my-pi/pi-coding-agent/capability/ssh";
import { sshCapability } from "@oh-my-pi/pi-coding-agent/capability/ssh";

describe("sshCapability", () => {
	it("has correct id and displayName", () => {
		expect((sshCapability as any).id).toBe("ssh");
		expect((sshCapability as any).displayName).toBe("SSH Hosts");
	});

	it("generates key from host name", () => {
		const host: SSHHost = {
			name: "prod-server",
			host: "192.168.1.10",
			_source: null as any,
		};
		expect((sshCapability as any).key(host)).toBe("prod-server");
	});

	describe("validate", () => {
		const valid: SSHHost = {
			name: "web-prod",
			host: "web.example.com",
			_source: null as any,
		};

		it("returns undefined for valid host", () => {
			expect((sshCapability as any).validate(valid)).toBeUndefined();
		});

		it("returns 'Missing name' when name is empty", () => {
			const host = { ...valid, name: "" };
			expect((sshCapability as any).validate(host)).toBe("Missing name");
		});

		it("returns 'Missing host' when host is empty", () => {
			const host = { ...valid, host: "" };
			expect((sshCapability as any).validate(host)).toBe("Missing host");
		});

		it("accepts optional username", () => {
			const host: SSHHost = { ...valid, username: "deploy", _source: null as any };
			expect((sshCapability as any).validate(host)).toBeUndefined();
		});

		it("accepts optional port", () => {
			const host: SSHHost = { ...valid, port: 2222, _source: null as any };
			expect((sshCapability as any).validate(host)).toBeUndefined();
		});

		it("accepts optional keyPath", () => {
			const host: SSHHost = { ...valid, keyPath: "/home/user/.ssh/id_rsa", _source: null as any };
			expect((sshCapability as any).validate(host)).toBeUndefined();
		});

		it("accepts optional description", () => {
			const host: SSHHost = { ...valid, description: "Production web server", _source: null as any };
			expect((sshCapability as any).validate(host)).toBeUndefined();
		});

		it("accepts optional compat flag", () => {
			const host: SSHHost = { ...valid, compat: true, _source: null as any };
			expect((sshCapability as any).validate(host)).toBeUndefined();
		});

		it("accepts minimal host with only name and host", () => {
			const host: SSHHost = { name: "minimal", host: "10.0.0.1", _source: null as any };
			expect((sshCapability as any).validate(host)).toBeUndefined();
		});
	});
});
