<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch, nextTick } from 'vue'
import gsap from 'gsap'
import { useDeckSync } from './composables/useDeckSync'
import type { Presentation } from './types'

const props = defineProps<{ presentation: Presentation; navigable?: boolean }>()
const slides = computed(() => props.presentation.slides)
const wordmark = computed(() => props.presentation.theme?.wordmark ?? null)
const themeVars = computed(() => props.presentation.theme?.vars ?? {})

// Slide aspect ratio — picked from the top bar, remembered across reloads.
const ASPECTS = { '16:9': [16, 9], '4:3': [4, 3] } as const
type AspectKey = keyof typeof ASPECTS
const aspect = ref<AspectKey>(((): AspectKey => {
  try {
    return localStorage.getItem('deck-aspect') === '4:3' ? '4:3' : '16:9'
  } catch {
    return '16:9'
  }
})())
function setAspect(a: AspectKey): void {
  aspect.value = a
  try {
    localStorage.setItem('deck-aspect', a)
  } catch {
    /* storage may be unavailable */
  }
}
const stageStyle = computed(() => {
  const [w, h] = ASPECTS[aspect.value]
  return {
    width: `min(100vw, calc(100vh * ${w} / ${h}))`,
    height: `min(100vh, calc(100vw * ${h} / ${w}))`,
  }
})

const { idx } = useDeckSync(0)
const displayIdx = ref(idx.value)
const current = computed(() => slides.value[displayIdx.value]?.component)
const total = computed(() => slides.value.length)
const isCover = computed(() => displayIdx.value === 0)
const isClose = computed(() => displayIdx.value === total.value - 1)

const slideHostEl = ref<HTMLElement | null>(null)
const slideRef = ref<any>(null)
let transitioning = false

function paddedNum(n: number) {
  return String(n).padStart(2, '0')
}

async function transitionTo(newIdx: number, dir: 'next' | 'prev') {
  if (transitioning) return
  if (newIdx === displayIdx.value) return
  transitioning = true
  const host = slideHostEl.value
  if (!host) {
    displayIdx.value = newIdx
    transitioning = false
    return
  }
  // Long, soft exit
  await gsap.to(host, {
    opacity: 0,
    duration: 0.55,
    ease: 'power2.inOut',
  })
  displayIdx.value = newIdx
  await nextTick()
  if (slideRef.value) {
    if (dir === 'next' && typeof slideRef.value.resetForward === 'function') slideRef.value.resetForward()
    if (dir === 'prev' && typeof slideRef.value.resetBackward === 'function') slideRef.value.resetBackward()
  }
  // Host appears invisible. No translate on host — all motion lives in reveals.
  gsap.set(host, { opacity: 0, y: 0 })
  gsap.to(host, {
    opacity: 1,
    duration: 1.2,
    ease: 'power1.out',
  })
  // Reveals start AFTER host has started fading in — feels layered, not abrupt
  const reveals = host.querySelectorAll('[data-reveal]')
  if (reveals.length) {
    gsap.fromTo(reveals,
      { opacity: 0, y: 30 },
      { opacity: 1, y: 0, duration: 1.0, stagger: 0.14, ease: 'expo.out', delay: 0.4 }
    )
  }
  setTimeout(() => { transitioning = false }, 700)
}

watch(idx, (newV, oldV) => {
  if (newV === displayIdx.value) return
  const dir: 'next' | 'prev' = newV > oldV ? 'next' : 'prev'
  transitionTo(newV, dir)
})

// Advancing respects a slide's internal sub-states (tryAdvance/tryBack) first.
function next() {
  if (slideRef.value && typeof slideRef.value.tryAdvance === 'function' && slideRef.value.tryAdvance())
    return
  if (idx.value < total.value - 1) idx.value = idx.value + 1
}
function prev() {
  if (slideRef.value && typeof slideRef.value.tryBack === 'function' && slideRef.value.tryBack())
    return
  if (idx.value > 0) idx.value = idx.value - 1
}

function onKey(e: KeyboardEvent) {
  switch (e.key) {
    case 'f':
    case 'F':
      if (!document.fullscreenElement) document.documentElement.requestFullscreen()
      else document.exitFullscreen()
      break
    case 'Escape':
      if (document.fullscreenElement) document.exitFullscreen()
      break
    case 'ArrowRight':
    case ' ':
    case 'PageDown':
      if (props.navigable) next()
      break
    case 'ArrowLeft':
    case 'PageUp':
      if (props.navigable) prev()
      break
  }
}

function onStageClick(_e: MouseEvent) {
  // Click-to-advance disabled — control only from presenter / editor UI
}

// In the editor preview (navigable), accept nav from the parent window and
// report the current slide so the editor can show controls + a counter.
function onMessage(e: MessageEvent) {
  if (e.data?.type === 'deck-nav') {
    if (e.data.dir === 'prev') prev()
    else next()
  } else if (e.data?.type === 'deck-aspect') {
    if (e.data.aspect === '4:3' || e.data.aspect === '16:9') setAspect(e.data.aspect)
  }
}
function postState() {
  if (!props.navigable) return
  try {
    window.parent?.postMessage(
      { type: 'deck-state', idx: displayIdx.value, total: total.value },
      '*',
    )
  } catch {
    /* no parent */
  }
}
watch(displayIdx, postState)

onMounted(() => {
  document.addEventListener('keydown', onKey)
  if (props.navigable) {
    window.addEventListener('message', onMessage)
    nextTick(postState)
  }
  nextTick(() => {
    const host = slideHostEl.value
    if (!host) return
    gsap.set(host, { opacity: 1, y: 0 })
    const reveals = host.querySelectorAll('[data-reveal]')
    if (reveals.length) {
      gsap.fromTo(reveals,
        { opacity: 0, yPercent: -120 },
        { opacity: 1, yPercent: 0, duration: 0.85, stagger: 0.09, ease: 'back.out(0.6)', delay: 0.2 }
      )
    }
  })
})
onUnmounted(() => {
  document.removeEventListener('keydown', onKey)
  window.removeEventListener('message', onMessage)
})

watch(idx, (v) => {
  history.replaceState(null, '', `#${v + 1}`)
})

const hash = parseInt(location.hash.replace('#', ''), 10)
if (!isNaN(hash) && hash >= 1 && hash <= slides.value.length) idx.value = hash - 1
</script>

<template>
  <div class="deck" :style="themeVars" @click="onStageClick">
    <div class="progress">
      <div class="bar" :style="{ width: ((displayIdx + 1) / total * 100) + '%' }"></div>
    </div>

    <div class="deck-stage" :style="stageStyle">
      <div class="slide-host" ref="slideHostEl" :key="displayIdx">
        <component :is="current" ref="slideRef" />
      </div>

      <div v-show="wordmark && !isCover && !isClose" class="wordmark">
        <span class="wm-primary">{{ wordmark?.primary }}</span><span class="wm-slash">/</span><span class="wm-suffix">{{ wordmark?.suffix }}</span>
      </div>
      <div v-show="!isCover" class="counter">
        <span>{{ paddedNum(displayIdx + 1) }}</span><span class="sep">/</span><span>{{ paddedNum(total) }}</span>
      </div>
    </div>
  </div>
</template>
