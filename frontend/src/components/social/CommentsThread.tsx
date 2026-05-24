'use client'

import { MessageCircle, Send } from 'lucide-react'
import { useMemo, useState } from 'react'
import { displayHandle, displayName, relativeTime, type MarketComment } from '@/lib/verity'

interface CommentsThreadProps {
  comments: MarketComment[]
  loading?: boolean
  title?: string
}

type CommentSort = 'relevant' | 'newest'

export default function CommentsThread({
  comments,
  loading = false,
  title = 'Comments',
}: CommentsThreadProps) {
  const [sort, setSort] = useState<CommentSort>('relevant')
  const [draft, setDraft] = useState('')
  const sortedComments = useMemo(() => {
    const copy = [...comments]
    if (sort === 'newest') {
      return copy.sort(
        (a, b) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
      )
    }
    return copy.sort((a, b) => b.content.length - a.content.length)
  }, [comments, sort])

  return (
    <section className="verity-card overflow-hidden">
      <div className="flex flex-col gap-3 border-b border-dashed border-stone-surface p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
        <h2 className="flex items-center gap-2 text-[23px] font-semibold leading-[1.2] tracking-[-0.44px] text-charcoal-primary">
          <MessageCircle className="h-5 w-5 text-sky-blue" />
          {title}
        </h2>
        <div className="grid w-full grid-cols-2 rounded-[32px] bg-parchment-card p-1 shadow-[var(--shadow-subtle)] sm:w-auto">
          {(['relevant', 'newest'] as const).map((nextSort) => (
            <button
              className={`verity-pill h-8 px-3 text-xs font-semibold capitalize tracking-[-0.14px] transition-colors ${
                sort === nextSort
                  ? 'bg-white text-charcoal-primary shadow-[var(--shadow-subtle)]'
                  : 'text-ash hover:text-charcoal-primary'
              }`}
              key={nextSort}
              onClick={() => setSort(nextSort)}
              type="button"
            >
              {nextSort}
            </button>
          ))}
        </div>
      </div>

      <div className="border-b border-dashed border-stone-surface p-4">
        <div className="flex gap-2 rounded-[12px] bg-parchment-card p-3 shadow-[var(--shadow-subtle)] sm:gap-3">
          <input
            className="min-w-0 flex-1 bg-transparent text-sm tracking-[-0.18px] text-charcoal-primary outline-none placeholder:text-ash"
            onChange={(event) => setDraft(event.target.value)}
            placeholder="Write a comment..."
            value={draft}
          />
          <button
            aria-label="Send comment"
            className="flex h-9 w-9 items-center justify-center rounded-full bg-midnight text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
            disabled={!draft.trim()}
            type="button"
          >
            <Send className="h-4 w-4" />
          </button>
        </div>
      </div>

      {loading ? (
        <div className="p-6 text-center text-sm text-ash">Loading comments...</div>
      ) : sortedComments.length > 0 ? (
        <div className="flex flex-col">
          {sortedComments.map((comment) => (
            <CommentRow comment={comment} key={comment.id} />
          ))}
        </div>
      ) : (
        <div className="p-8 text-center">
          <div className="verity-blob mx-auto h-14 w-14 bg-sunburst-yellow">
            <span className="verity-blob-smile" />
          </div>
          <p className="mt-3 text-sm font-medium tracking-[-0.18px] text-charcoal-primary">
            No comments yet.
          </p>
          <p className="mt-1 text-sm tracking-[-0.18px] text-ash">
            Start the discussion when the backend endpoint is ready.
          </p>
        </div>
      )}
    </section>
  )
}

function CommentRow({ comment }: { comment: MarketComment }) {
  return (
    <article className="flex gap-3 border-b border-dashed border-stone-surface p-4 last:border-b-0">
      <div className="verity-blob h-10 w-10 shrink-0 bg-sky-blue">
        <span className="verity-blob-smile" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-1.5 text-sm">
          <span className="font-semibold tracking-[-0.18px] text-charcoal-primary">
            {displayName(comment.author)}
          </span>
          <span className="font-mono text-xs text-ash">
            {displayHandle(comment.author)}
          </span>
          <span className="text-ash">{'\u00B7'}</span>
          <span className="font-mono text-xs text-ash">
            {relativeTime(comment.created_at)}
          </span>
        </div>
        <p className="mt-1 whitespace-pre-wrap text-[15px] leading-[1.47] tracking-[-0.2px] text-graphite">
          {comment.content}
        </p>
        <div className="mt-2 flex gap-4 font-mono text-[11px] text-ash">
          <button className="hover:text-charcoal-primary" type="button">
            Reply
          </button>
          <button className="hover:text-ember-orange" type="button">
            Like
          </button>
        </div>
      </div>
    </article>
  )
}
