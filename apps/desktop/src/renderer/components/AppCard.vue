<script setup lang="ts">
import { computed } from 'vue'
import { Grip, Heart, Check, ArrowUp } from 'lucide-vue-next'
import type { StoreApp } from '../store-types'
import { paletteFor } from '../store-types'

const props = defineProps<{
  app: StoreApp
  installed?: boolean
  updatable?: boolean
  favorite?: boolean
}>()

const emit = defineEmits<{ open: []; toggleFav: [] }>()

const palette = computed(() => paletteFor(props.app.id))
const fallbackIcon =
  '<svg viewBox="0 0 64 64" fill="none"><rect width="64" height="64" rx="14" fill="currentColor" opacity="0.15"/><rect x="20" y="20" width="24" height="24" rx="6" fill="currentColor" opacity="0.45"/></svg>'
</script>

<template>
  <button
    class="card group relative flex h-44 flex-col justify-between overflow-hidden rounded-2xl bg-gradient-to-br p-5 text-left text-neutral-900 shadow-sm ring-1 ring-black/5 transition-all hover:-translate-y-1 hover:shadow-xl"
    :class="palette"
    @click="emit('open')"
  >
    <!-- top row: icon + handle/state -->
    <div class="flex items-start justify-between">
      <span
        class="grid size-12 place-items-center overflow-hidden rounded-2xl bg-white/80 text-neutral-500 shadow-sm ring-1 ring-black/5"
      >
        <span v-if="app.iconSvg" class="size-7" v-html="app.iconSvg" />
        <img v-else-if="app.icon" :src="app.icon" alt="" class="size-9 object-contain" />
        <span v-else class="size-7" v-html="fallbackIcon" />
      </span>

      <div class="flex items-center gap-1">
        <span
          v-if="updatable"
          class="inline-flex items-center gap-1 rounded-full bg-white/80 px-2 py-0.5 text-[10px] font-semibold text-amber-700 ring-1 ring-amber-300"
        >
          <ArrowUp class="size-3" /> Update
        </span>
        <span
          v-else-if="installed"
          class="inline-flex items-center gap-1 rounded-full bg-white/80 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 ring-1 ring-emerald-300"
        >
          <Check class="size-3" /> Installed
        </span>
        <span
          class="grid size-6 place-items-center rounded-md text-neutral-400/70 opacity-0 transition-opacity hover:bg-white/60 hover:text-rose-500 group-hover:opacity-100"
          :class="{ '!opacity-100 text-rose-500': favorite }"
          role="button"
          aria-label="Favorito"
          @click.stop="emit('toggleFav')"
        >
          <Heart class="size-4" :fill="favorite ? 'currentColor' : 'none'" />
        </span>
        <Grip class="size-4 text-neutral-400/50" />
      </div>
    </div>

    <!-- bottom: name + description -->
    <div>
      <div class="flex items-center gap-2">
        <h3 class="text-[17px] font-bold tracking-tight">{{ app.name }}</h3>
        <span
          v-if="app.kind === 'web'"
          class="rounded bg-white/70 px-1.5 py-px text-[9px] font-semibold uppercase tracking-wide text-neutral-500"
          >web</span
        >
      </div>
      <p class="mt-0.5 line-clamp-2 text-[12.5px] leading-snug text-neutral-600">
        {{ app.description }}
      </p>
    </div>
  </button>
</template>
