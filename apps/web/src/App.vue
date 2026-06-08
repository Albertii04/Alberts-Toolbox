<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { RESOLVED_CATALOG_URL, type ResolvedApp } from '@openappstore/sdk'

const RELEASES_URL = 'https://github.com/Albertii04/open-app-store/releases/latest'

const apps = ref<ResolvedApp[]>([])
const loading = ref(true)
const error = ref('')
const query = ref('')
const category = ref('All')
const selected = ref<ResolvedApp | null>(null)
const searchEl = ref<HTMLInputElement | null>(null)

const PALETTES = [
  'from-sky-200 to-sky-50',
  'from-amber-200 to-amber-50',
  'from-rose-200 to-rose-50',
  'from-indigo-200 to-indigo-50',
  'from-emerald-200 to-emerald-50',
  'from-violet-200 to-violet-50',
  'from-orange-200 to-orange-50',
  'from-cyan-200 to-cyan-50',
  'from-fuchsia-200 to-fuchsia-50',
  'from-teal-200 to-teal-50',
]
function palette(id: string): string {
  let h = 0
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0
  return PALETTES[h % PALETTES.length]
}

const categories = computed(() => {
  const counts = new Map<string, number>()
  for (const a of apps.value) {
    const c = a.category || 'Other'
    counts.set(c, (counts.get(c) ?? 0) + 1)
  }
  return [
    { name: 'All', count: apps.value.length },
    ...[...counts.entries()].sort().map(([name, count]) => ({ name, count })),
  ]
})

const filtered = computed(() => {
  let list = apps.value
  if (category.value !== 'All') list = list.filter((a) => (a.category || 'Other') === category.value)
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

const showFeatured = computed(() => category.value === 'All' && !query.value.trim())
const featured = computed(() =>
  [...apps.value].sort((a, b) => (b.metrics?.stars ?? 0) - (a.metrics?.stars ?? 0)).slice(0, 3),
)

function stars(a: ResolvedApp): string | null {
  const n = a.metrics?.stars
  if (!n) return null
  return n >= 1000 ? (n / 1000).toFixed(1).replace(/\.0$/, '') + 'k' : String(n)
}

function platforms(a: ResolvedApp): string[] {
  const s = new Set<string>()
  const i = a.installers ?? {}
  if (i.brew) s.add('macOS')
  if (i.winget || i.scoop) s.add('Windows')
  if (i.flatpak) s.add('Linux')
  for (const k of Object.keys(a.downloads ?? {})) {
    if (k.startsWith('darwin')) s.add('macOS')
    if (k.startsWith('win32')) s.add('Windows')
    if (k.startsWith('linux')) s.add('Linux')
  }
  if (a.kind === 'web') s.add('In-app')
  return [...s]
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

function onKey(e: KeyboardEvent): void {
  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
    e.preventDefault()
    searchEl.value?.focus()
  }
  if (e.key === 'Escape') selected.value = null
}

onMounted(async () => {
  window.addEventListener('keydown', onKey)
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
  <div class="min-h-screen bg-[#fbfbfd] text-neutral-900">
    <!-- top nav -->
    <nav class="sticky top-0 z-30 border-b border-neutral-200/70 bg-white/80 backdrop-blur-xl">
      <div class="mx-auto flex h-14 max-w-7xl items-center gap-6 px-6">
        <a class="flex items-center gap-2.5" href="#">
          <img src="/favicon.svg" alt="" class="size-7 rounded-lg" />
          <span class="text-[15px] font-bold tracking-tight">Open App Store</span>
        </a>
        <div class="hidden gap-5 text-[13px] font-medium text-neutral-500 sm:flex">
          <a class="text-neutral-900" href="#">Store</a>
          <a class="transition hover:text-neutral-900" :href="RELEASES_URL" target="_blank">Desktop app</a>
          <a class="transition hover:text-neutral-900" href="https://github.com/Albertii04/open-app-store" target="_blank">GitHub</a>
        </div>
        <div class="flex-1" />
        <a
          :href="RELEASES_URL"
          target="_blank"
          class="rounded-lg bg-gradient-to-br from-blue-600 to-violet-600 px-4 py-1.5 text-[13px] font-semibold text-white shadow-sm transition hover:opacity-90"
        >
          Get the app
        </a>
      </div>
    </nav>

    <!-- hero -->
    <section class="relative overflow-hidden border-b border-neutral-200/70 bg-white">
      <div class="pointer-events-none absolute -left-24 -top-24 size-96 rounded-full bg-blue-400/20 blur-3xl" />
      <div class="pointer-events-none absolute -right-16 top-10 size-80 rounded-full bg-violet-400/20 blur-3xl" />
      <div class="relative mx-auto max-w-7xl px-6 py-16 text-center">
        <h1 class="mx-auto max-w-3xl text-4xl font-extrabold leading-tight tracking-tight sm:text-5xl">
          Replace the apps you
          <span class="bg-gradient-to-r from-blue-600 to-violet-600 bg-clip-text text-transparent">pay for</span>.
        </h1>
        <p class="mx-auto mt-4 max-w-xl text-[15px] leading-relaxed text-neutral-500">
          A curated store of open-source alternatives — install in one click, no lock-in.
        </p>
        <div class="mx-auto mt-8 flex max-w-lg items-center gap-2 rounded-2xl border border-neutral-200 bg-white px-4 py-3 shadow-sm ring-1 ring-black/[0.02] focus-within:border-violet-300 focus-within:ring-violet-200">
          <svg class="size-5 text-neutral-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3" />
          </svg>
          <input
            ref="searchEl"
            v-model="query"
            type="text"
            placeholder="Search — Photoshop, Notion, AirDrop…"
            class="w-full bg-transparent text-[14px] outline-none placeholder:text-neutral-400"
          />
          <kbd class="hidden rounded-md border border-neutral-200 bg-neutral-50 px-1.5 py-0.5 text-[11px] font-medium text-neutral-400 sm:block">⌘K</kbd>
        </div>
      </div>
    </section>

    <!-- body -->
    <div class="mx-auto flex max-w-7xl gap-8 px-6 py-10">
      <!-- sidebar -->
      <aside class="sticky top-24 hidden h-max w-52 shrink-0 md:block">
        <p class="px-3 pb-2 text-[11px] font-semibold uppercase tracking-wider text-neutral-400">Categories</p>
        <button
          v-for="c in categories"
          :key="c.name"
          class="flex w-full items-center justify-between rounded-lg px-3 py-2 text-[13px] font-medium transition"
          :class="category === c.name ? 'bg-violet-50 text-violet-700' : 'text-neutral-600 hover:bg-neutral-100'"
          @click="category = c.name"
        >
          <span>{{ c.name }}</span>
          <span class="text-[11px] tabular-nums" :class="category === c.name ? 'text-violet-400' : 'text-neutral-400'">{{ c.count }}</span>
        </button>
      </aside>

      <!-- content -->
      <div class="min-w-0 flex-1">
        <p v-if="loading" class="text-[14px] text-neutral-500">Loading catalog…</p>
        <p v-else-if="error" class="text-[14px] text-rose-600">Couldn't load the catalog: {{ error }}</p>

        <template v-else>
          <!-- featured -->
          <section v-if="showFeatured && featured.length" class="mb-10">
            <h2 class="mb-4 text-[15px] font-bold tracking-tight">Featured</h2>
            <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <button
                v-for="a in featured"
                :key="a.id"
                class="group flex h-40 flex-col justify-between rounded-2xl bg-gradient-to-br p-5 text-left ring-1 ring-black/5 transition-all hover:-translate-y-1 hover:shadow-xl"
                :class="palette(a.id)"
                @click="selected = a"
              >
                <span class="grid size-14 place-items-center overflow-hidden rounded-2xl bg-white/85 shadow-sm ring-1 ring-black/5">
                  <img v-if="a.icon" :src="a.icon" alt="" class="size-10 object-contain" />
                  <span v-else class="text-[22px] font-bold text-neutral-400">{{ a.name.charAt(0) }}</span>
                </span>
                <div>
                  <h3 class="text-[18px] font-bold tracking-tight">{{ a.name }}</h3>
                  <p class="line-clamp-1 text-[12.5px] text-neutral-600">{{ a.description }}</p>
                </div>
              </button>
            </div>
          </section>

          <!-- catalog -->
          <div class="mb-4 flex items-baseline justify-between">
            <h2 class="text-[15px] font-bold tracking-tight">{{ category === 'All' ? 'All apps' : category }}</h2>
            <span class="text-[12px] text-neutral-400">{{ filtered.length }} app{{ filtered.length === 1 ? '' : 's' }}</span>
          </div>

          <div class="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            <button
              v-for="a in filtered"
              :key="a.id"
              class="group flex gap-3.5 rounded-2xl border border-neutral-200 bg-white p-4 text-left transition-all hover:-translate-y-0.5 hover:border-neutral-300 hover:shadow-lg"
              @click="selected = a"
            >
              <span
                class="grid size-14 shrink-0 place-items-center overflow-hidden rounded-2xl bg-gradient-to-br ring-1 ring-black/5"
                :class="palette(a.id)"
              >
                <img v-if="a.icon" :src="a.icon" alt="" class="size-9 object-contain" />
                <span v-else class="text-[20px] font-bold text-neutral-500">{{ a.name.charAt(0) }}</span>
              </span>
              <div class="min-w-0 flex-1">
                <div class="flex items-center gap-2">
                  <h3 class="truncate text-[15px] font-bold tracking-tight">{{ a.name }}</h3>
                  <span v-if="stars(a)" class="shrink-0 text-[11px] font-medium text-neutral-400">★ {{ stars(a) }}</span>
                </div>
                <p v-if="a.replaces?.length" class="truncate text-[11.5px] font-medium text-violet-600">
                  replaces {{ a.replaces.join(', ') }}
                </p>
                <p class="mt-1 line-clamp-2 text-[12.5px] leading-snug text-neutral-500">{{ a.description }}</p>
                <div class="mt-2 flex flex-wrap gap-1">
                  <span
                    v-for="p in platforms(a)"
                    :key="p"
                    class="rounded-md bg-neutral-100 px-1.5 py-0.5 text-[10px] font-medium text-neutral-500"
                  >{{ p }}</span>
                </div>
              </div>
            </button>
          </div>
        </template>
      </div>
    </div>

    <footer class="border-t border-neutral-200/70 py-8 text-center text-[12px] text-neutral-400">
      Open App Store · open-source, no lock-in ·
      <a class="font-medium text-neutral-500 hover:text-neutral-700" href="https://github.com/Albertii04/open-app-store" target="_blank">source</a>
    </footer>

    <!-- detail modal -->
    <div v-if="selected" class="fixed inset-0 z-50 flex items-center justify-center p-6" @click.self="selected = null">
      <div class="absolute inset-0 bg-black/40 backdrop-blur-sm" @click="selected = null" />
      <div class="relative flex max-h-[84vh] w-full max-w-2xl flex-col overflow-hidden rounded-3xl bg-white shadow-2xl">
        <div class="relative bg-gradient-to-br p-6" :class="palette(selected.id)">
          <button class="absolute right-4 top-4 grid size-8 place-items-center rounded-full bg-white/70 hover:bg-white" @click="selected = null">
            <svg class="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6 6 18M6 6l12 12" /></svg>
          </button>
          <div class="flex items-center gap-4">
            <span class="grid size-16 place-items-center overflow-hidden rounded-2xl bg-white/85 shadow ring-1 ring-black/5">
              <img v-if="selected.icon" :src="selected.icon" alt="" class="size-12 object-contain" />
              <span v-else class="text-2xl font-bold text-neutral-400">{{ selected.name.charAt(0) }}</span>
            </span>
            <div>
              <h2 class="text-2xl font-bold tracking-tight">{{ selected.name }}</h2>
              <p class="text-[13px] text-neutral-600">{{ selected.author || 'Open source' }} · v{{ selected.version }}</p>
              <div class="mt-1 flex items-center gap-3 text-[12px] text-neutral-700">
                <span v-if="stars(selected)">★ {{ stars(selected) }}</span>
                <span v-for="p in platforms(selected)" :key="p" class="rounded bg-white/60 px-1.5 py-0.5 text-[11px]">{{ p }}</span>
              </div>
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

          <a v-if="selected.metrics?.repo" :href="selected.metrics.repo" target="_blank" class="mt-5 inline-block text-[13px] font-semibold text-blue-600">
            View source →
          </a>
        </div>
      </div>
    </div>
  </div>
</template>
