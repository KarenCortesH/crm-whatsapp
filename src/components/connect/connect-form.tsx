'use client'

import { useActionState } from 'react'
import { startConnectionAction } from '@/app/panel/actions/connect'
import { SubmitButton } from '@/components/ui/submit-button'
import { FormMessage } from '@/components/ui/form-message'

export function ConnectForm({ hasPhones }: { hasPhones: boolean }) {
  const [state, action] = useActionState(startConnectionAction, null)
  return (
    <form action={action} className="flex flex-col gap-4 rounded-xl border border-slate-200 bg-white p-5">
      <h2 className="text-lg font-semibold">{hasPhones ? 'Conectar otro número' : 'Conectar mi número'}</h2>
      <fieldset className="flex flex-col gap-3">
        <legend className="mb-1 text-sm font-medium">¿Cómo quieres usarlo?</legend>
        <label className="flex gap-3 rounded-lg border border-slate-200 p-3">
          <input type="radio" name="modo" value="dedicada" defaultChecked className="mt-1" />
          <span>
            <span className="font-medium">Solo en el CRM (recomendado)</span>
            <span className="block text-sm text-slate-600">Más estable y con más velocidad de envío.</span>
          </span>
        </label>
        <label className="flex gap-3 rounded-lg border border-slate-200 p-3">
          <input type="radio" name="modo" value="coexistencia" className="mt-1" />
          <span>
            <span className="font-medium">También en la app WhatsApp Business (coexistencia)</span>
            <span className="block text-sm text-slate-600">
              Sigues usando la app del celular. Es menos estable y envía como máximo 5 mensajes por segundo.
            </span>
          </span>
        </label>
      </fieldset>
      <FormMessage state={state} />
      <SubmitButton>Continuar con Facebook</SubmitButton>
    </form>
  )
}
