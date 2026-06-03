/**
 * The `window.toolbox` API surface a tool sees. Injected by the shell's preload
 * via contextBridge. Every method is async and routes through IPC to the
 * capability broker in the main process — calls for undeclared capabilities
 * reject with a CAPABILITY_DENIED error.
 *
 * A pure-web tool can ignore this entirely.
 */

export interface ToolboxMeta {
  /** This tool's manifest id. */
  id: string;
  name: string;
  version: string;
}

export interface OpenDialogOptions {
  title?: string;
  filters?: { name: string; extensions: string[] }[];
  multi?: boolean;
}

export interface SaveDialogOptions {
  title?: string;
  defaultPath?: string;
  filters?: { name: string; extensions: string[] }[];
}

export interface NetFetchInit {
  method?: string;
  headers?: Record<string, string>;
  body?: string;
}

export interface NetFetchResult {
  ok: boolean;
  status: number;
  headers: Record<string, string>;
  body: string;
}

export interface ToolboxApi {
  readonly meta: ToolboxMeta;
  /** capability: fs.read */
  readonly fs: {
    readText(path: string): Promise<string>;
    /** capability: fs.write */
    writeText(path: string, data: string): Promise<void>;
  };
  /** capability: dialog */
  readonly dialog: {
    openFile(opts?: OpenDialogOptions): Promise<string[]>;
    saveFile(opts?: SaveDialogOptions): Promise<string | null>;
  };
  /** capability: shell.open */
  readonly shell: {
    openExternal(url: string): Promise<void>;
  };
  /** capability: clipboard */
  readonly clipboard: {
    readText(): Promise<string>;
    writeText(text: string): Promise<void>;
  };
  /** capability: storage — always scoped to this tool's id, never shared. */
  readonly storage: {
    get<T = unknown>(key: string): Promise<T | null>;
    set(key: string, value: unknown): Promise<void>;
    keys(): Promise<string[]>;
    remove(key: string): Promise<void>;
  };
  /** capability: net — restricted to the manifest's domain allowlist. */
  readonly net: {
    fetch(url: string, init?: NetFetchInit): Promise<NetFetchResult>;
  };
  /** capability: notifications */
  readonly notifications: {
    show(title: string, body?: string): Promise<void>;
  };
  /** capability: authoring — privileged authoring host (dev server, AI editing). */
  readonly authoring: {
    /** URL of the live (HMR) preview dev server; starts it on first call. */
    previewUrl(): Promise<string>;
    /** Scaffold a new code presentation folder; returns its id. */
    createPresentation(name: string): Promise<{ id: string }>;
    /** Remove a presentation folder. */
    deletePresentation(id: string): Promise<void>;
    /** Native folder picker; returns the chosen path or null. */
    pickFolder(): Promise<string | null>;
    /** Copy a folder of reference material into the presentation's source/ dir. */
    attachFolder(presId: string, srcPath: string): Promise<void>;
    /** Send a chat message to the AI editor (Claude Code) for a presentation;
     *  it edits the folder's code. Resolves when the turn finishes. Stream
     *  progress via onChat. */
    sendChat(presId: string, message: string, allowEdits?: boolean): Promise<void>;
    /** Stop the running AI editor turn for a presentation. */
    stopChat(presId: string): Promise<void>;
    /** Subscribe to AI editor chat events. Returns an unsubscribe fn. */
    onChat(cb: (e: AuthoringChatEvent) => void): () => void;
  };
}

export type AuthoringChatKind = 'assistant' | 'tool' | 'done' | 'error';
export interface AuthoringChatEvent {
  presId: string;
  kind: AuthoringChatKind;
  text: string;
}

declare global {
  interface Window {
    toolbox: ToolboxApi;
  }
}
