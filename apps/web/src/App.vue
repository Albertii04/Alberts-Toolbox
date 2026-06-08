<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { RESOLVED_CATALOG_URL, type ResolvedApp } from '@openappstore/sdk'

const RELEASES_URL = 'https://github.com/Albertii04/Alberts-Toolbox/releases/latest'

const apps = ref<ResolvedApp[]>([])
const loading = ref(true)
const error = ref('')
const query = ref('')
const category = ref('All')
const selected = ref<ResolvedApp | null>(null)

const PALETTES = [
  'from-sky-100 to-sky-50',
  'from-amber-100 to-amber-50',
  'from-rose-100 to-rose-50',
  'from-indigo-100 to-indigo-50',
  'from-emerald-100 to-emerald-50',
  'from-violet-100 to-violet-50',
  'from-orange-100 to-orange-50',
  'from-cyan-100 to-cyan-50',
  'from-fuchsia-100 to-fuchsia-50',
  'from-teal-100 to-teal-50',
]
function palette(id: string): string {
  let h = 0
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0
  return PALETTES[h % PALETTES.length]
}

const categories = computed(() => [
  'All',
  ...[...new Set(apps.value.map((a) => a.category).filter(Boolean) as string[])].sort(),
])

const visible = computed(() => {
  let list = apps.value
  if (category.value !== 'All') list = list.filter((a) => a.category === category.value)
  const q = query.value.trim().toLowerCase()
  if (q)
    list = list.filter(
      (a) =>
        a.name.toLowerCase().includes(q) ||
        (a.description ?? '').toLowerCase().includes(q) ||
        (a.replaces ?? []).some((r) => r.toLowerCase().includes(q)),
    )
  return list
})

function stars(a: ResolvedApp): string | null {
  const n = a.metrics?.stars
  if (!n) return null
  return n >= 1000 ? (n / 1000).toFixed(1).replace(/\.0$/, '') + 'k' : String(n)
}

function installLines(a: ResolvedApp): { label: string; cmd: string }[] {
  const out: { label: string; cmd: string }[] = []
  const i = a.installers ?? {}
  if (i.brew) out.push({ label: 'macOS · Homebrew', cmd: `brew install ${i.brew}` })
  if (i.winget) out.push({ label: 'Windows · winget', cmd: `winget install ${i.winget}` })
  if (i.scoop) out.push({ label: 'Windows · Scoop', cmd: `scoop install ${i.scoop}` })
  if (i.flatpak) out.push({ label: 'Linux · Flatpak', cmd: `flatpak install flathub ${i.flatpak}` })
  return out
}

onMounted(async () => {
  try {
    const res = await fetch(RESOLVED_CATALOG_URL)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const data = await res.json()
    apps.value = data.apps ?? []
  } catch (e) {
    error.value = (e as Error).message
  } finally {
    loading.value = false
  }
})
</script>

<template>
  <div class="min-h-screen bg-neutral-50 text-neutral-900">
    <!-- hero -->
    <header class="border-b border-neutral-200 bg-white">
      <div class="mx-auto max-w-6xl px-6 py-14">
        <div class="flex items-start justify-between gap-6">
          <div>
            <h1 class="text-4xl font-extrabold tracking-tight sm:text-5xl">Open App Store</h1>
            <p class="mt-3 max-w-xl text-[15px] leading-relaxed text-neutral-600">
              Discover open-source alternatives to the apps you pay for — curated, with quality
              signals, install in one click from the desktop app.
            </p>
          </div>
          <a
            :href="RELEASES_URL"
            target="_blank"
            class="hidden shrink-0 rounded-xl bg-neutral-900 px-5 py-3 text-[14px] font-semibold text-white transition hover:bg-neutral-700 sm:block"
          >
            Get the desktop app
          </a>
        </div>

        <!-- search -->
        <div class="mt-8 flex max-w-md items-center gap-2 rounded-xl border border-neutral-200 bg-white px-3 py-2.5">
          <svg class="size-4 text-neutral-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3" />
          </svg>
          <input
            v-model="query"
            type="text"
            placeholder="Search apps — e.g. Photoshop, Notion…"
            class="w-full bg-transparent text-[14px] outline-none placeholder:text-neutral-400"
          />
        </div>

        <!-- category chips -->
        <div class="mt-4 flex flex-wrap gap-2">
          <button
            v-for="c in categories"
            :key="c"
            class="rounded-full px-3 py-1 text-[12.5px] font-medium transition"
            :class="
              category === c
                ? 'bg-blue-600 text-white'
                : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'
            "
            @click="category = c"
          >
            {{ c }}
          </button>
        </div>
      </div>
    </header>

    <!-- grid -->
    <main class="mx-auto max-w-6xl px-6 py-10">
      <p v-if="loading" class="text-[14px] text-neutral-500">Loading catalog…</p>
      <p v-else-if="error" class="text-[14px] text-rose-600">Couldn't load the catalog: {{ error }}</p>

      <div v-else class="grid grid-cols-[repeat(auto-fill,minmax(15rem,1fr))] gap-4">
        <button
          v-for="a in visible"
          :key="a.id"
          class="group flex h-44 flex-col justify-between rounded-2xl bg-gradient-to-br p-5 text-left ring-1 ring-black/5 transition-all hover:-translate-y-1 hover:shadow-xl"
          :class="palette(a.id)"
          @click="selected = a"
        >
          <div class="flex items-start justify-between">
            <span class="grid size-12 place-items-center overflow-hidden rounded-2xl bg-white/80 shadow-sm ring-1 ring-black/5">
              <img v-if="a.icon" :src="a.icon" alt="" class="size-9 object-contain" />
            </span>
            <span v-if="a.category" class="rounded-full bg-white/70 px-2 py-0.5 text-[10px] font-semibold text-neutral-600">
              {{ a.category }}
            </span>
          </div>
          <div>
            <h3 class="text-[17px] font-bold tracking-tight">{{ a.name }}</h3>
            <p v-if="a.replaces?.length" class="mt-0.5 text-[12px] font-medium text-neutral-500">
              replaces {{ a.replaces.join(', ') }}
            </p>
            <p class="mt-1 line-clamp-2 text-[12.5px] leading-snug text-neutral-600">{{ a.description }}</p>
          </div>
        </button>
      </div>
    </main>

    <!-- detail modal -->
    <div v-if="selected" class="fixed inset-0 z-50 flex items-center justify-center p-6" @click.self="selected = null">
      <div class="absolute inset-0 bg-black/40 backdrop-blur-sm" @click="selected = null" />
      <div class="relative flex max-h-[84vh] w-full max-w-2xl flex-col overflow-hidden rounded-3xl bg-white shadow-2xl">
        <div class="bg-gradient-to-br p-6" :class="palette(selected.id)">
          <button class="absolute right-4 top-4 grid size-8 place-items-center rounded-full bg-white/70 hover:bg-white" @click="selected = null">
            <svg class="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6 6 18M6 6l12 12" /></svg>
          </button>
          <div class="flex items-center gap-4">
            <span class="grid size-16 place-items-center overflow-hidden rounded-2xl bg-white/85 shadow ring-1 ring-black/5">
              <img v-if="selected.icon" :src="selected.icon" alt="" class="size-12 object-contain" />
            </span>
            <div>
              <h2 class="text-2xl font-bold tracking-tight">{{ selected.name }}</h2>
              <p class="text-[13px] text-neutral-600">{{ selected.author || 'Open source' }} · v{{ selected.version }}</p>
              <p v-if="stars(selected)" class="mt-1 text-[12px] text-neutral-700">★ {{ stars(selected) }}</p>
            </div>
          </div>
          <div v-if="selected.replaces?.length" class="mt-4 flex flex-wrap gap-1.5">
            <span class="text-[11px] font-medium text-neutral-600">Replaces</span>
            <span v-for="r in selected.replaces" :key="r" class="rounded-full bg-white/70 px-2 py-0.5 text-[11px] font-medium">{{ r }}</span>
          </div>
        </div>

        <div class="min-h-0 flex-1 overflow-y-auto px-6 py-5">
          <img v-if="selected.images?.length" :src="selected.images[0]" alt="" class="mb-4 w-full rounded-xl ring-1 ring-neutral-200" />
          <p v-if="selected.description" class="mb-4 text-[13.5px] leading-relaxed text-neutral-700">{{ selected.description }}</p>

          <h4 class="mb-2 text-[11px] font-semibold uppercase tracking-wide text-neutral-400">Install</h4>
          <div v-if="installLines(selected).length" class="space-y-2">
            <div v-for="l in installLines(selected)" :key="l.label">
              <p class="text-[11px] text-neutral-500">{{ l.label }}</p>
              <code class="mt-0.5 block rounded-lg bg-neutral-900 px-3 py-2 text-[12.5px] text-neutral-100">{{ l.cmd }}</code>
            </div>
          </div>
          <p v-else class="text-[13px] text-neutral-500">
            Available as a direct download — install in one click from the
            <a :href="RELEASES_URL" target="_blank" class="font-semibold text-blue-600">desktop app</a>.
          </p>

          <a
            v-if="selected.metrics?.repo"
            :href="selected.metrics.repo"
            target="_blank"
            class="mt-5 inline-block text-[13px] font-semibold text-blue-600"
          >
            View source →
          </a>
        </div>
      </div>
    </div>
  </div>
</template>
