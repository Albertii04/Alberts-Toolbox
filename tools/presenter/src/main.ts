import { createApp, type Component } from 'vue'
import './engine/engine.css'
import { AudienceDeck, PresenterConsole } from './engine'
import { getPresentation } from './presentations'
import type { Presentation } from './engine/types'
import Home from './Home.vue'
import CodeEditor from './CodeEditor.vue'
import LivePreview from './LivePreview.vue'

const params = new URLSearchParams(location.search)
const isPresenter = params.has('p')

function mountDeck(presentation: Presentation): void {
  document.title = presentation.meta.name
  // A presentation may ship its own presenter console (escape hatch).
  const Root: Component = isPresenter ? (presentation.Presenter ?? PresenterConsole) : AudienceDeck
  // ?nav enables editor-preview navigation (arrow keys + postMessage from the parent).
  createApp(Root, { presentation, navigable: params.has('nav') }).mount('#app')
}

// Routes:
//   ?preview=<id> → live HMR preview (iframe of the dev server)
//   ?edit=<id>    → AI chat editor (Claude Code) + live preview
//   ?pres=<id>    → play a bundled presentation (the Concep example)
//   ?p            → presenter console (with ?pres)
//   otherwise     → Home dashboard
function boot(): void {
  const previewId = params.get('preview')
  if (previewId) {
    document.title = 'Vista en vivo'
    createApp(LivePreview, { presId: previewId }).mount('#app')
    return
  }
  const editId = params.get('edit')
  if (editId) {
    document.title = 'Editor'
    createApp(CodeEditor, { presId: editId }).mount('#app')
    return
  }
  const presId = params.get('pres')
  if (presId) {
    const p = getPresentation(presId)
    if (p) return mountDeck(p)
  }
  document.title = 'Presenter'
  createApp(Home).mount('#app')
}

boot()
