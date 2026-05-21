"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { 
  Home, 
  Search, 
  Bell, 
  User, 
  Wallet,
  TrendingUp,
  CircleDollarSign,
  PenSquare
} from "lucide-react";
import ThemeToggle from "@/components/layout/ThemeToggle";
import WalletConnectControl from "@/components/wallet/WalletConnectControl";
import { useUsdcBalance } from "@/hooks/useUsdcBalance";
import { useWalletProfile } from "@/hooks/useWalletProfile";
import { displayHandle, displayName } from "@/lib/verity";

const NAV_ITEMS = [
  { icon: Home, label: "Home", href: "/" },
  { icon: Search, label: "Explore", href: "/explore" },
  { icon: TrendingUp, label: "Markets", href: "/explore?onlyMarkets=true" },
  { icon: Bell, label: "Notifications", href: "/notifications" },
  { icon: Wallet, label: "Wallet", href: "/wallet" },
  { icon: User, label: "/profile", href: "/profile" },
];

export default function Sidebar() {
  const pathname = usePathname();
  const { formattedBalance, isLoading: isBalanceLoading } = useUsdcBalance();
  const { profile } = useWalletProfile();
  const isConnected = Boolean(profile);

  return (
    <div className="flex h-full flex-col rounded-[18px] border border-border bg-surface p-2 shadow-sm">
      {/* Logo */}
      <div className="mb-4 flex items-center justify-between">
        <Link href="/" className="group flex w-fit items-center gap-3 py-4 xl:px-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-inverse text-xl font-black text-inverse-text transition-transform group-hover:-translate-y-0.5">
            V
          </div>
          <span className="hidden text-2xl font-black tracking-tight text-foreground xl:block">Verity</span>
        </Link>
        <div className="hidden xl:block">
          <ThemeToggle />
        </div>
      </div>

      {/* Nav Links */}
      <nav className="flex-1 space-y-2">
        {NAV_ITEMS.map((item) => {
          const isActive = pathname === item.href;
          const href = item.href === "/profile" ? `/profile` : item.href;
          return (
            <Link key={item.label} href={href} className="group flex w-fit items-center xl:w-full">
              <div className={`flex items-center gap-4 rounded-[13px] p-3 transition-all duration-200 xl:w-full xl:px-4 xl:py-3 ${
                isActive 
                  ? "bg-inverse text-inverse-text font-black" 
                  : "text-muted hover:bg-surface-hover hover:text-foreground"
              }`}>
                <item.icon className="h-7 w-7 xl:h-6 xl:w-6" />
                <span className="hidden text-lg font-bold xl:block">{item.label}</span>
              </div>
            </Link>
          );
        })}
      </nav>

      {/* Action Buttons */}
      <div className="mb-6 mt-auto flex flex-col items-center gap-4 xl:w-full xl:items-stretch">
        <div className="mb-2 hidden items-center justify-between rounded-[13px] border border-dashed border-border bg-surface-muted p-4 xl:flex">
          <div className="flex items-center gap-2">
            <CircleDollarSign className="h-5 w-5 text-brand-secondary" />
            <span className="font-mono text-sm font-bold text-foreground">
              {isBalanceLoading ? "..." : formattedBalance} USDC
            </span>
          </div>
        </div>

        <div className="hidden xl:block">
          <WalletConnectControl />
        </div>
        
        <button className="flex h-14 w-14 items-center justify-center rounded-[13px] bg-inverse text-xl font-black text-inverse-text transition-opacity hover:opacity-85 xl:h-14 xl:w-full">
          <span className="hidden font-mono text-xs uppercase tracking-[0.16em] xl:block">Post</span>
          <PenSquare className="h-6 w-6 xl:hidden" />
        </button>
      </div>

      {/* Mini Profile */}
      <div className="mb-2 flex cursor-pointer items-center justify-center gap-3 rounded-[13px] p-3 transition-colors hover:bg-surface-hover xl:justify-start xl:p-4">
        <div className="h-10 w-10 rounded-full bg-inverse" />
        <div className="hidden xl:flex flex-col">
          <span className="text-sm font-black text-foreground">
            {isConnected ? displayName(profile) : "Connect wallet"}
          </span>
          <span className="font-mono text-xs text-muted">
            {isConnected ? displayHandle(profile) : "@wallet"}
          </span>
        </div>
      </div>
    </div>
  );
}
