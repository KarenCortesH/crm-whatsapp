import { describe, expect, it } from 'vitest'
import { normalizeKapsoEvent } from './kapso-events'
import { normalizeMetaPayload } from './meta-events'

const received = {
  message: {
    id: 'wamid.123',
    timestamp: '1730092800',
    type: 'text',
    from: '573001112233',
    text: { body: 'Hola' },
    kapso: { direction: 'inbound', status: 'received' },
  },
  conversation: { id: 'conv_1', contact_name: 'Ana', phone_number: '573001112233', phone_number_id: '111' },
  is_new_conversation: true,
  phone_number_id: '111',
}

describe('normalizeKapsoEvent', () => {
  it('mensaje recibido', () => {
    const [e] = normalizeKapsoEvent('whatsapp.message.received', received)
    expect(e).toMatchObject({
      type: 'message',
      direction: 'inbound',
      wamid: 'wamid.123',
      contactWaId: '573001112233',
      contactName: 'Ana',
      text: 'Hola',
      phoneNumberId: '111',
    })
    if (e.type === 'message') expect(e.timestamp.toISOString()).toBe('2024-10-28T05:20:00.000Z')
  })

  it('mensaje fallido trae el código de error de Meta', () => {
    const [e] = normalizeKapsoEvent('whatsapp.message.failed', {
      message: {
        id: 'wamid.9',
        to: '573009998877',
        type: 'text',
        kapso: {
          direction: 'outbound',
          status: 'failed',
          statuses: [
            { status: 'sent' },
            { status: 'failed', errors: [{ code: 131047, title: 'Re-engagement message' }] },
          ],
        },
      },
      phone_number_id: '111',
    })
    expect(e).toMatchObject({ type: 'message', status: 'failed', errorCode: 131047, contactWaId: '573009998877' })
  })

  it('lote con buffering', () => {
    const events = normalizeKapsoEvent('whatsapp.message.received', { data: [received, received] })
    expect(events).toHaveLength(2)
  })

  it('baja de marketing', () => {
    const [e] = normalizeKapsoEvent('whatsapp.contact.marketing_preference_changed', {
      contact: { wa_id: '573001112233' },
      marketing_preference: { status: 'stopped', sequence: 7, occurred_at: '2026-10-01T10:00:00Z' },
      phone_number_id: '111',
    })
    expect(e).toMatchObject({ type: 'marketing_preference', status: 'stopped', sequence: 7 })
  })

  it('número conectado por setup link', () => {
    const [e] = normalizeKapsoEvent('whatsapp.phone_number.created', {
      phone_number_id: '222',
      customer: { id: 'cus_1' },
    })
    expect(e).toEqual({ type: 'phone_connected', phoneNumberId: '222', customerId: 'cus_1' })
  })

  it('evento desconocido se ignora sin romper', () => {
    expect(normalizeKapsoEvent('otra.cosa', {})[0].type).toBe('ignored')
  })
})

describe('normalizeMetaPayload', () => {
  const wrap = (field: string, value: object) => ({ object: 'whatsapp_business_account', entry: [{ id: 'waba1', changes: [{ field, value }] }] })

  it('cambio de calidad', () => {
    const [e] = normalizeMetaPayload(wrap('phone_number_quality_update', { display_phone_number: '+57 300', event: 'DOWNGRADE', current_limit: 'TIER_250' }))
    expect(e).toMatchObject({ type: 'quality_update', event: 'DOWNGRADE', currentLimit: 'TIER_250', wabaId: 'waba1' })
  })

  it('recategorización de plantilla', () => {
    const [e] = normalizeMetaPayload(
      wrap('template_category_update', { message_template_id: 99, message_template_name: 'aviso', previous_category: 'UTILITY', new_category: 'MARKETING' }),
    )
    expect(e).toMatchObject({ type: 'template_category_update', templateId: '99', newCategory: 'MARKETING', previousCategory: 'UTILITY' })
  })

  it('estado de plantilla', () => {
    const [e] = normalizeMetaPayload(wrap('message_template_status_update', { message_template_id: '5', event: 'REJECTED', reason: 'INVALID_FORMAT' }))
    expect(e).toMatchObject({ type: 'template_status_update', status: 'REJECTED', reason: 'INVALID_FORMAT' })
  })

  it('estado de mensaje con precio de servicio', () => {
    const [e] = normalizeMetaPayload(
      wrap('messages', {
        metadata: { phone_number_id: '111' },
        statuses: [
          { id: 'wamid.1', status: 'delivered', timestamp: '1759320000', recipient_id: '573001112233', pricing: { billable: true, pricing_model: 'PMP', type: 'regular', category: 'service' } },
        ],
      }),
    )
    expect(e).toMatchObject({ type: 'message_status', billable: true, pricingCategory: 'service', status: 'delivered' })
  })
})
