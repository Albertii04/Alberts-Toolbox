import { readdir, readFile, stat } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { validateManifest, type ToolManifest } from '@toolbox/sdk';

export interface LoadedTool {
  manifest: ToolManifest;
  /** Absolute path to the tool's root folder. */
  root: string;
  /** Absolute path to the resolved entry HTML. */
  entryPath: string;
  /** file:// URL for the entry, ready to hand to a WebContentsView. */
  entryUrl: string;
  /** Source of the tool: bundled with the shell, or installed at runtime. */
  source: 'builtin' | 'installed';
}

const MANIFEST_FILE = 'toolbox.json';

async function exists(p: string): Promise<boolean> {
  try {
    await stat(p);
    return true;
  } catch {
    return false;
  }
}

/** Load and validate a single tool from its root folder. Throws on invalid. */
export async function loadTool(
  root: string,
  source: LoadedTool['source'] = 'builtin',
): Promise<LoadedTool> {
  const manifestPath = join(root, MANIFEST_FILE);
  const raw = await readFile(manifestPath, 'utf8');
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (e) {
    throw new Error(`${manifestPath}: invalid JSON — ${(e as Error).message}`);
  }
  const errors = validateManifest(parsed);
  if (errors.length) throw new Error(`${manifestPath}:\n  - ${errors.join('\n  - ')}`);

  const manifest = parsed as ToolManifest;
  // tool-host loads folder-based `web` apps; `native` apps live only in the
  // catalog and are installed via a package manager, never scanned here.
  if (manifest.kind === 'native')
    throw new Error(`${manifest.id}: native apps are not loaded from folders`);
  if (!manifest.entry) throw new Error(`${manifest.id}: web app is missing an entry`);
  const entryPath = resolve(root, manifest.entry);
  if (!(await exists(entryPath)))
    throw new Error(`${manifest.id}: entry not found at ${entryPath} (did the tool build?)`);

  return {
    manifest,
    root: resolve(root),
    entryPath,
    entryUrl: pathToFileURL(entryPath).href,
    source,
  };
}

/**
 * Scan a directory of tool folders (each containing a toolbox.json). Invalid
 * tools are skipped with a warning rather than crashing the whole scan.
 */
export async function loadToolsFromDir(
  dir: string,
  source: LoadedTool['source'] = 'builtin',
): Promise<LoadedTool[]> {
  if (!(await exists(dir))) return [];
  const entries = await readdir(dir, { withFileTypes: true });
  const tools: LoadedTool[] = [];
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const root = join(dir, entry.name);
    if (!(await exists(join(root, MANIFEST_FILE)))) continue;
    try {
      tools.push(await loadTool(root, source));
    } catch (e) {
      console.warn(`[tool-host] skipping ${root}: ${(e as Error).message}`);
    }
  }
  return tools;
}
