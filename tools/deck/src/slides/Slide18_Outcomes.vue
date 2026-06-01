<script setup lang="ts">
import StatCard from '../components/StatCard.vue'
</script>

<template>
  <div class="text-block" style="margin-bottom: 0.5rem;">
    <span class="eyebrow" data-reveal>Lo que cambia</span>
    <h2 class="title" style="max-width: 28ch;" data-reveal>De una semana a una tarde.</h2>
  </div>

  <div class="stats">
    <div data-reveal>
      <StatCard
        num="01 · Tiempo"
        :figure="15"
        unit="min · no 1 semana"
        headline="Misma tarde, no día siguiente."
        body="El render tradicional, con sus modificaciones, ronda la semana. Aquí enseñamos una imagen al cliente en menos de quince minutos."
        :delay="0"
      />
    </div>
    <div data-reveal>
      <StatCard
        num="02 · Momento"
        :figure="0"
        unit="firmas necesarias"
        headline="Antes de firmar, no después."
        body="Tradicionalmente el render se reserva para clientes que ya han firmado. Esto nos permite enseñar imagen al cliente que todavía está decidiendo."
        :delay="200"
      />
    </div>
    <div data-reveal>
      <StatCard
        num="03 · Renderista"
        :figure="0"
        unit="€ en exploración"
        headline="El profesional para la imagen final."
        body="Seguimos llamando al renderista profesional para la imagen definitiva — esa que va a la web o al dossier. Las pruebas exploratorias las hacemos nosotros."
        :delay="400"
      />
    </div>
  </div>
</template>
