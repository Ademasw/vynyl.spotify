import { test } from "node:test";
import assert from "node:assert/strict";
import { extractPalette, paletteFromHex, rgbToHsl, type RGB } from "../src/palette.ts";

/** Builds an RGBA pixel buffer by calling color(x, y) for every pixel. */
function image(w: number, h: number, color: (x: number, y: number) => RGB): Uint8ClampedArray {
  const data = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const [r, g, b] = color(x, y);
      data.set([r, g, b, 255], (y * w + x) * 4);
    }
  }
  return data;
}

const hue = (rgb: RGB) => rgbToHsl(rgb)[0];
const light = (rgb: RGB) => rgbToHsl(rgb)[2];

test("rgbToHsl gives hue in degrees and saturation/lightness in 0..1", () => {
  assert.deepEqual(rgbToHsl([255, 0, 0]), [0, 1, 0.5]);
  const [h, s, l] = rgbToHsl([0, 0, 255]);
  assert.equal(h, 240);
  assert.equal(s, 1);
  assert.equal(l, 0.5);
});

test("each background corner follows the matching corner of the cover", () => {
  // Left half blue, right half yellow.
  const px = image(8, 8, (x) => (x < 4 ? [20, 40, 220] : [230, 200, 20]));
  const { corners } = extractPalette(px, 8, 8);
  const [tl, tr, bl, br] = corners;
  for (const c of [tl, bl]) assert.ok(Math.abs(hue(c) - 230) < 15, `left corner hue ${hue(c)}`);
  for (const c of [tr, br]) assert.ok(Math.abs(hue(c) - 52) < 15, `right corner hue ${hue(c)}`);
});

test("background corners stay dark enough for white text, even on a white cover", () => {
  const { corners } = extractPalette(image(4, 4, () => [255, 255, 255]), 4, 4);
  for (const c of corners) assert.ok(light(c) <= 0.42, `lightness ${light(c)}`);
});

test("background corners are not pitch black on a black cover", () => {
  const { corners } = extractPalette(image(4, 4, () => [0, 0, 0]), 4, 4);
  for (const c of corners) assert.ok(light(c) >= 0.1, `lightness ${light(c)}`);
});

test("accent picks the vivid color out of a mostly grey cover and keeps it light", () => {
  // Grey cover with a pink stripe across the top quarter.
  const px = image(16, 16, (_x, y) => (y < 4 ? [235, 60, 200] : [110, 110, 110]));
  const { accent } = extractPalette(px, 16, 16);
  assert.ok(Math.abs(hue(accent) - 311) < 15, `accent hue ${hue(accent)}`);
  assert.ok(light(accent) >= 0.6, `accent lightness ${light(accent)}`);
});

test("paletteFromHex builds a usable palette from Spotify's extracted colors", () => {
  const p = paletteFromHex({ DARK_VIBRANT: "#5a1d6b", VIBRANT: "#d25bd6", PROMINENT: "#22334f", DESATURATED: "#665566" });
  assert.equal(p.corners.length, 4);
  assert.ok(Math.abs(hue(p.accent) - 299) < 15, `accent hue ${hue(p.accent)}`);
  for (const c of p.corners) assert.ok(light(c) <= 0.42);
});

test("paletteFromHex falls back to defaults for missing or broken colors", () => {
  const p = paletteFromHex({ VIBRANT: "nope" });
  assert.equal(p.corners.length, 4);
  for (const c of [...p.corners, p.accent]) for (const v of c) assert.ok(Number.isFinite(v));
});
