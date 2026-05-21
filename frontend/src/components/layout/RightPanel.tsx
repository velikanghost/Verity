"use client";

import { Search, TrendingUp, Trophy } from "lucide-react";
import { useFeed } from "@/hooks/useFeed";
import { useRightPanelSlot } from "@/hooks/useRightPanelSlot";
import { displayHandle, displayName } from "@/lib/verity";

export default function RightPanel() {
  const { items } = useFeed(undefined, true);
  const marketItems = items.filter((item) => item.market);
  const trending = marketItems.slice(0, 3);
  const predictors = Array.from(
    new Map(items.map((item) => [item.author.id, item.author])).values()
  ).slice(0, 3);
  const slotContent = useRightPanelSlot();

  return (
    <div className="flex h-full w-full flex-col gap-4 overflow-y-auto pb-8">
      <div className="group relative">
        <div className="pointer-events-none absolute inset-y-0 left-4 flex items-center">
          <Search className="h-5 w-5 text-muted transition-colors group-focus-within:text-foreground" />
        </div>
        <input
          className="w-full rounded-[18px] border border-border bg-surface py-3 pl-12 pr-4 text-foreground shadow-sm outline-none placeholder:text-muted focus:border-border-strong focus:ring-1 focus:ring-border-strong"
          placeholder="Search markets, users..."
          type="text"
        />
      </div>

      {/* Dynamic slot content injected by child pages (e.g. MarketDetail) */}
      {slotContent}

      <div className="flex flex-col overflow-hidden rounded-[18px] border border-border bg-surface shadow-sm">
        <div className="border-b border-dashed border-border p-4">
          <h2 className="flex items-center gap-2 font-mono text-xs font-black uppercase tracking-[0.16em] text-foreground">
            <TrendingUp className="h-4 w-4 text-brand-secondary" />
            Trending Markets
          </h2>
        </div>

        <div className="flex flex-col">
          {trending.length > 0 ? trending.map((item) => {
            const market = item.market;
            const yes = market ? calculateYesPercent(Number(market.usdc_yes_amount), Number(market.usdc_no_amount)) : 50;
            const volume = market ? Number(market.usdc_yes_amount) + Number(market.usdc_no_amount) : 0;

            return (
              <div
                className="flex cursor-pointer flex-col gap-2 border-b border-dashed border-border p-4 transition-colors hover:bg-surface-hover"
                key={item.id}
              >
                <span className="font-mono text-[10px] font-black uppercase tracking-[0.16em] text-muted">
                  Trending in {market?.category || "Markets"}
                </span>
                <p className="line-clamp-2 text-sm font-bold leading-snug text-foreground">{market?.question}</p>
                <div className="mt-1 flex items-center justify-between">
                  <span className="font-mono text-xs font-bold text-brand-secondary">{yes.toFixed(0)}% YES</span>
                  <span className="font-mono text-xs text-muted">{volume.toLocaleString()} USDC</span>
                </div>
              </div>
            );
          }) : (
            <div className="p-4 text-sm text-muted">No live markets yet.</div>
          )}
        </div>

        <button className="p-4 text-left font-mono text-xs font-black uppercase tracking-[0.12em] text-foreground transition-colors hover:bg-surface-hover">
          Show more
        </button>
      </div>

      {!slotContent && (
        <div className="flex flex-col overflow-hidden rounded-[18px] border border-border bg-surface shadow-sm">
          <div className="border-b border-dashed border-border p-4">
            <h2 className="flex items-center gap-2 font-mono text-xs font-black uppercase tracking-[0.16em] text-foreground">
              <Trophy className="h-4 w-4 text-yellow-500" />
              Top Predictors
            </h2>
          </div>

          <div className="flex flex-col">
            {predictors.length > 0 ? predictors.map((user) => (
              <div
                className="flex cursor-pointer items-center justify-between p-4 transition-colors hover:bg-surface-hover"
                key={user.id}
              >
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-inverse" />
                  <div className="flex flex-col">
                    <span className="text-sm font-black leading-none text-foreground hover:underline">{displayName(user)}</span>
                    <span className="mt-1 font-mono text-xs text-muted">{displayHandle(user)}</span>
                  </div>
                </div>
                <div className="flex flex-col items-end">
                  <span className="text-sm font-black text-brand-secondary">Live</span>
                  <span className="font-mono text-[10px] uppercase text-muted">Creator</span>
                </div>
              </div>
            )) : (
              <div className="p-4 text-sm text-muted">No predictors yet.</div>
            )}
          </div>
        </div>
      )}

      <div className="flex flex-wrap gap-x-3 gap-y-1 px-4 font-mono text-[11px] text-muted">
        <a href="#" className="hover:underline">Terms of Service</a>
        <a href="#" className="hover:underline">Privacy Policy</a>
        <a href="#" className="hover:underline">Cookie Policy</a>
        <a href="#" className="hover:underline">Accessibility</a>
        <a href="#" className="hover:underline">Docs</a>
        <span>{"\u00A9"} 2026 Verity</span>
      </div>
    </div>
  );
}

function calculateYesPercent(yes: number, no: number) {
  const total = yes + no;
  if (total === 0) return 50;
  return (yes / total) * 100;
}
