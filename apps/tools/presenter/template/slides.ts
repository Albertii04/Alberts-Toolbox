import type { SlideEntry } from '../../engine/types'
import Cover from './slides/Cover.vue'
import Point from './slides/Point.vue'

export const slides: SlideEntry[] = [
  { component: Cover, title: 'Portada', notes: 'Saluda. Presenta el tema.' },
  { component: Point, title: 'Un punto', notes: 'Desarrolla la idea principal.' },
]
