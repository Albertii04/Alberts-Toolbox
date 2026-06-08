/**
 * One-time userData migration across product renames.
 *
 * Electron's userData dir is keyed by the app name, so renaming the product
 * (e.g. "Alberts Toolbox" / @toolbox/shell → "Open App Store" /
 * @openappstore/desktop) points the app at a fresh, empty dir — orphaning the
 * tool storage (presentation list, chats) and the installed-apps record. On
 * startup, if the current userData has no tool-storage, copy it (and the
 * installed-apps record) from the most recent dir we previously shipped under.
 */
import { app } from 'electron'
import { cpSync, readdirSync, statSync } from 'node:fs'
import { join, resolve } from 'node:path'

/** Every name this product's userData has lived under (dev pkg + productNames). */
const KNOWN_NAMES = ['Open App Store', 'Alberts Toolbox', '@toolbox/shell', '@openappstore/desktop']

function listing(dir: string): string[] {
  try {
    return readdirSync(dir)
  } catch {
    return []
  }
}

export function migrateUserData(): void {
  const current = app.getPath('userData')
  if (listing(join(current, 'tool-storage')).length) return // already has data

  const appData = app.getPath('appData')
  let best: string | null = null
  let bestMtime = 0
  for (const name of KNOWN_NAMES) {
    const dir = join(appData, name)
    if (resolve(dir) === resolve(current)) continue
    if (!listing(join(dir, 'tool-storage')).length) continue
    try {
      const m = statSync(join(dir, 'tool-storage')).mtimeMs
      if (m > bestMtime) {
        bestMtime = m
        best = dir
      }
    } catch {
      /* unreadable — skip */
    }
  }
  if (!best) return

  try {
    cpSync(join(best, 'tool-storage'), join(current, 'tool-storage'), { recursive: true })
  } catch {
    /* nothing to migrate */
    return
  }
  try {
    cpSync(join(best, 'installed-apps.json'), join(current, 'installed-apps.json'))
  } catch {
    /* installed-apps record may not exist — fine */
  }
  console.log('[migrate] restored userData from', best)
}
