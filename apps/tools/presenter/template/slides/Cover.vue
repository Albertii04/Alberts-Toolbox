<script setup lang="ts">
import meta from '../presentation.json'
</script>

<template>
  <div class="cover">
    <span class="eyebrow" data-reveal>Presentación</span>
    <h1 class="title" data-reveal>{{ meta.name }}</h1>
    <p class="sub" data-reveal>Edita esta presentación con el chat.</p>
  </div>
</template>

<style scoped>
.cover {
  height: 100%;
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 1rem;
}
.eyebrow {
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: var(--track-eyebrow);
  color: var(--brand-300);
}
.title {
  font-size: clamp(2.5rem, 6vw, 5rem);
  line-height: 0.98;
  letter-spacing: var(--track-tight);
  font-weight: 500;
  color: var(--fg-primary);
  max-width: 18ch;
}
.sub {
  font-size: clamp(1.05rem, 1.3vw, 1.35rem);
  color: var(--slate-300);
  max-width: 48ch;
}
</style>
