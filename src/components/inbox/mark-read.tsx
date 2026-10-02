'use client'

import { useEffect } from 'react'
import { markReadAction } from '@/app/panel/actions/inbox'

export function MarkRead({ conversationId }: { conversationId: string }) {
  useEffect(() => {
    void markReadAction(conversationId)
  }, [conversationId])
  return null
}
