'use client'

import type { MouseEvent } from 'react'
import { ArrowDown, ArrowUp, MessageCircle, Repeat2, Share } from 'lucide-react'
import type { VoteSide } from '@/lib/verity'

export interface MarketCardProps {
  variant?: 'compact' | 'detail'
  name: string
  handle: string
  time: string
  postContent?: string
  question: string
  category: string
  deadline: string
  resolutionSource?: string
  yesCondition?: string
  noCondition?: string
  status?: string
  yesPercent: number
  usdcYes: number
  usdcNo: number
  marketCreationFeeUsdc?: number
  tradingFeeBps?: number
  freeYesVotes?: number
  freeNoVotes?: number
  totalFreeVotes?: number
  uniqueVotersCount?: number
  qualificationThreshold?: number
  uniqueVoterThreshold?: number
  dailyVotesRemaining?: number
  votingDisabledMessage?: string | null
  comments: number
  reshares: number
  viewerVote?: VoteSide | null
  reshared?: boolean
  onVote?: (side: VoteSide) => void
  onUsdcVote?: (side: VoteSide, amount: number) => void
  onOpenDetails?: () => void
  onComment?: () => void
  onReshare?: () => void
  onShare?: () => void
  avatarColor?: string
}

export default function MarketCard({
  variant = 'compact',
  name,
  handle,
  time,
  postContent,
  question,
  category,
  deadline,
  resolutionSource,
  yesCondition,
  noCondition,
  status = 'open',
  yesPercent,
  usdcYes,
  usdcNo,
  marketCreationFeeUsdc = 1,
  freeYesVotes = 0,
  freeNoVotes = 0,
  totalFreeVotes,
  qualificationThreshold = 50,
  dailyVotesRemaining = 10,
  votingDisabledMessage,
  comments,
  reshares,
  viewerVote,
  reshared = false,
  onVote,
  onOpenDetails,
  onComment,
  onReshare,
  onShare,
}: MarketCardProps) {
  const totalUsdc = usdcYes + usdcNo
  const hasBackedSentiment = totalUsdc > 0
  const totalVotes = totalFreeVotes ?? freeYesVotes + freeNoVotes
  const freeYesPercent = totalVotes > 0 ? (freeYesVotes / totalVotes) * 100 : 50
  const displayYesPercent = hasBackedSentiment ? yesPercent : freeYesPercent
  const noPercent =
    totalVotes > 0 || hasBackedSentiment ? 100 - displayYesPercent : 50
  const isOpenForVotes = status === 'open_for_votes'
  const isQualified = status === 'qualified'
  const isTradable = status === 'tradable'
  const isClosed = ['closed', 'resolving', 'resolved', 'voided'].includes(
    status,
  )
  const canFreeVote = isOpenForVotes || isQualified
  const hasViewerVoted = Boolean(viewerVote)
  const voteDisabled =
    !canFreeVote || hasViewerVoted || dailyVotesRemaining <= 0
  const voteThresholdMet = totalVotes >= qualificationThreshold
  const votesToReview = Math.max(0, qualificationThreshold - totalVotes)
  const qualificationProgress = Math.min(
    100,
    (totalVotes / qualificationThreshold) * 100,
  )
  const isDetail = variant === 'detail'
  const creatorLabel = handle === '@unknown' ? name : handle
  const openDetails = () => {
    if (!isDetail) onOpenDetails?.()
  }
  const stopClick = (event: MouseEvent) => event.stopPropagation()

  return (
    <article
      className={`rounded-[10px] border border-[(--border)] bg-[(--surface)] p-4 shadow-sm transition-colors hover:bg-[(--surface-solid)] ${
        isDetail ? '' : 'cursor-pointer'
      }`}
      onClick={openDetails}
      onKeyDown={(event) => {
        if (!isDetail && (event.key === 'Enter' || event.key === ' ')) {
          event.preventDefault()
          openDetails()
        }
      }}
      role={isDetail ? undefined : 'link'}
      tabIndex={isDetail ? undefined : 0}
    >
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-[17px] font-bold leading-snug text-[(--foreground)] sm:text-lg">
            {question}
          </h3>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-[(--muted)]">
            <span>by</span>
            <span className="font-mono text-[(--foreground)]">
              {creatorLabel}
            </span>
            <span className="font-mono text-[(--muted)]">{'\u00B7'}</span>
            <span className="font-mono">{time}</span>
          </div>
        </div>

        <span
          className={`shrink-0 pt-0.5 font-mono text-[11px] font-bold uppercase tracking-wider ${isClosed ? 'text-[(--muted)]' : 'text-[(--color-brand-secondary)]'}`}
        >
          {status.replaceAll('_', ' ')}
        </span>
      </div>

      {postContent && postContent !== question && (
        <p className="mb-3 line-clamp-2 whitespace-pre-wrap text-sm leading-relaxed text-[(--muted)]">
          {postContent}
        </p>
      )}

      <div className="mb-2 flex flex-wrap gap-2">
        <span className="rounded-[3px] border border-[(--border)] bg-[(--surface-solid)] px-2 py-0.5 font-mono text-[11px] text-[(--muted)]">
          {category}
        </span>
      </div>

      <div className="mb-3 rounded-[7px] bg-[(--surface-muted)] p-3">
        <div className="mb-3 font-mono text-[11px] font-bold uppercase text-[(--foreground)]">
          Vote sentiment
        </div>
        <div className="flex h-1.5 overflow-hidden rounded-full bg-zinc-200">
          <div
            className="h-full bg-[(--color-brand-secondary)] transition-all"
            style={{ width: `${displayYesPercent}%` }}
          />
          <div
            className="h-full bg-[(--color-brand-accent)] transition-all"
            style={{ width: `${noPercent}%` }}
          />
        </div>
        <div className="mt-2 flex justify-between font-mono text-[11px] text-[(--muted)]">
          {totalVotes > 0 ? (
            <>
              <span>{displayYesPercent.toFixed(1)}% Yes</span>
              <span>{noPercent.toFixed(1)}% No</span>
            </>
          ) : (
            <span>No votes yet</span>
          )}
        </div>
      </div>

      <div className="mb-3 rounded-[7px] border border-dashed border-[(--border)] bg-[(--surface-muted)] p-3 font-mono text-[11px] text-[(--muted)]">
        <div className="mb-2 flex flex-wrap justify-between gap-2">
          <span>{totalVotes} votes cast</span>
          <span>
            {voteThresholdMet
              ? 'Review threshold met'
              : `${votesToReview} to review`}
          </span>
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-[(--surface-solid)]">
          <div
            className="h-full bg-[(--color-brand-secondary)]"
            style={{ width: `${qualificationProgress}%` }}
          />
        </div>
        <div className="mt-2">
          <span>Votes left today: {dailyVotesRemaining}</span>
        </div>
      </div>

      {isTradable ? (
        <div className="mb-3 grid grid-cols-2 gap-2" onClick={stopClick}>
          <button
            className="h-9 rounded-[6px] border border-[(--color-brand-secondary)] bg-[(--color-brand-secondary)]/10 text-sm font-bold text-[(--foreground)]"
            type="button"
          >
            Back YES with USDC
          </button>
          <button
            className="h-9 rounded-[6px] border border-[(--color-brand-accent)] bg-[(--color-brand-accent)]/10 text-sm font-bold text-[(--foreground)]"
            type="button"
          >
            Back NO with USDC
          </button>
        </div>
      ) : canFreeVote ? (
        <div className="mb-3" onClick={stopClick}>
          {isQualified && (
            <p className="mb-3 rounded-[7px] border border-[(--color-brand-secondary)]/30 bg-[(--color-brand-secondary)]/10 p-3 text-sm font-semibold text-[(--foreground)]">
              Qualified for USDC trading review
            </p>
          )}
          <div className="mb-2 grid grid-cols-2 gap-2">
            <button
              className="flex h-8 items-center justify-center gap-1 rounded-[5px] border border-[(--color-brand-secondary)] bg-[(--color-brand-secondary)]/10 text-sm font-medium text-[(--foreground)] transition-colors hover:bg-[(--color-brand-secondary)]/20 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={voteDisabled}
              onClick={() => onVote?.('YES')}
              title={yesCondition}
              type="button"
            >
              Upvote
            </button>
            <button
              className="flex h-8 items-center justify-center gap-1 rounded-[5px] border border-[(--color-brand-accent)] bg-[(--color-brand-accent)]/10 text-sm font-medium text-[(--foreground)] transition-colors hover:bg-[(--color-brand-accent)]/20 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={voteDisabled}
              onClick={() => onVote?.('NO')}
              title={noCondition}
              type="button"
            >
              Downvote
            </button>
          </div>
          {votingDisabledMessage && (
            <p className="font-mono text-[11px] text-[(--color-brand-accent)]">
              {votingDisabledMessage}
            </p>
          )}
        </div>
      ) : (
        <p className="mb-3 rounded-[7px] border border-[(--border)] bg-[(--surface-muted)] p-3 text-sm font-semibold text-[(--muted)]">
          This market is not open for free voting.
        </p>
      )}

      <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-1 font-mono text-[11px] text-[(--muted)]">
        {isTradable && (
          <span>
            Liquidity $
            {totalUsdc.toLocaleString(undefined, { maximumFractionDigits: 2 })}
          </span>
        )}
        <span>Closes {deadline}</span>
        {isDetail && (
          <span>
            Create fee {Number(marketCreationFeeUsdc).toFixed(2)} USDC
          </span>
        )}
        {isDetail && resolutionSource && (
          <span className="min-w-0 truncate">Source: {resolutionSource}</span>
        )}
      </div>

      {isDetail && (
        <div className="mb-3 grid gap-2 rounded-[7px] border border-dashed border-[(--border)] bg-[(--surface-muted)] p-3 font-mono text-[11px] text-[(--muted)]">
          {yesCondition && (
            <span className="text-[(--color-brand-secondary)]">
              YES: {yesCondition}
            </span>
          )}
          {noCondition && (
            <span className="text-[(--color-brand-accent)]">
              NO: {noCondition}
            </span>
          )}
        </div>
      )}

      <div
        className="flex max-w-[425px] items-center justify-between border-t border-dashed border-[(--border)] pt-1.5 text-[(--muted)]"
        onClick={stopClick}
      >
        <button
          aria-label={`Comment on ${question}`}
          className="group flex items-center gap-2 transition-colors hover:text-[(--foreground)]"
          onClick={onComment}
          type="button"
        >
          <span className="rounded-full p-2 transition-colors group-hover:bg-[(--surface-hover)]">
            <MessageCircle className="h-4 w-4" />
          </span>
          <span className="text-xs">{comments}</span>
        </button>

        <button
          aria-label={`Reshare ${question}`}
          aria-pressed={reshared}
          className={`group flex items-center gap-2 transition-colors hover:text-[(--foreground)] ${reshared ? 'text-[(--color-brand-secondary)]' : ''}`}
          onClick={onReshare}
          type="button"
        >
          <span className="rounded-full p-2 transition-colors group-hover:bg-[(--surface-hover)]">
            <Repeat2 className="h-4 w-4" />
          </span>
          <span className="text-xs">{reshares}</span>
        </button>

        <button
          aria-label={`Upvote ${question}`}
          aria-pressed={viewerVote === 'YES'}
          className={`group flex items-center gap-2 transition-colors hover:text-[(--color-brand-secondary)] ${
            viewerVote === 'YES' ? 'text-[(--color-brand-secondary)]' : ''
          }`}
          disabled={voteDisabled}
          onClick={() => onVote?.('YES')}
          type="button"
        >
          <span className="rounded-full p-2 transition-colors group-hover:bg-[(--color-brand-secondary)]/10">
            <ArrowUp className="h-4 w-4" />
          </span>
          <span className="text-xs">{freeYesVotes}</span>
        </button>

        <button
          aria-label={`Downvote ${question}`}
          aria-pressed={viewerVote === 'NO'}
          className={`group flex items-center gap-2 transition-colors hover:text-[(--color-brand-accent)] ${
            viewerVote === 'NO' ? 'text-[(--color-brand-accent)]' : ''
          }`}
          disabled={voteDisabled}
          onClick={() => onVote?.('NO')}
          type="button"
        >
          <span className="rounded-full p-2 transition-colors group-hover:bg-[(--color-brand-accent)]/10">
            <ArrowDown className="h-4 w-4" />
          </span>
          <span className="text-xs">{freeNoVotes}</span>
        </button>

        <button
          aria-label={`Share ${question}`}
          className="group flex items-center gap-2 transition-colors hover:text-[(--foreground)]"
          onClick={onShare}
          type="button"
        >
          <span className="rounded-full p-2 transition-colors group-hover:bg-[(--surface-hover)]">
            <Share className="h-4 w-4" />
          </span>
        </button>
      </div>
    </article>
  )
}
