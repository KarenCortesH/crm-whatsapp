'use server'

import { redirect } from 'next/navigation'
import { z } from 'zod'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { createKapsoCustomer } from '@/lib/kapso/customers'
import { requireUser } from '@/modules/tenancy/session'

export type FormState = { error?: string; ok?: string } | null

const schema = z.object({
  name: z.string().trim().min(2, 'Escribe el nombre de tu negocio').max(120),
  alertEmail: z.string().trim().email('Correo inválido').optional().or(z.literal('')),
})

/** Crea la empresa (tenant), su "customer" en Kapso y deja al usuario como dueño. */
export async function createTenantAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const { user } = await requireUser()
  const parsed = schema.safeParse({ name: formData.get('name'), alertEmail: formData.get('alertEmail') ?? '' })
  if (!parsed.success) return { error: parsed.error.issues[0].message }

  const db = supabaseAdmin()
  const { data: existing } = await db.from('memberships').select('tenant_id').eq('user_id', user.id).limit(1)
  if (existing?.length) redirect('/panel')

  const { data: tenant, error } = await db
    .from('tenants')
    .insert({ name: parsed.data.name, alert_email: parsed.data.alertEmail || user.email })
    .select('id')
    .single()
  if (error || !tenant) return { error: 'No pudimos crear tu empresa. Intenta de nuevo.' }

  const { error: mErr } = await db.from('memberships').insert({ tenant_id: tenant.id, user_id: user.id, role: 'owner' })
  if (mErr) {
    await db.from('tenants').delete().eq('id', tenant.id)
    return { error: 'No pudimos crear tu empresa. Intenta de nuevo.' }
  }

  try {
    const customer = await createKapsoCustomer(parsed.data.name, tenant.id)
    await db.from('tenants').update({ kapso_customer_id: customer.id }).eq('id', tenant.id)
  } catch (err) {
    console.error('[onboarding] no se creó el customer en Kapso', err)
    // La empresa queda creada; se reintenta al conectar el número.
  }
  redirect('/panel/conectar')
}
