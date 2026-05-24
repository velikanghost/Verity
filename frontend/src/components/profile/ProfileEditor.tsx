'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { BadgeCheck, Edit3, Save, Share } from 'lucide-react'
import ProfileActivityTabs, {
  type ProfileActivityTab,
} from '@/components/social/ProfileActivityTabs'
import SocialUserListModal from '@/components/social/SocialUserListModal'
import { useFeed } from '@/hooks/useFeed'
import { useWalletProfile } from '@/hooks/useWalletProfile'
import {
  displayHandle,
  displayName,
  type Profile,
} from '@/lib/verity'
import { useUpdateProfileMutation } from '@/store/verity/verityQueries'

export default function ProfileEditor() {
  const router = useRouter()
  const { profile, isLoading } = useWalletProfile()
  const { items } = useFeed(profile?.id)
  const [editing, setEditing] = useState(false)
  const [activeTab, setActiveTab] = useState<ProfileActivityTab>('posts')
  const [peopleModal, setPeopleModal] = useState<'followers' | 'following' | null>(null)
  const isConnected = Boolean(profile)
  const profileItems = useMemo(
    () => (profile ? items.filter((item) => item.author.id === profile.id) : []),
    [items, profile],
  )
  const marketItems = profileItems.filter((item) => item.market)
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
              <button
                className="verity-pill flex h-10 items-center justify-center gap-2 bg-brand-primary px-3 text-sm font-semibold tracking-[-0.18px] text-white shadow-[var(--shadow-sm)] transition-opacity hover:opacity-90 sm:px-4"
                onClick={() => setEditing((current) => !current)}
                type="button"
              >
                {editing ? 'Close editor' : 'Edit profile'} <Edit3 className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div className="mt-3">
            <div className="flex items-center gap-2">
              <h1 className="text-[28px] font-semibold leading-[1.1] tracking-[-0.7px] text-midnight">
                {isConnected ? displayName(profile) : 'Connect wallet'}
              </h1>
              {profile && <BadgeCheck className="h-5 w-5 text-sky-blue" />}
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
                {profileItems.length} posts
              </span>
              <span className="font-mono text-xs text-ash">
                {marketItems.length} markets
              </span>
            </div>
          </div>
        </div>

        <ProfileTabs activeTab={activeTab} onChange={setActiveTab} />
      </section>

      {editing && (
        <section className="verity-card p-4 sm:p-5">
          <ProfileForm
            error={null}
            key={profile?.id || 'empty'}
            loading={isLoading}
            profile={profile}
          />
        </section>
      )}

      {profile && (
        <ProfileActivityTabs
          activeTab={activeTab}
          items={profileItems}
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
  ]

  return (
    <div className="grid grid-cols-4 border-t border-dashed border-stone-surface px-1 sm:px-2">
      {tabs.map((tab) => (
        <button
          className={`relative h-12 text-xs font-semibold tracking-[-0.14px] transition-colors sm:text-sm sm:tracking-[-0.18px] ${
            activeTab === tab.id ? 'text-charcoal-primary' : 'text-ash hover:text-charcoal-primary'
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

function ProfileForm({
  profile,
  loading,
  error,
}: {
  profile: Profile | null
  loading: boolean
  error: string | null
}) {
  const [username, setUsername] = useState(profile?.username || '')
  const [display, setDisplay] = useState(profile?.display_name || '')
  const [avatar, setAvatar] = useState(profile?.avatar_url || '')
  const [bio, setBio] = useState(profile?.bio || '')
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const { mutateAsync: updateProfile } = useUpdateProfileMutation()

  async function save() {
    if (!profile) return

    setSaving(true)
    setMessage(null)

    try {
      await updateProfile({
        profileId: profile.id,
        input: {
          username: username.trim(),
          display_name: display.trim() || null,
          avatar_url: avatar.trim() || null,
          bio: bio.trim() || null,
        },
      })
      setMessage('Profile saved.')
    } catch (caught) {
      setMessage(
        caught instanceof Error ? caught.message : 'Unable to save profile.',
      )
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <div className="mt-5 grid gap-3">
        <input
          className="h-11 rounded-[10px] bg-white-surface px-3 text-sm tracking-[-0.18px] text-charcoal-primary shadow-[var(--shadow-subtle)] outline-none placeholder:text-ash focus:ring-2 focus:ring-stone-surface"
          disabled={!profile || saving}
          onChange={(event) => setUsername(event.target.value)}
          placeholder="username"
          value={username}
        />
        <input
          className="h-11 rounded-[10px] bg-white-surface px-3 text-sm tracking-[-0.18px] text-charcoal-primary shadow-[var(--shadow-subtle)] outline-none placeholder:text-ash focus:ring-2 focus:ring-stone-surface"
          disabled={!profile || saving}
          onChange={(event) => setDisplay(event.target.value)}
          placeholder="Display name"
          value={display}
        />
        <input
          className="h-11 rounded-[10px] bg-white-surface px-3 text-sm tracking-[-0.18px] text-charcoal-primary shadow-[var(--shadow-subtle)] outline-none placeholder:text-ash focus:ring-2 focus:ring-stone-surface"
          disabled={!profile || saving}
          onChange={(event) => setAvatar(event.target.value)}
          placeholder="Avatar URL"
          value={avatar}
        />
        <textarea
          className="min-h-24 rounded-[10px] bg-white-surface p-3 text-sm tracking-[-0.18px] text-charcoal-primary shadow-[var(--shadow-subtle)] outline-none placeholder:text-ash focus:ring-2 focus:ring-stone-surface"
          disabled={!profile || saving}
          onChange={(event) => setBio(event.target.value)}
          placeholder="Bio"
          value={bio}
        />
      </div>

      {(message || error || loading) && (
        <p className="mt-3 text-sm text-ash">
          {loading ? 'Loading profile...' : message || error}
        </p>
      )}

      <button
        className="verity-pill mt-4 flex h-11 w-full items-center justify-center gap-2 bg-inverse text-sm font-semibold tracking-[-0.18px] text-inverse-text transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
        disabled={!profile || saving}
        onClick={save}
        type="button"
      >
        {saving ? 'Saving' : 'Save Profile'} <Save className="h-4 w-4" />
      </button>
    </>
  )
}
