export type RGB = [number, number, number];

/** corners: top-left, top-right, bottom-left, bottom-right of the cover. */
export type Palette = { corners: [RGB, RGB, RGB, RGB]; accent: RGB };

// Background stays in this lightness band so white text is always readable.
const BG_MIN_L = 0.12;
const BG_MAX_L = 0.38;
// Accent sits on a dark background, so it must be light.
const ACCENT_MIN_L = 0.62;
const ACCENT_MAX_L = 0.8;

const DEFAULT_HEX = { tl: "#5a1d6b", tr: "#2a1033", bl: "#3b1650", br: "#c45bd0", accent: "#d77be0" };

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

export function rgbToHsl([r, g, b]: RGB): [number, number, number] {
  const rn = r / 255, gn = g / 255, bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  const d = max - min;
  if (d === 0) return [0, 0, l];
  const s = d / (1 - Math.abs(2 * l - 1));
  let h: number;
  if (max === rn) h = ((gn - bn) / d) % 6;
  else if (max === gn) h = (bn - rn) / d + 2;
  else h = (rn - gn) / d + 4;
  h *= 60;
  if (h < 0) h += 360;
  return [h, s, l];
}

export function hslToRgb(h: number, s: number, l: number): RGB {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  const [r, g, b] =
    h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
  return [Math.round((r + m) * 255), Math.round((g + m) * 255), Math.round((b + m) * 255)];
}

function tuneBackground(rgb: RGB): RGB {
  const [h, s, l] = rgbToHsl(rgb);
  return hslToRgb(h, Math.min(1, s * 1.15), clamp(l, BG_MIN_L, BG_MAX_L));
}

function tuneAccent(rgb: RGB): RGB {
  const [h, s, l] = rgbToHsl(rgb);
  return hslToRgb(h, s, clamp(l, ACCENT_MIN_L, ACCENT_MAX_L));
}

/** Palette from raw RGBA pixels of a (small) cover image. */
export function extractPalette(pixels: Uint8ClampedArray, width: number, height: number): Palette {
  const sums = Array.from({ length: 4 }, () => [0, 0, 0, 0]); // r, g, b, count per quadrant
  const buckets = new Map<number, [number, number, number, number]>(); // r, g, b, count per color bucket

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      const r = pixels[i], g = pixels[i + 1], b = pixels[i + 2];
      const q = (y < height / 2 ? 0 : 2) + (x < width / 2 ? 0 : 1);
      const sum = sums[q];
      sum[0] += r; sum[1] += g; sum[2] += b; sum[3]++;

      const key = ((r >> 4) << 8) | ((g >> 4) << 4) | (b >> 4);
      const bucket = buckets.get(key);
      if (bucket) { bucket[0] += r; bucket[1] += g; bucket[2] += b; bucket[3]++; }
      else buckets.set(key, [r, g, b, 1]);
    }
  }

  const avg = (s: number[]): RGB => (s[3] ? [s[0] / s[3], s[1] / s[3], s[2] / s[3]] : [0, 0, 0]);
  const corners = sums.map((s) => tuneBackground(avg(s))) as Palette["corners"];

  // Accent: a common color, strongly favoring saturated ones over greys.
  let best: RGB | null = null;
  let bestScore = -1;
  for (const bucket of buckets.values()) {
    const color = avg(bucket);
    const [, s, l] = rgbToHsl(color);
    const usable = l > 0.12 && l < 0.92 ? 1 : 0.2;
    const score = bucket[3] * (0.15 + s * s) * usable;
    if (score > bestScore) { bestScore = score; best = color; }
  }

  return { corners, accent: tuneAccent(best ?? hexToRgb(DEFAULT_HEX.accent)!) };
}

function hexToRgb(hex: string | undefined): RGB | null {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex ?? "");
  if (!m) return null;
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** Fallback palette from Spicetify.colorExtractor output, used when the cover pixels can't be read. */
export function paletteFromHex(c: Record<string, string | undefined>): Palette {
  const pick = (key: string, fallback: string) => hexToRgb(c[key]) ?? hexToRgb(fallback)!;
  return {
    corners: [
      tuneBackground(pick("DARK_VIBRANT", DEFAULT_HEX.tl)),
      tuneBackground(pick("PROMINENT", DEFAULT_HEX.tr)),
      tuneBackground(pick("DESATURATED", DEFAULT_HEX.bl)),
      tuneBackground(pick("VIBRANT", DEFAULT_HEX.br)),
    ],
    accent: tuneAccent(pick("VIBRANT", DEFAULT_HEX.accent)),
  };
}

export const DEFAULT_PALETTE: Palette = paletteFromHex({});

export const toCss = ([r, g, b]: RGB) => `rgb(${Math.round(r)} ${Math.round(g)} ${Math.round(b)})`;
