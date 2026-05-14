"use client";

import { ArrowDown, ArrowUp, MessageCircle, Repeat2, Share } from "lucide-react";
import type { VoteSide } from "@/lib/verity";

export interface MarketCardProps {
  name: string;
  handle: string;
  time: string;
  postContent?: string;
  question: string;
  category: string;
  deadline: string;
  resolutionSource?: string;
  yesCondition?: string;
  noCondition?: string;
  status?: string;
  yesPercent: number;
  usdcYes: number;
  usdcNo: number;
  freeYesVotes?: number;
  freeNoVotes?: number;
  comments: number;
  reshares: number;
  viewerVote?: VoteSide | null;
  reshared?: boolean;
  onVote?: (side: VoteSide) => void;
  onComment?: () => void;
  onReshare?: () => void;
  onShare?: () => void;
  avatarColor?: string;
}

export default function MarketCard({
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
  yesPercent,
  usdcYes,
  usdcNo,
  freeYesVotes = 0,
  freeNoVotes = 0,
  comments,
  reshares,
  viewerVote,
  reshared = false,
  onVote,
  onComment,
  onReshare,
  onShare,
}: MarketCardProps) {
  const noPercent = 100 - yesPercent;
  const totalUsdc = usdcYes + usdcNo;
  const isClosed = status !== "open";

  return (
    <article className="cursor-pointer rounded-[18px] border border-[var(--border)] bg-[var(--surface)] p-5 shadow-sm transition-colors hover:bg-[var(--surface-solid)]">
      <div className="mb-4 flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h3 className="text-xl font-black leading-snug text-[var(--foreground)]">{question}</h3>
          <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-[var(--muted)]">
            <span>by</span>
            <span className="font-bold text-[var(--foreground)]">{name}</span>
            <span className="font-mono text-[var(--muted)]">{handle}</span>
            <span className="font-mono text-[var(--muted)]">{"\u00B7"}</span>
            <span className="font-mono">{time}</span>
          </div>
        </div>

        <span className={`shrink-0 pt-1 text-sm font-black ${isClosed ? "text-[var(--muted)]" : "text-brand-secondary"}`}>
          {isClosed ? "Closed" : "Active"}
        </span>
      </div>

      {postContent && postContent !== question && (
        <p className="mb-4 whitespace-pre-wrap text-[15px] leading-relaxed text-[var(--foreground)]">
          {postContent}
        </p>
      )}

      <div className="mb-5 flex flex-wrap gap-2">
        <span className="rounded-[5px] border border-[var(--border)] px-3 py-1 font-mono text-xs text-[var(--muted)]">
          {category}
        </span>
        <span className="rounded-[5px] border border-brand-secondary/30 bg-brand-secondary/10 px-3 py-1 font-mono text-xs text-brand-primary">
          Verifiable
        </span>
      </div>

      <div className="mb-5 rounded-[9px] bg-[var(--surface-muted)] p-4">
        <div className="mb-3 font-mono text-xs font-black uppercase tracking-[0.16em] text-[var(--foreground)]">
          Sentiment
        </div>
        <div className="flex h-2.5 overflow-hidden rounded-full bg-zinc-200">
          <div className="h-full bg-upvote transition-all" style={{ width: `${yesPercent}%` }} />
          <div className="h-full bg-downvote transition-all" style={{ width: `${noPercent}%` }} />
        </div>
        <div className="mt-3 flex justify-between font-mono text-[11px] text-[var(--muted)]">
          <span>{yesPercent.toFixed(1)}% Yes</span>
          <span>{noPercent.toFixed(1)}% No</span>
        </div>
      </div>

      <div className="mb-5 grid grid-cols-2 gap-3">
        <button
          className={`flex items-center justify-center gap-2 rounded-[7px] border border-brand-secondary px-4 py-3 font-black text-[var(--foreground)] transition-colors hover:bg-brand-secondary/10 disabled:cursor-not-allowed disabled:opacity-60 ${
            viewerVote === "YES" ? "bg-brand-secondary/15" : ""
          }`}
          disabled={isClosed}
          onClick={() => onVote?.("YES")}
          type="button"
        >
          Yes <ArrowUp className="h-4 w-4" />
        </button>
        <button
          className={`flex items-center justify-center gap-2 rounded-[7px] border border-downvote px-4 py-3 font-black text-[var(--foreground)] transition-colors hover:bg-downvote/10 disabled:cursor-not-allowed disabled:opacity-60 ${
            viewerVote === "NO" ? "bg-downvote/15" : ""
          }`}
          disabled={isClosed}
          onClick={() => onVote?.("NO")}
          type="button"
        >
          No <ArrowDown className="h-4 w-4" />
        </button>
      </div>

      <div className="mb-3 flex items-center justify-between font-mono text-xs text-[var(--muted)]">
        <span>{freeYesVotes + freeNoVotes} free votes</span>
        <span>Liquidity {totalUsdc.toLocaleString()} USDC</span>
      </div>

      <div className="mb-3 grid gap-2 rounded-[9px] border border-dashed border-[var(--border)] bg-[var(--surface-muted)] p-3 font-mono text-[11px] text-[var(--muted)]">
        {resolutionSource && <span>Source: {resolutionSource}</span>}
        {yesCondition && <span className="text-brand-secondary">YES: {yesCondition}</span>}
        {noCondition && <span className="text-downvote">NO: {noCondition}</span>}
        <span>Closes {deadline}</span>
      </div>

      <div className="flex max-w-[280px] items-center justify-between border-t border-dashed border-[var(--border)] pt-2 text-[var(--muted)]">
        <button aria-label={`Comment on ${question}`} className="group flex items-center gap-2 transition-colors hover:text-[var(--foreground)]" onClick={onComment} type="button">
          <span className="rounded-full p-2 transition-colors group-hover:bg-[var(--surface-hover)]">
            <MessageCircle className="h-4 w-4" />
          </span>
          <span className="text-xs">{comments}</span>
        </button>

        <button
          aria-label={`Reshare ${question}`}
          aria-pressed={reshared}
          className={`group flex items-center gap-2 transition-colors hover:text-[var(--foreground)] ${reshared ? "text-brand-secondary" : ""}`}
          onClick={onReshare}
          type="button"
        >
          <span className="rounded-full p-2 transition-colors group-hover:bg-[var(--surface-hover)]">
            <Repeat2 className="h-4 w-4" />
          </span>
          <span className="text-xs">{reshares}</span>
        </button>

        <button aria-label={`Share ${question}`} className="group flex items-center gap-2 transition-colors hover:text-[var(--foreground)]" onClick={onShare} type="button">
          <span className="rounded-full p-2 transition-colors group-hover:bg-[var(--surface-hover)]">
            <Share className="h-4 w-4" />
          </span>
        </button>
      </div>
    </article>
  );
}
