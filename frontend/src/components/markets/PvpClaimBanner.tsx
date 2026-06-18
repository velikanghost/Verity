import { Trophy } from "lucide-react"
import { useMemo } from "react"

interface PvpClaimBannerProps {
  picks: any[] | undefined
  claimedMarketIds: Set<string>
  onClaim: (marketIds: string[], totalWinnings: number) => Promise<void>
  className?: string
  showEmoji?: boolean
  showEmptyState?: boolean
}

export default function PvpClaimBanner({
  picks,
  claimedMarketIds,
  onClaim,
  className = "",
  showEmoji = false,
  showEmptyState = false,
}: PvpClaimBannerProps) {
  const claimablePicks = useMemo(
    () =>
      picks?.filter(
        (p: any) =>
          p.isCorrect === true &&
          (p.shares ?? 0) > 0 &&
          !claimedMarketIds.has(p.marketId),
      ) || [],
    [picks, claimedMarketIds],
  )

  const totalWinnings = useMemo(
    () =>
      claimablePicks.reduce((acc: number, p: any) => acc + (p.shares ?? 0), 0),
    [claimablePicks],
  )

  const handleClaimAll = async () => {
    const marketIds = claimablePicks.map((p: any) => p.marketId)
    await onClaim(marketIds, totalWinnings)
  }

  if (claimablePicks.length === 0) {
    if (showEmptyState) {
      return (
        <div className="p-8 text-center text-sm text-ash border border-dashed border-border dark:border-zinc-800 rounded-[12px] bg-parchment-card dark:bg-zinc-950/20">
          No active PvP events right now. Check back soon for new matchups!
        </div>
      )
    }
    return null
  }

  return (
    <div
      className={`p-4 rounded-xl bg-meadow-green/10 border border-meadow-green/20 flex flex-col md:flex-row items-center justify-between gap-3 text-left ${className}`}
    >
      <div className="flex items-center gap-3">
        <span className="text-4xl">🏆</span>
        <div>
          <h4 className="text-sm font-bold text-meadow-green font-sans">
            You have unclaimed winnings!
          </h4>
          <p className="text-xs text-ash mt-0.5 font-medium font-sans">
            Claim {totalWinnings.toFixed(2)} USDC.
          </p>
        </div>
      </div>
      <button
        onClick={handleClaimAll}
        className="px-4 py-2 rounded-[8px] bg-meadow-green hover:bg-meadow-green/90 text-white text-sm font-bold transition-all shadow-sm shrink-0 font-sans cursor-pointer"
      >
        Claim
      </button>
    </div>
  )
}
