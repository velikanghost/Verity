'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { BadgeCheck, Share } from 'lucide-react'
import FollowButton from '@/components/profile/FollowButton'
import ProfileActivityTabs, {
  type ProfileActivityTab,
} from '@/components/social/ProfileActivityTabs'
import SocialUserListModal from '@/components/social/SocialUserListModal'
import { useFeed } from '@/hooks/useFeed'
import { useWalletProfile } from '@/hooks/useWalletProfile'
import { displayHandle, displayName, type Profile } from '@/lib/verity'
import { useProfileActivityQuery } from '@/store/verity/verityQueries'

interface PublicProfileViewProps {
  userId: string
}

export default function PublicProfileView({ userId }: PublicProfileViewProps) {
  const router = useRouter()
  const { profile: viewerProfile } = useWalletProfile()
  const { items, loading, error } = useFeed(viewerProfile?.id)
  const [activeTab, setActiveTab] = useState<ProfileActivityTab>('posts')
  const [peopleModal, setPeopleModal] = useState<
    'followers' | 'following' | null
  >(null)

  const decodedUserId = decodeURIComponent(userId)
  const profile = useMemo(() => {
    const authors = new Map<string, Profile>()
    items.forEach((item) => {
      authors.set(item.author.id, item.author)
      if (item.author.username) authors.set(item.author.username, item.author)
      if (displayHandle(item.author) !== '@unknown') {
        authors.set(displayHandle(item.author).slice(1), item.author)
      }
    })
    if (viewerProfile) {
      authors.set(viewerProfile.id, viewerProfile)
      if (viewerProfile.username)
        authors.set(viewerProfile.username, viewerProfile)
    }
    return authors.get(decodedUserId) || null
  }, [decodedUserId, items, viewerProfile])

  const { data: tabItems = [] } = useProfileActivityQuery(
    profile?.id || '',
    activeTab,
    viewerProfile?.id,
  )

  const localProfileItems = useMemo(() => {
    if (!profile) return []
    return items.filter((item) => item.author.id === profile.id)
  }, [items, profile])

  const marketItems = localProfileItems.filter((item) => item.market)
  const knownUsers = useMemo(() => {
    const users = new Map<string, Profile>()
    items.forEach((item) => users.set(item.author.id, item.author))
    if (viewerProfile) users.set(viewerProfile.id, viewerProfile)
    if (profile) users.set(profile.id, profile)
    return Array.from(users.values())
  }, [items, profile, viewerProfile])
  const accuracy =
    profile?.freeVotesTotal && profile.freeVotesTotal > 0
      ? Math.round(
          ((profile.freeVotesCorrect || 0) / profile.freeVotesTotal) * 100,
        )
      : 0

  if (loading && !profile) {
    return <ProfileState message="Loading profile..." />
  }

  if (error && !profile) {
    return <ProfileState message={error} tone="error" />
  }

  if (!profile) {
    return <ProfileState message="Profile not found in the current feed." />
  }

  return (
    <div className="flex flex-col gap-3 py-3 sm:py-4">
      <section className="verity-card overflow-hidden">
        <div className="h-24 bg-midnight sm:h-28" />

        <div className="px-4 pb-4 sm:px-5 sm:pb-5">
          <div className="-mt-10 flex items-end justify-between gap-3">
            <ProfileAvatar profile={profile} />
            <div className="mb-2 flex gap-2">
              <button
                className="verity-pill hidden h-10 items-center justify-center gap-2 bg-parchment-card px-4 text-sm font-semibold tracking-[-0.18px] text-charcoal-primary shadow-[var(--shadow-subtle)] transition-colors hover:bg-stone-surface sm:inline-flex"
                onClick={() => {
                  if (typeof window !== 'undefined') {
                    void navigator.clipboard?.writeText(window.location.href)
                  }
                }}
                type="button"
              >
                Share profile <Share className="h-4 w-4" />
              </button>
              <FollowButton compact profile={profile} />
            </div>
          </div>

          <div className="mt-3">
            <div className="flex items-center gap-2">
              <h1 className="truncate text-[28px] font-semibold leading-[1.1] tracking-[-0.7px] text-midnight">
                {displayName(profile)}
              </h1>
            </div>
            <p className="mt-1 font-mono text-sm text-ash">
              {displayHandle(profile)}
            </p>
            {profile.bio && (
              <p className="mt-3 max-w-[560px] text-[15px] leading-[1.47] tracking-[-0.2px] text-graphite">
                {profile.bio}
              </p>
            )}
            <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm tracking-[-0.18px] text-graphite">
              <button
                className="hover:text-ember-orange"
                onClick={() => setPeopleModal('following')}
                type="button"
              >
                <strong className="font-semibold text-midnight">
                  {(profile.followingCount || 0).toLocaleString()}
                </strong>{' '}
                Following
              </button>
              <button
                className="hover:text-ember-orange"
                onClick={() => setPeopleModal('followers')}
                type="button"
              >
                <strong className="font-semibold text-midnight">
                  {(profile.followersCount || 0).toLocaleString()}
                </strong>{' '}
                Followers
              </button>
              <span className="font-mono text-xs text-ash">
                {localProfileItems.length} posts
              </span>
              <span className="font-mono text-xs text-ash">
                {marketItems.length} markets
              </span>
              <span className="font-mono text-xs text-ash">
                {accuracy}% accuracy
              </span>
            </div>
          </div>
        </div>

        <ProfileTabs activeTab={activeTab} onChange={setActiveTab} />
      </section>

      <ProfileActivityTabs
        activeTab={activeTab}
        items={tabItems}
        onOpenMarket={(market) => router.push(`/markets/${market.id}`)}
        onOpenPost={(post) => router.push(`/posts/${post.id}`)}
        profile={profile}
      />

      <SocialUserListModal
        open={peopleModal !== null}
        onClose={() => setPeopleModal(null)}
        subtitle="People already active on Verity."
        title={peopleModal === 'followers' ? 'Followers' : 'Following'}
        users={knownUsers}
      />
    </div>
  )
}

function ProfileAvatar({ profile }: { profile: Profile }) {
  const avatarUrl = profile.avatar_url || profile.avatarUrl

  if (avatarUrl) {
    return (
      <div
        className="h-20 w-20 shrink-0 rounded-[24px] bg-cover bg-center ring-4 ring-white shadow-[var(--shadow-subtle)] sm:h-24 sm:w-24 sm:rounded-[28px]"
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
    { id: 'posts', label: 'Posts' },
    { id: 'markets', label: 'Markets' },
    { id: 'comments', label: 'Comments' },
    { id: 'likes', label: 'Likes' },
    { id: 'reshares', label: 'Reshares' },
  ]

  return (
    <div className="grid grid-cols-5 border-t border-dashed border-stone-surface px-2">
      {tabs.map((tab) => (
        <button
          className={`relative h-12 text-[13px] sm:text-sm font-semibold tracking-[-0.18px] transition-colors ${
            activeTab === tab.id
              ? 'text-charcoal-primary'
              : 'text-ash hover:text-charcoal-primary'
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

function ProfileState({
  message,
  tone = 'neutral',
}: {
  message: string
  tone?: 'neutral' | 'error'
}) {
  return (
    <div className="py-4">
      <section
        className={`rounded-[12px] p-8 text-center text-sm font-medium tracking-[-0.18px] shadow-[var(--shadow-subtle)] ${
          tone === 'error'
            ? 'bg-ember-orange/10 text-charcoal-primary'
            : 'bg-white text-ash'
        }`}
      >
        {message}
      </section>
    </div>
  )
}
