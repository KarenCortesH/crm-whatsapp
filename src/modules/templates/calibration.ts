export type ResolvedPrediction = {
  p_utility: number
  p_marketing: number
  p_authentication: number
  final_meta_category: string
}

export type CalibrationBucket = { from: number; to: number; count: number; predictedAvg: number; observedRate: number }

export type CalibrationReport = {
  total: number
  accuracy: number | null
  brier: number | null
  /** Para la probabilidad de MARKETING: ¿cuando decimos 70 %, Meta la pone en marketing ~70 % de las veces? */
  marketingBuckets: CalibrationBucket[]
}

const KEYS = [
  ['UTILITY', 'p_utility'],
  ['MARKETING', 'p_marketing'],
  ['AUTHENTICATION', 'p_authentication'],
] as const

export function computeCalibration(rows: ResolvedPrediction[], bucketCount = 5): CalibrationReport {
  const valid = rows.filter((r) => KEYS.some(([c]) => c === r.final_meta_category.toUpperCase()))
  if (!valid.length) return { total: 0, accuracy: null, brier: null, marketingBuckets: [] }

  let correct = 0
  let brierSum = 0
  for (const r of valid) {
    const actual = r.final_meta_category.toUpperCase()
    const predicted = KEYS.reduce((best, k) => (Number(r[k[1]]) > Number(r[best[1]]) ? k : best))[0]
    if (predicted === actual) correct++
    for (const [cat, key] of KEYS) brierSum += (Number(r[key]) - (cat === actual ? 1 : 0)) ** 2
  }

  const buckets: CalibrationBucket[] = Array.from({ length: bucketCount }, (_, i) => ({
    from: i / bucketCount,
    to: (i + 1) / bucketCount,
    count: 0,
    predictedAvg: 0,
    observedRate: 0,
  }))
  for (const r of valid) {
    const p = Number(r.p_marketing)
    const b = buckets[Math.min(bucketCount - 1, Math.floor(p * bucketCount))]
    b.count++
    b.predictedAvg += p
    b.observedRate += r.final_meta_category.toUpperCase() === 'MARKETING' ? 1 : 0
  }
  for (const b of buckets) {
    if (b.count) {
      b.predictedAvg /= b.count
      b.observedRate /= b.count
    }
  }

  return {
    total: valid.length,
    accuracy: correct / valid.length,
    brier: brierSum / valid.length,
    marketingBuckets: buckets.filter((b) => b.count > 0),
  }
}
