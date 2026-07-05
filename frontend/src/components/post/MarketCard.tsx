"use client"

import Link from "next/link"
import { useState, type MouseEvent } from "react"
import { Input } from "@/components/ui/input"
import { ArrowDown, ArrowUp, MessageCircle, Share } from "lucide-react"
import UserHoverCard from "@/components/social/UserHoverCard"
import type { Profile, VoteSide } from "@/lib/verity"

export interface MarketCardProps {
  variant?: "compact" | "detail"
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
  liquidity?: number
  actionLoading?: boolean
  actionLoadingStatus?: string | null
  isConnected?: boolean
  onAddLP?: (amount: number) => Promise<void>
  profileHref?: string
  profile?: Profile
  outcomeCount?: number
  outcomes?: string[]
  outcomePrices?: number[]
  minimumPoolBalance?: number
}

export default function MarketCard({
  variant = "compact",
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
  status = "open",
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
  onUsdcVote,
  liquidity = 0,
  actionLoading = false,
  actionLoadingStatus = null,
  isConnected = false,
  onAddLP,
  profileHref,
  profile,
  outcomeCount = 2,
  outcomes = [],
  outcomePrices = [],
  minimumPoolBalance = 20,
}: MarketCardProps) {
  const isPvp = category?.toLowerCase() === "pvp"
  const yesLabel = isPvp ? yesCondition || "YES" : "YES"
  const noLabel = isPvp ? noCondition || "NO" : "NO"
  const [lpAmount, setLpAmount] = useState("10")
  const [tradeAmount, setTradeAmount] = useState("10")
  const totalUsdc = usdcYes + usdcNo
  const isMulti = outcomeCount > 2
  const outcomeList = isMulti ? outcomes : [yesLabel, noLabel]
  const displayLiquidity = isMulti ? liquidity : totalUsdc
  const totalVotes = totalFreeVotes ?? freeYesVotes + freeNoVotes
  const isOpenForVotes = status === "open_for_votes"
  const isQualified = status === "qualified"
  const isTradable = status === "tradable"
  const isClosed = ["closed", "resolving", "resolved", "voided"].includes(
    status,
  )
  const canFreeVote = [
    "open_for_votes",
    "qualified",
    "funding_pool",
    "tradable",
  ].includes(status)
  const hasViewerVoted = Boolean(viewerVote)
  const voteDisabled =
    !canFreeVote || hasViewerVoted || dailyVotesRemaining <= 0
  const voteThresholdMet = freeYesVotes >= 30
  const votesToReview = Math.max(0, 30 - freeYesVotes)
  const upvoteRatio = totalVotes > 0 ? (freeYesVotes / totalVotes) * 100 : 0
  const downvoteRatio = totalVotes > 0 ? (freeNoVotes / totalVotes) * 100 : 0
  const isDetail = variant === "detail"
  const creatorLabel = handle === "@unknown" ? name : handle
  const statusTone = getStatusTone(status)
  const openDetails = () => {
    if (!isDetail) onOpenDetails?.()
  }
  const stopClick = (event: MouseEvent) => event.stopPropagation()

  return (
    <article
      className={`verity-card p-4 sm:p-5 ${isDetail ? "" : "clickable-card"}`}
      onClick={openDetails}
      onKeyDown={(event) => {
        if (!isDetail && (event.key === "Enter" || event.key === " ")) {
          event.preventDefault()
          openDetails()
        }
      }}
      role={isDetail ? undefined : "link"}
      tabIndex={isDetail ? undefined : 0}
    >
      <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h3 className="text-[19px] font-semibold leading-[1.22] tracking-[-0.25px] text-midnight sm:text-[21px]">
            {question}
          </h3>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-[12px] tracking-[-0.14px] text-ash">
            <span>by</span>
            {profileHref ? (
              <UserHoverCard href={profileHref} profile={profile}>
                <Link
                  className="clickable-link font-medium text-charcoal-primary"
                  href={profileHref}
                  onClick={stopClick}
                >
                  {creatorLabel}
                </Link>
              </UserHoverCard>
            ) : (
              <span className="font-medium text-charcoal-primary">
                {creatorLabel}
              </span>
            )}
            <span className="text-ash">{"\u00B7"}</span>
            <span className="font-mono">{time}</span>
          </div>
        </div>
      </div>

      {postContent && postContent !== question && (
        <p className="mb-4 line-clamp-2 whitespace-pre-wrap text-[15px] leading-[1.47] tracking-[-0.2px] text-graphite">
          {postContent}
        </p>
      )}

      <div className="mb-2 flex flex-wrap gap-2">
        <span className="rounded-[6px] bg-parchment-card px-2.5 py-1 text-[12px] font-medium tracking-[-0.14px] text-graphite shadow-subtle">
          {category?.toLowerCase() === "pvp" ? "PvP" : category}
        </span>
      </div>

      <div
        className="mb-4 rounded-[12px] bg-parchment-card p-4 shadow-subtle"
        onClick={stopClick}
      >
        <div className="mb-2 flex items-center justify-between text-[12px] font-semibold uppercase tracking-[0.12em] text-charcoal-primary">
          {isTradable ? (
            <>
              <span>Active Pool Liquidity</span>
              <span className="font-mono text-xs font-semibold text-meadow-green">
                {liquidity.toFixed(2)} USDC
              </span>
            </>
          ) : (
            <>
              <span>Pool Funding</span>
              <span className="font-mono text-xs font-semibold text-meadow-green">
                {liquidity.toFixed(2)} / {minimumPoolBalance.toFixed(2)} USDC
              </span>
            </>
          )}
        </div>

        {!isTradable && (
          <div className="mb-3">
            <div className="h-2 overflow-hidden rounded-full bg-white-surface shadow-subtle">
              <div
                className="h-full bg-meadow-green transition-all duration-500"
                style={{
                  width: `${Math.min(100, (liquidity / minimumPoolBalance) * 100)}%`,
                }}
              />
            </div>
          </div>
        )}

        {!isClosed &&
          (isTradable ? null : status === "funding_pool" ||
            (status === "qualified" && liquidity >= minimumPoolBalance) ? (
            <div className="flex flex-col items-center justify-center py-3 text-center">
              <svg
                className="mb-2 h-7 w-7 animate-spin text-meadow-green"
                fill="none"
                viewBox="0 0 24 24"
                xmlns="http://www.w3.org/2000/svg"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>
              <span className="font-mono text-xs font-semibold text-charcoal-primary">
                All conditions met
              </span>
              <span className="mt-0.5 text-[11px] text-ash">
                Deploying market on-chain...
              </span>
            </div>
          ) : (
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Input
                  className="h-10 w-full rounded-[10px] bg-white-surface pl-3 pr-12 font-mono text-xs text-charcoal-primary shadow-subtle border-0 focus-visible:ring-2 focus-visible:ring-meadow-green/25 focus-visible:ring-offset-0 focus-visible:border-transparent"
                  min="1"
                  onChange={(e) => setLpAmount(e.target.value)}
                  placeholder="Amount"
                  step="1"
                  type="number"
                  value={lpAmount}
                />
                <span className="absolute right-3 top-3 font-mono text-[9px] font-semibold uppercase text-ash">
                  USDC
                </span>
              </div>
              <button
                className="clickable verity-pill flex h-10 items-center justify-center bg-inverse px-4 text-sm font-semibold tracking-[-0.18px] text-inverse-text hover:opacity-90"
                onClick={() => onOpenDetails?.()}
                type="button"
              >
                Fund
              </button>
            </div>
          ))}
      </div>

      {isTradable && (
        <div className="mb-3" onClick={stopClick}>
          <div className="flex gap-2 mb-2">
            <div className="relative flex-1">
              <Input
                className="h-10 w-full rounded-[10px] bg-white-surface pl-3 pr-12 font-mono text-xs text-charcoal-primary shadow-subtle border-0 cursor-pointer focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:border-transparent"
                readOnly
                onClick={(e) => {
                  e.stopPropagation()
                  onOpenDetails?.()
                }}
                placeholder="Trade amount"
                type="text"
                value={tradeAmount}
              />
              <span className="absolute right-3 top-3 font-mono text-[9px] font-semibold uppercase text-ash">
                USDC
              </span>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button
              className="clickable flex-1 text-center py-2 px-3 rounded-lg font-mono text-xs font-bold transition-all duration-150 bg-meadow-green/10 text-meadow-green border border-meadow-green/20 hover:bg-meadow-green/20"
              onClick={(e) => {
                e.stopPropagation()
                onOpenDetails?.()
              }}
              type="button"
            >
              BUY
            </button>
            <button
              className="clickable flex-1 text-center py-2 px-3 rounded-lg font-mono text-xs font-bold transition-all duration-150 bg-ember-orange/10 text-ember-orange border border-ember-orange/20 hover:bg-ember-orange/15"
              onClick={(e) => {
                e.stopPropagation()
                onOpenDetails?.()
              }}
              type="button"
            >
              SELL
            </button>
          </div>
        </div>
      )}

      <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-1 font-mono text-[11px] text-ash">
        {isTradable && (
          <span>
            Liquidity $
            {displayLiquidity.toLocaleString(undefined, {
              maximumFractionDigits: 2,
            })}
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
        <div className="mb-3 grid gap-2 rounded-[10px] bg-parchment-card p-3 font-mono text-[11px] text-ash shadow-subtle">
          {isMulti ? (
            outcomes?.map((outcomeName, idx) => {
              const price = outcomePrices?.[idx] ?? 1 / outcomeCount
              const priceCents = Math.round(price * 100)
              return (
                <div
                  className="flex justify-between items-center"
                  key={outcomeName}
                >
                  <span className="text-charcoal-primary font-semibold">
                    {outcomeName}
                  </span>
                  <span className="text-sky-blue font-mono font-bold">
                    {priceCents}¢
                  </span>
                </div>
              )
            })
          ) : (
            <>
              {yesCondition && (
                <span className="text-meadow-green">YES: {yesCondition}</span>
              )}
              {noCondition && (
                <span className="text-ember-orange">NO: {noCondition}</span>
              )}
            </>
          )}
        </div>
      )}

      <div className="border-t border-dashed border-stone-surface my-3" />

      <div
        className="flex max-w-full items-center justify-between pt-1 text-ash sm:max-w-[425px]"
        onClick={stopClick}
      >
        <button
          aria-label={`Comment on ${question}`}
          className="clickable-icon group flex items-center gap-2 px-1 text-ash hover:text-foreground"
          onClick={onComment}
          type="button"
        >
          <span className="rounded-full p-2">
            <MessageCircle className="h-4 w-4" />
          </span>
          <span className="text-xs">{comments}</span>
        </button>

        <button
          aria-label={`Upvote ${question}`}
          aria-pressed={viewerVote === "YES"}
          className={`clickable-icon group flex items-center gap-2 px-1 hover:text-meadow-green ${
            viewerVote === "YES" ? "text-meadow-green" : "text-ash"
          }`}
          disabled={voteDisabled}
          onClick={() => onVote?.("YES")}
          type="button"
        >
          <span className="rounded-full p-2">
            <ArrowUp className="h-4 w-4" />
          </span>
          <span className="text-xs">{freeYesVotes}</span>
        </button>

        <button
          aria-label={`Downvote ${question}`}
          aria-pressed={viewerVote === "NO"}
          className={`clickable-icon group flex items-center gap-2 px-1 hover:text-ember-orange ${
            viewerVote === "NO" ? "text-ember-orange" : "text-ash"
          }`}
          disabled={voteDisabled}
          onClick={() => onVote?.("NO")}
          type="button"
        >
          <span className="rounded-full p-2">
            <ArrowDown className="h-4 w-4" />
          </span>
          <span className="text-xs">{freeNoVotes}</span>
        </button>

        <button
          aria-label={`Share ${question}`}
          className="clickable-icon group flex items-center gap-2 px-1 text-ash hover:text-foreground"
          type="button"
        >
          <span className="rounded-full p-2">
            <Share className="h-4 w-4" />
          </span>
        </button>
      </div>
    </article>
  )
}

function getStatusTone(status: string) {
  switch (status) {
    case "open_for_votes":
      return "bg-sky-blue/10 text-sky-blue"
    case "qualified":
      return "bg-sunburst-yellow/25 text-charcoal-primary"
    case "funding_pool":
      return "bg-ember-orange/10 text-ember-orange"
    case "tradable":
      return "bg-meadow-green/12 text-meadow-green"
    case "resolved":
      return "bg-brand-primary text-white shadow-sm"
    case "voided":
      return "bg-stone-surface text-ash"
    case "resolving":
      return "bg-parchment-card text-charcoal-primary"
    default:
      return "bg-parchment-card text-graphite"
  }
}
