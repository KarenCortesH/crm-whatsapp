import { setConversationStatusAction } from '@/app/panel/actions/inbox'

const OPTIONS = [
  { value: 'abierta', label: 'Abierta' },
  { value: 'pendiente', label: 'Pendiente' },
  { value: 'cerrada', label: 'Cerrar' },
]

export function StatusButtons({ conversationId, status }: { conversationId: string; status: string }) {
  return (
    <div className="flex gap-1 rounded-lg bg-slate-100 p-1">
      {OPTIONS.map((o) => (
        <form key={o.value} action={setConversationStatusAction}>
          <input type="hidden" name="conversationId" value={conversationId} />
          <input type="hidden" name="status" value={o.value} />
          <button
            aria-pressed={status === o.value}
            className={`rounded-md px-3 py-1.5 text-sm font-medium ${status === o.value ? 'bg-white shadow-sm' : 'text-slate-600'}`}
          >
            {o.label}
          </button>
        </form>
      ))}
    </div>
  )
}
