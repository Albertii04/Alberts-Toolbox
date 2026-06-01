import { BrowserWindow, WebContentsView, app, shell } from 'electron'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { loadToolsFromDir, type LoadedTool } from '@toolbox/tool-host'
import type { TabsState, ToolStatus, ToolSummary } from '../shared/types.js'
import { builtinToolsDir, installedToolsDir } from './paths.js'
import { registerToolView, unregisterToolView } from './broker.js'

/** Width of the shell's left sidebar (matches the renderer's w-64). */
const SIDEBAR_W = 256
/** Height of the tab bar; tool views sit below it. */
const TABBAR_H = 40

function toolPreloadPath(): string {
  return join(app.getAppPath(), 'out/preload/tool.js')
}

/**
 * Hosts tools as Figma-style tabs: one tab (and one WebContentsView) per open
 * tool. Switching shows that tab's view and hides the others; the shell pages
 * (home/marketplace) hide all of them while the tabs stay open.
 */
export class ToolManager {
  private tools = new Map<string, LoadedTool>()
  private views = new Map<string, WebContentsView>()
  private loaded = new Set<string>()
  private openOrder: string[] = []
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
    return { openIds: [...this.openOrder], activeId: this.activeId }
  }

  private emitTabs(): void {
    this.win?.webContents.send('shell:tabs', this.tabs())
  }
  private emitStatus(id: string, status: ToolStatus): void {
    this.win?.webContents.send('shell:toolStatus', { id, status })
  }

  /** Open a tool (creating its tab if needed) and focus it. */
  open(id: string): void {
    if (!this.tools.get(id) || !this.win) return
    if (!this.openOrder.includes(id)) {
      this.ensureView(id)
      this.openOrder.push(id)
    }
    this.activate(id)
  }

  /** Focus an already-open tab. */
  activate(id: string): void {
    if (!this.win || !this.openOrder.includes(id)) return
    for (const [otherId, v] of this.views) if (otherId !== id) v.setVisible(false)
    this.activeId = id
    const view = this.views.get(id)
    if (view) {
      this.win.contentView.addChildView(view) // bring to top
      if (this.loaded.has(id)) {
        view.setVisible(true)
        this.layout()
        this.emitStatus(id, 'ready')
      } else {
        view.setVisible(false)
        this.emitStatus(id, 'loading')
      }
    }
    this.emitTabs()
  }

  /** Close a tab, destroying its view; focus a neighbour or the home page. */
  closeTab(id: string): void {
    const view = this.views.get(id)
    if (view && this.win) this.win.contentView.removeChildView(view)
    view?.webContents.close()
    this.views.delete(id)
    this.loaded.delete(id)
    const idx = this.openOrder.indexOf(id)
    if (idx !== -1) this.openOrder.splice(idx, 1)
    if (this.activeId === id) {
      const next = this.openOrder[idx] ?? this.openOrder[idx - 1] ?? null
      if (next) this.activate(next)
      else this.showHome()
    } else {
      this.emitTabs()
    }
  }

  /** Show a shell page (home/marketplace): hide all tool views, keep tabs open. */
  showHome(): void {
    for (const v of this.views.values()) v.setVisible(false)
    this.activeId = null
    this.emitTabs()
  }

  reloadActive(): void {
    if (!this.activeId) return
    const view = this.views.get(this.activeId)
    if (!view) return
    this.loaded.delete(this.activeId)
    view.setVisible(false)
    this.emitStatus(this.activeId, 'loading')
    view.webContents.reload()
  }

  private ensureView(id: string): void {
    if (this.views.has(id) || !this.win) return
    const tool = this.tools.get(id)
    if (!tool) return

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
    registerToolView(wc.id, tool.manifest)
    wc.on('destroyed', () => unregisterToolView(wc.id))

    // A tool may open its own windows (e.g. the Presenter audience view): allow
    // same-origin file:// windows; route external URLs to the OS browser.
    wc.setWindowOpenHandler(({ url }) => {
      if (url.startsWith('file://')) return { action: 'allow' }
      if (/^https?:/.test(url)) void shell.openExternal(url)
      return { action: 'deny' }
    })
    wc.on('will-navigate', (e, url) => {
      if (url.startsWith('file://')) return
      e.preventDefault()
      if (/^https?:/.test(url)) void shell.openExternal(url)
    })

    // Keep hidden until loaded so the shell can show a loading state underneath.
    wc.on('did-finish-load', () => {
      this.loaded.add(id)
      if (this.activeId === id) {
        view.setVisible(true)
        this.layout()
        this.emitStatus(id, 'ready')
      }
    })
    wc.on('render-process-gone', () => {
      this.loaded.delete(id)
      view.setVisible(false)
      if (this.activeId === id) this.emitStatus(id, 'crashed')
    })

    this.views.set(id, view)
    this.win.contentView.addChildView(view)
    view.setVisible(false)
    this.emitStatus(id, 'loading')
    void wc.loadURL(tool.entryUrl)
  }

  /** Reposition the active tool view into the content area, below the tab bar. */
  private layout(): void {
    if (!this.win || !this.activeId) return
    const view = this.views.get(this.activeId)
    if (!view) return
    const { width, height } = this.win.getContentBounds()
    view.setBounds({
      x: SIDEBAR_W,
      y: TABBAR_H,
      width: Math.max(0, width - SIDEBAR_W),
      height: Math.max(0, height - TABBAR_H),
    })
  }
}
