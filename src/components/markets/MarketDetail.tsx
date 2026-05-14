"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { ArrowDown, ArrowUp, BarChart3, MessageCircle, Repeat2, Share, ShieldCheck } from "lucide-react";
import { useFeed } from "@/hooks/useFeed";
import { useSetRightPanelSlot } from "@/hooks/useRightPanelSlot";
import { useUsdcBalance } from "@/hooks/useUsdcBalance";
import { useUsdcTransfer } from "@/hooks/useUsdcTransfer";
import { useWalletProfile } from "@/hooks/useWalletProfile";
import { calculateGrossUsdc, calculateTradingFee, formatTradingFee } from "@/lib/fees";
import {
  addComment,
  castFreeVote,
  castUsdcVote,
  displayHandle,
  displayName,
  fetchMarketPositions,
  fetchPostComments,
  relativeTime,
  toggleReshare,
  type FeedPost,
  type MarketComment,
  type MarketPosition,
  type MarketPost,
  type VoteSide,
} from "@/lib/verity";

interface MarketDetailProps {
  marketId: string;
}

export default function MarketDetail({ marketId }: MarketDetailProps) {
  const { profile } = useWalletProfile();
  const { transferToTreasury } = useUsdcTransfer();
  const balance = useUsdcBalance();
  const { items, loading, error, reload } = useFeed(profile?.id, true);
  const [actionError, setActionError] = useState<string | null>(null);
  const [comments, setComments] = useState<MarketComment[]>([]);
  const [positions, setPositions] = useState<MarketPosition[]>([]);
  const [commentDraft, setCommentDraft] = useState("");
  const [commentLoading, setCommentLoading] = useState(false);
  const [tradeAmount, setTradeAmount] = useState("1");
  const [selectedSide, setSelectedSide] = useState<VoteSide>("YES");
  const item = items.find((feedItem) => feedItem.market?.id === marketId);

  const market = item?.market || null;
  const postId = item?.id;
  const detailMarketId = market?.id;
  const profileId = profile?.id;
  const isConnected = Boolean(profileId);
  const creatorHandle = item ? displayHandle(item.author) : "";
  const creatorName = item ? displayName(item.author) : "";
  const yesPercent = market ? calculateYesPercent(market) : 50;
  const noPercent = 100 - yesPercent;
  const totalUsdc = market ? Number(market.usdc_yes_amount) + Number(market.usdc_no_amount) : 0;
  const tradeAmountNumber = Number(tradeAmount);
  const validTradeAmount = Number.isFinite(tradeAmountNumber) && tradeAmountNumber > 0;
  const tradeFee = market && validTradeAmount ? calculateTradingFee(tradeAmountNumber, market.trading_fee_bps) : 0;
  const tradeTotal = market && validTradeAmount ? calculateGrossUsdc(tradeAmountNumber, market.trading_fee_bps) : 0;
  const leadingSide: VoteSide = yesPercent >= noPercent ? "YES" : "NO";
  const leadingPercent = Math.max(yesPercent, noPercent);
  const createdAt = useMemo(() => market ? new Date(market.created_at) : null, [market]);
  const closesAt = useMemo(() => market ? new Date(market.deadline) : null, [market]);
  const settlesAt = useMemo(() => closesAt ? new Date(closesAt.getTime() + 24 * 60 * 60 * 1000) : null, [closesAt]);
  const creatorMarkets = useMemo(() => {
    if (!item?.author_id) return 0;
    return items.filter((feedItem) => feedItem.author_id === item.author_id).length;
  }, [item, items]);
  const creatorTotalVolume = useMemo(() => {
    if (!item?.author_id) return 0;
    return items
      .filter((feedItem) => feedItem.author_id === item.author_id)
      .reduce((sum, feedItem) => sum + Number(feedItem.market?.usdc_yes_amount || 0) + Number(feedItem.market?.usdc_no_amount || 0), 0);
  }, [item, items]);

  useEffect(() => {
    if (!postId || !detailMarketId) return;

    let active = true;

    async function loadDetailData() {
      try {
        const [nextComments, nextPositions] = await Promise.all([
          fetchPostComments(postId!),
          profileId ? fetchMarketPositions(detailMarketId!, profileId) : Promise.resolve([]),
        ]);

        if (!active) return;
        setComments(nextComments);
        setPositions(nextPositions);
      } catch (caught) {
        if (active) setActionError(caught instanceof Error ? caught.message : "Unable to load market details.");
      }
    }

    void loadDetailData();

    return () => {
      active = false;
    };
  }, [detailMarketId, postId, profileId]);

  const reloadDetailData = useCallback(async (postId: string, detailMarketId: string) => {
    const [nextComments, nextPositions] = await Promise.all([
      fetchPostComments(postId),
      profileId ? fetchMarketPositions(detailMarketId, profileId) : Promise.resolve([]),
    ]);

    setComments(nextComments);
    setPositions(nextPositions);
  }, [profileId]);

  const runAction = useCallback(async (action: () => Promise<void>) => {
    if (!profileId) {
      setActionError("Connect your wallet before taking that action.");
      return;
    }

    setActionError(null);

    try {
      await action();
      await reload();
      if (item?.id && market?.id) await reloadDetailData(item.id, market.id);
    } catch (caught) {
      setActionError(caught instanceof Error ? caught.message : "Action failed.");
    }
  }, [item, market, profileId, reload, reloadDetailData]);

  async function sharePost(post: FeedPost) {
    const text = post.market?.question || post.content;
    const url = `${window.location.origin}/markets/${marketId}`;

    if (navigator.share) {
      await navigator.share({ title: "Verity", text, url });
      return;
    }

    await navigator.clipboard.writeText(`${text}\n${url}`);
  }

  const backMarketWithUsdc = useCallback(async (side: VoteSide) => {
    if (!market) return;

    await runAction(async () => {
      if (!validTradeAmount) throw new Error("Enter a USDC amount greater than 0.");
      const feeAmount = calculateTradingFee(tradeAmountNumber, market.trading_fee_bps);
      const grossAmount = calculateGrossUsdc(tradeAmountNumber, market.trading_fee_bps);
      const payment = await transferToTreasury(grossAmount);

      await castUsdcVote({
        market,
        profileId: profileId!,
        side,
        amount: tradeAmountNumber,
        feeAmount,
        grossAmount,
        txHash: payment.hash,
      });
    });
  }, [market, profileId, runAction, tradeAmountNumber, transferToTreasury, validTradeAmount]);

  async function submitComment() {
    if (!item || !market || !commentDraft.trim()) return;
    if (!profile) {
      setActionError("Connect your wallet before commenting.");
      return;
    }

    setCommentLoading(true);
    await runAction(() => addComment(item.id, profile!.id, commentDraft));
    setCommentDraft("");
    setCommentLoading(false);
  }

  const sidebarPanels = useMemo(() => {
    if (!market || !postId) return null;

    return (
      <>
        <TradeTicket
          amount={tradeAmount}
          balanceLabel={balance.balance.isLoading ? "..." : balance.formatted}
          disabled={market.status !== "open" || !validTradeAmount}
          fee={tradeFee}
        isConnected={isConnected}
          onAmountChange={setTradeAmount}
          onSideChange={setSelectedSide}
          onTrade={() => backMarketWithUsdc(selectedSide)}
          selectedSide={selectedSide}
          total={tradeTotal}
          yesPrice={yesPercent}
          noPrice={noPercent}
        />

        <MarketStatsPanel
          createdAt={createdAt}
          feeBps={market.trading_fee_bps}
          liquidity={totalUsdc}
          closesAt={closesAt}
          settlesAt={settlesAt}
          volume={totalUsdc}
        />

        <CreatorPanel
          creator={creatorHandle}
          creatorName={creatorName}
          marketsCreated={creatorMarkets}
          totalVolume={creatorTotalVolume}
        />
      </>
    );
  }, [
    backMarketWithUsdc,
    balance.balance.isLoading,
    balance.formatted,
    closesAt,
    createdAt,
    creatorMarkets,
    creatorTotalVolume,
    creatorHandle,
    market,
    noPercent,
    postId,
    creatorName,
    isConnected,
    selectedSide,
    settlesAt,
    totalUsdc,
    tradeAmount,
    tradeFee,
    tradeTotal,
    validTradeAmount,
    yesPercent,
  ]);
  const rightPanelSlot = useMemo(
    () => sidebarPanels ? <div className="flex flex-col gap-3">{sidebarPanels}</div> : null,
    [sidebarPanels],
  );
  const rightPanelSlotKey = [
    postId || "no-post",
    detailMarketId || "no-market",
    profileId || "disconnected",
    tradeAmount,
    selectedSide,
    balance.balance.isLoading ? "loading" : balance.formatted,
    market?.status || "unknown",
    market?.trading_fee_bps || 0,
    totalUsdc,
    yesPercent,
    noPercent,
    creatorMarkets,
    creatorTotalVolume,
  ].join("|");

  // Inject Trade Ticket, Market Stats, Creator Stats into the global RightPanel
  useSetRightPanelSlot(rightPanelSlot, rightPanelSlotKey);

  if (loading) {
    return (
      <div className="rounded-[18px] border border-[var(--border)] bg-[var(--surface)] p-8 text-center text-sm font-medium text-[var(--muted)] shadow-sm">
        Loading market...
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-[18px] border border-downvote/30 bg-downvote/10 p-4 text-sm font-medium text-[var(--foreground)]">
        {error}
      </div>
    );
  }

  if (!item || !market) {
    return (
      <div className="rounded-[18px] border border-[var(--border)] bg-[var(--surface)] p-8 text-center text-sm font-medium text-[var(--muted)] shadow-sm">
        Market not found.{" "}
        <Link className="font-bold text-[var(--foreground)] underline" href="/markets">
          View markets
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <MarketHero
        category={market.category}
        creator={displayHandle(item.author)}
        leadingPercent={leadingPercent}
        leadingSide={leadingSide}
        market={market}
        question={market.question}
        time={relativeTime(item.created_at)}
        totalVotes={market.free_yes_votes + market.free_no_votes}
      />

      {actionError && (
        <div className="rounded-[10px] border border-downvote/30 bg-downvote/10 p-3 text-sm font-medium text-[var(--foreground)]">
          {actionError}
        </div>
      )}

      {/* Mobile fallback: show sidebar panels inline (hidden on lg+ where RightPanel is visible) */}
      <div className="flex flex-col gap-3 lg:hidden">
        {sidebarPanels}
      </div>

      <SentimentPanel noPercent={noPercent} totalUsdc={totalUsdc} yesPercent={yesPercent} />

      <RulesPanel
        noCondition={market.no_condition}
        postContent={item.content}
        resolutionSource={market.resolution_source}
        yesCondition={market.yes_condition}
      />

      <PositionPanel positions={positions} />

      <ActivityPanel market={market} />

      <CommentsPanel
        commentDraft={commentDraft}
        comments={comments}
        loading={commentLoading}
        onChange={setCommentDraft}
        onSubmit={submitComment}
      />

      <SocialActions
        comments={item.commentsCount}
        freeNoVotes={market.free_no_votes}
        freeYesVotes={market.free_yes_votes}
        onComment={() => document.getElementById("market-comment-input")?.focus()}
        onReshare={() => runAction(() => toggleReshare(item.id, profile!.id, item.viewerReshared))}
        onShare={() => sharePost(item)}
        onVote={(side) => runAction(() => castFreeVote(market, profile!.id, side))}
        reshares={item.resharesCount}
        reshared={item.viewerReshared}
        viewerVote={item.viewerVote}
      />
    </div>
  );
}

function MarketHero({
  category,
  creator,
  leadingPercent,
  leadingSide,
  market,
  question,
  time,
  totalVotes,
}: {
  category: string;
  creator: string;
  leadingPercent: number;
  leadingSide: VoteSide;
  market: MarketPost;
  question: string;
  time: string;
  totalVotes: number;
}) {
  return (
    <section className="rounded-[12px] border border-[var(--border)] bg-[var(--surface)] p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-xl font-black leading-tight text-[var(--foreground)] sm:text-2xl">{question}</h1>
          <div className="mt-3 flex flex-wrap items-center gap-2 font-mono text-xs text-[var(--muted)]">
            <span className="rounded-[4px] border border-[var(--border)] px-2 py-0.5">{category}</span>
            <span>by {creator}</span>
            <span>{"\u00B7"}</span>
            <span>{time}</span>
          </div>
        </div>
        <span className={`font-mono text-sm font-bold ${market.status === "open" ? "text-brand-secondary" : "text-[var(--muted)]"}`}>
          {market.status === "open" ? "Active Market" : "Closed Market"}
        </span>
      </div>

      <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 border-t border-dashed border-[var(--border)] pt-3 font-mono text-xs text-[var(--muted)]">
        <span>
          Leading outcome:{" "}
          <strong className={leadingSide === "YES" ? "text-brand-secondary" : "text-downvote"}>
            {leadingSide} {leadingPercent.toFixed(1)}%
          </strong>
        </span>
        <span>{totalVotes} free votes</span>
      </div>
    </section>
  );
}

function TradeTicket({
  amount,
  balanceLabel,
  disabled,
  fee,
  isConnected,
  noPrice,
  onAmountChange,
  onSideChange,
  onTrade,
  selectedSide,
  total,
  yesPrice,
}: {
  amount: string;
  balanceLabel: string;
  disabled: boolean;
  fee: number;
  isConnected: boolean;
  noPrice: number;
  onAmountChange: (value: string) => void;
  onSideChange: (side: VoteSide) => void;
  onTrade: () => void;
  selectedSide: VoteSide;
  total: number;
  yesPrice: number;
}) {
  return (
    <section className="rounded-[12px] border border-[var(--border)] bg-[var(--surface)] p-4 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="font-black text-[var(--foreground)]">Place a Trade</h2>
        <span className="font-mono text-[11px] text-[var(--muted)]">Arc USDC</span>
      </div>

      <div className="mb-3 grid grid-cols-2 gap-2">
        <OutcomeButton active={selectedSide === "YES"} label="Yes" price={yesPrice} side="YES" onClick={onSideChange} />
        <OutcomeButton active={selectedSide === "NO"} label="No" price={noPrice} side="NO" onClick={onSideChange} />
      </div>

      <label className="mb-2 block font-mono text-[11px] font-bold uppercase text-[var(--muted)]" htmlFor="market-trade-amount">
        Amount
      </label>
      <input
        className="h-11 w-full rounded-[8px] border border-[var(--border)] bg-[var(--surface-solid)] px-3 font-mono text-sm text-[var(--foreground)] outline-none"
        id="market-trade-amount"
        min="0"
        onChange={(event) => onAmountChange(event.target.value)}
        step="0.01"
        type="number"
        value={amount}
      />

      <div className="mt-3 grid gap-1 font-mono text-[11px] text-[var(--muted)]">
        <div className="flex justify-between">
          <span>Current balance</span>
          <span>{balanceLabel} USDC</span>
        </div>
        <div className="flex justify-between">
          <span>Trading fee</span>
          <span>{fee.toFixed(4)} USDC</span>
        </div>
        <div className="flex justify-between text-[var(--foreground)]">
          <span>Total</span>
          <span>{total.toFixed(4)} USDC</span>
        </div>
      </div>

      <button
        className="mt-4 flex h-11 w-full items-center justify-center rounded-[8px] bg-[var(--inverse)] font-mono text-xs font-black uppercase tracking-[0.14em] text-[var(--inverse-text)] transition-opacity hover:opacity-85 disabled:cursor-not-allowed disabled:opacity-45"
        disabled={disabled || !isConnected}
        onClick={onTrade}
        type="button"
      >
        {isConnected ? `Back ${selectedSide}` : "Connect Wallet"}
      </button>
    </section>
  );
}

function OutcomeButton({
  active,
  label,
  onClick,
  price,
  side,
}: {
  active: boolean;
  label: string;
  onClick: (side: VoteSide) => void;
  price: number;
  side: VoteSide;
}) {
  return (
    <button
      aria-pressed={active}
      className={`rounded-[8px] border px-3 py-3 text-left transition-colors ${
        active
          ? side === "YES"
            ? "border-brand-secondary bg-brand-secondary/15"
            : "border-downvote bg-downvote/15"
          : "border-[var(--border)] bg-[var(--surface-muted)] hover:border-[var(--border-strong)]"
      }`}
      onClick={() => onClick(side)}
      type="button"
    >
      <span className="block text-sm font-black text-[var(--foreground)]">{label}</span>
      <span className="font-mono text-[11px] text-[var(--muted)]">{price.toFixed(1)}c implied</span>
    </button>
  );
}

function SentimentPanel({ noPercent, totalUsdc, yesPercent }: { noPercent: number; totalUsdc: number; yesPercent: number }) {
  return (
    <section className="rounded-[12px] border border-[var(--border)] bg-[var(--surface)] p-5 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="font-black text-[var(--foreground)]">Market Sentiment</h2>
          <p className="mt-1 font-mono text-[11px] text-[var(--muted)]">USDC-backed opinions only</p>
        </div>
        <BarChart3 className="h-4 w-4 text-[var(--muted)]" />
      </div>

      <div className="rounded-[8px] bg-[var(--surface-muted)] p-4">
        {totalUsdc <= 0 && (
          <p className="mb-4 rounded-[7px] border border-dashed border-[var(--border)] bg-[var(--surface-solid)] p-3 text-sm text-[var(--muted)]">
            No USDC-backed opinions yet.
          </p>
        )}
        <div className="mb-4 grid grid-cols-2 gap-2">
          <div className="rounded-[7px] border border-brand-secondary/25 bg-brand-secondary/10 p-3">
            <span className="font-mono text-[10px] font-black uppercase tracking-[0.14em] text-brand-secondary">Yes</span>
            <p className="mt-1 font-mono text-lg font-black text-[var(--foreground)]">{yesPercent.toFixed(1)}%</p>
          </div>
          <div className="rounded-[7px] border border-downvote/25 bg-downvote/10 p-3">
            <span className="font-mono text-[10px] font-black uppercase tracking-[0.14em] text-downvote">No</span>
            <p className="mt-1 font-mono text-lg font-black text-[var(--foreground)]">{noPercent.toFixed(1)}%</p>
          </div>
        </div>

        <div className="grid gap-3 font-mono text-xs">
          <SentimentRow label="Yes" percent={yesPercent} tone="yes" />
          <SentimentRow label="No" percent={noPercent} tone="no" />
        </div>
      </div>

      <div className="mt-4 rounded-[8px] border border-dashed border-[var(--border)] bg-[var(--surface-muted)] p-4 text-sm text-[var(--muted)]">
        Historical sentiment charting will populate after market activity snapshots are enabled.
      </div>
    </section>
  );
}

function SentimentRow({ label, percent, tone }: { label: string; percent: number; tone: "yes" | "no" }) {
  return (
    <div className="grid grid-cols-[34px_minmax(0,1fr)_52px] items-center gap-3">
      <span className="text-[var(--foreground)]">{label}</span>
      <span className="h-2 overflow-hidden rounded-full bg-[var(--surface-solid)] ring-1 ring-[var(--border)]">
        <span className={`block h-full ${tone === "yes" ? "bg-brand-secondary" : "bg-downvote"}`} style={{ width: `${percent}%` }} />
      </span>
      <span className="text-right">{percent.toFixed(1)}%</span>
    </div>
  );
}

function RulesPanel({
  noCondition,
  postContent,
  resolutionSource,
  yesCondition,
}: {
  noCondition: string;
  postContent: string;
  resolutionSource: string;
  yesCondition: string;
}) {
  return (
    <section className="rounded-[12px] border border-[var(--border)] bg-[var(--surface)] p-5 shadow-sm">
      <h2 className="mb-4 font-black text-[var(--foreground)]">Rules</h2>
      <div className="grid gap-3 text-sm leading-relaxed text-[var(--foreground)]">
        <p>{postContent}</p>
        <div className="rounded-[8px] border border-brand-secondary/30 bg-brand-secondary/10 p-3">
          <span className="font-mono text-xs font-bold text-brand-secondary">YES</span>
          <p className="mt-1">{yesCondition}</p>
        </div>
        <div className="rounded-[8px] border border-downvote/30 bg-downvote/10 p-3">
          <span className="font-mono text-xs font-bold text-downvote">NO</span>
          <p className="mt-1">{noCondition}</p>
        </div>
        <p className="font-mono text-xs text-[var(--muted)]">Resolution source: {resolutionSource}</p>
      </div>
    </section>
  );
}

function PositionPanel({ positions }: { positions: MarketPosition[] }) {
  const freePosition = positions.find((position) => position.vote_type === "free");
  const usdcPosition = positions.find((position) => position.vote_type === "usdc");

  return (
    <section className="rounded-[12px] border border-[var(--border)] bg-[var(--surface)] p-5 shadow-sm">
      <h2 className="mb-4 font-black text-[var(--foreground)]">My Position</h2>
      {positions.length === 0 ? (
        <p className="text-sm font-medium text-[var(--muted)]">No position is open on this market.</p>
      ) : (
        <div className="grid gap-2 font-mono text-xs text-[var(--muted)]">
          {freePosition && (
            <div className="flex justify-between rounded-[8px] bg-[var(--surface-muted)] p-3">
              <span>Free opinion</span>
              <span className={freePosition.side === "YES" ? "text-brand-secondary" : "text-downvote"}>{freePosition.side}</span>
            </div>
          )}
          {usdcPosition && (
            <div className="flex justify-between rounded-[8px] bg-[var(--surface-muted)] p-3">
              <span>USDC backed</span>
              <span className={usdcPosition.side === "YES" ? "text-brand-secondary" : "text-downvote"}>
                {usdcPosition.side} {usdcPosition.amount.toLocaleString()} USDC
              </span>
            </div>
          )}
        </div>
      )}
    </section>
  );
}

function ActivityPanel({ market }: { market: MarketPost }) {
  const lastUpdated = relativeTime(market.created_at);

  return (
    <section className="rounded-[12px] border border-[var(--border)] bg-[var(--surface)] p-5 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="font-black text-[var(--foreground)]">Activity</h2>
        <span className="font-mono text-[11px] text-[var(--muted)]">Since {lastUpdated}</span>
      </div>
      <div className="rounded-[8px] border border-dashed border-[var(--border)] bg-[var(--surface-muted)] p-4 text-sm text-[var(--muted)]">
        Live trade history and order book depth will appear here after Phase 3 market events are added.
      </div>
    </section>
  );
}

function CommentsPanel({
  commentDraft,
  comments,
  loading,
  onChange,
  onSubmit,
}: {
  commentDraft: string;
  comments: MarketComment[];
  loading: boolean;
  onChange: (value: string) => void;
  onSubmit: () => void;
}) {
  return (
    <section className="rounded-[12px] border border-[var(--border)] bg-[var(--surface)] p-5 shadow-sm">
      <div className="mb-4 flex items-center gap-2">
        <MessageCircle className="h-4 w-4 text-[var(--muted)]" />
        <h2 className="font-black text-[var(--foreground)]">Comments ({comments.length})</h2>
      </div>

      <div className="mb-4 flex gap-2">
        <input
          className="h-11 min-w-0 flex-1 rounded-[8px] border border-[var(--border)] bg-[var(--surface-solid)] px-3 text-sm text-[var(--foreground)] outline-none"
          id="market-comment-input"
          onChange={(event) => onChange(event.target.value)}
          placeholder="Add a comment..."
          value={commentDraft}
        />
        <button
          className="h-11 rounded-[8px] bg-[var(--inverse)] px-4 font-mono text-xs font-black uppercase tracking-[0.14em] text-[var(--inverse-text)] disabled:cursor-not-allowed disabled:opacity-45"
          disabled={loading || !commentDraft.trim()}
          onClick={onSubmit}
          type="button"
        >
          Post
        </button>
      </div>

      <div className="grid gap-3">
        {comments.length === 0 ? (
          <p className="text-sm text-[var(--muted)]">No comments yet.</p>
        ) : (
          comments.map((comment) => (
            <article className="rounded-[8px] bg-[var(--surface-muted)] p-3" key={comment.id}>
              <div className="mb-1 flex flex-wrap items-center gap-2 font-mono text-[11px] text-[var(--muted)]">
                <span className="font-bold text-[var(--foreground)]">{displayName(comment.author)}</span>
                <span>{displayHandle(comment.author)}</span>
                <span>{"\u00B7"}</span>
                <span>{relativeTime(comment.created_at)}</span>
              </div>
              <p className="text-sm leading-relaxed text-[var(--foreground)]">{comment.content}</p>
            </article>
          ))
        )}
      </div>
    </section>
  );
}

function MarketStatsPanel({
  closesAt,
  createdAt,
  feeBps,
  liquidity,
  settlesAt,
  volume,
}: {
  closesAt: Date | null;
  createdAt: Date | null;
  feeBps?: number;
  liquidity: number;
  settlesAt: Date | null;
  volume: number;
}) {
  return (
    <section className="rounded-[12px] border border-[var(--border)] bg-[var(--surface)] p-4 shadow-sm">
      <h2 className="mb-4 font-black text-[var(--foreground)]">Market Stats</h2>
      <StatRow label="Trading fee" value={formatTradingFee(feeBps)} />
      <StatRow label="Liquidity" value={`${liquidity.toLocaleString(undefined, { maximumFractionDigits: 2 })} USDC`} />
      <StatRow label="Volume" value={`${volume.toLocaleString(undefined, { maximumFractionDigits: 2 })} USDC`} />
      <StatRow label="Created" value={createdAt ? createdAt.toLocaleString() : "Unknown"} />
      <StatRow label="Closes" value={closesAt ? closesAt.toLocaleString() : "Unknown"} />
      <StatRow label="Settles by" value={settlesAt ? settlesAt.toLocaleString() : "TBD"} />
    </section>
  );
}

function CreatorPanel({
  creator,
  creatorName,
  marketsCreated,
  totalVolume,
}: {
  creator: string;
  creatorName: string;
  marketsCreated: number;
  totalVolume: number;
}) {
  return (
    <section className="rounded-[12px] border border-[var(--border)] bg-[var(--surface)] p-4 shadow-sm">
      <div className="mb-4 flex items-center gap-2">
        <ShieldCheck className="h-4 w-4 text-brand-secondary" />
        <h2 className="font-black text-[var(--foreground)]">Creator Stats</h2>
      </div>
      <StatRow label="Creator" value={creatorName} />
      <StatRow label="Handle" value={creator} />
      <StatRow label="Markets created" value={marketsCreated.toLocaleString()} />
      <StatRow label="Visible volume" value={`${totalVolume.toLocaleString(undefined, { maximumFractionDigits: 2 })} USDC`} />
      <p className="mt-3 font-mono text-[11px] text-brand-secondary">Wallet-created market</p>
    </section>
  );
}

function SocialActions({
  comments,
  freeNoVotes,
  freeYesVotes,
  onComment,
  onReshare,
  onShare,
  onVote,
  reshares,
  reshared,
  viewerVote,
}: {
  comments: number;
  freeNoVotes: number;
  freeYesVotes: number;
  onComment: () => void;
  onReshare: () => void;
  onShare: () => void;
  onVote: (side: VoteSide) => void;
  reshares: number;
  reshared: boolean;
  viewerVote: VoteSide | null;
}) {
  return (
    <section className="rounded-[12px] border border-[var(--border)] bg-[var(--surface)] p-4 shadow-sm">
      <div className="flex items-center justify-between text-[var(--muted)]">
        <IconAction icon={<MessageCircle className="h-4 w-4" />} label={comments} onClick={onComment} />
        <IconAction active={reshared} icon={<Repeat2 className="h-4 w-4" />} label={reshares} onClick={onReshare} />
        <IconAction active={viewerVote === "YES"} icon={<ArrowUp className="h-4 w-4" />} label={freeYesVotes} onClick={() => onVote("YES")} />
        <IconAction active={viewerVote === "NO"} icon={<ArrowDown className="h-4 w-4" />} label={freeNoVotes} onClick={() => onVote("NO")} tone="no" />
        <IconAction icon={<Share className="h-4 w-4" />} onClick={onShare} />
      </div>
    </section>
  );
}

function IconAction({
  active = false,
  icon,
  label,
  onClick,
  tone = "yes",
}: {
  active?: boolean;
  icon: ReactNode;
  label?: number;
  onClick: () => void;
  tone?: "yes" | "no";
}) {
  return (
    <button
      className={`flex items-center gap-2 transition-colors hover:text-[var(--foreground)] ${
        active ? (tone === "yes" ? "text-brand-secondary" : "text-downvote") : ""
      }`}
      onClick={onClick}
      type="button"
    >
      <span className="rounded-full p-2 transition-colors hover:bg-[var(--surface-hover)]">{icon}</span>
      {typeof label === "number" && <span className="text-xs">{label}</span>}
    </button>
  );
}

function StatRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3 border-t border-dashed border-[var(--border)] py-2 text-sm">
      <span className="text-[var(--muted)]">{label}</span>
      <span className="text-right font-mono text-xs font-bold text-[var(--foreground)]">{value}</span>
    </div>
  );
}

function calculateYesPercent(market: MarketPost) {
  const yes = Number(market.usdc_yes_amount);
  const no = Number(market.usdc_no_amount);
  const totalUsdc = yes + no;
  if (totalUsdc > 0) return (yes / totalUsdc) * 100;

  return 50;
}
