<script setup lang="ts">
import { asset } from '../assets'
</script>

<template>
  <div class="layout-split">
    <div class="text-block">
      <span class="eyebrow" data-reveal>Paso 03 · Listo</span>
      <h2 class="title" data-reveal>El modelo ya está listo para renderizar.</h2>
      <p class="body" data-reveal>
        Mobiliario colocado, materiales puestos, encuadre decidido.
        Ahora abrimos el mismo archivo en un ordenador con tarjeta gráfica potente —
        el que tenéis en oficina para esto.
      </p>
      <p class="muted" data-reveal>Mismo SketchUp. Mismo archivo. Otro ordenador.</p>
    </div>
    <div class="image-window" data-reveal>
      <div class="iw-titlebar">SketchUp · proyecto.skp</div>
      <div class="iw-body"><img :src="asset('05_final_sketchup.png')" alt="SketchUp listo" /></div>
    </div>
  </div>
</template>