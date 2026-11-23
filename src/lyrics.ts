export type LyricLine = { startMs: number; text: string };

export type Lyrics =
  | { kind: "synced" | "unsynced"; lines: LyricLine[] }
  | { kind: "none" };

const NONE: Lyrics = { kind: "none" };

export function parseLyrics(json: unknown): Lyrics {
  const lyrics = (json as { lyrics?: { syncType?: unknown; lines?: unknown } } | null)?.lyrics;
  if (!lyrics || !Array.isArray(lyrics.lines) || lyrics.lines.length === 0) return NONE;

  const lines: LyricLine[] = lyrics.lines.map((raw: { startTimeMs?: unknown; words?: unknown }) => ({
    startMs: Number(raw?.startTimeMs) || 0,
    text: typeof raw?.words === "string" ? raw.words : "",
  }));

  // LINE_SYNCED and SYLLABLE_SYNCED both carry per-line start times.
  const synced = lyrics.syncType === "LINE_SYNCED" || lyrics.syncType === "SYLLABLE_SYNCED";
  return { kind: synced ? "synced" : "unsynced", lines };
}

/** Index of the last line whose start is <= ms, or -1 before the first line. */
export function findLineIndex(lines: LyricLine[], ms: number, hint?: number): number {
  // Fast path for normal playback: still on the hinted line, or just moved to the next one.
  if (hint !== undefined && hint >= 0 && hint < lines.length && lines[hint].startMs <= ms) {
    const next = lines[hint + 1];
    if (!next || next.startMs > ms) return hint;
    const afterNext = lines[hint + 2];
    if (!afterNext || afterNext.startMs > ms) return hint + 1;
  }

  let lo = 0;
  let hi = lines.length - 1;
  let found = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (lines[mid].startMs <= ms) {
      found = mid;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }
  return found;
}

export async function fetchLyrics(
  trackUri: string,
  get: (url: string) => Promise<unknown>,
): Promise<Lyrics> {
  const match = /^spotify:track:([A-Za-z0-9]+)$/.exec(trackUri);
  if (!match) return NONE;
  const url = `https://spclient.wg.spotify.com/color-lyrics/v2/track/${match[1]}?format=json&vocalRemoval=false&market=from_token`;
  try {
    return parseLyrics(await get(url));
  } catch {
    return NONE;
  }
}
