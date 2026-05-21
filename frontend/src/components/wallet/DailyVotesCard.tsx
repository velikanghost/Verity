'use client'

import { Vote } from 'lucide-react'
import { useDailyVotes } from '@/hooks/useDailyVotes'
import { useWalletProfile } from '@/hooks/useWalletProfile'

export default function DailyVotesCard() {
  const { profile } = useWalletProfile()
  const { dailyVotes, isLoading } = useDailyVotes(profile?.id)

  const remaining = dailyVotes.votesRemaining
  const limit = dailyVotes.votesLimit
  const used = dailyVotes.votesUsed
  const fillPercent = limit > 0 ? (remaining / limit) * 100 : 100

  const isFull = remaining === limit
  const isEmpty = remaining <= 0

  return (
    <div className="rounded-[18px] border border-[(--border)] bg-[(--surface)] p-5 shadow-sm">
      <div className="flex items-center gap-2 text-[(--color-brand-secondary)]">
        <Vote className="h-5 w-5" />
        <span className="font-mono text-xs font-black uppercase tracking-[0.16em]">
          Daily Votes
        </span>
      </div>

      <p className="mt-4 text-3xl font-black text-[(--foreground)]">
        {isLoading ? (
          '...'
        ) : (
          <>
            {remaining}
            <span className="text-lg text-[(--muted)]">/{limit}</span>
          </>
        )}
      </p>

      {/* Progress bar */}
      <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-[(--surface-muted)]">
        <div
          className="h-full rounded-full transition-all duration-500 ease-out"
          style={{
            width: `${fillPercent}%`,
            backgroundColor: isEmpty
              ? 'var(--color-brand-accent)'
              : isFull
                ? 'var(--color-brand-secondary)'
                : 'var(--color-brand-secondary)',
          }}
        />
      </div>

      <p className="mt-2 font-mono text-xs text-[(--muted)]">
        {isLoading
          ? 'Loading...'
          : isEmpty
            ? 'All votes used - resets tomorrow'
            : used > 0
              ? `${used} vote${used !== 1 ? 's' : ''} used today`
              : 'All votes available today'}
      </p>
    </div>
  )
}
