<script setup lang="ts">
import { ref } from 'vue'
import { addPres, setPendingPrompt } from './documents/store'

interface Authoring {
  createPresentation(name: string): Promise<{ id: string }>
}
const authoring = (window as unknown as { toolbox?: { authoring?: Authoring } }).toolbox?.authoring

const name = ref('')
const goal = ref('')
const audience = ref('')
const design = ref('')
const busy = ref(false)
const error = ref('')

function buildPrompt(title: string): string {
  const parts: string[] = []
  parts.push(`Construye esta presentación de cero, editando los .vue de las slides, slides.ts, presentation.json (name="${title}") y el tema.`)
  parts.push(`Tema/objetivo: ${goal.value.trim() || title}.`)
  if (audience.value.trim()) parts.push(`Audiencia: ${audience.value.trim()}.`)
  if (design.value.trim()) {
    parts.push(`Referencia de diseño (paleta, tipografía, estilo, layout): ${design.value.trim()}`)
    if (/https?:\/\//.test(design.value)) {
      parts.push(
        `La referencia contiene enlaces: ábrelos con WebFetch y extrae colores, tipografía y estilo visual para aplicarlos.`,
      )
    }
  }
  parts.push(
    `Crea las slides necesarias, con jerarquía clara, y que quede moderna y coherente. Usa los tokens de tema del engine donde tenga sentido.`,
  )
  return parts.join(' ')
}

async function crear(): Promise<void> {
  if (!authoring) {
    error.value = 'Crear presentaciones solo está disponible dentro del shell.'
    return
  }
  const title = name.value.trim() || 'Nueva presentación'
  busy.value = true
  error.value = ''
  try {
    const { id } = await authoring.createPresentation(title)
    await addPres(id, title)
    await setPendingPrompt(id, buildPrompt(title))
    location.search = `?edit=${id}`
  } catch (e) {
    error.value = 'No se pudo crear: ' + (e as Error).message
    busy.value = false
  }
}
function cancel(): void {
  location.search = ''
}
</script>

<template>
  <div class="ob">
    <div class="card">
      <p class="eyebrow">Nueva presentación</p>
      <h1>¿Qué quieres crear?</h1>
      <p class="lead">Claude la construye por ti. Cuanto más le cuentes, mejor.</p>

      <div class="grid">
        <label class="field">
          <span>Título</span>
          <input v-model="name" type="text" placeholder="Ej. Resultados Q2" />
        </label>
        <label class="field">
          <span>Audiencia <em>(opcional)</em></span>
          <input v-model="audience" type="text" placeholder="Ej. inversores, equipo técnico…" />
        </label>
        <label class="field span2">
          <span>¿De qué trata? ¿Qué quieres contar?</span>
          <textarea
            v-model="goal"
            rows="2"
            placeholder="Describe el tema, el mensaje principal, las secciones…"
          />
        </label>
        <label class="field span2">
          <span>Referencia de diseño <em>(opcional)</em></span>
          <textarea
            v-model="design"
            rows="2"
            placeholder="Pega un diseño de Claude, un enlace (web de terceros, Claude design…) o describe el estilo. Si pones un link, Claude lo abre y extrae paleta/tipografía/estilo."
          />
        </label>
      </div>

      <p v-if="error" class="error">{{ error }}</p>

      <div class="actions">
        <button class="btn" :disabled="busy" @click="cancel">Cancelar</button>
        <button class="btn primary" :disabled="busy" @click="crear">
          {{ busy ? 'Creando…' : 'Crear con IA →' }}
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.ob {
  position: fixed;
  inset: 0;
  display: grid;
  place-items: center;
  padding: 1.5rem;
  overflow: hidden;
}
.card {
  width: 100%;
  max-width: 40rem;
  border: 1px solid var(--rule);
  border-radius: 6px;
  background: rgba(255, 255, 255, 0.015);
  padding: clamp(1.5rem, 3vw, 2.25rem);
}
.eyebrow {
  font-size: 0.7rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: var(--track-eyebrow);
  color: var(--brand-300);
  margin-bottom: 0.5rem;
}
.card h1 {
  font-size: clamp(1.5rem, 2.6vw, 2rem);
  font-weight: 500;
  letter-spacing: var(--track-tight);
  color: var(--fg-primary);
}
.lead {
  font-size: 0.85rem;
  color: var(--fg-muted);
  margin: 0.4rem 0 1.4rem;
}
.grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.9rem;
}
.field {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}
.field.span2 {
  grid-column: 1 / -1;
}
.field span {
  font-size: 0.72rem;
  font-weight: 500;
  color: var(--slate-300);
}
.field em {
  color: var(--fg-faint);
  font-style: normal;
}
.field input,
.field textarea {
  background: rgba(255, 255, 255, 0.02);
  border: 1px solid var(--rule);
  border-radius: 4px;
  padding: 0.55rem 0.65rem;
  color: var(--fg-primary);
  font-size: 0.85rem;
  font-family: inherit;
  outline: none;
  resize: none;
}
.field input:focus,
.field textarea:focus {
  border-color: var(--brand-500);
}
.error {
  margin-top: 0.9rem;
  font-size: 0.8rem;
  color: #f3a3a3;
}
.actions {
  margin-top: 1.5rem;
  display: flex;
  justify-content: flex-end;
  gap: 0.6rem;
}
.btn {
  padding: 0.55rem 1.1rem;
  border: 1px solid var(--rule);
  border-radius: 4px;
  font-size: 0.85rem;
  color: var(--slate-300);
}
.btn:hover:not(:disabled) {
  border-color: rgba(148, 168, 202, 0.5);
}
.btn:disabled {
  opacity: 0.5;
}
.btn.primary {
  background: var(--brand-700);
  border-color: var(--brand-600);
  color: #fff;
}
.btn.primary:hover:not(:disabled) {
  background: var(--brand-600);
}
</style>
