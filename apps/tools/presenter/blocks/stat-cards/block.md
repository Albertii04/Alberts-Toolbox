# Stat cards

A row of figures that count up on entry. Good for metrics / outcomes. No
presenter control (reveal-only).

## Recipe

```vue
<script setup lang="ts">
import StatCard from '../components/StatCard.vue'
</script>
<template>
  <div class="stats">
    <StatCard num="01 · Tiempo" :figure="15" unit="min" headline="De CAD a render" :delay="0" data-reveal />
    <StatCard num="02 · Firmas" :figure="0" headline="Antes de presentar" :delay="150" data-reveal />
    <StatCard num="03 · Coste" :figure="0" unit="€" headline="En exploración" :delay="300" data-reveal />
  </div>
</template>
<style scoped>
.stats { display: grid; grid-template-columns: repeat(3, 1fr); gap: clamp(1rem, 1.6vw, 1.75rem); height: 100%; align-content: center; }
</style>
```
