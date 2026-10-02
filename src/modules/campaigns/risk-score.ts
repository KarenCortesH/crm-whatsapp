export type RiskInput = {
  recipients: number
  /** Límite de Meta de destinatarios únicos fuera de ventana por 24 h (p. ej. TIER_1K → 1000). */
  messagingLimit: number | null
  qualityRating: string | null
  /** Edad del consentimiento de cada destinatario, en días. */
  consentAgesDays: number[]
  /** Fracción de destinatarios que alguna vez bloquearon o reportaron, o con fallos 131048/131049. */
  historicBlockRate: number
  /** Tasa de fallos de la última campaña (0–1), si hubo. */
  lastCampaignFailureRate: number | null
}

export type RiskFactor = { key: string; points: number; message: string }

export type RiskReport = {
  score: number
  level: 'bajo' | 'medio' | 'alto'
  factors: RiskFactor[]
  recommendedBatchSize: number
  blocked: boolean
  blockReason: string | null
}

export const RISK_WEIGHTS = {
  sizeVsLimitMax: 35,
  staleConsentMax: 25,
  historicBlocksMax: 25,
  qualityYellow: 15,
  lastCampaignFailures: 10,
} as const

const STALE_CONSENT_DAYS = 180

export function tierToLimit(tier: string | null): number | null {
  if (!tier) return null
  const t = tier.toUpperCase()
  if (t.includes('UNLIMITED')) return Number.POSITIVE_INFINITY
  const m = t.match(/(\d+)\s*(K)?/)
  if (!m) return null
  return Number(m[1]) * (m[2] ? 1000 : 1)
}

export function scoreCampaignRisk(input: RiskInput): RiskReport {
  const factors: RiskFactor[] = []

  if (input.qualityRating === 'RED') {
    return {
      score: 100,
      level: 'alto',
      factors: [{ key: 'quality_red', points: 100, message: 'La calidad del número está en rojo.' }],
      recommendedBatchSize: 0,
      blocked: true,
      blockReason: 'La calidad de tu número está en ROJO. No enviamos campañas hasta que se recupere.',
    }
  }

  const limit = input.messagingLimit
  if (limit !== null && Number.isFinite(limit) && limit > 0) {
    const ratio = input.recipients / limit
    if (ratio > 1) {
      return {
        score: 100,
        level: 'alto',
        factors: [{ key: 'over_limit', points: 100, message: `La campaña (${input.recipients}) supera tu límite diario (${limit}).` }],
        recommendedBatchSize: 0,
        blocked: true,
        blockReason: `Tu número puede escribir a ${limit} personas nuevas por día y la campaña tiene ${input.recipients}. Divídela en varios días.`,
      }
    }
    const points = Math.round(RISK_WEIGHTS.sizeVsLimitMax * Math.min(1, ratio / 0.8))
    if (points > 0) {
      factors.push({ key: 'size_vs_limit', points, message: `Usa el ${Math.round(ratio * 100)}% de tu límite diario de envío.` })
    }
  }

  if (input.consentAgesDays.length) {
    const stale = input.consentAgesDays.filter((d) => d > STALE_CONSENT_DAYS).length / input.consentAgesDays.length
    const points = Math.round(RISK_WEIGHTS.staleConsentMax * stale)
    if (points > 0) {
      factors.push({ key: 'stale_consent', points, message: `${Math.round(stale * 100)}% dio su permiso hace más de 6 meses: puede que ya no te recuerden.` })
    }
  }

  if (input.historicBlockRate > 0) {
    const points = Math.round(RISK_WEIGHTS.historicBlocksMax * Math.min(1, input.historicBlockRate / 0.05))
    factors.push({ key: 'historic_blocks', points, message: `${(input.historicBlockRate * 100).toFixed(1)}% de estos contactos ya bloqueó o rechazó mensajes antes.` })
  }

  if (input.qualityRating === 'YELLOW') {
    factors.push({ key: 'quality_yellow', points: RISK_WEIGHTS.qualityYellow, message: 'La calidad del número está en amarillo.' })
  }

  if (input.lastCampaignFailureRate !== null && input.lastCampaignFailureRate > 0.05) {
    factors.push({ key: 'last_failures', points: RISK_WEIGHTS.lastCampaignFailures, message: `La última campaña tuvo ${Math.round(input.lastCampaignFailureRate * 100)}% de fallos.` })
  }

  const score = Math.min(100, factors.reduce((a, f) => a + f.points, 0))
  const level = score >= 60 ? 'alto' : score >= 30 ? 'medio' : 'bajo'
  const base = level === 'alto' ? 25 : level === 'medio' ? 50 : 100
  return {
    score,
    level,
    factors,
    recommendedBatchSize: Math.max(1, Math.min(base, input.recipients)),
    blocked: false,
    blockReason: null,
  }
}
