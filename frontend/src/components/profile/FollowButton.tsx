'use client'

import Link from 'next/link'
import { Check, UserPlus } from 'lucide-react'
import { useState, useEffect } from 'react'
import { useWalletProfile } from '@/hooks/useWalletProfile'
import type { Profile } from '@/lib/verity'
import {
  useIsFollowingQuery,
  useFollowUserMutation,
  useUnfollowUserMutation,
} from '@/store/verity/verityQueries'
import toast from 'react-hot-toast'

interface FollowButtonProps {
  profile: Profile
  initialFollowing?: boolean
  followerCount?: number
  compact?: boolean
}

export default function FollowButton({
  profile,
  initialFollowing = false,
  followerCount,
  compact = false,
}: FollowButtonProps) {
  const { profile: viewerProfile } = useWalletProfile()
  const isOwnProfile = Boolean(
    viewerProfile?.id && viewerProfile.id === profile.id,
  )

  const { data: followStatus, refetch: refetchStatus } = useIsFollowingQuery(
    profile.id,
    viewerProfile?.id || '',
  )
  const { mutateAsync: followUser } = useFollowUserMutation()
  const { mutateAsync: unfollowUser } = useUnfollowUserMutation()

  const [localDelta, setLocalDelta] = useState(0)
  const following = followStatus ? followStatus.following : initialFollowing
  const count = Math.max(
    0,
    (followerCount ?? profile.followersCount ?? 0) + localDelta,
  )

  // Reset localDelta when following status updates from backend query
  useEffect(() => {
    setLocalDelta(0)
  }, [following])

  if (isOwnProfile) {
    return (
      <Link
        className="clickable verity-pill inline-flex h-10 items-center justify-center bg-parchment-card px-4 text-sm font-semibold tracking-[-0.18px] text-charcoal-primary shadow-[(--shadow-subtle)] hover:bg-stone-surface"
        href="/profile"
      >
        Edit Profile
      </Link>
    )
  }

  return (
    <div className="flex items-center gap-2">
      <button
        aria-pressed={following}
        className={`clickable verity-pill inline-flex h-10 items-center justify-center gap-2 px-4 text-sm font-semibold tracking-[-0.18px] ${
          following
            ? 'bg-parchment-card text-charcoal-primary shadow-[(--shadow-subtle)] hover:bg-stone-surface'
            : 'bg-inverse text-inverse-text hover:opacity-90'
        }`}
        onClick={async () => {
          if (!viewerProfile) {
            toast.error('Connect your wallet to follow users.')
            return
          }
          try {
            if (following) {
              setLocalDelta(-1)
              await unfollowUser(profile.id)
            } else {
              setLocalDelta(1)
              await followUser(profile.id)
            }
            await refetchStatus()
          } catch (err) {
            setLocalDelta(0)
            toast.error('Failed to update follow status.')
          }
        }}
        type="button"
      >
        {following ? (
          <Check className="h-4 w-4" />
        ) : (
          <UserPlus className="h-4 w-4" />
        )}
        {following ? 'Following' : 'Follow'}
      </button>
      {!compact && (
        <span className="font-mono text-[11px] text-ash">
          {count.toLocaleString()} followers
        </span>
      )}
    </div>
  )
}
