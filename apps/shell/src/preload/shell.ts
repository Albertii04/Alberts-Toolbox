import { contextBridge, ipcRenderer } from 'electron'
import type { ShellApi } from '../shared/types.js'

const api: ShellApi = {
  listTools: () => ipcRenderer.invoke('shell:listTools'),
  openTool: (id) => ipcRenderer.invoke('shell:openTool', id),
  reloadActiveTool: () => ipcRenderer.invoke('shell:reloadActiveTool'),
  closeActiveTool: () => ipcRenderer.invoke('shell:closeActiveTool'),
  getActiveToolId: () => ipcRenderer.invoke('shell:getActiveToolId'),
  onToolsChanged: (cb) => {
    const listener = (): void => cb()
    ipcRenderer.on('shell:toolsChanged', listener)
    return () => ipcRenderer.removeListener('shell:toolsChanged', listener)
  },
  onToolStatus: (cb) => {
    const listener = (_e: unknown, payload: Parameters<typeof cb>[0]): void => cb(payload)
    ipcRenderer.on('shell:toolStatus', listener)
    return () => ipcRenderer.removeListener('shell:toolStatus', listener)
  },
}

contextBridge.exposeInMainWorld('shellApi', api)
