<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import {
  Boxes,
  House,
  Store,
  Search,
  RefreshCw,
  X,
  Loader,
  TriangleAlert,
  ShieldCheck,
  PackageOpen,
} from 'lucide-vue-next'
import type { ToolStatus, ToolSummary } from '../shared/types'

type View = 'home' | 'market'

const tools = ref<ToolSummary[]>([])
const activeId = ref<string | null>(null)
const activeStatus = ref<ToolStatus | null>(null)
const view = ref<View>('home')
const query = ref('')

const fallbackIcon =
  '<svg viewBox="0 0 64 64" fill="none"><rect width="64" height="64" rx="14" fill="currentColor" opacity="0.12"/><rect x="20" y="20" width="24" height="24" rx="6" fill="currentColor" opacity="0.5"/></svg>'

const filtered = computed(() => {
  const q = query.value.trim().toLowerCase()
  if (!q) return tools.value
  return tools.value.filter(
    (t) => t.name.toLowerCase().includes(q) || (t.description ?? '').toLowerCase().includes(q),
  )
})
const activeTool = computed(() => tools.value.find((t) => t.id === activeId.value) ?? null)

async function refresh(): Promise<void> {
  tools.value = await window.shellApi.listTools()
  activeId.value = await window.shellApi.getActiveToolId()
}

async function openTool(id: string): Promise<void> {
  activeStatus.value = 'loading'
  activeId.value = id
  await window.shellApi.openTool(id)
}
function reloadTool(): void {
  activeStatus.value = 'loading'
  void window.shellApi.reloadActiveTool()
}
async function goHome(): Promise<void> {
  await window.shellApi.closeActiveTool()
  activeId.value = null
  activeStatus.value = null
  view.value = 'home'
}
function goMarket(): void {
  view.value = 'market'
  void window.shellApi.closeActiveTool()
  activeId.value = null
  activeStatus.value = null
}

onMounted(() => {
  void refresh()
  window.shellApi.onToolsChanged(() => void refresh())
  window.shellApi.onToolStatus((e) => {
    if (e.id === activeId.value) activeStatus.value = e.status
  })
})
</script>

<template>
  <div
    class="flex h-screen w-screen overflow-hidden bg-neutral-50 text-neutral-900 dark:bg-neutral-950 dark:text-neutral-100"
  >
    <!-- Sidebar -->
    <aside
      class="flex w-64 shrink-0 flex-col border-r border-neutral-200/80 bg-neutral-100/60 dark:border-neutral-800/80 dark:bg-neutral-900/40"
    >
      <!-- brand (drag region, clears macOS traffic lights) -->
      <div class="drag flex items-center gap-2.5 px-4 pb-3 pt-8">
        <div
          class="grid size-7 place-items-center rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-sm"
        >
          <Boxes class="size-4" />
        </div>
        <span class="text-[13px] font-semibold tracking-tight">Alberts Toolbox</span>
      </div>

      <!-- search -->
      <div class="no-drag px-3 pb-2">
        <div
          class="flex items-center gap-2 rounded-lg border border-neutral-200 bg-white px-2.5 py-1.5 dark:border-neutral-800 dark:bg-neutral-900"
        >
          <Search class="size-3.5 text-neutral-400" />
          <input
            v-model="query"
            type="text"
            placeholder="Buscar herramientas"
            class="w-full bg-transparent text-[13px] outline-none placeholder:text-neutral-400"
          />
        </div>
      </div>

      <!-- nav -->
      <nav class="flex flex-col gap-0.5 px-2 pt-1">
        <button
          class="flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-[13px] font-medium transition-colors"
          :class="
            !activeId && view === 'home'
              ? 'bg-neutral-200/70 text-neutral-900 dark:bg-neutral-800 dark:text-white'
              : 'text-neutral-600 hover:bg-neutral-200/50 dark:text-neutral-400 dark:hover:bg-neutral-800/60'
          "
          @click="goHome"
        >
          <House class="size-4" /> Inicio
        </button>
        <button
          class="flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-[13px] font-medium transition-colors"
          :class="
            !activeId && view === 'market'
              ? 'bg-neutral-200/70 text-neutral-900 dark:bg-neutral-800 dark:text-white'
              : 'text-neutral-600 hover:bg-neutral-200/50 dark:text-neutral-400 dark:hover:bg-neutral-800/60'
          "
          @click="goMarket"
        >
          <Store class="size-4" /> Marketplace
        </button>
      </nav>

      <div
        class="px-3.5 pb-1.5 pt-4 text-[10px] font-semibold uppercase tracking-wider text-neutral-400 dark:text-neutral-500"
      >
        Herramientas
      </div>
      <ul class="flex-1 space-y-0.5 overflow-y-auto px-2">
        <li v-for="t in filtered" :key="t.id">
          <button
            class="flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-[13px] transition-colors"
            :class="
              activeId === t.id
                ? 'bg-neutral-200/70 text-neutral-900 dark:bg-neutral-800 dark:text-white'
                : 'text-neutral-700 hover:bg-neutral-200/50 dark:text-neutral-300 dark:hover:bg-neutral-800/60'
            "
            @click="openTool(t.id)"
          >
            <span
              class="tool-glyph grid size-6 shrink-0 place-items-center overflow-hidden rounded-md bg-white text-neutral-500 ring-1 ring-neutral-200 dark:bg-neutral-800 dark:text-neutral-400 dark:ring-neutral-700"
              v-html="t.iconSvg ?? fallbackIcon"
            ></span>
            <span class="flex-1 truncate text-left">{{ t.name }}</span>
            <span v-if="activeId === t.id" class="size-1.5 rounded-full bg-indigo-500" />
          </button>
        </li>
      </ul>

      <div
        class="border-t border-neutral-200/70 px-3.5 py-2.5 text-[10px] text-neutral-400 dark:border-neutral-800/70 dark:text-neutral-600"
      >
        v0.1.0 · first-party
      </div>
    </aside>

    <!-- Content -->
    <main class="flex flex-1 flex-col overflow-hidden">
      <!-- A tool is open -->
      <template v-if="activeId">
        <div
          class="drag flex h-10 shrink-0 items-center justify-between border-b border-neutral-200 px-3 dark:border-neutral-800"
        >
          <span class="text-[13px] font-medium">{{ activeTool?.name }}</span>
          <div class="no-drag flex items-center gap-1">
            <button
              class="grid size-7 place-items-center rounded-md text-neutral-500 hover:bg-neutral-200/70 hover:text-neutral-900 dark:hover:bg-neutral-800 dark:hover:text-white"
              title="Recargar"
              @click="reloadTool"
            >
              <RefreshCw class="size-4" />
            </button>
            <button
              class="grid size-7 place-items-center rounded-md text-neutral-500 hover:bg-neutral-200/70 hover:text-neutral-900 dark:hover:bg-neutral-800 dark:hover:text-white"
              title="Cerrar"
              @click="goHome"
            >
              <X class="size-4" />
            </button>
          </div>
        </div>
        <div class="relative flex-1">
          <div
            v-if="activeStatus === 'loading'"
            class="absolute inset-0 flex flex-col items-center justify-center gap-3"
          >
            <Loader class="size-7 animate-spin text-indigo-500" />
            <p class="text-[13px] text-neutral-500">Cargando {{ activeTool?.name }}…</p>
          </div>
          <div
            v-else-if="activeStatus === 'crashed'"
            class="absolute inset-0 flex flex-col items-center justify-center gap-3 text-center"
          >
            <TriangleAlert class="size-7 text-amber-500" />
            <p class="text-sm font-semibold">La herramienta ha fallado</p>
            <p class="text-[13px] text-neutral-500">
              El proceso de “{{ activeTool?.name }}” se ha detenido.
            </p>
            <button
              class="mt-1 rounded-lg bg-indigo-500 px-4 py-1.5 text-[13px] font-medium text-white hover:bg-indigo-600"
              @click="reloadTool"
            >
              Recargar
            </button>
          </div>
        </div>
      </template>

      <!-- Home -->
      <section v-else-if="view === 'home'" class="flex-1 overflow-y-auto">
        <div class="drag h-8 w-full shrink-0" />
        <div class="mx-auto max-w-5xl px-8 pb-12">
          <header class="mb-7">
            <p class="mb-1 text-[11px] font-semibold uppercase tracking-wider text-indigo-500">
              Tu caja de herramientas
            </p>
            <h1 class="text-2xl font-semibold tracking-tight">Inicio</h1>
          </header>

          <div
            v-if="filtered.length"
            class="grid grid-cols-[repeat(auto-fill,minmax(13rem,1fr))] gap-3"
          >
            <button
              v-for="t in filtered"
              :key="t.id"
              class="group flex flex-col items-start gap-2 rounded-xl border border-neutral-200 bg-white p-4 text-left transition-all hover:-translate-y-0.5 hover:border-neutral-300 hover:shadow-md dark:border-neutral-800 dark:bg-neutral-900 dark:hover:border-neutral-700"
              @click="openTool(t.id)"
            >
              <span
                class="tool-glyph grid size-11 place-items-center overflow-hidden rounded-lg bg-neutral-100 text-neutral-500 ring-1 ring-neutral-200 dark:bg-neutral-800 dark:text-neutral-400 dark:ring-neutral-700"
                v-html="t.iconSvg ?? fallbackIcon"
              ></span>
              <span class="mt-1 text-[15px] font-semibold tracking-tight">{{ t.name }}</span>
              <span class="line-clamp-2 text-[12px] leading-relaxed text-neutral-500">
                {{ t.description }}
              </span>
              <span
                class="mt-1 inline-flex items-center gap-1 text-[10px] font-medium uppercase tracking-wide text-neutral-400"
              >
                <ShieldCheck class="size-3" />
                {{ t.capabilities.length ? t.capabilities.length + ' permisos' : 'sin permisos' }}
              </span>
            </button>
          </div>

          <div
            v-else
            class="flex max-w-md flex-col items-start gap-2 rounded-xl border border-dashed border-neutral-300 p-7 dark:border-neutral-700"
          >
            <PackageOpen class="size-6 text-neutral-400" />
            <p class="text-[15px] font-semibold">
              {{ query ? 'Sin resultados' : 'No hay herramientas todavía' }}
            </p>
            <p class="text-[13px] leading-relaxed text-neutral-500">
              <template v-if="query">Prueba otra búsqueda.</template>
              <template v-else>
                Copia <code class="text-indigo-500">templates/tool-starter</code> en
                <code class="text-indigo-500">tools/</code>, ajusta su
                <code class="text-indigo-500">toolbox.json</code> y reconstruye.
              </template>
            </p>
          </div>
        </div>
      </section>

      <!-- Marketplace -->
      <section v-else class="flex-1 overflow-y-auto">
        <div class="drag h-8 w-full shrink-0" />
        <div class="mx-auto max-w-5xl px-8 pb-12">
          <header class="mb-7">
            <p class="mb-1 text-[11px] font-semibold uppercase tracking-wider text-indigo-500">
              Comunidad
            </p>
            <h1 class="text-2xl font-semibold tracking-tight">Marketplace</h1>
          </header>
          <p class="mb-6 max-w-xl text-[13px] leading-relaxed text-neutral-500">
            La instalación de herramientas de la comunidad desde un registro en GitHub llega en una
            fase posterior. De momento se muestran las herramientas first-party incluidas.
          </p>
          <div class="grid grid-cols-[repeat(auto-fill,minmax(13rem,1fr))] gap-3">
            <div
              v-for="t in filtered"
              :key="t.id"
              class="flex flex-col items-start gap-2 rounded-xl border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900"
            >
              <span
                class="tool-glyph grid size-11 place-items-center overflow-hidden rounded-lg bg-neutral-100 text-neutral-500 ring-1 ring-neutral-200 dark:bg-neutral-800 dark:text-neutral-400 dark:ring-neutral-700"
                v-html="t.iconSvg ?? fallbackIcon"
              ></span>
              <span class="mt-1 text-[15px] font-semibold tracking-tight">{{ t.name }}</span>
              <span
                class="inline-flex items-center gap-1 rounded-md bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-emerald-600 dark:text-emerald-400"
              >
                Instalada
              </span>
            </div>
          </div>
        </div>
      </section>
    </main>
  </div>
</template>
