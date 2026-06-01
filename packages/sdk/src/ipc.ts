/**
 * IPC channel names shared by the shell's main process and the per-tool preload.
 * Every call is namespaced and carries the calling tool's id (injected by the
 * preload from process args) so the broker can authorize it.
 */
export const IPC = {
  fsReadText: 'toolbox:fs.readText',
  fsWriteText: 'toolbox:fs.writeText',
  dialogOpen: 'toolbox:dialog.open',
  dialogSave: 'toolbox:dialog.save',
  shellOpen: 'toolbox:shell.open',
  clipboardRead: 'toolbox:clipboard.read',
  clipboardWrite: 'toolbox:clipboard.write',
  storageGet: 'toolbox:storage.get',
  storageSet: 'toolbox:storage.set',
  storageKeys: 'toolbox:storage.keys',
  storageRemove: 'toolbox:storage.remove',
  netFetch: 'toolbox:net.fetch',
  notify: 'toolbox:notifications.show',
  authoringPreviewUrl: 'toolbox:authoring.previewUrl',
} as const;

/** Error thrown across IPC when the broker denies an ungranted capability. */
export const CAPABILITY_DENIED = 'TOOLBOX_CAPABILITY_DENIED';
