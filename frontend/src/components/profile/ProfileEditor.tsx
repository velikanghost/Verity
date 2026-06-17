"use client"

import { useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { Edit3, Share, MoreHorizontal, LogOut, Sun, Moon } from "lucide-react"
import { useTheme } from "next-themes"
import { useAuth } from "@/components/providers/AuthModals"
import ProfileActivityTabs, {
  type ProfileActivityTab,
} from "@/components/social/ProfileActivityTabs"
import SocialUserListModal from "@/components/social/SocialUserListModal"
import { useFeed } from "@/hooks/useFeed"
import { useWalletProfile } from "@/hooks/useWalletProfile"
import { displayHandle, displayName, type Profile } from "@/lib/verity"
import {
  useProfileActivityQuery,
  useUserPortfolioQuery,
  useReferralsQuery,
} from "@/store/verity/verityQueries"
import { toast } from "@/lib/toast"

export default function ProfileEditor() {
  const router = useRouter()
  const { profile } = useWalletProfile()
  const { items } = useFeed()
  const { data: referralsData } = useReferralsQuery()
  const [activeTab, setActiveTab] = useState<ProfileActivityTab>("markets")
  const [peopleModal, setPeopleModal] = useState<
    "followers" | "following" | null
  >(null)
  const isConnected = Boolean(profile)

  const { login, logout } = useAuth()
  const { setTheme, resolvedTheme } = useTheme()
  const [optionsOpen, setOptionsOpen] = useState(false)
  const isDark = resolvedTheme === "dark"

  const { data: tabItems = [], isLoading: isActivityLoading } =
    useProfileActivityQuery(
      profile?.id || "",
      activeTab === "markets"
        ? "markets"
        : activeTab === "activity"
          ? "comments"
          : "posts",
      profile?.id,
    )

  const { data: positions = [], isLoading: isPositionsLoading } =
    useUserPortfolioQuery(profile?.id || "")

  const resolvedPositions = positions.filter(pos => pos.status === "resolved" && pos.resolved_outcome !== null)
  const wonPositions = resolvedPositions.filter(pos => pos.resolved_outcome === pos.side)
  
  const accuracy =
    resolvedPositions.length > 0
      ? Math.round((wonPositions.length / resolvedPositions.length) * 100)
      : 0

  const isTabLoading =
    activeTab === "markets"
      ? isActivityLoading
      : activeTab === "predictions"
        ? isPositionsLoading
        : activeTab === "activity"
          ? isActivityLoading
          : false

  const localProfileItems = useMemo(
    () =>
      profile ? items.filter((item) => item.author.id === profile.id) : [],
    [items, profile],
  )
  const marketItems = localProfileItems.filter((item) => item.market)
  const knownUsers = useMemo(() => {
    const users = new Map<string, Profile>()
    items.forEach((item) => users.set(item.author.id, item.author))
    if (profile) users.set(profile.id, profile)
    return Array.from(users.values())
  }, [items, profile])

  if (!isConnected) {
    return (
      <div className="verity-card p-8 mt-6 text-center flex flex-col items-center justify-center border border-border bg-surface-solid py-12">
        <h3 className="text-lg font-semibold text-charcoal-primary">
          Access Your Profile
        </h3>
        <p className="mt-2 text-sm text-ash max-w-sm">
          Log in or sign up to view and customize your profile, copy referral
          links, and track your stats.
        </p>
        <div className="mt-6 w-full max-w-[240px]">
          <button
            onClick={login}
            className="verity-pill flex h-11 w-full items-center justify-center gap-2 bg-inverse px-4 text-sm font-semibold tracking-[-0.18px] text-inverse-text transition-opacity hover:opacity-90 cursor-pointer"
          >
            Get Started
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3 py-3 sm:py-4">
      <section className="verity-card overflow-hidden">
        <div className="h-24 bg-brand-primary sm:h-28" />

        <div className="px-4 pb-4 sm:px-5 sm:pb-5">
          <div className="-mt-10 flex items-end justify-between gap-3">
            <ProfileAvatar profile={profile} />
            <div className="mb-2 flex gap-2">
              <button
                className="clickable verity-pill hidden h-10 items-center justify-center gap-2 bg-parchment-card px-4 text-sm font-semibold tracking-[-0.18px] text-charcoal-primary shadow-subtle hover:bg-stone-surface sm:inline-flex ring-4 ring-surface-solid"
                onClick={() => {
                  if (typeof window !== "undefined") {
                    void navigator.clipboard?.writeText(window.location.href)
                  }
                }}
                type="button"
              >
                Share profile <Share className="h-4 w-4" />
              </button>
              <button
                className="clickable verity-pill flex h-10 items-center justify-center gap-2 bg-inverse px-4 text-sm font-semibold tracking-[-0.18px] text-inverse-text hover:opacity-90 ring-4 ring-surface-solid"
                onClick={() => router.push("/profile/edit")}
                type="button"
              >
                Edit profile <Edit3 className="hidden sm:block h-4 w-4" />
              </button>

              <div className="relative">
                <button
                  className="clickable verity-pill flex h-10 w-10 items-center justify-center bg-parchment-card text-charcoal-primary shadow-subtle hover:bg-stone-surface ring-4 ring-surface-solid"
                  onClick={() => setOptionsOpen(!optionsOpen)}
                  type="button"
                  aria-label="Options"
                >
                  <MoreHorizontal className="h-5 w-5" />
                </button>

                {optionsOpen && (
                  <div className="absolute right-0 top-[calc(100%+8px)] z-50 w-48 rounded-[12px] border border-border bg-surface-solid p-1.5 shadow-sm">
                    <button
                      className="flex w-full items-center justify-between rounded-[8px] px-3 py-2 text-left text-xs font-semibold text-charcoal-primary hover:bg-stone-surface transition-colors cursor-pointer"
                      onClick={() => {
                        setTheme(isDark ? "light" : "dark")
                        setOptionsOpen(false)
                      }}
                      type="button"
                    >
                      <span className="flex items-center gap-2">
                        {isDark ? (
                          <>
                            <Sun className="h-4 w-4 text-ash" /> Light Mode
                          </>
                        ) : (
                          <>
                            <Moon className="h-4 w-4 text-ash" /> Dark Mode
                          </>
                        )}
                      </span>
                    </button>

                    {isConnected && (
                      <>
                        <div className="my-1 h-px bg-border/60" />
                        {referralsData?.referralLink && (
                          <button
                            className="flex w-full items-center gap-2 rounded-[8px] px-3 py-2 text-left text-xs font-semibold text-charcoal-primary hover:bg-stone-surface transition-colors cursor-pointer"
                            onClick={() => {
                              const link = `${window.location.origin}/?ref=${referralsData.referralLink}`
                              void navigator.clipboard.writeText(link)
                              toast.success("Referral link copied!")
                              setOptionsOpen(false)
                            }}
                            type="button"
                          >
                            <Share className="h-4 w-4 text-ash" />
                            Copy Referral Link
                          </button>
                        )}
                        <button
                          className="flex w-full items-center gap-2 rounded-[8px] px-3 py-2 text-left text-xs font-semibold text-coral-red hover:bg-red-500/10 transition-colors cursor-pointer"
                          onClick={() => {
                            logout()
                            setOptionsOpen(false)
                            router.push("/")
                          }}
                          type="button"
                        >
                          <LogOut className="h-4 w-4" />
                          Log Out
                        </button>
                      </>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="mt-3">
            <div className="flex items-center gap-2">
              <h1 className="text-[28px] font-semibold leading-[1.1] tracking-[-0.7px] text-midnight">
                {displayName(profile)}
              </h1>
            </div>
            <p className="mt-1 font-mono text-sm text-ash">
              {displayHandle(profile)}
            </p>
            {profile?.bio ? (
              <p className="mt-3 max-w-[560px] text-[15px] leading-[1.47] tracking-[-0.2px] text-graphite">
                {profile.bio}
              </p>
            ) : (
              <p className="mt-3 max-w-[560px] text-[15px] leading-[1.47] tracking-[-0.2px] text-ash">
                Add a bio so people know what markets you care about.
              </p>
            )}

            <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm tracking-[-0.18px] text-graphite">
              <button
                className="hover:text-ember-orange"
                onClick={() => setPeopleModal("following")}
                type="button"
              >
                <strong className="font-semibold text-midnight">
                  {(profile?.followingCount || 0).toLocaleString()}
                </strong>{" "}
                Following
              </button>
              <button
                className="hover:text-ember-orange"
                onClick={() => setPeopleModal("followers")}
                type="button"
              >
                <strong className="font-semibold text-midnight">
                  {(profile?.followersCount || 0).toLocaleString()}
                </strong>{" "}
                Followers
              </button>
              <span className="font-mono text-xs text-ash">
                {marketItems.length} markets
              </span>
              <span className="font-mono text-xs text-ash">
                {accuracy}% accuracy
              </span>
              {isConnected && profile && (
                <span className="font-mono text-xs text-ash font-semibold dark:text-indigo-400">
                  ⭐ {(profile.arenaXp ?? 0).toLocaleString()} XP
                </span>
              )}
            </div>
          </div>
        </div>

        <ProfileTabs activeTab={activeTab} onChange={setActiveTab} />
      </section>

      {profile && (
        <ProfileActivityTabs
          activeTab={activeTab}
          items={tabItems}
          positions={positions}
          loading={isTabLoading}
          onOpenMarket={(market) => router.push(`/markets/${market.id}`)}
          onOpenPost={(post) => router.push(`/posts/${post.id}`)}
          profile={profile}
        />
      )}

      <SocialUserListModal
        open={peopleModal !== null}
        onClose={() => setPeopleModal(null)}
        subtitle="People already active on Verity."
        title={peopleModal === "followers" ? "Followers" : "Following"}
        users={knownUsers}
      />
    </div>
  )
}

function ProfileAvatar({ profile }: { profile: Profile | null }) {
  const avatarUrl = profile?.avatar_url || profile?.avatarUrl

  if (avatarUrl) {
    return (
      <div
        className="h-20 w-20 shrink-0 rounded-[24px] bg-cover bg-center ring-4 ring-white shadow-subtle sm:h-24 sm:w-24 sm:rounded-[28px]"
        style={{ backgroundImage: `url(${avatarUrl})` }}
      />
    )
  }

  return (
    <div className="verity-blob h-20 w-20 shrink-0 bg-sky-blue ring-4 ring-white sm:h-24 sm:w-24">
      <span className="verity-blob-smile" />
    </div>
  )
}

function ProfileTabs({
  activeTab,
  onChange,
}: {
  activeTab: ProfileActivityTab
  onChange: (tab: ProfileActivityTab) => void
}) {
  const tabs: Array<{ id: ProfileActivityTab; label: string }> = [
    { id: "markets", label: "Markets" },
    { id: "predictions", label: "Predictions" },
    { id: "activity", label: "Activity" },
  ]

  return (
    <div className="grid grid-cols-3 border-t border-dashed border-stone-surface px-2">
      {tabs.map((tab) => (
        <button
          className={`relative h-12 rounded-[10px] text-[13px] sm:text-sm font-semibold tracking-[-0.18px] ${
            activeTab === tab.id
              ? "text-charcoal-primary"
              : "clickable-tab text-ash"
          }`}
          key={tab.id}
          onClick={() => onChange(tab.id)}
          type="button"
        >
          {tab.label}
          {activeTab === tab.id && (
            <span className="absolute bottom-0 left-1/2 h-1 w-9 -translate-x-1/2 rounded-full bg-ember-orange sm:w-12" />
          )}
        </button>
      ))}
    </div>
  )
}
