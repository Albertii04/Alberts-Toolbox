<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { addPres, getPresList, removePres, setPendingPrompt, type PresEntry } from './documents/store'

const recents = ref<PresEntry[]>([])
const loading = ref(true)
const busy = ref(false)
const pendingDelete = ref<PresEntry | null>(null)
const confirmText = ref('')

const authoring = (
  window as unknown as {
    toolbox?: {
      authoring?: {
        previewUrl(): Promise<string>
        thumbnail(presId: string, force?: boolean): Promise<string | null>
        createPresentation(name: string): Promise<{ id: string }>
        deletePresentation(id: string): Promise<void>
        importPresentation(): Promise<{
          id: string
          name: string
          mode: 'ready' | 'ai'
          prompt?: string
        } | null>
      }
    }
  }
).toolbox?.authoring

// Cover image (first slide rendered to JPG) per presentation id → data URL.
const thumbs = ref<Record<string, string>>({})

async function loadThumb(id: string): Promise<void> {
  if (!authoring) return
  try {
    const dataUrl = await authoring.thumbnail(id)
    if (dataUrl) thumbs.value = { ...thumbs.value, [id]: dataUrl }
  } catch {
    /* leave the fallback initial */
  }
}

onMounted(async () => {
  recents.value = await getPresList()
  loading.value = false
  // Render covers lazily (one at a time, serialized in the backend).
  for (const r of recents.value) void loadThumb(r.id)
  void loadThumb('concep-deck')
})

function fmtDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' })
  } catch {
    return ''
  }
}

function nueva(): void {
  location.search = '?new'
}
async function importar(): Promise<void> {
  if (!authoring || busy.value) return
  busy.value = true
  try {
    const r = await authoring.importPresentation()
    if (r) {
      await addPres(r.id, r.name)
      // 'ai' import: seed the analysis prompt so the editor inspects the
      // material on open and proposes a conversion (plan mode).
      if (r.mode === 'ai' && r.prompt) await setPendingPrompt(r.id, r.prompt)
      location.search = `?edit=${r.id}`
      return
    }
  } catch (e) {
    alert('No se pudo importar: ' + (e as Error).message)
  }
  busy.value = false
}
function openPres(id: string): void {
  location.search = `?preview=${id}`
}
function openEdit(id: string): void {
  location.search = `?edit=${id}`
}
function openExample(): void {
  location.search = '?pres=concep-deck'
}
function askDelete(entry: PresEntry): void {
  pendingDelete.value = entry
  confirmText.value = ''
}
function cancelDelete(): void {
  pendingDelete.value = null
  confirmText.value = ''
}
async function confirmDelete(): Promise<void> {
  const entry = pendingDelete.value
  if (!entry || confirmText.value.trim() !== entry.name) return
  if (authoring && entry.id.startsWith('u-')) {
    try {
      await authoring.deletePresentation(entry.id)
    } catch {
      /* folder may already be gone */
    }
  }
  await removePres(entry.id)
  recents.value = await getPresList()
  cancelDelete()
}
</script>

<template>
  <div class="home">
    <div class="inner">
      <header class="head">
        <p class="eyebrow">Presenter</p>
        <h1>Tus presentaciones</h1>
      </header>

      <div class="actions">
        <button class="action primary" :disabled="busy" @click="nueva">
          <span class="plus">+</span> {{ busy ? 'Creando…' : 'Nueva presentación' }}
        </button>
        <button class="action" :disabled="busy" title="Importar una presentación .zip" @click="importar">
          Importar .zip
        </button>
      </div>

      <section class="block">
        <div class="block-label">Recientes</div>
        <div v-if="!loading && recents.length" class="grid">
          <div v-for="r in recents" :key="r.id" class="card" @click="openEdit(r.id)">
            <div class="card-ctl">
              <button title="Vista en vivo" @click.stop="openPres(r.id)">
                <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <rect x="2" y="3" width="20" height="14" rx="2" />
                  <path d="M8 21h8M12 17v4" />
                </svg>
              </button>
              <button title="Eliminar" @click.stop="askDelete(r)">
                <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M3 6h18" />
                  <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                  <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                  <path d="M10 11v6M14 11v6" />
                </svg>
              </button>
            </div>
            <div class="thumb">
              <img v-if="thumbs[r.id]" :src="thumbs[r.id]" class="thumb-img" alt="" />
              <span v-else class="thumb-ph">{{ r.name.slice(0, 1).toUpperCase() }}</span>
            </div>
            <div class="card-body">
              <div class="card-name">{{ r.name }}</div>
              <div class="card-meta">{{ fmtDate(r.updatedAt) }}</div>
            </div>
          </div>
        </div>
        <div v-else-if="!loading" class="empty">
          Aún no hay presentaciones. Crea una con <strong>Nueva presentación</strong>.
        </div>
      </section>

      <section class="block">
        <div class="block-label">Ejemplos</div>
        <div class="grid">
          <div class="card" @click="openExample">
            <div class="card-ctl">
              <button title="Vista en vivo (HMR)" @click.stop="openPres('concep-deck')">
                <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <rect x="2" y="3" width="20" height="14" rx="2" />
                  <path d="M8 21h8M12 17v4" />
                </svg>
              </button>
            </div>
            <div class="thumb example">
              <img v-if="thumbs['concep-deck']" :src="thumbs['concep-deck']" class="thumb-img" alt="" />
              <span v-else class="thumb-ph">C</span>
            </div>
            <div class="card-body">
              <div class="card-name">De CAD a render con IA</div>
              <div class="card-meta">Concep · Primlux</div>
            </div>
          </div>
        </div>
      </section>
    </div>

    <div v-if="pendingDelete" class="modal-bg" @click.self="cancelDelete">
      <div class="modal">
        <h2>Eliminar presentación</h2>
        <p>
          Esto borra la carpeta de <strong>{{ pendingDelete.name }}</strong> de forma permanente.
          No se puede deshacer.
        </p>
        <p class="modal-hint">Escribe <strong>{{ pendingDelete.name }}</strong> para confirmar:</p>
        <input
          v-model="confirmText"
          :placeholder="pendingDelete.name"
          autofocus
          @keydown.enter="confirmDelete"
        />
        <div class="modal-actions">
          <button class="btn" @click="cancelDelete">Cancelar</button>
          <button
            class="btn danger"
            :disabled="confirmText.trim() !== pendingDelete.name"
            @click="confirmDelete"
          >
            Eliminar
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.home {
  position: fixed;
  inset: 0;
  overflow-y: auto;
}
.inner {
  max-width: 60rem;
  margin: 0 auto;
  padding: clamp(2.5rem, 7vh, 5rem) clamp(2rem, 6vw, 5rem);
}
.head {
  margin-bottom: 2rem;
}
.eyebrow {
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: var(--track-eyebrow);
  color: var(--brand-300);
  margin-bottom: 0.5rem;
}
.head h1 {
  font-size: clamp(1.8rem, 3.2vw, 2.6rem);
  font-weight: 500;
  letter-spacing: var(--track-tight);
  color: var(--fg-primary);
}
.actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.6rem;
  margin-bottom: 2.5rem;
}
.action {
  padding: 0.6rem 1.1rem;
  border: 1px solid var(--rule);
  border-radius: 3px;
  font-size: 0.85rem;
  color: var(--slate-300);
  transition: border-color 0.15s, background 0.15s;
}
.action:hover:not(:disabled) {
  border-color: rgba(148, 168, 202, 0.5);
  background: rgba(148, 168, 202, 0.08);
}
.action:disabled {
  opacity: 0.45;
  cursor: default;
}
.action.primary {
  background: var(--brand-700);
  border-color: var(--brand-600);
  color: #fff;
}
.action.primary:hover {
  background: var(--brand-600);
}
.action .plus {
  color: var(--brand-300);
  font-weight: 600;
}
.block {
  margin-bottom: 2.25rem;
}
.block-label {
  font-size: 0.65rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.16em;
  color: var(--fg-faint);
  margin-bottom: 0.9rem;
}
.grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(11rem, 1fr));
  gap: 0.9rem;
}
.card {
  position: relative;
  border: 1px solid var(--rule);
  border-radius: 8px;
  overflow: hidden;
  cursor: pointer;
  transition: border-color 0.15s, transform 0.15s, box-shadow 0.15s, background 0.15s;
  background: rgba(255, 255, 255, 0.012);
}
.card:hover {
  border-color: rgba(148, 168, 202, 0.45);
  transform: translateY(-2px);
  box-shadow: 0 12px 28px -14px rgba(0, 0, 0, 0.6);
}
.card-ctl {
  position: absolute;
  top: 0.45rem;
  right: 0.45rem;
  z-index: 2;
  display: flex;
  gap: 0.2rem;
  opacity: 0;
  transition: opacity 0.15s;
}
.card:hover .card-ctl {
  opacity: 1;
}
.card-ctl button {
  width: 1.5rem;
  height: 1.5rem;
  display: grid;
  place-items: center;
  border-radius: 5px;
  font-size: 0.72rem;
  color: #fff;
  background: rgba(10, 14, 22, 0.6);
  backdrop-filter: blur(4px);
}
.card-ctl button:hover {
  background: rgba(10, 14, 22, 0.85);
}
.thumb {
  position: relative;
  aspect-ratio: 16 / 9;
  overflow: hidden;
  display: grid;
  place-items: center;
  background: linear-gradient(135deg, rgba(67, 87, 128, 0.4), rgba(40, 54, 80, 0.6));
}
.thumb-img {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  object-position: center;
  display: block;
}
.thumb-ph {
  color: var(--brand-200);
  font-size: 2rem;
  font-weight: 300;
}
.thumb.example {
  background: linear-gradient(135deg, rgba(85, 111, 158, 0.5), rgba(48, 62, 95, 0.7));
}
.card-body {
  padding: 0.6rem 0.75rem 0.7rem;
  border-top: 1px solid var(--rule);
}
.card-name {
  font-size: 0.85rem;
  font-weight: 500;
  color: var(--fg-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.card-meta {
  font-size: 0.7rem;
  color: var(--fg-muted);
  margin-top: 0.15rem;
}
.empty {
  font-size: 0.875rem;
  color: var(--fg-muted);
  padding: 1.5rem;
  border: 1px dashed var(--rule);
  border-radius: 3px;
}
.empty strong {
  color: var(--slate-300);
  font-weight: 500;
}
.modal-bg {
  position: fixed;
  inset: 0;
  background: rgba(4, 6, 11, 0.7);
  backdrop-filter: blur(4px);
  display: grid;
  place-items: center;
  z-index: 50;
}
.modal {
  width: 100%;
  max-width: 26rem;
  border: 1px solid var(--rule);
  border-radius: 6px;
  background: var(--slate-950);
  padding: 1.5rem;
}
.modal h2 {
  font-size: 1.1rem;
  font-weight: 500;
  color: var(--fg-primary);
  margin-bottom: 0.6rem;
}
.modal p {
  font-size: 0.85rem;
  color: var(--slate-300);
  line-height: 1.5;
  margin-bottom: 0.6rem;
}
.modal-hint {
  color: var(--fg-muted);
}
.modal input {
  width: 100%;
  background: rgba(255, 255, 255, 0.02);
  border: 1px solid var(--rule);
  border-radius: 4px;
  padding: 0.55rem 0.65rem;
  color: var(--fg-primary);
  font-size: 0.9rem;
  outline: none;
}
.modal input:focus {
  border-color: var(--brand-500);
}
.modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.6rem;
  margin-top: 1.2rem;
}
.modal .btn {
  padding: 0.5rem 1rem;
  border: 1px solid var(--rule);
  border-radius: 4px;
  font-size: 0.85rem;
  color: var(--slate-300);
}
.modal .btn:hover {
  border-color: rgba(148, 168, 202, 0.5);
}
.modal .btn.danger {
  background: #7a2f2f;
  border-color: #9a4040;
  color: #fff;
}
.modal .btn.danger:hover:not(:disabled) {
  background: #8a3636;
}
.modal .btn.danger:disabled {
  opacity: 0.4;
}
</style>
