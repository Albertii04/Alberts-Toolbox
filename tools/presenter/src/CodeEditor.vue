<script setup lang="ts">
import { nextTick, onMounted, ref } from 'vue'

const props = defineProps<{ presId: string }>()

interface Msg {
  role: 'user' | 'assistant' | 'tool' | 'error'
  text: string
}

interface ChatEvent {
  presId: string
  kind: 'assistant' | 'tool' | 'done' | 'error'
  text: string
}
interface Authoring {
  previewUrl(): Promise<string>
  sendChat(presId: string, message: string): Promise<void>
  onChat(cb: (e: ChatEvent) => void): () => void
}

const authoring = (window as unknown as { toolbox?: { authoring?: Authoring } }).toolbox?.authoring

const messages = ref<Msg[]>([])
const input = ref('')
const busy = ref(false)
const previewUrl = ref('')
const scroller = ref<HTMLElement | null>(null)

function scroll(): void {
  nextTick(() => {
    if (scroller.value) scroller.value.scrollTop = scroller.value.scrollHeight
  })
}

onMounted(async () => {
  if (!authoring) {
    messages.value.push({ role: 'error', text: 'El editor IA solo está disponible dentro del shell.' })
    return
  }
  authoring.onChat((e) => {
    if (e.presId !== props.presId) return
    if (e.kind === 'assistant') messages.value.push({ role: 'assistant', text: e.text })
    else if (e.kind === 'tool') messages.value.push({ role: 'tool', text: e.text })
    else if (e.kind === 'error') {
      messages.value.push({ role: 'error', text: e.text })
      busy.value = false
    } else if (e.kind === 'done') {
      busy.value = false
    }
    scroll()
  })
  try {
    const base = await authoring.previewUrl()
    previewUrl.value = `${base}?pres=${props.presId}`
  } catch {
    /* preview may be unavailable */
  }
})

async function send(): Promise<void> {
  const text = input.value.trim()
  if (!text || busy.value || !authoring) return
  messages.value.push({ role: 'user', text })
  input.value = ''
  busy.value = true
  scroll()
  try {
    await authoring.sendChat(props.presId, text)
  } catch (e) {
    messages.value.push({ role: 'error', text: String(e) })
    busy.value = false
  }
}
function play(): void {
  window.open(`?preview=${props.presId}`, '_blank')
}
function goHome(): void {
  location.search = ''
}
</script>

<template>
  <div class="ce">
    <aside class="ce-chat">
      <header class="ce-head">
        <button class="ce-btn" @click="goHome">‹ Inicio</button>
        <span class="ce-title">Editor · IA</span>
        <button class="ce-btn" @click="play">Reproducir ↗</button>
      </header>

      <div ref="scroller" class="ce-msgs">
        <div v-if="!messages.length" class="ce-hint">
          Dile a Claude qué quieres. Ejemplos:
          <ul>
            <li>"Añade una slide de cierre con una cita grande."</li>
            <li>"Haz que la portada tenga un degradado animado."</li>
            <li>"Cambia el color de acento a verde."</li>
            <li>"Añade una transición de zoom entre slides."</li>
          </ul>
          Claude edita el código de esta presentación y el preview se actualiza solo.
        </div>
        <div v-for="(m, i) in messages" :key="i" class="ce-msg" :class="m.role">
          <span v-if="m.role === 'tool'" class="ce-tool">⚙ {{ m.text }}</span>
          <template v-else>{{ m.text }}</template>
        </div>
        <div v-if="busy" class="ce-msg tool"><span class="ce-tool">Claude trabajando…</span></div>
      </div>

      <div class="ce-input">
        <textarea
          v-model="input"
          rows="2"
          placeholder="Escribe a Claude… (Enter envía, Shift+Enter salto de línea)"
          @keydown.enter.exact.prevent="send"
        />
        <button class="ce-send" :disabled="busy || !input.trim()" @click="send">Enviar</button>
      </div>
    </aside>

    <main class="ce-preview">
      <iframe v-if="previewUrl" :src="previewUrl" class="ce-frame" title="Vista en vivo" />
      <div v-else class="ce-loading">Iniciando preview en vivo…</div>
    </main>
  </div>
</template>

<style scoped>
.ce {
  position: fixed;
  inset: 0;
  display: grid;
  grid-template-columns: 24rem 1fr;
  color: var(--fg-tertiary);
}
.ce-chat {
  display: flex;
  flex-direction: column;
  border-right: 1px solid var(--rule);
  min-height: 0;
}
.ce-head {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  height: 48px;
  padding: 0 0.75rem;
  border-bottom: 1px solid var(--rule);
  flex-shrink: 0;
}
.ce-title {
  font-size: 0.85rem;
  font-weight: 500;
  color: var(--fg-primary);
  margin: 0 auto 0 0.25rem;
}
.ce-btn {
  padding: 0.35rem 0.7rem;
  border: 1px solid var(--rule);
  border-radius: 3px;
  font-size: 0.78rem;
  color: var(--slate-300);
}
.ce-btn:hover {
  border-color: rgba(148, 168, 202, 0.5);
}
.ce-msgs {
  flex: 1;
  overflow-y: auto;
  padding: 1rem;
  display: flex;
  flex-direction: column;
  gap: 0.7rem;
  min-height: 0;
}
.ce-hint {
  font-size: 0.8rem;
  color: var(--fg-muted);
  line-height: 1.6;
}
.ce-hint ul {
  margin: 0.5rem 0;
  padding-left: 1rem;
}
.ce-hint li {
  margin: 0.2rem 0;
}
.ce-msg {
  font-size: 0.85rem;
  line-height: 1.5;
  white-space: pre-wrap;
  word-break: break-word;
  padding: 0.55rem 0.75rem;
  border-radius: 6px;
  max-width: 92%;
}
.ce-msg.user {
  align-self: flex-end;
  background: var(--brand-700);
  color: #fff;
}
.ce-msg.assistant {
  align-self: flex-start;
  background: rgba(255, 255, 255, 0.04);
  color: var(--fg-secondary);
}
.ce-msg.tool {
  align-self: flex-start;
  padding: 0.2rem 0;
  background: none;
}
.ce-tool {
  font-size: 0.72rem;
  color: var(--brand-300);
  font-variant-numeric: tabular-nums;
}
.ce-msg.error {
  align-self: flex-start;
  color: #f3a3a3;
  background: rgba(243, 163, 163, 0.08);
}
.ce-input {
  border-top: 1px solid var(--rule);
  padding: 0.6rem;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  flex-shrink: 0;
}
.ce-input textarea {
  resize: none;
  background: rgba(255, 255, 255, 0.02);
  border: 1px solid var(--rule);
  border-radius: 4px;
  padding: 0.55rem 0.65rem;
  color: var(--fg-primary);
  font-size: 0.85rem;
  font-family: inherit;
  outline: none;
}
.ce-input textarea:focus {
  border-color: var(--brand-500);
}
.ce-send {
  align-self: flex-end;
  padding: 0.45rem 1.1rem;
  background: var(--brand-700);
  border: 1px solid var(--brand-600);
  border-radius: 4px;
  color: #fff;
  font-size: 0.8rem;
}
.ce-send:disabled {
  opacity: 0.4;
}
.ce-preview {
  background: var(--slate-950);
  min-width: 0;
}
.ce-frame {
  width: 100%;
  height: 100%;
  border: 0;
  display: block;
}
.ce-loading {
  height: 100%;
  display: grid;
  place-items: center;
  color: var(--fg-muted);
  font-size: 0.9rem;
}
</style>
