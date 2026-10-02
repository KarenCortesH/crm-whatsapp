import { explainMetaError } from '@/modules/health/meta-errors'

export type ThreadMessage = {
  id: string
  direction: 'inbound' | 'outbound'
  body: string | null
  msg_type: string
  status: string
  sent_at: string
  error_code: number | null
  error_title: string | null
}

const STATUS_ICON: Record<string, string> = { sent: '✓', delivered: '✓✓', read: '✓✓', failed: '⚠️' }
const time = new Intl.DateTimeFormat('es-CO', { dateStyle: 'short', timeStyle: 'short' })

export function MessageThread({ messages }: { messages: ThreadMessage[] }) {
  if (!messages.length) return <p className="rounded-xl bg-white p-6 text-center text-slate-600">Sin mensajes todavía.</p>
  return (
    <ol className="flex max-h-[60vh] flex-col gap-2 overflow-y-auto rounded-xl border border-slate-200 bg-[#efeae2] p-3">
      {messages.map((m) => {
        const out = m.direction === 'outbound'
        return (
          <li key={m.id} className={`flex ${out ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[85%] rounded-lg px-3 py-2 text-sm shadow-sm ${out ? 'bg-[#d9fdd3]' : 'bg-white'}`}>
              <p className="whitespace-pre-wrap break-words">{m.body ?? `[${m.msg_type}]`}</p>
              <p className="mt-1 text-right text-[11px] text-slate-500">
                {time.format(new Date(m.sent_at))} {out && <span className={m.status === 'read' ? 'text-sky-600' : ''}>{STATUS_ICON[m.status] ?? ''}</span>}
              </p>
              {m.status === 'failed' && <p className="mt-1 text-xs text-red-700">{explainMetaError(m.error_code, m.error_title)}</p>}
            </div>
          </li>
        )
      })}
    </ol>
  )
}
