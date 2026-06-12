"use client"

import Link from "next/link"
import { useAuth } from "@/components/providers/AuthModals"
import { Wallet, CircleHelp } from "lucide-react"

export default function MobileHeader() {
  const { authenticated, loading, login } = useAuth()

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
          aria-label="Open Verity guide"
          className="flex h-8 w-8 items-center justify-center rounded-lg bg-surface-muted text-ash hover:text-charcoal-primary transition-colors"
          href="/how-it-works"
        >
          <CircleHelp className="h-4 w-4" />
        </Link>

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
