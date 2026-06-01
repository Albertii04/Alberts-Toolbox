<template>
  <div class="text-block" style="margin-bottom: 0.9rem;">
    <span class="eyebrow" data-reveal>El cliente nos da el norte</span>
    <h2 class="title" data-reveal>Cuatro imágenes de referencia. Cuatro direcciones distintas.</h2>
  </div>
  <div class="refs-grid">
    <div class="ref-slot" data-reveal><img src="/images/ref_01.jpeg" alt="" /></div>
    <div class="ref-slot" data-reveal><img src="/images/ref_02.jpeg" alt="" /></div>
    <div class="ref-slot" data-reveal><img src="/images/ref_03.jpg" alt="" /></div>
    <div class="ref-slot" data-reveal><img src="/images/ref_04.jpg" alt="" /></div>
  </div>
</template>

<style scoped>
.refs-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  grid-template-rows: 1fr 1fr;
  gap: clamp(0.75rem, 1.2vw, 1.25rem);
  flex: 1;
  min-height: 0;
  width: 100%;
}
.ref-slot {
  position: relative;
  border: 1px solid var(--rule-strong);
  background: #000;
  overflow: hidden;
  border-radius: 2px;
  min-height: 0;
}
.ref-slot img {
  position: absolute; inset: 0;
  width: 100%; height: 100%;
  object-fit: cover;
  object-position: center;
  display: block;
}
</style>
