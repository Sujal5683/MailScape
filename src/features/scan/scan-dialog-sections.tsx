'use client'

import { Mail, Layers, Clock, Filter, Settings2, CheckCircle2 } from 'lucide-react'
import { AccordionItem, AccordionTrigger, AccordionContent } from '@/components/ui/accordion'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import { Switch } from '@/components/ui/switch'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import type { ScanConfig, ScanScope } from '@/lib/scan/types'
import { SCOPE_OPTIONS, TIME_PRESETS, PROCESSING_OPTIONS, type ScanPreset } from './scan-options'

type Cfg = ScanConfig
type Set = (p: Partial<Cfg>) => void

function Trigger({ icon: Icon, label }: { icon: typeof Mail; label: string }) {
  return (
    <AccordionTrigger className="text-sm">
      <span className="flex items-center gap-2"><Icon className="h-4 w-4 text-muted-foreground" /> {label}</span>
    </AccordionTrigger>
  )
}

/** Six collapsible sections of {@link ScanDialog}. State lives in the parent. */
export function ScanDialogSections({ cfg, set, setCfg }: {
  cfg: Cfg
  set: Set
  setCfg: React.Dispatch<React.SetStateAction<Cfg>>
}) {
  const toggleProc = (k: keyof Cfg['processing']) => setCfg((c) => ({ ...c, processing: { ...c.processing, [k]: !c.processing[k] } }))
  const preset = cfg.dateRangePreset
  const scopeLabel = SCOPE_OPTIONS.find((s) => s.value === cfg.scope)?.label
  const procOn = (Object.keys(cfg.processing) as (keyof Cfg['processing'])[]).filter((k) => cfg.processing[k])
  return (
    <>
      <AccordionItem value="account">
        <Trigger icon={Mail} label="Account" />
        <AccordionContent>
          <div className="flex items-center gap-2 rounded-md border border-border p-3">
            <Checkbox id="acc" defaultChecked /><Label htmlFor="acc" className="text-sm">Primary Gmail account</Label><Badge variant="secondary" className="ml-auto">connected</Badge>
          </div>
        </AccordionContent>
      </AccordionItem>
      <AccordionItem value="scope">
        <Trigger icon={Layers} label="Scope" />
        <AccordionContent>
          <RadioGroup value={cfg.scope} onValueChange={(v) => set({ scope: v as ScanScope })} className="gap-2">
            {SCOPE_OPTIONS.map((o) => (
              <label key={o.value} htmlFor={`s-${o.value}`} className="flex items-start gap-3 rounded-md border border-border p-3 cursor-pointer hover:bg-accent/40">
                <RadioGroupItem id={`s-${o.value}`} value={o.value} className="mt-0.5" />
                <div><p className="text-sm font-medium">{o.label}</p><p className="text-xs text-muted-foreground">{o.description}</p></div>
              </label>
            ))}
          </RadioGroup>
        </AccordionContent>
      </AccordionItem>
      <AccordionItem value="time">
        <Trigger icon={Clock} label="Time range" />
        <AccordionContent>
          <div className="flex flex-wrap gap-1.5">
            {TIME_PRESETS.map((p) => (
              <Button key={p.value} type="button" size="sm" variant={preset === p.value ? 'default' : 'outline'}
                onClick={() => set({ dateRangePreset: p.value as ScanPreset })}
                className="h-7 px-2.5 text-xs">{p.label}</Button>
            ))}
          </div>
          {preset === 'custom' && (
            <div className="mt-3 grid grid-cols-2 gap-2">
              <div><Label className="text-xs">From</Label><Input type="date" value={cfg.dateFrom ?? ''} onChange={(e) => set({ dateFrom: e.target.value })} /></div>
              <div><Label className="text-xs">To</Label><Input type="date" value={cfg.dateTo ?? ''} onChange={(e) => set({ dateTo: e.target.value })} /></div>
            </div>
          )}
        </AccordionContent>
      </AccordionItem>
      <AccordionItem value="filters">
        <Trigger icon={Filter} label="Filters" />
        <AccordionContent>
          <div className="space-y-3">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div><Label className="text-xs">Sender contains</Label><Input placeholder="@acme.com" value={cfg.senderFilter ?? ''} onChange={(e) => set({ senderFilter: e.target.value })} /></div>
              <div><Label className="text-xs">Subject contains</Label><Input placeholder="invoice" value={cfg.subjectFilter ?? ''} onChange={(e) => set({ subjectFilter: e.target.value })} /></div>
            </div>
            <div className="flex flex-wrap gap-4">
              <label className="flex items-center gap-2 text-sm"><Switch checked={!!cfg.hasAttachment} onCheckedChange={(v) => set({ hasAttachment: v })} /> Has attachment</label>
              <label className="flex items-center gap-2 text-sm"><Switch checked={!!cfg.includeSpam} onCheckedChange={(v) => set({ includeSpam: v })} /> Include spam</label>
              <label className="flex items-center gap-2 text-sm"><Switch checked={!!cfg.includeTrash} onCheckedChange={(v) => set({ includeTrash: v })} /> Include trash</label>
            </div>
            <div><Label className="text-xs">Gmail query</Label><Textarea placeholder="from:boss@acme.com has:attachment after:2024/01/01" rows={2} value={cfg.gmailQuery ?? ''} onChange={(e) => set({ gmailQuery: e.target.value })} /></div>
          </div>
        </AccordionContent>
      </AccordionItem>
      <AccordionItem value="processing">
        <Trigger icon={Settings2} label="Processing" />
        <AccordionContent>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {PROCESSING_OPTIONS.map((o) => (
              <label key={o.key} className="flex items-start gap-2 rounded-md border border-border p-2.5 cursor-pointer hover:bg-accent/40">
                <Checkbox checked={!!cfg.processing[o.key]} onCheckedChange={() => toggleProc(o.key)} className="mt-0.5" />
                <div><p className="text-sm font-medium">{o.label}</p><p className="text-xs text-muted-foreground">{o.description}</p></div>
              </label>
            ))}
          </div>
        </AccordionContent>
      </AccordionItem>
      <AccordionItem value="review">
        <Trigger icon={CheckCircle2} label="Review & start" />
        <AccordionContent>
          <div className="space-y-1 rounded-md border border-border bg-muted/30 p-3 text-sm">
            <p><span className="text-muted-foreground">Scope:</span> {scopeLabel}</p>
            <p><span className="text-muted-foreground">Time range:</span> {preset}</p>
            <p><span className="text-muted-foreground">Processing:</span> {procOn.length ? procOn.join(', ') : 'none'}</p>
          </div>
        </AccordionContent>
      </AccordionItem>
    </>
  )
}
