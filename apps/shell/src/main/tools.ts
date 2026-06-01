import { BrowserWindow, WebContentsView, app } from 'electron'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { loadToolsFromDir, type LoadedTool } from '@toolbox/tool-host'
import type { ToolStatus, ToolSummary } from '../shared/types.js'
import { builtinToolsDir, installedToolsDir } from './paths.js'
import { registerToolView, unregisterToolView } from './broker.js'

/** Width of the shell's left sidebar; tool views fill the area to its right. */
const SIDEBAR_W = 248
/** Height of the per-tool top bar (name + reload + close), drawn by the shell. */
const TOPBAR_H = 40

function toolPreloadPath(): string {
  return join(app.getAppPath(), 'out/preload/tool.js')
}

export class ToolManager {
  private tools = new Map<string, LoadedTool>()
  private views = new Map<string, WebContentsView>()
  private loaded = new Set<string>()
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

  getActiveToolId(): string | null {
    return this.activeId
  }

  private emitStatus(id: string, status: ToolStatus): void {
    this.win?.webContents.send('shell:toolStatus', { id, status })
  }

  open(id: string): void {
    const tool = this.tools.get(id)
    if (!tool || !this.win) return
    if (this.activeId === id) return

    // hide whatever is showing
    if (this.activeId) this.views.get(this.activeId)?.setVisible(false)
    this.activeId = id

    const existing = this.views.get(id)
    if (existing) {
      this.win.contentView.addChildView(existing) // bring to top
      if (this.loaded.has(id)) {
        existing.setVisible(true)
        this.layout()
        this.emitStatus(id, 'ready')
      } else {
        existing.setVisible(false)
        this.emitStatus(id, 'loading')
      }
      return
    }

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
    // Keep the view hidden until its content has loaded, so the shell can show a
    // loading state underneath (a native view always paints over the renderer).
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

  reloadActive(): void {
    if (!this.activeId) return
    const view = this.views.get(this.activeId)
    if (!view) return
    this.loaded.delete(this.activeId)
    view.setVisible(false)
    this.emitStatus(this.activeId, 'loading')
    view.webContents.reload()
  }

  closeActive(): void {
    if (!this.activeId) return
    this.views.get(this.activeId)?.setVisible(false)
    this.activeId = null
  }

  /** Reposition the active tool view into the content area beside the sidebar,
   *  below the top bar. */
  private layout(): void {
    if (!this.win || !this.activeId) return
    const view = this.views.get(this.activeId)
    if (!view) return
    const { width, height } = this.win.getContentBounds()
    view.setBounds({
      x: SIDEBAR_W,
      y: TOPBAR_H,
      width: Math.max(0, width - SIDEBAR_W),
      height: Math.max(0, height - TOPBAR_H),
    })
  }
}
