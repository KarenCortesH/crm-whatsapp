'use client'

import { useActionState } from 'react'
import { createCampaignAction } from '@/app/panel/actions/campaigns'
import { FormMessage } from '@/components/ui/form-message'
import { SubmitButton } from '@/components/ui/submit-button'

type Props = {
  templates: Array<{ id: string; name: string; requested_category: string }>
  phones: Array<{ id: string; display_phone_number: string | null }>
}

export function CampaignForm({ templates, phones }: Props) {
  const [state, action] = useActionState(createCampaignAction, null)
  if (!templates.length || !phones.length) {
    return (
      <p className="rounded-xl border border-dashed border-slate-300 bg-white p-5 text-slate-600">
        Para crear una campaña necesitas un número conectado y una plantilla aprobada por Meta.
      </p>
    )
  }
  return (
    <form action={action} className="grid gap-4 rounded-xl border border-slate-200 bg-white p-5 md:grid-cols-3">
      <label className="flex flex-col gap-1 text-sm font-medium">
        Nombre
        <input name="name" required className="rounded-lg border border-slate-300 px-3 py-3 text-base" placeholder="Novedades octubre" />
      </label>
      <label className="flex flex-col gap-1 text-sm font-medium">
        Plantilla aprobada
        <select name="templateId" required className="rounded-lg border border-slate-300 px-3 py-3 text-base">
          {templates.map((t) => (
            <option key={t.id} value={t.id}>{t.name} ({t.requested_category})</option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1 text-sm font-medium">
        Número
        <select name="phoneId" required className="rounded-lg border border-slate-300 px-3 py-3 text-base">
          {phones.map((p) => (
            <option key={p.id} value={p.id}>{p.display_phone_number ?? p.id}</option>
          ))}
        </select>
      </label>
      <div className="flex flex-col gap-3 md:col-span-3">
        <FormMessage state={state} />
        <SubmitButton>Calcular riesgo y crear borrador</SubmitButton>
      </div>
    </form>
  )
}
