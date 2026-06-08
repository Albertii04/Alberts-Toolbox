# Before / after wipe

A draggable image comparison: drag the knob (or use the presenter slider) to wipe
between a "before" and an "after" image.

## Wiring recipe

1. Copy `BeforeAfter.vue` into the presentation (e.g. `components/BeforeAfter.vue`).
2. In the slide, sync `pos` and bind it:

```vue
<script setup lang="ts">
import { onMounted } from 'vue'
import BeforeAfter from '../components/BeforeAfter.vue'
import { useSliderState } from '../../../engine/composables/useSliderState'
import before from '../source/before.jpg'
import after from '../source/after.jpg'

const { pos } = useSliderState('compare')   // unique key per slide
onMounted(() => { pos.value = 97 })          // start almost fully on "before"

// no sub-steps to advance, but expose resets so entering the slide resets the wipe
function resetForward() { pos.value = 97 }
function resetBackward() { pos.value = 97 }
defineExpose({ resetForward, resetBackward })
</script>

<template>
  <div style="height:100%" data-reveal>
    <BeforeAfter :before="before" :after="after" v-model:pos="pos"
      label-before="Antes" label-after="Después" />
  </div>
</template>
```

3. In `slides.ts`, give the slide a `range` control so the presenter can drive it:

```ts
{ component: Compare, title: 'Antes / Después', notes: '…',
  controls: [{ kind: 'range', label: 'Comparar', stateKey: 'compare', lowLabel: 'Antes', highLabel: 'Después' }] }
```
