import { describe, expect, it } from "bun:test";
// Re-export Command so tests can instantiate it
import { Args, Command, Flags, renderCommandHelp, renderRootHelp } from "@oh-my-pi/pi-utils/cli";

// Minimal concrete command (Command is abstract; use type cast for runtime)
const makeCmd = (argv: string[]) =>
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	new (Command as any)(argv, { bin: "test", version: "1.0.0", commands: new Map() });

describe("Flags", () => {
	it("string returns kind=string", () => expect(Flags.string().kind).toBe("string"));
	it("boolean returns kind=boolean", () => expect(Flags.boolean().kind).toBe("boolean"));
	it("integer returns kind=integer", () => expect(Flags.integer().kind).toBe("integer"));
	it("accepts char and description", () => {
		const f = Flags.string({ char: "x", description: "test" });
		expect(f.char).toBe("x");
		expect(f.description).toBe("test");
	});
	it("multiple marks flag as repeatable", () => {
		const f = Flags.string({ multiple: true });
		expect(f.multiple).toBe(true);
	});
	it("options constrains allowed values", () => {
		const f = Flags.string({ options: ["a", "b"] as const });
		expect(f.options).toEqual(["a", "b"]);
	});
	it("required marks flag as mandatory", () => {
		const f = Flags.string({ required: true });
		expect(f.required).toBe(true);
	});
});

describe("Args", () => {
	it("string returns kind=string", () => expect(Args.string().kind).toBe("string"));
	it("accepts description and required", () => {
		const a = Args.string({ description: "input", required: true });
		expect(a.description).toBe("input");
		expect(a.required).toBe(true);
	});
});

describe("Command.parse", () => {
	// Concrete command for parse tests (Command is abstract at type level)
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	const SimpleCmd = class extends (Command as any) {
		static flags = {
			verbose: Flags.boolean({ default: false }),
			name: Flags.string(),
			count: Flags.integer({ default: 0 }),
			mode: Flags.string({ options: ["fast", "slow"] as const }),
		};
		static args = { input: Args.string() };
		run() {
			return Promise.resolve();
		}
	};

	it("boolean flag defaults to false", async () => {
		const r = await makeCmd([]).parse(SimpleCmd);
		expect(r.flags.verbose).toBe(false);
	});
	it("boolean flag --verbose parses to true", async () => {
		const r = await makeCmd(["--verbose"]).parse(SimpleCmd);
		expect(r.flags.verbose).toBe(true);
	});

	it("string flag parses value", async () => {
		const r = await makeCmd(["--name", "alice"]).parse(SimpleCmd);
		expect(r.flags.name).toBe("alice");
	});

	it("integer flag parses number", async () => {
		const r = await makeCmd(["--count", "42"]).parse(SimpleCmd);
		expect(r.flags.count).toBe(42);
	});

	it("integer flag throws on NaN", async () => {
		await expect(makeCmd(["--count", "xyz"]).parse(SimpleCmd)).rejects.toThrow("integer");
	});

	it("string flag throws on invalid option", async () => {
		await expect(makeCmd(["--mode", "invalid"]).parse(SimpleCmd)).rejects.toThrow("fast, slow");
	});

	it("valid option passes", async () => {
		const r = await makeCmd(["--mode", "fast"]).parse(SimpleCmd);
		expect(r.flags.mode).toBe("fast");
	});

	it("positional arg is captured", async () => {
		const r = await makeCmd(["myfile.txt"]).parse(SimpleCmd);
		expect(r.args.input).toBe("myfile.txt");
	});

	it("argv contains all positionals", async () => {
		const r = await makeCmd(["a.txt", "b.txt"]).parse(SimpleCmd);
		expect(r.argv).toEqual(["a.txt", "b.txt"]);
	});

	it("missing required flag throws", async () => {
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const ReqCmd = class extends (Command as any) {
			static flags = { token: Flags.string({ required: true }) };
			run() {
				return Promise.resolve();
			}
		};
		await expect(makeCmd([]).parse(ReqCmd)).rejects.toThrow("Missing required flag");
	});

	it("missing required arg throws", async () => {
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const ReqArgCmd = class extends (Command as any) {
			static args = { file: Args.string({ required: true }) };
			run() {
				return Promise.resolve();
			}
		};
		await expect(makeCmd([]).parse(ReqArgCmd)).rejects.toThrow("Missing required argument");
	});
});

describe("renderRootHelp", () => {
	it("outputs bin name and version", () => {
		const config = { bin: "mybin", version: "1.2.3", commands: new Map() };
		let output = "";
		const orig = process.stdout.write;
		process.stdout.write = (s: string) => {
			output += s;
			return true;
		};
		try {
			renderRootHelp(config);
		} finally {
			process.stdout.write = orig;
		}
		expect(output).toContain("mybin");
		expect(output).toContain("1.2.3");
	});
});

describe("renderCommandHelp", () => {
	it("outputs command description", () => {
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const Cmd: any = class extends (Command as any) {
			static description = "Test command";
			static flags = { verbose: Flags.boolean() };
			run() {
				return Promise.resolve();
			}
		};
		let output = "";
		const orig = process.stdout.write;
		process.stdout.write = (s: string) => {
			output += s;
			return true;
		};
		try {
			renderCommandHelp("test", "mycmd", Cmd);
		} finally {
			process.stdout.write = orig;
		}
		expect(output).toContain("Test command");
	});
});
