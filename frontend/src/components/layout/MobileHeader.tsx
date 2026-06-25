"use client"

import Link from "next/link"
import { useAuth } from "@/components/providers/AuthModals"
import { Bell } from "lucide-react"
import ThemeToggle from "./ThemeToggle"
import { useWalletProfile } from "@/hooks/useWalletProfile"
import { useNotificationsQuery } from "@/store/verity/verityQueries"

export default function MobileHeader() {
  const { authenticated, loading, login } = useAuth()
  const { profile } = useWalletProfile()
  const { data: notifications = [] } = useNotificationsQuery(profile?.id || "")
  const unreadCount = notifications.filter((n: any) => !n.read).length

  return (
    <div className="verity-card sticky top-0 z-20 mt-3 flex items-center justify-between p-3 sm:hidden border border-border/60 bg-surface-solid/80 backdrop-blur shadow-subtle">
      <Link href="/" className="flex items-center">
        <div className="verity-blob flex h-8 w-8 items-center justify-center bg-sunburst-yellow text-sm font-semibold text-midnight">
          V
          <span className="verity-blob-smile scale-75" />
        </div>
        <span className="ml-2.5 text-lg font-semibold tracking-[-0.25px] text-charcoal-primary">
          Verity
        </span>
      </Link>
      <div className="flex items-center gap-2">
        <Link
          aria-label="Open Alerts"
          className="relative flex h-8 w-8 items-center justify-center rounded-lg bg-surface-muted text-ash hover:text-charcoal-primary transition-colors"
          href="/notifications"
        >
          <Bell className="h-4 w-4" />
          {unreadCount > 0 && (
            <span className="absolute -right-1 -top-1 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-coral-red text-[8px] font-bold text-white ring-2 ring-background">
              {unreadCount}
            </span>
          )}
        </Link>
        <ThemeToggle />

        {loading ? (
          <div className="h-8 w-8 animate-pulse rounded-full bg-stone-surface" />
        ) : !authenticated ? (
          <button
            className="flex h-8 items-center gap-1 bg-inverse px-5 rounded-[6px] text-sm font-semibold tracking-[-0.18px] text-inverse-text transition-opacity hover:opacity-90 cursor-pointer"
            onClick={login}
            type="button"
          >
            <span>Login</span>
          </button>
        ) : null}
      </div>
    </div>
  )
}
