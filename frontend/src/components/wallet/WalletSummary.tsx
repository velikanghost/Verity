'use client'

import Link from 'next/link'
import {
  AlertTriangle,
  CheckCircle2,
  CircleDollarSign,
  ExternalLink,
  Network,
  Wallet,
} from 'lucide-react'
import { usePrivyWallet } from '@/hooks/usePrivyWallet'
import { arcTestnet } from '@/lib/arc'
import { useUsdcBalance } from '@/hooks/useUsdcBalance'
import WalletConnectControl from '@/components/wallet/WalletConnectControl'
import { useState } from 'react'

function shortAddress(addr?: string) {
  if (!addr) return ''
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`
}

export default function WalletSummary() {
  const { address, isConnected, chainId, switchChain } = usePrivyWallet()
  const { formattedBalance, isLoading } = useUsdcBalance()
  const [isPending, setIsPending] = useState(false)

  const isArcTestnet = isConnected && chainId === arcTestnet.id

  const handleSwitchChain = async () => {
    setIsPending(true)
    try {
      await switchChain(arcTestnet.id)
    } catch (err) {
      console.error("Failed to switch chain:", err)
    } finally {
      setIsPending(false)
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <WalletConnectControl />

      <section className="grid gap-3 sm:grid-cols-2">
        <div className="verity-card p-5">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-meadow-green">
              <CircleDollarSign className="h-5 w-5" />
              <span className="font-mono text-xs font-semibold uppercase tracking-[0.16em]">
                Arc USDC
              </span>
            </div>
            <Link
              className="verity-pill flex h-8 items-center gap-1.5 bg-parchment-card px-3 text-xs font-semibold tracking-[-0.14px] text-charcoal-primary shadow-[var(--shadow-subtle)] transition-colors hover:bg-stone-surface"
              href="https://faucet.circle.com/"
              rel="noreferrer"
              target="_blank"
            >
              Add more
              <ExternalLink className="h-3.5 w-3.5" />
            </Link>
          </div>
          <p className="mt-4 text-3xl font-semibold tracking-[-0.9px] text-midnight">
            {isLoading ? '...' : formattedBalance}
          </p>
          <p className="font-mono text-xs text-ash">
            testnet USDC balance
          </p>
        </div>

        <div className="verity-card p-5">
          <div className="flex items-center gap-2 text-ash">
            <Wallet className="h-5 w-5" />
            <span className="font-mono text-xs font-semibold uppercase tracking-[0.16em]">
              Wallet
            </span>
          </div>
          <p className="mt-4 break-all font-mono text-sm font-semibold text-charcoal-primary">
            {isConnected ? shortAddress(address) : 'Not connected'}
          </p>
          <p className="mt-1 font-mono text-xs text-ash">
            {isConnected ? address : 'Connect to create posts and send Upvote/Downvote signals'}
          </p>
        </div>
      </section>

      <section className="verity-card p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            {isConnected && isArcTestnet ? (
              <CheckCircle2 className="h-5 w-5 text-meadow-green" />
            ) : (
              <AlertTriangle className="h-5 w-5 text-ember-orange" />
            )}
            <div>
              <h2 className="font-semibold tracking-[-0.18px] text-charcoal-primary">Arc Testnet</h2>
              <p className="font-mono text-xs text-ash">
                Required chain ID {arcTestnet.id}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 font-mono text-xs text-ash">
            <Network className="h-4 w-4" />
            {isConnected ? `Connected ${chainId}` : 'Disconnected'}
          </div>
        </div>

        {isConnected && !isArcTestnet && (
          <button
            className="verity-pill mt-4 flex h-11 w-full items-center justify-center bg-inverse text-sm font-semibold tracking-[-0.18px] text-inverse-text transition-opacity hover:opacity-90"
            disabled={isPending}
            onClick={handleSwitchChain}
            type="button"
          >
            {isPending ? 'Switching...' : 'Switch to Arc Testnet'}
          </button>
        )}
      </section>
    </div>
  )
}
