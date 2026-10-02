import { formatAgo } from '@/lib/format'
import { explainMetaError } from '@/modules/health/meta-errors'

type FailedMessage = {
  id: string
  body: string | null
  error_code: number | null
  error_title: string | null
  sent_at: string
  contacts: { wa_id: string; name: string | null } | null
}

export function FailedSendsList({ messages }: { messages: FailedMessage[] }) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5">
      <h2 className="text-lg font-semibold">Envíos fallidos</h2>
      {messages.length === 0 ? (
        <p className="mt-2 text-sm text-slate-600">No hay envíos fallidos recientes.</p>
      ) : (
        <ul className="mt-3 flex flex-col gap-3">
          {messages.map((m) => (
            <li key={m.id} className="rounded-lg bg-slate-50 p-3 text-sm">
              <p className="font-medium">{m.contacts?.name ?? m.contacts?.wa_id ?? 'Contacto'}</p>
              <p className="mt-1 text-slate-700">{explainMetaError(m.error_code, m.error_title)}</p>
              <p className="mt-1 text-xs text-slate-500">{formatAgo(m.sent_at)}</p>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
