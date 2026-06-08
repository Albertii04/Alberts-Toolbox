import { h } from 'vue'
import DataSlide from './DataSlide.vue'
import { blockTitle, type PresentationDoc } from './format'
import type { Presentation } from '../engine/types'

/** Turn a data document into a Presentation the engine can play: each block is
 *  wrapped in a tiny component that renders DataSlide with the block. */
export function documentToPresentation(doc: PresentationDoc): Presentation {
  return {
    meta: { id: doc.id, name: doc.name },
    slides: doc.slides.map((s, i) => ({
      component: { name: `DocSlide${i}`, render: () => h(DataSlide, { block: s.block }) },
      title: blockTitle(s.block),
      notes: s.notes ?? '',
    })),
  }
}
