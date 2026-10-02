import { CreateTenantForm } from '@/components/onboarding/create-tenant-form'

export default function EmpezarPage() {
  return (
    <section className="mx-auto max-w-md">
      <h1 className="text-2xl font-bold">Crea tu empresa</h1>
      <p className="mt-1 text-slate-600">Después conectas tu número de WhatsApp con tu propia cuenta de Facebook.</p>
      <div className="mt-6">
        <CreateTenantForm />
      </div>
    </section>
  )
}
