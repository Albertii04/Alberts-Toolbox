import { createApp } from 'vue'
import './engine/engine.css'
import { AudienceDeck, PresenterConsole, Picker } from './engine'
import { presentations, getPresentation } from './presentations'

const params = new URLSearchParams(location.search)
const isPresenter = params.has('p')
const presId = params.get('pres')

// Resolve the presentation: explicit ?pres wins; with a single bundled
// presentation we enter it directly; otherwise show the picker.
let presentation = presId ? getPresentation(presId) : undefined
if (!presentation && presentations.length === 1) presentation = presentations[0]

if (!presentation) {
  createApp(Picker, { presentations }).mount('#app')
} else {
  // A presentation may ship its own presenter console (escape hatch).
  const Root = isPresenter ? presentation.Presenter ?? PresenterConsole : AudienceDeck
  createApp(Root, { presentation }).mount('#app')
}
