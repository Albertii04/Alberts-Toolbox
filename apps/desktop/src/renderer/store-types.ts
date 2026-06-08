import type { ResolvedApp } from '@toolbox/sdk'

/** A catalog app augmented with local runtime info for the storefront. */
export interface StoreApp extends ResolvedApp {
  /** Inline SVG icon (for `web` apps present locally); native apps use `icon` URL. */
  iconSvg?: string | null
  /** True if this is a locally-available web tool that can be opened in-shell. */
  isLocalWeb?: boolean
}

/** Stable pastel gradient for a card, picked from the app id. */
const PALETTES = [
  'from-sky-100 to-sky-50',
  'from-amber-100 to-amber-50',
  'from-rose-100 to-rose-50',
  'from-indigo-100 to-indigo-50',
  'from-emerald-100 to-emerald-50',
  'from-violet-100 to-violet-50',
  'from-orange-100 to-orange-50',
  'from-cyan-100 to-cyan-50',
  'from-fuchsia-100 to-fuchsia-50',
  'from-teal-100 to-teal-50',
]

export function paletteFor(id: string): string {
  let h = 0
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0
  return PALETTES[h % PALETTES.length]
}
