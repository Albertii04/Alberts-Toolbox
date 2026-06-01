<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import type { ToolSummary } from '../shared/types'

type View = 'home' | 'market'

const tools = ref<ToolSummary[]>([])
const activeId = ref<string | null>(null)
const view = ref<View>('home')

// Neutral fallback icon for tools that ship without one.
const fallbackIcon =
  '<svg viewBox="0 0 64 64" width="64" height="64"><rect width="64" height="64" rx="3" fill="#2f3e5f"/></svg>'

const installed = computed(() => tools.value)

async function refresh(): Promise<void> {
  tools.value = await window.shellApi.listTools()
  activeId.value = await window.shellApi.getActiveToolId()
}

async function openTool(id: string): Promise<void> {
  await window.shellApi.openTool(id)
  activeId.value = id
}

async function goHome(): Promise<void> {
  await window.shellApi.closeActiveTool()
  activeId.value = null
  view.value = 'home'
}

function goMarket(): void {
  view.value = 'market'
  void window.shellApi.closeActiveTool()
  activeId.value = null
}

onMounted(() => {
  void refresh()
  window.shellApi.onToolsChanged(() => void refresh())
})
</script>

<template>
  <div class="app">
    <!-- Sidebar (always visible; tool views never cover it) -->
    <aside class="sidebar">
      <div class="brand">
        <span class="brand-mark">A</span>
        <span class="brand-name">Alberts Toolbox</span>
      </div>

      <nav class="nav">
        <button class="nav-item" :class="{ active: !activeId && view === 'home' }" @click="goHome">
          Inicio
        </button>
        <button class="nav-item" :class="{ active: !activeId && view === 'market' }" @click="goMarket">
          Marketplace
        </button>
      </nav>

      <div class="section-label">Herramientas</div>
      <ul class="tool-list">
        <li v-for="t in installed" :key="t.id">
          <button class="tool-row" :class="{ active: activeId === t.id }" @click="openTool(t.id)">
            <span class="tool-ico" v-html="t.iconSvg ?? fallbackIcon"></span>
            <span class="tool-row-name">{{ t.name }}</span>
            <span v-if="activeId === t.id" class="running-dot" />
          </button>
        </li>
      </ul>

      <div class="sidebar-foot">v0.1.0 · first-party</div>
    </aside>

    <!-- Content area. When a tool is active, its native view covers this. -->
    <main class="content">
      <section v-if="view === 'home'" class="home">
        <header class="content-head">
          <p class="eyebrow">Tu caja de herramientas</p>
          <h1>Inicio</h1>
        </header>
        <div class="grid">
          <button v-for="t in installed" :key="t.id" class="card" @click="openTool(t.id)">
            <span class="card-ico" v-html="t.iconSvg ?? fallbackIcon"></span>
            <span class="card-name">{{ t.name }}</span>
            <span class="card-desc">{{ t.description }}</span>
            <span class="card-caps">
              {{ t.capabilities.length ? t.capabilities.length + ' permisos' : 'sin permisos' }}
            </span>
          </button>
        </div>
      </section>

      <section v-else class="market">
        <header class="content-head">
          <p class="eyebrow">Comunidad</p>
          <h1>Marketplace</h1>
        </header>
        <div class="market-stub">
          <p>
            El marketplace público (instalar tools de la comunidad desde un registro en GitHub)
            llega en una fase posterior. De momento se muestran las herramientas first-party
            incluidas con el shell.
          </p>
          <div class="grid">
            <div v-for="t in installed" :key="t.id" class="card static">
              <span class="card-ico" v-html="t.iconSvg ?? fallbackIcon"></span>
              <span class="card-name">{{ t.name }}</span>
              <span class="card-tag">instalada</span>
            </div>
          </div>
        </div>
      </section>
    </main>
  </div>
</template>
