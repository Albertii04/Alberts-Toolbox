<script setup lang="ts">
import { ref, computed, watch, nextTick } from 'vue'
import gsap from 'gsap'
import ZoomFrame from '../components/ZoomFrame.vue'
import { useSliderState } from '../composables/useSliderState'

// state: 0 = intro sin zoom · 1 = intro + zoom · 2 = nuevo texto (extensión clave) + zoom mantenido
const { variant: stateIdx } = useSliderState('slide05')
const displayState = ref(stateIdx.value)
const zoomActive = computed(() => displayState.value >= 1)

const texts = [
  {
    eyebrow: 'Paso 02 · 3D',
    title: 'Pasamos el CAD a SketchUp.',
    body: 'Cargamos el plano como base. A la derecha tenéis el panel habitual de extensiones — las que vienen con el programa, más una que hemos construido a medida para Concep.',
    extra: 'La última, <span class="accent-text">la del icono azul con la C</span>, es la vuestra.',
  },
  {
    eyebrow: 'Paso 02 · 3D',
    title: 'Pasamos el CAD a SketchUp.',
    body: 'Cargamos el plano como base. A la derecha tenéis el panel habitual de extensiones — las que vienen con el programa, más una que hemos construido a medida para Concep.',
    extra: 'La última, <span class="accent-text">la del icono azul con la C</span>, es la vuestra.',
  },
  {
    eyebrow: 'Paso 02 · La pieza clave',
    title: 'Esta extensión hace el 95% del trabajo.',
    body: 'Lee los nombres de bloques del CAD, busca cada uno en vuestra librería de modelos 3D y los coloca en el sitio exacto donde estaban dibujados.',
    extra: '<span class="muted">Lo que antes era modelar a mano, ahora es un clic.</span>',
  },
]

const textBlock = ref<HTMLElement | null>(null)
let textAnimating = false

async function swapText(newIdx: number, dir: 1 | -1) {
  // Only crossfade when text content actually differs
  const oldT = texts[displayState.value]
  const newT = texts[newIdx]
  const sameText = oldT.title === newT.title && oldT.body === newT.body && oldT.eyebrow === newT.eyebrow
  if (sameText) { displayState.value = newIdx; return }
  if (textAnimating || !textBlock.value) { displayState.value = newIdx; return }
  textAnimating = true
  const children = Array.from(textBlock.value.children) as HTMLElement[]
  const tl = gsap.timeline({ onComplete: () => { textAnimating = false } })
  tl.to(children, {
    opacity: 0,
    yPercent: dir === 1 ? -40 : 40,
    duration: 0.28,
    stagger: 0.03,
    ease: 'power3.in',
  })
  tl.call(() => { displayState.value = newIdx })
  tl.add(() => nextTick())
  tl.set(children, { yPercent: dir === 1 ? 40 : -40 })
  tl.to(children, {
    opacity: 1,
    yPercent: 0,
    duration: 0.55,
    stagger: 0.06,
    ease: 'back.out(0.6)',
  })
}

watch(stateIdx, (newV, oldV) => {
  if (newV === displayState.value) return
  const dir: 1 | -1 = newV > oldV ? 1 : -1
  swapText(newV, dir)
})

function tryAdvance(): boolean {
  if (stateIdx.value < texts.length - 1) { stateIdx.value = stateIdx.value + 1; return true }
  return false
}
function tryBack(): boolean {
  if (stateIdx.value > 0) { stateIdx.value = stateIdx.value - 1; return true }
  return false
}
function resetForward() { stateIdx.value = 0; displayState.value = 0 }
function resetBackward() { stateIdx.value = texts.length - 1; displayState.value = texts.length - 1 }

defineExpose({ tryAdvance, tryBack, resetForward, resetBackward })
</script>

<template>
  <div class="layout-split">
    <div class="text-block" ref="textBlock" style="overflow: hidden;">
      <span class="eyebrow">{{ texts[displayState].eyebrow }}</span>
      <h2 class="title">{{ texts[displayState].title }}</h2>
      <p class="body" v-html="texts[displayState].body"></p>
      <p class="body fg-primary" v-html="texts[displayState].extra"></p>
    </div>
    <div data-reveal>
      <ZoomFrame
        src="/images/02_sketchup.png"
        focal-x="37%"
        focal-y="5%"
        :scale="4.5"
        :start="zoomActive"
      />
    </div>
  </div>
</template>
