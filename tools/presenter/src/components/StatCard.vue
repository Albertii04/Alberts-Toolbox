<script setup lang="ts">
import { onMounted, ref } from 'vue'
import gsap from 'gsap'

const props = defineProps<{
  num: string
  figure: number
  unit: string
  headline: string
  body: string
  delay?: number
}>()

const display = ref(0)

onMounted(() => {
  const obj = { v: 0 }
  gsap.to(obj, {
    v: props.figure,
    duration: 1.1,
    delay: (props.delay || 0) / 1000 + 0.4,
    ease: 'power3.out',
    onUpdate: () => { display.value = obj.v },
  })
})
</script>

<template>
  <div class="stat-card">
    <span class="stat-num">{{ num }}</span>
    <div class="stat-figure">
      <span>{{ Math.round(display) }}</span>
      <span class="unit">{{ unit }}</span>
    </div>
    <div class="stat-rule"></div>
    <span class="stat-headline">{{ headline }}</span>
    <span class="stat-body">{{ body }}</span>
  </div>
</template>
