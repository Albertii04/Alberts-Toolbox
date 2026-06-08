<script setup lang="ts">
import type { Presentation } from './types'

defineProps<{ presentations: Presentation[] }>()

function openAudience(id: string) {
  window.location.search = `?pres=${id}`
}
function openPresenter(id: string) {
  window.open(`?p&pres=${id}`, '_blank')
}
</script>

<template>
  <div class="picker">
    <header class="pk-head">
      <p class="pk-eyebrow">Presenter</p>
      <h1>Elige una presentación</h1>
    </header>

    <div class="pk-grid">
      <div v-for="p in presentations" :key="p.meta.id" class="pk-card">
        <button class="pk-main" @click="openAudience(p.meta.id)">
          <span class="pk-name">{{ p.meta.name }}</span>
          <span class="pk-desc">{{ p.meta.description }}</span>
          <span class="pk-meta">
            {{ p.slides.length }} slides<span v-if="p.meta.date"> · {{ p.meta.date }}</span>
          </span>
        </button>
        <button class="pk-present" @click="openPresenter(p.meta.id)">Modo presentador ↗</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.picker {
  position: fixed;
  inset: 0;
  overflow-y: auto;
  padding: clamp(3rem, 8vh, 6rem) clamp(2rem, 6vw, 6rem);
}
.pk-head {
  margin-bottom: 2.5rem;
}
.pk-eyebrow {
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: var(--track-eyebrow);
  color: var(--brand-300);
  margin-bottom: 0.6rem;
}
.pk-head h1 {
  font-size: clamp(1.8rem, 3.2vw, 2.6rem);
  font-weight: 500;
  letter-spacing: var(--track-tight);
  color: var(--fg-primary);
}
.pk-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  gap: 1.25rem;
}
.pk-card {
  border: 1px solid var(--rule);
  border-radius: 2px;
  background: rgba(255, 255, 255, 0.015);
  display: flex;
  flex-direction: column;
}
.pk-main {
  text-align: left;
  padding: 1.5rem;
  display: flex;
  flex-direction: column;
  gap: 0.45rem;
  flex: 1;
  transition: background 0.15s;
}
.pk-main:hover {
  background: rgba(255, 255, 255, 0.03);
}
.pk-name {
  font-size: 1.15rem;
  font-weight: 500;
  color: var(--fg-primary);
  letter-spacing: var(--track-tight);
}
.pk-desc {
  font-size: 0.85rem;
  color: var(--fg-muted);
  line-height: 1.5;
}
.pk-meta {
  margin-top: 0.4rem;
  font-size: 0.65rem;
  text-transform: uppercase;
  letter-spacing: 0.12em;
  color: var(--fg-faint);
}
.pk-present {
  padding: 0.7rem 1.5rem;
  border-top: 1px solid var(--rule-soft);
  font-size: 0.7rem;
  text-transform: uppercase;
  letter-spacing: 0.12em;
  color: var(--brand-300);
  text-align: left;
}
.pk-present:hover {
  background: rgba(148, 168, 202, 0.08);
}
</style>
