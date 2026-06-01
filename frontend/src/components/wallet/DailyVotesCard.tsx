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
    <div className="verity-card p-5">
      <div className="flex items-center gap-2 text-meadow-green">
        <Vote className="h-5 w-5" />
        <span className="font-mono text-xs font-semibold uppercase tracking-[0.16em]">
          Daily Signals
        </span>
      </div>

      <p className="mt-4 font-mono text-3xl font-semibold tracking-[-0.9px] text-midnight">
        {isLoading ? (
          '...'
        ) : (
          <>
            {remaining}
            <span className="text-lg text-ash">/{limit}</span>
          </>
        )}
      </p>

      {/* Progress bar */}
      <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-stone-surface">
        <div
          className="h-full rounded-full transition-all duration-500 ease-out"
          style={{
            width: `${fillPercent}%`,
            backgroundColor: isEmpty
              ? 'var(--color-ember-orange)'
              : isFull
                ? 'var(--color-meadow-green)'
                : 'var(--color-meadow-green)',
          }}
        />
      </div>

      <p className="mt-2 font-mono text-xs text-ash">
        {isLoading
          ? 'Loading...'
          : isEmpty
            ? 'All Upvote/Downvote signals used - resets tomorrow'
            : used > 0
              ? `${used} signal${used !== 1 ? 's' : ''} used today`
              : 'All Upvote/Downvote signals available today'}
      </p>
    </div>
  )
}
