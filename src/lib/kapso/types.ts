export type KapsoData<T> = { data: T }

export type KapsoPage<T> = {
  data: T[]
  meta: { page: number; per_page: number; total_pages: number; total_count: number }
}

export type KapsoCustomer = {
  id: string
  name: string
  external_customer_id: string | null
  created_at: string
  updated_at: string
}

export type ConnectionType = 'coexistence' | 'dedicated'

export type KapsoSetupLink = {
  id: string
  status: string
  url: string
  expires_at: string
  allowed_connection_types: ConnectionType[]
  meta_billing_mode: 'customer_managed' | 'partner_managed'
  whatsapp_setup_status: 'pending' | 'completed' | 'failed' | string
  whatsapp_setup_error: string | null
}

export type KapsoPhoneNumber = {
  id: string
  phone_number_id: string
  business_account_id: string
  customer_id: string | null
  display_phone_number: string
  display_phone_number_normalized: string
  verified_name: string | null
  is_coexistence: boolean
  quality_rating: 'GREEN' | 'YELLOW' | 'RED' | 'UNKNOWN' | string | null
  throughput_tier: string | null
  whatsapp_business_manager_messaging_limit: string | null
  status: string
  webhook_verified_at: string | null
}

export type WebhookKind = 'kapso' | 'meta'

export type KapsoWebhook = {
  id: string
  url: string
  kind: WebhookKind
  events: string[]
  active: boolean
}

export type HealthStatus = 'healthy' | 'degraded' | 'unhealthy' | 'error'
export type MessagingAvailability = 'AVAILABLE' | 'LIMITED' | 'BLOCKED'

export type KapsoHealthCheck = {
  status: HealthStatus
  timestamp: string
  retry_after?: number
  checks: {
    phone_number_access?: {
      passed: boolean
      error?: string
      details?: {
        quality_rating?: string
        throughput_tier?: string
        status?: string
        display_phone_number?: string
        verified_name?: string
      }
    }
    phone_number_connection?: {
      passed: boolean
      error?: string
      details?: { status?: 'CONNECTED' | 'DISCONNECTED' | 'UNKNOWN' }
    }
    messaging_health?: {
      passed: boolean
      error?: string
      overall_status?: MessagingAvailability
      details?: {
        can_send_message?: MessagingAvailability
        entities?: Array<{
          entity_type?: 'PHONE_NUMBER' | 'WABA' | 'BUSINESS' | 'APP' | string
          id?: string
          can_send_message?: MessagingAvailability
          errors?: Array<{ error_code?: number; error_description?: string; possible_solution?: string }>
        }>
      }
    }
    webhook_subscription?: {
      passed: boolean
      error?: string
      details?: { app_id?: string; subscribed?: boolean; subscribed_fields?: string[] }
    }
    webhook_verified?: { passed: boolean; error?: string; details?: { verified_at?: string | null; message?: string } }
  }
}
