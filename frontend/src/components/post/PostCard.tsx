"use client"

import Link from "next/link"
import UserHoverCard from "@/components/social/UserHoverCard"
import { Heart, MessageCircle, Repeat2, Share } from "lucide-react"
import type { Profile } from "@/lib/verity"

export interface PostCardProps {
  name: string
  handle: string
  time: string
  content: string
  likes: number
  comments: number
  reshares: number
  liked?: boolean
  reshared?: boolean
  onComment?: () => void
  onLike?: () => void
  onReshare?: () => void
  onShare?: () => void
  onOpenDetails?: () => void
  avatarColor?: string
  profileHref?: string
  profile?: Profile
}

export default function PostCard({
  name,
  handle,
  time,
  content,
  likes,
  comments,
  reshares,
  liked = false,
  reshared = false,
  onComment,
  onLike,
  onReshare,
  onShare,
  onOpenDetails,
  avatarColor = "bg-sunburst-yellow",
  profileHref,
  profile,
}: PostCardProps) {
  return (
    <article
      className="clickable-card verity-card flex gap-3 p-4 sm:gap-4 sm:p-5"
      onClick={onOpenDetails}
      onKeyDown={(event) => {
        if (onOpenDetails && (event.key === "Enter" || event.key === " ")) {
          event.preventDefault()
          onOpenDetails()
        }
      }}
      role={onOpenDetails ? "link" : undefined}
      tabIndex={onOpenDetails ? 0 : undefined}
    >
      <div className="shrink-0">
        {profileHref ? (
          <UserHoverCard href={profileHref} profile={profile}>
            <Link
              className={`clickable verity-blob h-10 w-10 ${avatarColor}`}
              href={profileHref}
              onClick={(event) => event.stopPropagation()}
            >
              <span className="verity-blob-smile" />
            </Link>
          </UserHoverCard>
        ) : (
          <div className={`verity-blob h-10 w-10 ${avatarColor}`}>
            <span className="verity-blob-smile" />
          </div>
        )}
      </div>

      <div className="min-w-0 flex-1">
        <div className="mb-1 flex items-center gap-1.5 text-sm">
          {profileHref ? (
            <UserHoverCard href={profileHref} profile={profile}>
              <Link
                className="clickable-link truncate font-semibold tracking-[-0.18px] text-charcoal-primary"
                href={profileHref}
                onClick={(event) => event.stopPropagation()}
              >
                {name}
              </Link>
            </UserHoverCard>
          ) : (
            <span className="truncate font-semibold tracking-[-0.18px] text-charcoal-primary hover:underline">
              {name}
            </span>
          )}
          {profileHref ? (
            <Link
              className="clickable-link truncate font-mono text-xs text-ash"
              href={profileHref}
              onClick={(event) => event.stopPropagation()}
            >
              {handle}
            </Link>
          ) : (
            <span className="truncate font-mono text-xs text-ash">
              {handle}
            </span>
          )}
          <span className="text-ash">{"\u00B7"}</span>
          <span className="font-mono text-xs text-ash hover:underline">
            {time}
          </span>
        </div>

        <p className="mb-4 whitespace-pre-wrap text-[15px] leading-[1.47] tracking-[-0.2px] text-graphite">
          {content}
        </p>

        <div
          className="flex max-w-full items-center justify-between border-t border-dashed border-stone-surface pt-2 text-ash sm:max-w-[360px]"
          onClick={(event) => event.stopPropagation()}
        >
          <button
            aria-label="Comment"
            className="clickable-icon group flex items-center gap-2 px-1 text-ash hover:text-foreground"
            onClick={onComment}
            type="button"
          >
            <span className="rounded-full p-2">
              <MessageCircle className="h-4 w-4" />
            </span>
            <span className="text-xs">{comments}</span>
          </button>

          <button
            aria-label="Reshare"
            aria-pressed={reshared}
            className={`clickable-icon group flex items-center gap-2 px-1 hover:text-foreground ${reshared ? "text-meadow-green" : "text-ash"}`}
            onClick={onReshare}
            type="button"
          >
            <span className="rounded-full p-2">
              <Repeat2 className="h-4 w-4" />
            </span>
            <span className="text-xs">{reshares}</span>
          </button>

          <button
            aria-label="Like"
            aria-pressed={liked}
            className={`clickable-icon group flex items-center gap-2 px-1 hover:text-ember-orange ${liked ? "text-ember-orange" : "text-ash"}`}
            onClick={onLike}
            type="button"
          >
            <span className="rounded-full p-2">
              <Heart className={`h-4 w-4 ${liked ? "fill-current" : ""}`} />
            </span>
            <span className="text-xs">{likes}</span>
          </button>

          <button
            aria-label="Share"
            className="clickable-icon group flex items-center gap-2 px-1 text-ash hover:text-foreground"
            onClick={onShare}
            type="button"
          >
            <span className="rounded-full p-2">
              <Share className="h-4 w-4" />
            </span>
          </button>
        </div>
      </div>
    </article>
  )
}
