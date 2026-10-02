import { AddContactForm } from '@/components/contacts/add-contact-form'
import { ContactTable, type ContactRow } from '@/components/contacts/contact-table'
import { ImportContactsForm } from '@/components/contacts/import-contacts-form'
import { requireTenant } from '@/modules/tenancy/session'

export default async function ContactosPage() {
  const { supabase, tenant } = await requireTenant()
  const { data } = await supabase
    .from('contacts')
    .select('id, wa_id, name, marketing_opted_out, created_at, consents(method, source_detail, granted_at, revoked_at, purpose)')
    .eq('tenant_id', tenant.id)
    .order('created_at', { ascending: false })
    .limit(500)

  return (
    <section className="flex flex-col gap-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Contactos y permisos</h1>
          <p className="mt-1 text-slate-600">Sin permiso registrado no se le puede enviar marketing. Así cuidamos tu número.</p>
        </div>
        <div className="flex gap-2">
          <a href="/api/exportar/contactos" className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold">Exportar contactos</a>
          <a href="/api/exportar/consentimientos" className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold">Exportar permisos</a>
        </div>
      </header>
      <div className="grid gap-6 lg:grid-cols-2">
        <AddContactForm />
        <ImportContactsForm />
      </div>
      <ContactTable contacts={(data ?? []) as ContactRow[]} />
    </section>
  )
}
