# Block library — reusable slide blocks for Presenter

You are editing a **code presentation** (Vue 3 + GSAP) that runs on the Presenter
engine. This folder is a library of **ready-made, well-tested blocks**. When the
user asks for something that matches a block, **reuse it** (copy the component
into the presentation and wire it per the block's `block.md`) instead of building
it from scratch — the tricky part is the presenter integration, and these blocks
get it right.

## The engine contract (read this once)

A presentation exports `{ meta, slides }`. Each slide entry:

```ts
interface SlideEntry {
  component: Component          // a .vue slide
  title: string
  notes: string                // speaker notes (shown in presenter)
  controls?: PresenterControl[] // optional presenter controls for sub-states
}
type PresenterControl =
  | { kind: 'variants'; label: string; stateKey: string; options: string[] } // button row → drives `variant`
  | { kind: 'range';    label: string; stateKey: string; min?: number; max?: number; step?: number; lowLabel?: string; highLabel?: string } // slider → drives `pos`
```

**Interactive sub-states are a TRIAD.** A slide with steps/sliders needs all of:

1. **Synced state** — `const { pos, variant } = useSliderState('<unique-key>')`
   (import from `../../../engine/composables/useSliderState`). `variant` is a
   0..N index; `pos` is a 0–100 slider. State syncs across the audience and
   presenter windows automatically.
2. **Nav contract** — expose so the arrow keys / presenter buttons can step:
   ```ts
   defineExpose({ tryAdvance, tryBack, resetForward, resetBackward })
   ```
   `tryAdvance/tryBack` return `true` while there's another sub-step (so the deck
   stays on the slide); `resetForward/resetBackward` set the start/end sub-state
   when the slide is entered.
3. **Presenter control** — add a `controls: [...]` descriptor to the slide's entry
   in `slides.ts`. `variants` renders a button row bound to `variant`; `range`
   renders a slider bound to `pos`. Same `stateKey` as the slide's `useSliderState`.

Conventions:
- `data-reveal` on elements → the engine staggers them in on slide entry.
- `data-no-advance` on interactive zones (drag areas, buttons) → clicking them
  doesn't advance the slide.
- Use theme tokens (`var(--brand-300)`, `var(--fg-primary)`, `var(--rule)`, …).
- Images: import them (`import img from './source/foto.jpg'`) — Vite fingerprints them.

## Blocks

| Block | Folder | Use when | Presenter control |
|-------|--------|----------|-------------------|
| Before / after wipe | `before-after/` | comparing two images (before vs after) | `range` (drag or slider) |
| Step pipeline / process | `pipeline/` | an N-step process revealed one step at a time | `variants` |
| Zoom to detail | `zoom-frame/` | zooming into a point of an image | `variants` (or none) |
| Stat cards | `stat-cards/` | a row of animated figures/metrics | none (reveal only) |
| Image gallery | `gallery/` | a grid of reference images | none (reveal only) |

Each folder has the component(s) and a `block.md` with the exact wiring recipe
(imports, state key, defineExpose, and the `controls` line for `slides.ts`).
Copy the component into the presentation's `slides/` or a `components/` dir, then
follow the recipe. Adapt freely — these are starting points, not constraints.

## Growing the library

There's also a sibling **`blocks-user/`** folder (writable) with blocks saved in
previous sessions — check it too. When you build something **new and reusable**
that isn't covered here, save it to `blocks-user/<short-name>/` as a component +
`block.md` (same format as above), so it can be reused next time. The library
learns from use.
