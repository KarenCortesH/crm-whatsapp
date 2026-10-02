import { describe, expect, it } from 'vitest'
import { planBatches, shouldPauseCampaign } from './batch-brake'
import { scoreCampaignRisk, tierToLimit, type RiskInput } from './risk-score'

const base: RiskInput = {
  recipients: 100,
  messagingLimit: 1000,
  qualityRating: 'GREEN',
  consentAgesDays: Array(100).fill(30),
  historicBlockRate: 0,
  lastCampaignFailureRate: null,
}

describe('scoreCampaignRisk', () => {
  it('campaña pequeña con permisos frescos → riesgo bajo', () => {
    const r = scoreCampaignRisk(base)
    expect(r.level).toBe('bajo')
    expect(r.blocked).toBe(false)
    expect(r.recommendedBatchSize).toBe(100)
  })

  it('calidad roja bloquea', () => {
    const r = scoreCampaignRisk({ ...base, qualityRating: 'RED' })
    expect(r.blocked).toBe(true)
    expect(r.recommendedBatchSize).toBe(0)
  })

  it('superar el límite diario bloquea', () => {
    const r = scoreCampaignRisk({ ...base, recipients: 1500, consentAgesDays: Array(1500).fill(10) })
    expect(r.blocked).toBe(true)
    expect(r.blockReason).toContain('1000')
  })

  it('permisos viejos, bloqueos y calidad amarilla suben el riesgo y achican la tanda', () => {
    const r = scoreCampaignRisk({
      ...base,
      recipients: 800,
      consentAgesDays: Array(800).fill(400),
      historicBlockRate: 0.05,
      qualityRating: 'YELLOW',
    })
    expect(r.level).toBe('alto')
    expect(r.recommendedBatchSize).toBe(25)
    expect(r.factors.map((f) => f.key)).toEqual(expect.arrayContaining(['size_vs_limit', 'stale_consent', 'historic_blocks', 'quality_yellow']))
  })

  it('tierToLimit entiende los niveles de Meta', () => {
    expect(tierToLimit('TIER_250')).toBe(250)
    expect(tierToLimit('TIER_1K')).toBe(1000)
    expect(tierToLimit('TIER_100K')).toBe(100000)
    expect(tierToLimit('TIER_UNLIMITED')).toBe(Number.POSITIVE_INFINITY)
    expect(tierToLimit(null)).toBeNull()
  })
})

describe('shouldPauseCampaign', () => {
  it('frena si la calidad baja', () => {
    expect(shouldPauseCampaign({ qualityAtStart: 'GREEN', qualityNow: 'YELLOW', batchSent: 50, batchFailed: 0 }).pause).toBe(true)
  })
  it('frena en rojo', () => {
    expect(shouldPauseCampaign({ qualityAtStart: null, qualityNow: 'RED', batchSent: 0, batchFailed: 0 }).pause).toBe(true)
  })
  it('frena si la tanda falla más de 10 %', () => {
    expect(shouldPauseCampaign({ qualityAtStart: 'GREEN', qualityNow: 'GREEN', batchSent: 50, batchFailed: 6 }).pause).toBe(true)
  })
  it('sigue si todo va bien', () => {
    expect(shouldPauseCampaign({ qualityAtStart: 'GREEN', qualityNow: 'GREEN', batchSent: 50, batchFailed: 2 }).pause).toBe(false)
  })
})

describe('planBatches', () => {
  it('divide en tandas del tamaño pedido', () => {
    expect(planBatches([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]])
  })
})
