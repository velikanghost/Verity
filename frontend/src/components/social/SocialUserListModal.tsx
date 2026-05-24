'use client'

import Link from 'next/link'
import { Search, X } from 'lucide-react'
import { useMemo, useState } from 'react'
import FollowButton from '@/components/profile/FollowButton'
import { displayHandle, displayName, type Profile } from '@/lib/verity'

interface SocialUserListModalProps {
  open: boolean
  title: string
  subtitle?: string
  users: Profile[]
  onClose: () => void
}

export default function SocialUserListModal({
  open,
  title,
  subtitle,
  users,
  onClose,
}: SocialUserListModalProps) {
  const [query, setQuery] = useState('')
  const filteredUsers = useMemo(() => {
    const normalized = query.trim().toLowerCase()
    if (!normalized) return users

    return users.filter((user) => {
      return (
        displayName(user).toLowerCase().includes(normalized) ||
        displayHandle(user).toLowerCase().includes(normalized) ||
        (user.bio || '').toLowerCase().includes(normalized)
      )
    })
  }, [query, users])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-midnight/35 px-2 py-2 backdrop-blur-sm sm:items-center sm:px-4 sm:py-6">
      <section className="verity-card flex max-h-[88dvh] w-full max-w-[520px] flex-col overflow-hidden">
        <div className="flex items-start justify-between gap-4 border-b border-dashed border-stone-surface p-4 sm:p-5">
          <div>
            <h2 className="text-[23px] font-semibold leading-[1.2] tracking-[-0.44px] text-charcoal-primary">
              {title}
            </h2>
            {subtitle && (
              <p className="mt-1 text-sm tracking-[-0.18px] text-ash">
                {subtitle}
              </p>
            )}
          </div>
          <button
            aria-label="Close"
            className="flex h-9 w-9 items-center justify-center rounded-full bg-parchment-card text-charcoal-primary shadow-[var(--shadow-subtle)] transition-colors hover:bg-stone-surface"
            onClick={onClose}
            type="button"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="border-b border-dashed border-stone-surface p-4">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ash" />
            <input
              className="h-11 w-full rounded-[32px] bg-parchment-card pl-10 pr-4 text-sm tracking-[-0.18px] text-charcoal-primary shadow-[var(--shadow-subtle)] outline-none placeholder:text-ash focus:ring-2 focus:ring-stone-surface"
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search people"
              value={query}
            />
          </div>
        </div>

        <div className="min-h-0 overflow-y-auto">
          {filteredUsers.length > 0 ? (
            filteredUsers.map((user) => (
              <UserListRow key={user.id} user={user} onClose={onClose} />
            ))
          ) : (
            <div className="p-8 text-center text-sm tracking-[-0.18px] text-ash">
              No people match that search.
            </div>
          )}
        </div>
      </section>
    </div>
  )
}

function UserListRow({
  user,
  onClose,
}: {
  user: Profile
  onClose: () => void
}) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-dashed border-stone-surface p-4 last:border-b-0">
      <Link
        className="flex min-w-0 flex-1 items-center gap-3"
        href={`/profile/${encodeURIComponent(user.id)}`}
        onClick={onClose}
      >
        <ProfileAvatar profile={user} />
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold tracking-[-0.18px] text-charcoal-primary hover:underline">
            {displayName(user)}
          </p>
          <p className="mt-1 truncate font-mono text-xs text-ash">
            {displayHandle(user)}
          </p>
          {user.bio && (
            <p className="mt-1 line-clamp-1 text-xs tracking-[-0.14px] text-graphite">
              {user.bio}
            </p>
          )}
        </div>
      </Link>
      <FollowButton compact profile={user} />
    </div>
  )
}

function ProfileAvatar({ profile }: { profile: Profile }) {
  const avatarUrl = profile.avatar_url || profile.avatarUrl

  if (avatarUrl) {
    return (
      <span
        className="h-11 w-11 shrink-0 rounded-[16px] bg-cover bg-center shadow-[var(--shadow-subtle)]"
        style={{ backgroundImage: `url(${avatarUrl})` }}
      />
    )
  }

  return (
    <span className="verity-blob h-11 w-11 shrink-0 bg-sky-blue">
      <span className="verity-blob-smile" />
    </span>
  )
}
