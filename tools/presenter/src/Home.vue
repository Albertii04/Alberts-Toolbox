<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { getRecents, saveDoc, deleteDoc, type RecentEntry } from './documents/store'
import { createStarterDoc } from './documents/format'

const recents = ref<RecentEntry[]>([])
const loading = ref(true)

onMounted(async () => {
  recents.value = await getRecents()
  loading.value = false
})

function fmtDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' })
  } catch {
    return ''
  }
}

async function nueva(): Promise<void> {
  const doc = createStarterDoc('Nueva presentación')
  await saveDoc(doc)
  location.search = `?edit=${doc.id}`
}
function openDoc(id: string): void {
  location.search = `?doc=${id}`
}
function editDoc(id: string): void {
  location.search = `?edit=${id}`
}
function openExample(): void {
  location.search = '?pres=concep-deck'
}
function openLive(id: string): void {
  location.search = `?preview=${id}`
}
async function remove(id: string): Promise<void> {
  await deleteDoc(id)
  recents.value = await getRecents()
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
        <button class="action primary" @click="nueva">
          <span class="plus">+</span> Nueva presentación
        </button>
        <button class="action" disabled title="Próximamente">Importar .zip</button>
        <button class="action" disabled title="Próximamente">Exportar</button>
      </div>

      <section class="block">
        <div class="block-label">Recientes</div>
        <div v-if="!loading && recents.length" class="grid">
          <div v-for="r in recents" :key="r.id" class="card" @click="openDoc(r.id)">
            <div class="card-ctl">
              <button title="Editar" @click.stop="editDoc(r.id)">✎</button>
              <button title="Eliminar" @click.stop="remove(r.id)">✕</button>
            </div>
            <div class="thumb"><span>{{ r.name.slice(0, 1).toUpperCase() }}</span></div>
            <div class="card-name">{{ r.name }}</div>
            <div class="card-meta">{{ fmtDate(r.updatedAt) }}</div>
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
              <button title="Vista en vivo (HMR)" @click.stop="openLive('concep-deck')">⚡</button>
            </div>
            <div class="thumb example"><span>C</span></div>
            <div class="card-name">De CAD a render con IA</div>
            <div class="card-meta">Concep · Primlux</div>
          </div>
        </div>
      </section>
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
  border-radius: 3px;
  padding: 0.9rem;
  cursor: pointer;
  transition: border-color 0.15s, transform 0.15s, background 0.15s;
  background: rgba(255, 255, 255, 0.012);
}
.card:hover {
  border-color: rgba(148, 168, 202, 0.4);
  transform: translateY(-2px);
}
.card-ctl {
  position: absolute;
  top: 0.5rem;
  right: 0.5rem;
  display: flex;
  gap: 0.15rem;
  opacity: 0;
  transition: opacity 0.15s;
}
.card:hover .card-ctl {
  opacity: 1;
}
.card-ctl button {
  width: 1.3rem;
  height: 1.3rem;
  display: grid;
  place-items: center;
  border-radius: 2px;
  font-size: 0.7rem;
  color: var(--fg-muted);
}
.card-ctl button:hover {
  background: rgba(255, 255, 255, 0.08);
  color: var(--fg-primary);
}
.thumb {
  aspect-ratio: 16 / 10;
  border-radius: 2px;
  display: grid;
  place-items: center;
  margin-bottom: 0.7rem;
  background: linear-gradient(135deg, rgba(67, 87, 128, 0.4), rgba(40, 54, 80, 0.6));
  color: var(--brand-200);
  font-size: 1.4rem;
  font-weight: 300;
}
.thumb.example {
  background: linear-gradient(135deg, rgba(85, 111, 158, 0.5), rgba(48, 62, 95, 0.7));
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
</style>
