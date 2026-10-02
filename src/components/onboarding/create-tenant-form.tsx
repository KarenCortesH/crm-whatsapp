'use client'

import { useActionState } from 'react'
import { createTenantAction } from '@/app/panel/actions/onboarding'
import { SubmitButton } from '@/components/ui/submit-button'
import { FormMessage } from '@/components/ui/form-message'

export function CreateTenantForm() {
  const [state, action] = useActionState(createTenantAction, null)
  return (
    <form action={action} className="flex flex-col gap-4">
      <label className="flex flex-col gap-1 text-sm font-medium">
        Nombre del negocio
        <input name="name" required className="rounded-lg border border-slate-300 bg-white px-3 py-3 text-base" />
      </label>
      <label className="flex flex-col gap-1 text-sm font-medium">
        Correo para alertas (opcional)
        <input
          name="alertEmail"
          type="email"
          className="rounded-lg border border-slate-300 bg-white px-3 py-3 text-base"
          placeholder="Si lo dejas vacío usamos el tuyo"
        />
      </label>
      <FormMessage state={state} />
      <SubmitButton>Crear empresa</SubmitButton>
    </form>
  )
}
