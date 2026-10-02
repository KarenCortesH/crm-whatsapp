'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { normalizeWaId, parseContactsCsv } from '@/modules/contacts/parse-contacts-csv'
import { requireTenant } from '@/modules/tenancy/session'

export type ContactsState = { error?: string; ok?: string } | null

const METHODS = ['formulario_web', 'mensaje_whatsapp', 'presencial', 'importacion', 'otro'] as const

const consentSchema = z.object({
  method: z.enum(METHODS, { message: 'Elige cómo te dio el permiso' }),
  sourceDetail: z.string().trim().min(3, 'Describe dónde o cómo dio el permiso (ej. "formulario de la web, campaña octubre")').max(300),
  evidence: z.string().trim().max(1000).optional(),
  grantedAt: z.coerce.date({ message: 'Fecha del permiso inválida' }).refine((d) => d.getTime() <= Date.now() + 60_000, 'La fecha del permiso no puede ser futura'),
})

function readConsent(formData: FormData) {
  return consentSchema.safeParse({
    method: formData.get('method'),
    sourceDetail: formData.get('sourceDetail'),
    evidence: formData.get('evidence') || undefined,
    grantedAt: formData.get('grantedAt') || new Date().toISOString(),
  })
}

/** Alta de contacto: el permiso de marketing es obligatorio y queda registrado (quién, cuándo, cómo). */
export async function addContactAction(_prev: ContactsState, formData: FormData): Promise<ContactsState> {
  const { supabase, tenant, userId } = await requireTenant()
  const waId = normalizeWaId(String(formData.get('phone') ?? ''))
  if (!waId) return { error: 'Número inválido. Escríbelo con indicativo, ej. +57 300 123 4567.' }
  const consent = readConsent(formData)
  if (!consent.success) return { error: consent.error.issues[0].message }

  const { data: contact, error } = await supabase
    .from('contacts')
    .upsert({ tenant_id: tenant.id, wa_id: waId, name: String(formData.get('name') ?? '').trim() || null }, { onConflict: 'tenant_id,wa_id' })
    .select('id')
    .single()
  if (error || !contact) return { error: 'No pudimos guardar el contacto.' }

  const { error: cErr } = await supabase.from('consents').insert({
    tenant_id: tenant.id,
    contact_id: contact.id,
    purpose: 'marketing',
    method: consent.data.method,
    source_detail: consent.data.sourceDetail,
    evidence: consent.data.evidence ?? null,
    recorded_by: userId,
    granted_at: consent.data.grantedAt.toISOString(),
  })
  if (cErr) return { error: 'Guardamos el contacto, pero no el permiso. Intenta de nuevo.' }
  revalidatePath('/panel/contactos')
  return { ok: 'Contacto y permiso guardados.' }
}

export async function importContactsAction(_prev: ContactsState, formData: FormData): Promise<ContactsState> {
  const { supabase, tenant, userId } = await requireTenant()
  const file = formData.get('file')
  if (!(file instanceof File) || file.size === 0) return { error: 'Elige un archivo CSV.' }
  if (file.size > 2_000_000) return { error: 'El archivo es muy grande (máximo 2 MB).' }
  const consent = readConsent(formData)
  if (!consent.success) return { error: consent.error.issues[0].message }

  const { contacts, rejected } = parseContactsCsv(await file.text())
  if (!contacts.length) return { error: 'No encontramos números válidos en el archivo.' }

  const { data: saved, error } = await supabase
    .from('contacts')
    .upsert(contacts.map((c) => ({ tenant_id: tenant.id, wa_id: c.waId, name: c.name })), { onConflict: 'tenant_id,wa_id' })
    .select('id')
  if (error || !saved) return { error: 'No pudimos importar los contactos.' }

  const { error: cErr } = await supabase.from('consents').insert(
    saved.map((c) => ({
      tenant_id: tenant.id,
      contact_id: c.id,
      purpose: 'marketing',
      method: consent.data.method,
      source_detail: `${consent.data.sourceDetail} (importado de ${file.name})`,
      evidence: consent.data.evidence ?? null,
      recorded_by: userId,
      granted_at: consent.data.grantedAt.toISOString(),
    })),
  )
  if (cErr) return { error: 'Importamos los contactos, pero no los permisos. Intenta de nuevo.' }
  revalidatePath('/panel/contactos')
  return { ok: `Importados ${saved.length} contactos con permiso.${rejected.length ? ` ${rejected.length} filas no tenían un número válido.` : ''}` }
}

export async function revokeConsentAction(formData: FormData) {
  const { supabase, tenant } = await requireTenant()
  const contactId = String(formData.get('contactId') ?? '')
  await supabase
    .from('consents')
    .update({ revoked_at: new Date().toISOString() })
    .eq('tenant_id', tenant.id)
    .eq('contact_id', contactId)
    .is('revoked_at', null)
  revalidatePath('/panel/contactos')
}
