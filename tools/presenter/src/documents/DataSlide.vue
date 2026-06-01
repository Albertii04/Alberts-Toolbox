<script setup lang="ts">
import type { DocBlock } from './format'

defineProps<{ block: DocBlock }>()
</script>

<template>
  <div class="ds">
    <!-- cover -->
    <div v-if="block.type === 'cover'" class="ds-cover">
      <span v-if="block.eyebrow" class="ds-eyebrow" data-reveal>{{ block.eyebrow }}</span>
      <h1 class="ds-title" data-reveal>{{ block.title }}</h1>
      <p v-if="block.subtitle" class="ds-subtitle" data-reveal>{{ block.subtitle }}</p>
    </div>

    <!-- statement -->
    <div v-else-if="block.type === 'statement'" class="ds-statement">
      <span v-if="block.eyebrow" class="ds-eyebrow" data-reveal>{{ block.eyebrow }}</span>
      <p class="ds-big" data-reveal>{{ block.text }}</p>
    </div>

    <!-- bullets -->
    <div v-else-if="block.type === 'bullets'" class="ds-bullets">
      <h2 class="ds-h2" data-reveal>{{ block.title }}</h2>
      <ul>
        <li v-for="(item, i) in block.items" :key="i" data-reveal>{{ item }}</li>
      </ul>
    </div>

    <!-- image -->
    <div v-else-if="block.type === 'image'" class="ds-image">
      <div class="ds-frame" data-reveal>
        <img :src="block.src" alt="" />
      </div>
      <p v-if="block.caption" class="ds-caption" data-reveal>{{ block.caption }}</p>
    </div>
  </div>
</template>

<style scoped>
.ds {
  height: 100%;
  width: 100%;
  display: flex;
  flex-direction: column;
  justify-content: center;
}
.ds-eyebrow {
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: var(--track-eyebrow);
  color: var(--brand-300);
}
.ds-cover {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}
.ds-title {
  font-size: clamp(2.5rem, 5.8vw, 5rem);
  line-height: 0.98;
  letter-spacing: var(--track-tight);
  font-weight: 500;
  color: var(--fg-primary);
  max-width: 18ch;
}
.ds-subtitle {
  font-size: clamp(1.05rem, 1.3vw, 1.35rem);
  color: var(--slate-300);
  max-width: 48ch;
}
.ds-statement {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}
.ds-big {
  font-size: clamp(1.9rem, 4vw, 3.4rem);
  line-height: 1.1;
  letter-spacing: var(--track-tight);
  font-weight: 500;
  color: var(--fg-primary);
  max-width: 24ch;
}
.ds-bullets {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}
.ds-h2 {
  font-size: clamp(1.9rem, 3.4vw, 3rem);
  font-weight: 500;
  color: var(--fg-primary);
  letter-spacing: var(--track-tight);
}
.ds-bullets ul {
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 0.9rem;
  max-width: 40ch;
}
.ds-bullets li {
  position: relative;
  padding-left: 1.5rem;
  font-size: clamp(1.05rem, 1.5vw, 1.4rem);
  color: var(--slate-300);
}
.ds-bullets li::before {
  content: '';
  position: absolute;
  left: 0;
  top: 0.7em;
  width: 7px;
  height: 7px;
  background: var(--brand-300);
}
.ds-image {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  height: 100%;
  justify-content: center;
}
.ds-frame {
  flex: 1;
  min-height: 0;
  border: 1px solid var(--rule-strong);
  border-radius: 2px;
  overflow: hidden;
  background: rgba(255, 255, 255, 0.015);
}
.ds-frame img {
  width: 100%;
  height: 100%;
  object-fit: contain;
}
.ds-caption {
  font-size: 0.875rem;
  color: var(--fg-muted);
}
</style>
