import type { CapabilityRequest } from '@toolbox/sdk'

/** What the shell renderer needs to render a tool in the launcher/marketplace. */
export interface ToolSummary {
  id: string
  name: string
  version: string
  description?: string
  author?: string
  /** Inlined SVG icon markup, or null if the tool has none. */
  iconSvg: string | null
  capabilities: CapabilityRequest[]
  source: 'builtin' | 'installed'
}

/** Lifecycle of the active tool's view. */
export type ToolStatus = 'loading' | 'ready' | 'crashed'
export interface ToolStatusEvent {
  id: string
  status: ToolStatus
}

/** window.shellApi — exposed to the shell renderer only (not to tools). */
export interface ShellApi {
  listTools(): Promise<ToolSummary[]>
  openTool(id: string): Promise<void>
  reloadActiveTool(): Promise<void>
  closeActiveTool(): Promise<void>
  getActiveToolId(): Promise<string | null>
  /** Subscribe to tool-list changes (install/uninstall). Returns an unsubscribe fn. */
  onToolsChanged(cb: () => void): () => void
  /** Subscribe to active-tool lifecycle (loading/ready/crashed). Returns unsubscribe. */
  onToolStatus(cb: (e: ToolStatusEvent) => void): () => void
}

declare global {
  interface Window {
    shellApi: ShellApi
  }
}
