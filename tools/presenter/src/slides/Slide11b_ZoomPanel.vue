<script setup lang="ts">
import ZoomFrame from '../components/ZoomFrame.vue'
</script>

<template>
  <div class="layout-split">
    <div class="text-block">
      <span class="eyebrow" data-reveal>El panel</span>
      <h2 class="title" data-reveal>Aquí es donde elegimos cómo queremos la imagen.</h2>
      <p class="body" data-reveal>
        Estilo, iluminación, encuadre, instrucciones para la IA. Todo en una sola ventana.
        Cambiamos algo y vemos el resultado en segundos — no en horas, no al día siguiente.
      </p>
      <p class="accent-text" style="font-size: 0.875rem;" data-reveal>Iteramos en directo.</p>
    </div>
    <div data-reveal>
      <ZoomFrame src="/images/06_d5_panel.png" focal-x="42%" focal-y="52%" :scale="2.0" />
    </div>
  </div>
</template>
