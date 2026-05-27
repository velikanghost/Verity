'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import {
  Home,
  Search,
  Bell,
  User,
  Wallet,
  CircleHelp,
  CircleDollarSign,
  PenSquare,
  TrendingUp,
  MessageSquareText,
  X,
} from 'lucide-react'
import { useState } from 'react'
import ThemeToggle from '@/components/layout/ThemeToggle'
import SidebarProfile from '@/components/layout/SidebarProfile'

const NAV_ITEMS = [
  { icon: Home, label: 'Home', href: '/' },
  { icon: Search, label: 'Explore', href: '/explore' },
  { icon: CircleHelp, label: 'How it works', href: '/how-it-works' },
  { icon: Bell, label: 'Notifications', href: '/notifications' },
  { icon: Wallet, label: 'Wallet', href: '/wallet' },
  { icon: User, label: 'Profile', href: '/profile' },
]

export default function Sidebar() {
  const router = useRouter()
  const pathname = usePathname()
  const [composeOpen, setComposeOpen] = useState(false)

  function openComposer(intent: 'take' | 'market') {
    if (typeof window !== 'undefined') {
      window.sessionStorage.setItem('verity-compose-intent', intent)
      window.dispatchEvent(
        new CustomEvent('verity-compose-intent', { detail: intent }),
      )
    }
    setComposeOpen(false)
    if (pathname !== '/') router.push('/')
  }

  return (
    <div className="verity-card flex h-full flex-col p-2">
      {/* Logo */}
      <div className="mb-3 flex items-center justify-between">
        <Link
          href="/"
          className="clickable-surface group flex w-fit items-center gap-3 rounded-[12px] py-4 xl:px-4"
        >
          <div className="verity-blob flex h-10 w-10 items-center justify-center bg-sunburst-yellow text-lg font-semibold text-midnight transition-transform group-hover:-translate-y-0.5">
            V
            <span className="verity-blob-smile" />
          </div>
          <span className="hidden text-[23px] font-semibold leading-none tracking-[-0.44px] text-charcoal-primary xl:block">
            Verity
          </span>
        </Link>
        <div className="hidden xl:block">
          <ThemeToggle />
        </div>
      </div>

      {/* Nav Links */}
      <nav className="flex-1 space-y-1.5">
        {NAV_ITEMS.map((item) => {
          const isActive = pathname === item.href
          const href = item.href === '/profile' ? `/profile` : item.href
          return (
            <Link
              key={item.label}
              href={href}
              className="group flex w-fit items-center xl:w-full"
            >
              <div
                className={`flex items-center gap-3 rounded-[10px] p-3 text-[15px] transition-all duration-200 xl:w-full xl:px-4 xl:py-3 ${
                  isActive
                    ? 'bg-inverse text-inverse-text font-semibold'
                    : 'clickable-surface text-graphite'
                }`}
              >
                <item.icon className="h-6 w-6 xl:h-5 xl:w-5" />
                <span className="hidden font-medium tracking-[-0.18px] xl:block">
                  {item.label}
                </span>
              </div>
            </Link>
          )
        })}
      </nav>

      {/* Action Buttons */}
      <div className="mb-6 mt-auto flex flex-col items-center gap-4 xl:w-full xl:items-stretch">
        <div className="relative">
          {composeOpen && (
            <div className="absolute bottom-[calc(100%+10px)] left-0 z-50 w-[228px] rounded-[14px] bg-surface-solid p-2 shadow-[(--shadow-sm)]">
              <div className="mb-2 flex items-center justify-between px-2 pt-1">
                <span className="font-mono text-[11px] font-semibold uppercase tracking-[0.16em] text-ash">
                  Create
                </span>
                <button
                  aria-label="Close compose menu"
                  className="clickable-icon flex h-7 w-7 items-center justify-center text-ash hover:text-foreground"
                  onClick={() => setComposeOpen(false)}
                  type="button"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <button
                className="clickable-surface flex w-full items-center gap-3 rounded-[10px] p-3 text-left"
                onClick={() => openComposer('market')}
                type="button"
              >
                <span className="flex h-10 w-10 items-center justify-center rounded-[16px] bg-ember-orange/10 text-ember-orange">
                  <TrendingUp className="h-5 w-5" />
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-semibold tracking-[-0.18px] text-charcoal-primary">
                    Market
                  </span>
                  <span className="mt-0.5 block text-xs tracking-[-0.14px] text-ash">
                    Ask a tradable question
                  </span>
                </span>
              </button>

              <button
                className="clickable-surface mt-1 flex w-full items-center gap-3 rounded-[10px] p-3 text-left"
                onClick={() => openComposer('take')}
                type="button"
              >
                <span className="flex h-10 w-10 items-center justify-center rounded-[16px] bg-sky-blue/10 text-sky-blue">
                  <MessageSquareText className="h-5 w-5" />
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-semibold tracking-[-0.18px] text-charcoal-primary">
                    Take
                  </span>
                  <span className="mt-0.5 block text-xs tracking-[-0.14px] text-ash">
                    Share a regular post
                  </span>
                </span>
              </button>
            </div>
          )}

          <button
            aria-expanded={composeOpen}
            className="clickable verity-pill flex h-12 w-12 items-center justify-center bg-inverse text-xl font-semibold text-inverse-text hover:opacity-90 xl:h-12 xl:w-full"
            onClick={() => setComposeOpen((current) => !current)}
            type="button"
          >
            <span className="hidden text-sm font-semibold tracking-[-0.18px] xl:block">
              Post
            </span>
            <PenSquare className="h-6 w-6 xl:hidden" />
          </button>
        </div>
      </div>

      {/* Sidebar Profile & Wallet info */}
      <div className="mt-2">
        <SidebarProfile />
      </div>
    </div>
  )
}
