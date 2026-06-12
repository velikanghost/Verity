"use client"

import { useState, useMemo } from "react"
import { Input } from "@/components/ui/input"
import Link from "next/link"
import { Search, Swords, Timer, ChevronRight, MessageCircle, ArrowUp, ArrowDown, Share } from "lucide-react"
import { toast } from "@/lib/toast"
import { useCastFreeVoteMutation, useDailyVotesQuery } from "@/store/verity/verityQueries"
import { calculateYesPercent, displayHandle } from "@/lib/verity"

function getPhaseTag(status: string) {
  switch (status) {
    case "open_for_votes":
      return {
        label: "Voting",
        color:
          "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20",
      }
    case "qualified":
      return {
        label: "Qualified",
        color:
          "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
      }
    case "funding_pool":
      return {
        label: "Funding",
        color:
          "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20",
      }
    case "tradable":
      return {
        label: "Trading",
        color:
          "bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20",
      }
    case "resolved":
      return {
        label: "Resolved",
        color:
          "bg-zinc-500/10 text-zinc-600 dark:text-zinc-400 border-zinc-500/20",
      }
    default:
      return {
        label: status.replace("_", " "),
        color:
          "bg-stone-500/10 text-stone-600 dark:text-stone-400 border-stone-500/20",
      }
  }
}

interface StandardMarketsFeedProps {
  feedItems: any[]
  feedLoading: boolean
  reloadFeed: () => void
  profile: any
  setActiveTab: (tab: "general" | "pvp-arena") => void
  pvpEvents: any[]
  pvpEventsLoading: boolean
  setSelectedPvpEventId?: (id: string | null) => void
}

export default function StandardMarketsFeed({
  feedItems,
  feedLoading,
  reloadFeed,
  profile,
  setActiveTab,
  pvpEvents,
  pvpEventsLoading,
  setSelectedPvpEventId,
}: StandardMarketsFeedProps) {
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)
  const castFreeVoteMutation = useCastFreeVoteMutation()
  const { data: dailyVotesData } = useDailyVotesQuery(profile?.id || "")
  const dailyVotesRemaining = dailyVotesData?.votesRemaining ?? 10

  // Filtered standard markets
  const filteredMarkets = useMemo(() => {
    if (!feedItems) return []
    return feedItems.filter((item) => {
      if (item.type !== "market" || !item.market) return false

      // Exclude resolved and voided markets
      const isResolved =
        item.market.status === "resolved" ||
        item.market.status === "voided" ||
        (item.market.category?.toLowerCase() === "pvp" &&
          (() => {
            const children =
              item.market.childMarkets || item.market.child_markets || []
            return (
              children.length > 0 &&
              children.every(
                (child: any) =>
                  child.status === "resolved" ||
                  child.status === "voided" ||
                  child.resolvedOutcome,
              )
            )
          })())

      if (isResolved) {
        return false
      }

      const matchesSearch = item.market.question
        .toLowerCase()
        .includes(searchQuery.toLowerCase())
      const matchesCategory =
        !selectedCategory || item.market.category === selectedCategory
      return matchesSearch && matchesCategory
    })
  }, [feedItems, searchQuery, selectedCategory])

  // Handle Free vote casting
  async function handleFreeVote(marketId: string, side: "YES" | "NO") {
    if (!profile) {
      toast.error("Connect your wallet to cast a vote.")
      return
    }
    try {
      await castFreeVoteMutation.mutateAsync({
        marketId,
        userId: profile.id,
        side,
      })
      toast.success(`Casted your ${side} signal!`)
      void reloadFeed()
    } catch (err: any) {
      toast.error(err.message || "Failed to submit signal.")
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Filters & Search */}
      <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
        <div className="flex items-center gap-2 bg-white-surface dark:bg-zinc-900 border border-border dark:border-zinc-800 rounded-[10px] px-3 py-1.5 flex-1 max-w-sm">
          <Search className="h-4 w-4 text-ash" />
          <Input
            type="text"
            placeholder="Search prediction markets..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="bg-transparent text-sm w-full border-0 shadow-none focus-visible:ring-0 focus-visible:ring-offset-0 px-0 h-full text-charcoal-primary dark:text-white placeholder:text-ash"
          />
        </div>

        {/* Category Tags */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 font-mono text-xs">
          <button
            onClick={() => setSelectedCategory(null)}
            className={`px-3 py-1.5 rounded-full border transition-all ${
              selectedCategory === null
                ? "bg-inverse text-inverse-text border-inverse"
                : "bg-white-surface border-border text-graphite hover:border-ash dark:bg-zinc-900 dark:border-zinc-800 dark:text-zinc-400"
            }`}
          >
            All
          </button>
          {[
            "Crypto",
            "Culture",
            "Economics",
            "Politics",
            "Sports",
            "Miscellaneous",
          ].map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-3 py-1.5 rounded-full border transition-all ${
                selectedCategory === cat
                  ? "bg-inverse text-inverse-text border-inverse"
                  : "bg-white-surface border-border text-graphite hover:border-ash dark:bg-zinc-900 dark:border-zinc-800 dark:text-zinc-400"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Markets Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* Standard Prediction Markets */}
        {filteredMarkets.map((item) => {
          const market = item.market!
          const yesPercent = calculateYesPercent(market)
          const noPercent = 100 - yesPercent
          const isTradable = market.status === "tradable"
          const creatorLabel = displayHandle(item.author)

          const isPvp = market.category?.toLowerCase() === "pvp"

          if (isPvp) {
            return (
              <article
                key={market.id}
                onClick={() => {
                  if (setSelectedPvpEventId) {
                    setSelectedPvpEventId(market.id)
                  }
                  setActiveTab("pvp-arena")
                }}
                className="verity-card p-5 border border-indigo-200 dark:border-indigo-950 bg-indigo-50/20 hover:border-indigo-400 dark:hover:border-indigo-800 transition-all cursor-pointer group relative flex flex-col justify-between"
              >
                <div className="absolute top-4 right-4 flex items-center gap-1 bg-indigo-500/10 px-2 py-0.5 rounded-full text-[9px] font-mono font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider shadow-subtle">
                  <Swords className="h-3 w-3" />
                  PvP Matchup
                </div>

                <div>
                  <span className="font-mono text-[10px] font-bold text-ash uppercase tracking-wider">
                    World Cup Arena
                  </span>
                  <h3 className="text-xl font-bold tracking-tight text-charcoal-primary dark:text-white mt-1 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                    {market.question}
                  </h3>
                  <p className="text-xs text-graphite dark:text-zinc-400 mt-2 leading-relaxed">
                    Predict all propositions for the match. Battle head-to-head
                    for Arena XP, boosts, and bragging rights.
                  </p>
                </div>

                <div className="mt-6 flex items-center justify-between border-t border-dashed border-indigo-100 dark:border-indigo-950/60 pt-3">
                  <div className="flex items-center gap-2 font-mono text-[10px] text-ash">
                    <Timer className="h-3.5 w-3.5" />
                    <span>
                      Closes: {new Date(market.deadline).toLocaleDateString()}
                    </span>
                  </div>
                  <span className="flex items-center gap-1 font-mono text-xs font-semibold text-indigo-600 dark:text-indigo-400">
                    Predict Now
                    <ChevronRight className="h-4 w-4 group-hover:translate-x-0.5 transition-transform" />
                  </span>
                </div>
              </article>
            )
          }

          const yesLabel = "YES"
          const noLabel = "NO"

          return (
            <article
              key={market.id}
              className="verity-card p-5 flex flex-col justify-between hover:shadow-md transition-shadow border border-border dark:border-zinc-800"
            >
              <div>
                <div className="flex items-center justify-between gap-3 mb-2 font-mono text-[10px]">
                  <div className="flex items-center gap-1.5">
                    <span className="px-2 py-0.5 rounded-full bg-parchment-card text-charcoal-primary shadow-subtle uppercase tracking-wider font-semibold">
                      {market.category?.toLowerCase() === "pvp" ? "PvP" : market.category}
                    </span>
                  </div>
                  <span className="text-ash uppercase">by {creatorLabel}</span>
                </div>

                <Link href={`/markets/${market.id}`}>
                  <h3 className="text-lg font-bold tracking-tight text-charcoal-primary dark:text-white leading-tight hover:underline cursor-pointer">
                    {market.question}
                  </h3>
                </Link>

                {/* LP State Display */}
                <div className="mt-2 text-[10px] font-mono text-ash flex justify-between items-center bg-stone-100/50 dark:bg-zinc-900/50 p-2 rounded-lg border border-border/40 dark:border-zinc-800/40">
                  <span>
                    LP: ${Number(market.liquidity ?? 0).toLocaleString()} USDC
                  </span>
                  <span>
                    Pool: $
                    {(
                      Number(market.usdc_yes_amount || 0) +
                      Number(market.usdc_no_amount || 0)
                    ).toLocaleString()}{" "}
                    USDC
                  </span>
                </div>
              </div>

              <div className="mt-4 flex flex-col gap-3">
                {/* Signal / Outcome Stats */}
                <div className="flex items-center gap-3">
                  <div className="flex-1">
                    <div className="flex items-center justify-between text-xs font-mono font-bold mb-1">
                      <span className="text-meadow-green">
                        {yesLabel} {yesPercent}%
                      </span>
                      <span className="text-ember-orange">
                        {noLabel} {noPercent}%
                      </span>
                    </div>
                    <div className="h-1.5 w-full bg-stone-surface dark:bg-zinc-800 rounded-full overflow-hidden flex">
                      <div
                        className="bg-meadow-green h-full"
                        style={{ width: `${yesPercent}%` }}
                      />
                      <div
                        className="bg-ember-orange h-full"
                        style={{ width: `${noPercent}%` }}
                      />
                    </div>
                  </div>
                </div>

                {/* Conditional BUY YES/NO vs UPVOTE/DOWNVOTE signals */}
                {isTradable && (
                  <div className="flex items-center gap-2 border-t border-border dark:border-zinc-800/80 pt-3 mt-1">
                    <div className="grid grid-cols-2 gap-2 w-full">
                      <Link
                        href={`/markets/${market.id}?action=BUY&side=YES`}
                        className="w-full"
                      >
                        <button className="w-full bg-meadow-green hover:bg-meadow-green/90 text-white font-bold py-2 rounded-[10px] text-[11px] uppercase tracking-wider shadow-subtle flex items-center justify-center gap-1 transition-colors font-sans">
                          BUY {yesLabel}
                        </button>
                      </Link>
                      <Link
                        href={`/markets/${market.id}?action=BUY&side=NO`}
                        className="w-full"
                      >
                        <button className="w-full bg-ember-orange hover:bg-ember-orange/90 text-white font-bold py-2 rounded-[10px] text-[11px] uppercase tracking-wider shadow-subtle flex items-center justify-center gap-1 transition-colors font-sans">
                          BUY {noLabel}
                        </button>
                      </Link>
                    </div>
                  </div>
                )}

                {/* Bottom Action Bar */}
                <div
                  className="flex max-w-full items-center justify-between border-t border-dashed border-stone-surface dark:border-zinc-800/80 pt-3 mt-1 text-ash"
                  onClick={(e) => e.stopPropagation()}
                >
                  <Link
                    href={`/markets/${market.id}#comments`}
                    className="clickable-icon group flex items-center gap-2 px-1 text-ash hover:text-foreground"
                  >
                    <span className="rounded-full p-2">
                      <MessageCircle className="h-4 w-4" />
                    </span>
                    <span className="text-xs">{item.commentsCount ?? 0}</span>
                  </Link>

                  <button
                    aria-label={`Upvote ${market.question}`}
                    aria-pressed={item.viewerVote === "YES"}
                    className={`clickable-icon group flex items-center gap-2 px-1 hover:text-meadow-green ${
                      item.viewerVote === "YES" ? "text-meadow-green" : "text-ash"
                    }`}
                    disabled={Boolean(item.viewerVote) || dailyVotesRemaining <= 0}
                    onClick={() => handleFreeVote(market.id, "YES")}
                    type="button"
                  >
                    <span className="rounded-full p-2">
                      <ArrowUp className="h-4 w-4" />
                    </span>
                    <span className="text-xs">{market.free_yes_votes ?? 0}</span>
                  </button>

                  <button
                    aria-label={`Downvote ${market.question}`}
                    aria-pressed={item.viewerVote === "NO"}
                    className={`clickable-icon group flex items-center gap-2 px-1 hover:text-ember-orange ${
                      item.viewerVote === "NO" ? "text-ember-orange" : "text-ash"
                    }`}
                    disabled={Boolean(item.viewerVote) || dailyVotesRemaining <= 0}
                    onClick={() => handleFreeVote(market.id, "NO")}
                    type="button"
                  >
                    <span className="rounded-full p-2">
                      <ArrowDown className="h-4 w-4" />
                    </span>
                    <span className="text-xs">{market.free_no_votes ?? 0}</span>
                  </button>

                  <button
                    aria-label={`Share ${market.question}`}
                    className="clickable-icon group flex items-center gap-2 px-1 text-ash hover:text-foreground"
                    onClick={() => {
                      const url = `${window.location.origin}/markets/${market.id}`;
                      navigator.clipboard.writeText(url);
                      toast.success("Market link copied to clipboard!");
                    }}
                    type="button"
                  >
                    <span className="rounded-full p-2">
                      <Share className="h-4 w-4" />
                    </span>
                  </button>
                </div>
              </div>
            </article>
          )
        })}

        {filteredMarkets.length === 0 && feedItems.length > 0 && (
          <div className="col-span-full verity-card p-10 text-center text-sm text-ash">
            No standard markets match your filters.
          </div>
        )}

        {feedLoading && (
          <>
            {Array.from({ length: 6 }).map((_, i) => (
              <article
                key={i}
                className="verity-card p-5 flex flex-col justify-between border border-border dark:border-zinc-800 animate-pulse"
              >
                <div>
                  <div className="flex items-center justify-between gap-3 mb-3">
                    <div className="flex items-center gap-1.5">
                      <div className="h-5 w-16 bg-stone-surface dark:bg-zinc-800 rounded-full" />
                      <div className="h-5 w-16 bg-stone-surface dark:bg-zinc-800 rounded-full" />
                    </div>
                    <div className="h-3.5 w-20 bg-stone-surface dark:bg-zinc-800 rounded" />
                  </div>
                  <div className="space-y-2 mb-4">
                    <div className="h-4.5 w-5/6 bg-stone-surface dark:bg-zinc-800 rounded" />
                    <div className="h-4.5 w-3/4 bg-stone-surface dark:bg-zinc-800 rounded" />
                  </div>

                  {/* LP State Display Skeleton */}
                  <div className="mt-4 h-10 w-full bg-stone-surface/30 dark:bg-zinc-900/30 rounded-lg border border-border/40 dark:border-zinc-800/40" />
                </div>

                <div className="mt-6 flex flex-col gap-4">
                  {/* Signal / Stats Slider Skeleton */}
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <div className="h-3 w-12 bg-stone-surface dark:bg-zinc-800 rounded" />
                      <div className="h-3 w-12 bg-stone-surface dark:bg-zinc-800 rounded" />
                    </div>
                    <div className="h-1.5 w-full bg-stone-surface dark:bg-zinc-800 rounded-full" />
                  </div>

                  {/* Buy Buttons Skeleton */}
                  <div className="grid grid-cols-2 gap-2 mt-2">
                    <div className="h-9 bg-stone-surface dark:bg-zinc-800 rounded-lg" />
                    <div className="h-9 bg-stone-surface dark:bg-zinc-800 rounded-lg" />
                  </div>
                </div>
              </article>
            ))}
          </>
        )}
      </div>
    </div>
  )
}
