/**
 * Native app installer. Two backends behind one entry point:
 *
 *  - **Package manager** (preferred when available): if the app declares an
 *    `installers` id for a manager present on this OS (brew / winget / scoop /
 *    flatpak), install/upgrade/uninstall through it. Trusted, signed, and the
 *    manager owns updates + removal.
 *  - **Direct download** (fallback): pick the per-platform download URL, fetch
 *    to a private temp dir (progress + optional sha256), install by file format
 *    (macOS .dmg/.zip → copy the .app to /Applications; Linux .AppImage →
 *    userData + chmod). Windows .exe/.msi not yet.
 *
 * Security posture: https-only downloads, optional sha256 pin, private temp dir
 * via mkdtemp, and every external command runs through spawn with an argv array
 * (never a shell string), so a malicious URL/filename/id can't inject a command.
 * On macOS/Linux we never execute a fetched binary — we only copy the bundle the
 * archive contains; package managers run their own signed installers.
 */
import { app, net } from 'electron'
import { spawn } from 'node:child_process'
import { createHash } from 'node:crypto'
import { createReadStream, createWriteStream } from 'node:fs'
import { cp, chmod, mkdir, mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { downloadFor, type PackageManager, type ToolManifest } from '@openappstore/sdk'
import type { InstallProgress, InstalledApp } from '../shared/types.js'

type AssetFormat = 'dmg' | 'zip' | 'appimage' | 'exe' | 'msi' | 'unknown'
type PkgAction = 'install' | 'upgrade' | 'uninstall'

/** Package managers to try, in order, per platform. */
const PLATFORM_MANAGERS: Record<string, PackageManager[]> = {
  darwin: ['brew'],
  win32: ['winget', 'scoop'],
  linux: ['flatpak'],
}

/** `<platform>-<arch>`, e.g. "darwin-arm64". Matches manifest download keys. */
export function currentPlatformArch(): string {
  return `${process.platform}-${process.arch}`
}

function stateFile(): string {
  return join(app.getPath('userData'), 'installed-apps.json')
}

export async function listInstalled(): Promise<InstalledApp[]> {
  try {
    return JSON.parse(await readFile(stateFile(), 'utf8')) as InstalledApp[]
  } catch {
    return []
  }
}

async function writeInstalled(list: InstalledApp[]): Promise<void> {
  await writeFile(stateFile(), JSON.stringify(list, null, 2))
}

function inferFormat(url: string): AssetFormat {
  const path = url.split(/[?#]/)[0].toLowerCase()
  if (path.endsWith('.dmg')) return 'dmg'
  if (path.endsWith('.zip')) return 'zip'
  if (path.endsWith('.appimage')) return 'appimage'
  if (path.endsWith('.exe')) return 'exe'
  if (path.endsWith('.msi')) return 'msi'
  return 'unknown'
}

/** Stream a URL to disk, reporting integer percent (only when length is known). */
function download(url: string, dest: string, onPct: (pct: number) => void): Promise<void> {
  return new Promise((resolve, reject) => {
    if (!url.startsWith('https://')) {
      reject(new Error('refusing non-https download'))
      return
    }
    const req = net.request(url) // electron net follows redirects + respects proxy
    req.on('response', (res) => {
      const status = res.statusCode ?? 0
      if (status < 200 || status >= 300) {
        reject(new Error(`download failed: HTTP ${status}`))
        return
      }
      const total = Number(res.headers['content-length'] ?? 0)
      let received = 0
      const out = createWriteStream(dest)
      out.on('error', reject)
      res.on('data', (chunk: Buffer) => {
        received += chunk.length
        out.write(chunk)
        if (total) onPct(Math.min(100, Math.round((received / total) * 100)))
      })
      res.on('end', () => out.end(() => resolve()))
      res.on('error', reject)
    })
    req.on('error', reject)
    req.end()
  })
}

function sha256File(path: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const hash = createHash('sha256')
    const s = createReadStream(path)
    s.on('data', (d) => hash.update(d))
    s.on('end', () => resolve(hash.digest('hex')))
    s.on('error', reject)
  })
}

/** Run an external command with an argv array — never through a shell. */
function run(cmd: string, args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, args, { stdio: ['ignore', 'ignore', 'pipe'] })
    let err = ''
    p.stderr?.on('data', (d: Buffer) => {
      err += d.toString()
    })
    p.on('error', reject)
    p.on('close', (code) =>
      code === 0 ? resolve() : reject(new Error(`${cmd} exited ${code}: ${err.trim()}`)),
    )
  })
}

/** Run a command and stream its stdout+stderr lines (for package managers). */
function runStream(cmd: string, args: string[], onLine: (line: string) => void): Promise<void> {
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, args, { stdio: ['ignore', 'pipe', 'pipe'] })
    let tail = ''
    const feed = (buf: Buffer): void => {
      const s = buf.toString()
      tail = (tail + s).slice(-2000)
      for (const line of s.split(/\r?\n/)) {
        const t = line.trim()
        if (t) onLine(t)
      }
    }
    p.stdout?.on('data', feed)
    p.stderr?.on('data', feed)
    p.on('error', reject)
    p.on('close', (code) =>
      code === 0 ? resolve() : reject(new Error(`${cmd} exited ${code}: ${tail.trim().slice(-300)}`)),
    )
  })
}

/** True if a package manager is on PATH (probed via `<mgr> --version`). */
function hasManager(name: PackageManager): Promise<boolean> {
  return new Promise((resolve) => {
    const p = spawn(name, ['--version'], { stdio: 'ignore' })
    p.on('error', () => resolve(false)) // ENOENT = not installed
    p.on('close', () => resolve(true))
  })
}

/** Argv for a package-manager action. id comes from the (validated) manifest. */
function mgrArgs(action: PkgAction, mgr: PackageManager, id: string): string[] {
  switch (mgr) {
    case 'brew':
      // modern Homebrew installs casks too, so a bare id works for GUI apps
      return action === 'install' ? ['install', id] : [action, id]
    case 'winget': {
      const common = ['--id', id, '-e', '--silent']
      if (action === 'uninstall') return ['uninstall', ...common]
      return [
        action,
        ...common,
        '--accept-package-agreements',
        '--accept-source-agreements',
      ]
    }
    case 'scoop':
      return action === 'upgrade' ? ['update', id] : [action, id]
    case 'flatpak':
      if (action === 'uninstall') return ['uninstall', '-y', id]
      if (action === 'upgrade') return ['update', '-y', id]
      return ['install', '-y', 'flathub', id]
  }
}

/** The first declared package manager available on this OS, or null. */
async function pickManager(
  manifest: ToolManifest,
): Promise<{ name: PackageManager; id: string } | null> {
  for (const name of PLATFORM_MANAGERS[process.platform] ?? []) {
    const id = manifest.installers?.[name]
    if (id && (await hasManager(name))) return { name, id }
  }
  return null
}

async function installViaManager(
  manifest: ToolManifest,
  mgr: { name: PackageManager; id: string },
  pa: string,
  action: Exclude<PkgAction, 'uninstall'>,
  emit: (p: Omit<InstallProgress, 'id'>) => void,
): Promise<InstalledApp> {
  emit({ phase: 'installing', message: `${mgr.name} ${action} ${mgr.id}…` })
  await runStream(mgr.name, mgrArgs(action, mgr.name, mgr.id), (line) =>
    emit({ phase: 'installing', message: line }),
  )
  const record: InstalledApp = {
    id: manifest.id,
    name: manifest.name,
    version: manifest.version,
    platformArch: pa,
    format: `pkg:${mgr.name}`,
    location: mgr.id,
    installedAt: new Date().toISOString(),
  }
  const list = (await listInstalled()).filter((a) => a.id !== manifest.id)
  list.unshift(record)
  await writeInstalled(list)
  emit({ phase: 'done' })
  return record
}

/** Find the single `.app` bundle inside a directory (mounted dmg / unzipped). */
async function findApp(dir: string): Promise<string | null> {
  const entries = await readdir(dir, { withFileTypes: true })
  const appEntry = entries.find((e) => e.name.endsWith('.app'))
  return appEntry ? join(dir, appEntry.name) : null
}

async function installDmg(file: string, tmp: string): Promise<string> {
  const mount = join(tmp, 'mnt')
  await mkdir(mount, { recursive: true })
  await run('hdiutil', ['attach', file, '-nobrowse', '-quiet', '-mountpoint', mount])
  try {
    const appPath = await findApp(mount)
    if (!appPath) throw new Error('no .app found inside the .dmg')
    const dest = join('/Applications', appPath.split('/').pop() as string)
    await rm(dest, { recursive: true, force: true })
    await cp(appPath, dest, { recursive: true })
    return dest
  } finally {
    await run('hdiutil', ['detach', mount, '-quiet']).catch(() => {})
  }
}

async function installZip(file: string, tmp: string): Promise<string> {
  const out = join(tmp, 'unz')
  await mkdir(out, { recursive: true })
  // ditto preserves macOS bundle metadata better than unzip.
  await run('ditto', ['-x', '-k', file, out])
  const appPath = await findApp(out)
  if (!appPath) throw new Error('no .app found inside the .zip')
  const dest = join('/Applications', appPath.split('/').pop() as string)
  await rm(dest, { recursive: true, force: true })
  await cp(appPath, dest, { recursive: true })
  return dest
}

async function installAppImage(file: string, id: string): Promise<string> {
  const dir = join(app.getPath('userData'), 'apps', id)
  await mkdir(dir, { recursive: true })
  const dest = join(dir, file.split('/').pop() as string)
  await cp(file, dest)
  await chmod(dest, 0o755)
  return dest
}

/**
 * Install a native app from its manifest's direct download for this platform.
 * Emits progress through `onProgress`. Throws on any failure (after cleanup).
 */
export async function installNative(
  manifest: ToolManifest,
  onProgress: (p: InstallProgress) => void,
): Promise<InstalledApp> {
  const id = manifest.id
  const emit = (p: Omit<InstallProgress, 'id'>): void => onProgress({ id, ...p })
  emit({ phase: 'resolving' })

  const pa = currentPlatformArch()

  // Prefer a package manager when one this app declares is present on the OS.
  const mgr = await pickManager(manifest)
  if (mgr) {
    try {
      const already = (await listInstalled()).some((a) => a.id === id)
      return await installViaManager(manifest, mgr, pa, already ? 'upgrade' : 'install', emit)
    } catch (e) {
      emit({ phase: 'error', message: (e as Error).message })
      throw e
    }
  }

  // Otherwise fall back to a direct download for this platform.
  const src = downloadFor(manifest, pa)
  if (!src) {
    const msg = `no package manager and no download for ${pa}`
    emit({ phase: 'error', message: msg })
    throw new Error(msg)
  }
  const format = inferFormat(src.url)

  const tmp = await mkdtemp(join(tmpdir(), 'tbx-install-'))
  try {
    const file = join(tmp, src.url.split(/[?#]/)[0].split('/').pop() || 'asset')
    emit({ phase: 'downloading', pct: 0 })
    await download(src.url, file, (pct) => emit({ phase: 'downloading', pct }))

    if (src.sha256) {
      emit({ phase: 'verifying' })
      const got = await sha256File(file)
      if (got.toLowerCase() !== src.sha256.toLowerCase())
        throw new Error(`sha256 mismatch: expected ${src.sha256}, got ${got}`)
    }

    emit({ phase: 'installing' })
    let location: string
    if (format === 'dmg') location = await installDmg(file, tmp)
    else if (format === 'zip') location = await installZip(file, tmp)
    else if (format === 'appimage') location = await installAppImage(file, id)
    else if (format === 'exe' || format === 'msi')
      throw new Error('Windows installer execution is not supported yet')
    else throw new Error(`unsupported asset format for ${src.url}`)

    const record: InstalledApp = {
      id,
      name: manifest.name,
      version: manifest.version,
      platformArch: pa,
      format,
      location,
      installedAt: new Date().toISOString(),
    }
    const list = (await listInstalled()).filter((a) => a.id !== id)
    list.unshift(record)
    await writeInstalled(list)

    emit({ phase: 'done' })
    return record
  } catch (e) {
    emit({ phase: 'error', message: (e as Error).message })
    throw e
  } finally {
    await rm(tmp, { recursive: true, force: true }).catch(() => {})
  }
}

/** Remove an installed native app and forget it. */
export async function uninstallNative(id: string): Promise<void> {
  const list = await listInstalled()
  const record = list.find((a) => a.id === id)
  if (!record) return
  if (record.format.startsWith('pkg:')) {
    const mgr = record.format.slice(4) as PackageManager
    // location holds the manager package id; uninstall through the manager.
    await runStream(mgr, mgrArgs('uninstall', mgr, record.location), () => {}).catch(() => {})
  } else if (record.format === 'appimage') {
    await rm(join(app.getPath('userData'), 'apps', id), { recursive: true, force: true })
  } else if (record.location.startsWith('/Applications/')) {
    await rm(record.location, { recursive: true, force: true })
  }
  await writeInstalled(list.filter((a) => a.id !== id))
}
