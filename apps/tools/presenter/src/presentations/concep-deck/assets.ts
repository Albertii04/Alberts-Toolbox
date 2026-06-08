// Resolve a presentation asset by filename to its built, fingerprinted URL.
// Using Vite's glob import keeps assets owned by this presentation and produces
// relative URLs that work under file:// (i.e. when loaded inside the shell).
const files = import.meta.glob('./assets/*', {
  eager: true,
  query: '?url',
  import: 'default',
}) as Record<string, string>

export function asset(name: string): string {
  const match = Object.entries(files).find(([path]) => path.endsWith(`/${name}`))
  if (!match) {
    console.warn(`[concep-deck] missing asset: ${name}`)
    return ''
  }
  return match[1]
}
