'use client'

import { usePrivy } from '@privy-io/react-auth'
import { usePrivyWallet } from '@/hooks/usePrivyWallet'
import { arcTestnet, shortAddress } from '@/lib/arc'
import { AlertTriangle, ChevronDown, Wallet } from 'lucide-react'

export default function WalletConnectControl() {
  const { login, logout, authenticated, ready, user } = usePrivy()
  const { address, chainId, switchChain } = usePrivyWallet()

  const isWrongNetwork = authenticated && chainId && chainId !== arcTestnet.id

  if (!ready) {
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

  if (!authenticated) {
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

  if (isWrongNetwork) {
    return (
      <button
        className="verity-pill flex h-11 w-full items-center justify-center gap-2 bg-ember-orange px-4 text-sm font-semibold tracking-[-0.18px] text-white transition-colors hover:bg-coral-red cursor-pointer"
        onClick={() => switchChain(arcTestnet.id)}
        type="button"
      >
        <AlertTriangle className="h-4 w-4" />
        Switch to Arc
      </button>
    )
  }

  const walletAddr = address || user?.wallet?.address || ''
  const displayAddress = walletAddr ? shortAddress(walletAddr) : 'Connected'

  return (
    <button
      className="verity-pill flex h-11 w-full items-center justify-center gap-2 bg-parchment-card px-4 text-sm font-semibold tracking-[-0.18px] text-charcoal-primary shadow-[var(--shadow-subtle)] transition-colors hover:bg-stone-surface cursor-pointer"
      onClick={logout}
      type="button"
      title="Click to disconnect"
    >
      {displayAddress}
      <ChevronDown className="h-4 w-4" />
    </button>
  )
}
