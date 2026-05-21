'use client'

import { Heart, MessageCircle, Repeat2, Share } from 'lucide-react'

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
  avatarColor?: string
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
  avatarColor = 'bg-zinc-800',
}: PostCardProps) {
  return (
    <article className="flex cursor-pointer gap-4 rounded-[18px] border border-[(--border)] bg-[(--surface)] p-5 shadow-sm transition-colors hover:bg-[(--surface-solid)]">
      <div className="shrink-0">
        <div className={`h-10 w-10 rounded-full ${avatarColor}`} />
      </div>

      <div className="min-w-0 flex-1">
        <div className="mb-1 flex items-center gap-1.5 text-sm">
          <span className="truncate font-black text-[(--foreground)] hover:underline">
            {name}
          </span>
          <span className="truncate font-mono text-xs text-[(--muted)]">
            {handle}
          </span>
          <span className="text-[(--muted)]">{'\u00B7'}</span>
          <span className="font-mono text-xs text-[(--muted)] hover:underline">
            {time}
          </span>
        </div>

        <p className="mb-4 whitespace-pre-wrap text-[15px] leading-relaxed text-[(--foreground)]">
          {content}
        </p>

        <div className="flex max-w-[360px] items-center justify-between border-t border-dashed border-[(--border)] pt-2 text-[(--muted)]">
          <button
            aria-label="Comment"
            className="group flex items-center gap-2 transition-colors hover:text-[(--foreground)]"
            onClick={onComment}
            type="button"
          >
            <span className="rounded-full p-2 transition-colors group-hover:bg-[(--surface-hover)]">
              <MessageCircle className="h-4 w-4" />
            </span>
            <span className="text-xs">{comments}</span>
          </button>

          <button
            aria-label="Reshare"
            aria-pressed={reshared}
            className={`group flex items-center gap-2 transition-colors hover:text-[(--foreground)] ${reshared ? 'text-[(--color-brand-secondary)]' : ''}`}
            onClick={onReshare}
            type="button"
          >
            <span className="rounded-full p-2 transition-colors group-hover:bg-[(--surface-hover)]">
              <Repeat2 className="h-4 w-4" />
            </span>
            <span className="text-xs">{reshares}</span>
          </button>

          <button
            aria-label="Like"
            aria-pressed={liked}
            className={`group flex items-center gap-2 transition-colors hover:text-[(--color-brand-accent)] ${liked ? 'text-[(--color-brand-accent)]' : ''}`}
            onClick={onLike}
            type="button"
          >
            <span className="rounded-full p-2 transition-colors group-hover:bg-[(--color-brand-accent)]/10">
              <Heart className={`h-4 w-4 ${liked ? 'fill-current' : ''}`} />
            </span>
            <span className="text-xs">{likes}</span>
          </button>

          <button
            aria-label="Share"
            className="group flex items-center gap-2 transition-colors hover:text-[(--foreground)]"
            onClick={onShare}
            type="button"
          >
            <span className="rounded-full p-2 transition-colors group-hover:bg-[(--surface-hover)]">
              <Share className="h-4 w-4" />
            </span>
          </button>
        </div>
      </div>
    </article>
  )
}
