'use client'

import {
  AlertTriangle,
  CheckCircle2,
  CircleDollarSign,
  Network,
  Wallet,
} from 'lucide-react'
import { useSwitchChain, useAccount } from 'wagmi'
import { arcTestnet } from '@/lib/arc'
import { useUsdcBalance } from '@/hooks/useUsdcBalance'
import WalletConnectControl from '@/components/wallet/WalletConnectControl'

function shortAddress(addr?: string) {
  if (!addr) return ''
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`
}

export default function WalletSummary() {
  const { address, isConnected, chainId } = useAccount()
  const { switchChain, isPending } = useSwitchChain()
  const { formattedBalance, isLoading } = useUsdcBalance()

  const isArcTestnet = isConnected && chainId === arcTestnet.id

  return (
    <div className="flex flex-col gap-3">
      <WalletConnectControl />

      <section className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-[18px] border border-[(--border)] bg-[(--surface)] p-5 shadow-sm">
          <div className="flex items-center gap-2 text-[(--color-brand-secondary)]">
            <CircleDollarSign className="h-5 w-5" />
            <span className="font-mono text-xs font-black uppercase tracking-[0.16em]">
              Arc USDC
            </span>
          </div>
          <p className="mt-4 text-3xl font-black text-[(--foreground)]">
            {isLoading ? '...' : formattedBalance}
          </p>
          <p className="font-mono text-xs text-[(--muted)]">
            testnet USDC balance
          </p>
        </div>

        <div className="rounded-[18px] border border-[(--border)] bg-[(--surface)] p-5 shadow-sm">
          <div className="flex items-center gap-2 text-[(--muted)]">
            <Wallet className="h-5 w-5" />
            <span className="font-mono text-xs font-black uppercase tracking-[0.16em]">
              Wallet
            </span>
          </div>
          <p className="mt-4 break-all font-mono text-sm font-black text-[(--foreground)]">
            {isConnected ? shortAddress(address) : 'Not connected'}
          </p>
          <p className="mt-1 font-mono text-xs text-[(--muted)]">
            {isConnected ? address : 'Connect to create posts and vote'}
          </p>
        </div>
      </section>

      <section className="rounded-[18px] border border-[(--border)] bg-[(--surface)] p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            {isConnected && isArcTestnet ? (
              <CheckCircle2 className="h-5 w-5 text-[(--color-brand-secondary)]" />
            ) : (
              <AlertTriangle className="h-5 w-5 text-[(--color-brand-accent)]" />
            )}
            <div>
              <h2 className="font-black text-[(--foreground)]">Arc Testnet</h2>
              <p className="font-mono text-xs text-[(--muted)]">
                Required chain ID {arcTestnet.id}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 font-mono text-xs text-[(--muted)]">
            <Network className="h-4 w-4" />
            {isConnected ? `Connected ${chainId}` : 'Disconnected'}
          </div>
        </div>

        {isConnected && !isArcTestnet && (
          <button
            className="mt-4 flex h-11 w-full items-center justify-center rounded-[13px] bg-[(--inverse)] font-mono text-xs font-black uppercase tracking-[0.14em] text-[(--inverse-text)] transition-opacity hover:opacity-85"
            disabled={isPending}
            onClick={() => switchChain({ chainId: arcTestnet.id })}
            type="button"
          >
            {isPending ? 'Switching...' : 'Switch to Arc Testnet'}
          </button>
        )}
      </section>
    </div>
  )
}
