import 'server-only'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { sendAlertEmail } from './send-email'
import { sendAlertWhatsApp } from './send-whatsapp'

export type AlertInput = {
  tenantId: string
  phoneId?: string | null
  source: 'meta' | 'numero' | 'nosotros' | 'consumo' | 'campana'
  severity: 'aviso' | 'critico'
  title: string
  body: string
  /** Una alerta con la misma clave no se repite (p. ej. por día o por umbral). */
  dedupeKey: string
}

/** Guarda la alerta y, si es nueva, avisa al dueño por correo y WhatsApp. */
export async function raiseAlert(alert: AlertInput): Promise<boolean> {
  const db = supabaseAdmin()
  const { data, error } = await db
    .from('alerts')
    .upsert(
      {
        tenant_id: alert.tenantId,
        phone_id: alert.phoneId ?? null,
        source: alert.source,
        severity: alert.severity,
        title: alert.title,
        body: alert.body,
        dedupe_key: alert.dedupeKey,
      },
      { onConflict: 'tenant_id,dedupe_key', ignoreDuplicates: true },
    )
    .select('id')
  if (error) throw new Error(`alerts: ${error.message}`)
  const id = data?.[0]?.id
  if (id === undefined) return false

  const { data: tenant } = await db
    .from('tenants')
    .select('name, alert_email, alert_whatsapp')
    .eq('id', alert.tenantId)
    .single()

  const channels: string[] = []
  if (tenant?.alert_email && (await sendAlertEmail(tenant.alert_email, alert.title, alert.body))) channels.push('correo')
  if (tenant?.alert_whatsapp && (await sendAlertWhatsApp(tenant.alert_whatsapp, alert.title, alert.body))) {
    channels.push('whatsapp')
  }
  await db
    .from('alerts')
    .update({ channels, delivered_at: channels.length ? new Date().toISOString() : null })
    .eq('id', id)
  return true
}
