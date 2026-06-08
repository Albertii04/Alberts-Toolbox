<script setup lang="ts">
import { asset } from '../assets'
import ZoomFrame from '../components/ZoomFrame.vue'
</script>

<template>
  <div class="layout-split">
    <div class="text-block">
      <span class="eyebrow" data-reveal>Paso 04 · D5 Lite</span>
      <h2 class="title" data-reveal>Otra extensión, esta vez para renderizar.</h2>
      <p class="body" data-reveal>
        En el toolbar aparece <span class="accent-text">D5 Lite</span> — un plugin gratuito
        que renderiza con IA sin salir de SketchUp. No abrimos otro programa, no exportamos
        nada. Trabajamos sobre la misma escena.
      </p>
      <p class="muted" data-reveal>D5 Lite es el plugin · D5 Render es el programa completo. Aquí usamos el plugin.</p>
    </div>
    <div data-reveal>
      <ZoomFrame :src="asset('05_final_sketchup.png')" focal-x="38%" focal-y="5%" :scale="4.5" />
    </div>
  </div>
</template>
