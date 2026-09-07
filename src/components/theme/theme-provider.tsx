'use client'

import { ThemeProvider as NextThemesProvider } from 'next-themes'
import { useEffect } from 'react'

export type ThemeFamily = 'bluish' | 'greenish' | 'neutral' | 'aurora' | 'midnight'

const STORAGE_FAMILY = 'iei-theme-family'

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="light"
      enableSystem={false}
      disableTransitionOnChange
    >
      <FamilyApplier>{children}</FamilyApplier>
    </NextThemesProvider>
  )
}

// Applies the data-theme attribute to <html> from localStorage, and listens for changes.
function FamilyApplier({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    const apply = (family: ThemeFamily) => {
      document.documentElement.setAttribute('data-theme', family)
    }
    const stored = (localStorage.getItem(STORAGE_FAMILY) as ThemeFamily | null) ?? 'bluish'
    apply(stored)
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<ThemeFamily>).detail
      if (detail) {
        localStorage.setItem(STORAGE_FAMILY, detail)
        apply(detail)
      }
    }
    window.addEventListener('iei:set-theme-family', handler as EventListener)
    return () => window.removeEventListener('iei:set-theme-family', handler as EventListener)
  }, [])
  return <>{children}</>
}

export function setThemeFamily(family: ThemeFamily) {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('iei:set-theme-family', { detail: family }))
  }
}

export function getThemeFamily(): ThemeFamily {
  if (typeof window === 'undefined') return 'bluish'
  return (localStorage.getItem(STORAGE_FAMILY) as ThemeFamily | null) ?? 'bluish'
}
