"use client"

const FEED_TABS = [
  { id: "for-you", label: "For You" },
  { id: "markets", label: "Markets" },
] as const

export type FeedTabId = (typeof FEED_TABS)[number]["id"]

interface FeedTabsProps {
  activeTab: FeedTabId
  onTabChange: (tab: FeedTabId) => void
}

export default function FeedTabs({ activeTab, onTabChange }: FeedTabsProps) {
  return (
    <div
      aria-label="Feed views"
      className="verity-card sticky top-[84px] z-10 grid grid-cols-2 overflow-hidden p-1 sm:top-4"
      role="tablist"
    >
      {FEED_TABS.map((tab) => {
        const isActive = activeTab === tab.id

        return (
          <button
            aria-controls="feed-panel"
            aria-selected={isActive}
            className={`verity-pill group relative flex h-10 items-center justify-center text-sm font-semibold tracking-[-0.18px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-midnight focus-visible:ring-inset ${
              isActive
                ? "bg-inverse text-inverse-text"
                : "clickable-tab text-graphite"
            }`}
            id={`feed-tab-${tab.id}`}
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            role="tab"
            type="button"
          >
            {tab.label}
          </button>
        )
      })}
    </div>
  )
}
