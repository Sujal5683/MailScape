'use client'

import * as React from 'react'
import { signIn } from 'next-auth/react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import {
  AlertCircle,
  Clock,
  Loader2,
  Mail,
  MailWarning,
  Plus,
  RefreshCw,
  Trash2,
} from 'lucide-react'
import { useAccounts, useSyncAccount } from '@/hooks/use-queries'
import { useToast } from '@/hooks/use-toast'
import { api } from '@/lib/api-client'
import { qk } from '@/lib/query-keys'
import { formatDateTime } from '@/lib/format'
import type { AccountConnectionDTO, SyncStatus } from '@/lib/types'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useUpdateSyncInterval } from '@/hooks/use-queries'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { SettingsSection } from './section-wrapper'
import { useScanDialogStore } from '@/features/scan/scan-dialog-store'

function StatusBadge({ status }: { status: string }) {
  const s = (status || '').toLowerCase()
  if (s === 'active' || s === 'connected' || s === 'ok' || s === 'healthy') {
    return (
      <Badge className="border-transparent bg-success text-success-foreground">Active</Badge>
    )
  }
  if (s === 'error' || s === 'failed' || s === 'disconnected' || s === 'revoked') {
    return <Badge variant="destructive">Error</Badge>
  }
  if (s === 'syncing' || s === 'pending' || s === 'paused') {
    return (
      <Badge className="border-transparent bg-warning text-warning-foreground">Paused</Badge>
    )
  }
  return <Badge variant="secondary">{status || 'Unknown'}</Badge>
}

function SyncBadge({ status }: { status: SyncStatus | null }) {
  if (!status) return <Badge variant="outline">Never</Badge>
  switch (status) {
    case 'success':
      return (
        <Badge className="border-transparent bg-success text-success-foreground">Synced</Badge>
      )
    case 'syncing':
      return (
        <Badge className="border-transparent bg-warning text-warning-foreground">Syncing</Badge>
      )
    case 'error':
      return <Badge variant="destructive">Sync error</Badge>
    default:
      return <Badge variant="outline">Idle</Badge>
  }
}

function AccountRow({ account }: { account: AccountConnectionDTO }) {
  const syncMutation = useSyncAccount()
  const qc = useQueryClient()
  const { toast } = useToast()
  const openScan = useScanDialogStore((s) => s.openDialog)
  const [removeOpen, setRemoveOpen] = React.useState(false)
  const updateIntervalMutation = useUpdateSyncInterval()

  const removeMutation = useMutation({
    mutationFn: () => api.accounts.remove(account.id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.accounts })
      toast({ title: 'Account disconnected', description: account.emailAddress })
    },
    onError: (e: unknown) => {
      const msg = e instanceof Error ? e.message : 'Failed to disconnect account'
      toast({ title: 'Disconnect failed', description: msg, variant: 'destructive' })
    },
  })

  const isSyncing =
    account.syncState?.syncStatus === 'syncing' || syncMutation.isPending

  const onSync = () => {
    syncMutation.mutate(account.id, {
      onSuccess: () => toast({ title: 'Sync complete', description: account.emailAddress }),
      onError: (e: unknown) =>
        toast({
          title: 'Sync failed',
          description: e instanceof Error ? e.message : 'Try again in a moment',
          variant: 'destructive',
        }),
    })
  }

  return (
    <li className="flex flex-col gap-3 rounded-lg border border-border bg-card p-3 sm:p-4">
      <div className="flex items-start gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
          <Mail className="size-4" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <p className="truncate text-sm font-medium text-foreground">
              {account.displayName || account.emailAddress}
            </p>
            <StatusBadge status={account.status} />
          </div>
          <p className="mt-0.5 truncate text-sm text-muted-foreground" title={account.emailAddress}>
            {account.emailAddress}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Clock className="size-3.5 shrink-0" aria-hidden />
          <span className="shrink-0">Last synced:</span>
          <span className="truncate text-foreground">
            {account.syncState?.lastSyncedAt
              ? formatDateTime(account.syncState.lastSyncedAt)
              : 'Never'}
          </span>
        </div>
        <div className="flex items-center gap-2 text-muted-foreground">
          <span className="shrink-0">Sync status:</span>
          <SyncBadge status={account.syncState?.syncStatus ?? null} />
        </div>
        {account.syncState?.errorMessage ? (
          <div className="flex items-start gap-2 text-destructive sm:col-span-2">
            <AlertCircle className="mt-0.5 size-3.5 shrink-0" aria-hidden />
            <span className="text-sm">{account.syncState.errorMessage}</span>
          </div>
        ) : null}
      </div>

      <Separator className="bg-border" />

      <div className="flex flex-wrap items-center gap-4 text-sm">
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground font-medium">Auto-scan interval:</span>
          <Select 
            defaultValue={(account.syncState as any)?.autoSyncInterval || 'instantly'}
            onValueChange={(val) => {
              updateIntervalMutation.mutate({ accountId: account.id, autoSyncInterval: val })
              toast({ title: 'Interval updated' })
            }}
          >
            <SelectTrigger className="w-[140px] h-8">
              <SelectValue placeholder="Select interval" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="instantly">Instantly</SelectItem>
              <SelectItem value="15m">Every 15 mins</SelectItem>
              <SelectItem value="1h">Every 1 hour</SelectItem>
              <SelectItem value="daily">Daily</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <Separator className="bg-border" />

      <div className="flex flex-wrap items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={openScan}
          disabled={isSyncing}
          className="gap-2"
        >
          <RefreshCw className="size-3.5" aria-hidden />
          Scan Gmail
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={onSync}
          disabled={isSyncing}
          className="gap-2"
        >
          {isSyncing ? (
            <Loader2 className="size-3.5 animate-spin" aria-hidden />
          ) : (
            <RefreshCw className="size-3.5" aria-hidden />
          )}
          {isSyncing ? 'Syncing…' : 'Sync now'}
        </Button>

        <AlertDialog open={removeOpen} onOpenChange={setRemoveOpen}>
          <AlertDialogTrigger asChild>
            <Button variant="outline" size="sm" className="gap-2 text-destructive hover:text-destructive">
              <Trash2 className="size-3.5" aria-hidden />
              Disconnect
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Disconnect this account?</AlertDialogTitle>
              <AlertDialogDescription>
                This is a sensitive action. Disconnecting{' '}
                <span className="font-medium text-foreground">{account.emailAddress}</span> will
                stop synchronization and remove its mailbox from Institutional Email Intelligence.
                Existing classified emails and rules are retained. You can reconnect later.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={removeMutation.isPending}>Cancel</AlertDialogCancel>
              <AlertDialogAction
                asChild
                className="bg-destructive text-white hover:bg-destructive/90"
              >
                <Button
                  variant="destructive"
                  className="gap-2"
                  disabled={removeMutation.isPending}
                  onClick={(e) => {
                    e.preventDefault()
                    removeMutation.mutate(undefined, {
                      onSuccess: () => setRemoveOpen(false),
                    })
                  }}
                >
                  {removeMutation.isPending ? (
                    <Loader2 className="size-4 animate-spin" aria-hidden />
                  ) : (
                    <MailWarning className="size-4" aria-hidden />
                  )}
                  Disconnect account
                </Button>
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </li>
  )
}

function AccountRowSkeleton() {
  return (
    <li className="flex flex-col gap-3 rounded-lg border border-border bg-card p-3 sm:p-4">
      <div className="flex items-start gap-3">
        <Skeleton className="size-10 shrink-0 rounded-full" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-3.5 w-56" />
        </div>
      </div>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <Skeleton className="h-4 w-44" />
        <Skeleton className="h-4 w-32" />
      </div>
      <Skeleton className="h-px w-full" />
      <div className="flex gap-2">
        <Skeleton className="h-8 w-24" />
        <Skeleton className="h-8 w-28" />
      </div>
    </li>
  )
}

export function AccountsSection() {
  const { data: accounts, isLoading, isError, refetch, isFetching } = useAccounts()

  return (
    <SettingsSection
      icon={Mail}
      title="Connected accounts"
      description="Manage the mailboxes Institutional Email Intelligence can read and synchronize."
      action={
        <Badge variant="secondary" className="hidden sm:inline-flex">
          {accounts?.length ?? 0} connected
        </Badge>
      }
    >
      {isLoading ? (
        <ul className="flex flex-col gap-3">
          {Array.from({ length: 2 }).map((_, i) => (
            <AccountRowSkeleton key={i} />
          ))}
        </ul>
      ) : isError ? (
        <div className="flex flex-col items-start gap-3 rounded-lg border border-destructive/40 bg-destructive/5 p-4">
          <div className="flex items-center gap-2 text-destructive">
            <AlertCircle className="size-4" aria-hidden />
            <p className="text-sm font-medium">Couldn&apos;t load accounts</p>
          </div>
          <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
            {isFetching ? 'Retrying…' : 'Retry'}
          </Button>
        </div>
      ) : !accounts || accounts.length === 0 ? (
        <div className="flex flex-col items-center gap-4 rounded-lg border border-dashed border-border bg-accent/30 p-8 text-center">
          <Mail className="size-6 text-muted-foreground" aria-hidden />
          <div>
            <p className="text-sm font-medium text-foreground">No accounts connected</p>
            <p className="mt-0.5 text-sm text-muted-foreground">
              Connect a Google account to start syncing your inbox.
            </p>
          </div>
          <Button size="sm" className="gap-2" onClick={() => signIn('google')}>
            <Plus className="size-3.5" aria-hidden />
            Connect Google Account
          </Button>
        </div>
      ) : (
        <ul className="flex flex-col gap-3">
          {accounts.map((a) => (
            <AccountRow key={a.id} account={a} />
          ))}
        </ul>
      )}
    </SettingsSection>
  )
}
