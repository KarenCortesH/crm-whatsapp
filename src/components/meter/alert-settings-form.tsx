'use client'

import { useActionState } from 'react'
import { saveAlertSettingsAction } from '@/app/panel/actions/settings'
import { FormMessage } from '@/components/ui/form-message'
import { SubmitButton } from '@/components/ui/submit-button'

type Props = { cap: number | null; alertEmail: string | null; alertWhatsapp: string | null }

export function AlertSettingsForm({ cap, alertEmail, alertWhatsapp }: Props) {
  const [state, action] = useActionState(saveAlertSettingsAction, null)
  return (
    <form action={action} className="flex flex-col gap-4 rounded-xl border border-slate-200 bg-white p-5">
      <h2 className="text-lg font-semibold">Tope y alertas</h2>
      <label className="flex flex-col gap-1 text-sm font-medium">
        Tope mensual de gasto en Meta (USD)
        <input name="cap" type="number" min={0} step="0.01" inputMode="decimal" defaultValue={cap ?? ''} className="rounded-lg border border-slate-300 px-3 py-3 text-base" placeholder="Ej. 30" />
      </label>
      <label className="flex flex-col gap-1 text-sm font-medium">
        Correo para alertas
        <input name="alertEmail" type="email" defaultValue={alertEmail ?? ''} className="rounded-lg border border-slate-300 px-3 py-3 text-base" />
      </label>
      <label className="flex flex-col gap-1 text-sm font-medium">
        WhatsApp para alertas (con indicativo)
        <input name="alertWhatsapp" type="tel" inputMode="tel" defaultValue={alertWhatsapp ?? ''} className="rounded-lg border border-slate-300 px-3 py-3 text-base" placeholder="+573001234567" />
      </label>
      <FormMessage state={state} />
      <SubmitButton>Guardar</SubmitButton>
    </form>
  )
}
