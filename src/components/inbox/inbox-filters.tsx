import Link from 'next/link'

const FILTERS = [
  { key: 'abiertas', label: 'Abiertas' },
  { key: 'mias', label: 'Mías' },
  { key: 'sin_asignar', label: 'Sin asignar' },
  { key: 'todas', label: 'Todas' },
]

type Props = { current: string; tag: string | null; tags: Array<{ id: string; name: string; color: string }> }

export function InboxFilters({ current, tag, tags }: Props) {
  const href = (ver: string, etiqueta: string | null) => {
    const q = new URLSearchParams({ ver })
    if (etiqueta) q.set('etiqueta', etiqueta)
    return `/panel/bandeja?${q}`
  }
  return (
    <div className="flex flex-col gap-2">
      <div className="flex gap-2 overflow-x-auto pb-1">
        {FILTERS.map((f) => (
          <Link
            key={f.key}
            href={href(f.key, tag)}
            className={`shrink-0 rounded-full px-3 py-1.5 text-sm font-medium ${current === f.key ? 'bg-teal-700 text-white' : 'bg-white text-slate-700 ring-1 ring-slate-200'}`}
          >
            {f.label}
          </Link>
        ))}
      </div>
      {tags.length > 0 && (
        <div className="flex gap-2 overflow-x-auto pb-1">
          {tags.map((t) => (
            <Link
              key={t.id}
              href={href(current, tag === t.id ? null : t.id)}
              className={`shrink-0 rounded-full px-3 py-1 text-xs font-semibold ${tag === t.id ? 'ring-2 ring-offset-1' : ''}`}
              style={{ backgroundColor: `${t.color}22`, color: t.color }}
            >
              #{t.name}
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
