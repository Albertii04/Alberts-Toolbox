import { ref, watch, onUnmounted } from 'vue'

const CHANNEL = 'deck-slider'
const STORAGE_KEY = 'deck-slider'

interface SliderState {
  pos: number
  variant: number
}

const defaultState: SliderState = { pos: 97, variant: 0 }

export function useSliderState(key: string) {
  const pos = ref(defaultState.pos)
  const variant = ref(defaultState.variant)
  let lastPos = pos.value
  let lastVariant = variant.value
  let channel: BroadcastChannel | null = null

  // Try load initial from localStorage
  try {
    const raw = localStorage.getItem(`${STORAGE_KEY}:${key}`)
    if (raw) {
      const s = JSON.parse(raw) as SliderState
      if (typeof s.pos === 'number') { pos.value = s.pos; lastPos = s.pos }
      if (typeof s.variant === 'number') { variant.value = s.variant; lastVariant = s.variant }
    }
  } catch {}

  if (typeof BroadcastChannel !== 'undefined') {
    channel = new BroadcastChannel(CHANNEL)
    channel.onmessage = (e) => {
      if (e.data?.key !== key) return
      if (typeof e.data.pos === 'number' && e.data.pos !== pos.value) {
        lastPos = e.data.pos
        pos.value = e.data.pos
      }
      if (typeof e.data.variant === 'number' && e.data.variant !== variant.value) {
        lastVariant = e.data.variant
        variant.value = e.data.variant
      }
    }
  }

  function publish() {
    if (channel) channel.postMessage({ key, pos: pos.value, variant: variant.value })
    try { localStorage.setItem(`${STORAGE_KEY}:${key}`, JSON.stringify({ pos: pos.value, variant: variant.value })) } catch {}
  }

  watch(pos, (v) => {
    if (v === lastPos) return
    lastPos = v
    publish()
  }, { flush: 'sync' })

  watch(variant, (v) => {
    if (v === lastVariant) return
    lastVariant = v
    publish()
  }, { flush: 'sync' })

  window.addEventListener('storage', (e) => {
    if (e.key === `${STORAGE_KEY}:${key}` && e.newValue) {
      try {
        const s = JSON.parse(e.newValue) as SliderState
        if (typeof s.pos === 'number' && s.pos !== pos.value) { lastPos = s.pos; pos.value = s.pos }
        if (typeof s.variant === 'number' && s.variant !== variant.value) { lastVariant = s.variant; variant.value = s.variant }
      } catch {}
    }
  })

  onUnmounted(() => {
    if (channel) channel.close()
  })

  return { pos, variant }
}
