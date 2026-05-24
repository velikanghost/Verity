'use client'

import Link from 'next/link'
import { Bell, Home, Search, User, Wallet } from 'lucide-react'
import { usePathname } from 'next/navigation'

const MOBILE_NAV_ITEMS = [
  { icon: Home, label: 'Home', href: '/' },
  { icon: Search, label: 'Explore', href: '/explore' },
  { icon: Bell, label: 'Alerts', href: '/notifications' },
  { icon: Wallet, label: 'Wallet', href: '/wallet' },
  { icon: User, label: 'Profile', href: '/profile' },
]

export default function MobileNav() {
  const pathname = usePathname()

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/95 px-2 pb-[calc(env(safe-area-inset-bottom)+8px)] pt-2 backdrop-blur sm:hidden">
      <div className="mx-auto grid max-w-[672px] grid-cols-5 gap-1">
        {MOBILE_NAV_ITEMS.map((item) => {
          const isActive =
            item.href === '/'
              ? pathname === '/'
              : pathname === item.href.split('?')[0]
          return (
            <Link
              className={`flex min-w-0 flex-col items-center justify-center gap-1 rounded-[10px] px-1 py-2 text-[10px] font-medium tracking-[-0.12px] transition-colors ${
                isActive
                  ? 'bg-surface-muted text-foreground shadow-[var(--shadow-subtle)]'
                  : 'text-muted hover:bg-surface-hover hover:text-foreground'
              }`}
              href={item.href}
              key={item.label}
            >
              <item.icon className="h-5 w-5 shrink-0" />
              <span className="max-w-full truncate">{item.label}</span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
