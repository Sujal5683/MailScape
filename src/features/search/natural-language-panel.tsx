'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { colorClass } from '@/lib/category-meta'
import { cn } from '@/lib/utils'
import type { SearchFilters, CategorySummary } from '@/lib/types'
import { filtersToChips } from './search-helpers'
import { Sparkles, Wand2, Search, Loader2, AlertCircle } from 'lucide-react'

export function NaturalLanguagePanel({
  input,
  onInputChange,
  parsed,
  summary,
  isParsing,
  parseError,
  onParse,
  onRunSearch,
  categories,
}: {
  input: string
  onInputChange: (v: string) => void
  parsed: SearchFilters | undefined
  summary: string | undefined
  isParsing: boolean
  parseError: Error | null
  onParse: () => void
  onRunSearch: () => void
  categories: CategorySummary[] | undefined
}) {
  const chips = parsed ? filtersToChips(parsed, categories) : []
  const canParse = !!input.trim() && !isParsing

  return (
    <div className="bg-background">
      <div className="pb-3 pt-4 px-4 space-y-1.5">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-muted-foreground" />
          <div className="text-sm font-semibold leading-none">Natural language</div>
        </div>
        <p className="text-xs text-muted-foreground">
          Describe what you&apos;re looking for. We&apos;ll parse it into filters you can review before running.
        </p>
      </div>
      <div className="space-y-3 pt-0 pb-4 px-4">
        <div className="flex flex-col gap-2 sm:flex-row">
          <Input
            placeholder='e.g. "unread emails from the registrar with PDFs this week"'
            value={input}
            onChange={(e) => onInputChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                if (canParse) onParse()
              }
            }}
            aria-label="Natural language query"
          />
          <Button
            type="button"
            onClick={onParse}
            disabled={!canParse}
            className="shrink-0"
          >
            {isParsing ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Wand2 className="h-4 w-4" />
            )}
            Parse
          </Button>
        </div>

        {parseError && (
          <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 p-2.5 text-xs text-destructive">
            <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>Couldn&apos;t parse: {parseError.message}</span>
          </div>
        )}

        {parsed && (
          <>
            <div className="rounded-lg border border-border/60 bg-muted/30 p-3">
              <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                Summary
              </p>
              <p className="mt-1 text-sm">{summary ?? 'Parsed your query.'}</p>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Parsed filters</Label>
              <div className="flex flex-wrap gap-1.5">
                {chips.length === 0 ? (
                  <span className="text-xs text-muted-foreground">
                    No specific filters detected — search will return all emails.
                  </span>
                ) : (
                  chips.map((chip, i) => (
                    <Badge
                      key={i}
                      variant="outline"
                      className={cn(
                        'gap-1',
                        chip.color && cn(colorClass(chip.color), 'cat-text cat-border-soft'),
                      )}
                    >
                      {chip.color && (
                        <span className={cn('h-1.5 w-1.5 rounded-full cat-dot', colorClass(chip.color))} />
                      )}
                      {chip.label}
                    </Badge>
                  ))
                )}
              </div>
            </div>
            <Button type="button" onClick={onRunSearch} className="w-full">
              <Search className="h-4 w-4" />
              Run search
            </Button>
          </>
        )}
      </div>
    </div>
  )
}
