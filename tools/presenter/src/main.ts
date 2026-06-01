import { createApp, type Component } from 'vue'
import './engine/engine.css'
import { AudienceDeck, PresenterConsole } from './engine'
import { getPresentation } from './presentations'
import type { Presentation } from './engine/types'
import Home from './Home.vue'
import { loadDoc } from './documents/store'
import { documentToPresentation } from './documents/render'

const params = new URLSearchParams(location.search)
const isPresenter = params.has('p')

function mountDeck(presentation: Presentation): void {
  // A presentation may ship its own presenter console (escape hatch).
  const Root: Component = isPresenter ? (presentation.Presenter ?? PresenterConsole) : AudienceDeck
  createApp(Root, { presentation }).mount('#app')
}

// Resolve what to show:
//   ?doc=<id>  → a stored document presentation
//   ?pres=<id> → a bundled presentation (e.g. the Concep example)
//   otherwise  → the Home dashboard
async function boot(): Promise<void> {
  const docId = params.get('doc')
  if (docId) {
    const doc = await loadDoc(docId)
    if (doc) return mountDeck(documentToPresentation(doc))
  }
  const presId = params.get('pres')
  if (presId) {
    const p = getPresentation(presId)
    if (p) return mountDeck(p)
  }
  createApp(Home).mount('#app')
}

void boot()
