import { BrowserWindow, Notification, clipboard, dialog, ipcMain, shell } from 'electron'
import { readFile, writeFile } from 'node:fs/promises'
import {
  AUTHORING_CHAT_EVENT,
  CAPABILITY_DENIED,
  IPC,
  hasCapability,
  netAllowlist,
  type CapabilityName,
  type ToolManifest,
} from '@toolbox/sdk'
import { toolStorage } from './storage.js'
import { createPresentation, deletePresentation, getPreviewUrl, sendChat } from './authoring.js'

type ToolSource = 'builtin' | 'installed'

/**
 * The capability broker. Maps each tool view's webContents to its manifest, and
 * authorizes every IPC call against that manifest before doing anything native.
 * A call from a tool without the declared capability rejects with
 * CAPABILITY_DENIED — this is the security spine of the whole shell.
 */
const byWc = new Map<number, { manifest: ToolManifest; source: ToolSource }>()

export function registerToolView(
  webContentsId: number,
  manifest: ToolManifest,
  source: ToolSource,
): void {
  byWc.set(webContentsId, { manifest, source })
}

export function unregisterToolView(webContentsId: number): void {
  byWc.delete(webContentsId)
}

function authorize(webContentsId: number, cap: CapabilityName): ToolManifest {
  const entry = byWc.get(webContentsId)
  if (!entry) throw new Error(`${CAPABILITY_DENIED}: unknown caller`)
  if (!hasCapability(entry.manifest, cap))
    throw new Error(`${CAPABILITY_DENIED}: tool "${entry.manifest.id}" did not declare "${cap}"`)
  // 'authoring' is privileged (runs processes); first-party tools only.
  if (cap === 'authoring' && entry.source !== 'builtin')
    throw new Error(`${CAPABILITY_DENIED}: "authoring" is restricted to first-party tools`)
  return entry.manifest
}

function hostAllowed(url: string, allowlist: string[]): boolean {
  let host: string
  try {
    host = new URL(url).hostname
  } catch {
    return false
  }
  return allowlist.some((d) => host === d || host.endsWith(`.${d}`))
}

/** Install all IPC handlers. Call once at startup. */
export function installBroker(): void {
  ipcMain.handle(IPC.fsReadText, (e, path: string) => {
    authorize(e.sender.id, 'fs.read')
    return readFile(path, 'utf8')
  })

  ipcMain.handle(IPC.fsWriteText, async (e, path: string, data: string) => {
    authorize(e.sender.id, 'fs.write')
    await writeFile(path, data, 'utf8')
  })

  ipcMain.handle(IPC.dialogOpen, async (e, opts = {}) => {
    authorize(e.sender.id, 'dialog')
    const win = BrowserWindow.fromWebContents(e.sender) ?? undefined
    const props: Array<'openFile' | 'multiSelections'> = ['openFile']
    if (opts.multi) props.push('multiSelections')
    const res = await dialog.showOpenDialog(win!, {
      title: opts.title,
      filters: opts.filters,
      properties: props,
    })
    return res.canceled ? [] : res.filePaths
  })

  ipcMain.handle(IPC.dialogSave, async (e, opts = {}) => {
    authorize(e.sender.id, 'dialog')
    const win = BrowserWindow.fromWebContents(e.sender) ?? undefined
    const res = await dialog.showSaveDialog(win!, {
      title: opts.title,
      defaultPath: opts.defaultPath,
      filters: opts.filters,
    })
    return res.canceled ? null : (res.filePath ?? null)
  })

  ipcMain.handle(IPC.shellOpen, (e, url: string) => {
    authorize(e.sender.id, 'shell.open')
    if (!/^(https?|mailto|file):/i.test(url)) throw new Error('blocked URL scheme')
    return shell.openExternal(url)
  })

  ipcMain.handle(IPC.clipboardRead, (e) => {
    authorize(e.sender.id, 'clipboard')
    return clipboard.readText()
  })

  ipcMain.handle(IPC.clipboardWrite, (e, text: string) => {
    authorize(e.sender.id, 'clipboard')
    clipboard.writeText(text)
  })

  ipcMain.handle(IPC.storageGet, (e, key: string) => {
    const m = authorize(e.sender.id, 'storage')
    return toolStorage.get(m.id, key)
  })
  ipcMain.handle(IPC.storageSet, (e, key: string, value: unknown) => {
    const m = authorize(e.sender.id, 'storage')
    return toolStorage.set(m.id, key, value)
  })
  ipcMain.handle(IPC.storageKeys, (e) => {
    const m = authorize(e.sender.id, 'storage')
    return toolStorage.keys(m.id)
  })
  ipcMain.handle(IPC.storageRemove, (e, key: string) => {
    const m = authorize(e.sender.id, 'storage')
    return toolStorage.remove(m.id, key)
  })

  ipcMain.handle(IPC.netFetch, async (e, url: string, init = {}) => {
    const manifest = authorize(e.sender.id, 'net')
    const allow = netAllowlist(manifest)
    if (!hostAllowed(url, allow))
      throw new Error(`${CAPABILITY_DENIED}: "${url}" not in net allowlist for ${manifest.id}`)
    const res = await fetch(url, {
      method: init.method ?? 'GET',
      headers: init.headers,
      body: init.body,
    })
    const headers: Record<string, string> = {}
    res.headers.forEach((v, k) => (headers[k] = v))
    return { ok: res.ok, status: res.status, headers, body: await res.text() }
  })

  ipcMain.handle(IPC.notify, (e, title: string, body?: string) => {
    authorize(e.sender.id, 'notifications')
    new Notification({ title, body }).show()
  })

  ipcMain.handle(IPC.authoringPreviewUrl, (e) => {
    authorize(e.sender.id, 'authoring')
    return getPreviewUrl()
  })
  ipcMain.handle(IPC.authoringCreate, (e, name: string) => {
    authorize(e.sender.id, 'authoring')
    return createPresentation(name)
  })
  ipcMain.handle(IPC.authoringDelete, (e, id: string) => {
    authorize(e.sender.id, 'authoring')
    return deletePresentation(id)
  })
  ipcMain.handle(IPC.authoringChat, (e, presId: string, message: string) => {
    authorize(e.sender.id, 'authoring')
    return sendChat(presId, message, (ev) => {
      if (!e.sender.isDestroyed()) e.sender.send(AUTHORING_CHAT_EVENT, { presId, ...ev })
    })
  })
}
