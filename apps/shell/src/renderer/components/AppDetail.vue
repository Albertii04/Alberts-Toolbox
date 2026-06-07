<script setup lang="ts">
import { computed } from 'vue'
import {
  X,
  Star,
  GitCommitHorizontal,
  Download,
  ArrowUp,
  Trash2,
  ExternalLink,
  Heart,
  Loader,
  TriangleAlert,
} from 'lucide-vue-next'
import type { PlatformArch } from '@toolbox/sdk'
import type { InstallProgress, InstalledApp } from '../../shared/types'
import type { StoreApp } from '../store-types'
import { paletteFor } from '../store-types'

const props = defineProps<{
  app: StoreApp
  platform: string
  installed: InstalledApp | null
  progress: InstallProgress | null
  favorite: boolean
}>()

const emit = defineEmits<{
  close: []
  install: []
  uninstall: []
  openTool: []
  toggleFav: []
}>()

const palette = computed(() => paletteFor(props.app.id))
const isWeb = computed(() => props.app.kind === 'web')
const hasDownload = computed(() => !!props.app.downloads?.[props.platform as PlatformArch])
const hasInstallers = computed(() => Object.keys(props.app.installers ?? {}).length > 0)
// Installable if a direct download matches this platform OR a package manager
// is declared (the main process checks at install time whether it's present).
const installable = computed(() => hasDownload.value || hasInstallers.value)
const updatable = computed(
  () => !!props.installed && props.installed.version !== props.app.version,
)
const busy = computed(
  () => !!props.progress && props.progress.phase !== 'done' && props.progress.phase !== 'error',
)
const failed = computed(() => props.progress?.phase === 'error')

const stars = computed(() => {
  const n = props.app.metrics?.stars
  if (!n) return null
  return n >= 1000 ? (n / 1000).toFixed(1).replace(/\.0$/, '') + 'k' : String(n)
})
const lastCommit = computed(() => {
  const d = props.app.metrics?.lastCommit
  if (!d) return null
  return new Date(d).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
})

const progressLabel = computed(() => {
  const p = props.progress
  if (!p) return ''
  if (p.phase === 'downloading') return `Downloading… ${p.pct ?? 0}%`
  if (p.phase === 'verifying') return 'Verifying…'
  if (p.phase === 'installing') return p.message || 'Installing…'
  if (p.phase === 'resolving') return 'Preparing…'
  if (p.phase === 'error') return p.message || 'Install failed'
  return ''
})
</script>

<template>
  <div class="fixed inset-0 z-50 flex items-center justify-center p-6" @click.self="emit('close')">
    <div class="absolute inset-0 bg-black/40 backdrop-blur-sm" @click="emit('close')" />

    <div
      class="detail relative flex max-h-[82vh] w-full max-w-2xl flex-col overflow-hidden rounded-3xl bg-white shadow-2xl dark:bg-neutral-900"
    >
      <!-- header band -->
      <div class="relative bg-gradient-to-br p-6 pb-5" :class="palette">
        <button
          class="absolute right-4 top-4 grid size-8 place-items-center rounded-full bg-white/70 text-neutral-600 transition hover:bg-white"
          @click="emit('close')"
        >
          <X class="size-4" />
        </button>
        <div class="flex items-center gap-4">
          <span
            class="grid size-16 shrink-0 place-items-center overflow-hidden rounded-2xl bg-white/85 text-neutral-500 shadow ring-1 ring-black/5"
          >
            <span v-if="app.iconSvg" class="size-9" v-html="app.iconSvg" />
            <img v-else-if="app.icon" :src="app.icon" alt="" class="size-12 object-contain" />
          </span>
          <div class="min-w-0 text-neutral-900">
            <h2 class="truncate text-2xl font-bold tracking-tight">{{ app.name }}</h2>
            <p class="text-[13px] text-neutral-600">
              {{ app.author || 'Open source' }} · v{{ app.version }}
              <span v-if="app.kind === 'web'" class="ml-1 rounded bg-white/70 px-1.5 py-px text-[10px] font-semibold uppercase">web</span>
            </p>
            <div class="mt-2 flex flex-wrap items-center gap-3 text-[12px] text-neutral-700">
              <span v-if="stars" class="inline-flex items-center gap-1"><Star class="size-3.5" /> {{ stars }}</span>
              <span v-if="lastCommit" class="inline-flex items-center gap-1"><GitCommitHorizontal class="size-3.5" /> {{ lastCommit }}</span>
            </div>
          </div>
        </div>

        <div v-if="app.replaces?.length" class="mt-4 flex flex-wrap items-center gap-1.5">
          <span class="text-[11px] font-medium text-neutral-600">Replaces</span>
          <span
            v-for="r in app.replaces"
            :key="r"
            class="rounded-full bg-white/70 px-2 py-0.5 text-[11px] font-medium text-neutral-700"
            >{{ r }}</span
          >
        </div>
      </div>

      <!-- action row -->
      <div class="flex items-center gap-3 border-b border-neutral-100 px-6 py-4 dark:border-neutral-800">
        <template v-if="isWeb">
          <button
            v-if="app.isLocalWeb"
            class="inline-flex items-center gap-2 rounded-xl bg-neutral-900 px-5 py-2.5 text-[13px] font-semibold text-white transition hover:bg-neutral-700 dark:bg-white dark:text-neutral-900"
            @click="emit('openTool')"
          >
            <ExternalLink class="size-4" /> Open
          </button>
          <span v-else class="text-[13px] text-neutral-500">Web app — not installed locally.</span>
        </template>

        <template v-else>
          <button
            v-if="updatable"
            :disabled="busy"
            class="inline-flex items-center gap-2 rounded-xl bg-amber-500 px-5 py-2.5 text-[13px] font-semibold text-white transition hover:bg-amber-600 disabled:opacity-60"
            @click="emit('install')"
          >
            <ArrowUp class="size-4" /> Update to v{{ app.version }}
          </button>
          <button
            v-else-if="!installed"
            :disabled="busy || !installable"
            class="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-[13px] font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
            @click="emit('install')"
          >
            <Download class="size-4" />
            {{ installable ? 'Install' : 'Not available for ' + platform }}
          </button>
          <span
            v-else
            class="inline-flex items-center gap-2 rounded-xl bg-emerald-50 px-4 py-2.5 text-[13px] font-semibold text-emerald-700 ring-1 ring-emerald-200"
          >
            Installed · v{{ installed.version }}
          </span>

          <button
            v-if="installed"
            :disabled="busy"
            class="inline-flex items-center gap-2 rounded-xl px-3 py-2.5 text-[13px] font-medium text-neutral-500 transition hover:bg-neutral-100 hover:text-rose-600 disabled:opacity-50 dark:hover:bg-neutral-800"
            @click="emit('uninstall')"
          >
            <Trash2 class="size-4" /> Uninstall
          </button>
        </template>

        <div class="flex-1" />
        <button
          class="grid size-10 place-items-center rounded-xl text-neutral-400 transition hover:bg-neutral-100 hover:text-rose-500 dark:hover:bg-neutral-800"
          :class="{ 'text-rose-500': favorite }"
          @click="emit('toggleFav')"
        >
          <Heart class="size-5" :fill="favorite ? 'currentColor' : 'none'" />
        </button>
      </div>

      <!-- progress -->
      <div v-if="progress && progress.phase !== 'done'" class="px-6 pt-4">
        <div
          class="flex items-center gap-2 text-[12px] font-medium"
          :class="failed ? 'text-rose-600' : 'text-neutral-600 dark:text-neutral-300'"
        >
          <Loader v-if="busy" class="size-3.5 animate-spin" />
          <TriangleAlert v-else-if="failed" class="size-3.5" />
          {{ progressLabel }}
        </div>
        <div v-if="busy" class="mt-2 h-1.5 overflow-hidden rounded-full bg-neutral-100 dark:bg-neutral-800">
          <div
            v-if="progress.phase === 'downloading'"
            class="h-full rounded-full bg-blue-600 transition-all"
            :style="{ width: (progress.pct ?? 0) + '%' }"
          />
          <div v-else class="indet h-full w-2/5 rounded-full bg-blue-600" />
        </div>
      </div>

      <!-- body: images + notes -->
      <div class="min-h-0 flex-1 overflow-y-auto px-6 py-5">
        <div v-if="app.images?.length" class="mb-5 overflow-hidden rounded-xl ring-1 ring-neutral-200 dark:ring-neutral-800">
          <img :src="app.images[0]" alt="" class="w-full object-cover" />
        </div>

        <p v-if="app.description" class="mb-4 text-[13.5px] leading-relaxed text-neutral-700 dark:text-neutral-300">
          {{ app.description }}
        </p>

        <template v-if="app.notes">
          <h4 class="mb-2 text-[11px] font-semibold uppercase tracking-wide text-neutral-400">
            Release notes · v{{ app.version }}
          </h4>
          <pre class="whitespace-pre-wrap break-words font-sans text-[12.5px] leading-relaxed text-neutral-600 dark:text-neutral-400">{{ app.notes.slice(0, 4000) }}</pre>
        </template>
      </div>
    </div>
  </div>
</template>

<style scoped>
.indet {
  animation: indet 1.1s ease-in-out infinite;
}
@keyframes indet {
  0% {
    transform: translateX(-100%);
  }
  100% {
    transform: translateX(260%);
  }
}
</style>
