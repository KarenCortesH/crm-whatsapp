'use client'

import { useActionState } from 'react'
import { importContactsAction } from '@/app/panel/actions/contacts'
import { FormMessage } from '@/components/ui/form-message'
import { SubmitButton } from '@/components/ui/submit-button'
import { ConsentFields } from './consent-fields'

export function ImportContactsForm() {
  const [state, action] = useActionState(importContactsAction, null)
  return (
    <form action={action} className="flex flex-col gap-4 rounded-xl border border-slate-200 bg-white p-5">
      <h2 className="text-lg font-semibold">Importar CSV</h2>
      <p className="text-sm text-slate-600">Una fila por contacto: <code>telefono,nombre</code>. Solo importa personas que sí te dieron permiso.</p>
      <input name="file" type="file" accept=".csv,text/csv,text/plain" required className="text-sm" />
      <ConsentFields />
      <FormMessage state={state} />
      <SubmitButton>Importar</SubmitButton>
    </form>
  )
}
