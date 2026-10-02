import { describe, expect, it } from 'vitest'
import { computeMeter, countryFromWaId, monthElapsedFraction, type DeliveredMessage } from './compute-meter'

const rates = { '57': { marketing: 0.0125, utility: 0.0008, authentication: 0.0008, service: 0.0004 } }

function many(n: number, m: Omit<DeliveredMessage, never>): DeliveredMessage[] {
  return Array.from({ length: n }, () => ({ ...m }))
}

describe('computeMeter', () => {
  const mid = new Date('2026-10-16T12:00:00Z')

  it('los primeros 1.000 de servicio por número son gratis', () => {
    const r = computeMeter({
      messages: many(1200, { phoneId: 'p1', category: 'service', country: '57' }),
      rates,
      now: mid,
      capUsd: null,
    })
    const service = r.lines.find((l) => l.category === 'service')!
    expect(service.count).toBe(1200)
    expect(service.billableCount).toBe(200)
    expect(service.costUsd).toBeCloseTo(200 * 0.0004)
    expect(r.freeServiceRemaining).toBe(0)
  })

  it('la franquicia gratis es por número, no por cliente', () => {
    const r = computeMeter({
      messages: [
        ...many(800, { phoneId: 'p1', category: 'service', country: '57' }),
        ...many(800, { phoneId: 'p2', category: 'service', country: '57' }),
      ],
      rates,
      now: mid,
      capUsd: null,
    })
    expect(r.totalUsd).toBe(0)
    expect(r.freeServiceRemaining).toBe(400)
  })

  it('suma marketing y utilidad y proyecta a fin de mes', () => {
    const r = computeMeter({
      messages: [
        ...many(100, { phoneId: 'p1', category: 'marketing', country: '57' }),
        ...many(100, { phoneId: 'p1', category: 'utility', country: '57' }),
      ],
      rates,
      now: mid,
      capUsd: null,
    })
    expect(r.totalUsd).toBeCloseTo(1.33)
    expect(r.projectedUsd).toBeCloseTo(1.33 / monthElapsedFraction(mid), 2)
    expect(r.projectedUsd).toBeGreaterThan(r.totalUsd)
  })

  it('alertas al 50, 80 y 100 % del tope', () => {
    const base = { rates, now: mid }
    const msg = (n: number) => many(n, { phoneId: 'p1', category: 'marketing', country: '57' })
    expect(computeMeter({ ...base, messages: msg(39), capUsd: 1 }).thresholdsReached).toEqual([])
    expect(computeMeter({ ...base, messages: msg(40), capUsd: 1 }).capUsedPct).toBe(50)
    expect(computeMeter({ ...base, messages: msg(40), capUsd: 1 }).thresholdsReached).toEqual([50])
    expect(computeMeter({ ...base, messages: msg(65), capUsd: 1 }).thresholdsReached).toEqual([50, 80])
    expect(computeMeter({ ...base, messages: msg(80), capUsd: 1 }).thresholdsReached).toEqual([50, 80, 100])
  })

  it('sin tarifa cargada avisa que el total es parcial', () => {
    const r = computeMeter({
      messages: many(3, { phoneId: 'p1', category: 'marketing', country: '52' }),
      rates,
      now: mid,
      capUsd: null,
    })
    expect(r.missingRates).toBe(true)
    expect(r.lines.find((l) => l.category === 'marketing')!.billableCount).toBe(3)
  })

  it('sin mensajes quedan los 1.000 gratis', () => {
    expect(computeMeter({ messages: [], rates, now: mid, capUsd: 10 }).freeServiceRemaining).toBe(1000)
  })
})

describe('countryFromWaId', () => {
  it('detecta códigos de LatAm por prefijo más largo', () => {
    expect(countryFromWaId('573001234567')).toBe('57')
    expect(countryFromWaId('5215512345678')).toBe('52')
    expect(countryFromWaId('593991234567')).toBe('593')
    expect(countryFromWaId('+1 415 555 0000')).toBe('1')
  })
})
