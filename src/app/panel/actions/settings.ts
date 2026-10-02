'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { requireTenant } from '@/modules/tenancy/session'

export type SettingsState = { error?: string; ok?: string } | null

const schema = z.object({
  cap: z.union([z.literal(''), z.coerce.number().min(0, 'El tope no puede ser negativo').max(100000)]),
  alertEmail: z.union([z.literal(''), z.string().trim().email('Correo inválido')]),
  alertWhatsapp: z.union([z.literal(''), z.string().trim().regex(/^\+?\d{8,15}$/, 'Escribe el número con indicativo, ej. +573001234567')]),
})

export async function saveAlertSettingsAction(_prev: SettingsState, formData: FormData): Promise<SettingsState> {
  const { supabase, tenant, role } = await requireTenant()
  if (role !== 'owner') return { error: 'Solo el dueño puede cambiar el tope y las alertas.' }
  const parsed = schema.safeParse({
    cap: formData.get('cap') ?? '',
    alertEmail: formData.get('alertEmail') ?? '',
    alertWhatsapp: formData.get('alertWhatsapp') ?? '',
  })
  if (!parsed.success) return { error: parsed.error.issues[0].message }

  const { error } = await supabase
    .from('tenants')
    .update({
      monthly_spend_cap_usd: parsed.data.cap === '' ? null : parsed.data.cap,
      alert_email: parsed.data.alertEmail || null,
      alert_whatsapp: parsed.data.alertWhatsapp || null,
    })
    .eq('id', tenant.id)
  if (error) return { error: 'No pudimos guardar. Intenta de nuevo.' }
  revalidatePath('/panel/consumo')
  return { ok: 'Guardado.' }
}
