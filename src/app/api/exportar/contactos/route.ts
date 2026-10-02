import { toCsv } from '@/modules/contacts/parse-contacts-csv'
import { createSupabaseServer } from '@/lib/supabase/server'

export async function GET() {
  const supabase = await createSupabaseServer()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new Response('No autorizado', { status: 401 })

  // RLS limita las filas al tenant del usuario.
  const { data, error } = await supabase
    .from('contacts')
    .select('wa_id, name, marketing_opted_out, marketing_pref_changed_at, created_at')
    .order('created_at')
  if (error) return new Response('Error al exportar', { status: 500 })

  const csv = toCsv(
    (data ?? []).map((c) => ({
      telefono: `+${c.wa_id}`,
      nombre: c.name,
      baja_marketing: c.marketing_opted_out ? 'si' : 'no',
      fecha_baja: c.marketing_pref_changed_at,
      creado: c.created_at,
    })),
  )
  return new Response('﻿' + csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="contactos-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  })
}
