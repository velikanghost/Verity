"use client";

import { AlertTriangle, CheckCircle2, CircleDollarSign, Network, Wallet } from "lucide-react";
import { useSwitchChain } from "wagmi";
import { arcTestnet, hasArcWalletConfig, shortAddress } from "@/lib/arc";
import { useUsdcBalance } from "@/hooks/useUsdcBalance";
import WalletConnectControl from "@/components/wallet/WalletConnectControl";

export default function WalletSummary() {
  const { address, isConnected, isArcTestnet, chainId, balance, formatted } = useUsdcBalance();
  const { switchChain, isPending } = useSwitchChain();
  const configured = hasArcWalletConfig();

  return (
    <div className="flex flex-col gap-3">
      <WalletConnectControl />

      <section className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-[18px] border border-[var(--border)] bg-[var(--surface)] p-5 shadow-sm">
          <div className="flex items-center gap-2 text-brand-secondary">
            <CircleDollarSign className="h-5 w-5" />
            <span className="font-mono text-xs font-black uppercase tracking-[0.16em]">Arc USDC</span>
          </div>
          <p className="mt-4 text-3xl font-black text-[var(--foreground)]">
            {balance.isLoading ? "..." : formatted}
          </p>
          <p className="font-mono text-xs text-[var(--muted)]">testnet USDC balance</p>
        </div>

        <div className="rounded-[18px] border border-[var(--border)] bg-[var(--surface)] p-5 shadow-sm">
          <div className="flex items-center gap-2 text-[var(--muted)]">
            <Wallet className="h-5 w-5" />
            <span className="font-mono text-xs font-black uppercase tracking-[0.16em]">Wallet</span>
          </div>
          <p className="mt-4 break-all font-mono text-sm font-black text-[var(--foreground)]">
            {isConnected ? shortAddress(address) : "Not connected"}
          </p>
          <p className="mt-1 font-mono text-xs text-[var(--muted)]">
            {isConnected ? address : "Connect to create posts and vote"}
          </p>
        </div>
      </section>

      <section className="rounded-[18px] border border-[var(--border)] bg-[var(--surface)] p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            {isConnected && isArcTestnet ? (
              <CheckCircle2 className="h-5 w-5 text-brand-secondary" />
            ) : (
              <AlertTriangle className="h-5 w-5 text-downvote" />
            )}
            <div>
              <h2 className="font-black text-[var(--foreground)]">Arc Testnet</h2>
              <p className="font-mono text-xs text-[var(--muted)]">
                {configured ? `Required chain ID ${arcTestnet.id}` : "Arc environment variables are missing"}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 font-mono text-xs text-[var(--muted)]">
            <Network className="h-4 w-4" />
            {isConnected ? `Connected ${chainId}` : "Disconnected"}
          </div>
        </div>

        {isConnected && !isArcTestnet && configured && (
          <button
            className="mt-4 flex h-11 w-full items-center justify-center rounded-[13px] bg-[var(--inverse)] font-mono text-xs font-black uppercase tracking-[0.14em] text-[var(--inverse-text)] transition-opacity hover:opacity-85"
            disabled={isPending}
            onClick={() => switchChain({ chainId: arcTestnet.id })}
            type="button"
          >
            {isPending ? "Switching..." : "Switch to Arc Testnet"}
          </button>
        )}

        {balance.error && (
          <p className="mt-3 text-sm text-downvote">{balance.error.message}</p>
        )}
      </section>
    </div>
  );
}
