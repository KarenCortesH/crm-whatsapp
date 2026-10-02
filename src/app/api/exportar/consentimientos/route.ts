import { toCsv } from '@/modules/contacts/parse-contacts-csv'
import { createSupabaseServer } from '@/lib/supabase/server'

export async function GET() {
  const supabase = await createSupabaseServer()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new Response('No autorizado', { status: 401 })

  const { data, error } = await supabase
    .from('consents')
    .select('purpose, method, source_detail, evidence, granted_at, revoked_at, recorded_by, created_at, contacts(wa_id, name)')
    .order('created_at')
  if (error) return new Response('Error al exportar', { status: 500 })

  const rows = (data ?? []) as unknown as Array<{
    purpose: string
    method: string
    source_detail: string
    evidence: string | null
    granted_at: string
    revoked_at: string | null
    recorded_by: string | null
    created_at: string
    contacts: { wa_id: string; name: string | null } | null
  }>
  const csv = toCsv(
    rows.map((k) => ({
      telefono: k.contacts ? `+${k.contacts.wa_id}` : '',
      nombre: k.contacts?.name ?? '',
      proposito: k.purpose,
      como: k.method,
      donde: k.source_detail,
      evidencia: k.evidence,
      otorgado: k.granted_at,
      revocado: k.revoked_at,
      registrado_por: k.recorded_by,
      registrado_el: k.created_at,
    })),
  )
  return new Response('﻿' + csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="consentimientos-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  })
}
