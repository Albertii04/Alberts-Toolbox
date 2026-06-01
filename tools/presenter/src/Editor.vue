<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import DataSlide from './documents/DataSlide.vue'
import { BLOCK_TYPES, emptyBlock, type DocBlock, type PresentationDoc } from './documents/format'
import { saveDoc } from './documents/store'

const props = defineProps<{ doc: PresentationDoc }>()

const doc = ref<PresentationDoc>(structuredClone(props.doc))
const selected = ref(0)
const saved = ref(true)

const slides = computed(() => doc.value.slides)
const block = computed<DocBlock | undefined>(() => doc.value.slides[selected.value]?.block)

function typeLabel(t: DocBlock['type']): string {
  return BLOCK_TYPES.find((b) => b.type === t)?.label ?? t
}

// Debounced autosave to storage.
let timer: number | undefined
watch(
  doc,
  () => {
    saved.value = false
    window.clearTimeout(timer)
    timer = window.setTimeout(async () => {
      doc.value.updatedAt = new Date().toISOString()
      await saveDoc(doc.value)
      saved.value = true
    }, 500)
  },
  { deep: true },
)

function addSlide(type: DocBlock['type']): void {
  doc.value.slides.splice(selected.value + 1, 0, { block: emptyBlock(type) })
  selected.value = Math.min(selected.value + 1, doc.value.slides.length - 1)
}
function deleteSlide(i: number): void {
  if (doc.value.slides.length <= 1) return
  doc.value.slides.splice(i, 1)
  selected.value = Math.max(0, Math.min(selected.value, doc.value.slides.length - 1))
}
function move(i: number, dir: -1 | 1): void {
  const j = i + dir
  if (j < 0 || j >= doc.value.slides.length) return
  const arr = doc.value.slides
  ;[arr[i], arr[j]] = [arr[j], arr[i]]
  selected.value = j
}
function changeType(type: DocBlock['type']): void {
  const s = doc.value.slides[selected.value]
  if (s) s.block = emptyBlock(type)
}
function onImage(e: Event): void {
  const file = (e.target as HTMLInputElement).files?.[0]
  const b = block.value
  if (!file || !b || b.type !== 'image') return
  const reader = new FileReader()
  reader.onload = () => {
    if (b.type === 'image') b.src = String(reader.result)
  }
  reader.readAsDataURL(file)
}

function play(): void {
  location.search = `?doc=${doc.value.id}`
}
function present(): void {
  window.open(`?doc=${doc.value.id}&p`, '_blank')
}
function goHome(): void {
  location.search = ''
}
</script>

<template>
  <div class="ed">
    <header class="ed-head">
      <button class="ed-btn" @click="goHome">‹ Inicio</button>
      <input v-model="doc.name" class="ed-name" spellcheck="false" />
      <span class="ed-saved">{{ saved ? 'Guardado' : 'Guardando…' }}</span>
      <div class="ed-actions">
        <button class="ed-btn" @click="present">Presentar ↗</button>
        <button class="ed-btn primary" @click="play">Reproducir</button>
      </div>
    </header>

    <div class="ed-body">
      <!-- slide list -->
      <aside class="ed-list">
        <div
          v-for="(s, i) in slides"
          :key="i"
          class="ed-thumb"
          :class="{ active: i === selected }"
          @click="selected = i"
        >
          <span class="ed-thumb-n">{{ i + 1 }}</span>
          <span class="ed-thumb-t">{{ typeLabel(s.block.type) }}</span>
          <div class="ed-thumb-ctl">
            <button title="Subir" @click.stop="move(i, -1)">↑</button>
            <button title="Bajar" @click.stop="move(i, 1)">↓</button>
            <button title="Eliminar" @click.stop="deleteSlide(i)">✕</button>
          </div>
        </div>
        <div class="ed-add">
          <span>Añadir</span>
          <button v-for="bt in BLOCK_TYPES" :key="bt.type" @click="addSlide(bt.type)">
            {{ bt.label }}
          </button>
        </div>
      </aside>

      <!-- preview -->
      <main class="ed-preview">
        <div class="ed-stage">
          <div class="ed-stage-inner">
            <DataSlide v-if="block" :key="selected" :block="block" />
          </div>
        </div>
      </main>

      <!-- inspector -->
      <aside class="ed-inspector" v-if="block">
        <div class="ed-field">
          <label>Tipo de slide</label>
          <select :value="block.type" @change="changeType(($event.target as HTMLSelectElement).value as DocBlock['type'])">
            <option v-for="bt in BLOCK_TYPES" :key="bt.type" :value="bt.type">{{ bt.label }}</option>
          </select>
        </div>

        <template v-if="block.type === 'cover'">
          <div class="ed-field"><label>Eyebrow</label><input v-model="block.eyebrow" /></div>
          <div class="ed-field"><label>Título</label><input v-model="block.title" /></div>
          <div class="ed-field"><label>Subtítulo</label><textarea v-model="block.subtitle" rows="2" /></div>
        </template>

        <template v-else-if="block.type === 'statement'">
          <div class="ed-field"><label>Eyebrow</label><input v-model="block.eyebrow" /></div>
          <div class="ed-field"><label>Frase</label><textarea v-model="block.text" rows="3" /></div>
        </template>

        <template v-else-if="block.type === 'bullets'">
          <div class="ed-field"><label>Título</label><input v-model="block.title" /></div>
          <div class="ed-field">
            <label>Puntos</label>
            <div v-for="(_, i) in block.items" :key="i" class="ed-item">
              <input v-model="block.items[i]" />
              <button @click="block.items.splice(i, 1)">✕</button>
            </div>
            <button class="ed-add-item" @click="block.items.push('Nuevo punto')">+ Punto</button>
          </div>
        </template>

        <template v-else-if="block.type === 'image'">
          <div class="ed-field">
            <label>Imagen</label>
            <input type="file" accept="image/*" @change="onImage" />
            <div v-if="block.src" class="ed-img-prev"><img :src="block.src" alt="" /></div>
          </div>
          <div class="ed-field"><label>Pie</label><input v-model="block.caption" /></div>
        </template>
      </aside>
    </div>
  </div>
</template>

<style scoped>
.ed {
  position: fixed;
  inset: 0;
  display: flex;
  flex-direction: column;
  color: var(--fg-tertiary);
}
.ed-head {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  height: 48px;
  padding: 0 0.9rem;
  border-bottom: 1px solid var(--rule);
  flex-shrink: 0;
}
.ed-name {
  background: transparent;
  border: 1px solid transparent;
  border-radius: 3px;
  padding: 0.3rem 0.5rem;
  color: var(--fg-primary);
  font-size: 0.95rem;
  font-weight: 500;
  outline: none;
  min-width: 14rem;
}
.ed-name:hover {
  border-color: var(--rule);
}
.ed-name:focus {
  border-color: var(--brand-500);
}
.ed-saved {
  font-size: 0.7rem;
  color: var(--fg-faint);
}
.ed-actions {
  margin-left: auto;
  display: flex;
  gap: 0.5rem;
}
.ed-btn {
  padding: 0.4rem 0.8rem;
  border: 1px solid var(--rule);
  border-radius: 3px;
  font-size: 0.8rem;
  color: var(--slate-300);
}
.ed-btn:hover {
  border-color: rgba(148, 168, 202, 0.5);
  background: rgba(148, 168, 202, 0.08);
}
.ed-btn.primary {
  background: var(--brand-700);
  border-color: var(--brand-600);
  color: #fff;
}
.ed-body {
  flex: 1;
  display: grid;
  grid-template-columns: 13rem 1fr 19rem;
  min-height: 0;
}
.ed-list {
  border-right: 1px solid var(--rule);
  overflow-y: auto;
  padding: 0.6rem;
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
}
.ed-thumb {
  position: relative;
  border: 1px solid var(--rule);
  border-radius: 3px;
  padding: 0.6rem;
  cursor: pointer;
  background: rgba(255, 255, 255, 0.01);
}
.ed-thumb.active {
  border-color: var(--brand-500);
  background: rgba(85, 111, 158, 0.12);
}
.ed-thumb-n {
  font-size: 0.65rem;
  color: var(--fg-faint);
  font-variant-numeric: tabular-nums;
}
.ed-thumb-t {
  display: block;
  font-size: 0.8rem;
  color: var(--fg-primary);
  margin-top: 0.15rem;
}
.ed-thumb-ctl {
  position: absolute;
  top: 0.4rem;
  right: 0.4rem;
  display: none;
  gap: 0.1rem;
}
.ed-thumb:hover .ed-thumb-ctl {
  display: flex;
}
.ed-thumb-ctl button {
  width: 1.2rem;
  height: 1.2rem;
  font-size: 0.65rem;
  color: var(--fg-muted);
  border-radius: 2px;
}
.ed-thumb-ctl button:hover {
  background: rgba(255, 255, 255, 0.1);
  color: var(--fg-primary);
}
.ed-add {
  margin-top: 0.4rem;
  display: flex;
  flex-wrap: wrap;
  gap: 0.3rem;
  align-items: center;
}
.ed-add span {
  width: 100%;
  font-size: 0.6rem;
  text-transform: uppercase;
  letter-spacing: 0.14em;
  color: var(--fg-faint);
}
.ed-add button {
  padding: 0.25rem 0.5rem;
  border: 1px solid var(--rule);
  border-radius: 2px;
  font-size: 0.7rem;
  color: var(--slate-300);
}
.ed-add button:hover {
  border-color: var(--brand-500);
}
.ed-preview {
  display: grid;
  place-items: center;
  padding: 1.5rem;
  min-width: 0;
  background:
    radial-gradient(700px 300px at 50% 0%, rgba(67, 87, 128, 0.12), transparent 70%),
    var(--slate-950);
}
.ed-stage {
  width: 100%;
  max-width: min(100%, calc((100vh - 140px) * 16 / 9));
  aspect-ratio: 16 / 9;
  border: 1px solid var(--rule);
  border-radius: 3px;
  overflow: hidden;
  background: var(--slate-950);
}
.ed-stage-inner {
  width: 100%;
  height: 100%;
  padding: clamp(1.5rem, 4vw, 3rem);
  display: flex;
}
.ed-inspector {
  border-left: 1px solid var(--rule);
  overflow-y: auto;
  padding: 1rem;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}
.ed-field {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}
.ed-field label {
  font-size: 0.65rem;
  text-transform: uppercase;
  letter-spacing: 0.12em;
  color: var(--fg-faint);
}
.ed-field input,
.ed-field textarea,
.ed-field select {
  background: rgba(255, 255, 255, 0.02);
  border: 1px solid var(--rule);
  border-radius: 3px;
  padding: 0.5rem 0.6rem;
  color: var(--fg-primary);
  font-size: 0.85rem;
  font-family: inherit;
  outline: none;
  resize: vertical;
}
.ed-field input:focus,
.ed-field textarea:focus,
.ed-field select:focus {
  border-color: var(--brand-500);
}
.ed-item {
  display: flex;
  gap: 0.3rem;
  margin-bottom: 0.3rem;
}
.ed-item input {
  flex: 1;
}
.ed-item button {
  width: 1.8rem;
  color: var(--fg-muted);
  border: 1px solid var(--rule);
  border-radius: 3px;
}
.ed-add-item {
  font-size: 0.75rem;
  color: var(--brand-300);
  align-self: flex-start;
}
.ed-img-prev {
  margin-top: 0.4rem;
  border: 1px solid var(--rule);
  border-radius: 3px;
  overflow: hidden;
  aspect-ratio: 16 / 10;
}
.ed-img-prev img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
</style>
