<script setup lang="ts">
import { asset } from '../assets'
</script>

<template>
  <div class="layout-split">
    <div class="text-block">
      <span class="eyebrow" data-reveal>Paso 04 · Estilo</span>
      <h2 class="title" data-reveal>Primero elegimos el estilo de la imagen.</h2>
      <p class="body" data-reveal>
        D5 trae varios estilos ya preparados — fotorrealista, ilustración, render técnico…
        Para una farmacia elegimos <span class="accent-text">"Photo Realistic Interior"</span>.
        Es el más fiel: respeta los muebles que hemos puesto y no se inventa cosas
        que no están en el modelo.
      </p>
    </div>
    <div class="image-window" data-reveal>
      <div class="iw-titlebar">D5 Lite · catálogo de estilos</div>
      <div class="iw-body"><img :src="asset('07_d5_style.png')" alt="D5 estilos" /></div>
    </div>
  </div>
</template>