'use client'

import { useState } from 'react'
import { usePrivy } from '@privy-io/react-auth'
import { ArrowRight, ShieldCheck, Sparkles, X } from 'lucide-react'

const DISMISSED_KEY = 'verity-privy-sign-in-prompt-dismissed'

export default function PrivySignInPrompt() {
  const { authenticated, login, ready } = usePrivy()
  const [dismissed, setDismissed] = useState(() => {
    if (typeof window === 'undefined') return false
    return window.sessionStorage.getItem(DISMISSED_KEY) === 'true'
  })

  if (!ready || authenticated || dismissed) return null

  function dismiss() {
    if (typeof window !== 'undefined') {
      window.sessionStorage.setItem(DISMISSED_KEY, 'true')
    }
    setDismissed(true)
  }

  return (
    <div
      aria-labelledby="privy-sign-in-title"
      aria-modal="true"
      className="fixed inset-0 z-90 flex items-end justify-center bg-obsidian/45 px-3 py-3 backdrop-blur-sm sm:items-center sm:p-6"
      role="dialog"
    >
      <section className="w-full max-w-[430px] overflow-hidden rounded-[18px] bg-surface-solid shadow-[(--shadow-sm)]">
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <div className="flex items-center gap-3">
            <span className="verity-blob flex h-10 w-10 items-center justify-center bg-sunburst-yellow text-sm font-semibold text-midnight">
              V
              <span className="verity-blob-smile scale-75" />
            </span>
            <div>
              <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.16em] text-ash">
                Welcome to Verity
              </p>
              <h2
                className="text-[21px] font-semibold leading-[1.1] tracking-[-0.35px] text-charcoal-primary"
                id="privy-sign-in-title"
              >
                Sign in to start
              </h2>
            </div>
          </div>

          <button
            aria-label="Close sign in prompt"
            className="clickable-icon flex h-9 w-9 items-center justify-center bg-parchment-card text-ash hover:text-foreground"
            onClick={dismiss}
            type="button"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="px-5 py-5">
          <p className="text-[15px] leading-normal tracking-[-0.2px] text-graphite">
            Sign in with Privy to post Takes, create Markets, vote, fund pools,
            and manage your Arc wallet from one place.
          </p>

          <div className="mt-4 grid gap-2">
            <PromptPoint
              icon={<Sparkles className="h-4 w-4" />}
              label="Create Takes and Markets"
            />
            <PromptPoint
              icon={<ShieldCheck className="h-4 w-4" />}
              label="Set up your secure wallet flow"
            />
          </div>

          <button
            className="clickable verity-pill mt-5 flex h-11 w-full items-center justify-center gap-2 bg-inverse text-sm font-semibold tracking-[-0.18px] text-inverse-text hover:opacity-90"
            onClick={login}
            type="button"
          >
            Sign in with Privy
            <ArrowRight className="h-4 w-4" />
          </button>

          <button
            className="mt-3 flex h-9 w-full items-center justify-center text-sm font-semibold tracking-[-0.18px] text-ash transition-colors hover:text-foreground"
            onClick={dismiss}
            type="button"
          >
            Continue browsing
          </button>
        </div>
      </section>
    </div>
  )
}

function PromptPoint({
  icon,
  label,
}: {
  icon: React.ReactNode
  label: string
}) {
  return (
    <div className="flex items-center gap-3 rounded-[10px] bg-surface-muted px-3 py-2 shadow-[(--shadow-subtle)]">
      <span className="flex h-8 w-8 items-center justify-center rounded-[12px] bg-white-surface text-meadow-green shadow-[(--shadow-subtle)]">
        {icon}
      </span>
      <span className="text-sm font-semibold tracking-[-0.18px] text-charcoal-primary">
        {label}
      </span>
    </div>
  )
}
