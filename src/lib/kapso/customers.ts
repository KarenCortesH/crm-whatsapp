import { kapsoFetch } from './http'
import type { KapsoCustomer, KapsoData } from './types'

export async function createKapsoCustomer(name: string, externalId: string): Promise<KapsoCustomer> {
  const res = await kapsoFetch<KapsoData<KapsoCustomer>>({
    method: 'POST',
    path: '/platform/v1/customers',
    body: { customer: { name, external_customer_id: externalId } },
  })
  return res.data
}
