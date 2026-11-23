# Vinyl Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Spicetify custom app «Vinyl» — страница «сейчас играет» с винилом, тонармом, синхронным текстом, прогрессом, кнопками, Up next и фоном из цветов обложки.

**Architecture:** Чистый TypeScript, собирается esbuild в один `index.js`. Spicetify требует глобальную `render()`, возвращающую React-элемент — это тонкая обёртка, которая в `useEffect` монтирует ванильное приложение (`mount(root) => unmount`). Чистая логика (текст, время) отделена и покрыта `node --test`.

**Tech Stack:** TypeScript 5, esbuild, Node 22 (`node --test --experimental-strip-types`), Spicetify CLI.

**Spec:** `docs/superpowers/specs/2026-11-23-vinyl-page-design.md`

## Global Constraints

- Никакого JS на каждом кадре для анимаций: вращение и тонарм — CSS `transform` + `animation-play-state`.
- Без `filter: blur` по картинке; фон — градиент из `Spicetify.colorExtractor`.
- DOM текста меняется только при смене текущей строки; прогресс — `transform: scaleX`.
- `unmount` снимает все слушатели `Spicetify.Player` и таймеры; повторное открытие страницы не дублирует их.
- Папка не git-репозиторий: шаги «commit» пропускаются.
- Тексты недоступны → строка «Текст недоступен».

## Review Focus

1. Трек сменился, пока грузился текст прошлого трека → показывается текст нового, а не устаревший (проверка uri после await в `app.ts`). Ручная проверка в Task 4: быстро переключить 3 трека подряд.
2. Перемотка назад → подсветка возвращается к правильной строке. Тест `findLineIndex` назад.
3. Позиция до первой строки (вступление) → индекс −1, первая строка показана как «следующая». Тест в Task 2.
4. Нет `Player.data.item` / локальный файл / подкаст без текста → страница не падает, показывает заглушки. Ручная проверка в Task 4 + тест `parseLyrics(null)`.
5. Страницу открыли/закрыли несколько раз → в консоли нет ошибок, слушатели не множатся. Ручная проверка в Task 4.

---

### Task 1: Каркас проекта и формат времени

**Files:**
- Create: `package.json`, `tsconfig.json`, `build.mjs`, `manifest.json`, `src/time.ts`, `tests/time.test.ts`, `.gitignore`

**Interfaces:**
- Produces: `formatTime(ms: number): string` — `"m:ss"`, отрицательное/NaN → `"0:00"`.
- Produces: `npm run build` → `dist/index.js`; `npm test` → `node --test --experimental-strip-types tests/`.

- [ ] **Step 1:** `package.json` (private, type module, devDeps `esbuild`, `typescript`), scripts `build`, `test`, `typecheck` (`tsc --noEmit`). `tsconfig.json`: strict, `allowImportingTsExtensions`, `noEmit`, target ES2022, lib DOM. `npm install`.
- [ ] **Step 2: Тест** `tests/time.test.ts`: `formatTime(0)==="0:00"`, `formatTime(18_500)==="0:18"`, `formatTime(130_000)==="2:10"`, `formatTime(3_600_000)==="60:00"`, `formatTime(-5)==="0:00"`, `formatTime(NaN)==="0:00"`.
- [ ] **Step 3:** `npm test` → FAIL (нет модуля).
- [ ] **Step 4:** Реализовать `src/time.ts`. `npm test` → PASS.
- [ ] **Step 5:** `build.mjs`: entry `src/index.ts`, bundle, `format: "iife"`, `globalName: "VinylApp"`, `loader: { ".css": "text" }`, minify, outfile `dist/index.js`, `footer: { js: "function render(){return VinylApp.render();}" }`. `manifest.json`: name `"Vinyl"`, `icon`/`active-icon` — SVG пластинки (`currentColor`).

### Task 2: Тексты песен

**Files:**
- Create: `src/lyrics.ts`, `tests/lyrics.test.ts`

**Interfaces:**
- Produces:
  - `type LyricLine = { startMs: number; text: string }`
  - `type Lyrics = { kind: "synced" | "unsynced"; lines: LyricLine[] } | { kind: "none" }`
  - `parseLyrics(json: unknown): Lyrics` — `json.lyrics.syncType === "LINE_SYNCED"` → synced (startMs = `Number(startTimeMs)`), иначе с непустыми lines → unsynced, иначе/невалидно → none.
  - `findLineIndex(lines: LyricLine[], ms: number, hint?: number): number` — последняя строка с `startMs <= ms`, −1 до первой. Бинарный поиск; `hint` — быстрый путь, если ответ = hint или hint+1.
  - `fetchLyrics(trackUri: string, get: (url: string) => Promise<unknown>): Promise<Lyrics>` — id из `spotify:track:<id>`; не track → none; ошибка → none. URL: `https://spclient.wg.spotify.com/color-lyrics/v2/track/<id>?format=json&vocalRemoval=false&market=from_token`.

- [ ] **Step 1: Тесты** — parseLyrics: synced пример (2 строки, startTimeMs `"1000"`, `"5000"`) → `{kind:"synced", lines:[{startMs:1000,…},{startMs:5000,…}]}`; `syncType:"UNSYNCED"` → unsynced; `null`, `{}`, `{lyrics:{lines:[]}}` → none. findLineIndex на `[0:1000,1:5000,2:9000]`: `500→-1`, `1000→0`, `6000→1`, `99999→2`, с hint=2 и ms=3000 (перемотка назад) → 0, пустой массив → −1. fetchLyrics: `spotify:local:…` → none без вызова get; get бросает → none; get получает URL с id.
- [ ] **Step 2:** `npm test` → FAIL.
- [ ] **Step 3:** Реализовать `src/lyrics.ts`.
- [ ] **Step 4:** `npm test` → PASS.

### Task 3: Страница (вид, стили, связка с плеером)

**Files:**
- Create: `src/spicetify.d.ts` (минимальные типы глобального `Spicetify`, только используемое), `src/style.css`, `src/view.ts`, `src/app.ts`, `src/index.ts`

**Interfaces:**
- Consumes: `formatTime`, `parseLyrics`/`findLineIndex`/`fetchLyrics`, типы `Lyrics`.
- Produces:
  - `createView(root: HTMLElement, actions: { toggle(): void; next(): void; back(): void; queue(): void; seek(ms: number): void }): View`, где `View = { setTrack(t: TrackInfo): void; setPlaying(p: boolean): void; setProgress(ms: number, durationMs: number): void; setLyrics(l: Lyrics): void; setLyricIndex(i: number): void; setUpNext(text: string | null): void; setColors(c: [string, string, string]): void; destroy(): void }`, `TrackInfo = { title: string; artist: string; cover: string | null; durationMs: number }`.
  - `mount(root: HTMLElement): () => void` в `app.ts`.
  - `render()` в `index.ts`: `Spicetify.React.createElement(Host)`; `Host` — `div` с ref, `useEffect(() => mount(ref.current), [])`. CSS (`import css from "./style.css"`) добавляется `<style id="vinyl-style">` при mount, удаляется при unmount.

- [ ] **Step 1: Вид.** Раскладка по скриншоту: слева пластинка (диск с бороздками через `repeating-radial-gradient`, обложка — круглый `<img>` внутри, `object-fit: cover`; без обложки — серый диск), тонарм над правым краем, `transform-origin` у основания, `rotate(-25deg)` на паузе → `rotate(0)` при play, `transition` 0.6s. Справа: исполнитель (капс, мелко, letter-spacing), название (крупно, ~clamp(40px, 6vw, 80px)), «LYRICS», текущая строка (яркая) + следующая (opacity .45), прогресс (время — трек — длительность; заливка `scaleX`), 4 круглые кнопки (центральная крупнее, акцентная), строка «UP NEXT …» с обрезкой многоточием. Фон страницы: `radial-gradient`ы из трёх CSS-переменных `--c1..--c3`, `transition` на них через `@property` (`syntax: "<color>"`). Вращение: `@keyframes spin` 8s linear infinite, `.paused { animation-play-state: paused }`. `prefers-reduced-motion` → без вращения. Узкое окно (<900px) → колонка.
- [ ] **Step 2: Связка (`app.ts`).** На mount и `songchange`: прочитать `Spicetify.Player.data?.item` (нет → заглушки «Ничего не играет»), `setTrack`, `setUpNext(Spicetify.Queue?.nextTracks?.[0]?.contextTrack?.metadata → "title — artist_name" | null)`, `colorExtractor(uri)` → `[DARK_VIBRANT, VIBRANT, PROMINENT]` (ошибка → дефолтные тёмно-фиолетовые), `fetchLyrics(uri, url => Spicetify.CosmosAsync.get(url))` → применить, только если uri всё ещё текущий. `onplaypause` → `setPlaying(!Spicetify.Player.data.isPaused)`. `onprogress` → `setProgress`, `findLineIndex` с hint, `setLyricIndex` только при изменении (для synced). Unsynced → показываются все строки списком без подсветки. Кнопка очереди → `Spicetify.Platform.History.push("/queue")`. unmount: `removeEventListener` ×3, `view.destroy()`.
- [ ] **Step 3:** `npm run typecheck` → без ошибок; `npm test` → PASS; `npm run build` → `dist/index.js` есть, в конце `function render(){`.

### Task 4: Установка в Spotify и проверка

**Files:**
- Create: `scripts/install.ps1`, `README.md` (как поставить/обновить, в 5 строк)

- [ ] **Step 1:** Spicetify CLI не установлен — установить официальной командой (`iwr -useb https://raw.githubusercontent.com/spicetify/cli/main/install.ps1 | iex`) **только с согласия пользователя**; затем `spicetify backup apply` один раз.
- [ ] **Step 2:** `scripts/install.ps1`: `npm run build`, скопировать `dist/index.js` и `manifest.json` в `$env:APPDATA\spicetify\CustomApps\vinyl\`, `spicetify config custom_apps vinyl`, `spicetify apply`. Скрипт идемпотентен.
- [ ] **Step 3:** Запустить, открыть Spotify → в меню есть «Vinyl», страница открывается. Проверить вручную: трек с текстом (подсветка идёт в такт, перемотка назад), трек без текста, пауза (пластинка стоит, тонарм поднят), смена трека (цвета, обложка, Up next), открыть/закрыть страницу 3 раза (консоль DevTools без ошибок — `spicetify enable-devtools`).
