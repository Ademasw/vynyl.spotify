import { test } from "node:test";
import assert from "node:assert/strict";
import { actionForKey } from "../src/keys.ts";

test("space toggles playback", () => {
  assert.equal(actionForKey({ code: "Space" }), "toggle");
});

test("arrows seek, shift+arrows switch tracks", () => {
  assert.equal(actionForKey({ code: "ArrowLeft" }), "seekBack");
  assert.equal(actionForKey({ code: "ArrowRight" }), "seekForward");
  assert.equal(actionForKey({ code: "ArrowLeft", shiftKey: true }), "prev");
  assert.equal(actionForKey({ code: "ArrowRight", shiftKey: true }), "next");
});

test("letter keys use physical codes, so they work on the Russian layout too", () => {
  // On the Russian layout KeyL types "д", but event.code is still "KeyL".
  assert.equal(actionForKey({ code: "KeyL" }), "like");
  assert.equal(actionForKey({ code: "KeyS" }), "shuffle");
  assert.equal(actionForKey({ code: "KeyR" }), "repeat");
  assert.equal(actionForKey({ code: "KeyF" }), "fullscreen");
  assert.equal(actionForKey({ code: "Escape" }), "exitFullscreen");
});

test("keys with ctrl, alt or meta are left to Spotify", () => {
  assert.equal(actionForKey({ code: "KeyL", ctrlKey: true }), null);
  assert.equal(actionForKey({ code: "ArrowRight", altKey: true }), null);
  assert.equal(actionForKey({ code: "Space", metaKey: true }), null);
});

test("typing in a text field is never intercepted", () => {
  assert.equal(actionForKey({ code: "Space", editable: true }), null);
  assert.equal(actionForKey({ code: "KeyF", editable: true }), null);
});

test("keys go to Spotify's own focused menus, dialogs and sliders", () => {
  assert.equal(actionForKey({ code: "ArrowRight", foreignFocus: true }), null);
  assert.equal(actionForKey({ code: "Space", foreignFocus: true }), null);
});

test("unbound keys do nothing", () => {
  assert.equal(actionForKey({ code: "KeyQ" }), null);
});
