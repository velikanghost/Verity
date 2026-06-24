"use client"

import { useQuery } from "@tanstack/react-query"
import { FACTORY_ADDRESS, publicClient } from "@/lib/arc"
import { verityMarketFactoryAbi } from "@/lib/contracts-generated"
import { MarketPost, MarketPosition } from "@/lib/verity"

interface RedeemPanelProps {
  market: MarketPost
  positions: MarketPosition[]
  lpPositions: any[]
  onRedeem: (claimAmount?: number) => Promise<void>
  onClaimCreatorLP: (claimAmount?: number) => Promise<void>
  actionLoading: string | null
  profileId: string | undefined
}

export function RedeemPanel({
  market,
  positions,
  lpPositions,
  onRedeem,
  onClaimCreatorLP,
  actionLoading,
  profileId,
}: RedeemPanelProps) {
  const winningSide = market.resolvedOutcome
  const myPosition = positions.find((p) => p.shares > 0)
  const myLPPosition = lpPositions?.find((pos) => pos.isCreator)
  const hasCreatorLP = myLPPosition && myLPPosition.lpShares > 0

  if (!myPosition && !hasCreatorLP) return null

  const isWinner = myPosition && myPosition.side === winningSide
  const winningShares = isWinner ? myPosition.shares : 0

  return (
    <section className="verity-card p-4 sm:p-5">
      <h2 className="mb-1 text-[19px] font-semibold leading-[1.28] tracking-[-0.25px] text-charcoal-primary">
        Claim Winnings
      </h2>
      <p className="mb-4 text-sm tracking-[-0.18px] text-ash">
        Redeem your winning positions or claim your market creator liquidity
        payouts.
      </p>

      {myPosition && (
        <div className="mb-4 rounded-[12px] bg-parchment-card p-4 shadow-subtle">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <span className="font-mono text-[10px] font-semibold uppercase text-ash">
                Your Positions
              </span>
              <p className="mt-1 font-mono text-sm font-semibold text-charcoal-primary">
                {myPosition.shares.toFixed(2)} {myPosition.side}
              </p>
            </div>
            {isWinner ? (
              <span className="inline-flex items-center rounded-full bg-meadow-green/10 px-2 py-1 text-xs font-medium text-meadow-green shadow-subtle">
                Winning Position
              </span>
            ) : (
              <span className="inline-flex items-center rounded-full bg-cherry-red/10 px-2 py-1 text-xs font-medium text-cherry-red shadow-subtle">
                Losing Position
              </span>
            )}
          </div>
          <button
            className="verity-pill flex h-10 w-full items-center justify-center bg-royal-blue font-mono text-xs font-semibold uppercase tracking-[0.12em] text-white transition-opacity hover:opacity-85 disabled:cursor-not-allowed disabled:opacity-45"
            disabled={!isWinner || Boolean(actionLoading)}
            onClick={() => onRedeem(winningShares)}
            type="button"
          >
            {actionLoading === "redeem"
              ? "Redeeming..."
              : isWinner
                ? "Redeem USDC"
                : "No Winnings to Redeem"}
          </button>
        </div>
      )}

      {hasCreatorLP && (
        <div className="rounded-[12px] bg-parchment-card p-4 shadow-subtle">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <span className="font-mono text-[10px] font-semibold uppercase text-ash">
                Your LP Payout
              </span>
              <p className="mt-1 font-mono text-sm font-semibold text-charcoal-primary">
                {myLPPosition.lpShares.toFixed(2)} USDC
              </p>
            </div>
            <span className="inline-flex items-center rounded-full bg-royal-blue/10 px-2 py-1 text-xs font-medium text-royal-blue shadow-subtle">
              Market Creator LP
            </span>
          </div>
          <button
            className="verity-pill flex h-10 w-full items-center justify-center bg-royal-blue font-mono text-xs font-semibold uppercase tracking-[0.12em] text-white transition-opacity hover:opacity-85 disabled:cursor-not-allowed disabled:opacity-45"
            disabled={Boolean(actionLoading) || !profileId}
            onClick={() => onClaimCreatorLP(myLPPosition.lpShares)}
            type="button"
          >
            {actionLoading === "claim_creator_lp"
              ? "Claiming Creator LP..."
              : "Claim LP Payout"}
          </button>
        </div>
      )}
    </section>
  )
}

interface RefundPanelProps {
  market: MarketPost
  lpPositions: any[]
  onClaimRefund: (claimAmount?: number) => Promise<void>
  actionLoading: string | null
  profileId: string | undefined
  walletAddress?: string
}

export function RefundPanel({
  market,
  lpPositions,
  onClaimRefund,
  actionLoading,
  profileId,
  walletAddress,
}: RefundPanelProps) {
  const { data: onChainPreDeposit } = useQuery({
    queryKey: ["preMarketDeposit", market.id, walletAddress] as const,
    queryFn: async () => {
      if (!walletAddress || !market.id) return BigInt(0)
      const clean = market.id.replace(/^0x/, "")
      const formattedMarketId = `0x${clean.padEnd(64, "0")}` as `0x${string}`
      try {
        const deposit = await publicClient.readContract({
          address: FACTORY_ADDRESS,
          abi: verityMarketFactoryAbi,
          functionName: "preMarketDeposits",
          args: [formattedMarketId, walletAddress as `0x${string}`],
        })
        return BigInt(deposit.toString())
      } catch (error) {
        console.error("Error reading on-chain preMarketDeposits:", error)
        return BigInt(0)
      }
    },
    enabled: Boolean(walletAddress && market.id),
    refetchInterval: 5000,
  })

  const myLPPosition = lpPositions?.find((pos) => pos.userId === profileId)
  const onChainRefundAmount =
    onChainPreDeposit != null ? Number(onChainPreDeposit) / 1e6 : null
  const hasDeposited =
    onChainRefundAmount !== null
      ? onChainRefundAmount > 0
      : Boolean(myLPPosition && myLPPosition.lpShares > 0)

  if (!hasDeposited) return null

  const refundShares =
    onChainRefundAmount !== null
      ? onChainRefundAmount
      : myLPPosition?.lpShares || 0

  return (
    <section className="verity-card p-4 sm:p-5">
      <h2 className="mb-1 text-[19px] font-semibold leading-[1.28] tracking-[-0.25px] text-charcoal-primary">
        Claim Refund
      </h2>
      <p className="mb-4 text-sm tracking-[-0.18px] text-ash">
        This market was voided. You can retrieve your committed pool funding.
      </p>

      <div className="rounded-[12px] bg-parchment-card p-4 shadow-subtle">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <span className="font-mono text-[10px] font-semibold uppercase text-ash">
              Your Pool Funding
            </span>
            <p className="mt-1 font-mono text-sm font-semibold text-charcoal-primary">
              {refundShares.toFixed(2)} USDC
            </p>
          </div>
          <span className="inline-flex items-center rounded-full bg-meadow-green/10 px-2 py-1 text-xs font-medium text-meadow-green shadow-subtle">
            Voided Market Refund
          </span>
        </div>
        <button
          className="verity-pill flex h-10 w-full items-center justify-center bg-meadow-green font-mono text-xs font-semibold uppercase tracking-[0.12em] text-white transition-opacity hover:opacity-85 disabled:cursor-not-allowed disabled:opacity-45"
          disabled={Boolean(actionLoading) || !profileId}
          onClick={() => onClaimRefund(refundShares)}
          type="button"
        >
          {actionLoading === "claim_refund"
            ? "Claiming Refund..."
            : "Claim USDC Refund"}
        </button>
      </div>
    </section>
  )
}
