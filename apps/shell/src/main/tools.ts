import { BrowserWindow, WebContentsView, app, shell } from 'electron'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { loadToolsFromDir, type LoadedTool } from '@toolbox/tool-host'
import type { TabsState, ToolStatus, ToolSummary } from '../shared/types.js'
import { builtinToolsDir, installedToolsDir } from './paths.js'
import { registerToolView, unregisterToolView } from './broker.js'

/** Height of the persistent tab bar; tool views sit below it, full width. */
const TABBAR_H = 40

function toolPreloadPath(): string {
  return join(app.getAppPath(), 'out/preload/tool.js')
}

interface Instance {
  instanceId: string
  toolId: string
  view: WebContentsView
  loaded: boolean
  title: string
}

/**
 * Hosts tools as browser-style tabs. Each open is a fresh INSTANCE (its own
 * WebContentsView), so a tool can be opened many times. The tab bar is always
 * present; the launcher (home) shows when no instance is active.
 */
export class ToolManager {
  private tools = new Map<string, LoadedTool>()
  private instances = new Map<string, Instance>()
  private order: string[] = []
  private counter = 0
  private win: BrowserWindow | null = null
  private activeId: string | null = null

  async load(): Promise<void> {
    this.tools.clear()
    const builtin = await loadToolsFromDir(builtinToolsDir(), 'builtin')
    const installed = await loadToolsFromDir(installedToolsDir(), 'installed')
    for (const t of [...builtin, ...installed]) this.tools.set(t.manifest.id, t)
  }

  attach(win: BrowserWindow): void {
    this.win = win
    win.on('resize', () => this.layout())
  }

  summaries(): ToolSummary[] {
    return [...this.tools.values()].map((t) => ({
      id: t.manifest.id,
      name: t.manifest.name,
      version: t.manifest.version,
      description: t.manifest.description,
      author: t.manifest.author,
      iconSvg: this.readIcon(t),
      capabilities: t.manifest.capabilities ?? [],
      source: t.source,
    }))
  }

  private readIcon(t: LoadedTool): string | null {
    if (!t.manifest.icon) return null
    try {
      return readFileSync(join(t.root, t.manifest.icon), 'utf8')
    } catch {
      return null
    }
  }

  tabs(): TabsState {
    return {
      tabs: this.order.map((id) => {
        const inst = this.instances.get(id)!
        return { instanceId: id, toolId: inst.toolId, title: inst.title }
      }),
      activeId: this.activeId,
    }
  }

  private emitTabs(): void {
    this.win?.webContents.send('shell:tabs', this.tabs())
  }
  private emitStatus(instanceId: string, status: ToolStatus): void {
    this.win?.webContents.send('shell:toolStatus', { id: instanceId, status })
  }

  /** Open a NEW instance of a tool and focus it. */
  open(toolId: string): void {
    const tool = this.tools.get(toolId)
    if (!tool || !this.win) return
    const instanceId = `${toolId}#${++this.counter}`
    const view = this.createView(instanceId, tool)
    this.instances.set(instanceId, {
      instanceId,
      toolId,
      view,
      loaded: false,
      title: tool.manifest.name,
    })
    this.order.push(instanceId)
    this.activate(instanceId)
  }

  /** Focus an open instance tab. */
  activate(instanceId: string): void {
    if (!this.win || !this.instances.has(instanceId)) return
    for (const inst of this.instances.values())
      if (inst.instanceId !== instanceId) inst.view.setVisible(false)
    this.activeId = instanceId
    const inst = this.instances.get(instanceId)!
    this.win.contentView.addChildView(inst.view) // bring to top
    if (inst.loaded) {
      inst.view.setVisible(true)
      this.layout()
      this.emitStatus(instanceId, 'ready')
    } else {
      inst.view.setVisible(false)
      this.emitStatus(instanceId, 'loading')
    }
    this.emitTabs()
  }

  /** Close an instance tab; focus a neighbour or the launcher. */
  closeTab(instanceId: string): void {
    const inst = this.instances.get(instanceId)
    if (!inst) return
    if (this.win) this.win.contentView.removeChildView(inst.view)
    inst.view.webContents.close()
    this.instances.delete(instanceId)
    const idx = this.order.indexOf(instanceId)
    if (idx !== -1) this.order.splice(idx, 1)
    if (this.activeId === instanceId) {
      const next = this.order[idx] ?? this.order[idx - 1] ?? null
      if (next) this.activate(next)
      else this.showHome()
    } else {
      this.emitTabs()
    }
  }

  /** Show the launcher: hide all instances, keep tabs open. */
  showHome(): void {
    for (const inst of this.instances.values()) inst.view.setVisible(false)
    this.activeId = null
    this.emitTabs()
  }

  reloadActive(): void {
    if (!this.activeId) return
    const inst = this.instances.get(this.activeId)
    if (!inst) return
    inst.loaded = false
    inst.view.setVisible(false)
    this.emitStatus(inst.instanceId, 'loading')
    inst.view.webContents.reload()
  }

  private createView(instanceId: string, tool: LoadedTool): WebContentsView {
    const view = new WebContentsView({
      webPreferences: {
        preload: toolPreloadPath(),
        sandbox: true,
        contextIsolation: true,
        nodeIntegration: false,
        additionalArguments: [
          `--toolbox-id=${tool.manifest.id}`,
          `--toolbox-name=${tool.manifest.name}`,
          `--toolbox-version=${tool.manifest.version}`,
        ],
      },
    })
    const wc = view.webContents
    registerToolView(wc.id, tool.manifest, tool.source)
    wc.on('destroyed', () => unregisterToolView(wc.id))

    // A tool may open its own windows (e.g. the Presenter audience/console).
    // Allow same-origin file:// and the local authoring dev server (so the
    // presenter window stays in Electron and syncs); route other URLs to the OS.
    wc.setWindowOpenHandler(({ url }) => {
      if (url.startsWith('file://') || /^https?:\/\/localhost(:\d+)?\//.test(url))
        return { action: 'allow' }
      if (/^https?:/.test(url)) void shell.openExternal(url)
      return { action: 'deny' }
    })
    wc.on('will-navigate', (e, url) => {
      if (url.startsWith('file://')) return
      e.preventDefault()
      if (/^https?:/.test(url)) void shell.openExternal(url)
    })

    // Tab title follows the instance's document title.
    wc.on('page-title-updated', (_e, title) => {
      const inst = this.instances.get(instanceId)
      if (inst && title) {
        inst.title = title
        this.emitTabs()
      }
    })

    // Hidden until loaded so the shell can show a loading state underneath.
    wc.on('did-finish-load', () => {
      const inst = this.instances.get(instanceId)
      if (!inst) return
      inst.loaded = true
      if (this.activeId === instanceId) {
        inst.view.setVisible(true)
        this.layout()
        this.emitStatus(instanceId, 'ready')
      }
    })
    wc.on('render-process-gone', () => {
      const inst = this.instances.get(instanceId)
      if (!inst) return
      inst.loaded = false
      inst.view.setVisible(false)
      if (this.activeId === instanceId) this.emitStatus(instanceId, 'crashed')
    })

    if (this.win) this.win.contentView.addChildView(view)
    view.setVisible(false)
    this.emitStatus(instanceId, 'loading')
    void wc.loadURL(tool.entryUrl)
    return view
  }

  /** Position the active instance view full-width below the tab bar. */
  private layout(): void {
    if (!this.win || !this.activeId) return
    const inst = this.instances.get(this.activeId)
    if (!inst) return
    const { width, height } = this.win.getContentBounds()
    inst.view.setBounds({ x: 0, y: TABBAR_H, width, height: Math.max(0, height - TABBAR_H) })
  }
}
