export type PricingCategory = 'marketing' | 'utility' | 'authentication' | 'service'

export const PRICING_CATEGORIES: PricingCategory[] = ['marketing', 'utility', 'authentication', 'service']

export const CATEGORY_LABEL: Record<PricingCategory, string> = {
  marketing: 'Marketing',
  utility: 'Utilidad',
  authentication: 'Autenticación',
  service: 'Servicio',
}

/** Desde el 1-oct-2026 Meta cobra los mensajes de servicio; los primeros 1.000 del mes por número son gratis. */
export const FREE_SERVICE_PER_NUMBER = 1000
export const SPEND_THRESHOLDS = [50, 80, 100] as const

export type DeliveredMessage = {
  phoneId: string
  category: PricingCategory
  /** Código de país del destinatario (p. ej. "57"). */
  country: string
}

export type RateTable = Partial<Record<string, Partial<Record<PricingCategory, number>>>>

export type MeterInput = {
  messages: DeliveredMessage[]
  rates: RateTable
  now: Date
  capUsd: number | null
}

export type CategoryLine = { category: PricingCategory; count: number; billableCount: number; costUsd: number | null }

export type MeterReport = {
  lines: CategoryLine[]
  totalUsd: number
  /** true si algún mensaje no tenía tarifa cargada: el total es parcial. */
  missingRates: boolean
  freeServiceRemaining: number
  projectedUsd: number
  capUsd: number | null
  capUsedPct: number | null
  thresholdsReached: number[]
}

export function computeMeter({ messages, rates, now, capUsd }: MeterInput): MeterReport {
  const lines = new Map<PricingCategory, CategoryLine>(
    PRICING_CATEGORIES.map((c) => [c, { category: c, count: 0, billableCount: 0, costUsd: 0 }]),
  )
  let missingRates = false
  const serviceUsedByPhone = new Map<string, number>()

  for (const m of messages) {
    const line = lines.get(m.category)!
    line.count++

    if (m.category === 'service') {
      const used = (serviceUsedByPhone.get(m.phoneId) ?? 0) + 1
      serviceUsedByPhone.set(m.phoneId, used)
      if (used <= FREE_SERVICE_PER_NUMBER) continue
    }

    line.billableCount++
    const rate = rates[m.country]?.[m.category]
    if (rate === undefined) {
      missingRates = true
      continue
    }
    line.costUsd = (line.costUsd ?? 0) + rate
  }

  const phones = new Set(messages.map((m) => m.phoneId))
  const freeServiceRemaining = [...phones].reduce(
    (acc, p) => acc + Math.max(0, FREE_SERVICE_PER_NUMBER - (serviceUsedByPhone.get(p) ?? 0)),
    0,
  )

  const totalUsd = round([...lines.values()].reduce((a, l) => a + (l.costUsd ?? 0), 0))
  const projectedUsd = round(totalUsd / monthElapsedFraction(now))
  const capUsedPct = capUsd && capUsd > 0 ? round((totalUsd / capUsd) * 100) : null
  const thresholdsReached = capUsedPct === null ? [] : SPEND_THRESHOLDS.filter((t) => capUsedPct >= t)

  return {
    lines: [...lines.values()].map((l) => ({ ...l, costUsd: l.costUsd === null ? null : round(l.costUsd) })),
    totalUsd,
    missingRates,
    freeServiceRemaining: phones.size ? freeServiceRemaining : FREE_SERVICE_PER_NUMBER,
    projectedUsd,
    capUsd,
    capUsedPct,
    thresholdsReached,
  }
}

export function monthElapsedFraction(now: Date): number {
  const start = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)
  const end = Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1)
  return Math.min(1, Math.max((now.getTime() - start) / (end - start), 1 / 31))
}

export function monthPeriod(now: Date): string {
  return now.toISOString().slice(0, 7)
}

function round(n: number) {
  return Math.round(n * 10000) / 10000
}

const DIAL_CODES = ['1', '7', '20', '27', '30', '31', '32', '33', '34', '36', '39', '40', '41', '43', '44', '45', '46',
  '47', '48', '49', '51', '52', '53', '54', '55', '56', '57', '58', '60', '61', '62', '63', '64', '65', '66', '81', '82',
  '84', '86', '90', '91', '92', '93', '94', '95', '98', '212', '213', '216', '218', '234', '254', '351', '352', '353',
  '354', '356', '357', '358', '359', '370', '371', '372', '380', '420', '421', '501', '502', '503', '504', '505', '506',
  '507', '509', '591', '592', '593', '595', '597', '598', '852', '880', '886', '966', '971', '972', '974']

/** Código de país del wa_id por prefijo más largo. */
export function countryFromWaId(waId: string): string {
  const digits = waId.replace(/\D/g, '')
  for (const len of [3, 2, 1]) {
    const prefix = digits.slice(0, len)
    if (DIAL_CODES.includes(prefix)) return prefix
  }
  return 'otro'
}
