import { createApp, type Component } from 'vue'
import './engine/engine.css'
import { AudienceDeck, PresenterConsole } from './engine'
import { getPresentation } from './presentations'
import type { Presentation } from './engine/types'
import Home from './Home.vue'
import Editor from './Editor.vue'
import LivePreview from './LivePreview.vue'
import { loadDoc } from './documents/store'
import { documentToPresentation } from './documents/render'

const params = new URLSearchParams(location.search)
const isPresenter = params.has('p')

function mountDeck(presentation: Presentation): void {
  document.title = presentation.meta.name
  // A presentation may ship its own presenter console (escape hatch).
  const Root: Component = isPresenter ? (presentation.Presenter ?? PresenterConsole) : AudienceDeck
  createApp(Root, { presentation }).mount('#app')
}

// Resolve what to show:
//   ?doc=<id>  → a stored document presentation
//   ?pres=<id> → a bundled presentation (e.g. the Concep example)
//   otherwise  → the Home dashboard
async function boot(): Promise<void> {
  // Live HMR preview of a code presentation (authoring host). Skipped inside the
  // dev-server iframe itself (?pres present) to avoid recursion.
  const previewId = params.get('preview')
  if (previewId) {
    document.title = 'Vista en vivo'
    createApp(LivePreview, { presId: previewId }).mount('#app')
    return
  }
  const editId = params.get('edit')
  if (editId) {
    const doc = await loadDoc(editId)
    if (doc) {
      document.title = `${doc.name} — Editor`
      createApp(Editor, { doc }).mount('#app')
      return
    }
  }
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
  document.title = 'Presenter'
  createApp(Home).mount('#app')
}

void boot()
