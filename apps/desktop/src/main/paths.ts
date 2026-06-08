import { app } from 'electron'
import { join, resolve } from 'node:path'

/**
 * Where builtin tools live.
 * - dev: the monorepo's apps/tools/ folder (../tools relative to apps/desktop).
 * - packaged: resources/tools/ (copied in by electron-builder extraResources).
 */
export function builtinToolsDir(): string {
  if (app.isPackaged) return join(process.resourcesPath, 'tools')
  return resolve(app.getAppPath(), '../tools')
}

/** Where runtime-installed tools are unpacked (phase: marketplace install). */
export function installedToolsDir(): string {
  return join(app.getPath('userData'), 'tools')
}

/** Per-tool scoped key-value storage root. */
export function storageDir(): string {
  return join(app.getPath('userData'), 'tool-storage')
}
