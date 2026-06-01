<script setup lang="ts">
import { ref, onMounted, nextTick, watch } from 'vue'
import gsap from 'gsap'
import { useSliderState } from '../../../engine/composables/useSliderState'

const variants = [
  { despues: '/images/1_despues.png', label: 'Render 01 · Referencia 01', ref: '/images/ref_01.jpeg' },
  { despues: '/images/2_despues.png', label: 'Render 02 · Referencia 03', ref: '/images/ref_03.jpg' },
  { despues: '/images/3_despues.png', label: 'Render 03 · Referencia 04', ref: '/images/ref_04.jpg' },
  { despues: '/images/4_despues.png', label: 'Render 04 · Referencia 02', ref: '/images/ref_02.jpeg' },
]

const showRef = ref(false)
const antesSrc = '/images/1_antes.jpg'

const { pos, variant: variantIdx } = useSliderState('slide17')
const displayVariant = ref(variantIdx.value)
const touched = ref(false)
const root = ref<HTMLElement | null>(null)
const afterImg = ref<HTMLImageElement | null>(null)
const labelEl = ref<HTMLElement | null>(null)
let dragging = false
let swapping = false

function setFromClientX(x: number) {
  if (!root.value) return
  const r = root.value.getBoundingClientRect()
  pos.value = Math.max(0, Math.min(100, ((x - r.left) / r.width) * 100))
}
function onDown(e: PointerEvent) {
  dragging = true
  touched.value = true
  ;(e.target as Element).setPointerCapture?.(e.pointerId)
  setFromClientX(e.clientX)
}
function onMove(e: PointerEvent) {
  if (!dragging) return
  setFromClientX(e.clientX)
}
function onUp() { dragging = false }

const opacityBefore = (p: number) => Math.max(0, Math.min(1, (p - 15) / 30))
const opacityAfter = (p: number) => Math.max(0, Math.min(1, (85 - p) / 30))

async function animateSwap(newIdx: number, dir: 1 | -1) {
  if (swapping) return
  swapping = true
  const targets = [afterImg.value, labelEl.value].filter(Boolean) as HTMLElement[]
  const tl = gsap.timeline({ onComplete: () => { swapping = false } })
  tl.to(targets, { opacity: 0, yPercent: dir === 1 ? -10 : 10, duration: 0.25, ease: 'power2.in' })
  tl.call(() => { displayVariant.value = newIdx })
  tl.add(() => nextTick())
  tl.set(targets, { yPercent: dir === 1 ? 10 : -10 })
  tl.to(targets, { opacity: 1, yPercent: 0, duration: 0.5, ease: 'power3.out' })
}

// Animate when shared variant changes (from local OR remote)
watch(variantIdx, (newV, oldV) => {
  if (newV === displayVariant.value) return
  const dir: 1 | -1 = newV > oldV ? 1 : -1
  animateSwap(newV, dir)
})

function tryAdvance(): boolean {
  if (variantIdx.value < variants.length - 1) { variantIdx.value = variantIdx.value + 1; return true }
  return false
}
function tryBack(): boolean {
  if (variantIdx.value > 0) { variantIdx.value = variantIdx.value - 1; return true }
  return false
}
function resetForward() { variantIdx.value = 0; displayVariant.value = 0; pos.value = 97; touched.value = false }
function resetBackward() { variantIdx.value = variants.length - 1; displayVariant.value = variants.length - 1; pos.value = 97; touched.value = false }

defineExpose({ tryAdvance, tryBack, resetForward, resetBackward })

onMounted(() => { pos.value = 97 })
</script>

<template>
  <div style="display: flex; flex-direction: column; gap: 1rem; height: 100%; position: relative;">
    <div class="title-row">
      <div class="text-block">
        <span class="eyebrow" data-reveal>Resultado</span>
        <h2 class="title" style="max-width: 38ch;" data-reveal>
          Mismo CAD. Cuatro referencias. <span class="accent-text">Cuatro imágenes para el cliente.</span>
        </h2>
      </div>
      <button
        class="ref-btn"
        data-no-advance
        data-reveal
        @mouseenter="showRef = true"
        @mouseleave="showRef = false"
        @focus="showRef = true"
        @blur="showRef = false"
      >
        Ver referencia
        <span class="ref-btn-arrow">↗</span>
      </button>
    </div>

    <transition name="ref-fade">
      <div v-if="showRef" class="ref-overlay">
        <div class="ref-card">
          <div class="ref-card-label">Referencia · {{ String(displayVariant + 1).padStart(2, '0') }}</div>
          <img :src="variants[displayVariant].ref" :alt="'Referencia ' + (displayVariant + 1)" />
        </div>
      </div>
    </transition>

    <div
      class="ba-slider-final"
      ref="root"
      data-no-advance
      data-reveal
      @pointerdown="onDown"
      @pointermove="onMove"
      @pointerup="onUp"
      @pointercancel="onUp"
    >
      <img class="ba-img" :src="antesSrc" alt="Antes" />
      <div class="ba-after-wrap" :style="{ clipPath: `inset(0 0 0 ${pos}%)` }">
        <img class="ba-img" ref="afterImg" :src="variants[displayVariant].despues" :alt="variants[displayVariant].label" />
      </div>
      <div class="ba-label antes" :style="{ opacity: opacityBefore(pos) }">Antes · Crudo</div>
      <div class="ba-label despues" ref="labelEl" :style="{ opacity: opacityAfter(pos) }">{{ variants[displayVariant].label }}</div>
      <div class="ba-handle" :style="{ left: pos + '%' }"></div>
      <div class="ba-knob" :style="{ left: pos + '%' }">‹ ›</div>
      <div class="ba-pips">
        <span v-for="(_, i) in variants" :key="i" class="pip" :class="{ active: i === displayVariant }"></span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.ba-slider-final {
  position: relative;
  flex: 1;
  min-height: 0;
  width: 100%;
  overflow: hidden;
  border-radius: 2px;
  background: #000;
  cursor: ew-resize;
  user-select: none;
  touch-action: none;
  box-shadow:
    0 24px 64px -24px rgba(0,0,0,0.6),
    inset 0 0 0 1px var(--rule-strong);
}
.ba-img {
  position: absolute; inset: 0;
  width: 100%; height: 100%;
  object-fit: cover;
  pointer-events: none;
}
.ba-after-wrap {
  position: absolute; inset: 0;
  will-change: clip-path;
}
.ba-handle {
  position: absolute;
  top: 0; bottom: 0;
  width: 2px;
  background: var(--brand-300);
  transform: translateX(-1px);
  pointer-events: none;
  box-shadow: 0 0 0 1px rgba(4,6,11,0.4);
}
.ba-knob {
  position: absolute;
  top: 50%;
  width: 44px; height: 44px;
  transform: translate(-50%, -50%);
  border: 1px solid var(--brand-300);
  background: rgba(4,6,11,0.7);
  border-radius: 50%;
  display: grid; place-items: center;
  color: var(--brand-300);
  font-size: 0.85rem;
  font-weight: 300;
  letter-spacing: 0.15em;
  pointer-events: none;
  backdrop-filter: blur(6px);
}
.ba-label {
  position: absolute;
  top: 1.1rem;
  font-size: 0.7rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.18em;
  color: var(--fg-primary);
  background: rgba(4,6,11,0.6);
  padding: 0.45rem 0.85rem;
  border: 1px solid var(--rule);
  border-radius: 2px;
  backdrop-filter: blur(8px);
  pointer-events: none;
  transition: opacity 200ms var(--ease);
}
.ba-label.antes   { left: 1.1rem; }
.ba-label.despues { right: 1.1rem; color: var(--brand-100); border-color: var(--brand-400); }
.ba-pips {
  position: absolute;
  bottom: 1.1rem;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  gap: 0.5rem;
  background: rgba(4,6,11,0.55);
  border: 1px solid var(--rule);
  border-radius: 2px;
  padding: 0.5rem 0.7rem;
  backdrop-filter: blur(6px);
  pointer-events: none;
}
.ba-pips .pip {
  width: 22px; height: 2px;
  background: var(--rule);
  transition: background 250ms var(--ease), transform 250ms var(--ease);
  transform-origin: left center;
}
.ba-pips .pip.active { background: var(--brand-300); transform: scaleX(1.1); }

/* Title row with reference button */
.title-row {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1.5rem;
}
.ref-btn {
  align-self: center;
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.65rem 0.95rem;
  font-size: 0.7rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.16em;
  color: var(--fg-secondary);
  border: 1px solid var(--rule-strong);
  background: rgba(15,23,42,0.5);
  border-radius: 2px;
  cursor: pointer;
  white-space: nowrap;
  transition: background 200ms var(--ease), color 200ms var(--ease), border-color 200ms var(--ease);
}
.ref-btn:hover, .ref-btn:focus-visible {
  background: rgba(54,72,110,0.45);
  color: var(--fg-primary);
  border-color: var(--brand-300);
  outline: none;
}
.ref-btn-arrow {
  color: var(--brand-300);
  font-weight: 300;
}

/* Reference overlay */
.ref-overlay {
  position: absolute;
  inset: 0;
  background: rgba(4,6,11,0.82);
  backdrop-filter: blur(6px);
  display: grid;
  place-items: center;
  z-index: 20;
  pointer-events: none;
}
.ref-card {
  position: relative;
  max-width: 46%;
  max-height: 70%;
  border: 1px solid var(--brand-300);
  border-radius: 2px;
  background: #000;
  overflow: hidden;
  box-shadow:
    0 30px 80px -20px rgba(0,0,0,0.8),
    0 0 0 1px rgba(148,168,202,0.2);
}
.ref-card img {
  display: block;
  width: 100%;
  height: auto;
  max-width: 100%;
  max-height: 70vh;
  object-fit: contain;
}
.ref-card-label {
  position: absolute;
  top: 0.7rem; left: 0.8rem;
  font-size: 0.6rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.18em;
  color: var(--brand-300);
  background: rgba(4,6,11,0.7);
  padding: 0.35rem 0.6rem;
  border: 1px solid var(--rule);
  border-radius: 2px;
  backdrop-filter: blur(4px);
}

.ref-fade-enter-active, .ref-fade-leave-active {
  transition: opacity 220ms var(--ease);
}
.ref-fade-enter-from, .ref-fade-leave-to { opacity: 0; }
</style>
