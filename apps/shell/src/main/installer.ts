/**
 * Native app installer — wedge v1, "direct download" backend.
 *
 * A `native` app declares per-platform direct download URLs (any public host).
 * Given a manifest, this:
 *   1. picks the download matching the user's `<platform>-<arch>`,
 *   2. downloads it to a private temp dir with progress,
 *   3. verifies sha256 when the manifest declares one,
 *   4. installs by file format (macOS .dmg/.zip → copy the .app to
 *      /Applications; Linux .AppImage → drop into userData + chmod),
 *   5. records it so "My apps" can list / uninstall.
 *
 * Security posture: https-only, optional sha256 pin, private temp dir via
 * mkdtemp, and every external command runs through spawn with an argv array
 * (never a shell string), so a malicious URL/filename can't inject a command.
 * We never execute a fetched binary on macOS/Linux — we only copy the app
 * bundle the archive contains. Package-manager and Windows backends come next.
 */
import { app, net } from 'electron'
import { spawn } from 'node:child_process'
import { createHash } from 'node:crypto'
import { createReadStream, createWriteStream } from 'node:fs'
import { cp, chmod, mkdir, mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { downloadFor, type ToolManifest } from '@toolbox/sdk'
import type { InstallProgress, InstalledApp } from '../shared/types.js'

type AssetFormat = 'dmg' | 'zip' | 'appimage' | 'exe' | 'msi' | 'unknown'

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
  const src = downloadFor(manifest, pa)
  if (!src) throw new Error(`no download declared for ${pa}`)
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
  if (record.format === 'appimage') {
    await rm(join(app.getPath('userData'), 'apps', id), { recursive: true, force: true })
  } else if (record.location.startsWith('/Applications/')) {
    await rm(record.location, { recursive: true, force: true })
  }
  await writeInstalled(list.filter((a) => a.id !== id))
}
