<script setup lang="ts">
import { asset } from '../assets'
import ZoomFrame from '../components/ZoomFrame.vue'
</script>

<template>
  <div class="layout-split">
    <div class="text-block">
      <span class="eyebrow" data-reveal>Paso 02 · La pieza clave</span>
      <h2 class="title" data-reveal>Esta extensión hace el 95% del trabajo.</h2>
      <p class="body" data-reveal>
        Lee los nombres de bloques del CAD, busca cada uno en vuestra librería de modelos 3D
        y los coloca en el sitio exacto donde estaban dibujados.
      </p>
      <p class="muted" data-reveal>Lo que antes era modelar a mano, ahora es un clic.</p>
    </div>
    <div data-reveal>
      <ZoomFrame :src="asset('02_sketchup.png')" focal-x="37%" focal-y="5%" :scale="4.5" instant />
    </div>
  </div>
</template>
