'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createSupabaseBrowser } from '@/lib/supabase/browser'

type Props = { table: 'conversations' | 'messages' | 'notes'; tenantId: string; conversationId?: string }

/** Refresca la vista cuando llegan cambios por Supabase Realtime (filtrados por RLS y por tenant). */
export function RealtimeRefresh({ table, tenantId, conversationId }: Props) {
  const router = useRouter()
  useEffect(() => {
    const supabase = createSupabaseBrowser()
    const filter = conversationId ? `conversation_id=eq.${conversationId}` : `tenant_id=eq.${tenantId}`
    let timer: ReturnType<typeof setTimeout> | null = null
    const channel = supabase
      .channel(`rt-${table}-${conversationId ?? tenantId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table, filter }, () => {
        if (timer) clearTimeout(timer)
        timer = setTimeout(() => router.refresh(), 300)
      })
      .subscribe()
    return () => {
      if (timer) clearTimeout(timer)
      supabase.removeChannel(channel)
    }
  }, [router, table, tenantId, conversationId])
  return null
}
