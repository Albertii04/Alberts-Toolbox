<script setup lang="ts">
import { onMounted, ref } from 'vue'
import gsap from 'gsap'

const props = defineProps<{
  num: string
  figure: number
  unit?: string
  headline: string
  body?: string
  delay?: number // ms
}>()

const display = ref(0)
onMounted(() => {
  const obj = { v: 0 }
  gsap.to(obj, {
    v: props.figure,
    duration: 1.1,
    delay: (props.delay ?? 0) / 1000 + 0.4,
    ease: 'power3.out',
    onUpdate: () => (display.value = obj.v),
  })
})
</script>

<template>
  <div class="stat-card">
    <span class="stat-num">{{ num }}</span>
    <div class="stat-figure">
      <span>{{ Math.round(display) }}</span>
      <span v-if="unit" class="unit">{{ unit }}</span>
    </div>
    <div class="stat-rule"></div>
    <span class="stat-headline">{{ headline }}</span>
    <span v-if="body" class="stat-body">{{ body }}</span>
  </div>
</template>

<style scoped>
.stat-card {
  border: 1px solid var(--rule-strong);
  background: rgba(15, 23, 42, 0.6);
  padding: clamp(1.5rem, 2.2vw, 2.25rem);
  border-radius: 2px;
  display: flex;
  flex-direction: column;
  gap: 0.9rem;
  min-height: 14rem;
}
.stat-num {
  font-size: 0.625rem;
  font-weight: 600;
  color: var(--brand-300);
  letter-spacing: var(--track-eyebrow);
  text-transform: uppercase;
}
.stat-figure {
  font-size: clamp(3rem, 5.5vw, 5rem);
  font-weight: 300;
  color: var(--fg-primary);
  line-height: 1;
  letter-spacing: var(--track-tight);
  font-variant-numeric: tabular-nums;
  display: flex;
  align-items: baseline;
  gap: 0.4rem;
}
.stat-figure .unit {
  font-size: clamp(0.95rem, 1.4vw, 1.3rem);
  color: var(--brand-300);
  font-weight: 400;
}
.stat-rule {
  width: 2rem;
  height: 1px;
  background: var(--brand-300);
  opacity: 0.6;
}
.stat-headline {
  font-size: clamp(1rem, 1.3vw, 1.15rem);
  font-weight: 500;
  color: var(--fg-primary);
  line-height: 1.15;
}
.stat-body {
  font-size: clamp(0.85rem, 0.95vw, 0.95rem);
  color: var(--slate-300);
  line-height: 1.5;
}
</style>
