/**
 * Presentation document format. A document is plain data (slides as blocks) so
 * it can be created, stored, imported and exported. The engine renders it via
 * DataSlide. Bundled presentations (e.g. Concep) remain component-based.
 *
 * Schema 1. Future versions (.zip with external assets) bump `schema`.
 */

export type DocBlock =
  | { type: 'cover'; eyebrow?: string; title: string; subtitle?: string }
  | { type: 'statement'; eyebrow?: string; text: string }
  | { type: 'bullets'; title: string; items: string[] }
  | { type: 'image'; src: string; caption?: string }

export interface DocSlide {
  block: DocBlock
  notes?: string
}

export interface PresentationDoc {
  schema: 1
  id: string
  name: string
  createdAt: string
  updatedAt: string
  slides: DocSlide[]
}

export function blockTitle(block: DocBlock): string {
  switch (block.type) {
    case 'cover':
      return block.title
    case 'statement':
      return block.text.slice(0, 40)
    case 'bullets':
      return block.title
    case 'image':
      return block.caption ?? 'Imagen'
  }
}

/** Compact unique id (no secure-context dependency, unlike crypto.randomUUID). */
function newId(): string {
  return Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10)
}

/** A starter deck with a few example slides so a new document has content. */
export function createStarterDoc(name: string): PresentationDoc {
  const now = new Date().toISOString()
  const id = newId()
  return {
    schema: 1,
    id,
    name,
    createdAt: now,
    updatedAt: now,
    slides: [
      { block: { type: 'cover', eyebrow: 'Presentación', title: name, subtitle: 'Edita los textos a tu gusto.' } },
      { block: { type: 'statement', eyebrow: 'Idea', text: 'Una frase potente por slide.' } },
      { block: { type: 'bullets', title: 'Puntos clave', items: ['Primero', 'Segundo', 'Tercero'] } },
    ],
  }
}

export const BLOCK_TYPES: { type: DocBlock['type']; label: string }[] = [
  { type: 'cover', label: 'Portada' },
  { type: 'statement', label: 'Enunciado' },
  { type: 'bullets', label: 'Lista' },
  { type: 'image', label: 'Imagen' },
]

/** A default block of the given type, for adding a slide in the editor. */
export function emptyBlock(type: DocBlock['type']): DocBlock {
  switch (type) {
    case 'cover':
      return { type: 'cover', eyebrow: '', title: 'Título', subtitle: '' }
    case 'statement':
      return { type: 'statement', eyebrow: '', text: 'Tu frase aquí.' }
    case 'bullets':
      return { type: 'bullets', title: 'Título', items: ['Punto uno'] }
    case 'image':
      return { type: 'image', src: '', caption: '' }
  }
}

/** Validate a parsed document. Returns errors ([] = valid). */
export function validateDoc(input: unknown): string[] {
  const errors: string[] = []
  if (typeof input !== 'object' || input === null) return ['no es un objeto']
  const d = input as Record<string, unknown>
  if (d.schema !== 1) errors.push('schema desconocido')
  if (typeof d.name !== 'string') errors.push('falta name')
  if (!Array.isArray(d.slides)) errors.push('slides debe ser un array')
  return errors
}
