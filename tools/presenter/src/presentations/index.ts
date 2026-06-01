import type { Presentation } from '../engine/types'
import { concepDeck } from './concep-deck'

/** All presentations bundled with this build of Presenter. */
export const presentations: Presentation[] = [concepDeck]

export function getPresentation(id: string): Presentation | undefined {
  return presentations.find((p) => p.meta.id === id)
}
