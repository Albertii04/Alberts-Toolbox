<script setup lang="ts">
import { ref } from 'vue'

const props = withDefaults(
  defineProps<{
    before: string
    after: string
    pos?: number // 0–100, the wipe position (bind with v-model:pos)
    labelBefore?: string
    labelAfter?: string
  }>(),
  { pos: 50, labelBefore: 'Antes', labelAfter: 'Después' },
)
const emit = defineEmits<{ 'update:pos': [number] }>()

const root = ref<HTMLElement | null>(null)
let dragging = false
function setFromX(x: number): void {
  if (!root.value) return
  const r = root.value.getBoundingClientRect()
  emit('update:pos', Math.max(0, Math.min(100, ((x - r.left) / r.width) * 100)))
}
function onDown(e: PointerEvent): void {
  dragging = true
  ;(e.target as Element).setPointerCapture?.(e.pointerId)
  setFromX(e.clientX)
}
function onMove(e: PointerEvent): void {
  if (dragging) setFromX(e.clientX)
}
function onUp(): void {
  dragging = false
}
const opBefore = (p: number): number => Math.max(0, Math.min(1, (p - 15) / 30))
const opAfter = (p: number): number => Math.max(0, Math.min(1, (85 - p) / 30))
</script>

<template>
  <div
    ref="root"
    class="ba"
    data-no-advance
    @pointerdown="onDown"
    @pointermove="onMove"
    @pointerup="onUp"
    @pointercancel="onUp"
  >
    <img :src="before" class="ba-img" alt="" />
    <div class="ba-after" :style="{ clipPath: `inset(0 0 0 ${props.pos}%)` }">
      <img :src="after" class="ba-img" alt="" />
    </div>
    <div class="ba-label l" :style="{ opacity: opBefore(props.pos) }">{{ labelBefore }}</div>
    <div class="ba-label r" :style="{ opacity: opAfter(props.pos) }">{{ labelAfter }}</div>
    <div class="ba-handle" :style="{ left: props.pos + '%' }"></div>
    <div class="ba-knob" :style="{ left: props.pos + '%' }">‹ ›</div>
  </div>
</template>

<style scoped>
.ba {
  position: relative;
  width: 100%;
  height: 100%;
  aspect-ratio: 16 / 9;
  overflow: hidden;
  border: 1px solid var(--rule-strong);
  border-radius: 2px;
  background: #000;
  cursor: ew-resize;
  user-select: none;
  touch-action: none;
}
.ba-img {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  pointer-events: none;
}
.ba-after {
  position: absolute;
  inset: 0;
  will-change: clip-path;
}
.ba-handle {
  position: absolute;
  top: 0;
  bottom: 0;
  width: 2px;
  background: var(--brand-300);
  transform: translateX(-1px);
  pointer-events: none;
}
.ba-knob {
  position: absolute;
  top: 50%;
  width: 44px;
  height: 44px;
  transform: translate(-50%, -50%);
  border: 1px solid var(--brand-300);
  background: rgba(4, 6, 11, 0.7);
  border-radius: 50%;
  display: grid;
  place-items: center;
  color: var(--brand-300);
  font-size: 0.85rem;
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
  letter-spacing: 0.18em;
  color: var(--fg-primary);
  background: rgba(4, 6, 11, 0.6);
  padding: 0.35rem 0.7rem;
  border: 1px solid var(--rule);
  border-radius: 2px;
  backdrop-filter: blur(6px);
  pointer-events: none;
  transition: opacity 200ms var(--ease);
}
.ba-label.l {
  left: 0.9rem;
}
.ba-label.r {
  right: 0.9rem;
}
</style>
