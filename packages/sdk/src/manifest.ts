/**
 * Tool manifest schema + capability model.
 *
 * A tool is a folder with a `toolbox.json` (this shape) and a built web entry.
 * Capabilities are DECLARED here and ENFORCED by the shell's capability broker.
 * Anything not declared is denied at the IPC layer — a pure-web tool (`[]`)
 * can do nothing native.
 */

/** Native capabilities a tool may request. Default deny. */
export const CAPABILITY_NAMES = [
  'fs.read', // read files the user explicitly points at (via dialog or granted paths)
  'fs.write', // write files the user explicitly points at
  'dialog', // open/save native file dialogs
  'shell.open', // open a URL / file in the OS default handler
  'clipboard', // read/write the system clipboard
  'storage', // per-tool scoped key-value persistence (always isolated by tool id)
  'net', // outbound HTTP — REQUIRES an allowlist of domains
  'notifications', // OS notifications
  'gpu', // enable hardware acceleration for this tool's view
] as const;

export type CapabilityName = (typeof CAPABILITY_NAMES)[number];

/**
 * A requested capability. Most are a bare name. `net` must carry an allowlist:
 *   { name: 'net', domains: ['api.openai.com'] }
 */
export type CapabilityRequest =
  | Exclude<CapabilityName, 'net'>
  | { name: 'net'; domains: string[] };

export interface ToolManifest {
  /** Globally unique, namespaced id, e.g. "primlux.deck". */
  id: string;
  name: string;
  /** Semver. */
  version: string;
  /** Path (relative to the tool root) to an icon, e.g. "icon.svg". */
  icon?: string;
  /** Path (relative to the tool root) to the built entry HTML, e.g. "dist/index.html". */
  entry: string;
  description?: string;
  author?: string;
  capabilities?: CapabilityRequest[];
}

const ID_RE = /^[a-z0-9]+(?:[.-][a-z0-9]+)+$/;

/** Normalize a request to its name. */
export function capabilityName(req: CapabilityRequest): CapabilityName {
  return typeof req === 'string' ? req : req.name;
}

/** Extract the net allowlist from a manifest (empty if `net` not requested). */
export function netAllowlist(manifest: ToolManifest): string[] {
  for (const req of manifest.capabilities ?? []) {
    if (typeof req === 'object' && req.name === 'net') return req.domains ?? [];
  }
  return [];
}

/** True if the manifest declared this capability. The broker calls this. */
export function hasCapability(manifest: ToolManifest, name: CapabilityName): boolean {
  return (manifest.capabilities ?? []).some((req) => capabilityName(req) === name);
}

/** Validate a parsed manifest. Returns a list of human-readable errors ([] = valid). */
export function validateManifest(input: unknown): string[] {
  const errors: string[] = [];
  if (typeof input !== 'object' || input === null) return ['manifest must be an object'];
  const m = input as Record<string, unknown>;

  if (typeof m.id !== 'string' || !ID_RE.test(m.id))
    errors.push('id must be a namespaced lowercase string, e.g. "primlux.deck"');
  if (typeof m.name !== 'string' || !m.name) errors.push('name is required');
  if (typeof m.version !== 'string' || !/^\d+\.\d+\.\d+/.test(m.version))
    errors.push('version must be semver, e.g. "1.0.0"');
  if (typeof m.entry !== 'string' || !m.entry) errors.push('entry is required');

  if (m.capabilities !== undefined) {
    if (!Array.isArray(m.capabilities)) {
      errors.push('capabilities must be an array');
    } else {
      for (const req of m.capabilities) {
        const name = typeof req === 'string' ? req : (req as { name?: string })?.name;
        if (!name || !(CAPABILITY_NAMES as readonly string[]).includes(name)) {
          errors.push(`unknown capability: ${JSON.stringify(req)}`);
        }
        if (name === 'net') {
          const domains = (req as { domains?: unknown })?.domains;
          if (!Array.isArray(domains) || domains.length === 0)
            errors.push('net capability requires a non-empty "domains" allowlist');
        }
      }
    }
  }
  return errors;
}
