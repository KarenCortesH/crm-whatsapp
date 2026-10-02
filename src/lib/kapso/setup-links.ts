import { kapsoFetch } from './http'
import type { ConnectionType, KapsoData, KapsoSetupLink } from './types'

type CreateSetupLinkInput = {
  customerId: string
  successRedirectUrl: string
  failureRedirectUrl: string
  connectionTypes?: ConnectionType[]
}

export async function createSetupLink(input: CreateSetupLinkInput): Promise<KapsoSetupLink> {
  const res = await kapsoFetch<KapsoData<KapsoSetupLink>>({
    method: 'POST',
    path: `/platform/v1/customers/${encodeURIComponent(input.customerId)}/setup_links`,
    body: {
      setup_link: {
        success_redirect_url: input.successRedirectUrl,
        failure_redirect_url: input.failureRedirectUrl,
        allowed_connection_types: input.connectionTypes ?? ['dedicated', 'coexistence'],
        // El cliente paga a Meta con su propia tarjeta: nunca partner_managed.
        meta_billing_mode: 'customer_managed',
        provision_phone_number: false,
        language: 'es',
      },
    },
  })
  return res.data
}
