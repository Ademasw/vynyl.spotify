// Spicetify theme script for "VinylGlass": puts a pre-blurred cover of the current track behind
// the whole Spotify window. The blur is baked into a tiny image once per track, so nothing is
// blurred live — important because this Spotify renders without GPU acceleration.
import { coverArt, imageUrl } from "./cover.ts";

function start() {
  if (!document.body || typeof Spicetify === "undefined" || !Spicetify.Player?.addEventListener) {
    setTimeout(start, 300);
    return;
  }

  // Two layers so a new cover cross-fades over the old one.
  const layers = [0, 1].map(() => {
    const layer = document.createElement("div");
    layer.className = "vg-backdrop";
    document.body.prepend(layer);
    return layer;
  });
  let active = 0;
  let shown: string | null = null;
  let request = 0;

  const show = (url: string | null) => {
    if (url === shown) return;
    shown = url;
    const current = layers[active];
    if (!url) {
      current.classList.remove("is-on");
      return;
    }
    active ^= 1;
    const next = layers[active];
    next.style.backgroundImage = `url(${JSON.stringify(url)})`;
    next.classList.add("is-on");
    current.classList.remove("is-on");
  };

  const update = async () => {
    const meta = Spicetify.Player.data?.item?.metadata ?? {};
    const cover = imageUrl(meta.image_xlarge_url ?? meta.image_large_url ?? meta.image_url);
    // A 64px image stretched by CSS is naturally soft: the fallback when pixels can't be read.
    const small = imageUrl(meta.image_small_url ?? meta.image_url) ?? cover;
    const mine = ++request;
    if (!cover) return show(null);
    let url = small;
    try {
      url = (await coverArt(cover)).backdrop ?? small;
    } catch {
      /* keep the small cover */
    }
    if (mine === request) show(url); // a newer track may have started meanwhile
  };

  Spicetify.Player.addEventListener("songchange", () => void update());
  void update();
}

start();
