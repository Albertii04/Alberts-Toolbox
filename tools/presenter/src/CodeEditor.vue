<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref } from 'vue'
import {
  type ChatMsg,
  type Conversation,
  getChats,
  saveChats,
  getActiveChatId,
  setActiveChatId,
  newConversationId,
  takePendingPrompt,
} from './documents/store'

const props = defineProps<{ presId: string }>()

interface ChatEvent {
  presId: string
  kind: 'assistant' | 'tool' | 'done' | 'error'
  text: string
  sessionId?: string
}
interface Authoring {
  previewUrl(): Promise<string>
  sendChat(
    presId: string,
    message: string,
    allowEdits?: boolean,
    resumeSessionId?: string | null,
  ): Promise<void>
  stopChat(presId: string): Promise<void>
  onChat(cb: (e: ChatEvent) => void): () => void
  saveAttachment(presId: string, name: string, dataBase64: string): Promise<string>
  exportPresentation(presId: string): Promise<string | null>
}

interface Attachment {
  name: string
  isImage: boolean
  url?: string // object URL for image preview
  path?: string // absolute path once saved on disk
}

const authoring = (window as unknown as { toolbox?: { authoring?: Authoring } }).toolbox?.authoring

// ---- conversations (persisted per presentation) ----
const conversations = ref<Conversation[]>([])
const activeId = ref<string>('')
const showChats = ref(false)
const chatselEl = ref<HTMLElement | null>(null)
function onDocClick(e: MouseEvent): void {
  if (showChats.value && chatselEl.value && !chatselEl.value.contains(e.target as Node))
    showChats.value = false
}
const active = computed(() => conversations.value.find((c) => c.id === activeId.value) ?? null)
const messages = computed<ChatMsg[]>(() => active.value?.messages ?? [])
// 'plan' = Claude analyses + proposes (no edits) until the user hits Implementar.
const phase = computed<'plan' | 'build'>(() => active.value?.phase ?? 'build')

const input = ref('')
const busy = ref(false)
// True only while Claude is actually writing files (not merely thinking/chatting),
// so the viewer overlay shows on real edits — plan/chat turns leave it usable.
const applying = ref(false)
// Tool names that mutate the deck's files.
const EDIT_TOOLS = /^(Write|Edit|MultiEdit|NotebookEdit)\b/
const attachments = ref<Attachment[]>([])
const fileInput = ref<HTMLInputElement | null>(null)
const dragging = ref(false)
// dragenter/leave fire per child element; count depth so the overlay only
// hides when the cursor actually leaves the chat panel.
let dragDepth = 0
const previewUrl = ref('')
const scroller = ref<HTMLElement | null>(null)
const frame = ref<HTMLIFrameElement | null>(null)
const deckIdx = ref(0)
const deckTotal = ref(0)

function persist(): void {
  void saveChats(props.presId, conversations.value)
}
function makeConversation(phaseV: 'plan' | 'build' = 'build'): Conversation {
  const now = new Date().toISOString()
  return {
    id: newConversationId(),
    title: 'Nuevo chat',
    createdAt: now,
    updatedAt: now,
    sessionId: null,
    phase: phaseV,
    messages: [],
  }
}
function pushMsg(m: ChatMsg): void {
  const c = active.value
  if (!c) return
  c.messages.push(m)
  c.updatedAt = new Date().toISOString()
  persist()
  scroll()
}
function titleFromText(t: string): string {
  const s = t.trim().replace(/\s+/g, ' ')
  return s.length > 42 ? s.slice(0, 42) + '…' : s || 'Nuevo chat'
}
async function newChat(): Promise<void> {
  if (busy.value) return
  const c = makeConversation('build')
  conversations.value.unshift(c)
  activeId.value = c.id
  await setActiveChatId(props.presId, c.id)
  persist()
  showChats.value = false
  scroll()
}
async function switchChat(id: string): Promise<void> {
  if (busy.value) return
  activeId.value = id
  await setActiveChatId(props.presId, id)
  showChats.value = false
  scroll()
}
async function deleteChat(id: string): Promise<void> {
  if (busy.value) return
  conversations.value = conversations.value.filter((c) => c.id !== id)
  if (!conversations.value.length) conversations.value.push(makeConversation('build'))
  if (activeId.value === id) {
    activeId.value = conversations.value[0].id
    await setActiveChatId(props.presId, activeId.value)
  }
  persist()
}

type AspectKey = '4:3' | '16:9'
const aspect = ref<AspectKey>(localStorage.getItem('deck-aspect') === '4:3' ? '4:3' : '16:9')

function pushAspect(): void {
  frame.value?.contentWindow?.postMessage({ type: 'deck-aspect', aspect: aspect.value }, '*')
}
function onAspectChange(): void {
  try {
    localStorage.setItem('deck-aspect', aspect.value)
  } catch {
    /* storage may be unavailable */
  }
  pushAspect()
}

const sharing = ref(false)
async function share(): Promise<void> {
  if (sharing.value || !authoring) return
  sharing.value = true
  try {
    const path = await authoring.exportPresentation(props.presId)
    if (path) pushMsg({ role: 'tool', text: 'Exportado: ' + path })
  } catch (e) {
    pushMsg({ role: 'error', text: 'No se pudo exportar: ' + String(e) })
  } finally {
    sharing.value = false
    scroll()
  }
}

let aspectSynced = false
function onDeckMsg(e: MessageEvent): void {
  if (e.data?.type === 'deck-state') {
    deckIdx.value = e.data.idx
    deckTotal.value = e.data.total
    // First state proves the deck's listener is up — assert our aspect once
    // (covers the case where the @load push raced the listener attach).
    if (!aspectSynced) {
      aspectSynced = true
      pushAspect()
    }
  }
}
function nav(dir: 'prev' | 'next'): void {
  frame.value?.contentWindow?.postMessage({ type: 'deck-nav', dir }, '*')
}

function scroll(): void {
  nextTick(() => {
    if (scroller.value) scroller.value.scrollTop = scroller.value.scrollHeight
  })
}

onMounted(async () => {
  window.addEventListener('message', onDeckMsg)
  document.addEventListener('mousedown', onDocClick)

  // Load persisted conversations (or start one).
  conversations.value = authoring ? await getChats(props.presId) : []
  if (!conversations.value.length) conversations.value = [makeConversation('build')]
  const savedActive = authoring ? await getActiveChatId(props.presId) : null
  activeId.value =
    savedActive && conversations.value.some((c) => c.id === savedActive)
      ? savedActive
      : conversations.value[0].id
  scroll()

  if (!authoring) {
    pushMsg({ role: 'error', text: 'El editor IA solo está disponible dentro del shell.' })
    return
  }
  await setActiveChatId(props.presId, activeId.value)

  authoring.onChat((e) => {
    if (e.presId !== props.presId) return
    const c = active.value
    if (!c) return
    if (e.kind === 'assistant') pushMsg({ role: 'assistant', text: e.text })
    else if (e.kind === 'tool') {
      if (EDIT_TOOLS.test(e.text)) applying.value = true // a real file edit started
      pushMsg({ role: 'tool', text: e.text })
    } else if (e.kind === 'error') {
      pushMsg({ role: 'error', text: e.text })
      busy.value = false
      applying.value = false
    } else if (e.kind === 'done') {
      if (e.sessionId) c.sessionId = e.sessionId
      busy.value = false
      applying.value = false
      persist()
    }
    scroll()
  })
  try {
    const base = await authoring.previewUrl()
    previewUrl.value = `${base}?pres=${props.presId}&nav=1`
  } catch {
    /* preview may be unavailable */
  }

  // Freshly created from onboarding/import: analyse the brief in a fresh chat.
  const pending = await takePendingPrompt(props.presId)
  if (pending) {
    if (active.value && active.value.messages.length) {
      const c = makeConversation('plan')
      conversations.value.unshift(c)
      activeId.value = c.id
      await setActiveChatId(props.presId, c.id)
    } else if (active.value) {
      active.value.phase = 'plan'
    }
    persist()
    await doSend(pending)
  }
})

onUnmounted(() => {
  window.removeEventListener('message', onDeckMsg)
  document.removeEventListener('mousedown', onDocClick)
})

async function doSend(text: string): Promise<void> {
  const c = active.value
  if (!text.trim() || busy.value || !authoring || !c) return
  pushMsg({ role: 'user', text })
  if (c.title === 'Nuevo chat') {
    c.title = titleFromText(text)
    persist()
  }
  busy.value = true
  applying.value = false
  scroll()
  try {
    await authoring.sendChat(props.presId, text, c.phase === 'build', c.sessionId)
  } catch (e) {
    pushMsg({ role: 'error', text: String(e) })
    busy.value = false
  }
}
function fileToBase64(file: File): Promise<string> {
  return new Promise((res, rej) => {
    const reader = new FileReader()
    reader.onload = () => {
      const r = reader.result as string
      res(r.slice(r.indexOf(',') + 1)) // strip "data:...;base64," prefix
    }
    reader.onerror = () => rej(reader.error)
    reader.readAsDataURL(file)
  })
}

async function addFiles(files: File[]): Promise<void> {
  if (!authoring) return
  for (const file of files) {
    const isImage = file.type.startsWith('image/')
    const att: Attachment = {
      name: file.name || (isImage ? 'imagen.png' : 'archivo'),
      isImage,
      url: isImage ? URL.createObjectURL(file) : undefined,
    }
    attachments.value.push(att)
    try {
      att.path = await authoring.saveAttachment(props.presId, att.name, await fileToBase64(file))
    } catch (e) {
      pushMsg({ role: 'error', text: 'No se pudo adjuntar ' + att.name + ': ' + String(e) })
      attachments.value = attachments.value.filter((a) => a !== att)
    }
  }
}

function pickFiles(): void {
  fileInput.value?.click()
}
function onFiles(e: Event): void {
  const el = e.target as HTMLInputElement
  if (el.files?.length) void addFiles(Array.from(el.files))
  el.value = '' // allow re-picking the same file
}
function onPaste(e: ClipboardEvent): void {
  const files = Array.from(e.clipboardData?.items ?? [])
    .filter((it) => it.kind === 'file')
    .map((it) => it.getAsFile())
    .filter((f): f is File => !!f)
  if (files.length) {
    e.preventDefault() // don't paste the binary blob into the textarea
    void addFiles(files)
  }
}
function removeAttachment(att: Attachment): void {
  if (att.url) URL.revokeObjectURL(att.url)
  attachments.value = attachments.value.filter((a) => a !== att)
}

function hasFiles(e: DragEvent): boolean {
  return Array.from(e.dataTransfer?.types ?? []).includes('Files')
}
function onDragEnter(e: DragEvent): void {
  if (!hasFiles(e)) return
  e.preventDefault()
  dragDepth++
  dragging.value = true
}
function onDragOver(e: DragEvent): void {
  if (!hasFiles(e)) return
  e.preventDefault() // mark as a valid drop target (and stop Electron navigating)
  if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy'
}
function onDragLeave(e: DragEvent): void {
  if (!hasFiles(e)) return
  dragDepth = Math.max(0, dragDepth - 1)
  if (dragDepth === 0) dragging.value = false
}
function onDrop(e: DragEvent): void {
  e.preventDefault()
  dragDepth = 0
  dragging.value = false
  const files = Array.from(e.dataTransfer?.files ?? [])
  if (files.length) void addFiles(files)
}

function send(): void {
  const text = input.value.trim()
  const atts = attachments.value.filter((a) => a.path)
  if (!text && !atts.length) return
  let msg = text
  if (atts.length) {
    const list = atts.map((a) => `- ${a.path}`).join('\n')
    const note = `Archivos adjuntos por el usuario (léelos con Read; para una imagen que vayas a mostrar, cópiala a assets/ e impórtala):\n${list}`
    msg = text ? `${text}\n\n${note}` : note
  }
  input.value = ''
  attachments.value.forEach((a) => a.url && URL.revokeObjectURL(a.url))
  attachments.value = []
  void doSend(msg)
}
function implementar(): void {
  if (busy.value || !active.value) return
  active.value.phase = 'build'
  persist()
  void doSend(
    'Implementa el plan que acordamos: construye las slides, componentes y el tema, reutilizando los bloques propuestos. Crea todos los archivos necesarios.',
  )
}
function stop(): void {
  void authoring?.stopChat(props.presId)
  busy.value = false
  applying.value = false
  pushMsg({ role: 'tool', text: 'Detenido.' })
}
function play(): void {
  location.search = `?preview=${props.presId}`
}
function goHome(): void {
  location.search = ''
}
</script>

<template>
  <div class="ce">
    <aside
      class="ce-chat"
      :class="{ dragging }"
      @dragenter="onDragEnter"
      @dragover="onDragOver"
      @dragleave="onDragLeave"
      @drop="onDrop"
    >
      <div v-if="dragging" class="ce-drop">
        <div class="ce-drop-box">
          <svg viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <path d="M7 10l5-5 5 5" />
            <path d="M12 5v12" />
          </svg>
          <span>Suelta para adjuntar</span>
        </div>
      </div>
      <header class="ce-head">
        <button class="ce-btn" @click="goHome">‹ Inicio</button>
        <div ref="chatselEl" class="ce-chatsel">
          <button class="ce-chatsel-btn" :disabled="busy" @click="showChats = !showChats">
            <span class="ce-chatsel-title">{{ active?.title || 'Chat' }}</span>
            <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6" /></svg>
          </button>
          <div v-if="showChats" class="ce-chatmenu">
            <button class="ce-chatnew" @click="newChat">
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v14M5 12h14" /></svg>
              Nuevo chat
            </button>
            <div class="ce-chatlist">
              <div
                v-for="c in conversations"
                :key="c.id"
                class="ce-chatitem"
                :class="{ active: c.id === activeId }"
              >
                <button class="ce-chatitem-main" @click="switchChat(c.id)">
                  <span class="ce-chatitem-title">{{ c.title }}</span>
                  <span class="ce-chatitem-meta">{{ c.messages.length }} mensajes</span>
                </button>
                <button class="ce-chatitem-del" title="Borrar conversación" @click.stop="deleteChat(c.id)">
                  <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6M10 11v6M14 11v6" /></svg>
                </button>
              </div>
            </div>
          </div>
        </div>
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
        <div v-for="(m, i) in messages" :key="activeId + '-' + i" class="ce-msg" :class="m.role">
          <span v-if="m.role === 'tool'" class="ce-tool">⚙ {{ m.text }}</span>
          <template v-else>{{ m.text }}</template>
        </div>
        <div v-if="busy" class="ce-msg tool"><span class="ce-tool">Claude trabajando…</span></div>
      </div>

      <div v-if="phase === 'plan'" class="ce-plan">
        <span>Claude propone el plan. Coméntalo si quieres y, cuando estés listo:</span>
        <button class="ce-impl" :disabled="busy" @click="implementar">Implementar →</button>
      </div>

      <div class="ce-input">
        <div v-if="attachments.length" class="ce-atts">
          <div v-for="(a, i) in attachments" :key="i" class="ce-att" :title="a.name">
            <img v-if="a.isImage && a.url" :src="a.url" class="ce-att-img" alt="" />
            <span v-else class="ce-att-ico">📄</span>
            <span class="ce-att-name">{{ a.name }}</span>
            <span v-if="!a.path" class="ce-att-load">…</span>
            <button class="ce-att-x" title="Quitar" @click="removeAttachment(a)">✕</button>
          </div>
        </div>
        <div class="ce-row">
          <input
            ref="fileInput"
            type="file"
            multiple
            accept="image/*,.pdf,.txt,.md,.csv,.json,.pptx,.ppt,.key,.odp"
            class="ce-file"
            @change="onFiles"
          />
          <button class="ce-icon" title="Adjuntar archivos o imágenes" @click="pickFiles">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
            </svg>
          </button>
          <textarea
            v-model="input"
            rows="1"
            :placeholder="phase === 'plan' ? 'Comenta o ajusta el plan…' : 'Escribe a Claude… (Enter envía)'"
            @keydown.enter.exact.prevent="send"
            @paste="onPaste"
          />
          <button v-if="busy" class="ce-icon stop" title="Parar" @click="stop">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
              <rect x="6" y="6" width="12" height="12" rx="1.5" />
            </svg>
          </button>
          <button
            v-else
            class="ce-icon send"
            title="Enviar"
            :disabled="!input.trim() && !attachments.some((a) => a.path)"
            @click="send"
          >
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M22 2L11 13" />
              <path d="M22 2l-7 20-4-9-9-4 20-7z" />
            </svg>
          </button>
        </div>
      </div>
    </aside>

    <main class="ce-preview">
      <div class="ce-navbar">
        <div class="ce-navgroup">
          <button class="ce-nav" title="Anterior" @click="nav('prev')">◀</button>
          <span class="ce-count">{{ deckTotal ? deckIdx + 1 : '–' }} / {{ deckTotal || '–' }}</span>
          <button class="ce-nav" title="Siguiente (incluye sub-pasos)" @click="nav('next')">▶</button>
        </div>
        <div class="ce-tools">
          <select
            v-model="aspect"
            class="ce-aspect-sel"
            title="Tamaño de diapositiva"
            @change="onAspectChange"
          >
            <option value="16:9">16:9 (panorámico)</option>
            <option value="4:3">4:3 (estándar)</option>
          </select>
          <button
            class="ce-share"
            title="Exportar como proyecto (.zip)"
            :disabled="sharing"
            @click="share"
          >
            <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="18" cy="5" r="3" />
              <circle cx="6" cy="12" r="3" />
              <circle cx="18" cy="19" r="3" />
              <path d="M8.6 13.5l6.8 4M15.4 6.5l-6.8 4" />
            </svg>
            <span>{{ sharing ? 'Exportando…' : 'Compartir' }}</span>
          </button>
        </div>
      </div>
      <div class="ce-frame-wrap">
        <iframe
          v-if="previewUrl"
          ref="frame"
          :src="previewUrl"
          class="ce-frame"
          title="Vista en vivo"
          @load="pushAspect"
        />
        <div v-else class="ce-loading">Iniciando preview en vivo…</div>

        <transition name="ce-apply">
          <div v-if="applying" class="ce-applying">
            <div class="ce-applying-scan"></div>
            <div class="ce-applying-card">
              <div class="ce-applying-orbit">
                <span></span><span></span><span></span>
              </div>
              <div class="ce-applying-title">Aplicando cambios</div>
              <div class="ce-applying-sub">Claude está editando la presentación…</div>
            </div>
          </div>
        </transition>
      </div>
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
  position: relative;
  display: flex;
  flex-direction: column;
  border-right: 1px solid var(--rule);
  min-height: 0;
}
.ce-drop {
  position: absolute;
  inset: 0;
  z-index: 20;
  display: grid;
  place-items: center;
  padding: 1rem;
  background: rgba(20, 28, 44, 0.82);
  backdrop-filter: blur(2px);
}
.ce-drop-box {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.6rem;
  width: 100%;
  height: 100%;
  border: 2px dashed var(--brand-400);
  border-radius: 10px;
  color: var(--brand-300);
  font-size: 0.9rem;
  font-weight: 500;
  justify-content: center;
  /* let drag events fall through to the panel so depth tracking stays correct */
  pointer-events: none;
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
.ce-btn {
  flex-shrink: 0;
  padding: 0.35rem 0.7rem;
  border: 1px solid var(--rule);
  border-radius: 3px;
  font-size: 0.78rem;
  color: var(--slate-300);
  white-space: nowrap;
}
.ce-btn:hover:not(:disabled) {
  border-color: rgba(148, 168, 202, 0.5);
}
.ce-btn:disabled {
  opacity: 0.45;
}
/* ---- conversation switcher ---- */
.ce-chatsel {
  position: relative;
  flex: 1;
  min-width: 0;
}
.ce-chatsel-btn {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.35rem;
  width: 100%;
  padding: 0.35rem 0.6rem;
  border: 1px solid var(--rule);
  border-radius: 5px;
  font-size: 0.8rem;
  color: var(--fg-primary);
  background: rgba(255, 255, 255, 0.02);
}
.ce-chatsel-btn svg {
  flex-shrink: 0;
}
.ce-chatsel-btn:hover:not(:disabled) {
  border-color: rgba(148, 168, 202, 0.5);
}
.ce-chatsel-btn:disabled {
  opacity: 0.6;
}
.ce-chatsel-title {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.ce-chatmenu {
  position: absolute;
  top: calc(100% + 0.35rem);
  left: 0;
  z-index: 30;
  width: 17rem;
  max-height: 60vh;
  display: flex;
  flex-direction: column;
  background: var(--slate-900);
  border: 1px solid var(--rule);
  border-radius: 8px;
  box-shadow: 0 18px 40px -16px rgba(0, 0, 0, 0.7);
  overflow: hidden;
}
.ce-chatnew {
  display: flex;
  align-items: center;
  gap: 0.45rem;
  padding: 0.6rem 0.75rem;
  font-size: 0.8rem;
  font-weight: 500;
  color: var(--brand-300);
  border-bottom: 1px solid var(--rule);
}
.ce-chatnew:hover {
  background: rgba(255, 255, 255, 0.04);
}
.ce-chatlist {
  overflow-y: auto;
}
.ce-chatitem {
  display: flex;
  align-items: stretch;
}
.ce-chatitem:hover {
  background: rgba(255, 255, 255, 0.03);
}
.ce-chatitem.active {
  background: rgba(85, 111, 158, 0.16);
}
.ce-chatitem-main {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 0.1rem;
  padding: 0.5rem 0.75rem;
  text-align: left;
}
.ce-chatitem-title {
  font-size: 0.8rem;
  color: var(--fg-secondary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.ce-chatitem-meta {
  font-size: 0.68rem;
  color: var(--fg-muted);
}
.ce-chatitem-del {
  width: 2.2rem;
  display: grid;
  place-items: center;
  color: var(--fg-faint);
}
.ce-chatitem-del:hover {
  color: #f3a3a3;
  background: rgba(243, 163, 163, 0.08);
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
.ce-row {
  display: flex;
  align-items: flex-end;
  gap: 0.4rem;
  background: rgba(255, 255, 255, 0.02);
  border: 1px solid var(--rule);
  border-radius: 8px;
  padding: 0.3rem 0.35rem;
}
.ce-row:focus-within {
  border-color: var(--brand-500);
}
.ce-file {
  display: none;
}
.ce-row textarea {
  flex: 1;
  resize: none;
  max-height: 8rem;
  background: none;
  border: 0;
  padding: 0.35rem 0.2rem;
  color: var(--fg-primary);
  font-size: 0.85rem;
  font-family: inherit;
  line-height: 1.4;
  outline: none;
}
.ce-icon {
  flex-shrink: 0;
  width: 2rem;
  height: 2rem;
  display: grid;
  place-items: center;
  border-radius: 6px;
  color: var(--slate-300);
  border: 1px solid transparent;
}
.ce-icon:hover:not(:disabled) {
  color: var(--fg-primary);
  background: rgba(255, 255, 255, 0.05);
}
.ce-icon.send {
  background: var(--brand-700);
  border-color: var(--brand-600);
  color: #fff;
}
.ce-icon.send:hover:not(:disabled) {
  background: var(--brand-600);
}
.ce-icon.send:disabled {
  opacity: 0.4;
}
.ce-icon.stop {
  background: #7a2f2f;
  border-color: #9a4040;
  color: #fff;
}
.ce-icon.stop:hover {
  background: #8a3636;
}
.ce-atts {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
}
.ce-att {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  max-width: 12rem;
  padding: 0.25rem 0.4rem;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid var(--rule);
  border-radius: 6px;
  font-size: 0.72rem;
  color: var(--fg-secondary);
}
.ce-att-img {
  width: 1.4rem;
  height: 1.4rem;
  object-fit: cover;
  border-radius: 3px;
}
.ce-att-ico {
  font-size: 0.9rem;
}
.ce-att-name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.ce-att-load {
  color: var(--brand-300);
}
.ce-att-x {
  color: var(--fg-faint);
  font-size: 0.7rem;
  padding: 0 0.1rem;
}
.ce-att-x:hover {
  color: #f3a3a3;
}
.ce-plan {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  padding: 0.6rem 0.7rem;
  border-top: 1px solid var(--rule);
  background: rgba(85, 111, 158, 0.12);
  font-size: 0.72rem;
  color: var(--slate-300);
}
.ce-plan span {
  flex: 1;
  line-height: 1.4;
}
.ce-impl {
  padding: 0.45rem 0.9rem;
  background: var(--brand-600);
  border: 1px solid var(--brand-500);
  border-radius: 4px;
  color: #fff;
  font-size: 0.78rem;
  font-weight: 500;
  white-space: nowrap;
}
.ce-impl:hover:not(:disabled) {
  background: var(--brand-500);
}
.ce-impl:disabled {
  opacity: 0.5;
}
.ce-preview {
  background: var(--slate-950);
  min-width: 0;
  display: flex;
  flex-direction: column;
}
.ce-navbar {
  position: relative;
  flex-shrink: 0;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 1rem;
  padding: 0 0.6rem;
  border-bottom: 1px solid var(--rule);
}
.ce-navgroup {
  display: flex;
  align-items: center;
  gap: 1rem;
}
.ce-tools {
  position: absolute;
  right: 0.6rem;
  top: 50%;
  transform: translateY(-50%);
  display: flex;
  align-items: center;
  gap: 0.4rem;
}
.ce-aspect-sel {
  appearance: none;
  padding: 0.25rem 1.4rem 0.25rem 0.55rem;
  border: 1px solid var(--rule);
  border-radius: 3px;
  font-size: 0.72rem;
  font-weight: 500;
  color: var(--slate-300);
  background:
    url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='10' height='10' viewBox='0 0 24 24' fill='none' stroke='%2394a3b8' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round'><path d='M6 9l6 6 6-6'/></svg>")
    no-repeat right 0.45rem center;
  background-color: rgba(255, 255, 255, 0.02);
  outline: none;
}
.ce-aspect-sel:hover {
  border-color: var(--brand-500);
  color: var(--fg-primary);
}
.ce-aspect-sel option {
  background: var(--slate-900);
  color: var(--fg-secondary);
}
.ce-share {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  padding: 0.28rem 0.65rem;
  border: 1px solid var(--brand-600);
  border-radius: 3px;
  background: var(--brand-700);
  color: #fff;
  font-size: 0.72rem;
  font-weight: 500;
}
.ce-share:hover:not(:disabled) {
  background: var(--brand-600);
}
.ce-share:disabled {
  opacity: 0.5;
}
.ce-nav {
  width: 28px;
  height: 24px;
  display: grid;
  place-items: center;
  border: 1px solid var(--rule);
  border-radius: 3px;
  color: var(--slate-300);
  font-size: 0.7rem;
}
.ce-nav:hover {
  border-color: var(--brand-500);
  color: var(--fg-primary);
}
.ce-count {
  font-size: 0.78rem;
  color: var(--fg-muted);
  font-variant-numeric: tabular-nums;
  min-width: 4rem;
  text-align: center;
}
.ce-frame-wrap {
  flex: 1;
  min-height: 0;
  position: relative;
}
.ce-frame {
  width: 100%;
  height: 100%;
  border: 0;
  display: block;
}
.ce-loading {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  color: var(--fg-muted);
  font-size: 0.9rem;
}

/* ---- "applying changes" overlay: blocks the viewer while Claude edits ---- */
.ce-applying {
  position: absolute;
  inset: 0;
  z-index: 10;
  display: grid;
  place-items: center;
  cursor: progress;
  overflow: hidden;
  background:
    radial-gradient(60% 60% at 50% 45%, rgba(20, 28, 46, 0.62), rgba(6, 9, 16, 0.82));
  backdrop-filter: blur(7px) saturate(120%);
}
/* a light beam sweeping top→bottom */
.ce-applying-scan {
  position: absolute;
  left: 0;
  right: 0;
  height: 40%;
  top: -40%;
  background: linear-gradient(
    180deg,
    transparent,
    rgba(148, 168, 202, 0.12) 40%,
    rgba(148, 168, 202, 0.22) 50%,
    rgba(148, 168, 202, 0.12) 60%,
    transparent
  );
  animation: ce-scan 2.1s ease-in-out infinite;
}
@keyframes ce-scan {
  0% { top: -40%; }
  100% { top: 100%; }
}
.ce-applying-card {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.55rem;
  padding: 1.5rem 2rem;
}
.ce-applying-orbit {
  position: relative;
  width: 3rem;
  height: 3rem;
  margin-bottom: 0.4rem;
}
.ce-applying-orbit span {
  position: absolute;
  inset: 0;
  border-radius: 50%;
  border: 2px solid transparent;
  border-top-color: var(--brand-300);
  animation: ce-spin 1.1s linear infinite;
}
.ce-applying-orbit span:nth-child(2) {
  inset: 0.4rem;
  border-top-color: var(--brand-400);
  animation-duration: 1.5s;
  animation-direction: reverse;
}
.ce-applying-orbit span:nth-child(3) {
  inset: 0.8rem;
  border-top-color: rgba(217, 168, 79, 0.9);
  animation-duration: 0.9s;
}
@keyframes ce-spin {
  to { transform: rotate(360deg); }
}
.ce-applying-title {
  font-size: 1rem;
  font-weight: 600;
  letter-spacing: 0.01em;
  background: linear-gradient(90deg, var(--fg-primary), var(--brand-300), var(--fg-primary));
  background-size: 200% 100%;
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
  animation: ce-shimmer 2.4s linear infinite;
}
@keyframes ce-shimmer {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}
.ce-applying-sub {
  font-size: 0.78rem;
  color: var(--fg-muted);
}
.ce-apply-enter-active,
.ce-apply-leave-active {
  transition: opacity 0.25s ease;
}
.ce-apply-enter-from,
.ce-apply-leave-to {
  opacity: 0;
}
</style>
