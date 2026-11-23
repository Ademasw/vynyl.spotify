const SOFTWARE = /swiftshader|llvmpipe|softpipe|basic render|software/i;

/** True when the WebGL renderer string (null = no WebGL) points to CPU rendering. */
export function isSoftwareRenderer(renderer: string | null): boolean {
  return renderer === null || SOFTWARE.test(renderer);
}

/** A saved choice ("1" / "0") wins over detection. */
export function chooseLiteMode(saved: string | null, softwareDetected: boolean): boolean {
  if (saved === "1") return true;
  if (saved === "0") return false;
  return softwareDetected;
}

const STORAGE_KEY = "vinyl:lite";

/** Detects whether this client draws without a GPU (e.g. Spotify with hardware acceleration off). */
export function detectLiteMode(): boolean {
  let saved: string | null = null;
  try {
    saved = localStorage.getItem(STORAGE_KEY);
  } catch {
    /* storage unavailable: rely on detection */
  }
  if (saved === "1" || saved === "0") return saved === "1";

  let renderer: string | null = null;
  try {
    const gl = document.createElement("canvas").getContext("webgl");
    if (gl) {
      const info = gl.getExtension("WEBGL_debug_renderer_info");
      renderer = String(gl.getParameter(info ? info.UNMASKED_RENDERER_WEBGL : gl.RENDERER) ?? "");
      gl.getExtension("WEBGL_lose_context")?.loseContext();
    }
  } catch {
    renderer = null;
  }
  return chooseLiteMode(saved, isSoftwareRenderer(renderer));
}
