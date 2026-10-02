import type { CategoryProbabilities, TemplateCategory, Verdict } from './types'

/** Umbrales revisables por humanos. Ajustar con la calibración contra la categoría final de Meta. */
export const VERDICT_THRESHOLDS = {
  /** Desde aquí se trata como marketing aunque no sea la categoría más probable. */
  marketingFloor: 0.4,
  /** Probabilidad mínima para afirmar utilidad o autenticación sin dudas. */
  confident: 0.6,
  /** Probabilidad (Jev) o señal (LLM) de contenido promocional que bloquea cualquier reescritura a utilidad. */
  promotional: 0.5,
} as const

type VerdictInput = {
  probabilities: CategoryProbabilities
  /** 0–1. Del scorer calibrado si existe; si no, 1 o 0 según el LLM. */
  promotional: number
  requested: TemplateCategory
}

export function decideVerdict({ probabilities: p, promotional }: VerdictInput): Verdict {
  if (promotional >= VERDICT_THRESHOLDS.promotional) return 'marketing'
  if (p.marketing >= VERDICT_THRESHOLDS.marketingFloor && p.marketing >= Math.max(p.utility, p.authentication)) {
    return 'marketing'
  }
  if (p.authentication >= VERDICT_THRESHOLDS.confident) return 'autenticacion'
  if (p.utility >= VERDICT_THRESHOLDS.confident && p.marketing < VERDICT_THRESHOLDS.marketingFloor) return 'utilidad'
  return 'dudosa'
}

/** La reescritura a utilidad solo se ofrece si el contenido es de verdad informativo. */
export function allowRewrite(verdict: Verdict, promotional: number): boolean {
  return verdict !== 'marketing' && verdict !== 'autenticacion' && promotional < VERDICT_THRESHOLDS.promotional
}

export function adviceFor(verdict: Verdict, requested: TemplateCategory): string {
  switch (verdict) {
    case 'marketing':
      return requested === 'MARKETING'
        ? 'Esto es marketing y así la estás enviando. Bien: envíala como marketing.'
        : 'Esto es marketing, envíala como marketing. No intentes pasarla como utilidad: Meta la recategoriza y arriesgas la calidad de tu número.'
    case 'utilidad':
      return requested === 'UTILITY'
        ? 'Es informativa: tiene buenas probabilidades de quedar como utilidad.'
        : 'El contenido es informativo; podrías enviarla como utilidad.'
    case 'autenticacion':
      return 'Es un código de verificación: envíala como autenticación.'
    case 'dudosa':
      return 'No es claro. Quita las frases marcadas o revisa la reescritura sugerida antes de enviarla.'
  }
}

export function normalizeProbabilities(p: CategoryProbabilities): CategoryProbabilities {
  const clamp = (n: number) => (Number.isFinite(n) && n > 0 ? n : 0)
  const u = clamp(p.utility)
  const m = clamp(p.marketing)
  const a = clamp(p.authentication)
  const total = u + m + a
  if (total === 0) return { utility: 1 / 3, marketing: 1 / 3, authentication: 1 / 3 }
  return { utility: u / total, marketing: m / total, authentication: a / total }
}
