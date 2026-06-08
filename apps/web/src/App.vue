<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { RESOLVED_CATALOG_URL, type ResolvedApp } from '@openappstore/sdk'

const RELEASES_URL = 'https://github.com/Albertii04/open-app-store/releases/latest'
const SOURCE_URL = 'https://github.com/Albertii04/open-app-store'

const apps = ref<ResolvedApp[]>([])
const loading = ref(true)
const error = ref('')
const query = ref('')
const category = ref('All')
const platform = ref('All')
const sort = ref<'top' | 'new'>('top')
const selected = ref<ResolvedApp | null>(null)
const shot = ref(0)
const searchEl = ref<HTMLInputElement | null>(null)

watch(selected, () => {
  shot.value = 0
  window.scrollTo({ top: 0 })
})

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
function fmtDate(d?: string): string | null {
  if (!d) return null
  return new Date(d).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
}

const categories = computed(() => {
  const counts = new Map<string, number>()
  for (const a of apps.value) counts.set(a.category || 'Other', (counts.get(a.category || 'Other') ?? 0) + 1)
  return [{ name: 'All', count: apps.value.length }, ...[...counts.entries()].sort().map(([name, count]) => ({ name, count }))]
})

const hotIds = computed(
  () => new Set([...apps.value].sort((a, b) => (b.metrics?.stars ?? 0) - (a.metrics?.stars ?? 0)).slice(0, 3).map((a) => a.id)),
)

const filtered = computed(() => {
  let list = apps.value.slice()
  if (category.value !== 'All') list = list.filter((a) => (a.category || 'Other') === category.value)
  if (platform.value !== 'All') list = list.filter((a) => platforms(a).includes(platform.value))
  const q = query.value.trim().toLowerCase()
  if (q)
    list = list.filter(
      (a) =>
        a.name.toLowerCase().includes(q) ||
        (a.description ?? '').toLowerCase().includes(q) ||
        (a.replaces ?? []).some((r) => r.toLowerCase().includes(q)),
    )
  list.sort((a, b) =>
    sort.value === 'top'
      ? (b.metrics?.stars ?? 0) - (a.metrics?.stars ?? 0)
      : new Date(b.metrics?.lastCommit ?? 0).getTime() - new Date(a.metrics?.lastCommit ?? 0).getTime(),
  )
  return list
})

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
    apps.value = (await res.json()).apps ?? []
  } catch (e) {
    error.value = (e as Error).message
  } finally {
    loading.value = false
  }
})
</script>

<template>
  <div class="min-h-screen bg-white text-neutral-900">
    <!-- top nav -->
    <nav class="sticky top-0 z-30 border-b border-neutral-200/70 bg-white/80 backdrop-blur-xl">
      <div class="mx-auto flex h-14 max-w-7xl items-center gap-6 px-6">
        <button class="flex items-center gap-2.5" @click="selected = null">
          <img src="/favicon.svg" alt="" class="size-7 rounded-lg" />
          <span class="text-[15px] font-bold tracking-tight">Open App Store</span>
        </button>
        <div class="flex-1" />
        <a :href="SOURCE_URL" target="_blank" class="hidden text-[13px] font-medium text-neutral-500 transition hover:text-neutral-900 sm:block">GitHub</a>
        <a :href="RELEASES_URL" target="_blank" class="rounded-lg bg-gradient-to-br from-blue-600 to-violet-600 px-4 py-1.5 text-[13px] font-semibold text-white shadow-sm transition hover:opacity-90">
          Get the app
        </a>
      </div>
    </nav>

    <p v-if="loading" class="mx-auto max-w-7xl px-6 py-16 text-[14px] text-neutral-500">Loading catalog…</p>
    <p v-else-if="error" class="mx-auto max-w-7xl px-6 py-16 text-[14px] text-rose-600">Couldn't load the catalog: {{ error }}</p>

    <!-- ===================== APP PAGE ===================== -->
    <main v-else-if="selected" class="mx-auto max-w-5xl px-6 py-10">
      <button class="mb-6 text-[13px] font-medium text-neutral-500 transition hover:text-neutral-900" @click="selected = null">← All apps</button>

      <!-- header -->
      <div class="flex flex-col gap-6 sm:flex-row sm:items-start">
        <span class="grid size-24 shrink-0 place-items-center overflow-hidden rounded-[22px] bg-neutral-50 shadow-sm ring-1 ring-black/5">
          <img v-if="selected.icon" :src="selected.icon" alt="" class="size-20 object-contain" />
          <span v-else class="text-4xl font-bold text-neutral-300">{{ selected.name.charAt(0) }}</span>
        </span>
        <div class="min-w-0 flex-1">
          <div class="flex items-start justify-between gap-4">
            <div>
              <h1 class="text-4xl font-extrabold tracking-tight">{{ selected.name }}</h1>
              <p class="mt-1 text-[15px] text-neutral-500">{{ selected.description }}</p>
            </div>
            <div v-if="stars(selected)" class="shrink-0 text-right">
              <div class="text-2xl font-bold">★ {{ stars(selected) }}</div>
              <div class="text-[12px] text-neutral-400">stars on GitHub</div>
            </div>
          </div>
          <div class="mt-5 flex flex-wrap items-center gap-3">
            <a :href="RELEASES_URL" target="_blank" class="rounded-xl bg-neutral-900 px-6 py-3 text-[14px] font-semibold text-white transition hover:bg-neutral-700">
              Get on desktop
            </a>
            <a v-if="selected.metrics?.repo" :href="selected.metrics.repo" target="_blank" class="text-[14px] font-semibold text-blue-600">View source →</a>
          </div>
          <p class="mt-2 text-[12px] text-neutral-400">
            Open source · free · one-click install in the desktop app.
            <template v-if="selected.replaces?.length"> Replaces {{ selected.replaces.join(', ') }}.</template>
          </p>
        </div>
      </div>

      <!-- screenshots carousel -->
      <div v-if="selected.images?.length" class="mt-9">
        <div class="overflow-hidden rounded-2xl ring-1 ring-neutral-200">
          <img :src="selected.images[shot]" alt="" class="max-h-[460px] w-full bg-neutral-50 object-contain" />
        </div>
        <div v-if="selected.images.length > 1" class="mt-3 flex items-center gap-2">
          <button class="grid size-8 place-items-center rounded-full border border-neutral-200 transition hover:bg-neutral-50" @click="shot = (shot - 1 + selected.images.length) % selected.images.length">‹</button>
          <button class="grid size-8 place-items-center rounded-full border border-neutral-200 transition hover:bg-neutral-50" @click="shot = (shot + 1) % selected.images.length">›</button>
          <span class="ml-1 text-[12px] text-neutral-400">{{ shot + 1 }} / {{ selected.images.length }}</span>
        </div>
      </div>

      <!-- spec bar -->
      <div class="mt-9 flex flex-wrap items-center gap-x-10 gap-y-3 rounded-2xl bg-neutral-50 px-6 py-4 text-[13px]">
        <div><span class="text-neutral-400">Platforms</span><div class="font-semibold">{{ platforms(selected).join(' · ') || '—' }}</div></div>
        <div><span class="text-neutral-400">Version</span><div class="font-semibold">v{{ selected.version }}</div></div>
        <div><span class="text-neutral-400">Category</span><div class="font-semibold">{{ selected.category || '—' }}</div></div>
        <div v-if="fmtDate(selected.metrics?.lastCommit)"><span class="text-neutral-400">Updated</span><div class="font-semibold">{{ fmtDate(selected.metrics?.lastCommit) }}</div></div>
      </div>

      <!-- description + install -->
      <div class="mt-9 grid gap-10 md:grid-cols-[1fr_320px]">
        <div>
          <h3 class="mb-2 text-[13px] font-bold uppercase tracking-wide text-neutral-400">About</h3>
          <p class="text-[14px] leading-relaxed text-neutral-700">{{ selected.description }}</p>
          <template v-if="selected.notes">
            <h3 class="mb-2 mt-6 text-[13px] font-bold uppercase tracking-wide text-neutral-400">What's new · v{{ selected.version }}</h3>
            <pre class="max-h-72 overflow-y-auto whitespace-pre-wrap break-words font-sans text-[12.5px] leading-relaxed text-neutral-500">{{ selected.notes.slice(0, 2000) }}</pre>
          </template>
        </div>
        <aside>
          <div class="rounded-2xl border border-neutral-200 p-5">
            <h3 class="mb-3 text-[13px] font-bold">Install</h3>
            <div v-if="installLines(selected).length" class="space-y-3">
              <div v-for="l in installLines(selected)" :key="l.label">
                <p class="text-[11px] text-neutral-500">{{ l.label }}</p>
                <code class="mt-1 block overflow-x-auto rounded-lg bg-neutral-900 px-3 py-2 text-[12px] text-neutral-100">{{ l.cmd }}</code>
              </div>
            </div>
            <p v-else class="text-[13px] text-neutral-500">
              Direct download — one-click install from the
              <a :href="RELEASES_URL" target="_blank" class="font-semibold text-blue-600">desktop app</a>.
            </p>
          </div>
        </aside>
      </div>
    </main>

    <!-- ===================== STORE ===================== -->
    <div v-else class="mx-auto flex max-w-7xl gap-10 px-6 py-10">
      <!-- sidebar -->
      <aside class="sticky top-24 hidden h-max w-48 shrink-0 md:block">
        <button
          v-for="c in categories"
          :key="c.name"
          class="flex w-full items-center justify-between rounded-lg px-3 py-2 text-[14px] font-medium transition"
          :class="category === c.name ? 'bg-neutral-100 text-neutral-900' : 'text-neutral-500 hover:text-neutral-900'"
          @click="category = c.name"
        >
          <span class="flex items-center gap-2">
            <span class="size-2 rotate-45" :class="category === c.name ? 'bg-violet-500' : 'bg-transparent'" />
            {{ c.name }}
          </span>
          <span class="text-[11px] tabular-nums text-neutral-400">{{ c.count }}</span>
        </button>
      </aside>

      <!-- content -->
      <div class="min-w-0 flex-1">
        <div class="mb-6 flex items-center justify-between gap-4">
          <h1 class="text-4xl font-extrabold tracking-tight">{{ category === 'All' ? 'All apps' : category }}</h1>
          <div class="flex items-center gap-2 rounded-2xl border border-neutral-200 bg-white px-3 py-1.5">
            <svg class="size-4 text-neutral-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3" /></svg>
            <input ref="searchEl" v-model="query" type="text" placeholder="Search…" class="w-40 bg-transparent text-[13px] outline-none placeholder:text-neutral-400" />
            <kbd class="hidden rounded border border-neutral-200 bg-neutral-50 px-1 text-[11px] text-neutral-400 sm:block">⌘K</kbd>
          </div>
        </div>

        <!-- filters row -->
        <div class="mb-8 flex flex-wrap items-center justify-between gap-3 border-b border-neutral-100 pb-4">
          <div class="flex gap-2">
            <button
              v-for="p in ['All', 'macOS', 'Windows', 'Linux']"
              :key="p"
              class="rounded-full px-3 py-1 text-[12.5px] font-medium transition"
              :class="platform === p ? 'bg-neutral-900 text-white' : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'"
              @click="platform = p"
            >
              {{ p }}
            </button>
          </div>
          <div class="flex rounded-full bg-neutral-100 p-0.5 text-[12.5px] font-medium">
            <button class="rounded-full px-3 py-1 transition" :class="sort === 'top' ? 'bg-white shadow-sm' : 'text-neutral-500'" @click="sort = 'top'">Top rated</button>
            <button class="rounded-full px-3 py-1 transition" :class="sort === 'new' ? 'bg-white shadow-sm' : 'text-neutral-500'" @click="sort = 'new'">Recent</button>
          </div>
        </div>

        <!-- Setapp-style flat grid -->
        <div class="grid gap-x-10 gap-y-8 sm:grid-cols-2 xl:grid-cols-3">
          <button v-for="a in filtered" :key="a.id" class="group flex gap-4 text-left" @click="selected = a">
            <span class="relative grid size-16 shrink-0 place-items-center overflow-hidden rounded-2xl bg-neutral-50 shadow-sm ring-1 ring-black/5 transition group-hover:-translate-y-0.5 group-hover:shadow-md">
              <img v-if="a.icon" :src="a.icon" alt="" class="size-12 object-contain" />
              <span v-else class="text-2xl font-bold text-neutral-300">{{ a.name.charAt(0) }}</span>
              <span v-if="hotIds.has(a.id)" class="absolute -left-1.5 -top-1.5 rounded-md bg-rose-500 px-1.5 py-0.5 text-[9px] font-bold text-white">Hot</span>
            </span>
            <div class="min-w-0 flex-1 pt-0.5">
              <h3 class="text-[16px] font-bold tracking-tight group-hover:text-violet-700">{{ a.name }}</h3>
              <p class="line-clamp-2 text-[13px] leading-snug text-neutral-500">{{ a.description }}</p>
              <div class="mt-1.5 flex items-center gap-2 text-[12px] text-neutral-400">
                <span v-if="stars(a)">★ {{ stars(a) }}</span>
                <span v-if="a.replaces?.length" class="truncate text-violet-600">· replaces {{ a.replaces[0] }}</span>
              </div>
            </div>
          </button>
        </div>

        <p v-if="!filtered.length" class="py-16 text-center text-[14px] text-neutral-400">No apps match.</p>
      </div>
    </div>

    <footer class="border-t border-neutral-200/70 py-8 text-center text-[12px] text-neutral-400">
      Open App Store · open-source, no lock-in ·
      <a class="font-medium text-neutral-500 hover:text-neutral-700" :href="SOURCE_URL" target="_blank">source</a>
    </footer>
  </div>
</template>
