"use client";

import { usePrivy, useCreateWallet, useWallets } from "@privy-io/react-auth";
import { usePrivyWallet } from "@/hooks/usePrivyWallet";
import { useUsdcBalance } from "@/hooks/useUsdcBalance";
import { useWalletProfile } from "@/hooks/useWalletProfile";
import { shortAddress } from "@/lib/arc";
import { displayHandle, displayName as getDisplayName } from "@/lib/verity";
import { LogOut, Copy, Check, Wallet } from "lucide-react";
import { useState } from "react";
import { toast } from "react-hot-toast";
import Link from "next/link";

export default function SidebarProfile() {
  const { login, logout, authenticated, ready, user } = usePrivy();
  const { address } = usePrivyWallet();
  const { createWallet } = useCreateWallet();
  const { wallets } = useWallets();
  const { formattedBalance, isLoading: isBalanceLoading } = useUsdcBalance();
  const { profile } = useWalletProfile();
  const [copied, setCopied] = useState(false);

  if (!ready) {
    return (
      <div className="verity-card animate-pulse p-4">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-full bg-stone-surface" />
          <div className="flex-1 space-y-2 py-1">
            <div className="h-4 rounded bg-stone-surface" />
            <div className="h-3 w-5/6 rounded bg-stone-surface" />
          </div>
        </div>
      </div>
    );
  }

  if (!authenticated) {
    return (
      <button
        className="verity-pill flex h-11 w-full items-center justify-center gap-2 bg-inverse px-4 text-sm font-semibold tracking-[-0.18px] text-inverse-text transition-opacity hover:opacity-90 cursor-pointer"
        onClick={login}
        type="button"
      >
        <Wallet className="h-4 w-4" />
        <span className="hidden xl:inline">Connect Wallet</span>
        <span className="inline xl:hidden">Connect</span>
      </button>
    );
  }

  if (!address) {
    const hasWallet = wallets.some(w => w.walletClientType === 'privy') || Boolean(user?.wallet);
    if (hasWallet) {
      return (
        <div className="verity-card animate-pulse p-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-stone-surface" />
            <div className="flex-1 space-y-2 py-1">
              <div className="h-4 rounded bg-stone-surface" />
              <div className="h-3 w-5/6 rounded bg-stone-surface" />
            </div>
          </div>
        </div>
      );
    }

    return (
      <button
        className="verity-pill flex h-11 w-full items-center justify-center gap-2 bg-inverse px-4 text-sm font-semibold tracking-[-0.18px] text-inverse-text transition-opacity hover:opacity-90 cursor-pointer"
        onClick={() => createWallet()}
        type="button"
      >
        <Wallet className="h-4 w-4" />
        <span className="hidden xl:inline">Activate Wallet</span>
        <span className="inline xl:hidden">Activate</span>
      </button>
    );
  }

  const walletAddr = address || user?.wallet?.address || "";
  const displayAddress = shortAddress(walletAddr);

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!walletAddr) return;
    navigator.clipboard.writeText(walletAddr);
    setCopied(true);
    toast.success("Address copied!");
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="verity-card flex flex-col gap-3 p-3 xl:p-4 border border-border bg-surface-solid shadow-[var(--shadow-subtle)]">
      {/* Top Section: Avatar, User Details, Logout */}
      <div className="flex items-center justify-between gap-2">
        <Link href="/profile" className="flex items-center gap-3 min-w-0 hover:opacity-85 transition-opacity">
          <div className="verity-blob h-10 w-10 bg-sky-blue shrink-0">
            <span className="verity-blob-smile" />
          </div>
          <div className="hidden xl:flex flex-col min-w-0">
            <span className="text-sm font-semibold tracking-[-0.18px] text-charcoal-primary truncate">
              {profile ? getDisplayName(profile) : "User"}
            </span>
            <span className="font-mono text-xs text-ash truncate">
              {profile ? displayHandle(profile) : "@wallet"}
            </span>
          </div>
        </Link>
        <button
          className="flex h-8 w-8 items-center justify-center rounded-lg text-ash hover:bg-stone-surface hover:text-coral-red transition-colors cursor-pointer shrink-0"
          onClick={logout}
          title="Sign out"
          type="button"
        >
          <LogOut className="h-4 w-4" />
        </button>
      </div>

      <div className="hidden xl:block h-px bg-stone-surface" />

      {/* Bottom Section: Wallet Address & Balance (Only visible on wide layout) */}
      <div className="hidden xl:flex items-center justify-between gap-2">
        {/* Wallet Address (Click to copy) */}
        <button
          className="flex items-center gap-1.5 font-mono text-xs text-ash hover:text-charcoal-primary transition-colors cursor-pointer min-w-0"
          onClick={handleCopy}
          title="Click to copy address"
        >
          <span className="truncate">{displayAddress}</span>
          {copied ? (
            <Check className="h-3.5 w-3.5 text-green-600 shrink-0" />
          ) : (
            <Copy className="h-3.5 w-3.5 shrink-0" />
          )}
        </button>

        {/* Balance */}
        <div className="font-mono text-xs font-bold text-charcoal-primary shrink-0">
          {isBalanceLoading ? "..." : `${formattedBalance} USDC`}
        </div>
      </div>
    </div>
  );
}
