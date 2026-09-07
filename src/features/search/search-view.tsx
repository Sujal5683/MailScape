'use client'

import { useEffect, useRef, useState } from 'react'
import { useNaturalLanguageSearch, useCategories } from '@/hooks/use-queries'
import { useUIStore } from '@/store/ui-store'
import type { SearchFilters } from '@/lib/types'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { EmailDetail } from '@/features/inbox/email-detail'
import { cn } from '@/lib/utils'
import { FilterPanel } from './filter-panel'
import { NaturalLanguagePanel } from './natural-language-panel'
import { SearchResultsList } from './search-results'
import { SavedSearchesPanel } from './saved-searches-panel'
import { SleekSeparator } from '@/components/common/separator'
import { DEFAULT_FILTER_FORM, filtersToFormState, type FilterFormState } from './search-helpers'
import { Search as SearchIcon, Sparkles } from 'lucide-react'
import { PaneScroll } from '@/components/ui/pane-scroll'

type Mode = 'structured' | 'nl'

export function SearchView() {
  const contextSearchQuery = useUIStore((s) => s.contextSearchQuery)
  const setContext = useUIStore((s) => s.setContext)

  // Lazy initializers so a contextSearchQuery prefill is consumed at mount
  // without triggering a setState-in-effect.
  const [mode, setMode] = useState<Mode>(() =>
    contextSearchQuery && contextSearchQuery.trim() ? 'nl' : 'structured',
  )
  const [nlInput, setNlInput] = useState(() => contextSearchQuery ?? '')
  const [filterForm, setFilterForm] = useState<FilterFormState>(DEFAULT_FILTER_FORM)
  const [committedFilters, setCommittedFilters] = useState<SearchFilters | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const nlSearch = useNaturalLanguageSearch()
  const nlMutate = nlSearch.mutate
  const { data: categories } = useCategories()

  // One-shot mount effect: if a context search query was supplied, auto-run
  // the NL parse; then clear the context so it isn't re-consumed.
  // (nlMutate is from useMutation — stable; setContext is a zustand setter —
  // neither is a React setState, so this satisfies react-hooks/set-state-in-effect.)
  const didMount = useRef(false)
  useEffect(() => {
    if (didMount.current) return
    didMount.current = true
    if (contextSearchQuery && contextSearchQuery.trim()) {
      nlMutate(contextSearchQuery)
    }
    if (contextSearchQuery !== null) {
      setContext({ contextSearchQuery: null })
    }
  }, [])

  const handleParse = () => {
    if (!nlInput.trim()) return
    nlSearch.mutate(nlInput)
  }

  const handleRunNlSearch = () => {
    if (nlSearch.data?.parsed) {
      setCommittedFilters(nlSearch.data.parsed)
      setSelectedId(null)
    }
  }

  const handleStructuredSearch = (filters: SearchFilters) => {
    setCommittedFilters(filters)
    setSelectedId(null)
  }

  // Loading a saved search: hydrate the structured-filter form (so the user
  // sees their preset reflected in the UI), commit the filters so the
  // results list runs immediately, switch to structured mode (in case the
  // user was on the NL tab), and clear any selected email so the list is
  // visible on mobile.
  const handleLoadFilters = (filters: SearchFilters) => {
    setFilterForm(filtersToFormState(filters))
    setCommittedFilters(filters)
    setSelectedId(null)
    setMode('structured')
  }

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <header className="shrink-0 border-b px-4 py-3">
        <div className="flex items-center gap-2">
          <SearchIcon className="h-4 w-4 text-muted-foreground" />
          <h1 className="text-sm font-semibold">Search</h1>
        </div>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Structured filters or natural-language queries across your mailbox.
        </p>
        <SleekSeparator className="mt-3" />
      </header>

      {/* Master-detail body */}
      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        {/* Left column: saved searches + input panel + results list */}
        <div
          className={cn(
            'flex min-h-0 flex-col border-b lg:border-b-0 lg:border-r',
            selectedId
              ? 'hidden lg:flex lg:w-[460px] xl:w-[500px]'
              : 'flex flex-1 lg:w-[460px] xl:w-[500px]',
          )}
        >
          <PaneScroll>
            {/* Saved searches panel — sits above the input panel on every viewport */}
            <div className="border-b">
              <SavedSearchesPanel
                currentFilters={committedFilters}
                categories={categories}
                onLoadFilters={handleLoadFilters}
              />
            </div>

            {/* Input panel: Tabs (Structured | Natural language) */}
            <div className="border-b">
              <Tabs
                value={mode}
                onValueChange={(v) => setMode(v as Mode)}
                className="gap-0"
              >
                <div className="px-3 pt-3">
                  <TabsList className="w-full">
                    <TabsTrigger value="structured" className="flex-1">
                      Structured
                    </TabsTrigger>
                    <TabsTrigger value="nl" className="flex-1 gap-1.5">
                      <Sparkles className="h-3.5 w-3.5" />
                      Natural language
                    </TabsTrigger>
                  </TabsList>
                </div>
                <TabsContent value="structured" className="mt-0">
                  <FilterPanel
                    form={filterForm}
                    onFormChange={setFilterForm}
                    categories={categories}
                    onSearch={handleStructuredSearch}
                  />
                </TabsContent>
                <TabsContent value="nl" className="mt-0">
                  <NaturalLanguagePanel
                    input={nlInput}
                    onInputChange={setNlInput}
                    parsed={nlSearch.data?.parsed}
                    summary={nlSearch.data?.summary}
                    isParsing={nlSearch.isPending}
                    parseError={nlSearch.error ?? null}
                    onParse={handleParse}
                    onRunSearch={handleRunNlSearch}
                    categories={categories}
                  />
                </TabsContent>
              </Tabs>
            </div>

            {/* Results list */}
            <div>
              <SearchResultsList
                filters={committedFilters}
                selectedId={selectedId}
                onSelect={setSelectedId}
                categories={categories}
              />
            </div>
          </PaneScroll>
        </div>

        {/* Right column: detail (full screen on mobile when selected, always-on on desktop) */}
        <div
          className={cn(
            'min-h-0 flex-1',
            selectedId ? 'flex' : 'hidden lg:flex',
          )}
        >
          <EmailDetail emailId={selectedId} onBack={() => setSelectedId(null)} />
        </div>
      </div>
    </div>
  )
}
