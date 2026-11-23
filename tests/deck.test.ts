import { test } from "node:test";
import assert from "node:assert/strict";
import { angleDelta, armProgress, scratchTargetMs, seekByTarget, SPIN_MS } from "../src/deck.ts";

test("seekByTarget moves by the delta within the track", () => {
  assert.equal(seekByTarget(10_000, 5000, 200_000), 15_000);
  assert.equal(seekByTarget(2000, -5000, 200_000), 0);
  assert.equal(seekByTarget(198_000, 5000, 200_000), 200_000);
});

test("seekByTarget does nothing when the duration is unknown, instead of restarting the track", () => {
  assert.equal(seekByTarget(10_000, 5000, 0), null);
});

test("armProgress is the played fraction of the track, clamped to 0..1", () => {
  assert.equal(armProgress(0, 200_000), 0);
  assert.equal(armProgress(50_000, 200_000), 0.25);
  assert.equal(armProgress(250_000, 200_000), 1);
  assert.equal(armProgress(-10, 200_000), 0);
});

test("armProgress is 0 when the duration is unknown", () => {
  assert.equal(armProgress(5000, 0), 0);
  assert.equal(armProgress(5000, NaN), 0);
});

test("angleDelta takes the short way around the circle", () => {
  assert.equal(angleDelta(10, 30), 20);
  assert.equal(angleDelta(30, 10), -20);
  assert.equal(angleDelta(170, -170), 20);
  assert.equal(angleDelta(-170, 170), -20);
});

test("one full clockwise turn of the disc moves playback by one spin period", () => {
  assert.equal(scratchTargetMs(60_000, 360, 200_000), 60_000 + SPIN_MS);
  assert.equal(scratchTargetMs(60_000, -180, 200_000), 60_000 - SPIN_MS / 2);
});

test("scratching cannot seek before the start or past the end", () => {
  assert.equal(scratchTargetMs(1000, -720, 200_000), 0);
  assert.equal(scratchTargetMs(199_000, 720, 200_000), 200_000);
});
