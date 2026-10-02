import { kapsoFetch } from './http'
import type { KapsoHealthCheck, KapsoPage, KapsoPhoneNumber } from './types'

export async function listPhoneNumbers(filter: { customerId?: string; phoneNumberId?: string } = {}) {
  const res = await kapsoFetch<KapsoPage<KapsoPhoneNumber>>({
    path: '/platform/v1/whatsapp/phone_numbers',
    query: { customer_id: filter.customerId, phone_number_id: filter.phoneNumberId, per_page: 100 },
  })
  return res.data
}

export async function checkPhoneHealth(phoneNumberId: string): Promise<KapsoHealthCheck> {
  return kapsoFetch<KapsoHealthCheck>({
    path: `/platform/v1/whatsapp/phone_numbers/${encodeURIComponent(phoneNumberId)}/health`,
  })
}
