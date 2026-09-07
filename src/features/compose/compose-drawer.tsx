'use client'

import { useUIStore } from '@/store/ui-store'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { ComposeForm } from './compose-form'

export function ComposeDrawer() {
  const open = useUIStore((s) => s.composeOpen)
  const setOpen = useUIStore((s) => s.setComposeOpen)
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetContent className="w-full sm:max-w-2xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle>New message</SheetTitle>
        </SheetHeader>
        <div className="mt-4">
          <ComposeForm onSent={() => setOpen(false)} />
        </div>
      </SheetContent>
    </Sheet>
  )
}
