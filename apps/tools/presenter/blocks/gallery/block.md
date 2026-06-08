# Image gallery

A responsive grid of images (auto square-ish layout). Reveal-only, no presenter
control.

## Recipe

```vue
<script setup lang="ts">
import Gallery from '../components/Gallery.vue'
import a from '../source/ref1.jpg'
import b from '../source/ref2.jpg'
import c from '../source/ref3.jpg'
import d from '../source/ref4.jpg'
</script>
<template>
  <div style="height:100%" data-reveal>
    <Gallery :images="[a, b, c, d]" caption="Referencias del cliente" />
  </div>
</template>
```
