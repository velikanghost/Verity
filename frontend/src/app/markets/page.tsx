"use client"

import { useState, useEffect, useMemo, Suspense, useCallback } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { useFeed } from "@/hooks/useFeed"
import { useWalletProfile } from "@/hooks/useWalletProfile"
import {
  useActivePvpEventsQuery,
  useMyActivePvpTicketsQuery,
  usePvpStatusQuery,
  useReferralsQuery,
} from "@/store/verity/verityQueries"

// Extracted subcomponents
import StandardMarketsFeed from "@/components/markets/StandardMarketsFeed"
import PvpArenaTab from "@/components/markets/PvpArenaTab"
import PvpSidebarStats from "@/components/markets/PvpSidebarStats"
import DuelHistory from "@/components/markets/DuelHistory"

type MarketsTab = "general" | "pvp-arena"
type MobilePvpTab = "markets" | "history" | "stats"

function MarketsContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const tabQuery = searchParams.get("tab") as MarketsTab | null
  const [activeTab, setActiveTab] = useState<MarketsTab>(
    tabQuery === "general" || tabQuery === "pvp-arena" ? tabQuery : "general",
  )
  const [mobilePvpTab, setMobilePvpTab] = useState<MobilePvpTab>("markets")
  const { profile } = useWalletProfile()

  useEffect(() => {
    if (tabQuery === "general" || tabQuery === "pvp-arena") {
      setActiveTab(tabQuery)
    }
  }, [tabQuery])

  // Standard feed markets (excludes pvp)
  const {
    items: feedItems,
    loading: feedLoading,
    reload: reloadFeed,
  } = useFeed(profile?.id, true)

  // PvP API queries
  const { data: pvpEventsRaw = [], isLoading: pvpEventsLoading } =
    useActivePvpEventsQuery()
  const { data: myActiveTicketEvents = [], isLoading: myTicketsLoading } =
    useMyActivePvpTicketsQuery()

  // Merge active events + events where user has active tickets (dedup by id)
  const pvpEvents = useMemo(() => {
    const seen = new Set<string>()
    const merged: any[] = []
    for (const evt of pvpEventsRaw) {
      if (!seen.has(evt.id)) {
        seen.add(evt.id)
        merged.push(evt)
      }
    }
    for (const evt of myActiveTicketEvents) {
      if (!seen.has(evt.id)) {
        seen.add(evt.id)
        merged.push(evt)
      }
    }
    // Sort by createdAt descending (newest first)
    return merged.sort((a, b) => {
      const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0
      const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0
      return dateB - dateA
    })
  }, [pvpEventsRaw, myActiveTicketEvents])

  const [selectedPvpEventId, setSelectedPvpEventId] = useState<string | null>(
    null,
  )
  const [hasManuallySelected, setHasManuallySelected] = useState<boolean>(false)
  const [claimedMarketIds, setClaimedMarketIds] = useState<Set<string>>(
    new Set(),
  )

  const handleClaimSuccess = useCallback((marketIds: string[]) => {
    setClaimedMarketIds((prev) => {
      const next = new Set(prev)
      marketIds.forEach((id) => next.add(id))
      return next
    })
  }, [])

  // Sync selected event to query param or the most recent one
  useEffect(() => {
    const queryId = searchParams.get("id")
    if (queryId && pvpEvents.some((e: any) => e.id === queryId)) {
      setSelectedPvpEventId(queryId)
      setHasManuallySelected(true)

      // Clear id from URL
      const params = new URLSearchParams(window.location.search)
      params.delete("id")
      router.replace(`/markets?${params.toString()}`)
      return
    }

    if (pvpEvents && pvpEvents.length > 0) {
      if (!hasManuallySelected) {
        setSelectedPvpEventId(pvpEvents[0].id)
      }
    } else {
      setSelectedPvpEventId(null)
    }
  }, [pvpEvents, hasManuallySelected, searchParams, router])

  const handleSelectPvpEvent = (id: string | null) => {
    setHasManuallySelected(true)
    setSelectedPvpEventId(id)
    const params = new URLSearchParams(window.location.search)
    params.set("tab", "pvp-arena")
    router.push(`/markets?${params.toString()}`)
  }

  const handleTabChange = (tab: MarketsTab) => {
    setActiveTab(tab)
    const params = new URLSearchParams(window.location.search)
    params.set("tab", tab)
    router.push(`/markets?${params.toString()}`)
  }

  const {
    data: pvpStatus,
    refetch: refetchPvpStatus,
    isLoading: pvpStatusLoading,
  } = usePvpStatusQuery(selectedPvpEventId)
  const { data: referralsData } = useReferralsQuery()

  return (
    <div className="w-full max-w-[1240px] mx-auto py-6 font-sans">
      {/* Tabs Menu */}
      <div className="flex border-b border-border dark:border-zinc-800 gap-6 pb-0 mb-6">
        <button
          onClick={() => {
            setHasManuallySelected(false)
            handleTabChange("general")
          }}
          className={`relative pb-3 text-sm font-semibold tracking-tight whitespace-nowrap transition-colors cursor-pointer ${
            activeTab === "general"
              ? "text-charcoal-primary dark:text-white"
              : "text-ash hover:text-charcoal-primary dark:hover:text-white"
          }`}
        >
          General
          {activeTab === "general" && (
            <span className="absolute bottom-0 left-0 right-0 h-[2px] bg-charcoal-primary dark:bg-white rounded-full animate-in fade-in duration-200" />
          )}
        </button>
        <button
          onClick={() => {
            setHasManuallySelected(false)
            handleTabChange("pvp-arena")
          }}
          className={`relative pb-3 text-sm font-semibold tracking-tight whitespace-nowrap transition-colors cursor-pointer ${
            activeTab === "pvp-arena"
              ? "text-charcoal-primary dark:text-white"
              : "text-ash hover:text-charcoal-primary dark:hover:text-white"
          }`}
        >
          PvP Arena
          {activeTab === "pvp-arena" && (
            <span className="absolute bottom-0 left-0 right-0 h-[2px] bg-charcoal-primary dark:bg-white rounded-full animate-in fade-in duration-200" />
          )}
        </button>
      </div>

      {/* Prediction Markets Tab */}
      {activeTab === "general" && (
        <StandardMarketsFeed
          feedItems={feedItems}
          feedLoading={feedLoading}
          reloadFeed={reloadFeed}
          profile={profile}
          setActiveTab={handleTabChange}
          pvpEvents={pvpEvents}
          pvpEventsLoading={pvpEventsLoading}
          setSelectedPvpEventId={handleSelectPvpEvent}
        />
      )}

      {/* PvP Arena Tab */}
      {activeTab === "pvp-arena" && (
        <div className="flex flex-col gap-4">
          {/* Mobile Sub-tabs Menu (Only visible on mobile) */}
          <div className="lg:hidden flex p-1 rounded-xl bg-stone-100 dark:bg-zinc-900 border border-stone-200/60 dark:border-zinc-800/60 gap-1 mb-2">
            <button
              onClick={() => setMobilePvpTab("markets")}
              className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all text-center cursor-pointer ${
                mobilePvpTab === "markets"
                  ? "bg-white dark:bg-zinc-800 text-charcoal-primary dark:text-white shadow-sm"
                  : "text-ash hover:text-charcoal-primary dark:hover:text-white"
              }`}
            >
              Markets
            </button>
            <button
              onClick={() => setMobilePvpTab("history")}
              className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all text-center cursor-pointer ${
                mobilePvpTab === "history"
                  ? "bg-white dark:bg-zinc-800 text-charcoal-primary dark:text-white shadow-sm"
                  : "text-ash hover:text-charcoal-primary dark:hover:text-white"
              }`}
            >
              Duel History
            </button>
            <button
              onClick={() => setMobilePvpTab("stats")}
              className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all text-center cursor-pointer ${
                mobilePvpTab === "stats"
                  ? "bg-white dark:bg-zinc-800 text-charcoal-primary dark:text-white shadow-sm"
                  : "text-ash hover:text-charcoal-primary dark:hover:text-white"
              }`}
            >
              PvP Stats
            </button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-start">
            {/* Main Duelling Area */}
            <div className={`lg:col-span-2 ${mobilePvpTab === "markets" ? "block" : "hidden"} lg:block`}>
              <PvpArenaTab
                pvpEvents={pvpEvents}
                pvpEventsLoading={pvpEventsLoading || myTicketsLoading}
                pvpStatus={pvpStatus}
                pvpStatusLoading={pvpStatusLoading}
                refetchPvpStatus={refetchPvpStatus}
                profile={profile}
                referralsData={referralsData}
                selectedPvpEventId={selectedPvpEventId}
                setSelectedPvpEventId={handleSelectPvpEvent}
                claimedMarketIds={claimedMarketIds}
                setClaimedMarketIds={setClaimedMarketIds}
              />
            </div>

            {/* Right Sidebar: Profile stats & Duel History */}
            <div className={`flex flex-col gap-4 ${mobilePvpTab !== "markets" ? "block" : "hidden"} lg:flex`}>
              <div className={`${mobilePvpTab === "stats" ? "block" : "hidden"} lg:block`}>
                <PvpSidebarStats
                  profile={profile}
                  referralsData={referralsData}
                  claimedMarketIds={claimedMarketIds}
                  onClaimSuccess={handleClaimSuccess}
                />
              </div>
              <div className={`${mobilePvpTab === "history" ? "block" : "hidden"} lg:block`}>
                <DuelHistory />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default function MarketsPage() {
  return (
    <Suspense
      fallback={
        <div className="w-full text-center py-12 text-ash">Loading...</div>
      }
    >
      <MarketsContent />
    </Suspense>
  )
}
