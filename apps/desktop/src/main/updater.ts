/**
 * Auto-update via GitHub Releases (electron-updater). Reads the published
 * `latest*.yml` for the platform, downloads the new build in the background, and
 * applies it on quit / on demand. Packaged builds only — a no-op in dev.
 *
 * Windows (NSIS) and Linux (AppImage) update unsigned. macOS only applies a
 * signed + notarized update, so the release build signs with the Developer ID
 * (see electron-builder.yml + the release workflow's signing env).
 */
import { app } from 'electron'
import type { BrowserWindow } from 'electron'
import electronUpdater from 'electron-updater'
import type { UpdateStatus } from '../shared/types.js'

const { autoUpdater } = electronUpdater

export function initAutoUpdater(getWindow: () => BrowserWindow | null): void {
  if (!app.isPackaged) return
  const send = (s: UpdateStatus): void => getWindow()?.webContents.send('shell:updateStatus', s)

  autoUpdater.autoDownload = true
  autoUpdater.autoInstallOnAppQuit = true

  autoUpdater.on('checking-for-update', () => send({ phase: 'checking' }))
  autoUpdater.on('update-available', (i) => send({ phase: 'available', version: i.version }))
  autoUpdater.on('update-not-available', () => send({ phase: 'none' }))
  autoUpdater.on('download-progress', (p) =>
    send({ phase: 'downloading', pct: Math.round(p.percent) }),
  )
  autoUpdater.on('update-downloaded', (i) => send({ phase: 'ready', version: i.version }))
  autoUpdater.on('error', (e) => send({ phase: 'error', message: String((e as Error)?.message || e) }))

  autoUpdater.checkForUpdates().catch(() => {
    /* offline / no release yet — ignore */
  })
}

/** Quit and install a downloaded update (called from the renderer's banner). */
export function quitAndInstallUpdate(): void {
  autoUpdater.quitAndInstall()
}
