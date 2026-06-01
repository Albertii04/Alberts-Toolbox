<script setup lang="ts">
import BeforeAfter from '../components/BeforeAfter.vue'
</script>

<template>
  <div class="layout-split">
    <div class="text-block">
      <span class="eyebrow" data-reveal>Paso 03 · Toques a mano</span>
      <h2 class="title" data-reveal>El programa coloca. Nosotros matizamos.</h2>
      <p class="body" data-reveal>
        La extensión te deja el modelo poblado en minutos. A partir de ahí, unos pocos
        retoques: texturas concretas, un color de pared, algún detalle. Y colocamos
        la cámara donde queremos contar la escena. Lo justo para que tenga carácter,
        no para reconstruirla.
      </p>
      <p class="accent-text" style="font-size: 0.875rem;" data-reveal>
        Arrastra el divisor para comparar.
      </p>
    </div>
    <div data-reveal>
      <BeforeAfter
        before="/images/04_1_crudo.jpg"
        after="/images/04_2_retocado.jpg"
        label-before="Crudo"
        label-after="Retocado"
      />
    </div>
  </div>
</template>
