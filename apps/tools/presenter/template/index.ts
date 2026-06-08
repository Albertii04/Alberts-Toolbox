import type { Presentation } from '../../engine/types'
import meta from './presentation.json'
import { slides } from './slides'

// A code presentation: edit the slides under slides/ (and this file) however you
// like — add components, animations, transitions, even a custom presenter.
export default { meta, slides } satisfies Presentation
