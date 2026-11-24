import { extractPalette, type Palette } from "./palette.ts";

const SAMPLE_SIZE = 32;
const BACKDROP_SIZE = 64;
let sampleCanvas: HTMLCanvasElement | null = null;
let backdropCanvas: HTMLCanvasElement | null = null;

export type CoverArt = { palette: Palette; backdrop: string | null };

/**
 * Reads the cover once per track: a 32x32 sample for the palette and a pre-blurred 64x64 JPEG
 * for the backdrop. Stretched by CSS it looks like a heavy blur, but costs nothing per frame.
 * Rejects if the image can't be read (e.g. no CORS).
 */
export async function coverArt(url: string): Promise<CoverArt> {
  const img = new Image();
  img.crossOrigin = "anonymous";
  img.src = url;
  await img.decode();
  sampleCanvas ??= Object.assign(document.createElement("canvas"), { width: SAMPLE_SIZE, height: SAMPLE_SIZE });
  const ctx = sampleCanvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("no 2d context");
  ctx.drawImage(img, 0, 0, SAMPLE_SIZE, SAMPLE_SIZE);
  const palette = extractPalette(ctx.getImageData(0, 0, SAMPLE_SIZE, SAMPLE_SIZE).data, SAMPLE_SIZE, SAMPLE_SIZE);

  let backdrop: string | null = null;
  try {
    backdropCanvas ??= Object.assign(document.createElement("canvas"), { width: BACKDROP_SIZE, height: BACKDROP_SIZE });
    const b = backdropCanvas.getContext("2d");
    if (b) {
      b.filter = "blur(3px)";
      // Overscan so the blur doesn't pull transparent edges in.
      b.drawImage(img, -8, -8, BACKDROP_SIZE + 16, BACKDROP_SIZE + 16);
      backdrop = backdropCanvas.toDataURL("image/jpeg", 0.85);
    }
  } catch {
    backdrop = null;
  }
  return { palette, backdrop };
}

/** Spotify image URI or URL -> https URL. */
export function imageUrl(raw: string | undefined): string | null {
  if (!raw) return null;
  if (raw.startsWith("spotify:image:")) return `https://i.scdn.co/image/${raw.slice("spotify:image:".length)}`;
  return raw;
}
