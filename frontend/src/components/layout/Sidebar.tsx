"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { 
  Home, 
  Search, 
  Bell, 
  User, 
  Wallet,
  CircleHelp,
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
  { icon: CircleHelp, label: "How it works", href: "/how-it-works" },
  { icon: Bell, label: "Notifications", href: "/notifications" },
  { icon: Wallet, label: "Wallet", href: "/wallet" },
  { icon: User, label: "Profile", href: "/profile" },
];

export default function Sidebar() {
  const pathname = usePathname();
  const { formattedBalance, isLoading: isBalanceLoading } = useUsdcBalance();
  const { profile } = useWalletProfile();
  const isConnected = Boolean(profile);

  return (
    <div className="verity-card flex h-full flex-col p-2">
      {/* Logo */}
      <div className="mb-3 flex items-center justify-between">
        <Link href="/" className="group flex w-fit items-center gap-3 py-4 xl:px-4">
          <div className="verity-blob flex h-10 w-10 items-center justify-center bg-sunburst-yellow text-lg font-semibold text-midnight transition-transform group-hover:-translate-y-0.5">
            V
            <span className="verity-blob-smile" />
          </div>
          <span className="hidden text-[23px] font-semibold leading-none tracking-[-0.44px] text-charcoal-primary xl:block">Verity</span>
        </Link>
        <div className="hidden xl:block">
          <ThemeToggle />
        </div>
      </div>

      {/* Nav Links */}
      <nav className="flex-1 space-y-1.5">
        {NAV_ITEMS.map((item) => {
          const isActive = pathname === item.href;
          const href = item.href === "/profile" ? `/profile` : item.href;
          return (
            <Link key={item.label} href={href} className="group flex w-fit items-center xl:w-full">
              <div className={`flex items-center gap-3 rounded-[10px] p-3 text-[15px] transition-all duration-200 xl:w-full xl:px-4 xl:py-3 ${
                isActive 
                  ? "bg-inverse text-inverse-text font-semibold" 
                  : "text-graphite hover:bg-stone-surface hover:text-charcoal-primary"
              }`}>
                <item.icon className="h-6 w-6 xl:h-5 xl:w-5" />
                <span className="hidden font-medium tracking-[-0.18px] xl:block">{item.label}</span>
              </div>
            </Link>
          );
        })}
      </nav>

      {/* Action Buttons */}
      <div className="mb-6 mt-auto flex flex-col items-center gap-4 xl:w-full xl:items-stretch">
        <div className="mb-2 hidden items-center justify-between rounded-[10px] bg-parchment-card p-4 shadow-[var(--shadow-subtle)] xl:flex">
          <div className="flex items-center gap-2">
            <CircleDollarSign className="h-5 w-5 text-meadow-green" />
            <span className="font-mono text-sm font-semibold text-charcoal-primary">
              {isBalanceLoading ? "..." : formattedBalance} USDC
            </span>
          </div>
        </div>

        <div className="hidden xl:block">
          <WalletConnectControl />
        </div>
        
        <button className="verity-pill flex h-12 w-12 items-center justify-center bg-inverse text-xl font-semibold text-inverse-text transition-opacity hover:opacity-90 xl:h-12 xl:w-full">
          <span className="hidden text-sm font-semibold tracking-[-0.18px] xl:block">Post</span>
          <PenSquare className="h-6 w-6 xl:hidden" />
        </button>
      </div>

      {/* Mini Profile */}
      <div className="mb-2 flex cursor-pointer items-center justify-center gap-3 rounded-[10px] p-3 transition-colors hover:bg-stone-surface xl:justify-start xl:p-4">
        <div className="verity-blob h-10 w-10 bg-sky-blue">
          <span className="verity-blob-smile" />
        </div>
        <div className="hidden xl:flex flex-col">
          <span className="text-sm font-semibold tracking-[-0.18px] text-charcoal-primary">
            {isConnected ? displayName(profile) : "Connect wallet"}
          </span>
          <span className="font-mono text-xs text-ash">
            {isConnected ? displayHandle(profile) : "@wallet"}
          </span>
        </div>
      </div>
    </div>
  );
}
