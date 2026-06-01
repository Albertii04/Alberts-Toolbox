import type { ThemeTokens } from '../../engine/types'

// Primlux brand. Tokens already match the engine defaults, so only the wordmark
// is presentation-specific here; a divergent presentation would set `vars`.
export const theme: ThemeTokens = {
  wordmark: { primary: 'PRIMLUX', suffix: 'CONSULTING' },
}
