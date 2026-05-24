'use client'

import Link from 'next/link'
import { type ReactNode } from 'react'
import FollowButton from '@/components/profile/FollowButton'
import { displayHandle, displayName, type Profile } from '@/lib/verity'

interface UserHoverCardProps {
  profile?: Profile | null
  href?: string
  children: ReactNode
}

export default function UserHoverCard({
  profile,
  href,
  children,
}: UserHoverCardProps) {
  if (!profile) return <>{children}</>

  const profileHref = href || `/profile/${encodeURIComponent(profile.id)}`
  const accuracy =
    profile.freeVotesTotal && profile.freeVotesTotal > 0
      ? Math.round(((profile.freeVotesCorrect || 0) / profile.freeVotesTotal) * 100)
      : 0

  return (
    <span className="group/user-card relative inline-flex min-w-0">
      {children}
      <span className="pointer-events-none absolute left-0 top-full z-40 hidden w-[min(320px,calc(100vw-2rem))] pt-2 group-hover/user-card:block group-focus-within/user-card:block">
        <span className="pointer-events-auto block rounded-[14px] bg-white p-4 shadow-[var(--shadow-sm)]">
          <span className="mb-3 flex items-start justify-between gap-3">
            <Link
              className="flex min-w-0 items-center gap-3"
              href={profileHref}
            >
              <ProfileAvatar profile={profile} />
              <span className="min-w-0">
                <span className="block truncate text-sm font-semibold tracking-[-0.18px] text-charcoal-primary">
                  {displayName(profile)}
                </span>
                <span className="mt-1 block truncate font-mono text-xs text-ash">
                  {displayHandle(profile)}
                </span>
              </span>
            </Link>
            <FollowButton compact profile={profile} />
          </span>

          {profile.bio && (
            <span className="mb-3 line-clamp-2 block text-sm leading-[1.4] tracking-[-0.18px] text-graphite">
              {profile.bio}
            </span>
          )}

          <span className="grid grid-cols-3 gap-2">
            <HoverStat label="Followers" value={(profile.followersCount || 0).toLocaleString()} />
            <HoverStat label="Markets" value={(profile.freeVotesTotal || 0).toLocaleString()} />
            <HoverStat label="Accuracy" value={`${accuracy}%`} />
          </span>
        </span>
      </span>
    </span>
  )
}

function HoverStat({ label, value }: { label: string; value: string }) {
  return (
    <span className="rounded-[10px] bg-parchment-card p-2 shadow-[var(--shadow-subtle)]">
      <span className="block font-mono text-sm font-semibold text-charcoal-primary">
        {value}
      </span>
      <span className="block font-mono text-[9px] uppercase tracking-[0.12em] text-ash">
        {label}
      </span>
    </span>
  )
}

function ProfileAvatar({ profile }: { profile: Profile }) {
  const avatarUrl = profile.avatar_url || profile.avatarUrl

  if (avatarUrl) {
    return (
      <span
        className="h-12 w-12 shrink-0 rounded-[16px] bg-cover bg-center shadow-[var(--shadow-subtle)]"
        style={{ backgroundImage: `url(${avatarUrl})` }}
      />
    )
  }

  return (
    <span className="verity-blob h-12 w-12 shrink-0 bg-sky-blue">
      <span className="verity-blob-smile" />
    </span>
  )
}
