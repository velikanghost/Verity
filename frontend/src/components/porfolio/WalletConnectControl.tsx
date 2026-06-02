"use client"

import { useAuth } from "@/components/providers/AuthModals"
import { shortAddress } from "@/lib/arc"
import { ChevronDown, Wallet } from "lucide-react"

export default function WalletConnectControl() {
  const { user, authenticated, loading, login, logout } = useAuth()

  if (loading) {
    return (
      <button
        className="verity-pill flex h-11 w-full items-center justify-center bg-inverse px-4 text-sm font-semibold tracking-[-0.18px] text-inverse-text opacity-70"
        type="button"
        disabled
      >
        Wallet
      </button>
    )
  }

  if (!authenticated || !user) {
    return (
      <button
        className="verity-pill flex h-11 w-full items-center justify-center gap-2 bg-inverse px-4 text-sm font-semibold tracking-[-0.18px] text-inverse-text transition-opacity hover:opacity-90 cursor-pointer"
        onClick={login}
        type="button"
      >
        <Wallet className="h-4 w-4" />
        Connect
      </button>
    )
  }

  const displayAddress = user.walletAddress
    ? shortAddress(user.walletAddress)
    : "Connected"

  return (
    <button
      className="verity-pill flex h-11 w-full items-center justify-center gap-2 bg-parchment-card px-4 text-sm font-semibold tracking-[-0.18px] text-charcoal-primary shadow-[(--shadow-subtle)] transition-colors hover:bg-stone-surface cursor-pointer"
      onClick={logout}
      type="button"
      title="Click to disconnect"
    >
      {displayAddress}
      <ChevronDown className="h-4 w-4" />
    </button>
  )
}
