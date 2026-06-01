import { BrowserWindow, app, ipcMain } from 'electron'
import { join } from 'node:path'
import { installBroker } from './broker.js'
import { ToolManager } from './tools.js'

const manager = new ToolManager()

function shellPreloadPath(): string {
  return join(app.getAppPath(), 'out/preload/shell.js')
}

async function createWindow(): Promise<void> {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 940,
    minHeight: 600,
    backgroundColor: '#04060b',
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    show: false,
    webPreferences: {
      preload: shellPreloadPath(),
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  manager.attach(win)
  win.once('ready-to-show', () => win.show())

  const devUrl = process.env.ELECTRON_RENDERER_URL
  if (devUrl && !app.isPackaged) {
    await win.loadURL(devUrl)
  } else {
    await win.loadFile(join(app.getAppPath(), 'out/renderer/index.html'))
  }
}

// ---- shell control IPC (exposed to the shell renderer only, via window.shellApi)
function installShellIpc(): void {
  ipcMain.handle('shell:listTools', () => manager.summaries())
  ipcMain.handle('shell:openTool', (_e, id: string) => manager.open(id))
  ipcMain.handle('shell:closeActiveTool', () => manager.closeActive())
  ipcMain.handle('shell:getActiveToolId', () => manager.getActiveToolId())
}

app.whenReady().then(async () => {
  installBroker()
  installShellIpc()
  await manager.load()
  console.log(`[toolbox] loaded ${manager.summaries().length} tool(s):`,
    manager.summaries().map((t) => t.id).join(', '))
  await createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) void createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
