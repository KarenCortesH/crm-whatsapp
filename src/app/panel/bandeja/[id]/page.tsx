import Link from 'next/link'
import { notFound } from 'next/navigation'
import { AssignSelect } from '@/components/inbox/assign-select'
import { MarkRead } from '@/components/inbox/mark-read'
import { MessageThread, type ThreadMessage } from '@/components/inbox/message-thread'
import { NotesPanel, type NoteRow } from '@/components/inbox/notes-panel'
import { RealtimeRefresh } from '@/components/inbox/realtime-refresh'
import { ReplyBox } from '@/components/inbox/reply-box'
import { StatusButtons } from '@/components/inbox/status-buttons'
import { TagPicker } from '@/components/inbox/tag-picker'
import { serviceWindow } from '@/modules/inbox/service-window'
import { requireTenant } from '@/modules/tenancy/session'

export default async function ConversacionPage({ params }: PageProps<'/panel/bandeja/[id]'>) {
  const { id } = await params
  const { supabase, tenant } = await requireTenant()

  const { data: conversation } = await supabase
    .from('conversations')
    .select('id, status, assigned_to, last_inbound_at, unread_count, contacts(name, wa_id, marketing_opted_out), conversation_tags(tag_id)')
    .eq('id', id)
    .eq('tenant_id', tenant.id)
    .maybeSingle()
  if (!conversation) notFound()

  const [{ data: messages }, { data: notes }, { data: tags }, { data: members }, { data: quickReplies }] = await Promise.all([
    supabase.from('messages').select('id, direction, body, msg_type, status, sent_at, error_code, error_title').eq('conversation_id', id).order('sent_at').limit(300),
    supabase.from('notes').select('id, body, created_at, author_id').eq('conversation_id', id).order('created_at'),
    supabase.from('tags').select('id, name, color').eq('tenant_id', tenant.id).order('name'),
    supabase.from('memberships').select('user_id, display_name, role').eq('tenant_id', tenant.id),
    supabase.from('quick_replies').select('shortcut, body').eq('tenant_id', tenant.id).order('shortcut'),
  ])

  const c = conversation as unknown as {
    id: string
    status: string
    assigned_to: string | null
    last_inbound_at: string | null
    unread_count: number
    contacts: { name: string | null; wa_id: string; marketing_opted_out: boolean } | null
    conversation_tags: Array<{ tag_id: string }>
  }
  const win = serviceWindow(c.last_inbound_at)
  const memberNames = new Map((members ?? []).map((m) => [m.user_id, m.display_name ?? (m.role === 'owner' ? 'Dueño' : 'Agente')]))

  return (
    <section className="flex flex-col gap-4">
      <RealtimeRefresh table="messages" tenantId={tenant.id} conversationId={id} />
      {c.unread_count > 0 && <MarkRead conversationId={id} />}
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link href="/panel/bandeja" className="text-sm text-teal-800">← Bandeja</Link>
          <h1 className="text-xl font-bold">{c.contacts?.name ?? `+${c.contacts?.wa_id}`}</h1>
          <p className="text-sm text-slate-600">
            +{c.contacts?.wa_id}
            {c.contacts?.marketing_opted_out ? ' · dado de baja de marketing' : ''}
          </p>
        </div>
        <StatusButtons conversationId={id} status={c.status} />
      </header>

      <div className="grid gap-4 lg:grid-cols-[1fr_18rem]">
        <div className="flex flex-col gap-3">
          <MessageThread messages={(messages ?? []) as ThreadMessage[]} />
          <ReplyBox conversationId={id} windowOpen={win.open} hoursLeft={win.hoursLeft} quickReplies={quickReplies ?? []} />
        </div>
        <aside className="flex flex-col gap-4">
          <AssignSelect conversationId={id} assignedTo={c.assigned_to} members={(members ?? []).map((m) => ({ id: m.user_id, name: memberNames.get(m.user_id)! }))} />
          <TagPicker conversationId={id} tags={tags ?? []} selected={c.conversation_tags.map((t) => t.tag_id)} />
          <NotesPanel conversationId={id} notes={((notes ?? []) as NoteRow[]).map((n) => ({ ...n, author: memberNames.get(n.author_id ?? '') ?? 'Equipo' }))} />
        </aside>
      </div>
    </section>
  )
}
