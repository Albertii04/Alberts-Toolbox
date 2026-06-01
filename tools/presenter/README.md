# Concep Deck — `primlux.deck`

Presentation deck for the Concep workshop (14 May 2026). Tool #1 of Alberts
Toolbox. **Vue 3 + Vite**, dark canvas, GSAP transitions, presenter mode with
cross-screen sync. Two retired prototypes (a single-file HTML deck and a Slidev
build) were removed.

Runs both standalone in a browser (dev) and inside the Electron shell as a tool.

## Present

```bash
# from the repo root
pnpm dev:deck
# or
cd tools/deck && pnpm dev
```

Two surfaces on the same dev server:

- **Audience (projector):** `http://localhost:5173/`
  Keyboard intentionally locked — only `F` (fullscreen) and `Esc`.
- **Presenter (your laptop):** `http://localhost:5173/?p`
  Current slide + next preview, notes, jump grid, timer, clock, and the
  sub-state controls. A button opens the audience window.

The two windows sync automatically (same browser/profile). Put the audience
window on the projector and drive everything from the presenter.

Shortcuts: `F` fullscreen · `Esc` exit · presenter `T` timer, `R` reset.
Deep-link to a slide with `#N` in the URL.

## Before presenting

Open the deck **once online** so the browser caches the Inter font. After that it
works offline (fallback is Helvetica Neue / Arial, already configured).

## Layout

```
tools/deck/
├── README.md
├── toolbox.json            # tool manifest (id primlux.deck, capabilities [])
├── icon.svg
├── images/                 # screenshots / renders
├── public/images -> ../images
└── src/
    ├── slidesManifest.ts   # slide order (= playback order)
    ├── App.vue             # audience deck
    ├── Presenter.vue       # presenter console
    └── slides/             # one .vue per slide
```

Images live in `tools/deck/images`; `public/images` is a symlink to it. Reference
them as `images/<name>` in slides.

## The slides

Order is set by `src/slidesManifest.ts` — edit that array to reorder or remove a
slide; nothing else depends on positions. 19 slides:

```
01  Portada                         11  Zoom panel D5
02  El problema                     12  Referencias del cliente
03  El flujo                        13  Estilo D5
04  Paso 1 — CAD                    14  Prompt — instrucción a la IA
05  Paso 2 — SketchUp               15  Ajustes
06  Librería (3 sub-estados)        16  Renderizando
07  Antes / Después                 17  Render final · 4 variantes
08  Modelo listo                    18  Lo que cambia
09  Zoom D5 Lite                    19  Cierre
10  D5 panel abierto
```

~60s per slide fits ~20 min.

## Interactive slides

Some hold internal state (draggable before/after wipe, step reveal, 4-variant
render cycler), synced presenter ↔ audience and driven from the presenter:

- **El flujo** — steps through the 4 stages
- **Paso 2 — SketchUp** — zoom to the cyan C icon
- **Librería** — Familias → Modelos → Variantes
- **Render final** — cycles the 4 variants and drags the before/after wipe

## Last-minute edits

- **Name / email** — `src/slides/Slide01_Cover.vue`, `Slide19_Close.vue`
- **Closing line** — `Slide19_Close.vue` and its note in `slidesManifest.ts`
- **Speaker notes** — the `notes` field of each entry in `slidesManifest.ts`
- **An image** — replace it in `images/` keeping the same filename

## Static build

```bash
cd tools/deck
pnpm build      # → dist/
pnpm preview
```
