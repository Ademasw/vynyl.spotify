import { test } from "node:test";
import assert from "node:assert/strict";
import { isSoftwareRenderer, chooseLiteMode } from "../src/gpu.ts";

test("no WebGL at all means software rendering", () => {
  assert.equal(isSoftwareRenderer(null), true);
});

test("known software rasterizers are detected", () => {
  assert.equal(isSoftwareRenderer("Google SwiftShader"), true);
  assert.equal(isSoftwareRenderer("ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (Subzero)), SwiftShader driver)"), true);
  assert.equal(isSoftwareRenderer("llvmpipe (LLVM 15.0.7, 256 bits)"), true);
  assert.equal(isSoftwareRenderer("ANGLE (Microsoft, Microsoft Basic Render Driver Direct3D11)"), true);
});

test("real GPUs are not software", () => {
  assert.equal(isSoftwareRenderer("ANGLE (NVIDIA, NVIDIA GeForce RTX 3050 Laptop GPU Direct3D11 vs_5_0 ps_5_0, D3D11)"), false);
  assert.equal(isSoftwareRenderer("ANGLE (Intel, Intel(R) Iris(R) Xe Graphics Direct3D11 vs_5_0 ps_5_0, D3D11)"), false);
});

test("a saved override beats detection", () => {
  assert.equal(chooseLiteMode("1", false), true);
  assert.equal(chooseLiteMode("0", true), false);
  assert.equal(chooseLiteMode(null, true), true);
  assert.equal(chooseLiteMode(null, false), false);
});
