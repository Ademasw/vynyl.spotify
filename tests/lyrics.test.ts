import { test } from "node:test";
import assert from "node:assert/strict";
import { parseLyrics, findLineIndex, fetchLyrics, type LyricLine } from "../src/lyrics.ts";

const synced = {
  lyrics: {
    syncType: "LINE_SYNCED",
    lines: [
      { startTimeMs: "1000", words: "Hear me out, stay right here" },
      { startTimeMs: "5000", words: "You're my one" },
    ],
  },
};

test("parseLyrics reads line-synced lyrics with numeric start times", () => {
  assert.deepEqual(parseLyrics(synced), {
    kind: "synced",
    lines: [
      { startMs: 1000, text: "Hear me out, stay right here" },
      { startMs: 5000, text: "You're my one" },
    ],
  });
});

test("parseLyrics treats syllable-synced lyrics as line-synced", () => {
  const json = { lyrics: { ...synced.lyrics, syncType: "SYLLABLE_SYNCED" } };
  assert.equal(parseLyrics(json).kind, "synced");
});

test("parseLyrics marks non-synced lyrics as unsynced", () => {
  const json = { lyrics: { syncType: "UNSYNCED", lines: [{ startTimeMs: "0", words: "La" }] } };
  assert.equal(parseLyrics(json).kind, "unsynced");
});

test("parseLyrics returns none for missing or empty data", () => {
  assert.deepEqual(parseLyrics(null), { kind: "none" });
  assert.deepEqual(parseLyrics({}), { kind: "none" });
  assert.deepEqual(parseLyrics({ lyrics: { lines: [] } }), { kind: "none" });
});

const lines: LyricLine[] = [
  { startMs: 1000, text: "a" },
  { startMs: 5000, text: "b" },
  { startMs: 9000, text: "c" },
];

test("findLineIndex returns -1 before the first line (intro)", () => {
  assert.equal(findLineIndex(lines, 500), -1);
});

test("findLineIndex returns the last line that has started", () => {
  assert.equal(findLineIndex(lines, 1000), 0);
  assert.equal(findLineIndex(lines, 6000), 1);
  assert.equal(findLineIndex(lines, 99_999), 2);
});

test("findLineIndex goes back after seeking backwards despite a hint", () => {
  assert.equal(findLineIndex(lines, 3000, 2), 0);
});

test("findLineIndex on empty lines is -1", () => {
  assert.equal(findLineIndex([], 1000), -1);
});

test("fetchLyrics skips non-track uris without a request", async () => {
  let called = false;
  const result = await fetchLyrics("spotify:local:a:b:c:100", async () => {
    called = true;
    return synced;
  });
  assert.deepEqual(result, { kind: "none" });
  assert.equal(called, false);
});

test("fetchLyrics returns none when the request fails", async () => {
  const result = await fetchLyrics("spotify:track:abc", async () => {
    throw new Error("404");
  });
  assert.deepEqual(result, { kind: "none" });
});

test("fetchLyrics requests the color-lyrics url for the track id", async () => {
  let url = "";
  const result = await fetchLyrics("spotify:track:abc123", async (u) => {
    url = u;
    return synced;
  });
  assert.equal(
    url,
    "https://spclient.wg.spotify.com/color-lyrics/v2/track/abc123?format=json&vocalRemoval=false&market=from_token",
  );
  assert.equal(result.kind, "synced");
});
