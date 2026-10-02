import { revokeConsentAction } from '@/app/panel/actions/contacts'
import { formatAgo } from '@/lib/format'

export type ContactRow = {
  id: string
  wa_id: string
  name: string | null
  marketing_opted_out: boolean
  consents: Array<{ method: string; source_detail: string; granted_at: string; revoked_at: string | null; purpose: string }>
}

export function ContactTable({ contacts }: { contacts: ContactRow[] }) {
  if (!contacts.length) return <p className="text-slate-600">Aún no tienes contactos.</p>
  return (
    <section className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
      <table className="w-full min-w-[36rem] text-left text-sm">
        <thead className="bg-slate-50 text-slate-500">
          <tr>
            <th className="px-4 py-2 font-medium">Contacto</th>
            <th className="px-4 py-2 font-medium">Permiso de marketing</th>
            <th className="px-4 py-2 font-medium" />
          </tr>
        </thead>
        <tbody>
          {contacts.map((c) => {
            const active = c.consents.find((k) => k.purpose === 'marketing' && !k.revoked_at)
            return (
              <tr key={c.id} className="border-t border-slate-100 align-top">
                <td className="px-4 py-3">
                  <p className="font-medium">{c.name ?? 'Sin nombre'}</p>
                  <p className="text-slate-600">+{c.wa_id}</p>
                </td>
                <td className="px-4 py-3">
                  {c.marketing_opted_out ? (
                    <span className="font-semibold text-red-700">Se dio de baja de marketing</span>
                  ) : active ? (
                    <span>
                      <span className="font-semibold text-teal-800">Sí</span> · {active.source_detail} · {formatAgo(active.granted_at)}
                    </span>
                  ) : (
                    <span className="text-amber-800">Sin permiso: no recibe marketing</span>
                  )}
                </td>
                <td className="px-4 py-3 text-right">
                  {active && (
                    <form action={revokeConsentAction}>
                      <input type="hidden" name="contactId" value={c.id} />
                      <button className="text-sm font-semibold text-red-700 hover:underline">Retirar permiso</button>
                    </form>
                  )}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </section>
  )
}
