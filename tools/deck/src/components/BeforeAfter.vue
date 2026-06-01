<script setup lang="ts">
import { ref, onMounted } from 'vue'

const props = withDefaults(defineProps<{
  before: string
  after: string
  labelBefore?: string
  labelAfter?: string
}>(), {
  labelBefore: 'Antes',
  labelAfter: 'Después',
})

const root = ref<HTMLElement | null>(null)
const pos = ref(97)
const touched = ref(false)
let dragging = false

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

onMounted(() => {
  // Start fully on "crudo" — no auto-sweep
  pos.value = 97
})

const opacityBefore = (p: number) => Math.max(0, Math.min(1, (p - 15) / 30))
const opacityAfter = (p: number) => Math.max(0, Math.min(1, (85 - p) / 30))
</script>

<template>
  <div
    ref="root"
    class="ba-slider"
    data-no-advance
    @pointerdown="onDown"
    @pointermove="onMove"
    @pointerup="onUp"
    @pointercancel="onUp"
  >
    <img :src="before" class="ba-img" alt="" />
    <div class="ba-after-wrap" :style="{ clipPath: `inset(0 0 0 ${pos}%)` }">
      <img :src="after" class="ba-img" alt="" />
    </div>
    <div class="ba-label ba-label-before" :style="{ opacity: opacityBefore(pos) }">{{ labelBefore }}</div>
    <div class="ba-label ba-label-after" :style="{ opacity: opacityAfter(pos) }">{{ labelAfter }}</div>
    <div class="ba-handle" :style="{ left: pos + '%' }"></div>
    <div class="ba-knob" :style="{ left: pos + '%' }">‹ ›</div>
  </div>
</template>

<style scoped>
.ba-slider {
  position: relative;
  width: 100%;
  aspect-ratio: 16/10;
  overflow: hidden;
  border: 1px solid var(--rule-strong);
  border-radius: 2px;
  background: #000;
  cursor: ew-resize;
  user-select: none;
  touch-action: none;
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
  top: 0.9rem;
  font-size: 0.625rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: var(--track-eyebrow);
  color: var(--fg-primary);
  background: rgba(4,6,11,0.6);
  padding: 0.35rem 0.7rem;
  border: 1px solid var(--rule);
  border-radius: 2px;
  backdrop-filter: blur(6px);
  pointer-events: none;
  transition: opacity 200ms var(--ease);
}
.ba-label-before { left: 0.9rem; }
.ba-label-after  { right: 0.9rem; }
</style>
