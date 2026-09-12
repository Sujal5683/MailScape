'use client'

import { useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { getSupabaseClient } from '@/lib/supabase-client'
import { qk } from '@/lib/query-keys'

export function RealtimeProvider({ children }: { children: React.ReactNode }) {
  const qc = useQueryClient()

  useEffect(() => {
    const supabase = getSupabaseClient()

    // Subscribe to changes on the Email table
    const emailChannel = supabase
      .channel('email-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'Email' }, (payload) => {
        console.log('[Realtime] Email table change detected:', payload)
        // Invalidate queries so UI fetches the latest emails instantly
        qc.invalidateQueries({ queryKey: qk.emails() })
        qc.invalidateQueries({ queryKey: qk.dashboard() })
      })
      .subscribe()

    // Subscribe to changes on the SyncState table
    const syncStateChannel = supabase
      .channel('sync-state-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'SyncState' }, (payload) => {
        console.log('[Realtime] SyncState table change detected:', payload)
        // Invalidate accounts to update sync badges/status
        qc.invalidateQueries({ queryKey: qk.accounts })
      })
      .subscribe()

    return () => {
      supabase.removeChannel(emailChannel)
      supabase.removeChannel(syncStateChannel)
    }
  }, [qc])

  return <>{children}</>
}
