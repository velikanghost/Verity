"use client"

import Link from "next/link"
import {
  Sparkles,
  Home,
  User,
  Wallet,
  TrendingUp,
  Plus,
  Swords,
  X,
} from "lucide-react"
import { usePathname, useRouter } from "next/navigation"
import { useAuth } from "@/components/providers/AuthModals"
import { useWalletProfile } from "@/hooks/useWalletProfile"
import {
  useMissionsQuery,
  useAccruedLpFeesQuery,
  useClaimLpFeesMutation,
} from "@/store/verity/verityQueries"
import { useDrawerStore } from "@/store/drawerStore"
import {
  Drawer,
  DrawerContent,
  DrawerTitle,
  DrawerClose,
} from "@/components/ui/drawer"
import toast from "@/lib/toast"

export default function MobileNav() {
  const pathname = usePathname()
  const router = useRouter()
  const { authenticated, login } = useAuth()
  const { profile } = useWalletProfile()
  const { data: missions = [] } = useMissionsQuery(profile?.id)

  const { isQuickActionsOpen, openQuickActions, closeQuickActions } =
    useDrawerStore()

  // Fetch Accrued LP fees for the quick actions drawer
  const { data: accruedData, refetch: refetchAccrued } = useAccruedLpFeesQuery(
    profile?.id,
  )
  const accruedLpFees = accruedData?.accruedFeesUsdc || 0
  const { mutateAsync: claimLpFees, isPending: isClaiming } =
    useClaimLpFeesMutation()

  const incompleteMissionsCount = missions.filter(
    (m: any) => !m.completed,
  ).length

  const handleProposeMarket = () => {
    closeQuickActions()
    window.sessionStorage.setItem("verity-compose-intent", "market")
    if (pathname === "/") {
      window.dispatchEvent(
        new CustomEvent("verity-compose-intent", { detail: "market" }),
      )
    } else {
      router.push("/")
    }
  }

  const handleClaimLpFees = async () => {
    try {
      await claimLpFees()
      toast.success("LP fees claimed successfully!")
      void refetchAccrued()
    } catch (err: any) {
      toast.error(err.message || "Failed to claim LP fees.")
    }
  }

  const navigateTo = (href: string) => {
    closeQuickActions()
    router.push(href)
  }

  const MOBILE_NAV_ITEMS = [
    { icon: Home, label: "Home", href: "/" },
    { icon: TrendingUp, label: "Markets", href: "/markets" },
    { icon: null, label: "Actions", href: "#actions" }, // Center placeholder
    { icon: Sparkles, label: "Missions", href: "/missions" },
    { icon: Wallet, label: "Portfolio", href: "/portfolio" },
  ]

  return (
    <>
      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-stone-surface bg-warm-canvas/95 px-2 pb-[calc(env(safe-area-inset-bottom)+8px)] pt-2 backdrop-blur sm:hidden">
        <div className="mx-auto grid max-w-[672px] grid-cols-5 gap-1 relative">
          {MOBILE_NAV_ITEMS.map((item, idx) => {
            // Render the central "+" button
            if (idx === 2) {
              return (
                <button
                  key="center-actions"
                  onClick={() => {
                    if (!authenticated) {
                      login()
                    } else {
                      openQuickActions()
                    }
                  }}
                  className="flex flex-col items-center justify-center shrink-0 -mt-4 cursor-pointer"
                >
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-ember-orange text-white shadow-md hover:bg-ember-orange/95 active:scale-95 transition-all">
                    <Plus className="h-6 w-6 stroke-[3px]" />
                  </div>
                  <span className="text-[10px] font-semibold text-charcoal-primary tracking-[-0.12px] mt-1.5">
                    More
                  </span>
                </button>
              )
            }

            const isActive =
              item.href === "/"
                ? pathname === "/"
                : pathname === item.href?.split("?")[0]
            const isAuthRequired =
              item.href === "/portfolio" || item.href === "/missions"

            return (
              <Link
                className={`flex min-w-0 flex-col items-center justify-center gap-1 rounded-[10px] px-1 py-2 text-[10px] font-medium tracking-[-0.12px] transition-colors ${
                  isActive
                    ? "bg-stone-surface text-charcoal-primary shadow-subtle"
                    : "hover:bg-stone-surface/40 text-graphite"
                }`}
                href={item.href || "/"}
                onClick={(e) => {
                  if (isAuthRequired && !authenticated) {
                    e.preventDefault()
                    login()
                  }
                }}
                key={item.label}
              >
                <div className="relative flex items-center justify-center shrink-0">
                  {item.icon && <item.icon className="h-5 w-5" />}
                  {item.href === "/missions" && incompleteMissionsCount > 0 && (
                    <span className="absolute -right-1 -top-1 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-coral-red text-[8px] font-bold text-white shadow-sm ring-1.5 ring-warm-canvas">
                      {incompleteMissionsCount}
                    </span>
                  )}
                </div>
                <span className="max-w-full truncate">{item.label}</span>
              </Link>
            )
          })}
        </div>
      </nav>

      {/* Reusable Drawer for Quick Actions */}
      <Drawer
        open={isQuickActionsOpen}
        onOpenChange={(open) => !open && closeQuickActions()}
      >
        <DrawerContent className="max-h-[85vh] rounded-t-3xl border-t border-stone-surface bg-warm-canvas pb-8 px-4 outline-none">
          {/* Header styled as flex row directly to prevent styles overriding */}
          <div className="relative flex flex-row items-center justify-between border-b border-stone-surface pb-4 pt-2 mb-4 px-4 flex-shrink-0">
            <DrawerTitle className="font-heading text-lg font-bold text-charcoal-primary flex items-center gap-2 m-0">
              <span className="inline-block h-3.5 w-3.5 rounded-full bg-sunburst-yellow" />
              Quick Actions Hub
            </DrawerTitle>
            <DrawerClose className="rounded-full p-1.5 hover:bg-stone-surface text-ash hover:text-charcoal-primary transition-colors">
              <X className="h-4.5 w-4.5" />
            </DrawerClose>
          </div>

          {/* Accrued LP fees panel */}
          <div className="mx-2 mb-6 rounded-2xl bg-white-surface dark:bg-zinc-950 p-4 border border-stone-surface flex items-center justify-between shadow-subtle">
            <div>
              <span className="block text-[10px] font-mono font-bold uppercase tracking-wider text-ash">
                Accrued LP Fees
              </span>
              <strong className="text-xl font-bold font-mono text-charcoal-primary mt-1 block">
                ${accruedLpFees.toFixed(4)} USDC
              </strong>
            </div>
            {accruedLpFees > 0 && (
              <button
                onClick={handleClaimLpFees}
                disabled={isClaiming}
                className="bg-meadow-green text-white hover:bg-meadow-green/90 rounded-full px-5 py-2 text-xs font-bold transition-all disabled:opacity-50 cursor-pointer"
              >
                {isClaiming ? "Claiming..." : "Claim Fees"}
              </button>
            )}
          </div>

          {/* Quick Shortcuts Grid */}
          <div className="grid grid-cols-2 gap-3 px-2">
            <button
              onClick={handleProposeMarket}
              className="flex flex-col items-center justify-center p-4 rounded-2xl bg-white-surface dark:bg-zinc-950 hover:bg-stone-surface/30 border border-stone-surface text-center transition-all group active:scale-98 cursor-pointer"
            >
              <div className="h-10 w-10 rounded-full bg-sky-blue/10 text-sky-blue flex items-center justify-center mb-2 group-hover:scale-105 transition-transform">
                <Plus className="h-5 w-5" />
              </div>
              <span className="text-xs font-bold text-charcoal-primary">
                Propose Market
              </span>
              <span className="text-[10px] text-ash mt-0.5">
                Submit new prediction
              </span>
            </button>

            <button
              onClick={() => navigateTo("/missions")}
              className="flex flex-col items-center justify-center p-4 rounded-2xl bg-white-surface dark:bg-zinc-950 hover:bg-stone-surface/30 border border-stone-surface text-center transition-all group active:scale-98 cursor-pointer"
            >
              <div className="h-10 w-10 rounded-full bg-sunburst-yellow/10 text-sunburst-yellow flex items-center justify-center mb-2 group-hover:scale-105 transition-transform">
                <Sparkles className="h-5 w-5" />
              </div>
              <span className="text-xs font-bold text-charcoal-primary">
                View Missions
              </span>
              <span className="text-[10px] text-ash mt-0.5">
                {incompleteMissionsCount > 0
                  ? `${incompleteMissionsCount} pending tasks`
                  : "All completed!"}
              </span>
            </button>

            <button
              onClick={() => navigateTo("/markets?tab=pvp")}
              className="flex flex-col items-center justify-center p-4 rounded-2xl bg-white-surface dark:bg-zinc-950 hover:bg-stone-surface/30 border border-stone-surface text-center transition-all group active:scale-98 cursor-pointer"
            >
              <div className="h-10 w-10 rounded-full bg-ember-orange/10 text-ember-orange flex items-center justify-center mb-2 group-hover:scale-105 transition-transform">
                <Swords className="h-5 w-5" />
              </div>
              <span className="text-xs font-bold text-charcoal-primary">
                PvP Arena Queue
              </span>
              <span className="text-[10px] text-ash mt-0.5">
                Enter head-to-head lobby
              </span>
            </button>

            <button
              onClick={() => navigateTo("/profile")}
              className="flex flex-col items-center justify-center p-4 rounded-2xl bg-white-surface dark:bg-zinc-950 hover:bg-stone-surface/30 border border-stone-surface text-center transition-all group active:scale-98 cursor-pointer"
            >
              <div className="h-10 w-10 rounded-full bg-meadow-green/10 text-meadow-green flex items-center justify-center mb-2 group-hover:scale-105 transition-transform">
                <User className="h-5 w-5" />
              </div>
              <span className="text-xs font-bold text-charcoal-primary">
                My Profile
              </span>
              <span className="text-[10px] text-ash mt-0.5">
                Edit username or details
              </span>
            </button>
          </div>
        </DrawerContent>
      </Drawer>
    </>
  )
}
