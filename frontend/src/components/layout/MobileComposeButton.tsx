'use client'

import { MessageSquareText, Plus, TrendingUp, X } from 'lucide-react'
import { usePathname, useRouter } from 'next/navigation'
import { useState } from 'react'

type ComposeIntent = 'take' | 'market'

export default function MobileComposeButton() {
  const pathname = usePathname()
  const router = useRouter()
  const [open, setOpen] = useState(false)

  function openComposer(intent: ComposeIntent) {
    window.sessionStorage.setItem('verity-compose-intent', intent)
    window.dispatchEvent(
      new CustomEvent<ComposeIntent>('verity-compose-intent', {
        detail: intent,
      }),
    )
    setOpen(false)
    if (pathname !== '/') router.push('/')
  }

  return (
    <div className="fixed bottom-[calc(env(safe-area-inset-bottom)+82px)] right-4 z-50 sm:hidden">
      {open && (
        <div className="mb-3 w-[240px] rounded-[14px] bg-surface-solid p-2 shadow-[var(--shadow-sm)]">
          <div className="mb-2 flex items-center justify-between px-2 pt-1">
            <span className="font-mono text-[11px] font-semibold uppercase tracking-[0.16em] text-ash">
              Create
            </span>
            <button
              aria-label="Close create menu"
              className="flex h-7 w-7 items-center justify-center rounded-full text-ash transition-colors hover:bg-surface-hover hover:text-foreground"
              onClick={() => setOpen(false)}
              type="button"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <button
            className="flex w-full items-center gap-3 rounded-[10px] p-3 text-left transition-colors hover:bg-surface-hover"
            onClick={() => openComposer('market')}
            type="button"
          >
            <span className="flex h-10 w-10 items-center justify-center rounded-[16px] bg-ember-orange/10 text-ember-orange">
              <TrendingUp className="h-5 w-5" />
            </span>
            <span>
              <span className="block text-sm font-semibold tracking-[-0.18px] text-charcoal-primary">
                Market
              </span>
              <span className="mt-0.5 block text-xs tracking-[-0.14px] text-ash">
                Ask a tradable question
              </span>
            </span>
          </button>

          <button
            className="mt-1 flex w-full items-center gap-3 rounded-[10px] p-3 text-left transition-colors hover:bg-surface-hover"
            onClick={() => openComposer('take')}
            type="button"
          >
            <span className="flex h-10 w-10 items-center justify-center rounded-[16px] bg-sky-blue/10 text-sky-blue">
              <MessageSquareText className="h-5 w-5" />
            </span>
            <span>
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
        aria-expanded={open}
        aria-label={open ? 'Close create menu' : 'Create'}
        className="flex h-14 w-14 items-center justify-center rounded-full bg-brand-primary text-white shadow-[var(--shadow-sm)] transition-transform active:scale-95"
        onClick={() => setOpen((current) => !current)}
        type="button"
      >
        {open ? <X className="h-6 w-6" /> : <Plus className="h-7 w-7" />}
      </button>
    </div>
  )
}
