# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

Runs inside the official Spotify desktop client (Chromium/CEF) via Spicetify: a custom app page ("Vinyl") and a client-wide theme ("VinylGlass"). It is not a standalone website.

## Users

Spotify desktop users who customize their client with Spicetify and want their music to look good while it plays. The author is the first user; the project is meant to be released publicly (a GitHub repository, `vynyl.spotify`, already exists), so it must work for other people on other machines and Spotify versions, not only this one.

## Product Purpose

Make listening beautiful to look at. Vinyl is an atmospheric "now playing" screen: a turntable with the current cover, a tonearm that follows the song, synced lyrics, and a backdrop built from the cover's colors. VinylGlass carries the same mood across the whole client with glass panels over a blurred cover of the current track. Success means it looks striking and stays smooth.

## Positioning

- Lives inside the real Spotify client instead of replacing it: no Spotify Premium, no Web API app registration, instant player events, and Spotify's own lyrics.
- Stays smooth without GPU acceleration. Blurs are baked into tiny images once per track, never computed live, and a lite record mode spins only the small cover label when the client renders on the CPU. Glass themes that rely on `backdrop-filter` cannot claim this.

## Operating Context

- Windows desktop Spotify (tested: Spotify 1.3.10, Spicetify 2.46.7). On the author's machine Spotify runs with hardware acceleration off.
- Installed and updated with `scripts/install.ps1` (builds, copies the custom app and theme, applies Spicetify). Spotify auto-updates silently undo Spicetify; `spicetify backup apply` restores it.
- Vinyl opens from the record icon in Spotify's top bar, next to Home. It also runs fullscreen, for example on a second screen.

## Capabilities and Constraints

Vinyl page:
- Turntable: picture-disc mode with a GPU, lite label mode without one (auto-detected; `localStorage` key `vinyl:lite` forces it). The tonearm tracks song progress and lifts on pause.
- Drag the record to scratch-seek (one turn = 8 s); a click toggles playback.
- Synced lyrics that scroll and center the current line; click a line to seek. Unsynced lyrics show as a list; a calm message when there are none.
- Progress bar with seek, like / shuffle / repeat, previous / play / next, Up next, queue shortcut, fullscreen.
- Hotkeys while the page is open (by physical key, so any keyboard layout): Space, ←/→ ±5 s, Shift+←/→ tracks, L like, S shuffle, R repeat, F fullscreen. They never take keys from text fields or Spotify's own menus and dialogs.
- Background: pre-blurred cover, a color mesh from the cover's corners, film grain, lamp light.

VinylGlass theme:
- Pre-blurred cover of the current track behind the whole window. Library, main view and right panel (including its cards) become translucent glass with a thin light edge. Floating menus, dialogs and sticky headers stay solid.

Constraints:
- Anything animated per frame must stay small; full-window motion, live blur and filters lag on CPU rendering.
- Depends on Spotify internals: layout class names (`Root__*`, `main-*`), the `color-lyrics` endpoint and Spicetify APIs can change with Spotify updates.
- Spotify's audio analysis (beats/tempo) is unavailable to this project; a beat-synced effect was tried and removed.
- On-screen labels stay in English as part of the look ("LYRICS", "UP NEXT"); tooltips and messages are in Russian. Confirmed as intended.

Open decisions:
- Distribution channel beyond GitHub (Spicetify Marketplace or not).
- Localization for other users' languages.

## Brand Commitments

- Names: "Vinyl" (the page) and "VinylGlass" (the theme).
- References the author supplied: a vinyl now-playing screen from a YouTube Music client (the starting point for Vinyl) and a frosted-glass Spotify theme screenshot (the starting point for VinylGlass). They set the direction; neither is to be copied.

## Evidence on Hand

- The working product in this repository (`src/`, `theme/`) and its tests (`tests/`, 38 passing).
- No users, reviews, download counts or press yet. Do not invent any.

## Product Principles

1. Smooth before showy: an effect that stutters on CPU rendering does not ship.
2. Live inside Spotify, not instead of it: use the client's own data and keep its native features working.
3. Degrade quietly: a missing cover, lyrics or data source gives a calm fallback, never a broken screen.
4. Atmosphere is the job: on the Vinyl page the music and its cover lead, and the interface recedes.
5. Works beyond this machine: no hard-coded personal setup; survive Spotify updates and other users' configurations.
