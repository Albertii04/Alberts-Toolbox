import { contextBridge, ipcRenderer } from 'electron'
import type { ShellApi } from '../shared/types.js'

const api: ShellApi = {
  listTools: () => ipcRenderer.invoke('shell:listTools'),
  openTool: (id) => ipcRenderer.invoke('shell:openTool', id),
  activateTool: (id) => ipcRenderer.invoke('shell:activateTool', id),
  closeTool: (id) => ipcRenderer.invoke('shell:closeTool', id),
  showHome: () => ipcRenderer.invoke('shell:showHome'),
  reloadActiveTool: () => ipcRenderer.invoke('shell:reloadActiveTool'),
  getTabs: () => ipcRenderer.invoke('shell:getTabs'),
  onTabs: (cb) => {
    const listener = (_e: unknown, payload: Parameters<typeof cb>[0]): void => cb(payload)
    ipcRenderer.on('shell:tabs', listener)
    return () => ipcRenderer.removeListener('shell:tabs', listener)
  },
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
  installerPlatform: () => ipcRenderer.invoke('shell:installer:platform'),
  installApp: (manifest) => ipcRenderer.invoke('shell:installer:install', manifest),
  listInstalled: () => ipcRenderer.invoke('shell:installer:list'),
  uninstallApp: (id) => ipcRenderer.invoke('shell:installer:uninstall', id),
  onInstallProgress: (cb) => {
    const listener = (_e: unknown, payload: Parameters<typeof cb>[0]): void => cb(payload)
    ipcRenderer.on('shell:installerProgress', listener)
    return () => ipcRenderer.removeListener('shell:installerProgress', listener)
  },
}

contextBridge.exposeInMainWorld('shellApi', api)
