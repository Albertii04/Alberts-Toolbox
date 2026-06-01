import { BrowserWindow, WebContentsView, app } from 'electron'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { loadToolsFromDir, type LoadedTool } from '@toolbox/tool-host'
import type { ToolSummary } from '../shared/types.js'
import { builtinToolsDir, installedToolsDir } from './paths.js'
import { registerToolView, unregisterToolView } from './broker.js'

/** Width of the shell's left sidebar; tool views fill the area to its right. */
const SIDEBAR_W = 248

function toolPreloadPath(): string {
  return join(app.getAppPath(), 'out/preload/tool.js')
}

export class ToolManager {
  private tools = new Map<string, LoadedTool>()
  private views = new Map<string, WebContentsView>()
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

  open(id: string): void {
    const tool = this.tools.get(id)
    if (!tool || !this.win) return
    if (this.activeId === id) return

    // hide whatever is showing
    if (this.activeId) this.views.get(this.activeId)?.setVisible(false)

    let view = this.views.get(id)
    if (!view) {
      view = new WebContentsView({
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
      registerToolView(view.webContents.id, tool.manifest)
      view.webContents.on('destroyed', () => unregisterToolView(view!.webContents.id))
      this.views.set(id, view)
      void view.webContents.loadURL(tool.entryUrl)
    }

    this.win.contentView.addChildView(view) // (re)adds on top
    this.activeId = id
    view.setVisible(true)
    this.layout()
  }

  closeActive(): void {
    if (!this.activeId) return
    this.views.get(this.activeId)?.setVisible(false)
    this.activeId = null
  }

  /** Reposition the active tool view into the content area beside the sidebar. */
  private layout(): void {
    if (!this.win || !this.activeId) return
    const view = this.views.get(this.activeId)
    if (!view) return
    const { width, height } = this.win.getContentBounds()
    view.setBounds({ x: SIDEBAR_W, y: 0, width: Math.max(0, width - SIDEBAR_W), height })
  }
}
