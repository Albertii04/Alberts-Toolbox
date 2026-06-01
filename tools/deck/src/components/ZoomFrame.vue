<script setup lang="ts">
import { onMounted, ref, computed, watch } from 'vue'
import gsap from 'gsap'

const props = withDefaults(defineProps<{
  src: string
  focalX?: string
  focalY?: string
  scale?: number
  instant?: boolean   // Skip animation — render directly at final zoom state
  reveal?: boolean    // Include opacity fade-in during animation
  start?: boolean     // Trigger animation. Default true.
}>(), {
  focalX: '50%',
  focalY: '50%',
  scale: 3.0,
  instant: false,
  reveal: false,
  start: true,
})

const img = ref<HTMLElement | null>(null)

const fx = computed(() => parseFloat(props.focalX))
const fy = computed(() => parseFloat(props.focalY))
const tx = computed(() => 50 - fx.value)
const ty = computed(() => 50 - fy.value)

function applyFinal() {
  if (!img.value) return
  gsap.set(img.value, {
    scale: props.scale,
    xPercent: tx.value,
    yPercent: ty.value,
    opacity: 1,
  })
}

function runAnim() {
  if (!img.value) return
  const fromState: any = { scale: 1, xPercent: 0, yPercent: 0 }
  if (props.reveal) fromState.opacity = 0
  gsap.fromTo(img.value, fromState, {
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
  if (props.instant) {
    applyFinal()
    return
  }
  if (props.start) runAnim()
  else if (props.reveal && img.value) gsap.set(img.value, { opacity: 0 })
})

// Trigger anim when start flips to true; reset when flips to false
watch(() => props.start, (v, prev) => {
  if (props.instant) return
  if (v && !prev) runAnim()
  else if (!v && prev && img.value) {
    gsap.to(img.value, {
      scale: 1,
      xPercent: 0,
      yPercent: 0,
      duration: 0.7,
      ease: 'power3.inOut',
    })
  }
})
</script>

<template>
  <div class="zoom-frame">
    <div
      class="zoom-img"
      ref="img"
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
  aspect-ratio: 16/10;
  overflow: hidden;
  border: 1px solid var(--rule-strong);
  background: rgba(255,255,255,0.015);
  border-radius: 2px;
}
.zoom-img {
  position: absolute; inset: 0;
  background-size: cover;
  will-change: transform, opacity;
}
</style>
