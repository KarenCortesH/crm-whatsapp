import { describe, expect, it } from 'vitest'
import type { KapsoHealthCheck } from '@/lib/kapso/types'
import { diagnoseHealth, type HealthInput } from './diagnose'

const now = new Date('2026-10-01T12:00:00Z')

function healthy(overrides: Partial<KapsoHealthCheck['checks']> = {}): KapsoHealthCheck {
  return {
    status: 'healthy',
    timestamp: now.toISOString(),
    checks: {
      phone_number_access: { passed: true, details: { quality_rating: 'GREEN', throughput_tier: 'TIER_1K' } },
      phone_number_connection: { passed: true, details: { status: 'CONNECTED' } },
      messaging_health: {
        passed: true,
        overall_status: 'AVAILABLE',
        details: { entities: [{ entity_type: 'PHONE_NUMBER', can_send_message: 'AVAILABLE' }] },
      },
      webhook_subscription: { passed: true, details: { subscribed: true } },
      webhook_verified: { passed: true },
      ...overrides,
    },
  }
}

function input(over: Partial<HealthInput> = {}): HealthInput {
  return {
    check: healthy(),
    now,
    lastInboundAt: new Date('2026-10-01T11:00:00Z'),
    lastWebhookAt: new Date('2026-10-01T11:00:00Z'),
    sent24h: 0,
    failed24h: 0,
    ...over,
  }
}

describe('diagnoseHealth', () => {
  it('número sano → verde sin hallazgos', () => {
    const r = diagnoseHealth(input())
    expect(r.color).toBe('verde')
    expect(r.findings).toHaveLength(0)
    expect(r.qualityRating).toBe('GREEN')
    expect(r.throughputTier).toBe('TIER_1K')
  })

  it('calidad roja → rojo y la culpa es del número', () => {
    const r = diagnoseHealth(
      input({ check: healthy({ phone_number_access: { passed: true, details: { quality_rating: 'RED' } } }) }),
    )
    expect(r.color).toBe('rojo')
    expect(r.findings[0].source).toBe('numero')
    expect(r.headline.startsWith('Es tu número')).toBe(true)
  })

  it('calidad amarilla → amarillo', () => {
    const r = diagnoseHealth(
      input({ check: healthy({ phone_number_access: { passed: true, details: { quality_rating: 'YELLOW' } } }) }),
    )
    expect(r.color).toBe('amarillo')
  })

  it('Meta no responde → es Meta', () => {
    const r = diagnoseHealth(input({ check: healthy({ phone_number_access: { passed: false, error: 'timeout' } }) }))
    expect(r.findings.map((f) => f.source)).toContain('meta')
    expect(r.color).toBe('rojo')
  })

  it('no pudimos consultar Kapso → somos nosotros', () => {
    const r = diagnoseHealth(input({ check: null, checkError: 'HTTP 503' }))
    expect(r.color).toBe('rojo')
    expect(r.headline).toContain('Somos nosotros')
  })

  it('webhook sin suscripción → somos nosotros', () => {
    const r = diagnoseHealth(input({ check: healthy({ webhook_subscription: { passed: false } }) }))
    expect(r.findings.some((f) => f.code === 'webhook_unsubscribed' && f.source === 'nosotros')).toBe(true)
  })

  it('WABA bloqueada (p. ej. pago) → es tu número', () => {
    const r = diagnoseHealth(
      input({
        check: healthy({
          messaging_health: {
            passed: false,
            overall_status: 'BLOCKED',
            details: { entities: [{ entity_type: 'WABA', can_send_message: 'BLOCKED', errors: [{ error_description: 'Payment issue' }] }] },
          },
        }),
      }),
    )
    const f = r.findings.find((x) => x.code === 'messaging_waba_blocked')
    expect(f?.source).toBe('numero')
    expect(f?.message).toContain('Payment issue')
  })

  it('silencio de webhooks de más de 24 h → aviso nuestro', () => {
    const r = diagnoseHealth(input({ lastWebhookAt: new Date('2026-09-29T00:00:00Z') }))
    expect(r.findings.some((f) => f.code === 'webhook_silent')).toBe(true)
    expect(r.color).toBe('amarillo')
  })

  it('tasa de fallos alta solo cuenta con volumen suficiente', () => {
    expect(diagnoseHealth(input({ sent24h: 5, failed24h: 5 })).findings).toHaveLength(0)
    const r = diagnoseHealth(input({ sent24h: 100, failed24h: 25 }))
    expect(r.findings[0].code).toBe('high_failure_rate')
    expect(r.color).toBe('rojo')
  })
})
