import { ref, watch, onUnmounted } from 'vue'

const STORAGE_KEY = 'deck-idx'
const CHANNEL = 'deck-sync'

export function useDeckSync(initialIdx = 0) {
  const idx = ref(initialIdx)
  // Track the most recent value we broadcasted/received so we don't echo it back.
  let lastSeen = initialIdx
  let channel: BroadcastChannel | null = null

  if (typeof BroadcastChannel !== 'undefined') {
    channel = new BroadcastChannel(CHANNEL)
    channel.onmessage = (e) => {
      if (e.data?.type === 'idx' && typeof e.data.value === 'number') {
        if (e.data.value === idx.value) return
        lastSeen = e.data.value
        idx.value = e.data.value
      }
    }
  }

  window.addEventListener('storage', (e) => {
    if (e.key === STORAGE_KEY && e.newValue) {
      const v = parseInt(e.newValue, 10)
      if (!isNaN(v) && v !== idx.value) {
        lastSeen = v
        idx.value = v
      }
    }
  })

  watch(idx, (v) => {
    if (v === lastSeen) return
    lastSeen = v
    if (channel) channel.postMessage({ type: 'idx', value: v })
    try { localStorage.setItem(STORAGE_KEY, String(v)) } catch {}
  }, { flush: 'sync' })

  onUnmounted(() => {
    if (channel) channel.close()
  })

  return { idx }
}
