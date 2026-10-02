import { LoginForm } from '@/components/auth/login-form'

export default async function IngresarPage({ searchParams }: PageProps<'/ingresar'>) {
  const params = await searchParams
  const volver = typeof params.volver === 'string' && params.volver.startsWith('/panel') ? params.volver : '/panel'
  const error = typeof params.error === 'string' ? params.error : null
  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-6 px-5 py-16">
      <div>
        <h1 className="text-2xl font-bold">Ingresar</h1>
        <p className="mt-1 text-slate-600">Te enviamos un enlace a tu correo. Sin contraseñas.</p>
      </div>
      {error && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-800">El enlace no es válido o ya expiró. Pide uno nuevo.</p>}
      <LoginForm volver={volver} />
    </main>
  )
}
