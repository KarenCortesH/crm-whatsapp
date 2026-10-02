import Link from 'next/link'
import { formatAgo } from '@/lib/format'

export type ConversationRow = {
  id: string
  status: string
  unread_count: number
  last_message_at: string | null
  last_message_preview: string | null
  assigned_to: string | null
  contacts: { name: string | null; wa_id: string } | null
  conversation_tags: Array<{ tag_id: string; tags: { name: string; color: string } | null }>
}

export function ConversationList({ conversations, currentUserId }: { conversations: ConversationRow[]; currentUserId: string }) {
  if (!conversations.length) {
    return <p className="rounded-xl border border-dashed border-slate-300 bg-white p-6 text-center text-slate-600">No hay conversaciones aquí.</p>
  }
  return (
    <ul className="divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-200 bg-white">
      {conversations.map((c) => (
        <li key={c.id}>
          <Link href={`/panel/bandeja/${c.id}`} className="flex gap-3 p-4 hover:bg-slate-50">
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-2">
                <p className={`truncate ${c.unread_count ? 'font-bold' : 'font-medium'}`}>{c.contacts?.name ?? `+${c.contacts?.wa_id ?? ''}`}</p>
                <span className="shrink-0 text-xs text-slate-500">{formatAgo(c.last_message_at)}</span>
              </div>
              <p className="truncate text-sm text-slate-600">{c.last_message_preview ?? '—'}</p>
              <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs">
                {c.status !== 'abierta' && <span className="rounded bg-slate-100 px-1.5 py-0.5">{c.status}</span>}
                {c.assigned_to === currentUserId && <span className="rounded bg-teal-50 px-1.5 py-0.5 text-teal-800">Asignada a ti</span>}
                {c.conversation_tags.map((t) =>
                  t.tags ? (
                    <span key={t.tag_id} className="rounded px-1.5 py-0.5 font-semibold" style={{ backgroundColor: `${t.tags.color}22`, color: t.tags.color }}>
                      #{t.tags.name}
                    </span>
                  ) : null,
                )}
              </div>
            </div>
            {c.unread_count > 0 && (
              <span className="self-center rounded-full bg-teal-700 px-2 py-0.5 text-xs font-bold text-white">{c.unread_count}</span>
            )}
          </Link>
        </li>
      ))}
    </ul>
  )
}
