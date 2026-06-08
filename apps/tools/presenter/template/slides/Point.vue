<script setup lang="ts">
const points = ['Primer punto', 'Segundo punto', 'Tercer punto']
</script>

<template>
  <div class="point">
    <h2 class="title" data-reveal>Una idea por slide</h2>
    <ul>
      <li v-for="(p, i) in points" :key="i" data-reveal>{{ p }}</li>
    </ul>
  </div>
</template>

<style scoped>
.point {
  height: 100%;
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 1.5rem;
}
.title {
  font-size: clamp(1.9rem, 3.4vw, 3rem);
  font-weight: 500;
  letter-spacing: var(--track-tight);
  color: var(--fg-primary);
}
ul {
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 0.9rem;
  max-width: 40ch;
}
li {
  position: relative;
  padding-left: 1.5rem;
  font-size: clamp(1.05rem, 1.5vw, 1.4rem);
  color: var(--slate-300);
}
li::before {
  content: '';
  position: absolute;
  left: 0;
  top: 0.7em;
  width: 7px;
  height: 7px;
  background: var(--brand-300);
}
</style>
