<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import {
  House,
  RefreshCw,
  X,
  Loader,
  TriangleAlert,
  Search,
  Compass,
  LayoutGrid,
  Heart,
  Tag,
  Boxes,
  PackageOpen,
} from 'lucide-vue-next'
import type { ToolManifest } from '@toolbox/sdk'
import type { InstallProgress, InstalledApp, TabsState, ToolStatus, ToolSummary } from '../shared/types'
import type { StoreApp } from './store-types'
import AppCard from './components/AppCard.vue'
import AppDetail from './components/AppDetail.vue'

const isMac = navigator.platform.toLowerCase().includes('mac')

const tools = ref<ToolSummary[]>([])
const catalog = ref<StoreApp[]>([])
const installed = ref<InstalledApp[]>([])
const platform = ref('')
const tabs = ref<TabsState>({ tabs: [], activeId: null })
const activeStatus = ref<ToolStatus | null>(null)

const query = ref('')
const nav = ref<string>('discover') // 'discover' | 'myapps' | 'favorites' | 'cat:<name>'
const selected = ref<StoreApp | null>(null)
const progress = ref<Record<string, InstallProgress>>({})
const favs = ref<Set<string>>(new Set())

const FAV_KEY = 'storefront:favs'
const fallbackIcon =
  '<svg viewBox="0 0 64 64" fill="none"><rect width="64" height="64" rx="14" fill="currentColor" opacity="0.12"/><rect x="20" y="20" width="24" height="24" rx="6" fill="currentColor" opacity="0.5"/></svg>'

const activeId = computed(() => tabs.value.activeId)
const iconOf = (toolId: string) => tools.value.find((t) => t.id === toolId)?.iconSvg ?? fallbackIcon

// Merge the resolved catalog with locally-available web tools into one list.
const apps = computed<StoreApp[]>(() => {
  const byId = new Map<string, StoreApp>()
  for (const c of catalog.value) {
    const local = tools.value.find((t) => t.id === c.id)
    byId.set(c.id, { ...c, iconSvg: local?.iconSvg ?? null, isLocalWeb: c.kind === 'web' && !!local })
  }
  for (const t of tools.value) {
    if (byId.has(t.id)) continue
    byId.set(t.id, {
      id: t.id,
      kind: 'web',
      name: t.name,
      version: t.version,
      description: t.description,
      iconSvg: t.iconSvg,
      isLocalWeb: true,
      category: 'Tools',
    })
  }
  return [...byId.values()]
})

const installedMap = computed(() => new Map(installed.value.map((a) => [a.id, a])))
const isInstalled = (a: StoreApp) => installedMap.value.has(a.id)
const isUpdatable = (a: StoreApp) => {
  const rec = installedMap.value.get(a.id)
  return !!rec && rec.version !== a.version
}

const categories = computed(() =>
  [...new Set(apps.value.map((a) => a.category).filter(Boolean) as string[])].sort(),
)

const heading = computed(() => {
  if (nav.value === 'myapps') return 'My Apps'
  if (nav.value === 'favorites') return 'Favorites'
  if (nav.value.startsWith('cat:')) return nav.value.slice(4)
  return 'Discover'
})

const visible = computed(() => {
  let list = apps.value
  if (nav.value === 'myapps') list = list.filter((a) => installedMap.value.has(a.id) || a.isLocalWeb)
  else if (nav.value === 'favorites') list = list.filter((a) => favs.value.has(a.id))
  else if (nav.value.startsWith('cat:')) {
    const c = nav.value.slice(4)
    list = list.filter((a) => a.category === c)
  }
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

function loadFavs(): void {
  try {
    favs.value = new Set(JSON.parse(localStorage.getItem(FAV_KEY) || '[]'))
  } catch {
    favs.value = new Set()
  }
}
function toggleFav(a: StoreApp): void {
  const s = new Set(favs.value)
  s.has(a.id) ? s.delete(a.id) : s.add(a.id)
  favs.value = s
  localStorage.setItem(FAV_KEY, JSON.stringify([...s]))
}

async function refresh(): Promise<void> {
  tools.value = await window.shellApi.listTools()
  tabs.value = await window.shellApi.getTabs()
}
async function refreshStore(): Promise<void> {
  platform.value = await window.shellApi.installerPlatform()
  catalog.value = (await window.shellApi.getCatalog()) as StoreApp[]
  installed.value = await window.shellApi.listInstalled()
}

function manifestOf(a: StoreApp): ToolManifest {
  // JSON-clone to a plain object: Vue reactive proxies (esp. nested `downloads`)
  // do not survive Electron's structured-clone over IPC — they arrive stripped,
  // so the installer would see no download source. Include installers too.
  return JSON.parse(
    JSON.stringify({
      id: a.id,
      name: a.name,
      version: a.version,
      kind: 'native',
      downloads: a.downloads,
      installers: a.installers,
    }),
  ) as ToolManifest
}

async function install(a: StoreApp): Promise<void> {
  try {
    await window.shellApi.installApp(manifestOf(a))
  } catch {
    /* progress event already surfaced the error */
  }
  await refreshStore()
}
async function uninstall(a: StoreApp): Promise<void> {
  await window.shellApi.uninstallApp(a.id)
  await refreshStore()
}
function openTool(toolId: string): void {
  selected.value = null
  activeStatus.value = 'loading'
  void window.shellApi.openTool(toolId)
}
function activateTab(instanceId: string): void {
  void window.shellApi.activateTool(instanceId)
}
function closeTab(instanceId: string): void {
  void window.shellApi.closeTool(instanceId)
}
function reloadTool(): void {
  activeStatus.value = 'loading'
  void window.shellApi.reloadActiveTool()
}
function goHome(): void {
  void window.shellApi.showHome()
}

onMounted(() => {
  loadFavs()
  void refresh()
  void refreshStore()
  window.shellApi.onToolsChanged(() => void refresh())
  window.shellApi.onTabs((s) => {
    tabs.value = s
    if (!s.activeId) activeStatus.value = null
  })
  window.shellApi.onToolStatus((e) => {
    if (e.id === tabs.value.activeId) activeStatus.value = e.status
  })
  window.shellApi.onInstallProgress((p) => {
    progress.value = { ...progress.value, [p.id]: p }
    if (p.phase === 'done') {
      void refreshStore()
      window.setTimeout(() => {
        const { [p.id]: _drop, ...rest } = progress.value
        progress.value = rest
      }, 1500)
    }
  })
})
</script>

<template>
  <div
    class="flex h-screen w-screen flex-col overflow-hidden bg-neutral-50 text-neutral-900 dark:bg-neutral-950 dark:text-neutral-100"
  >
    <!-- window chrome + open tool tabs -->
    <div
      class="drag flex h-10 shrink-0 items-center gap-1 border-b border-neutral-200 pr-2 dark:border-neutral-800"
      :class="isMac ? 'pl-20' : 'pl-2'"
    >
      <button
        class="no-drag grid size-7 shrink-0 place-items-center rounded-md transition-colors"
        :class="
          !activeId
            ? 'bg-neutral-200/80 text-neutral-900 dark:bg-neutral-800 dark:text-white'
            : 'text-neutral-500 hover:bg-neutral-200/70 hover:text-neutral-900 dark:hover:bg-neutral-800 dark:hover:text-white'
        "
        title="Inicio"
        @click="goHome"
      >
        <House class="size-4" />
      </button>

      <TransitionGroup name="tab" tag="div" class="relative flex items-center gap-1 overflow-hidden">
        <button
          v-for="t in tabs.tabs"
          :key="t.instanceId"
          class="tab no-drag group flex max-w-44 items-center gap-2 rounded-md px-2 py-1 text-[12px] transition-colors"
          :class="
            activeId === t.instanceId
              ? 'bg-neutral-200/80 text-neutral-900 dark:bg-neutral-800 dark:text-white'
              : 'text-neutral-500 hover:bg-neutral-200/50 dark:hover:bg-neutral-800/50'
          "
          @click="activateTab(t.instanceId)"
        >
          <span class="grid size-4 shrink-0 place-items-center overflow-hidden" v-html="iconOf(t.toolId)" />
          <span class="truncate">{{ t.title }}</span>
          <span
            class="grid size-4 place-items-center rounded text-neutral-400 hover:bg-neutral-300/60 hover:text-neutral-700 dark:hover:bg-neutral-700 dark:hover:text-white"
            @click.stop="closeTab(t.instanceId)"
          >
            <X class="size-3" />
          </span>
        </button>
      </TransitionGroup>

      <div class="flex-1" />

      <button
        v-if="activeId"
        class="no-drag grid size-7 place-items-center rounded-md text-neutral-500 hover:bg-neutral-200/70 hover:text-neutral-900 dark:hover:bg-neutral-800 dark:hover:text-white"
        title="Recargar"
        @click="reloadTool"
      >
        <RefreshCw class="size-4" />
      </button>
    </div>

    <!-- body -->
    <div class="relative flex-1 overflow-hidden">
      <!-- active tool view -->
      <template v-if="activeId">
        <Transition name="fade">
          <div
            v-if="activeStatus === 'loading'"
            key="loading"
            class="absolute inset-0 flex flex-col items-center justify-center gap-3"
          >
            <Loader class="size-7 animate-spin text-blue-500" />
            <p class="text-[13px] text-neutral-500">Cargando…</p>
          </div>
          <div
            v-else-if="activeStatus === 'crashed'"
            key="crashed"
            class="absolute inset-0 flex flex-col items-center justify-center gap-3 text-center"
          >
            <TriangleAlert class="size-7 text-amber-500" />
            <p class="text-sm font-semibold">La herramienta ha fallado</p>
            <button
              class="mt-1 rounded-lg bg-blue-600 px-4 py-1.5 text-[13px] font-medium text-white hover:bg-blue-700"
              @click="reloadTool"
            >
              Recargar
            </button>
          </div>
        </Transition>
      </template>

      <!-- storefront -->
      <div v-else class="flex h-full">
        <!-- sidebar -->
        <aside
          class="flex w-56 shrink-0 flex-col gap-1 overflow-y-auto border-r border-neutral-200 bg-white/60 px-3 py-4 dark:border-neutral-800 dark:bg-neutral-900/40"
        >
          <div class="mb-3 flex items-center gap-2 px-2">
            <div class="grid size-7 place-items-center rounded-lg bg-gradient-to-br from-blue-500 to-violet-600 text-white shadow-sm">
              <Boxes class="size-4" />
            </div>
            <span class="text-[13px] font-semibold tracking-tight">Toolbox</span>
          </div>

          <button class="nav" :class="{ 'nav-on': nav === 'discover' }" @click="nav = 'discover'">
            <Compass class="size-4" /> Discover
          </button>
          <button class="nav" :class="{ 'nav-on': nav === 'myapps' }" @click="nav = 'myapps'">
            <LayoutGrid class="size-4" /> My Apps
          </button>
          <button class="nav" :class="{ 'nav-on': nav === 'favorites' }" @click="nav = 'favorites'">
            <Heart class="size-4" /> Favorites
          </button>

          <p class="mt-4 px-2 pb-1 text-[10px] font-semibold uppercase tracking-wider text-neutral-400">
            Categories
          </p>
          <button
            v-for="c in categories"
            :key="c"
            class="nav"
            :class="{ 'nav-on': nav === 'cat:' + c }"
            @click="nav = 'cat:' + c"
          >
            <Tag class="size-4" /> {{ c }}
          </button>
        </aside>

        <!-- content -->
        <div class="flex min-w-0 flex-1 flex-col overflow-hidden">
          <!-- top bar -->
          <div class="flex items-center gap-3 border-b border-neutral-200 px-7 py-3 dark:border-neutral-800">
            <div
              class="flex w-full max-w-md items-center gap-2 rounded-xl border border-neutral-200 bg-white px-3 py-2 dark:border-neutral-800 dark:bg-neutral-900"
            >
              <Search class="size-4 text-neutral-400" />
              <input
                v-model="query"
                type="text"
                placeholder="Search apps"
                class="w-full bg-transparent text-[13px] outline-none placeholder:text-neutral-400"
              />
            </div>
            <div class="flex-1" />
            <span v-if="platform" class="rounded-full bg-neutral-100 px-2.5 py-1 text-[11px] font-medium text-neutral-500 dark:bg-neutral-800">
              {{ platform }}
            </span>
            <button
              class="grid size-9 place-items-center rounded-xl text-neutral-400 transition hover:bg-neutral-100 hover:text-neutral-700 dark:hover:bg-neutral-800"
              title="Refresh"
              @click="refreshStore"
            >
              <RefreshCw class="size-4" />
            </button>
          </div>

          <!-- grid -->
          <div class="min-h-0 flex-1 overflow-y-auto px-7 py-6">
            <h1 class="mb-1 text-2xl font-bold tracking-tight">{{ heading }}</h1>
            <p class="mb-6 text-[13px] text-neutral-500">
              Open-source apps to replace the paid ones — install in one click.
            </p>

            <div
              v-if="visible.length"
              class="grid grid-cols-[repeat(auto-fill,minmax(15rem,1fr))] gap-4"
            >
              <AppCard
                v-for="a in visible"
                :key="a.id"
                :app="a"
                :installed="isInstalled(a)"
                :updatable="isUpdatable(a)"
                :favorite="favs.has(a.id)"
                @open="selected = a"
                @toggle-fav="toggleFav(a)"
              />
            </div>

            <div
              v-else
              class="flex max-w-md flex-col items-start gap-2 rounded-xl border border-dashed border-neutral-300 p-7 dark:border-neutral-700"
            >
              <PackageOpen class="size-6 text-neutral-400" />
              <p class="text-[15px] font-semibold">
                {{ query ? 'No results' : 'Nothing here yet' }}
              </p>
              <p class="text-[13px] leading-relaxed text-neutral-500">
                {{ query ? 'Try another search.' : 'The catalog will appear once it loads.' }}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- detail modal -->
    <Transition name="fade">
      <AppDetail
        v-if="selected"
        :app="selected"
        :platform="platform"
        :installed="installedMap.get(selected.id) ?? null"
        :progress="progress[selected.id] ?? null"
        :favorite="favs.has(selected.id)"
        @close="selected = null"
        @install="install(selected!)"
        @uninstall="uninstall(selected!)"
        @open-tool="openTool(selected!.id)"
        @toggle-fav="toggleFav(selected!)"
      />
    </Transition>
  </div>
</template>

<style scoped>
.nav {
  display: flex;
  align-items: center;
  gap: 0.625rem;
  border-radius: 0.625rem;
  padding: 0.5rem 0.625rem;
  font-size: 13px;
  font-weight: 500;
  color: rgb(82 82 82);
  transition: background-color 0.12s, color 0.12s;
}
.nav:hover {
  background: rgb(0 0 0 / 0.04);
  color: rgb(23 23 23);
}
.nav-on,
.nav-on:hover {
  background: rgb(37 99 235 / 0.1);
  color: rgb(37 99 235);
}
:global(.dark) .nav {
  color: rgb(163 163 163);
}
:global(.dark) .nav:hover {
  background: rgb(255 255 255 / 0.06);
  color: white;
}
:global(.dark) .nav-on,
:global(.dark) .nav-on:hover {
  background: rgb(59 130 246 / 0.18);
  color: rgb(96 165 250);
}
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.15s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
