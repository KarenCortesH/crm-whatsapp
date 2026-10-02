'use server'

import { redirect } from 'next/navigation'
import { serverEnv } from '@/lib/env'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { createKapsoCustomer } from '@/lib/kapso/customers'
import { createSetupLink } from '@/lib/kapso/setup-links'
import { requireTenant } from '@/modules/tenancy/session'
import type { ConnectionType } from '@/lib/kapso/types'

export type ConnectState = { error?: string } | null

/** Genera el setup link de Kapso (el cliente conecta SU número con SU Facebook) y lo redirige allá. */
export async function startConnectionAction(_prev: ConnectState, formData: FormData): Promise<ConnectState> {
  const { tenant, role } = await requireTenant()
  if (role !== 'owner') return { error: 'Solo el dueño de la cuenta puede conectar el número.' }

  const env = serverEnv()
  const db = supabaseAdmin()
  const mode = formData.get('modo')
  const connectionTypes: ConnectionType[] = mode === 'coexistencia' ? ['coexistence'] : ['dedicated']

  let customerId = tenant.kapso_customer_id
  let url: string
  try {
    if (!customerId) {
      const customer = await createKapsoCustomer(tenant.name, tenant.id)
      customerId = customer.id
      await db.from('tenants').update({ kapso_customer_id: customerId }).eq('id', tenant.id)
    }
    const link = await createSetupLink({
      customerId,
      successRedirectUrl: `${env.APP_URL}/panel/conectar/listo`,
      failureRedirectUrl: `${env.APP_URL}/panel/conectar/listo?fallo=1`,
      connectionTypes,
    })
    await db.from('setup_links').insert({
      tenant_id: tenant.id,
      kapso_setup_link_id: link.id,
      url: link.url,
      status: link.whatsapp_setup_status,
      expires_at: link.expires_at,
    })
    url = link.url
  } catch (err) {
    console.error('[conectar] no se pudo crear el setup link', err)
    return { error: 'Somos nosotros: no pudimos generar el enlace de conexión. Intenta en unos minutos.' }
  }
  redirect(url)
}
