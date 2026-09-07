'use client'

import * as React from 'react'
import { useTheme } from 'next-themes'
import { Check, Moon, Palette, Sun, Sparkles } from 'lucide-react'
import {
  getThemeFamily,
  setThemeFamily,
  type ThemeFamily,
} from '@/components/theme/theme-provider'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { Switch } from '@/components/ui/switch'
import { useRestartTour } from '@/components/layout/onboarding-tour'
import { cn } from '@/lib/utils'
import { SettingsSection } from './section-wrapper'

// Literal theme-preview gradients. These are the ONLY allowed inline colors —
// they preview the actual oklch values each theme family defines in globals.css.
const FAMILY_PREVIEW: Record<ThemeFamily, { name: string; gradient: string; blurb: string }> = {
  bluish: {
    name: 'Bluish',
    blurb: 'Professional institutional blue',
    gradient: 'linear-gradient(135deg, oklch(0.52 0.18 255) 0%, oklch(0.85 0.05 250) 100%)',
  },
  greenish: {
    name: 'Greenish',
    blurb: 'Calm green/teal institutional',
    gradient: 'linear-gradient(135deg, oklch(0.55 0.13 168) 0%, oklch(0.85 0.05 160) 100%)',
  },
  neutral: {
    name: 'Neutral',
    blurb: 'Minimal grayscale',
    gradient: 'linear-gradient(135deg, oklch(0.32 0.005 0) 0%, oklch(0.9 0 0) 100%)',
  },
  aurora: {
    name: 'Aurora',
    blurb: 'Purple/teal accent progression',
    gradient: 'linear-gradient(135deg, oklch(0.56 0.22 300) 0%, oklch(0.65 0.15 180) 100%)',
  },
  midnight: {
    name: 'Midnight',
    blurb: 'Full-dark indigo/slate',
    gradient: 'linear-gradient(135deg, oklch(0.13 0.02 265) 0%, oklch(0.4 0.015 265) 100%)',
  },
}

const FAMILY_ORDER: ThemeFamily[] = ['bluish', 'greenish', 'neutral', 'aurora', 'midnight']

function FamilySwatch({
  family,
  selected,
  onSelect,
}: {
  family: ThemeFamily
  selected: boolean
  onSelect: (f: ThemeFamily) => void
}) {
  const meta = FAMILY_PREVIEW[family]
  return (
    <button
      type="button"
      onClick={() => onSelect(family)}
      aria-pressed={selected}
      aria-label={`Use ${meta.name} theme family`}
      className={cn(
        'group relative flex flex-col gap-2 rounded-lg border p-2 text-left transition-colors',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
        selected
          ? 'border-primary bg-primary/5'
          : 'border-border bg-card hover:border-primary/40 hover:bg-accent/40',
      )}
    >
      <span
        className="block h-12 w-full rounded-md ring-1 ring-inset ring-border"
        style={{ background: meta.gradient }}
        aria-hidden
      />
      <span className="flex items-center justify-between gap-2">
        <span className="min-w-0">
          <span className="block truncate text-sm font-medium text-foreground">{meta.name}</span>
          <span className="block truncate text-xs text-muted-foreground">{meta.blurb}</span>
        </span>
        {selected ? (
          <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
            <Check className="size-3" aria-hidden />
          </span>
        ) : null}
      </span>
    </button>
  )
}

export function AppearanceSection() {
  const { theme, setTheme } = useTheme()
  // Lazy init from localStorage; updated on click. No setState-in-effect.
  const [family, setFamily] = React.useState<ThemeFamily>(() => getThemeFamily())
  const restartTour = useRestartTour()

  const onSelectFamily = (f: ThemeFamily) => {
    setFamily(f)
    setThemeFamily(f)
  }

  const isDark = theme === 'dark'

  return (
    <SettingsSection
      icon={Palette}
      title="Appearance"
      description="Choose the color family and light/dark mode. Preferences are saved to this device."
    >
      <div className="flex flex-col gap-5">
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between gap-2">
            <Label htmlFor="theme-family-grid" className="text-sm font-medium">
              Theme family
            </Label>
            <Badge variant="secondary" className="capitalize">
              {family}
            </Badge>
          </div>
          <div
            id="theme-family-grid"
            role="radiogroup"
            aria-label="Theme family"
            className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5"
          >
            {FAMILY_ORDER.map((f) => (
              <FamilySwatch
                key={f}
                family={f}
                selected={family === f}
                onSelect={onSelectFamily}
              />
            ))}
          </div>
        </div>

        <Separator className="bg-border" />

        <div className="flex items-center justify-between gap-4">
          <div className="flex min-w-0 items-start gap-3">
            {/* Sun shows in light mode; Moon shows in dark mode. CSS-only swap,
                no mounted/setState-in-effect pattern. */}
            <span className="relative flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Sun className="hidden size-4 dark:block" aria-hidden />
              <Moon className="size-4 dark:hidden" aria-hidden />
            </span>
            <div className="min-w-0">
              <Label htmlFor="dark-mode-switch" className="text-sm font-medium">
                Dark mode
              </Label>
              <p className="mt-0.5 text-sm text-muted-foreground">
                Toggle between light and dark surfaces. Switches instantly.
              </p>
            </div>
          </div>
          <Switch
            id="dark-mode-switch"
            checked={isDark}
            onCheckedChange={(c) => setTheme(c ? 'dark' : 'light')}
            aria-label="Toggle dark mode"
          />
        </div>

        <Separator className="bg-border" />

        {/* Re-trigger the first-run onboarding tour. */}
        <div className="flex items-center justify-between gap-4">
          <div className="flex min-w-0 items-start gap-3">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Sparkles className="size-4" aria-hidden />
            </span>
            <div className="min-w-0">
              <Label className="text-sm font-medium">Take the tour</Label>
              <p className="mt-0.5 text-sm text-muted-foreground">
                Replay the 60-second onboarding walkthrough that highlights the
                Inbox, Organized sections, AI Assistant, command palette, and
                keyboard shortcuts.
              </p>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={restartTour}>
            Restart tour
          </Button>
        </div>
      </div>
    </SettingsSection>
  )
}
