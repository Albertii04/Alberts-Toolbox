<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'
import gsap from 'gsap'
import { useSliderState } from '../../../engine/composables/useSliderState'

const steps = [
  {
    eyebrow: 'Paso 02 · Librería',
    title: 'Vuestra librería con todo el mobiliario de Concep.',
    body: 'Sillas, mesas, lámparas, vegetación, sanitarios... organizados por familia. Modelados una vez y reutilizados en cada proyecto.',
    image: '/images/03_1_tipos.png',
    caption: 'Vista principal — todas las familias.',
  },
  {
    eyebrow: 'Paso 02 · Dentro de cada familia',
    title: 'Cada familia, sus modelos.',
    body: 'Al abrir una familia vemos todos los modelos que tenemos. Crece con el equipo — cada vez que alguien suma un mueble, queda disponible para el resto.',
    image: '/images/03_2_modelos.png',
    caption: 'Modelos disponibles dentro de una familia.',
  },
  {
    eyebrow: 'Paso 02 · Variantes',
    title: 'Cada modelo, sus colores y acabados.',
    body: 'Color, acabado, medida. El bloque del CAD apunta a la variante exacta — no a una "parecida". Lo que tú dibujaste, eso aparece. Escala 1:1.',
    image: '/images/03_3_variantes.png',
    caption: 'Variantes de un mismo modelo.',
  },
]

// Shared target idx (synced via BC with presenter)
const { variant: targetIdx } = useSliderState('slide07')
// Local rendered idx
const displayIdx = ref(targetIdx.value)

const track = ref<HTMLElement | null>(null)
const eyebrowEl = ref<HTMLElement | null>(null)
const titleEl = ref<HTMLElement | null>(null)
const bodyEl = ref<HTMLElement | null>(null)
const captionEl = ref<HTMLElement | null>(null)

let animating = false
let outgoingImg: HTMLImageElement | null = null

function makeImg(src: string): HTMLImageElement {
  const i = document.createElement('img')
  i.src = src
  i.alt = ''
  i.draggable = false
  return i
}

onMounted(() => {
  if (!track.value) return
  const img = makeImg(steps[displayIdx.value].image)
  // Apply initial off-screen transform BEFORE inserting into DOM so it never paints in default position
  gsap.set(img, { yPercent: -130, scale: 1.02 })
  track.value.appendChild(img)
  outgoingImg = img
  // Animate in once the image is loaded (avoids flicker from late paint)
  const startAnim = () => {
    gsap.to(img, {
      yPercent: 0,
      scale: 1,
      duration: 0.55,
      delay: 0.35,
      ease: 'back.out(0.6)',
      overwrite: 'auto',
    })
  }
  if (img.complete) startAnim()
  else img.addEventListener('load', startAnim, { once: true })
})

async function swapTo(newIdx: number, dir: 1 | -1) {
  if (animating) return
  if (newIdx < 0 || newIdx >= steps.length) return
  if (newIdx === displayIdx.value) return
  if (!track.value) { displayIdx.value = newIdx; return }
  animating = true

  const incoming = makeImg(steps[newIdx].image)
  gsap.set(incoming, {
    yPercent: dir === 1 ? -220 : 220,
    scale: 1.02,
    visibility: 'hidden',
  })
  track.value.appendChild(incoming)

  const textNodes = [eyebrowEl.value, titleEl.value, bodyEl.value, captionEl.value].filter(Boolean) as HTMLElement[]

  const tl = gsap.timeline({
    onComplete: () => {
      if (outgoingImg && outgoingImg.parentElement) outgoingImg.parentElement.removeChild(outgoingImg)
      outgoingImg = incoming
      animating = false
    },
  })

  if (outgoingImg) {
    tl.to(outgoingImg, {
      yPercent: dir === 1 ? 140 : -140,
      scale: 0.94,
      duration: 0.32,
      ease: 'power3.in',
    }, 0)
  }
  tl.to(textNodes, {
    yPercent: dir === 1 ? 120 : -120,
    duration: 0.28,
    stagger: 0.025,
    ease: 'power3.in',
  }, 0.03)

  tl.call(() => {
    displayIdx.value = newIdx
    gsap.set(textNodes, { yPercent: dir === 1 ? -120 : 120 })
    gsap.set(incoming, { visibility: 'visible', yPercent: dir === 1 ? -130 : 130 })
  }, [], 0.34)

  tl.to(incoming, {
    yPercent: 0,
    scale: 1,
    duration: 0.5,
    ease: 'back.out(0.6)',
  }, 0.38)
  tl.to(textNodes, {
    yPercent: 0,
    duration: 0.48,
    stagger: 0.04,
    ease: 'back.out(0.7)',
  }, 0.42)
}

// Watch shared target — animate when changed (locally OR from presenter)
watch(targetIdx, (newV, oldV) => {
  if (newV === displayIdx.value) return
  const dir: 1 | -1 = newV > oldV ? 1 : -1
  swapTo(newV, dir)
})

function tryAdvance(): boolean {
  if (targetIdx.value < steps.length - 1) { targetIdx.value = targetIdx.value + 1; return true }
  return false
}
function tryBack(): boolean {
  if (targetIdx.value > 0) { targetIdx.value = targetIdx.value - 1; return true }
  return false
}
function resetForward() {
  targetIdx.value = 0
  displayIdx.value = 0
  if (track.value) {
    track.value.querySelectorAll('img').forEach(i => i.remove())
    const i = makeImg(steps[0].image)
    track.value.appendChild(i)
    outgoingImg = i
  }
}
function resetBackward() {
  targetIdx.value = steps.length - 1
  displayIdx.value = steps.length - 1
  if (track.value) {
    track.value.querySelectorAll('img').forEach(i => i.remove())
    const i = makeImg(steps[steps.length - 1].image)
    track.value.appendChild(i)
    outgoingImg = i
  }
}

defineExpose({ tryAdvance, tryBack, resetForward, resetBackward })
</script>

<template>
  <div class="center-stage">
    <div class="text-block" style="gap: 0.6rem; overflow: hidden;">
      <span class="eyebrow" ref="eyebrowEl">{{ steps[displayIdx].eyebrow }}</span>
      <h2 class="title" ref="titleEl">{{ steps[displayIdx].title }}</h2>
    </div>

    <div class="stage-image">
      <div class="img-track" ref="track"></div>
    </div>

    <div class="stage-caption" style="overflow: hidden;">
      <p class="body" ref="bodyEl" style="max-width: 72ch;">{{ steps[displayIdx].body }}</p>
      <p class="muted" ref="captionEl">{{ steps[displayIdx].caption }}</p>
      <div class="step-pips">
        <span v-for="(_, i) in steps" :key="i" class="pip" :class="{ active: i === displayIdx }"></span>
      </div>
    </div>
  </div>
</template>
