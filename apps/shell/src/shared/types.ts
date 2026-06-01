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

/** Open tool tabs and which one is focused (null = a shell page is showing). */
export interface TabsState {
  openIds: string[]
  activeId: string | null
}

/** window.shellApi — exposed to the shell renderer only (not to tools). */
export interface ShellApi {
  listTools(): Promise<ToolSummary[]>
  /** Open a tool (creating its tab if needed) and focus it. */
  openTool(id: string): Promise<void>
  /** Focus an already-open tab. */
  activateTool(id: string): Promise<void>
  /** Close a tool's tab. */
  closeTool(id: string): Promise<void>
  /** Show a shell page (home/marketplace); tabs stay open. */
  showHome(): Promise<void>
  reloadActiveTool(): Promise<void>
  getTabs(): Promise<TabsState>
  /** Subscribe to tab changes (open/close/focus). Returns an unsubscribe fn. */
  onTabs(cb: (s: TabsState) => void): () => void
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
