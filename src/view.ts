import { formatTime } from "./time.ts";
import type { Lyrics } from "./lyrics.ts";
import { toCss, type Palette } from "./palette.ts";
import { angleDelta, armProgress, scratchTargetMs, SPIN_MS } from "./deck.ts";

export type TrackInfo = { title: string; artist: string; cover: string | null; durationMs: number };

/** 0 = off, 1 = repeat context, 2 = repeat track. */
export type RepeatMode = 0 | 1 | 2;

export type ViewActions = {
  toggle(): void;
  next(): void;
  back(): void;
  queue(): void;
  seek(ms: number): void;
  like(): void;
  shuffle(): void;
  repeat(): void;
  fullscreen(): void;
};

export type View = {
  setTrack(t: TrackInfo): void;
  setPlaying(p: boolean): void;
  setProgress(ms: number, durationMs: number): void;
  setLyrics(l: Lyrics): void;
  setLyricsLoading(): void;
  setLyricIndex(i: number): void;
  setUpNext(text: string | null): void;
  setPalette(p: Palette): void;
  setLiked(liked: boolean): void;
  setShuffle(on: boolean): void;
  setRepeat(mode: RepeatMode): void;
  setFullscreen(on: boolean): void;
  /** The element that goes fullscreen. */
  readonly page: HTMLElement;
  destroy(): void;
};

const REPEAT_PATH = '<path d="M7 7h10v3l4-4-4-4v3H5v6h2zm10 10H7v-3l-4 4 4 4v-3h12v-6h-2z"/>';

const ICONS = {
  queue: '<path d="M3 5h12v2H3zm0 4h12v2H3zm0 4h8v2H3zm14 0v-4h2v4h3l-4 5-4-5z"/>',
  back: '<path d="M6 5h2v14H6zm3.5 7L19 5v14z"/>',
  play: '<path d="M8 5v14l11-7z"/>',
  pause: '<path d="M7 5h4v14H7zm6 0h4v14h-4z"/>',
  next: '<path d="M16 5h2v14h-2zM5 5l9.5 7L5 19z"/>',
  shuffle:
    '<path d="M10.6 9.2 5.4 4 4 5.4l5.2 5.2zM14.5 4l2 2L4 18.6 5.4 20 18 7.5l2 2V4zm.3 9.4-1.4 1.4 3.1 3.1-2 2.1H20v-5.5l-2 2z"/>',
  repeat: REPEAT_PATH,
  repeatOne: REPEAT_PATH + '<path d="M13 15V9h-1l-2 1v1h1.5v4z"/>',
  heart:
    '<path d="M16.5 3c-1.7 0-3.4.8-4.5 2.1C10.9 3.8 9.2 3 7.5 3 4.4 3 2 5.4 2 8.5c0 3.8 3.4 6.9 8.6 11.5l1.4 1.3 1.4-1.3C18.6 15.4 22 12.3 22 8.5 22 5.4 19.6 3 16.5 3zm-4.4 15.6-.1.1-.1-.1C7.1 14.2 4 11.4 4 8.5 4 6.5 5.5 5 7.5 5c1.5 0 3 1 3.6 2.4h1.9C13.5 6 15 5 16.5 5c2 0 3.5 1.5 3.5 3.5 0 2.9-3.1 5.7-7.9 10.1z"/>',
  heartFilled:
    '<path d="m12 21.4-1.4-1.3C5.4 15.4 2 12.3 2 8.5 2 5.4 4.4 3 7.5 3c1.7 0 3.4.8 4.5 2.1C13.1 3.8 14.8 3 16.5 3 19.6 3 22 5.4 22 8.5c0 3.8-3.4 6.9-8.6 11.5z"/>',
  fullscreen: '<path d="M5 5h5V3H3v7h2zm5 14H5v-5H3v7h7zm9-14v5h2V3h-7v2zm0 14h-5v2h7v-7h-2z"/>',
  exitFullscreen: '<path d="M8 3v5H3v2h7V3zm8 0h-2v7h7V8h-5zM3 16h5v5h2v-7H3zm11 5h2v-5h5v-2h-7z"/>',
};

// The shadow is drawn into the SVG: a CSS drop-shadow filter would be re-applied every frame
// while the record turns underneath it.
const ARM_SHAPES =
  '<rect x="18" y="2" width="24" height="24" rx="6"/>' +
  '<line x1="30" y1="14" x2="24" y2="212" stroke-width="4" stroke-linecap="round"/>' +
  '<rect x="13" y="204" width="22" height="28" rx="4" transform="rotate(-6 24 218)"/>';
const ARM_SVG =
  '<svg viewBox="0 0 60 240" aria-hidden="true">' +
  `<g transform="translate(3 6)" fill="#000" stroke="#000" opacity=".28">${ARM_SHAPES}</g>` +
  `<g fill="#f3eef5" stroke="#f3eef5">${ARM_SHAPES}</g>` +
  "</svg>";

function el<K extends keyof HTMLElementTagNameMap>(tag: K, className: string, parent?: HTMLElement) {
  const node = document.createElement(tag);
  node.className = className;
  parent?.appendChild(node);
  return node;
}

function setIcon(b: HTMLButtonElement, icon: string) {
  b.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true">${icon}</svg>`;
}

function setLabel(b: HTMLButtonElement, label: string) {
  b.setAttribute("aria-label", label);
  b.title = label;
}

export type ViewOptions = {
  /** Cheap rendering for clients without GPU acceleration. */
  lite: boolean;
};

export function createView(root: HTMLElement, actions: ViewActions, options: ViewOptions = { lite: false }): View {
  const events = new AbortController();
  const on = <K extends keyof HTMLElementEventMap>(
    target: HTMLElement,
    type: K,
    handler: (e: HTMLElementEventMap[K]) => void,
  ) => target.addEventListener(type, handler, { signal: events.signal });

  const button = (parent: HTMLElement, label: string, icon: string, onClick: () => void, extra = "") => {
    const b = el("button", `vinyl-btn ${extra}`.trim(), parent);
    b.type = "button";
    setLabel(b, label);
    setIcon(b, icon);
    on(b, "click", onClick);
    return b;
  };

  const page = el("div", "vinyl-page", root);
  el("div", "vinyl-bg", page);

  const toolbar = el("div", "vinyl-toolbar", page);
  button(toolbar, "Очередь", ICONS.queue, actions.queue, "is-ghost");
  const fullscreenBtn = button(toolbar, "Во весь экран (F)", ICONS.fullscreen, actions.fullscreen, "is-ghost");

  const layout = el("div", "vinyl-layout", page);

  // --- Record deck ---
  const deck = el("div", "vinyl-deck", layout);
  const disc = el("div", "vinyl-disc", deck);
  disc.title = "Тяните пластинку, чтобы перемотать. Клик — пауза";
  const cover = el("img", "vinyl-cover", disc);
  cover.alt = "";
  cover.decoding = "async";
  cover.draggable = false;
  on(cover, "error", () => (cover.hidden = true));
  const label = el("div", "vinyl-label", disc);
  el("span", "vinyl-hole", label);
  const arm = el("div", "vinyl-arm", deck);
  arm.innerHTML = ARM_SVG;

  // Spin with Web Animations: runs on the compositor and lets scratching set the angle directly.
  // Lite mode (no GPU): the cover becomes the record's center label and only that small label
  // turns; the black grooved vinyl around it is rotationally symmetric, so it can stay still.
  page.classList.toggle("is-lite", options.lite);
  const reducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
  const centered = options.lite ? "translate(-50%, -50%) " : "";
  const spin = (options.lite ? label : disc).animate(
    [{ transform: `${centered}rotate(0deg)` }, { transform: `${centered}rotate(360deg)` }],
    { duration: SPIN_MS, iterations: Infinity },
  );
  spin.pause();

  // --- Info column ---
  const info = el("div", "vinyl-info", layout);
  const metaRow = el("div", "vinyl-meta", info);
  const artist = el("div", "vinyl-artist", metaRow);
  const likeBtn = button(metaRow, "Добавить в любимые (L)", ICONS.heart, actions.like, "is-ghost is-like");
  const title = el("h1", "vinyl-title", info);
  el("div", "vinyl-lyrics-label", info).textContent = "LYRICS";
  const lyricsBox = el("div", "vinyl-lyrics", info);
  const lyricsList = el("div", "vinyl-lyrics-list", lyricsBox);

  const progress = el("div", "vinyl-progress", info);
  const elapsed = el("span", "", progress);
  const track = el("div", "vinyl-track", progress);
  const fill = el("div", "vinyl-fill", track);
  const total = el("span", "", progress);

  const controls = el("div", "vinyl-controls", info);
  const shuffleBtn = button(controls, "Перемешать (S)", ICONS.shuffle, actions.shuffle, "is-small");
  button(controls, "Назад (Shift+←)", ICONS.back, actions.back);
  const playBtn = button(controls, "Воспроизвести (Пробел)", ICONS.play, actions.toggle, "is-main");
  button(controls, "Вперёд (Shift+→)", ICONS.next, actions.next);
  const repeatBtn = button(controls, "Повтор (R)", ICONS.repeat, actions.repeat, "is-small");

  const upNext = el("div", "vinyl-upnext", info);
  const upNextText = document.createElement("span");
  upNext.append(Object.assign(document.createElement("b"), { textContent: "UP NEXT" }), upNextText);

  // --- State ---
  let durationMs = 0;
  let lastMs = 0;
  let lastSecond = -1;
  let lastArm = -1;
  let playing = false;
  let lyrics: Lyrics = { kind: "none" };
  let lineEls: HTMLParagraphElement[] = [];
  let activeIndex = -1;
  let liked: boolean | null = null;
  let shuffle: boolean | null = null;
  let repeat: RepeatMode | null = null;
  let lastFill = -1;
  type Scratch = {
    pointerId: number;
    centerX: number;
    centerY: number;
    minRadius: number;
    startX: number;
    startY: number;
    maxMovePx: number;
    prevAngle: number;
    totalDeg: number;
    baseTime: number;
  };
  let scratch: Scratch | null = null;

  const showTime = (ms: number) => {
    const ratio = armProgress(ms, durationMs);
    // Touch styles only on visible change: ~1000 steps across the bar, ~100 for the arm.
    const fillStep = Math.round(ratio * 1000) / 1000;
    if (fillStep !== lastFill) {
      lastFill = fillStep;
      fill.style.transform = `scaleX(${fillStep})`;
    }
    const second = Math.floor(ms / 1000);
    if (second !== lastSecond) {
      lastSecond = second;
      elapsed.textContent = formatTime(ms);
    }
    // The arm moves in 1% steps and glides between them with a CSS transition, so it is idle
    // most of the time instead of constantly animating.
    if (Math.abs(ratio - lastArm) >= 0.01) {
      lastArm = ratio;
      arm.style.setProperty("--vinyl-arm-p", ratio.toFixed(3));
    }
  };

  // --- Seek bar ---
  on(track, "click", (e) => {
    if (durationMs <= 0) return;
    const rect = track.getBoundingClientRect();
    const fraction = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
    actions.seek(Math.round(fraction * durationMs));
  });

  // --- Scratching: drag the record to seek, a click without dragging toggles playback ---
  const angleAt = (s: Scratch, e: PointerEvent) =>
    (Math.atan2(e.clientY - s.centerY, e.clientX - s.centerX) * 180) / Math.PI;

  /** Ends a scratch; seeks only when asked (a lost pointer just cancels). */
  const finishScratch = (commit: boolean) => {
    const s = scratch;
    if (!s) return;
    scratch = null;
    page.classList.remove("is-scratching");
    if (disc.hasPointerCapture?.(s.pointerId)) disc.releasePointerCapture(s.pointerId);
    if (commit) {
      if (s.maxMovePx < 6) actions.toggle();
      // Audio kept playing during the drag, so the offset applies to where playback is now.
      else if (durationMs > 0 && Math.abs(s.totalDeg) >= 3) actions.seek(scratchTargetMs(lastMs, s.totalDeg, durationMs));
    }
    showTime(lastMs);
    if (playing && !reducedMotion) spin.play();
  };

  on(disc, "pointerdown", (e) => {
    if (e.button !== 0) return;
    finishScratch(false); // a stale scratch (lost pointer) must never lock the record
    const r = deck.getBoundingClientRect();
    const s: Scratch = {
      pointerId: e.pointerId,
      centerX: r.left + r.width / 2,
      centerY: r.top + r.height / 2,
      // Near the spindle a pixel of jitter is tens of degrees: ignore that zone.
      minRadius: r.width * 0.12,
      startX: e.clientX,
      startY: e.clientY,
      maxMovePx: 0,
      prevAngle: 0,
      totalDeg: 0,
      baseTime: Number(spin.currentTime) || 0,
    };
    s.prevAngle = angleAt(s, e);
    scratch = s;
    disc.setPointerCapture(e.pointerId);
    spin.pause();
    page.classList.add("is-scratching");
  });

  on(disc, "pointermove", (e) => {
    const s = scratch;
    if (!s || e.pointerId !== s.pointerId) return;
    s.maxMovePx = Math.max(s.maxMovePx, Math.hypot(e.clientX - s.startX, e.clientY - s.startY));
    const angle = angleAt(s, e);
    if (Math.hypot(e.clientX - s.centerX, e.clientY - s.centerY) >= s.minRadius) {
      s.totalDeg += angleDelta(s.prevAngle, angle);
    }
    s.prevAngle = angle;
    const t = (s.baseTime + (s.totalDeg / 360) * SPIN_MS) % SPIN_MS;
    spin.currentTime = t < 0 ? t + SPIN_MS : t;
    if (durationMs > 0) showTime(scratchTargetMs(lastMs, s.totalDeg, durationMs));
  });

  const onPointerEnd = (e: PointerEvent) => {
    if (scratch && e.pointerId === scratch.pointerId) finishScratch(e.type === "pointerup");
  };
  on(disc, "pointerup", onPointerEnd);
  on(disc, "pointercancel", onPointerEnd);
  // Alt-tab, a context menu or a focus change can drop capture without a pointerup.
  on(disc, "lostpointercapture", onPointerEnd);

  // --- Lyrics ---
  on(lyricsList, "click", (e) => {
    if (lyrics.kind !== "synced") return;
    const line = (e.target as HTMLElement).closest<HTMLElement>(".vinyl-line");
    const index = Number(line?.dataset.index);
    const target = lyrics.lines[index];
    if (target) actions.seek(target.startMs);
  });

  const centerActiveLine = () => {
    if (lyrics.kind !== "synced") return;
    const line = lineEls[Math.max(0, activeIndex)];
    if (!line) return;
    const offset = line.offsetTop + line.offsetHeight / 2 - lyricsBox.clientHeight / 2;
    lyricsList.style.transform = `translateY(${-Math.max(0, offset)}px)`;
  };

  const resizeObserver = typeof ResizeObserver === "function" ? new ResizeObserver(centerActiveLine) : null;
  resizeObserver?.observe(lyricsBox);

  const showMessage = (text: string) => {
    lyrics = { kind: "none" };
    lineEls = [];
    activeIndex = -1;
    lyricsBox.className = "vinyl-lyrics is-empty";
    lyricsBox.scrollTop = 0;
    lyricsList.style.transform = "";
    lyricsList.replaceChildren();
    el("p", "vinyl-line", lyricsList).textContent = text;
  };

  const view: View = {
    page,

    setTrack(t) {
      finishScratch(false); // a drag started on the previous track must not seek this one
      artist.textContent = t.artist;
      title.textContent = t.title;
      title.title = t.title;
      if (t.cover) {
        cover.src = t.cover;
        label.style.setProperty("--vinyl-cover-img", `url(${JSON.stringify(t.cover)})`);
        cover.hidden = false;
      } else {
        cover.removeAttribute("src");
        label.style.removeProperty("--vinyl-cover-img");
        cover.hidden = true;
      }
      durationMs = t.durationMs;
      total.textContent = formatTime(t.durationMs);
      lastSecond = -1;
    },

    setPlaying(p) {
      playing = p;
      page.classList.toggle("is-playing", p);
      setLabel(playBtn, p ? "Пауза (Пробел)" : "Воспроизвести (Пробел)");
      setIcon(playBtn, p ? ICONS.pause : ICONS.play);
      if (scratch) return;
      if (p && !reducedMotion) spin.play();
      else spin.pause();
    },

    setProgress(ms, duration) {
      lastMs = ms;
      if (duration !== durationMs) {
        durationMs = duration;
        total.textContent = formatTime(duration);
      }
      if (!scratch) showTime(ms);
    },

    setLyrics(l) {
      if (l.kind === "none") return showMessage("Текст недоступен");
      lyrics = l;
      activeIndex = -1;
      lyricsList.style.transform = "";
      lyricsBox.className = `vinyl-lyrics ${l.kind === "synced" ? "is-synced" : "is-list"}`;
      lineEls = l.lines.map((line, i) => {
        const p = document.createElement("p");
        p.className = "vinyl-line";
        p.dataset.index = String(i);
        p.textContent = line.text.trim() || "♪";
        return p;
      });
      lyricsList.replaceChildren(...lineEls);
      lyricsBox.scrollTop = 0;
      centerActiveLine();
    },

    setLyricsLoading() {
      showMessage("…");
    },

    setLyricIndex(i) {
      if (lyrics.kind !== "synced" || i === activeIndex) return;
      lineEls[activeIndex]?.classList.remove("is-active");
      activeIndex = i;
      lineEls[i]?.classList.add("is-active");
      centerActiveLine();
    },

    setUpNext(text) {
      if ((text ?? "") === upNextText.textContent && upNext.hidden === !text) return;
      upNext.hidden = !text;
      upNextText.textContent = text ?? "";
      upNext.title = text ?? "";
    },

    setPalette({ corners: [tl, tr, bl, br], accent }) {
      page.style.setProperty("--vinyl-tl", toCss(tl));
      page.style.setProperty("--vinyl-tr", toCss(tr));
      page.style.setProperty("--vinyl-bl", toCss(bl));
      page.style.setProperty("--vinyl-br", toCss(br));
      page.style.setProperty("--vinyl-accent", toCss(accent));
    },

    setLiked(value) {
      if (value === liked) return;
      liked = value;
      likeBtn.classList.toggle("is-on", value);
      likeBtn.setAttribute("aria-pressed", String(value));
      setLabel(likeBtn, value ? "Убрать из любимых (L)" : "Добавить в любимые (L)");
      setIcon(likeBtn, value ? ICONS.heartFilled : ICONS.heart);
    },

    setShuffle(value) {
      if (value === shuffle) return;
      shuffle = value;
      shuffleBtn.classList.toggle("is-on", value);
      shuffleBtn.setAttribute("aria-pressed", String(value));
    },

    setRepeat(mode) {
      if (mode === repeat) return;
      repeat = mode;
      repeatBtn.classList.toggle("is-on", mode !== 0);
      setIcon(repeatBtn, mode === 2 ? ICONS.repeatOne : ICONS.repeat);
      setLabel(repeatBtn, mode === 0 ? "Повтор (R)" : mode === 1 ? "Повтор: всё (R)" : "Повтор: трек (R)");
    },

    setFullscreen(value) {
      page.classList.toggle("is-fullscreen", value);
      setIcon(fullscreenBtn, value ? ICONS.exitFullscreen : ICONS.fullscreen);
      setLabel(fullscreenBtn, value ? "Выйти из полноэкранного режима (F)" : "Во весь экран (F)");
    },

    destroy() {
      events.abort();
      resizeObserver?.disconnect();
      spin.cancel();
      page.remove();
    },
  };

  view.setLyrics({ kind: "none" });
  view.setUpNext(null);
  view.setLiked(false);
  view.setShuffle(false);
  view.setRepeat(0);
  return view;
}
