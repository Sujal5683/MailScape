'use client'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useState, type ReactNode } from 'react'
import { ThemeProvider } from '@/components/theme/theme-provider'
import { Toaster } from '@/components/ui/toaster'
import { Toaster as SonnerToaster } from '@/components/ui/sonner'
import { RealtimeProvider } from '@/providers/realtime-provider'

export function Providers({ children }: { children: ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            refetchOnWindowFocus: false,
            retry: 1,
          },
        },
      }),
  )
  return (
    <QueryClientProvider client={client}>
      <ThemeProvider>
        <RealtimeProvider>
          {children}
        </RealtimeProvider>
        <Toaster />
        <SonnerToaster richColors closeButton position="bottom-right" />
      </ThemeProvider>
    </QueryClientProvider>
  )
}
