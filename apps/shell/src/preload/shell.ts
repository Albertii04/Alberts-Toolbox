import { contextBridge, ipcRenderer } from 'electron'
import type { ShellApi } from '../shared/types.js'

const api: ShellApi = {
  listTools: () => ipcRenderer.invoke('shell:listTools'),
  openTool: (id) => ipcRenderer.invoke('shell:openTool', id),
  closeActiveTool: () => ipcRenderer.invoke('shell:closeActiveTool'),
  getActiveToolId: () => ipcRenderer.invoke('shell:getActiveToolId'),
  onToolsChanged: (cb) => {
    const listener = (): void => cb()
    ipcRenderer.on('shell:toolsChanged', listener)
    return () => ipcRenderer.removeListener('shell:toolsChanged', listener)
  },
}

contextBridge.exposeInMainWorld('shellApi', api)
