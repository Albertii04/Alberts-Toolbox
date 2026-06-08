<script setup lang="ts">
defineProps<{
  steps: { num: string; title: string; desc: string }[]
  step: number // 0..steps.length-1 — current step (drive from useSliderState variant)
}>()
function state(i: number, step: number): 'past' | 'active' | 'pending' {
  if (i < step) return 'past'
  if (i === step) return 'active'
  return 'pending'
}
</script>

<template>
  <div class="pl">
    <template v-for="(s, i) in steps" :key="i">
      <div class="pl-node" :class="state(i, step)">
        <span class="pl-num">{{ s.num }}</span>
        <span class="pl-title">{{ s.title }}</span>
        <span class="pl-desc">{{ s.desc }}</span>
      </div>
      <div v-if="i < steps.length - 1" class="pl-arrow" :class="{ done: i < step }">→</div>
    </template>
  </div>
</template>

<style scoped>
.pl {
  display: flex;
  align-items: stretch;
  width: 100%;
}
.pl-node {
  flex: 1;
  position: relative;
  border: 1px solid var(--rule);
  padding: 1.5rem 1.25rem;
  background: rgba(15, 23, 42, 0.5);
  border-radius: 2px;
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
  min-height: 10rem;
  overflow: hidden;
  transition:
    background 500ms var(--ease),
    border-color 500ms var(--ease),
    opacity 500ms var(--ease),
    transform 500ms var(--ease);
}
.pl-num {
  font-size: 0.625rem;
  font-weight: 600;
  color: var(--brand-300);
  letter-spacing: var(--track-eyebrow);
  text-transform: uppercase;
}
.pl-title {
  font-size: clamp(1rem, 1.3vw, 1.25rem);
  font-weight: 500;
  color: var(--fg-primary);
  line-height: 1.15;
}
.pl-desc {
  font-size: 0.8rem;
  color: var(--slate-400);
  line-height: 1.45;
}
.pl-node.pending {
  opacity: 0.55;
  background: rgba(15, 23, 42, 0.3);
}
.pl-node.pending .pl-num,
.pl-node.pending .pl-title,
.pl-node.pending .pl-desc {
  filter: blur(3px);
  opacity: 0.6;
}
.pl-node.past {
  border-color: var(--brand-400);
  background: rgba(54, 72, 110, 0.2);
  opacity: 1;
}
.pl-node.active {
  opacity: 1;
  border-color: transparent;
  background: rgba(54, 72, 110, 0.3);
  transform: translateY(-2px);
  box-shadow: 0 24px 48px -24px rgba(0, 0, 0, 0.6);
  z-index: 2;
}
.pl-node.active::before {
  content: '';
  position: absolute;
  inset: -2px;
  border-radius: 2px;
  padding: 2.5px;
  background: conic-gradient(
    from var(--spin-angle, 0deg),
    transparent 0%,
    rgba(148, 168, 202, 0) 30%,
    var(--brand-300) 55%,
    #ffffff 72%,
    var(--brand-300) 85%,
    rgba(148, 168, 202, 0) 100%
  );
  -webkit-mask:
    linear-gradient(#000 0 0) content-box,
    linear-gradient(#000 0 0);
  -webkit-mask-composite: xor;
  mask-composite: exclude;
  pointer-events: none;
  animation: pl-spin 2.4s linear infinite;
  filter: drop-shadow(0 0 8px rgba(148, 168, 202, 0.55));
}
@property --spin-angle {
  syntax: '<angle>';
  inherits: false;
  initial-value: 0deg;
}
@keyframes pl-spin {
  to {
    --spin-angle: 360deg;
  }
}
.pl-arrow {
  display: grid;
  place-items: center;
  color: var(--rule-strong);
  font-size: 1.1rem;
  padding: 0 0.4rem;
  font-weight: 300;
  transition: color 500ms var(--ease);
}
.pl-arrow.done {
  color: var(--brand-300);
}
</style>
