import Link from 'next/link'
import { redirect } from 'next/navigation'

export default async function Home({ searchParams }: PageProps<'/'>) {
  // Si Supabase cae en la Site URL en vez de /auth/confirmar, el enlace llega aquí con ?code=.
  const { code } = await searchParams
  if (typeof code === 'string') redirect(`/auth/confirmar?code=${encodeURIComponent(code)}`)

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col justify-center gap-6 px-5 py-16">
      <p className="text-sm font-semibold uppercase tracking-wide text-teal-700">Canal Seguro</p>
      <h1 className="text-3xl font-bold leading-tight sm:text-4xl">El CRM de WhatsApp que no te bloquea el número.</h1>
      <p className="text-lg text-slate-600">
        Solo la API oficial de Meta. Monitor de salud del canal, plantillas que no te recategorizan y campañas con
        frenos anti-bloqueo. Le pagas a Meta con tu propia tarjeta, sin recargos.
      </p>
      <div className="flex flex-wrap gap-3">
        <Link href="/ingresar" className="rounded-lg bg-teal-700 px-5 py-3 font-semibold text-white hover:bg-teal-800">
          Ingresar
        </Link>
      </div>
    </main>
  )
}
