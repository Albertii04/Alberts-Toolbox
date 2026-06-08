# Zoom to detail

Zooms into a focal point of an image. `focalX`/`focalY` set the point, `scale`
the magnification. `start` toggles the zoom (animate in / out).

## Recipe

Always-zoomed (static):
```vue
<ZoomFrame :src="img" focal-x="40%" focal-y="50%" :scale="3" instant />
```

Stepped (intro → zoom), driven by a sub-state:
```vue
<script setup lang="ts">
import ZoomFrame from '../components/ZoomFrame.vue'
import { useSliderState } from '../../../engine/composables/useSliderState'
import img from '../source/screenshot.png'
const { variant } = useSliderState('zoom')      // 0 = full image, 1 = zoomed
function tryAdvance() { if (variant.value < 1) { variant.value++; return true } return false }
function tryBack()    { if (variant.value > 0) { variant.value--; return true } return false }
function resetForward()  { variant.value = 0 }
function resetBackward() { variant.value = 1 }
defineExpose({ tryAdvance, tryBack, resetForward, resetBackward })
</script>
<template>
  <ZoomFrame :src="img" focal-x="40%" focal-y="50%" :scale="3" :start="variant >= 1" reveal />
</template>
```
`slides.ts`: `controls: [{ kind: 'variants', label: 'Zoom', stateKey: 'zoom', options: ['Vista', 'Detalle'] }]`
