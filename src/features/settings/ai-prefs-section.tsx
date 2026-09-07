'use client'

import * as React from 'react'
import { Brain, Info, ScrollText, ShieldCheck, Volume2 } from 'lucide-react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { Switch } from '@/components/ui/switch'
import { InfoNotice, SettingsSection } from './section-wrapper'
import {
  DEFAULT_AI_PREFS,
  loadAiPrefs,
  saveAiPrefs,
  type AiPrefs,
  type AssistantMode,
} from './local-prefs'

const MODE_OPTIONS: { value: AssistantMode; label: string; description: string }[] = [
  {
    value: 'direct',
    label: 'Direct',
    description: 'Answer and act immediately without a visible plan.',
  },
  {
    value: 'thinking',
    label: 'Thinking',
    description: 'Show a short reasoning step before acting.',
  },
  {
    value: 'suggest',
    label: 'Suggest',
    description: 'Propose actions and wait for your confirmation.',
  },
]

export function AiPrefsSection() {
  // Lazy init from localStorage so first render shows the saved value.
  const [prefs, setPrefs] = React.useState<AiPrefs>(() => loadAiPrefs())

  const update = React.useCallback((patch: Partial<AiPrefs>) => {
    setPrefs((prev) => {
      const next = { ...prev, ...patch }
      saveAiPrefs(next)
      return next
    })
  }, [])

  const currentMode = MODE_OPTIONS.find((m) => m.value === prefs.defaultMode) ?? MODE_OPTIONS[0]

  return (
    <SettingsSection
      icon={Brain}
      title="AI preferences"
      description="Defaults for the assistant. These apply to new conversations on this device."
    >
      <div className="flex flex-col gap-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <Label htmlFor="ai-default-mode" className="text-sm font-medium">
              Default assistant mode
            </Label>
            <p className="mt-0.5 text-sm text-muted-foreground">{currentMode.description}</p>
          </div>
          <Select
            value={prefs.defaultMode}
            onValueChange={(v) => update({ defaultMode: v as AssistantMode })}
          >
            <SelectTrigger id="ai-default-mode" className="w-full sm:w-44">
              <SelectValue placeholder={DEFAULT_AI_PREFS.defaultMode} />
            </SelectTrigger>
            <SelectContent>
              {MODE_OPTIONS.map((m) => (
                <SelectItem key={m.value} value={m.value}>
                  {m.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Separator className="bg-border" />

        <div className="flex items-center justify-between gap-4">
          <div className="flex min-w-0 items-start gap-3">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Volume2 className="size-4" aria-hidden />
            </span>
            <div className="min-w-0">
              <Label htmlFor="speaker-mode-switch" className="text-sm font-medium">
                Speaker mode
              </Label>
              <p className="mt-0.5 text-sm text-muted-foreground">
                Read assistant replies aloud by default.
              </p>
            </div>
          </div>
          <Switch
            id="speaker-mode-switch"
            checked={prefs.speakerMode}
            onCheckedChange={(c) => update({ speakerMode: c })}
            aria-label="Toggle speaker mode"
          />
        </div>

        <Separator className="bg-border" />

        <div className="flex flex-col gap-2">
          <InfoNotice icon={ScrollText} tone="info">
            <strong className="text-foreground">AI never overrides explicit rules</strong> —
            deterministic rules always win. The assistant operates within the boundaries your rules
            define.
          </InfoNotice>
          <InfoNotice icon={ShieldCheck} tone="success">
            <strong className="text-foreground">All AI actions are logged</strong> and reversible
            actions can be reverted from the assistant panel.
          </InfoNotice>
          <InfoNotice icon={Info} tone="warning">
            <strong className="text-foreground">Email content is treated as untrusted data</strong>{' '}
            — the assistant never executes instructions embedded inside message bodies.
          </InfoNotice>
        </div>
      </div>
    </SettingsSection>
  )
}
