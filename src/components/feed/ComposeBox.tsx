"use client";

import { useMemo, useState } from "react";
import { Image as ImageIcon, BarChart2, Smile, MapPin } from "lucide-react";
import {
  createMarketPost,
  createNormalPost,
  type MarketInput,
  type Profile,
} from "@/lib/verity";

interface ComposeBoxProps {
  profile: Profile | null;
  onCreated: () => void;
}

const MARKET_CATEGORIES = ["Crypto", "Culture", "Economics", "Miscellaneous", "Politics", "Sports"];

export default function ComposeBox({ profile, onCreated }: ComposeBoxProps) {
  const [content, setContent] = useState("");
  const [isMarket, setIsMarket] = useState(false);
  const [market, setMarket] = useState<MarketInput>({
    content: "",
    question: "",
    category: "Crypto",
    deadline: "",
    resolutionSource: "",
    yesCondition: "",
    noCondition: "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSubmit = useMemo(() => {
    if (!profile || saving) return false;
    if (!isMarket) return content.trim().length > 0;

    return (
      market.question.trim().length > 0 &&
      market.category.trim().length > 0 &&
      market.deadline.trim().length > 0 &&
      market.resolutionSource.trim().length > 0 &&
      market.yesCondition.trim().length > 0 &&
      market.noCondition.trim().length > 0
    );
  }, [content, isMarket, market, profile, saving]);

  async function submit() {
    if (!profile || !canSubmit) return;

    setSaving(true);
    setError(null);

    try {
      if (isMarket) {
        await createMarketPost(profile.id, { ...market, content });
        setMarket({
          content: "",
          question: "",
          category: "Crypto",
          deadline: "",
          resolutionSource: "",
          yesCondition: "",
          noCondition: "",
        });
        setIsMarket(false);
      } else {
        await createNormalPost(profile.id, content);
      }

      setContent("");
      onCreated();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to create post.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex gap-4 rounded-[18px] border border-[var(--border)] bg-[var(--surface)] p-4 shadow-sm">
      {/* Avatar */}
      <div className="flex-shrink-0">
        <div className="h-10 w-10 rounded-full bg-[var(--inverse)]" />
      </div>
      
      <div className="flex-1 flex flex-col pt-1">
        <textarea 
          disabled={!profile || saving}
          onChange={(event) => setContent(event.target.value)}
          placeholder={profile ? "What's your conviction?" : "Connect wallet to post"}
          value={content}
          className="min-h-[60px] w-full resize-none border-none bg-transparent text-lg font-semibold text-[var(--foreground)] outline-none placeholder:text-[var(--muted)]"
        />

        {isMarket && (
          <div className="mt-3 grid gap-2 rounded-[13px] border border-dashed border-[var(--border)] bg-[var(--surface-muted)] p-3">
            <input
              className="h-10 rounded-[8px] border border-[var(--border)] bg-[var(--surface)] px-3 text-sm text-[var(--foreground)] outline-none placeholder:text-[var(--muted)]"
              onChange={(event) => setMarket((current) => ({ ...current, question: event.target.value }))}
              placeholder="Market question"
              value={market.question}
            />
            <div className="grid gap-2 sm:grid-cols-2">
              <select
                className="h-10 rounded-[8px] border border-[var(--border)] bg-[var(--surface)] px-3 text-sm text-[var(--foreground)] outline-none"
                onChange={(event) => setMarket((current) => ({ ...current, category: event.target.value }))}
                value={market.category}
              >
                {MARKET_CATEGORIES.map((category) => (
                  <option key={category}>{category}</option>
                ))}
              </select>
              <input
                className="h-10 rounded-[8px] border border-[var(--border)] bg-[var(--surface)] px-3 text-sm text-[var(--foreground)] outline-none"
                onChange={(event) => setMarket((current) => ({ ...current, deadline: event.target.value }))}
                type="datetime-local"
                value={market.deadline}
              />
            </div>
            <input
              className="h-10 rounded-[8px] border border-[var(--border)] bg-[var(--surface)] px-3 text-sm text-[var(--foreground)] outline-none placeholder:text-[var(--muted)]"
              onChange={(event) => setMarket((current) => ({ ...current, resolutionSource: event.target.value }))}
              placeholder="Resolution source"
              value={market.resolutionSource}
            />
            <div className="grid gap-2 sm:grid-cols-2">
              <input
                className="h-10 rounded-[8px] border border-brand-secondary/40 bg-[var(--surface)] px-3 text-sm text-[var(--foreground)] outline-none placeholder:text-[var(--muted)]"
                onChange={(event) => setMarket((current) => ({ ...current, yesCondition: event.target.value }))}
                placeholder="YES condition"
                value={market.yesCondition}
              />
              <input
                className="h-10 rounded-[8px] border border-downvote/40 bg-[var(--surface)] px-3 text-sm text-[var(--foreground)] outline-none placeholder:text-[var(--muted)]"
                onChange={(event) => setMarket((current) => ({ ...current, noCondition: event.target.value }))}
                placeholder="NO condition"
                value={market.noCondition}
              />
            </div>
          </div>
        )}

        {error && <p className="mt-2 text-sm text-downvote">{error}</p>}
        
        <div className="mt-2 flex items-center justify-between border-t border-dashed border-[var(--border)] pt-3">
          <div className="flex items-center gap-1 text-[var(--muted)]">
            <button aria-label="Add image" className="rounded-full p-2 transition-colors hover:bg-[var(--surface-hover)] hover:text-[var(--foreground)]">
              <ImageIcon className="w-5 h-5" />
            </button>
            <button
              aria-label="Create market"
              aria-pressed={isMarket}
              className={`rounded-full p-2 transition-colors hover:bg-[var(--surface-hover)] hover:text-[var(--foreground)] ${
                isMarket ? "bg-brand-secondary/10 text-brand-secondary" : ""
              }`}
              onClick={() => setIsMarket((current) => !current)}
              type="button"
            >
              <BarChart2 className="w-5 h-5" />
            </button>
            <button aria-label="Add emoji" className="hidden rounded-full p-2 transition-colors hover:bg-[var(--surface-hover)] hover:text-[var(--foreground)] sm:block">
              <Smile className="w-5 h-5" />
            </button>
            <button aria-label="Add location" className="hidden rounded-full p-2 transition-colors hover:bg-[var(--surface-hover)] hover:text-[var(--foreground)] sm:block">
              <MapPin className="w-5 h-5" />
            </button>
          </div>
          
          <button
            className={`rounded-[10px] px-5 py-2 font-mono text-[10px] font-black uppercase tracking-[0.16em] transition-opacity ${
              canSubmit
                ? "bg-[var(--inverse)] text-[var(--inverse-text)] hover:opacity-85"
                : "cursor-not-allowed bg-zinc-300 text-zinc-500"
            }`}
            disabled={!canSubmit}
            onClick={submit}
            type="button"
          >
            {saving ? "Posting" : isMarket ? "Market" : "Post"}
          </button>
        </div>
      </div>
    </div>
  );
}
