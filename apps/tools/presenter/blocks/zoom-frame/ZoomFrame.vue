<script setup lang="ts">
import { onMounted, ref, computed, watch } from 'vue'
import gsap from 'gsap'

const props = withDefaults(
  defineProps<{
    src: string
    focalX?: string
    focalY?: string
    scale?: number
    instant?: boolean // render directly at the final zoom (no animation)
    reveal?: boolean // fade opacity in during the zoom
    start?: boolean // trigger the zoom; flip false→true to animate in, true→false to zoom out
  }>(),
  { focalX: '50%', focalY: '50%', scale: 3.0, instant: false, reveal: false, start: true },
)

const img = ref<HTMLElement | null>(null)
const fx = computed(() => parseFloat(props.focalX))
const fy = computed(() => parseFloat(props.focalY))
const tx = computed(() => 50 - fx.value)
const ty = computed(() => 50 - fy.value)

function applyFinal(): void {
  if (img.value) gsap.set(img.value, { scale: props.scale, xPercent: tx.value, yPercent: ty.value, opacity: 1 })
}
function runAnim(): void {
  if (!img.value) return
  const from: gsap.TweenVars = { scale: 1, xPercent: 0, yPercent: 0 }
  if (props.reveal) from.opacity = 0
  gsap.fromTo(img.value, from, {
    scale: props.scale,
    xPercent: tx.value,
    yPercent: ty.value,
    opacity: 1,
    duration: 1.4,
    ease: 'power3.inOut',
    delay: 0.15,
  })
}

onMounted(() => {
  if (props.instant) return applyFinal()
  if (props.start) runAnim()
  else if (props.reveal && img.value) gsap.set(img.value, { opacity: 0 })
})
watch(
  () => props.start,
  (v, prev) => {
    if (props.instant) return
    if (v && !prev) runAnim()
    else if (!v && prev && img.value)
      gsap.to(img.value, { scale: 1, xPercent: 0, yPercent: 0, duration: 0.7, ease: 'power3.inOut' })
  },
)
</script>

<template>
  <div class="zoom-frame">
    <div
      ref="img"
      class="zoom-img"
      :style="{
        backgroundImage: `url(${src})`,
        backgroundPosition: `${focalX} ${focalY}`,
        transformOrigin: `${focalX} ${focalY}`,
      }"
    ></div>
  </div>
</template>

<style scoped>
.zoom-frame {
  position: relative;
  width: 100%;
  aspect-ratio: 16 / 10;
  overflow: hidden;
  border: 1px solid var(--rule-strong);
  background: rgba(255, 255, 255, 0.015);
  border-radius: 2px;
}
.zoom-img {
  position: absolute;
  inset: 0;
  background-size: cover;
  will-change: transform, opacity;
}
</style>
