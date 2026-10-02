'use client'

import { useState } from 'react'
import { createSupabaseBrowser } from '@/lib/supabase/browser'

export function LoginForm({ volver }: { volver: string }) {
  const [email, setEmail] = useState('')
  const [state, setState] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle')
  const [message, setMessage] = useState('')

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setState('sending')
    const supabase = createSupabaseBrowser()
    const redirect = new URL('/auth/confirmar', window.location.origin)
    redirect.searchParams.set('volver', volver)
    const { error } = await supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: redirect.toString() } })
    if (error) {
      setState('error')
      setMessage('No pudimos enviar el enlace. Revisa el correo e intenta de nuevo.')
    } else {
      setState('sent')
      setMessage(`Listo. Abre el enlace que enviamos a ${email}.`)
    }
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-3">
      <label className="flex flex-col gap-1 text-sm font-medium">
        Correo
        <input
          type="email"
          required
          autoComplete="email"
          inputMode="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="rounded-lg border border-slate-300 bg-white px-3 py-3 text-base"
          placeholder="tu@negocio.com"
        />
      </label>
      <button
        disabled={state === 'sending'}
        className="rounded-lg bg-teal-700 px-4 py-3 font-semibold text-white hover:bg-teal-800 disabled:opacity-60"
      >
        {state === 'sending' ? 'Enviando…' : 'Enviarme el enlace'}
      </button>
      {message && (
        <p role="status" className={state === 'error' ? 'text-sm text-red-700' : 'text-sm text-teal-800'}>
          {message}
        </p>
      )}
    </form>
  )
}
