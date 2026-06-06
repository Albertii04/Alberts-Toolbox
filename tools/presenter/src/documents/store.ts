import type { PresentationDoc } from './format'

export interface RecentEntry {
  id: string
  name: string
  updatedAt: string
}

const RECENTS_KEY = 'recents'
const DOC_PREFIX = 'doc:'

interface KV {
  get<T>(key: string): Promise<T | null>
  set(key: string, value: unknown): Promise<void>
}

// Inside the shell, use the toolbox storage capability (scoped to this tool).
// In standalone browser dev there is no window.toolbox, so fall back to localStorage.
function kv(): KV {
  const tb = (window as unknown as { toolbox?: { storage?: KV } }).toolbox
  if (tb?.storage) return tb.storage
  return {
    async get<T>(key: string): Promise<T | null> {
      const raw = localStorage.getItem('presenter:' + key)
      return raw ? (JSON.parse(raw) as T) : null
    },
    async set(key: string, value: unknown): Promise<void> {
      localStorage.setItem('presenter:' + key, JSON.stringify(value))
    },
  }
}

export async function getRecents(): Promise<RecentEntry[]> {
  return (await kv().get<RecentEntry[]>(RECENTS_KEY)) ?? []
}

// ---- code presentations (folders, the new model) ----
export interface PresEntry {
  id: string
  name: string
  updatedAt: string
}
const PRES_KEY = 'presentations'

export async function getPresList(): Promise<PresEntry[]> {
  return (await kv().get<PresEntry[]>(PRES_KEY)) ?? []
}
export async function addPres(id: string, name: string): Promise<void> {
  const list = await getPresList()
  await kv().set(PRES_KEY, [
    { id, name, updatedAt: new Date().toISOString() },
    ...list.filter((p) => p.id !== id),
  ])
}
export async function removePres(id: string): Promise<void> {
  const list = await getPresList()
  await kv().set(
    PRES_KEY,
    list.filter((p) => p.id !== id),
  )
}

// Initial onboarding prompt for a freshly-created presentation; the editor
// auto-sends it to Claude on first open, then it's cleared.
export async function setPendingPrompt(id: string, text: string): Promise<void> {
  await kv().set(`pending:${id}`, text)
}
export async function takePendingPrompt(id: string): Promise<string | null> {
  const text = await kv().get<string>(`pending:${id}`)
  if (text) await kv().set(`pending:${id}`, null)
  return text
}

// ---- AI chat conversations (per presentation) ----

export interface ChatMsg {
  role: 'user' | 'assistant' | 'tool' | 'error'
  text: string
}
export interface Conversation {
  id: string
  title: string
  createdAt: string
  updatedAt: string
  /** Claude Code session id, for --resume so the conversation keeps context. */
  sessionId: string | null
  phase: 'plan' | 'build'
  messages: ChatMsg[]
}

const CHATS_PREFIX = 'chats:'
const ACTIVE_PREFIX = 'activeChat:'

export function newConversationId(): string {
  return 'c-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6)
}

export async function getChats(presId: string): Promise<Conversation[]> {
  return (await kv().get<Conversation[]>(CHATS_PREFIX + presId)) ?? []
}
export async function saveChats(presId: string, list: Conversation[]): Promise<void> {
  // Strip Vue reactive proxies → a plain, structured-clonable value. Passing a
  // proxy over Electron IPC throws "could not be cloned" and the save is lost.
  await kv().set(CHATS_PREFIX + presId, JSON.parse(JSON.stringify(list)))
}
export async function getActiveChatId(presId: string): Promise<string | null> {
  return await kv().get<string>(ACTIVE_PREFIX + presId)
}
export async function setActiveChatId(presId: string, id: string): Promise<void> {
  await kv().set(ACTIVE_PREFIX + presId, id)
}

export async function loadDoc(id: string): Promise<PresentationDoc | null> {
  return await kv().get<PresentationDoc>(DOC_PREFIX + id)
}

export async function saveDoc(doc: PresentationDoc): Promise<void> {
  const store = kv()
  await store.set(DOC_PREFIX + doc.id, doc)
  const recents = (await store.get<RecentEntry[]>(RECENTS_KEY)) ?? []
  const next: RecentEntry[] = [
    { id: doc.id, name: doc.name, updatedAt: doc.updatedAt },
    ...recents.filter((r) => r.id !== doc.id),
  ].slice(0, 24)
  await store.set(RECENTS_KEY, next)
}

export async function deleteDoc(id: string): Promise<void> {
  const store = kv()
  await store.set(DOC_PREFIX + id, null)
  const recents = (await store.get<RecentEntry[]>(RECENTS_KEY)) ?? []
  await store.set(
    RECENTS_KEY,
    recents.filter((r) => r.id !== id),
  )
}
