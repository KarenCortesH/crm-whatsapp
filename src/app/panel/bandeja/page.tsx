import { ConversationList, type ConversationRow } from '@/components/inbox/conversation-list'
import { InboxFilters } from '@/components/inbox/inbox-filters'
import { InboxSettings } from '@/components/inbox/inbox-settings'
import { RealtimeRefresh } from '@/components/inbox/realtime-refresh'
import { requireTenant } from '@/modules/tenancy/session'

export default async function BandejaPage({ searchParams }: PageProps<'/panel/bandeja'>) {
  const { supabase, tenant, userId } = await requireTenant()
  const params = await searchParams
  const filter = typeof params.ver === 'string' ? params.ver : 'abiertas'
  const tag = typeof params.etiqueta === 'string' ? params.etiqueta : null

  let query = supabase
    .from('conversations')
    .select('id, status, unread_count, last_message_at, last_message_preview, assigned_to, contacts(name, wa_id), conversation_tags(tag_id, tags(name, color))')
    .eq('tenant_id', tenant.id)
    .order('last_message_at', { ascending: false, nullsFirst: false })
    .limit(100)
  if (filter === 'mias') query = query.eq('assigned_to', userId)
  if (filter === 'sin_asignar') query = query.is('assigned_to', null).neq('status', 'cerrada')
  if (filter === 'abiertas') query = query.neq('status', 'cerrada')

  const [{ data: conversations }, { data: tags }, { data: quickReplies }] = await Promise.all([
    query,
    supabase.from('tags').select('id, name, color').eq('tenant_id', tenant.id).order('name'),
    supabase.from('quick_replies').select('id, shortcut, body').eq('tenant_id', tenant.id).order('shortcut'),
  ])

  const rows = ((conversations ?? []) as unknown as ConversationRow[]).filter(
    (c) => !tag || c.conversation_tags.some((t) => t.tag_id === tag),
  )

  return (
    <section className="flex flex-col gap-4">
      <RealtimeRefresh table="conversations" tenantId={tenant.id} />
      <header>
        <h1 className="text-2xl font-bold">Bandeja</h1>
      </header>
      <InboxFilters current={filter} tag={tag} tags={tags ?? []} />
      <ConversationList conversations={rows} currentUserId={userId} />
      <InboxSettings tags={tags ?? []} quickReplies={quickReplies ?? []} />
    </section>
  )
}
