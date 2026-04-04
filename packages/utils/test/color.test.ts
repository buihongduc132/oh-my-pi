import { describe, expect, it } from "bun:test";
import {
	adjustHsv,
	hexToHsv,
	hexToRgb,
	hsvToHex,
	hsvToRgb,
	rgbToHex,
	rgbToHsv,
	shiftHue,
} from "@oh-my-pi/pi-utils/color";

describe("hexToRgb", () => {
	it("parses 3-character hex", () => {
		expect(hexToRgb("#fff")).toEqual({ r: 255, g: 255, b: 255 });
		expect(hexToRgb("#f00")).toEqual({ r: 255, g: 0, b: 0 });
		expect(hexToRgb("#04d")).toEqual({ r: 0, g: 68, b: 221 });
	});

	it("parses 6-character hex", () => {
		expect(hexToRgb("#ff0000")).toEqual({ r: 255, g: 0, b: 0 });
		expect(hexToRgb("#000000")).toEqual({ r: 0, g: 0, b: 0 });
	});

	it("strips leading #", () => {
		expect(hexToRgb("aabbcc")).toEqual(hexToRgb("#aabbcc"));
	});
});

describe("rgbToHex", () => {
	it("converts rgb to hex string", () => {
		expect(rgbToHex({ r: 255, g: 0, b: 0 })).toBe("#ff0000");
		expect(rgbToHex({ r: 0, g: 0, b: 0 })).toBe("#000000");
	});

	it("clamps values to 0-255 range", () => {
		expect(rgbToHex({ r: 300, g: -10, b: 128 })).toBe("#ff0080");
	});

	it("pads single-digit hex components", () => {
		expect(rgbToHex({ r: 1, g: 2, b: 3 })).toBe("#010203");
	});
});

describe("rgbToHsv / hsvToRgb round-trip", () => {
	const cases: Array<{ rgb: { r: number; g: number; b: number } }> = [
		{ rgb: { r: 255, g: 0, b: 0 } },
		{ rgb: { r: 0, g: 255, b: 0 } },
		{ rgb: { r: 0, g: 0, b: 255 } },
		{ rgb: { r: 255, g: 255, b: 255 } },
		{ rgb: { r: 0, g: 0, b: 0 } },
		{ rgb: { r: 128, g: 128, b: 128 } },
	];

	for (const { rgb } of cases) {
		it(`round-trips ${JSON.stringify(rgb)}`, () => {
			const hsv = rgbToHsv(rgb);
			const back = hsvToRgb(hsv);
			expect(back.r).toBe(rgb.r);
			expect(back.g).toBe(rgb.g);
			expect(back.b).toBe(rgb.b);
		});
	}

	it("black has h=0,s=0,v=0", () => {
		const hsv = rgbToHsv({ r: 0, g: 0, b: 0 });
		expect(hsv.h).toBe(0);
		expect(hsv.s).toBe(0);
		expect(hsv.v).toBe(0);
	});

	it("white has v=1", () => {
		const hsv = rgbToHsv({ r: 255, g: 255, b: 255 });
		expect(hsv.v).toBeCloseTo(1, 4);
		expect(hsv.s).toBeCloseTo(0, 4);
	});
});

describe("hexToHsv / hsvToHex round-trip", () => {
	const cases = ["#ff0000", "#00ff00", "#0000ff", "#ffffff", "#000000", "#4ade80"];
	for (const hex of cases) {
		it(`round-trips ${hex}`, () => {
			const hsv = hexToHsv(hex);
			const back = hsvToHex(hsv);
			expect(back.toLowerCase()).toBe(hex.toLowerCase());
		});
	}
});

describe("shiftHue", () => {
	it("rotates red to green at +120°", () => {
		const green = shiftHue("#ff0000", 120);
		const hsv = hexToHsv(green);
		// green hue is 120°
		expect(hsv.h).toBeCloseTo(120, 0);
	});

	it("returns same color at +360°", () => {
		const shifted = shiftHue("#4ade80", 360);
		expect(shifted.toLowerCase()).toBe("#4ade80".toLowerCase());
	});

	it("handles negative rotation", () => {
		const red = shiftHue("#00ff00", -120);
		const hsv = hexToHsv(red);
		expect(hsv.h).toBeCloseTo(0, 0); // red hue = 0
	});
});

describe("adjustHsv", () => {
	it("{v:0.5} halves brightness", () => {
		const dim = adjustHsv("#ffffff", { v: 0.5 });
		const hsv = hexToHsv(dim);
		expect(hsv.v).toBeCloseTo(0.5, 2);
	});

	it("{s:2} caps saturation at 1", () => {
		// #ff0000 (red) has s=1, doubling → s=2, capped at 1
		const boosted = adjustHsv("#ff0000", { s: 2 });
		const hsvColorful = hexToHsv(boosted);
		expect(hsvColorful.s).toBeCloseTo(1, 2);
	});

	it("{h:60} shifts hue", () => {
		const shifted = adjustHsv("#ff0000", { h: 60 }); // 0° → 60°
		const hsv = hexToHsv(shifted);
		expect(hsv.h).toBeCloseTo(60, 0);
	});

	it("clamps value at 0", () => {
		const result = adjustHsv("#000000", { v: 2 });
		const hsv = hexToHsv(result);
		expect(hsv.v).toBe(0);
	});
});
