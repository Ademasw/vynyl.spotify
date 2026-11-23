import { fetchLyrics, findLineIndex, type Lyrics } from "./lyrics.ts";
import { createView } from "./view.ts";
import { actionForKey, type KeyAction } from "./keys.ts";
import { seekByTarget } from "./deck.ts";
import { detectLiteMode } from "./gpu.ts";
import { DEFAULT_PALETTE, extractPalette, paletteFromHex, type Palette } from "./palette.ts";

const SAMPLE_SIZE = 32;
let sampleCanvas: HTMLCanvasElement | null = null;

/** Reads the cover at 32x32 once per track. Rejects if the image can't be read (e.g. no CORS). */
async function coverPalette(url: string): Promise<Palette> {
  const img = new Image();
  img.crossOrigin = "anonymous";
  img.src = url;
  await img.decode();
  sampleCanvas ??= Object.assign(document.createElement("canvas"), { width: SAMPLE_SIZE, height: SAMPLE_SIZE });
  const ctx = sampleCanvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("no 2d context");
  ctx.drawImage(img, 0, 0, SAMPLE_SIZE, SAMPLE_SIZE);
  return extractPalette(ctx.getImageData(0, 0, SAMPLE_SIZE, SAMPLE_SIZE).data, SAMPLE_SIZE, SAMPLE_SIZE);
}

function imageUrl(raw: string | undefined): string | null {
  if (!raw) return null;
  if (raw.startsWith("spotify:image:")) return `https://i.scdn.co/image/${raw.slice("spotify:image:".length)}`;
  return raw;
}

function upNextText(): string | null {
  const next = Spicetify.Queue?.nextTracks?.find((t) => t.contextTrack?.uri && !t.contextTrack.uri.startsWith("spotify:delimiter"));
  const meta = next?.contextTrack?.metadata;
  if (!meta?.title) return null;
  return meta.artist_name ? `${meta.title} — ${meta.artist_name}` : meta.title;
}

function isEditable(target: EventTarget | null): boolean {
  return target instanceof HTMLElement && (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName));
}

// Modifier flags are prototype getters on KeyboardEvent, so they must be copied explicitly.
// composedPath()[0] is the real focused element, even inside shadow DOM.
const keyInput = (e: KeyboardEvent, page: HTMLElement) => {
  const target = e.composedPath()[0] ?? e.target;
  const neutral = target === document.body || target === document.documentElement || target === document || target === window;
  return {
    code: e.code,
    shiftKey: e.shiftKey,
    ctrlKey: e.ctrlKey,
    altKey: e.altKey,
    metaKey: e.metaKey,
    editable: isEditable(target),
    // Focus on any other Spotify widget (menu, dialog, slider, link) keeps its own keys.
    foreignFocus: !neutral && !(target instanceof Node && page.contains(target)),
  };
};

/** Runs a player call, ignoring failures (e.g. liking when nothing is playing). */
function safely(fn: (() => unknown) | undefined) {
  try {
    fn?.();
  } catch {
    /* nothing to do: the next state sync shows the real state */
  }
}

export function mount(root: HTMLElement): () => void {
  const player = Spicetify.Player;
  let immersive = false;
  let syncTimer = 0;

  const syncControls = () => {
    view.setLiked(Boolean(player.getHeart?.()));
    view.setShuffle(Boolean(player.getShuffle?.()));
    const r = player.getRepeat?.();
    view.setRepeat(r === 1 || r === 2 ? r : 0);
  };
  // Player toggles apply asynchronously; read the state back shortly after.
  const syncSoon = () => {
    clearTimeout(syncTimer);
    syncTimer = window.setTimeout(syncControls, 250);
  };

  const updateFullscreen = () => {
    view.page.classList.toggle("is-immersive", immersive);
    // position: fixed inside Spotify's layout could be clipped by an ancestor, so the
    // immersive overlay lives directly in <body> and returns home afterwards.
    const home = immersive ? document.body : root;
    if (view.page.parentElement !== home) home.appendChild(view.page);
    view.setFullscreen(immersive || document.fullscreenElement === view.page);
  };
  const isFullscreen = () => immersive || document.fullscreenElement === view.page;
  const toggleFullscreen = () => {
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
    } else if (immersive) {
      immersive = false;
      updateFullscreen();
    } else {
      // If the client refuses real fullscreen, cover the Spotify window instead.
      Promise.resolve()
        .then(() => view.page.requestFullscreen())
        .catch(() => {
          immersive = true;
          updateFullscreen();
        });
    }
  };

  const seekBy = (deltaMs: number) => {
    const target = seekByTarget(player.getProgress(), deltaMs, player.getDuration() || 0);
    if (target !== null) player.seek(target);
  };

  const view = createView(root, {
    toggle: () => safely(() => player.togglePlay()),
    next: () => safely(() => player.next()),
    back: () => safely(() => player.back()),
    queue: () => Spicetify.Platform?.History?.push("/queue"),
    seek: (ms) => safely(() => player.seek(ms)),
    like: () => (safely(() => player.toggleHeart?.()), syncSoon()),
    shuffle: () => (safely(() => player.toggleShuffle?.()), syncSoon()),
    repeat: () => (safely(() => player.toggleRepeat?.()), syncSoon()),
    fullscreen: toggleFullscreen,
  }, { lite: detectLiteMode() });

  const runKey = (action: KeyAction) => {
    switch (action) {
      case "toggle": return safely(() => player.togglePlay());
      case "seekBack": return safely(() => seekBy(-5000));
      case "seekForward": return safely(() => seekBy(5000));
      case "prev": return safely(() => player.back());
      case "next": return safely(() => player.next());
      case "like": return (safely(() => player.toggleHeart?.()), syncSoon());
      case "shuffle": return (safely(() => player.toggleShuffle?.()), syncSoon());
      case "repeat": return (safely(() => player.toggleRepeat?.()), syncSoon());
      case "fullscreen": return toggleFullscreen();
      case "exitFullscreen": return toggleFullscreen();
    }
  };

  // Capture phase on window: our keys win over Spotify's, and only while this page is open.
  const onKeyDown = (e: KeyboardEvent) => {
    const action = actionForKey(keyInput(e, view.page));
    if (!action) return;
    if (action === "exitFullscreen" && !isFullscreen()) return; // Esc stays Spotify's otherwise
    e.preventDefault();
    e.stopImmediatePropagation();
    if (action === "toggle" && e.repeat) return;
    runKey(action);
  };
  // A focused button would also "click" on Space keyup and toggle a second time.
  const onKeyUp = (e: KeyboardEvent) => {
    if (actionForKey(keyInput(e, view.page)) !== "toggle") return;
    e.preventDefault();
    e.stopImmediatePropagation();
  };
  window.addEventListener("keydown", onKeyDown, true);
  window.addEventListener("keyup", onKeyUp, true);
  document.addEventListener("fullscreenchange", updateFullscreen);

  let uri = "";
  let lyrics: Lyrics = { kind: "none" };
  let lineIndex = -1;
  let alive = true;

  const onSongChange = () => {
    const item = player.data?.item;
    const meta = item?.metadata ?? {};
    uri = item?.uri ?? "";
    const thisUri = uri;

    const cover = imageUrl(meta.image_xlarge_url ?? meta.image_large_url ?? meta.image_url);
    view.setTrack({
      title: meta.title || (item ? "Без названия" : "Ничего не играет"),
      artist: meta.artist_name ?? "",
      cover,
      durationMs: player.getDuration() || 0,
    });
    view.setUpNext(upNextText());
    syncSoon();

    lyrics = { kind: "none" };
    lineIndex = -1;
    if (!thisUri) {
      view.setLyrics(lyrics);
      view.setPalette(DEFAULT_PALETTE);
      return;
    }
    // Keep the previous colors on screen until the new ones arrive, to avoid a flash of purple.
    view.setLyricsLoading();

    // Results for a previous track are dropped: the user may have skipped while we waited.
    const stillCurrent = () => alive && uri === thisUri;

    // Prefer the real cover pixels; fall back to Spotify's color extractor, then to defaults.
    const fromSpotify = () => Promise.resolve().then(() => Spicetify.colorExtractor(thisUri)).then(paletteFromHex);
    (cover ? coverPalette(cover).catch(fromSpotify) : fromSpotify()).then(
      (p) => stillCurrent() && view.setPalette(p),
      () => stillCurrent() && view.setPalette(DEFAULT_PALETTE),
    );

    fetchLyrics(thisUri, (url) => Spicetify.CosmosAsync.get(url)).then((l) => {
      if (!stillCurrent()) return;
      lyrics = l;
      lineIndex = -1;
      view.setLyrics(l);
      onProgress();
    });
  };

  const onPlayPause = () => {
    view.setPlaying(player.isPlaying());
    syncControls();
  };

  let slowCheckedAt = 0;

  const onProgress = () => {
    const ms = player.getProgress();
    view.setProgress(ms, player.getDuration() || 0);
    // Queue, like, shuffle and repeat can change from elsewhere; re-read them at most once a
    // second (the view only touches the DOM when a value actually changed).
    const now = Date.now();
    if (now - slowCheckedAt > 1000) {
      slowCheckedAt = now;
      view.setUpNext(upNextText());
      syncControls();
    }
    if (lyrics.kind !== "synced") return;
    const i = findLineIndex(lyrics.lines, ms, lineIndex);
    if (i !== lineIndex) {
      lineIndex = i;
      view.setLyricIndex(i);
    }
  };

  player.addEventListener("songchange", onSongChange);
  player.addEventListener("onplaypause", onPlayPause);
  player.addEventListener("onprogress", onProgress);

  onSongChange();
  onPlayPause();
  onProgress();

  return () => {
    alive = false;
    clearTimeout(syncTimer);
    window.removeEventListener("keydown", onKeyDown, true);
    window.removeEventListener("keyup", onKeyUp, true);
    document.removeEventListener("fullscreenchange", updateFullscreen);
    if (document.fullscreenElement === view.page) document.exitFullscreen().catch(() => {});
    player.removeEventListener("songchange", onSongChange);
    player.removeEventListener("onplaypause", onPlayPause);
    player.removeEventListener("onprogress", onProgress);
    view.destroy();
  };
}
