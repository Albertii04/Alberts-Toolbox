import { spawn, type ChildProcess } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { cp, rm, writeFile } from 'node:fs/promises'
import { homedir, tmpdir } from 'node:os'
import { basename, dirname, isAbsolute, join, relative, resolve } from 'node:path'
import { app, BrowserWindow, dialog } from 'electron'
import AdmZip from 'adm-zip'

/** Create `dest` (a .zip) from the single top-level folder inside `staging`. */
function zipFolder(staging: string, dest: string): void {
  const zip = new AdmZip()
  zip.addLocalFolder(staging) // entries keep their `<slug>/…` paths
  zip.writeZip(dest)
}

/** Extract a zip to `destDir`, refusing entries that escape it (zip-slip). */
function extractZip(zipPath: string, destDir: string): void {
  const root = resolve(destDir)
  const zip = new AdmZip(zipPath)
  for (const entry of zip.getEntries()) {
    const target = resolve(root, entry.entryName)
    // Reject any entry that resolves outside the destination ("../" traversal).
    const rel = relative(root, target)
    if (rel.startsWith('..') || isAbsolute(rel))
      throw new Error(`unsafe zip entry: ${entry.entryName}`)
    if (entry.isDirectory) {
      mkdirSync(target, { recursive: true })
    } else {
      mkdirSync(dirname(target), { recursive: true })
      writeFileSync(target, entry.getData())
    }
  }
}

/**
 * Privileged authoring host: runs a single Vite dev server for the Presenter so
 * the editor can show a live (HMR) preview while a presentation's code is edited.
 * Dev-only (needs the source tree); not available in a packaged build yet.
 */
let proc: ChildProcess | null = null
let url: string | null = null
let starting: Promise<string> | null = null

function presenterDir(): string {
  return resolve(app.getAppPath(), '../tools/presenter')
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

/** Save an attached file/image into the presentation's attachments/ folder so
 *  the AI editor can Read it. Returns the absolute path of the saved file. */
export async function saveAttachment(
  presId: string,
  name: string,
  dataBase64: string,
): Promise<string> {
  if (!presId.startsWith(USER_PREFIX)) throw new Error('invalid presentation')
  // Strip path separators so a crafted name can't escape the folder.
  const safe = name.replace(/[/\\]/g, '_').replace(/^\.+/, '') || 'archivo'
  const dir = join(presentationsDir(), presId, 'attachments')
  mkdirSync(dir, { recursive: true })
  const dest = join(dir, safe)
  await writeFile(dest, Buffer.from(dataBase64, 'base64'))
  return dest
}

function slugify(name: string): string {
  return (
    name
      .normalize('NFKD')
      .replace(/[̀-ͯ]/g, '') // strip accents
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 60) || 'presentacion'
  )
}

/**
 * Export a presentation as a self-contained, runnable Vite project zip. The
 * deck folder depends on the shared engine via relative imports
 * (`../../../engine`), so the export mirrors that layout under `src/` and adds
 * the configs/entry needed to `npm install && npm run dev`. Returns the saved
 * path, or null if the user cancelled.
 */
export async function exportPresentation(presId: string): Promise<string | null> {
  if (!presId.startsWith(USER_PREFIX)) throw new Error('invalid presentation')
  const presFolder = join(presentationsDir(), presId)
  let name = presId
  try {
    name = JSON.parse(readFileSync(join(presFolder, 'presentation.json'), 'utf8')).name || presId
  } catch {
    /* fall back to the id */
  }
  const slug = slugify(name)

  const res = await dialog.showSaveDialog({
    title: 'Exportar presentación',
    defaultPath: `${slug}.zip`,
    filters: [{ name: 'ZIP', extensions: ['zip'] }],
  })
  if (res.canceled || !res.filePath) return null
  const dest = res.filePath

  // mkdtemp creates a uniquely-named dir with safe perms (avoids predictable
  // os-temp paths / symlink races).
  const staging = mkdtempSync(join(tmpdir(), 'toolbox-export-'))
  const root = join(staging, slug)
  const src = join(root, 'src')
  mkdirSync(join(src, 'presentations'), { recursive: true })

  // Copy the shared engine and the deck, preserving the relative-import layout.
  await cp(join(presenterDir(), 'src/engine'), join(src, 'engine'), { recursive: true })
  await cp(presFolder, join(src, 'presentations', presId), {
    recursive: true,
    // Drop internal/heavy bits that aren't part of the shareable code project.
    filter: (s) => !s.includes(`${presId}/attachments`) && !s.endsWith('.sourcepath'),
  })

  // Entry that mounts just this deck (navigable: arrow keys advance slides).
  await writeFile(
    join(src, 'main.ts'),
    `import { createApp } from 'vue'
import './engine/engine.css'
import { AudienceDeck } from './engine'
import presentation from './presentations/${presId}'

createApp(AudienceDeck, { presentation, navigable: true }).mount('#app')
`,
    'utf8',
  )
  await writeFile(
    join(root, 'index.html'),
    `<!doctype html>
<html lang="es">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${name}</title>
  </head>
  <body>
    <div id="app"></div>
    <script type="module" src="/src/main.ts"></script>
  </body>
</html>
`,
    'utf8',
  )
  await writeFile(
    join(root, 'package.json'),
    JSON.stringify(
      {
        name: slug,
        private: true,
        version: '1.0.0',
        type: 'module',
        scripts: { dev: 'vite', build: 'vue-tsc -b && vite build', preview: 'vite preview' },
        dependencies: { gsap: '^3.15.0', vue: '^3.5.34' },
        devDependencies: {
          '@vitejs/plugin-vue': '^5.2.1',
          typescript: '~5.9.3',
          'vue-tsc': '^2.1.10',
          vite: '^5.4.11',
        },
      },
      null,
      2,
    ),
    'utf8',
  )
  await writeFile(
    join(root, 'vite.config.ts'),
    `import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({ plugins: [vue()] })
`,
    'utf8',
  )
  await writeFile(
    join(root, 'tsconfig.json'),
    JSON.stringify(
      {
        compilerOptions: {
          target: 'ESNext',
          module: 'ESNext',
          moduleResolution: 'Bundler',
          strict: true,
          jsx: 'preserve',
          resolveJsonModule: true,
          esModuleInterop: true,
          skipLibCheck: true,
          noEmit: true,
          lib: ['ESNext', 'DOM', 'DOM.Iterable'],
        },
        include: ['src'],
      },
      null,
      2,
    ),
    'utf8',
  )
  await writeFile(
    join(root, 'README.md'),
    `# ${name}

Presentación de código (Vue 3 + GSAP) exportada desde Open App Store.
Es un proyecto Vite normal: ábrelo en cualquier editor y edítalo.

## Arrancar

\`\`\`bash
npm install
npm run dev
\`\`\`

Abre la URL que imprime Vite. Flechas ← / → cambian de slide; F = pantalla completa.

## Estructura

- \`src/presentations/${presId}/\` — esta presentación (slides, componentes, tema).
- \`src/engine/\` — motor del deck (transiciones, navegación, chrome).
- \`src/main.ts\` — punto de entrada que monta el deck.
`,
    'utf8',
  )

  // Zip the staging root (so the archive has a single top-level folder).
  await rm(dest, { force: true }) // start clean
  try {
    zipFolder(staging, dest)
  } finally {
    await rm(staging, { recursive: true, force: true })
  }

  return dest
}

const IMPORT_SKIP = /(^|\/)(node_modules|\.git|dist|attachments|__MACOSX)(\/|$)/

/**
 * Older exported decks painted their letterbox with a GLOBAL rule in theme.css
 * (`body`/`#app`/`:root[data-deck]`). That mechanism is gone (it leaked between
 * decks), so such decks now import with no background. Migrate them: lift the
 * background value into the deck's scoped theme.vars (--deck-bg) and strip the
 * global rule. No-op for new-format decks (those already have --deck-bg).
 */
function migrateLegacyTheme(deckDir: string): void {
  const cssPath = join(deckDir, 'theme.css')
  const idxPath = join(deckDir, 'index.ts')
  // Read directly and bail on failure instead of exists()-then-read (no TOCTOU).
  let indexSrc: string
  let cssRaw: string
  try {
    indexSrc = readFileSync(idxPath, 'utf8')
    cssRaw = readFileSync(cssPath, 'utf8')
  } catch {
    return
  }
  if (/--deck-bg/.test(indexSrc) || !/vars\s*:\s*\{/.test(indexSrc)) return

  let bg: string | null = null
  const css = cssRaw.replace(
    /[^{}]*(?:\bbody\b|#app|\[data-deck\])[^{}]*\{[^}]*\}/g,
    (block) => {
      const m = block.match(/background\s*:\s*([^;]+);/)
      if (!m) return block // not a canvas-paint rule — leave it
      if (!bg) bg = m[1].replace(/!important/g, '').replace(/\s+/g, ' ').trim()
      return '' // drop the global paint
    },
  )
  if (!bg) return
  writeFileSync(
    idxPath,
    indexSrc.replace(/vars\s*:\s*\{/, (m) => `${m}\n    '--deck-bg': '${bg}',`),
    'utf8',
  )
  writeFileSync(cssPath, css.replace(/\n{3,}/g, '\n\n'), 'utf8')
}

/** Find the shallowest file named `target` under `dir` (BFS). Returns its
 *  containing directory, or null. Skips heavy/irrelevant folders. */
function findDeckRoot(dir: string, target = 'presentation.json'): string | null {
  const queue: string[] = [dir]
  const SKIP = new Set(['node_modules', '.git', 'dist', 'attachments', '__MACOSX'])
  while (queue.length) {
    const d = queue.shift() as string
    let entries: import('node:fs').Dirent[]
    try {
      entries = readdirSync(d, { withFileTypes: true })
    } catch {
      continue
    }
    if (entries.some((e) => e.isFile() && e.name === target)) return d
    for (const e of entries) if (e.isDirectory() && !SKIP.has(e.name)) queue.push(join(d, e.name))
  }
  return null
}

/** If `dir` holds exactly one (non-junk) subfolder and no files, return it —
 *  unwraps the common "everything inside a single top folder" zip shape. */
function unwrapSingle(dir: string): string {
  try {
    const entries = readdirSync(dir, { withFileTypes: true }).filter((e) => e.name !== '__MACOSX')
    if (entries.length === 1 && entries[0].isDirectory()) return join(dir, entries[0].name)
  } catch {
    /* ignore */
  }
  return dir
}

/** Where imported-but-not-yet-converted source material is kept (read in place
 *  by Claude via --add-dir, like an attached folder). Outside the project tree
 *  so Vite doesn't watch/rebuild on it. */
function importsDir(): string {
  return join(app.getPath('userData'), 'imports')
}

const IMPORT_ANALYSIS_PROMPT = `He importado un .zip cuyo contenido NO tiene el formato exacto de una presentación de Presenter, así que esta presentación está vacía (plantilla) y el material importado está en la carpeta adjunta (--add-dir): léela EN SITIO con Read/Glob/Grep.

Tu tarea ahora (modo análisis, sin editar todavía):
1. Analiza el material y di QUÉ es (un deck de otro framework, un export de PowerPoint/Keynote/Google Slides, HTML/web, imágenes, markdown, código, etc.).
2. Determina si es CONVERTIBLE a una presentación de Presenter (Vue 3 + GSAP sobre este engine) y con qué fidelidad (alta/media/baja). Sé honesto: si no es convertible, dilo claramente y explica por qué y qué haría falta.
3. Si es convertible, PROPÓN un plan de slides concreto para reconstruirla aquí: para cada slide, qué muestra y qué bloque de la librería usar (o si hace falta uno nuevo), más el tema/estilo (paleta, tipografía) que detectes en el material.

Cuando apruebe el plan con "Implementar", lo construyes. Inténtalo siempre que haya algo aprovechable.`

/**
 * Import a presentation from a zip.
 *
 * - "Perfect" zip (contains a real Presenter deck: presentation.json + index.ts):
 *   copied straight into a new presentation, ready to edit. mode = 'ready'.
 * - Anything else (no deck, partial, or some other format): scaffold a blank
 *   deck, stash the unzipped material as a read-in-place source folder, and
 *   return an analysis prompt so the AI editor inspects it, says whether it's
 *   importable, and attempts a conversion. mode = 'ai'.
 *
 * Returns the new id, name and mode (+ prompt for the AI path), or null if
 * cancelled.
 */
export async function importPresentation(): Promise<
  { id: string; name: string; mode: 'ready' | 'ai'; prompt?: string } | null
> {
  const res = await dialog.showOpenDialog({
    title: 'Importar presentación (.zip)',
    properties: ['openFile'],
    filters: [{ name: 'ZIP', extensions: ['zip'] }],
  })
  if (res.canceled || !res.filePaths[0]) return null
  const zipPath = res.filePaths[0]
  const fallbackName = basename(zipPath, '.zip') || 'Presentación importada'

  // mkdtemp: unique dir, safe perms (avoids predictable os-temp paths/races).
  const tmp = mkdtempSync(join(tmpdir(), 'toolbox-import-'))
  try {
    extractZip(zipPath, tmp)

    const deckRoot = findDeckRoot(tmp)
    // "Perfect" = the deck folder also has an index.ts. List the dir instead of
    // an exists()-then-use check (avoids a TOCTOU file race).
    const dirHas = (dir: string, file: string): boolean => {
      try {
        return readdirSync(dir).includes(file)
      } catch {
        return false
      }
    }
    const isPerfect = !!deckRoot && dirHas(deckRoot, 'index.ts')

    if (isPerfect && deckRoot) {
      // Clean Presenter deck → copy straight in.
      const id = USER_PREFIX + Date.now().toString(36) + Math.random().toString(36).slice(2, 6)
      const dest = join(presentationsDir(), id)
      await cp(deckRoot, dest, {
        recursive: true,
        filter: (s) => !IMPORT_SKIP.test(s) && !s.endsWith('.sourcepath'),
      })
      let name = fallbackName
      try {
        const meta = JSON.parse(readFileSync(join(dest, 'presentation.json'), 'utf8'))
        name = meta.name || fallbackName
        writeFileSync(
          join(dest, 'presentation.json'),
          JSON.stringify({ ...meta, id, name }, null, 2),
          'utf8',
        )
      } catch {
        writeFileSync(join(dest, 'presentation.json'), JSON.stringify({ id, name }, null, 2), 'utf8')
      }
      migrateLegacyTheme(dest) // recover background from pre-refactor exports
      return { id, name, mode: 'ready' }
    }

    // Imperfect → scaffold a blank deck and hand the material to the AI editor.
    // Prefer a name from a partial presentation.json if one exists.
    let name = fallbackName
    if (deckRoot) {
      try {
        name = JSON.parse(readFileSync(join(deckRoot, 'presentation.json'), 'utf8')).name || name
      } catch {
        /* keep fallback */
      }
    }
    const { id } = await createPresentation(name)
    const material = unwrapSingle(tmp)
    const importDir = join(importsDir(), id)
    mkdirSync(importsDir(), { recursive: true })
    await cp(material, importDir, {
      recursive: true,
      filter: (s) => !IMPORT_SKIP.test(s),
    })
    await setSourcePath(id, importDir)
    return { id, name, mode: 'ai', prompt: IMPORT_ANALYSIS_PROMPT }
  } finally {
    await rm(tmp, { recursive: true, force: true })
  }
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

// ---- cover thumbnails ----

function thumbsDir(): string {
  return join(app.getPath('userData'), 'thumbs')
}
function thumbFile(presId: string): string {
  return join(thumbsDir(), `${presId}.jpg`)
}

// Serialize renders — many offscreen windows at once is heavy.
let thumbChain: Promise<unknown> = Promise.resolve()
function queueThumb<T>(fn: () => Promise<T>): Promise<T> {
  const run = thumbChain.then(fn, fn)
  thumbChain = run.catch(() => {})
  return run
}

/** Render the deck's first slide to a JPG (offscreen) and cache it. Returns the
 *  cache file path. Heavy — runs one at a time via queueThumb. */
function renderThumbnail(presId: string): Promise<string> {
  return queueThumb(async () => {
    const base = await getPreviewUrl()
    const win = new BrowserWindow({
      show: false,
      width: 1280,
      height: 720,
      paintWhenInitiallyHidden: true,
      webPreferences: { offscreen: false, backgroundThrottling: false },
    })
    try {
      await win.loadURL(`${base}?pres=${presId}`)
      // Let fonts load and the intro animation settle before capturing.
      await new Promise((r) => setTimeout(r, 1300))
      const img = await win.webContents.capturePage()
      const jpg = img.toJPEG(86)
      mkdirSync(thumbsDir(), { recursive: true })
      writeFileSync(thumbFile(presId), jpg)
      return thumbFile(presId)
    } finally {
      win.destroy()
    }
  })
}

/** Cover image for a presentation as a JPEG data URL. Renders on first request
 *  (or when `force`), otherwise returns the cached render. */
export async function getThumbnail(presId: string, force = false): Promise<string | null> {
  const file = thumbFile(presId)
  try {
    if (force || !existsSync(file)) await renderThumbnail(presId)
    const buf = readFileSync(file)
    return `data:image/jpeg;base64,${buf.toString('base64')}`
  } catch {
    return null
  }
}

// ---- AI editor (Claude Code) ----

type ChatEvent = {
  kind: 'assistant' | 'tool' | 'done' | 'error'
  text: string
  // On 'done': the Claude Code session id, so the caller can --resume this exact
  // conversation later (sessions are per-conversation, owned by the renderer).
  sessionId?: string
}

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
  resumeSessionId?: string | null,
): Promise<void> {
  return new Promise((resolveP) => {
    const folder = join(presentationsDir(), presId)
    const blocks = join(presenterDir(), 'blocks')
    // A writable, self-growing library where Claude saves new reusable blocks.
    const userBlocks = join(presenterDir(), 'blocks-user')
    mkdirSync(userBlocks, { recursive: true })
    // Resume the conversation's own session if it has one (per-conversation
    // context); absent → first turn → prepend the preamble below.
    const prev = resumeSessionId || undefined
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
          emit({
            kind: msg.is_error ? 'error' : 'done',
            text: String(msg.result ?? ''),
            sessionId: typeof msg.session_id === 'string' ? msg.session_id : undefined,
          })
          // The deck likely changed — refresh its cover thumbnail in the background.
          if (!msg.is_error) void renderThumbnail(presId).catch(() => {})
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
