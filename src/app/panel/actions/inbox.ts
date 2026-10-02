'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { sendText } from '@/lib/kapso/messages'
import { KapsoApiError } from '@/lib/kapso/http'
import { expandQuickReply, serviceWindow } from '@/modules/inbox/service-window'
import { requireTenant } from '@/modules/tenancy/session'

export type InboxState = { error?: string; ok?: string } | null

async function loadConversation(conversationId: string) {
  const session = await requireTenant()
  const { data } = await session.supabase
    .from('conversations')
    .select('id, last_inbound_at, phone_numbers(phone_number_id), contacts(wa_id)')
    .eq('id', conversationId)
    .eq('tenant_id', session.tenant.id)
    .maybeSingle()
  return { session, conversation: data as unknown as {
    id: string
    last_inbound_at: string | null
    phone_numbers: { phone_number_id: string }
    contacts: { wa_id: string }
  } | null }
}

export async function sendReplyAction(_prev: InboxState, formData: FormData): Promise<InboxState> {
  const conversationId = String(formData.get('conversationId') ?? '')
  const { session, conversation } = await loadConversation(conversationId)
  if (!conversation) return { error: 'Conversación no encontrada.' }

  const { data: replies } = await session.supabase.from('quick_replies').select('shortcut, body').eq('tenant_id', session.tenant.id)
  const text = expandQuickReply(String(formData.get('text') ?? '').trim(), replies ?? [])
  if (!text) return { error: 'Escribe un mensaje.' }
  if (text.length > 4096) return { error: 'El mensaje es muy largo (máximo 4.096 caracteres).' }

  if (!serviceWindow(conversation.last_inbound_at).open) {
    return { error: 'Pasaron más de 24 h desde el último mensaje del cliente: solo puedes enviarle una plantilla aprobada.' }
  }

  try {
    const res = await sendText(conversation.phone_numbers.phone_number_id, conversation.contacts.wa_id, text)
    const wamid = res.messages?.[0]?.id
    if (wamid) {
      const db = supabaseAdmin()
      await db.rpc('ingest_message', {
        p_phone_number_id: conversation.phone_numbers.phone_number_id,
        p_wamid: wamid,
        p_direction: 'outbound',
        p_status: 'sent',
        p_contact_wa_id: conversation.contacts.wa_id,
        p_contact_name: null,
        p_msg_type: 'text',
        p_body: text,
        p_sent_at: new Date().toISOString(),
        p_error_code: null,
        p_error_title: null,
        p_kapso_conversation_id: null,
      })
      await db.from('messages').update({ sent_by: session.userId }).eq('wamid', wamid)
    }
  } catch (err) {
    console.error('[bandeja] envío falló', err)
    const status = err instanceof KapsoApiError ? err.status : 0
    return { error: status >= 500 || status === 0 ? 'Somos nosotros: no pudimos enviar. Intenta de nuevo.' : 'Meta rechazó el mensaje. Revisa la salud del canal.' }
  }
  revalidatePath(`/panel/bandeja/${conversationId}`)
  return { ok: 'Enviado' }
}

export async function addNoteAction(_prev: InboxState, formData: FormData): Promise<InboxState> {
  const { supabase, tenant, userId } = await requireTenant()
  const body = String(formData.get('body') ?? '').trim()
  const conversationId = String(formData.get('conversationId') ?? '')
  if (!body) return { error: 'La nota está vacía.' }
  const { error } = await supabase.from('notes').insert({ tenant_id: tenant.id, conversation_id: conversationId, author_id: userId, body })
  if (error) return { error: 'No pudimos guardar la nota.' }
  revalidatePath(`/panel/bandeja/${conversationId}`)
  return { ok: 'Nota guardada' }
}

export async function assignAction(formData: FormData) {
  const { supabase, tenant } = await requireTenant()
  const conversationId = String(formData.get('conversationId') ?? '')
  const assignee = String(formData.get('assignee') ?? '')
  if (assignee) {
    const { data: member } = await supabase.from('memberships').select('user_id').eq('tenant_id', tenant.id).eq('user_id', assignee).maybeSingle()
    if (!member) return
  }
  await supabase.from('conversations').update({ assigned_to: assignee || null }).eq('id', conversationId).eq('tenant_id', tenant.id)
  revalidatePath(`/panel/bandeja/${conversationId}`)
}

export async function setConversationStatusAction(formData: FormData) {
  const { supabase, tenant } = await requireTenant()
  const conversationId = String(formData.get('conversationId') ?? '')
  const status = z.enum(['abierta', 'pendiente', 'cerrada']).safeParse(formData.get('status'))
  if (!status.success) return
  await supabase.from('conversations').update({ status: status.data }).eq('id', conversationId).eq('tenant_id', tenant.id)
  revalidatePath(`/panel/bandeja/${conversationId}`)
  revalidatePath('/panel/bandeja')
}

export async function toggleTagAction(formData: FormData) {
  const { supabase, tenant } = await requireTenant()
  const conversationId = String(formData.get('conversationId') ?? '')
  const tagId = String(formData.get('tagId') ?? '')
  const { data: existing } = await supabase.from('conversation_tags').select('tag_id').eq('conversation_id', conversationId).eq('tag_id', tagId).maybeSingle()
  if (existing) {
    await supabase.from('conversation_tags').delete().eq('conversation_id', conversationId).eq('tag_id', tagId)
  } else {
    await supabase.from('conversation_tags').insert({ tenant_id: tenant.id, conversation_id: conversationId, tag_id: tagId })
  }
  revalidatePath(`/panel/bandeja/${conversationId}`)
}

export async function createTagAction(_prev: InboxState, formData: FormData): Promise<InboxState> {
  const { supabase, tenant } = await requireTenant()
  const name = String(formData.get('name') ?? '').trim()
  if (!name || name.length > 40) return { error: 'Nombre de etiqueta inválido.' }
  const { error } = await supabase.from('tags').insert({ tenant_id: tenant.id, name, color: String(formData.get('color') ?? '#0f766e') })
  if (error) return { error: 'Esa etiqueta ya existe.' }
  revalidatePath('/panel/bandeja', 'layout')
  return { ok: 'Etiqueta creada' }
}

export async function saveQuickReplyAction(_prev: InboxState, formData: FormData): Promise<InboxState> {
  const { supabase, tenant } = await requireTenant()
  const shortcut = String(formData.get('shortcut') ?? '').trim().replace(/^\/?/, '/')
  const body = String(formData.get('body') ?? '').trim()
  if (!/^\/[\p{L}\d_-]{1,30}$/u.test(shortcut)) return { error: 'El atajo debe ser una palabra, ej. /horario' }
  if (!body) return { error: 'Escribe el texto de la respuesta.' }
  const { error } = await supabase.from('quick_replies').upsert({ tenant_id: tenant.id, shortcut, body }, { onConflict: 'tenant_id,shortcut' })
  if (error) return { error: 'No pudimos guardar la respuesta rápida.' }
  revalidatePath('/panel/bandeja', 'layout')
  return { ok: `Guardada. Escribe ${shortcut} en el chat para usarla.` }
}

export async function markReadAction(conversationId: string) {
  const { supabase, tenant } = await requireTenant()
  await supabase.from('conversations').update({ unread_count: 0 }).eq('id', conversationId).eq('tenant_id', tenant.id)
}
