import './style.css'
import type { Presentation } from '../../engine/types'
import { slides } from './slides'
import { theme } from './theme'

export const concepDeck: Presentation = {
  meta: {
    id: 'concep-deck',
    name: 'De CAD a render con IA',
    description: 'Workshop Concep — Primlux · 14 may 2026',
    date: '2026-05-14',
  },
  slides,
  theme,
}
