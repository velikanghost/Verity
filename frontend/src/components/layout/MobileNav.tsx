"use client"

import Link from "next/link"
import { Bell, Home, Search, User, Wallet } from "lucide-react"
import { usePathname } from "next/navigation"
import { useWalletProfile } from "@/hooks/useWalletProfile"
import { useNotificationsQuery } from "@/store/verity/verityQueries"

const MOBILE_NAV_ITEMS = [
  { icon: Home, label: "Home", href: "/" },
  { icon: Search, label: "Explore", href: "/explore" },
  { icon: Bell, label: "Alerts", href: "/notifications" },
  { icon: Wallet, label: "Portfolio", href: "/portfolio" },
  { icon: User, label: "Profile", href: "/profile" },
]

export default function MobileNav() {
  const pathname = usePathname()
  const { profile } = useWalletProfile()
  const { data: notifications = [] } = useNotificationsQuery(profile?.id || "")
  const unreadCount = notifications.filter((n: any) => !n.read).length

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/95 px-2 pb-[calc(env(safe-area-inset-bottom)+8px)] pt-2 backdrop-blur sm:hidden">
      <div className="mx-auto grid max-w-[672px] grid-cols-5 gap-1">
        {MOBILE_NAV_ITEMS.map((item) => {
          const isActive =
            item.href === "/"
              ? pathname === "/"
              : pathname === item.href.split("?")[0]
          return (
            <Link
              className={`flex min-w-0 flex-col items-center justify-center gap-1 rounded-[10px] px-1 py-2 text-[10px] font-medium tracking-[-0.12px] ${
                isActive
                  ? "bg-surface-muted text-foreground shadow-[(--shadow-subtle)]"
                  : "clickable-surface text-muted"
              }`}
              href={item.href}
              key={item.label}
            >
              <div className="relative flex items-center justify-center shrink-0">
                <item.icon className="h-5 w-5" />
                {item.href === "/notifications" && unreadCount > 0 && (
                  <span className="absolute -right-1.5 -top-1 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-coral-red text-[8px] font-bold text-white ring-2 ring-background">
                    {unreadCount}
                  </span>
                )}
              </div>
              <span className="max-w-full truncate">{item.label}</span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
