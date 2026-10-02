'use server'

import { revalidatePath } from 'next/cache'
import { runHealthChecks } from '@/modules/health/run-health-check'
import { requireTenant } from '@/modules/tenancy/session'

export async function recheckHealthAction(): Promise<{ error?: string } | null> {
  const { tenant } = await requireTenant()
  try {
    await runHealthChecks(new Date(), tenant.id)
  } catch (err) {
    console.error('[salud] revisión manual falló', err)
    return { error: 'No pudimos revisar ahora. Intenta en un minuto.' }
  }
  revalidatePath('/panel')
  return null
}
