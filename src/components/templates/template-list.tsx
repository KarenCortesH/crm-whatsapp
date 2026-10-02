type Template = {
  id: string
  name: string
  requested_category: string
  meta_category: string | null
  status: string
  rejection_reason: string | null
}

const STATUS: Record<string, string> = {
  APPROVED: 'Aprobada',
  PENDING: 'En revisión',
  REJECTED: 'Rechazada',
  DISABLED: 'Deshabilitada',
  PAUSED: 'Pausada',
  BORRADOR: 'Borrador',
}

export function TemplateList({ templates }: { templates: Template[] }) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5">
      <h2 className="text-lg font-semibold">Tus plantillas</h2>
      {templates.length === 0 ? (
        <p className="mt-2 text-sm text-slate-600">Todavía no has enviado plantillas a Meta.</p>
      ) : (
        <ul className="mt-3 divide-y divide-slate-100">
          {templates.map((t) => {
            const recategorized = t.meta_category && t.meta_category !== t.requested_category
            return (
              <li key={t.id} className="py-3 text-sm">
                <p className="font-medium">{t.name}</p>
                <p className="text-slate-600">
                  {STATUS[t.status] ?? t.status} · pedida como {t.requested_category}
                  {t.meta_category ? ` · Meta: ${t.meta_category}` : ''}
                </p>
                {recategorized && <p className="mt-1 text-amber-800">Meta la recategorizó.</p>}
                {t.rejection_reason && <p className="mt-1 text-red-700">Motivo: {t.rejection_reason}</p>}
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
