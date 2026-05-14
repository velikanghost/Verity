"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { SlidersHorizontal } from "lucide-react";
import MarketCard from "@/components/post/MarketCard";
import { useFeed } from "@/hooks/useFeed";
import { useUsdcTransfer } from "@/hooks/useUsdcTransfer";
import { useWalletProfile } from "@/hooks/useWalletProfile";
import { calculateGrossUsdc, calculateTradingFee } from "@/lib/fees";
import {
  addComment,
  castFreeVote,
  castUsdcVote,
  displayHandle,
  displayName,
  relativeTime,
  toggleReshare,
  type FeedPost,
  type MarketPost,
  type VoteSide,
} from "@/lib/verity";

export default function MarketBoard() {
  const router = useRouter();
  const { profile } = useWalletProfile();
  const { transferToTreasury } = useUsdcTransfer();
  const { items, loading, error, reload } = useFeed(profile?.id, true);
  const [actionError, setActionError] = useState<string | null>(null);

  async function runAction(action: () => Promise<void>) {
    if (!profile) {
      setActionError("Connect your wallet before voting.");
      return;
    }

    setActionError(null);

    try {
      await action();
      await reload();
    } catch (caught) {
      setActionError(caught instanceof Error ? caught.message : "Action failed.");
    }
  }

  async function commentOn(post: FeedPost) {
    const content = window.prompt("Add a comment");
    if (!content || !profile) return;
    await runAction(() => addComment(post.id, profile.id, content));
  }

  async function sharePost(post: FeedPost) {
    const text = post.market?.question || post.content;
    const url = post.market ? `${window.location.origin}/markets/${post.market.id}` : window.location.origin;
    if (navigator.share) {
      await navigator.share({ title: "Verity", text, url });
      return;
    }
    await navigator.clipboard.writeText(`${text}\n${url}`);
  }

  async function backMarketWithUsdc(market: MarketPost, side: VoteSide, amount: number) {
    await runAction(async () => {
      const feeAmount = calculateTradingFee(amount, market.trading_fee_bps);
      const grossAmount = calculateGrossUsdc(amount, market.trading_fee_bps);
      const payment = await transferToTreasury(grossAmount);

      await castUsdcVote({
        market,
        profileId: profile!.id,
        side,
        amount,
        feeAmount,
        grossAmount,
        txHash: payment.hash,
      });
    });
  }

  return (
    <>
      <section className="flex flex-wrap items-center gap-2 rounded-[18px] border border-[var(--border)] bg-[var(--surface)] p-4 shadow-sm">
        <button className="rounded-[8px] bg-[var(--inverse)] px-4 py-2 font-mono text-xs font-black uppercase tracking-[0.14em] text-[var(--inverse-text)]">
          Active
        </button>
        {["Most Liquidity", "Closing Soon", "Newest"].map((filter) => (
          <button
            className="rounded-[8px] border border-[var(--border)] px-4 py-2 text-sm font-medium text-[var(--foreground)]"
            key={filter}
          >
            {filter}
          </button>
        ))}
        <SlidersHorizontal className="ml-auto h-5 w-5 text-[var(--muted)]" />
      </section>

      {(error || actionError) && (
        <section className="rounded-[18px] border border-downvote/30 bg-downvote/10 p-4 text-sm text-[var(--foreground)]">
          {actionError || error}
        </section>
      )}

      <section className="flex flex-col gap-3">
        {loading ? (
          <div className="rounded-[18px] border border-[var(--border)] bg-[var(--surface)] p-8 text-center text-sm font-medium text-[var(--muted)] shadow-sm">
            Loading markets...
          </div>
        ) : (
          items.map((item) =>
            item.market ? (
              <MarketCard
                category={item.market.category}
                comments={item.commentsCount}
                deadline={new Date(item.market.deadline).toLocaleString()}
                freeNoVotes={item.market.free_no_votes}
                freeYesVotes={item.market.free_yes_votes}
                handle={displayHandle(item.author)}
                key={item.id}
                marketCreationFeeUsdc={item.market.market_creation_fee_usdc}
                name={displayName(item.author)}
                noCondition={item.market.no_condition}
                onComment={() => commentOn(item)}
                onOpenDetails={() => router.push(`/markets/${item.market!.id}`)}
                onReshare={() => runAction(() => toggleReshare(item.id, profile!.id, item.viewerReshared))}
                onShare={() => sharePost(item)}
                onUsdcVote={(side, amount) => backMarketWithUsdc(item.market as MarketPost, side, amount)}
                onVote={(side) => runAction(() => castFreeVote(item.market as MarketPost, profile!.id, side as VoteSide))}
                postContent={item.content}
                question={item.market.question}
                resolutionSource={item.market.resolution_source}
                reshares={item.resharesCount}
                reshared={item.viewerReshared}
                status={item.market.status}
                time={relativeTime(item.created_at)}
                tradingFeeBps={item.market.trading_fee_bps}
                usdcNo={Number(item.market.usdc_no_amount)}
                usdcYes={Number(item.market.usdc_yes_amount)}
                viewerVote={item.viewerVote}
                yesCondition={item.market.yes_condition}
                yesPercent={calculateYesPercent(item.market)}
              />
            ) : null,
          )
        )}
      </section>
    </>
  );
}

function calculateYesPercent(market: MarketPost) {
  const yes = Number(market.usdc_yes_amount);
  const no = Number(market.usdc_no_amount);
  const totalUsdc = yes + no;
  if (totalUsdc > 0) return (yes / totalUsdc) * 100;

  return 50;
}
