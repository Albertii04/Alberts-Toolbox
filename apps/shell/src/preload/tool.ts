import { contextBridge, ipcRenderer } from 'electron'
import { IPC, type ToolboxApi } from '@toolbox/sdk'

/** Tool identity is injected via additionalArguments (see ToolManager.open). */
function arg(prefix: string): string {
  const found = process.argv.find((a) => a.startsWith(prefix))
  return found ? found.slice(prefix.length) : ''
}

const api: ToolboxApi = {
  meta: {
    id: arg('--toolbox-id='),
    name: arg('--toolbox-name='),
    version: arg('--toolbox-version='),
  },
  fs: {
    readText: (path) => ipcRenderer.invoke(IPC.fsReadText, path),
    writeText: (path, data) => ipcRenderer.invoke(IPC.fsWriteText, path, data),
  },
  dialog: {
    openFile: (opts) => ipcRenderer.invoke(IPC.dialogOpen, opts),
    saveFile: (opts) => ipcRenderer.invoke(IPC.dialogSave, opts),
  },
  shell: {
    openExternal: (url) => ipcRenderer.invoke(IPC.shellOpen, url),
  },
  clipboard: {
    readText: () => ipcRenderer.invoke(IPC.clipboardRead),
    writeText: (text) => ipcRenderer.invoke(IPC.clipboardWrite, text),
  },
  storage: {
    get: (key) => ipcRenderer.invoke(IPC.storageGet, key),
    set: (key, value) => ipcRenderer.invoke(IPC.storageSet, key, value),
    keys: () => ipcRenderer.invoke(IPC.storageKeys),
    remove: (key) => ipcRenderer.invoke(IPC.storageRemove, key),
  },
  net: {
    fetch: (url, init) => ipcRenderer.invoke(IPC.netFetch, url, init),
  },
  notifications: {
    show: (title, body) => ipcRenderer.invoke(IPC.notify, title, body),
  },
  authoring: {
    previewUrl: () => ipcRenderer.invoke(IPC.authoringPreviewUrl),
    createPresentation: (name) => ipcRenderer.invoke(IPC.authoringCreate, name),
    deletePresentation: (id) => ipcRenderer.invoke(IPC.authoringDelete, id),
  },
}

contextBridge.exposeInMainWorld('toolbox', api)
