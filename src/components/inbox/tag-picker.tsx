import { toggleTagAction } from '@/app/panel/actions/inbox'

type Props = { conversationId: string; tags: Array<{ id: string; name: string; color: string }>; selected: string[] }

export function TagPicker({ conversationId, tags, selected }: Props) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4">
      <h2 className="font-semibold">Etiquetas</h2>
      {tags.length === 0 ? (
        <p className="mt-1 text-sm text-slate-600">Crea etiquetas desde la bandeja.</p>
      ) : (
        <div className="mt-2 flex flex-wrap gap-2">
          {tags.map((t) => {
            const on = selected.includes(t.id)
            return (
              <form key={t.id} action={toggleTagAction}>
                <input type="hidden" name="conversationId" value={conversationId} />
                <input type="hidden" name="tagId" value={t.id} />
                <button
                  aria-pressed={on}
                  className="rounded-full px-3 py-1 text-xs font-semibold"
                  style={on ? { backgroundColor: t.color, color: '#fff' } : { backgroundColor: `${t.color}22`, color: t.color }}
                >
                  #{t.name}
                </button>
              </form>
            )
          })}
        </div>
      )}
    </section>
  )
}
