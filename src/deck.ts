/** One visual turn of the record; scratching one turn also moves playback by this much. */
export const SPIN_MS = 8000;

export function armProgress(ms: number, durationMs: number): number {
  if (!(durationMs > 0)) return 0;
  return Math.min(1, Math.max(0, ms / durationMs));
}

/** Signed change from one angle to another in degrees, the short way round: (-180, 180]. */
export function angleDelta(from: number, to: number): number {
  let d = (to - from) % 360;
  if (d > 180) d -= 360;
  if (d <= -180) d += 360;
  return d;
}

/** Position after skipping by deltaMs, or null when the duration is unknown. */
export function seekByTarget(progressMs: number, deltaMs: number, durationMs: number): number | null {
  if (!(durationMs > 0)) return null;
  return Math.max(0, Math.min(durationMs, progressMs + deltaMs));
}

export function scratchTargetMs(startMs: number, totalDeg: number, durationMs: number): number {
  const target = startMs + (totalDeg / 360) * SPIN_MS;
  return Math.round(Math.min(durationMs, Math.max(0, target)));
}
