const QUALITY_ORDER: Record<string, number> = { GREEN: 2, YELLOW: 1, RED: 0 }

export type BrakeInput = {
  qualityAtStart: string | null
  qualityNow: string | null
  batchSent: number
  batchFailed: number
}

export type BrakeDecision = { pause: boolean; reason: string | null }

export const BATCH_FAILURE_LIMIT = 0.1
const MIN_BATCH_FOR_RATE = 10

/** Freno automático entre tandas: se detiene si baja la calidad o si una tanda falla demasiado. */
export function shouldPauseCampaign(input: BrakeInput): BrakeDecision {
  const start = QUALITY_ORDER[input.qualityAtStart ?? ''] ?? null
  const now = QUALITY_ORDER[input.qualityNow ?? ''] ?? null
  if (now === 0) return { pause: true, reason: 'La calidad del número pasó a ROJO. Campaña pausada.' }
  if (start !== null && now !== null && now < start) {
    return { pause: true, reason: `La calidad bajó de ${input.qualityAtStart} a ${input.qualityNow} durante la campaña. La pausamos para proteger tu número.` }
  }
  if (input.batchSent >= MIN_BATCH_FOR_RATE && input.batchFailed / input.batchSent > BATCH_FAILURE_LIMIT) {
    return {
      pause: true,
      reason: `${Math.round((input.batchFailed / input.batchSent) * 100)}% de la última tanda falló. Revisa los errores antes de seguir.`,
    }
  }
  return { pause: false, reason: null }
}

export function planBatches<T>(items: T[], batchSize: number): T[][] {
  const size = Math.max(1, Math.floor(batchSize))
  const out: T[][] = []
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size))
  return out
}
