import 'server-only'
import { redirect } from 'next/navigation'
import { createSupabaseServer } from '@/lib/supabase/server'

export type Tenant = {
  id: string
  name: string
  kapso_customer_id: string | null
  monthly_spend_cap_usd: number | null
  alert_email: string | null
  alert_whatsapp: string | null
}

export type TenantSession = {
  supabase: Awaited<ReturnType<typeof createSupabaseServer>>
  userId: string
  email: string | null
  role: 'owner' | 'agent'
  tenant: Tenant
}

/** Usuario autenticado y su tenant. Redirige a ingresar o a crear la empresa si falta algo. */
export async function requireTenant(): Promise<TenantSession> {
  const supabase = await createSupabaseServer()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/ingresar')

  const { data } = await supabase
    .from('memberships')
    .select('role, tenants(id, name, kapso_customer_id, monthly_spend_cap_usd, alert_email, alert_whatsapp)')
    .eq('user_id', user.id)
    .limit(1)
    .maybeSingle()

  const tenant = (Array.isArray(data?.tenants) ? data.tenants[0] : data?.tenants) as Tenant | undefined
  if (!data || !tenant) redirect('/panel/empezar')

  return { supabase, userId: user.id, email: user.email ?? null, role: data.role as 'owner' | 'agent', tenant }
}

export async function requireUser() {
  const supabase = await createSupabaseServer()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/ingresar')
  return { supabase, user }
}
