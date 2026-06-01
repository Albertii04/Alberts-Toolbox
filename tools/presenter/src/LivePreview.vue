<script setup lang="ts">
import { onMounted, ref } from 'vue'

const props = defineProps<{ presId: string }>()
const url = ref('')
const error = ref('')

onMounted(async () => {
  const tb = (window as unknown as { toolbox?: { authoring?: { previewUrl(): Promise<string> } } })
    .toolbox
  if (!tb?.authoring) {
    error.value = 'La vista en vivo solo está disponible dentro del shell.'
    return
  }
  try {
    const base = await tb.authoring.previewUrl()
    url.value = `${base}?pres=${props.presId}`
  } catch (e) {
    error.value = 'No se pudo iniciar el servidor de preview: ' + (e as Error).message
  }
})
</script>

<template>
  <div class="lp">
    <div v-if="!url && !error" class="lp-msg">Iniciando servidor de preview en vivo…</div>
    <div v-else-if="error" class="lp-msg">{{ error }}</div>
    <iframe v-else :src="url" class="lp-frame" title="Vista en vivo" />
  </div>
</template>

<style scoped>
.lp {
  position: fixed;
  inset: 0;
  background: var(--slate-950);
}
.lp-frame {
  width: 100%;
  height: 100%;
  border: 0;
  display: block;
}
.lp-msg {
  position: fixed;
  inset: 0;
  display: grid;
  place-items: center;
  color: var(--fg-muted);
  font-size: 0.9rem;
  padding: 2rem;
  text-align: center;
}
</style>
