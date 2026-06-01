import { createApp } from 'vue'
import './engine/engine.css'
import { AudienceDeck, PresenterConsole } from './engine'
import { presentations, getPresentation } from './presentations'

const params = new URLSearchParams(location.search)
const isPresenter = params.has('p')
const presId = params.get('pres')
const presentation = (presId && getPresentation(presId)) || presentations[0]

// A presentation may ship its own presenter console (escape hatch); otherwise
// the engine's generic one is used.
const Root = isPresenter ? presentation.Presenter ?? PresenterConsole : AudienceDeck

createApp(Root, { presentation }).mount('#app')
