# Step pipeline / process

A horizontal pipeline of N nodes revealed one step at a time: pending nodes are
dimmed/blurred, the active node has a rotating border, past nodes are highlighted.
The presenter steps through it.

## Wiring recipe

```vue
<script setup lang="ts">
import Pipeline from '../components/Pipeline.vue'
import { useSliderState } from '../../../engine/composables/useSliderState'

const steps = [
  { num: '01 · Partida', title: 'Primer paso', desc: 'Qué pasa aquí.' },
  { num: '02 · …',       title: 'Segundo paso', desc: '…' },
  { num: '03 · …',       title: 'Tercer paso', desc: '…' },
]
const { variant: step } = useSliderState('flow')

function tryAdvance() { if (step.value < steps.length - 1) { step.value++; return true } return false }
function tryBack()    { if (step.value > 0) { step.value--; return true } return false }
function resetForward()  { step.value = 0 }
function resetBackward() { step.value = steps.length - 1 }
defineExpose({ tryAdvance, tryBack, resetForward, resetBackward })
</script>

<template>
  <div style="height:100%; display:flex; flex-direction:column; justify-content:center; gap:2.5rem">
    <h2 class="title" data-reveal>El flujo</h2>
    <Pipeline :steps="steps" :step="step" />
  </div>
</template>
```

`slides.ts`: `controls: [{ kind: 'variants', label: 'Paso', stateKey: 'flow', options: ['01','02','03'] }]`
