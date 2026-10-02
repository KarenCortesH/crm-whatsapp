import Link from 'next/link'
import { registerConnectedPhone } from '@/lib/webhooks/process-kapso'
import { requireTenant } from '@/modules/tenancy/session'

/** Kapso redirige aquí al terminar el setup link. Registramos el número por si el webhook de proyecto tarda. */
export default async function ConexionListaPage({ searchParams }: PageProps<'/panel/conectar/listo'>) {
  const { tenant } = await requireTenant()
  const params = await searchParams
  const phoneNumberId = typeof params.phone_number_id === 'string' ? params.phone_number_id : null
  const failed = params.fallo === '1' || typeof params.error_code === 'string'

  let registered = false
  let problem: string | null = null
  if (!failed && phoneNumberId && tenant.kapso_customer_id) {
    try {
      await registerConnectedPhone(phoneNumberId, tenant.kapso_customer_id)
      registered = true
    } catch (err) {
      console.error('[conectar/listo]', err)
      problem = 'Tu número se conectó, pero no pudimos terminar de registrarlo. Lo reintentamos automáticamente.'
    }
  }

  return (
    <section className="mx-auto flex max-w-md flex-col gap-4">
      {failed ? (
        <>
          <h1 className="text-2xl font-bold">No se completó la conexión</h1>
          <p className="text-slate-600">
            Meta no confirmó la conexión{typeof params.error_code === 'string' ? ` (${params.error_code})` : ''}. Puedes
            intentarlo de nuevo; no se cambió nada en tu cuenta.
          </p>
        </>
      ) : (
        <>
          <h1 className="text-2xl font-bold">{registered ? '¡Número conectado!' : 'Conexión recibida'}</h1>
          <p className="text-slate-600">
            {problem ??
              (registered
                ? 'Ya estamos escuchando tus mensajes. Escríbele a tu número desde otro celular para probar.'
                : 'Estamos terminando de registrar tu número.')}
          </p>
        </>
      )}
      <Link href={failed ? '/panel/conectar' : '/panel'} className="rounded-lg bg-teal-700 px-4 py-3 text-center font-semibold text-white">
        {failed ? 'Intentar de nuevo' : 'Ir al panel de salud'}
      </Link>
    </section>
  )
}
