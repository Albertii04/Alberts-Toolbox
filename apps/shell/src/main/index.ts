import { BrowserWindow, app, ipcMain, nativeTheme, shell } from 'electron'
import { join } from 'node:path'
import windowStateKeeper from 'electron-window-state'
import { installBroker } from './broker.js'
import { stopAuthoring } from './authoring.js'
import { ToolManager } from './tools.js'
import {
  currentPlatformArch,
  installNative,
  listInstalled,
  uninstallNative,
} from './installer.js'
import { getCatalog } from './catalog.js'
import { initAutoUpdater, quitAndInstallUpdate } from './updater.js'
import type { ToolManifest } from '@toolbox/sdk'

const manager = new ToolManager()
let mainWindow: BrowserWindow | null = null

function shellPreloadPath(): string {
  return join(app.getAppPath(), 'out/preload/shell.js')
}

// Only one instance of the app; focus the existing window if launched again.
const gotLock = app.requestSingleInstanceLock()
if (!gotLock) {
  app.quit()
}

async function createWindow(): Promise<void> {
  // Remember window size/position across launches.
  const state = windowStateKeeper({ defaultWidth: 1280, defaultHeight: 800 })

  const win = new BrowserWindow({
    x: state.x,
    y: state.y,
    width: state.width,
    height: state.height,
    minWidth: 940,
    minHeight: 600,
    backgroundColor: nativeTheme.shouldUseDarkColors ? '#0a0a0a' : '#fafafa',
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    show: false,
    webPreferences: {
      preload: shellPreloadPath(),
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  state.manage(win)
  mainWindow = win
  manager.attach(win)
  win.once('ready-to-show', () => win.show())

  // The shell UI never opens windows or navigates away; route any attempt
  // (e.g. an external link) to the OS browser and block in-app navigation.
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:/.test(url)) void shell.openExternal(url)
    return { action: 'deny' }
  })
  win.webContents.on('will-navigate', (e, url) => {
    const devUrl = process.env.ELECTRON_RENDERER_URL
    if (devUrl && url.startsWith(devUrl)) return
    e.preventDefault()
  })

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
  ipcMain.handle('shell:activateTool', (_e, id: string) => manager.activate(id))
  ipcMain.handle('shell:closeTool', (_e, id: string) => manager.closeTab(id))
  ipcMain.handle('shell:showHome', () => manager.showHome())
  ipcMain.handle('shell:reloadActiveTool', () => manager.reloadActive())
  ipcMain.handle('shell:getTabs', () => manager.tabs())

  // ---- catalog + native app installer ----
  ipcMain.handle('shell:catalog', () => getCatalog())
  ipcMain.handle('shell:installer:platform', () => currentPlatformArch())
  ipcMain.handle('shell:installer:list', () => listInstalled())
  ipcMain.handle('shell:installer:install', (_e, manifest: ToolManifest) =>
    installNative(manifest, (p) => mainWindow?.webContents.send('shell:installerProgress', p)),
  )
  ipcMain.handle('shell:installer:uninstall', (_e, id: string) => uninstallNative(id))

  // ---- app auto-update ----
  ipcMain.handle('shell:update:install', () => quitAndInstallUpdate())
}

app.on('second-instance', () => {
  const win = BrowserWindow.getAllWindows()[0]
  if (win) {
    if (win.isMinimized()) win.restore()
    win.focus()
  }
})

app.whenReady().then(async () => {
  installBroker()
  installShellIpc()
  await manager.load()
  await createWindow()
  initAutoUpdater(() => mainWindow)

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) void createWindow()
  })
})

app.on('will-quit', () => stopAuthoring())

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
