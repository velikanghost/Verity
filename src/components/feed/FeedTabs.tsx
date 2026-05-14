"use client";

const FEED_TABS = [
  { id: "for-you", label: "For You" },
  { id: "markets", label: "Markets" },
] as const;

export type FeedTabId = (typeof FEED_TABS)[number]["id"];

interface FeedTabsProps {
  activeTab: FeedTabId;
  onTabChange: (tab: FeedTabId) => void;
}

export default function FeedTabs({ activeTab, onTabChange }: FeedTabsProps) {
  return (
    <div
      aria-label="Feed views"
      className="sticky top-[84px] z-10 grid grid-cols-2 overflow-hidden rounded-[18px] border border-[var(--border)] bg-[var(--surface)] p-1 shadow-sm sm:top-3"
      role="tablist"
    >
      {FEED_TABS.map((tab) => {
        const isActive = activeTab === tab.id;

        return (
          <button
            aria-controls="feed-panel"
            aria-selected={isActive}
            className={`group relative flex h-11 items-center justify-center rounded-[13px] text-xs font-black uppercase tracking-[0.12em] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-inset ${
              isActive ? "bg-[var(--inverse)] text-[var(--inverse-text)]" : "text-[var(--muted)] hover:bg-[var(--surface-hover)] hover:text-[var(--foreground)]"
            }`}
            id={`feed-tab-${tab.id}`}
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            role="tab"
            type="button"
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}
