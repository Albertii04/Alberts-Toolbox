import type { Component } from 'vue'

/** A presenter-side control for a slide's synced sub-state. Rendered generically
 *  by the presenter console so it stays presentation-agnostic.
 *  - `variants` drives the slider state's `variant` field (button row).
 *  - `range` drives the `pos` field (a 0–100 slider). */
export type PresenterControl =
  | { kind: 'variants'; label: string; stateKey: string; options: string[] }
  | {
      kind: 'range'
      label: string
      stateKey: string
      min?: number
      max?: number
      step?: number
      lowLabel?: string
      highLabel?: string
    }

export interface SlideEntry {
  component: Component
  title: string
  notes: string
  /** Optional presenter controls for this slide's internal sub-states. */
  controls?: PresenterControl[]
}

export interface Wordmark {
  primary: string
  suffix: string
}

export interface ThemeTokens {
  /** CSS custom properties applied to the deck root, e.g. { '--brand-300': '#94a8ca' }. */
  vars?: Record<string, string>
  wordmark?: Wordmark
}

export interface PresentationMeta {
  id: string
  name: string
  description?: string
  date?: string
}

export interface Presentation {
  meta: PresentationMeta
  slides: SlideEntry[]
  theme?: ThemeTokens
  /** Optional full replacement for the presenter console (escape hatch). */
  Presenter?: Component
}

/** Imperative API a slide may expose via defineExpose so the engine can drive
 *  its internal sub-states on navigation. All optional. */
export interface SlideInstance {
  tryAdvance?(): boolean
  tryBack?(): boolean
  resetForward?(): void
  resetBackward?(): void
}
