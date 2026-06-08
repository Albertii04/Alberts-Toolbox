import type { CapabilityRequest, ResolvedApp, ToolManifest } from '@openappstore/sdk'

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

/** One open tool instance (tab). A tool can be opened multiple times. */
export interface TabInfo {
  instanceId: string
  toolId: string
  title: string
}

/** Open instance tabs and which one is focused (null = the launcher is showing). */
export interface TabsState {
  tabs: TabInfo[]
  activeId: string | null
}

// ---- native app installer (direct-download backend) ----

/** A native app installed on the machine, tracked for "My apps". */
export interface InstalledApp {
  id: string
  name: string
  version: string
  platformArch: string
  format: string
  /** Absolute install location (the .app in /Applications, or the AppImage). */
  location: string
  installedAt: string
}

/** Progress of an in-flight native install, pushed during `installApp`. */
export interface InstallProgress {
  id: string
  phase: 'resolving' | 'downloading' | 'verifying' | 'installing' | 'done' | 'error'
  /** 0–100 during `downloading`. */
  pct?: number
  message?: string
}

/** Auto-update lifecycle, pushed from the main process. */
export interface UpdateStatus {
  phase: 'checking' | 'available' | 'none' | 'downloading' | 'ready' | 'error'
  version?: string
  /** 0–100 during `downloading`. */
  pct?: number
  message?: string
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

  /** Fetch the resolved app catalog (native + web entries). */
  getCatalog(): Promise<ResolvedApp[]>

  // ---- native installer ----
  /** This machine's `<platform>-<arch>`, e.g. "darwin-arm64". */
  installerPlatform(): Promise<string>
  /** Install a native app from its manifest's direct download for this platform. */
  installApp(manifest: ToolManifest): Promise<InstalledApp>
  /** List installed native apps. */
  listInstalled(): Promise<InstalledApp[]>
  /** Uninstall a native app by id. */
  uninstallApp(id: string): Promise<void>
  /** Subscribe to install progress. Returns an unsubscribe fn. */
  onInstallProgress(cb: (p: InstallProgress) => void): () => void

  // ---- app auto-update ----
  /** Subscribe to auto-update status. Returns an unsubscribe fn. */
  onUpdateStatus(cb: (s: UpdateStatus) => void): () => void
  /** Quit and install a downloaded update. */
  installUpdate(): Promise<void>
}

declare global {
  interface Window {
    shellApi: ShellApi
  }
}
