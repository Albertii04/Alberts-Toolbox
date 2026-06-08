import type { Presentation } from '../engine/types'

/**
 * Presentations are folders: any `presentations/<id>/index.ts` that exports a
 * Presentation (default export, or a named `presentation`) is auto-discovered.
 * Drop in a new folder and it shows up — no manual registration.
 */
const modules = import.meta.glob<{ default?: Presentation; presentation?: Presentation }>(
  './*/index.ts',
  { eager: true },
)

export const presentations: Presentation[] = Object.values(modules)
  .map((m) => m.default ?? m.presentation)
  .filter((p): p is Presentation => !!p)

export function getPresentation(id: string): Presentation | undefined {
  return presentations.find((p) => p.meta.id === id)
}
