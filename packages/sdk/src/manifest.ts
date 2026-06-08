/**
 * App manifest schema + capability model.
 *
 * Every catalog entry is an APP whose `kind` selects how it is delivered:
 *   - `web`    — a folder with a `toolbox.json` (this shape) + a built web
 *                entry; runs in-shell in a sandboxed view. Capabilities are
 *                DECLARED here and ENFORCED by the broker — anything not
 *                declared is denied at the IPC layer (`[]` = can do nothing
 *                native).
 *   - `native` — installed on the user's machine by orchestrating an OS
 *                package manager (declared in `installers`); nothing runs
 *                in-shell, so it has no `entry` and no capabilities.
 *
 * This single shape keeps the hybrid one product: one catalog, one Install
 * button, the `kind` just picks the backend.
 */

/** How an app is delivered. Defaults to `web`. */
export const APP_KINDS = ['web', 'native'] as const;
export type AppKind = (typeof APP_KINDS)[number];

/** OS package managers a `native` app can be installed through. */
export const PACKAGE_MANAGERS = ['brew', 'winget', 'scoop', 'flatpak'] as const;
export type PackageManager = (typeof PACKAGE_MANAGERS)[number];

/**
 * Per-manager package id for a `native` app — the id passed to the manager,
 * e.g. { brew: 'gimp', winget: 'GIMP.GIMP', flatpak: 'org.gimp.GIMP' }.
 */
export type Installers = Partial<Record<PackageManager, string>>;

/**
 * Target platforms a `native` app can declare a direct download for.
 * Keyed `<process.platform>-<process.arch>`.
 */
export const PLATFORM_ARCHES = [
  'darwin-arm64',
  'darwin-x64',
  'win32-x64',
  'win32-arm64',
  'linux-x64',
  'linux-arm64',
] as const;
export type PlatformArch = (typeof PLATFORM_ARCHES)[number];

/** A direct, public download for one platform — any URL, not just GitHub. */
export interface DownloadSource {
  /** https URL of the installable asset (.dmg/.zip/.exe/.msi/.AppImage…). */
  url: string;
  /** Optional hex sha256 of the asset; verified after download when present. */
  sha256?: string;
}

/**
 * Per-platform direct downloads for a `native` app. The installer picks the
 * entry matching the user's `<platform>-<arch>`.
 */
export type Downloads = Partial<Record<PlatformArch, DownloadSource>>;

/**
 * An upstream source a resolver expands into a concrete version + downloads +
 * release notes + metrics. Lets the catalog stay thin (a repo ref + asset
 * patterns) while freshness comes from the GitHub API out of band.
 */
export interface GithubSource {
  /** "owner/repo" whose latest release provides version and assets. */
  github: string;
  /** Per-platform regex matched against release asset NAMES to pick the download. */
  assets: Partial<Record<PlatformArch, string>>;
  /** Resolve from the newest prerelease too. Default false (stable only). */
  prereleases?: boolean;
}

/** Where a `native` app's version/downloads are resolved from (github for now). */
export type AppSource = GithubSource;

/** A `native` app is installable if it declares managers, downloads, OR a source. */
export function hasInstallSource(manifest: ToolManifest): boolean {
  return (
    Object.keys(manifest.installers ?? {}).length > 0 ||
    Object.keys(manifest.downloads ?? {}).length > 0 ||
    manifest.source !== undefined
  );
}

/** The direct download for a given `<platform>-<arch>`, if the app declares one. */
export function downloadFor(
  manifest: ToolManifest,
  platformArch: string,
): DownloadSource | undefined {
  return manifest.downloads?.[platformArch as PlatformArch];
}

/** Quality/maintenance/security signals, refreshed out of band. All optional. */
export interface AppMetrics {
  /** Source repository the signals derive from. */
  repo?: string;
  /** GitHub stars. */
  stars?: number;
  /** ISO date of the most recent commit. */
  lastCommit?: string;
  /** Count of known open CVEs. */
  openCves?: number;
}

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
  'authoring', // PRIVILEGED: run an authoring dev server + AI code editing. First-party only.
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
  /** Globally unique, namespaced id, e.g. "primlux.deck" or "org.gimp". */
  id: string;
  name: string;
  /** Semver. */
  version: string;
  /** How this app is delivered. Defaults to `web` when omitted. */
  kind?: AppKind;
  /** Path (relative to the app root) to an icon, e.g. "icon.svg". */
  icon?: string;
  /**
   * `web` only: path (relative to the app root) to the built entry HTML,
   * e.g. "dist/index.html". Required for `web`, ignored for `native`.
   */
  entry?: string;
  description?: string;
  author?: string;
  /** Storefront category, e.g. "Creativity", "Productivity", "Developer". */
  category?: string;
  /** Paid/proprietary products this app is an open alternative to, e.g. ["Photoshop"]. */
  replaces?: string[];
  /** `web` only: native capabilities, enforced by the broker. */
  capabilities?: CapabilityRequest[];
  /** `native` only: per-manager package ids (brew/winget/scoop/flatpak). */
  installers?: Installers;
  /** `native` only: per-platform direct download URLs (any public host). */
  downloads?: Downloads;
  /** `native` only: upstream source (e.g. GitHub) a resolver expands live. */
  source?: AppSource;
  /** Quality/maintenance/security signals (refreshed out of band). */
  metrics?: AppMetrics;
}

/** Resolve a manifest's kind, defaulting to `web`. */
export function appKind(manifest: ToolManifest): AppKind {
  return manifest.kind ?? 'web';
}

/** True if the app installs via a package manager rather than running in-shell. */
export function isNative(manifest: ToolManifest): boolean {
  return appKind(manifest) === 'native';
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

  // Resolve kind first — it decides which fields are required.
  let kind: AppKind = 'web';
  if (m.kind !== undefined) {
    if (!(APP_KINDS as readonly string[]).includes(m.kind as string)) {
      errors.push(`kind must be one of: ${APP_KINDS.join(', ')}`);
    } else {
      kind = m.kind as AppKind;
    }
  }

  if (kind === 'web') {
    if (typeof m.entry !== 'string' || !m.entry) errors.push('entry is required for a web app');
    if (m.installers !== undefined)
      errors.push('installers is only valid for a native app (kind: "native")');
    if (m.downloads !== undefined)
      errors.push('downloads is only valid for a native app (kind: "native")');
    if (m.source !== undefined)
      errors.push('source is only valid for a native app (kind: "native")');
  } else {
    // native — installed via a package manager and/or a direct download.
    if (m.entry !== undefined) errors.push('a native app must not declare an entry');
    if (m.capabilities !== undefined)
      errors.push('a native app cannot declare capabilities (it does not run in-shell)');

    const isMap = (v: unknown): v is Record<string, unknown> =>
      typeof v === 'object' && v !== null && !Array.isArray(v);

    let sources = 0;

    if (m.installers !== undefined) {
      if (!isMap(m.installers)) {
        errors.push('installers must be an object');
      } else {
        sources += Object.keys(m.installers).length;
        for (const [pm, ref] of Object.entries(m.installers)) {
          if (!(PACKAGE_MANAGERS as readonly string[]).includes(pm))
            errors.push(`unknown package manager in installers: "${pm}"`);
          if (typeof ref !== 'string' || !ref)
            errors.push(`installers.${pm} must be a non-empty package id`);
        }
      }
    }

    if (m.downloads !== undefined) {
      if (!isMap(m.downloads)) {
        errors.push('downloads must be an object');
      } else {
        sources += Object.keys(m.downloads).length;
        for (const [pa, src] of Object.entries(m.downloads)) {
          if (!(PLATFORM_ARCHES as readonly string[]).includes(pa))
            errors.push(`unknown platform in downloads: "${pa}" (use e.g. "darwin-arm64")`);
          if (!isMap(src)) {
            errors.push(`downloads.${pa} must be an object with a "url"`);
            continue;
          }
          if (typeof src.url !== 'string' || !/^https:\/\//.test(src.url))
            errors.push(`downloads.${pa}.url must be an https URL`);
          if (src.sha256 !== undefined && (typeof src.sha256 !== 'string' || !/^[a-f0-9]{64}$/i.test(src.sha256)))
            errors.push(`downloads.${pa}.sha256 must be a 64-char hex string`);
        }
      }
    }

    if (m.source !== undefined) {
      if (!isMap(m.source)) {
        errors.push('source must be an object');
      } else {
        sources += 1;
        const s = m.source as Record<string, unknown>;
        if (typeof s.github !== 'string' || !/^[\w.-]+\/[\w.-]+$/.test(s.github))
          errors.push('source.github must be an "owner/repo" string');
        if (!isMap(s.assets) || Object.keys(s.assets).length === 0) {
          errors.push('source.assets must map at least one platform to an asset-name regex');
        } else {
          for (const [pa, rx] of Object.entries(s.assets)) {
            if (!(PLATFORM_ARCHES as readonly string[]).includes(pa))
              errors.push(`unknown platform in source.assets: "${pa}"`);
            if (typeof rx !== 'string' || !rx)
              errors.push(`source.assets.${pa} must be a non-empty regex string`);
          }
        }
        if (s.prereleases !== undefined && typeof s.prereleases !== 'boolean')
          errors.push('source.prereleases must be a boolean');
      }
    }

    if (sources === 0)
      errors.push(
        'a native app requires at least one install source ("installers", "downloads" or "source")',
      );
  }

  if (m.replaces !== undefined) {
    if (!Array.isArray(m.replaces) || m.replaces.some((r) => typeof r !== 'string' || !r))
      errors.push('replaces must be an array of non-empty strings');
  }

  if (m.category !== undefined && typeof m.category !== 'string')
    errors.push('category must be a string');

  if (m.metrics !== undefined) {
    const mm = m.metrics as Record<string, unknown>;
    if (typeof mm !== 'object' || mm === null || Array.isArray(mm)) {
      errors.push('metrics must be an object');
    } else {
      if (mm.repo !== undefined && typeof mm.repo !== 'string')
        errors.push('metrics.repo must be a string');
      if (mm.stars !== undefined && typeof mm.stars !== 'number')
        errors.push('metrics.stars must be a number');
      if (mm.lastCommit !== undefined && typeof mm.lastCommit !== 'string')
        errors.push('metrics.lastCommit must be a string (ISO date)');
      if (mm.openCves !== undefined && typeof mm.openCves !== 'number')
        errors.push('metrics.openCves must be a number');
    }
  }

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
