import { spawn, type ChildProcess } from 'node:child_process'
import { mkdirSync, readFileSync } from 'node:fs'
import { cp, rm, writeFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { join, resolve } from 'node:path'
import { app, dialog } from 'electron'

/**
 * Privileged authoring host: runs a single Vite dev server for the Presenter so
 * the editor can show a live (HMR) preview while a presentation's code is edited.
 * Dev-only (needs the source tree); not available in a packaged build yet.
 */
let proc: ChildProcess | null = null
let url: string | null = null
let starting: Promise<string> | null = null

function presenterDir(): string {
  return resolve(app.getAppPath(), '../../tools/presenter')
}
function presentationsDir(): string {
  return join(presenterDir(), 'src/presentations')
}
function templateDir(): string {
  // Outside src/ so it isn't type-checked or globbed in place; copied into
  // src/presentations/<id>/ where its relative imports (../../engine) resolve.
  return join(presenterDir(), 'template')
}

const USER_PREFIX = 'u-'

/** Scaffold a new code presentation folder from the template. */
export async function createPresentation(name: string): Promise<{ id: string }> {
  const id = USER_PREFIX + Date.now().toString(36) + Math.random().toString(36).slice(2, 6)
  const dest = join(presentationsDir(), id)
  await cp(templateDir(), dest, { recursive: true })
  await writeFile(join(dest, 'presentation.json'), JSON.stringify({ id, name }, null, 2), 'utf8')
  return { id }
}

/** Remove a user presentation folder (only ids with the user prefix). */
export async function deletePresentation(id: string): Promise<void> {
  if (!id.startsWith(USER_PREFIX)) throw new Error('refusing to delete a non-user presentation')
  await rm(join(presentationsDir(), id), { recursive: true, force: true })
}

/** Native folder picker; returns the chosen path or null. */
export async function pickFolder(): Promise<string | null> {
  const res = await dialog.showOpenDialog({ properties: ['openDirectory'] })
  return res.canceled || !res.filePaths[0] ? null : res.filePaths[0]
}

/** Register a reference folder Claude reads live (no copy). The path is stored
 *  in the presentation and added to Claude's --add-dir on every turn, so it
 *  reads the original in place — code, CLAUDE.md, design, images — and picks up
 *  later changes with no duplication. Pass '' to clear it. */
export async function setSourcePath(presId: string, srcPath: string): Promise<void> {
  if (!presId.startsWith(USER_PREFIX)) throw new Error('invalid presentation')
  await writeFile(join(presentationsDir(), presId, '.sourcepath'), srcPath.trim(), 'utf8')
}

/** The registered live source folder for a presentation, or null. */
function sourcePathOf(presId: string): string | null {
  try {
    const p = readFileSync(join(presentationsDir(), presId, '.sourcepath'), 'utf8').trim()
    return p || null
  } catch {
    return null
  }
}

// ---- AI editor (Claude Code) ----

type ChatEvent = { kind: 'assistant' | 'tool' | 'done' | 'error'; text: string }

// Resume the Claude Code session per presentation so the chat keeps context.
const sessionByPres = new Map<string, string>()
// Running chat process per presentation, so it can be stopped.
const chatProc = new Map<string, ChildProcess>()

/** Stop the running AI editor turn for a presentation. */
export function stopChat(presId: string): void {
  chatProc.get(presId)?.kill()
  chatProc.delete(presId)
}

/**
 * Drive a Claude Code session to edit a presentation folder. Spawns `claude -p`
 * with cwd = the folder (confinement), streams parsed progress via `emit`, and
 * resolves when the turn ends. Only Read/Edit/Write/Glob/Grep are allowed (no Bash).
 */
export function sendChat(
  presId: string,
  message: string,
  emit: (e: ChatEvent) => void,
  allowEdits = true,
): Promise<void> {
  return new Promise((resolveP) => {
    const folder = join(presentationsDir(), presId)
    const blocks = join(presenterDir(), 'blocks')
    // A writable, self-growing library where Claude saves new reusable blocks.
    const userBlocks = join(presenterDir(), 'blocks-user')
    mkdirSync(userBlocks, { recursive: true })
    const prev = sessionByPres.get(presId)
    const source = sourcePathOf(presId)

    const libsLine = `Hay dos librerías de bloques reutilizables: ${blocks} (oficiales) y ${userBlocks} (guardados de antes). LEE ${blocks}/INDEX.md (contrato del engine: SlideEntry, controls, useSliderState, defineExpose) y revisa ambas carpetas.`
    // The user's material is read IN PLACE (no copy): code, CLAUDE.md, diseño,
    // textos, imágenes. Only the images actually used in slides get copied into
    // the presentation, because Vite bundles assets from the project tree.
    const sourceLine = source
      ? `El material de referencia del usuario está en ${source} (carpeta añadida con acceso de lectura). LÉELO EN SITIO con Read/Glob/Grep — código, CLAUDE.md, diseño, textos, imágenes — y NO lo dupliques en la presentación. Excepción: para una imagen que vayas a MOSTRAR en una slide, cópiala a assets/ de la presentación e impórtala (Vite empaqueta desde el proyecto); el resto se queda donde está. Si el usuario añade cosas a esa carpeta luego, las verás en el siguiente turno.`
      : ''

    // First turn of a session: prepend a preamble. In PLAN mode (no edits) Claude
    // analyses + proposes; in BUILD mode it edits/reuses blocks. Later turns resume.
    let prompt = message
    if (!prev) {
      prompt = allowEdits
        ? `Estás editando una presentación de código (Vue 3 + GSAP) sobre el engine de Presenter (cwd). ${sourceLine} ${libsLine} Reutiliza los bloques que encajen copiándolos a la presentación y siguiendo su block.md. Guarda bloques nuevos reutilizables en ${userBlocks}/<nombre>/; NO modifiques los oficiales de ${blocks} salvo que el usuario lo pida. Petición del usuario: ${message}`
        : `Estás PLANIFICANDO una presentación de código (Vue 3 + GSAP) sobre el engine de Presenter (cwd). ${sourceLine} ${libsLine} Tu tarea ahora: ANALIZA el material y PROPÓN un plan de slides concreto — para cada slide, di qué muestra y qué bloque de la librería usar (o si hace falta uno nuevo), y el estilo/tema. NO edites archivos todavía: solo analiza y propón, en texto. El usuario revisará y, cuando dé a "Implementar", lo construyes. Brief del usuario: ${message}`
    }

    const tools = allowEdits
      ? 'Read,Edit,Write,Glob,Grep,WebFetch'
      : 'Read,Glob,Grep,WebFetch'

    const args = [
      '-p',
      prompt,
      '--output-format',
      'stream-json',
      '--verbose',
      '--add-dir',
      blocks,
      '--add-dir',
      userBlocks,
    ]
    if (source) args.push('--add-dir', source)
    args.push('--allowedTools', tools, '--permission-mode', 'acceptEdits')
    if (prev) args.push('--resume', prev)

    // Ensure ~/.local/bin (where `claude` lives) is on PATH.
    const env = { ...process.env, PATH: `${homedir()}/.local/bin:${process.env.PATH ?? ''}` }
    const child = spawn('claude', args, { cwd: folder, env, stdio: ['ignore', 'pipe', 'pipe'] })
    chatProc.set(presId, child)

    let buf = ''
    child.stdout.on('data', (chunk: Buffer) => {
      buf += chunk.toString()
      let nl: number
      while ((nl = buf.indexOf('\n')) !== -1) {
        const line = buf.slice(0, nl).trim()
        buf = buf.slice(nl + 1)
        if (!line) continue
        let msg: Record<string, unknown>
        try {
          msg = JSON.parse(line)
        } catch {
          continue
        }
        if (msg.type === 'assistant') {
          const content = (msg.message as { content?: unknown[] })?.content ?? []
          for (const b of content as Array<Record<string, unknown>>) {
            if (b.type === 'text' && typeof b.text === 'string' && b.text.trim())
              emit({ kind: 'assistant', text: b.text })
            else if (b.type === 'tool_use') {
              const file = (b.input as { file_path?: string })?.file_path
              emit({ kind: 'tool', text: `${b.name}${file ? ' · ' + file.split('/').pop() : ''}` })
            }
          }
        } else if (msg.type === 'result') {
          if (typeof msg.session_id === 'string') sessionByPres.set(presId, msg.session_id)
          emit({ kind: msg.is_error ? 'error' : 'done', text: String(msg.result ?? '') })
        }
        // everything else (system/hook/rate_limit/init) is noise — ignored
      }
    })
    child.on('error', (e) => {
      chatProc.delete(presId)
      emit({ kind: 'error', text: e.message })
      resolveP()
    })
    child.on('exit', (code, signal) => {
      chatProc.delete(presId)
      if (signal) emit({ kind: 'error', text: 'Detenido.' })
      resolveP()
    })
  })
}

export function getPreviewUrl(): Promise<string> {
  if (url) return Promise.resolve(url)
  if (starting) return starting
  if (app.isPackaged)
    return Promise.reject(new Error('authoring dev server only available when running from source'))

  starting = new Promise<string>((res, rej) => {
    let settled = false
    const done = (u: string): void => {
      if (settled) return
      settled = true
      url = u
      res(u)
    }
    const fail = (e: Error): void => {
      if (settled) return
      settled = true
      starting = null
      rej(e)
    }

    const dir = presenterDir()
    const bin = join(dir, 'node_modules/.bin/vite')
    // No --strictPort: if 5199 is busy (e.g. an orphaned dev server) Vite picks
    // the next free port; we parse whatever URL it prints.
    proc = spawn(bin, ['--port', '5199'], { cwd: dir, env: process.env })

    const scan = (buf: Buffer): void => {
      const m = buf.toString().match(/(http:\/\/localhost:\d+\/)/)
      if (m) done(m[1])
    }
    proc.stdout?.on('data', scan)
    proc.stderr?.on('data', scan)
    proc.on('error', fail)
    proc.on('exit', (code) => {
      proc = null
      if (!settled) {
        fail(new Error(`dev server exited before starting (code ${code})`))
      } else {
        // Server died after running; allow a fresh start next time.
        url = null
        starting = null
      }
    })
    setTimeout(() => fail(new Error('dev server start timeout')), 25000)
  })
  return starting
}

export function stopAuthoring(): void {
  if (proc) proc.kill()
  proc = null
  url = null
  starting = null
}
