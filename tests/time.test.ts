import { test } from "node:test";
import assert from "node:assert/strict";
import { formatTime } from "../src/time.ts";

test("formatTime shows minutes and zero-padded seconds", () => {
  assert.equal(formatTime(0), "0:00");
  assert.equal(formatTime(18_500), "0:18");
  assert.equal(formatTime(130_000), "2:10");
  assert.equal(formatTime(3_600_000), "60:00");
});

test("formatTime treats negative and NaN as zero", () => {
  assert.equal(formatTime(-5), "0:00");
  assert.equal(formatTime(NaN), "0:00");
});
