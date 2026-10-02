'use client'

import { useActionState } from 'react'
import { addContactAction } from '@/app/panel/actions/contacts'
import { FormMessage } from '@/components/ui/form-message'
import { SubmitButton } from '@/components/ui/submit-button'
import { ConsentFields } from './consent-fields'

export function AddContactForm() {
  const [state, action] = useActionState(addContactAction, null)
  return (
    <form action={action} className="flex flex-col gap-4 rounded-xl border border-slate-200 bg-white p-5">
      <h2 className="text-lg font-semibold">Agregar contacto</h2>
      <label className="flex flex-col gap-1 text-sm font-medium">
        WhatsApp
        <input name="phone" type="tel" inputMode="tel" required className="rounded-lg border border-slate-300 px-3 py-3 text-base" placeholder="+57 300 123 4567" />
      </label>
      <label className="flex flex-col gap-1 text-sm font-medium">
        Nombre
        <input name="name" className="rounded-lg border border-slate-300 px-3 py-3 text-base" />
      </label>
      <ConsentFields />
      <FormMessage state={state} />
      <SubmitButton>Guardar contacto</SubmitButton>
    </form>
  )
}
