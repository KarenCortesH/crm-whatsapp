import type { KapsoHealthCheck } from '@/lib/kapso/types'

export type HealthSource = 'meta' | 'numero' | 'nosotros'
export type HealthColor = 'verde' | 'amarillo' | 'rojo'

export type HealthFinding = {
  source: HealthSource
  severity: 'aviso' | 'critico'
  code: string
  message: string
}

export type HealthInput = {
  check: KapsoHealthCheck | null
  /** Error al consultar Kapso (red, 5xx, credenciales). */
  checkError?: string
  now: Date
  lastInboundAt: Date | null
  lastWebhookAt: Date | null
  sent24h: number
  failed24h: number
}

export type HealthReport = {
  color: HealthColor
  qualityRating: string | null
  throughputTier: string | null
  messaging: string | null
  findings: HealthFinding[]
  headline: string
}

export const SOURCE_LABEL: Record<HealthSource, string> = {
  meta: 'Es Meta',
  numero: 'Es tu número',
  nosotros: 'Somos nosotros',
}

const HOURS = 3_600_000
const WEBHOOK_SILENCE_HOURS = 24
const FAILURE_RATE_WARN = 0.05
const FAILURE_RATE_CRITICAL = 0.2
const MIN_SENDS_FOR_RATE = 20

export function diagnoseHealth(input: HealthInput): HealthReport {
  const findings: HealthFinding[] = []
  const { check } = input

  if (!check) {
    findings.push({
      source: 'nosotros',
      severity: 'critico',
      code: 'health_unreachable',
      message: `No pudimos consultar el estado del número${input.checkError ? ` (${input.checkError})` : ''}. Estamos revisándolo.`,
    })
  } else {
    collectFromCheck(check, findings)
  }

  const quality = check?.checks.phone_number_access?.details?.quality_rating ?? null
  const tier = check?.checks.phone_number_access?.details?.throughput_tier ?? null
  const messaging = check?.checks.messaging_health?.overall_status ?? check?.checks.messaging_health?.details?.can_send_message ?? null

  if (input.lastWebhookAt === null || input.now.getTime() - input.lastWebhookAt.getTime() > WEBHOOK_SILENCE_HOURS * HOURS) {
    const subscribed = check?.checks.webhook_subscription?.passed !== false
    if (subscribed && input.lastInboundAt !== null) {
      findings.push({
        source: 'nosotros',
        severity: 'aviso',
        code: 'webhook_silent',
        message: `No recibimos eventos en más de ${WEBHOOK_SILENCE_HOURS} horas. Si te escribieron en ese tiempo, el problema es nuestro.`,
      })
    }
  }

  if (input.sent24h >= MIN_SENDS_FOR_RATE) {
    const rate = input.failed24h / input.sent24h
    if (rate >= FAILURE_RATE_WARN) {
      findings.push({
        source: 'numero',
        severity: rate >= FAILURE_RATE_CRITICAL ? 'critico' : 'aviso',
        code: 'high_failure_rate',
        message: `${Math.round(rate * 100)}% de los envíos de las últimas 24 h fallaron (${input.failed24h} de ${input.sent24h}). Revisa los motivos en "Envíos fallidos".`,
      })
    }
  }

  const color = colorFrom(findings, quality)
  return {
    color,
    qualityRating: quality,
    throughputTier: tier,
    messaging,
    findings,
    headline: headlineFor(color, findings),
  }
}

function collectFromCheck(check: KapsoHealthCheck, findings: HealthFinding[]) {
  const c = check.checks

  if (check.status === 'error') {
    findings.push({
      source: 'nosotros',
      severity: 'critico',
      code: 'health_error',
      message: 'La verificación del número falló de nuestro lado. Lo estamos revisando.',
    })
  }

  if (c.phone_number_access && !c.phone_number_access.passed) {
    findings.push({
      source: 'meta',
      severity: 'critico',
      code: 'meta_access_failed',
      message: 'Meta no está respondiendo por tu número en este momento. Suele ser temporal; si sigue así, revisa tu cuenta en Meta Business.',
    })
  }

  const quality = c.phone_number_access?.details?.quality_rating
  if (quality === 'RED') {
    findings.push({
      source: 'numero',
      severity: 'critico',
      code: 'quality_red',
      message: 'La calidad de tu número está en ROJO: muchos clientes bloquearon o reportaron tus mensajes. Pausa campañas de marketing ya.',
    })
  } else if (quality === 'YELLOW') {
    findings.push({
      source: 'numero',
      severity: 'aviso',
      code: 'quality_yellow',
      message: 'La calidad de tu número bajó a AMARILLO. Envía solo a quien te dio permiso y baja la frecuencia de marketing.',
    })
  }

  const connection = c.phone_number_connection?.details?.status
  if (connection === 'DISCONNECTED') {
    findings.push({
      source: 'numero',
      severity: 'critico',
      code: 'disconnected',
      message: 'Tu número se desconectó de WhatsApp. Vuelve a conectarlo desde "Conectar número".',
    })
  }

  for (const entity of c.messaging_health?.details?.entities ?? []) {
    const state = entity.can_send_message
    if (!state || state === 'AVAILABLE') continue
    const severity = state === 'BLOCKED' ? 'critico' : 'aviso'
    const reason = entity.errors?.[0]?.error_description
    const suffix = reason ? ` Motivo de Meta: ${reason}` : ''
    if (entity.entity_type === 'PHONE_NUMBER' || entity.entity_type === 'WABA') {
      findings.push({
        source: 'numero',
        severity,
        code: `messaging_${entity.entity_type.toLowerCase()}_${state.toLowerCase()}`,
        message:
          entity.entity_type === 'WABA'
            ? `Tu cuenta de WhatsApp Business tiene el envío ${state === 'BLOCKED' ? 'bloqueado' : 'limitado'}. Revisa el método de pago y la verificación del negocio en Meta.${suffix}`
            : `Tu número tiene el envío ${state === 'BLOCKED' ? 'bloqueado' : 'limitado'} por Meta.${suffix}`,
      })
    } else {
      findings.push({
        source: entity.entity_type === 'APP' ? 'nosotros' : 'meta',
        severity,
        code: `messaging_${String(entity.entity_type).toLowerCase()}_${state.toLowerCase()}`,
        message:
          entity.entity_type === 'APP'
            ? 'La aplicación con la que nos conectamos a Meta tiene una restricción. Ya estamos en ello.'
            : `Meta restringió el envío a nivel de tu negocio.${suffix}`,
      })
    }
  }

  if (c.webhook_subscription && !c.webhook_subscription.passed) {
    findings.push({
      source: 'nosotros',
      severity: 'critico',
      code: 'webhook_unsubscribed',
      message: 'No estamos suscritos a los eventos de tu número: los mensajes nuevos podrían no llegar al CRM. Lo estamos corrigiendo.',
    })
  }
}

function colorFrom(findings: HealthFinding[], quality: string | null): HealthColor {
  if (quality === 'RED' || findings.some((f) => f.severity === 'critico')) return 'rojo'
  if (quality === 'YELLOW' || findings.length > 0) return 'amarillo'
  return 'verde'
}

function headlineFor(color: HealthColor, findings: HealthFinding[]): string {
  if (color === 'verde') return 'Todo en orden. Tu número está sano.'
  const worst = findings.find((f) => f.severity === 'critico') ?? findings[0]
  return `${SOURCE_LABEL[worst.source]}: ${worst.message}`
}
