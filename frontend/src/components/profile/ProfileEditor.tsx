'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Edit3, Share } from 'lucide-react'
import ProfileActivityTabs, {
  type ProfileActivityTab,
} from '@/components/social/ProfileActivityTabs'
import SocialUserListModal from '@/components/social/SocialUserListModal'
import { useFeed } from '@/hooks/useFeed'
import { useWalletProfile } from '@/hooks/useWalletProfile'
import { displayHandle, displayName, type Profile } from '@/lib/verity'
import { useProfileActivityQuery } from '@/store/verity/verityQueries'

export default function ProfileEditor() {
  const router = useRouter()
  const { profile } = useWalletProfile()
  const { items } = useFeed()
  const [activeTab, setActiveTab] = useState<ProfileActivityTab>('posts')
  const [peopleModal, setPeopleModal] = useState<
    'followers' | 'following' | null
  >(null)
  const isConnected = Boolean(profile)

  const { data: tabItems = [], isLoading: isActivityLoading } =
    useProfileActivityQuery(profile?.id || '', activeTab, profile?.id)

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

  return (
    <div className="flex flex-col gap-3 py-3 sm:py-4">
      <section className="verity-card overflow-hidden">
        <div className="h-24 bg-brand-primary sm:h-28" />

        <div className="px-4 pb-4 sm:px-5 sm:pb-5">
          <div className="-mt-10 flex items-end justify-between gap-3">
            <ProfileAvatar profile={profile} />
            <div className="mb-2 flex gap-2">
              <button
                className="clickable verity-pill hidden h-10 items-center justify-center gap-2 bg-parchment-card px-4 text-sm font-semibold tracking-[-0.18px] text-charcoal-primary shadow-[(--shadow-subtle)] hover:bg-stone-surface sm:inline-flex"
                onClick={() => {
                  if (typeof window !== 'undefined') {
                    void navigator.clipboard?.writeText(window.location.href)
                  }
                }}
                type="button"
              >
                Share profile <Share className="h-4 w-4" />
              </button>
              <button
                className="clickable verity-pill flex h-10 items-center justify-center gap-2 bg-inverse px-4 text-sm font-semibold tracking-[-0.18px] text-inverse-text hover:opacity-90"
                onClick={() => router.push('/profile/edit')}
                type="button"
              >
                Edit profile <Edit3 className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div className="mt-3">
            <div className="flex items-center gap-2">
              <h1 className="text-[28px] font-semibold leading-[1.1] tracking-[-0.7px] text-midnight">
                {isConnected ? displayName(profile) : 'Connect wallet'}
              </h1>
            </div>
            <p className="mt-1 font-mono text-sm text-ash">
              {isConnected ? displayHandle(profile) : '@wallet'}
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
                onClick={() => setPeopleModal('following')}
                type="button"
              >
                <strong className="font-semibold text-midnight">
                  {(profile?.followingCount || 0).toLocaleString()}
                </strong>{' '}
                Following
              </button>
              <button
                className="hover:text-ember-orange"
                onClick={() => setPeopleModal('followers')}
                type="button"
              >
                <strong className="font-semibold text-midnight">
                  {(profile?.followersCount || 0).toLocaleString()}
                </strong>{' '}
                Followers
              </button>
              <span className="font-mono text-xs text-ash">
                {localProfileItems.length} posts
              </span>
              <span className="font-mono text-xs text-ash">
                {marketItems.length} markets
              </span>
            </div>
          </div>
        </div>

        <ProfileTabs activeTab={activeTab} onChange={setActiveTab} />
      </section>

      {profile && (
        <ProfileActivityTabs
          activeTab={activeTab}
          items={tabItems}
          loading={isActivityLoading}
          onOpenMarket={(market) => router.push(`/markets/${market.id}`)}
          onOpenPost={(post) => router.push(`/posts/${post.id}`)}
          profile={profile}
        />
      )}

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

function ProfileAvatar({ profile }: { profile: Profile | null }) {
  const avatarUrl = profile?.avatar_url || profile?.avatarUrl

  if (avatarUrl) {
    return (
      <div
        className="h-20 w-20 shrink-0 rounded-[24px] bg-cover bg-center ring-4 ring-white shadow-[(--shadow-subtle)] sm:h-24 sm:w-24 sm:rounded-[28px]"
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
          className={`relative h-12 rounded-[10px] text-[13px] sm:text-sm font-semibold tracking-[-0.18px] ${
            activeTab === tab.id
              ? 'text-charcoal-primary'
              : 'clickable-tab text-ash'
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
