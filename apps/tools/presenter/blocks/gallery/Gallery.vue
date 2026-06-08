<script setup lang="ts">
defineProps<{ images: string[]; caption?: string }>()
</script>

<template>
  <div class="gal">
    <div class="gal-grid" :style="{ '--n': Math.ceil(Math.sqrt(images.length)) }">
      <div v-for="(src, i) in images" :key="i" class="gal-cell">
        <img :src="src" alt="" />
      </div>
    </div>
    <p v-if="caption" class="gal-cap">{{ caption }}</p>
  </div>
</template>

<style scoped>
.gal {
  height: 100%;
  display: flex;
  flex-direction: column;
  gap: 0.9rem;
  justify-content: center;
}
.gal-grid {
  flex: 1;
  min-height: 0;
  display: grid;
  grid-template-columns: repeat(var(--n, 2), 1fr);
  gap: clamp(0.6rem, 1.2vw, 1.1rem);
}
.gal-cell {
  position: relative;
  border: 1px solid var(--rule-strong);
  border-radius: 2px;
  overflow: hidden;
  background: rgba(255, 255, 255, 0.015);
}
.gal-cell img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}
.gal-cap {
  font-size: 0.8rem;
  color: var(--fg-muted);
}
</style>
