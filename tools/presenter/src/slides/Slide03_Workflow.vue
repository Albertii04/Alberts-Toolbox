<script setup lang="ts">
import { useSliderState } from '../composables/useSliderState'

const { variant: step } = useSliderState('slide03')

const steps = [
  { num: '01 · Partida', title: 'El CAD de siempre', desc: 'Capas y bloques nombrados como ya los nombramos.' },
  { num: '02 · 3D',       title: 'SketchUp + extensión propia', desc: 'Cada bloque del CAD se convierte en su mueble 3D.' },
  { num: '03 · Detalle',  title: 'Toques a mano', desc: 'Materiales y pequeños arreglos donde hace falta.' },
  { num: '04 · Render',   title: 'D5 Render + IA', desc: 'Imagen fotorrealista en menos de un minuto.' },
]

function nodeState(i: number): 'past' | 'active' | 'pending' {
  if (i < step.value) return 'past'
  if (i === step.value) return 'active'
  return 'pending'
}

function tryAdvance(): boolean {
  if (step.value < steps.length - 1) { step.value = step.value + 1; return true }
  return false
}
function tryBack(): boolean {
  if (step.value > 0) { step.value = step.value - 1; return true }
  return false
}
function resetForward() { step.value = 0 }
function resetBackward() { step.value = steps.length - 1 }

defineExpose({ tryAdvance, tryBack, resetForward, resetBackward })
</script>

<template>
  <div class="wf-stage">
    <div class="text-block wf-header">
      <span class="eyebrow" data-reveal>El flujo</span>
      <h2 class="title" data-reveal>Cuatro pasos. Tú mismo. La misma tarde.</h2>
    </div>

    <div class="workflow workflow-centered">
      <template v-for="(s, i) in steps" :key="i">
        <div class="wf-node" :class="[nodeState(i)]">
          <span class="step-num">{{ s.num }}</span>
          <span class="step-title">{{ s.title }}</span>
          <span class="step-desc">{{ s.desc }}</span>
        </div>
        <div v-if="i < steps.length - 1" class="wf-arrow" :class="{ done: i < step }">→</div>
      </template>
    </div>
  </div>
</template>

<style scoped>
.wf-stage {
  display: flex;
  flex-direction: column;
  justify-content: center;
  height: 100%;
  gap: 2.5rem;
}
.wf-header {
  gap: 0.6rem;
}

.workflow-centered {
  display: grid;
  grid-template-columns: 1fr auto 1fr auto 1fr auto 1fr;
  align-items: stretch;
  width: 100%;
  gap: 0;
}

.wf-node {
  position: relative;
  border: 1px solid var(--rule);
  padding: 1.5rem 1.25rem;
  background: rgba(15,23,42,0.5);
  border-radius: 2px;
  display: flex; flex-direction: column; gap: 0.6rem;
  min-height: 10rem;
  transition: background 500ms var(--ease), border-color 500ms var(--ease), opacity 500ms var(--ease), transform 500ms var(--ease);
  overflow: hidden;
}
.wf-node :deep(.step-num),
.wf-node :deep(.step-title),
.wf-node :deep(.step-desc) {
  transition: color 500ms var(--ease), opacity 500ms var(--ease);
}

/* Pending — dimmed + blurry text */
.wf-node.pending {
  opacity: 0.55;
  border-color: var(--rule);
  background: rgba(15,23,42,0.3);
}
.wf-node.pending :deep(.step-num),
.wf-node.pending :deep(.step-title),
.wf-node.pending :deep(.step-desc) {
  filter: blur(3px);
  opacity: 0.6;
}

/* Past — solid highlight, no animation */
.wf-node.past {
  border-color: var(--brand-400);
  background: rgba(54,72,110,0.20);
  opacity: 1;
}

/* Active — bright highlight + rotating border */
.wf-node.active {
  opacity: 1;
  border-color: transparent;
  background: rgba(54,72,110,0.30);
  transform: translateY(-2px);
  box-shadow: 0 24px 48px -24px rgba(0,0,0,0.6);
  z-index: 2;
}
.wf-node.active::before {
  content: "";
  position: absolute;
  inset: -2px;
  border-radius: 2px;
  padding: 2.5px;
  background: conic-gradient(
    from var(--spin-angle, 0deg),
    transparent 0%,
    rgba(148,168,202,0.0) 30%,
    var(--brand-300) 55%,
    #ffffff 72%,
    var(--brand-300) 85%,
    rgba(148,168,202,0.0) 100%
  );
  -webkit-mask:
    linear-gradient(#000 0 0) content-box,
    linear-gradient(#000 0 0);
  -webkit-mask-composite: xor;
          mask-composite: exclude;
  pointer-events: none;
  animation: wf-spin 2.4s linear infinite;
  filter: drop-shadow(0 0 8px rgba(148,168,202,0.55));
}
@property --spin-angle {
  syntax: '<angle>';
  inherits: false;
  initial-value: 0deg;
}
@keyframes wf-spin {
  to { --spin-angle: 360deg; }
}

.wf-arrow {
  display: grid; place-items: center;
  color: var(--rule-strong);
  font-size: 1.1rem;
  padding: 0 0.4rem;
  font-weight: 300;
  transition: color 500ms var(--ease);
}
.wf-arrow.done { color: var(--brand-300); }
</style>
