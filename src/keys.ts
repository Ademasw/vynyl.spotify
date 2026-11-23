export type KeyAction =
  | "toggle"
  | "seekBack"
  | "seekForward"
  | "prev"
  | "next"
  | "like"
  | "shuffle"
  | "repeat"
  | "fullscreen"
  | "exitFullscreen";

export type KeyInput = {
  code: string;
  shiftKey?: boolean;
  ctrlKey?: boolean;
  altKey?: boolean;
  metaKey?: boolean;
  /** True when focus is in a text field. */
  editable?: boolean;
  /** True when focus is on another Spotify widget (menu, dialog, slider...) that owns these keys. */
  foreignFocus?: boolean;
};

// event.code is the physical key, so letters work regardless of keyboard layout.
const PLAIN: Record<string, KeyAction> = {
  Space: "toggle",
  ArrowLeft: "seekBack",
  ArrowRight: "seekForward",
  KeyL: "like",
  KeyS: "shuffle",
  KeyR: "repeat",
  KeyF: "fullscreen",
  Escape: "exitFullscreen",
};

const SHIFTED: Record<string, KeyAction> = {
  ArrowLeft: "prev",
  ArrowRight: "next",
};

export function actionForKey(e: KeyInput): KeyAction | null {
  if (e.editable || e.foreignFocus || e.ctrlKey || e.altKey || e.metaKey) return null;
  return (e.shiftKey ? SHIFTED[e.code] : PLAIN[e.code]) ?? null;
}
