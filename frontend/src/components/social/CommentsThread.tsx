'use client'

import { MessageCircle, Send, Loader2 } from 'lucide-react'
import { useMemo, useState } from 'react'
import { displayHandle, displayName, relativeTime, type MarketComment } from '@/lib/verity'
import { useWalletProfile } from '@/hooks/useWalletProfile'
import { useAddCommentMutation } from '@/store/verity/verityQueries'
import { toast } from 'react-hot-toast'
import CommentModal from '@/components/social/CommentModal'

interface CommentsThreadProps {
  postId: string
  comments: MarketComment[]
  loading?: boolean
  title?: string
}

type CommentSort = 'relevant' | 'newest'

export default function CommentsThread({
  postId,
  comments,
  loading = false,
  title = 'Comments',
}: CommentsThreadProps) {
  const [sort, setSort] = useState<CommentSort>('relevant')
  const [draft, setDraft] = useState('')
  const [replyingToComment, setReplyingToComment] = useState<MarketComment | null>(null)
  const { profile } = useWalletProfile()
  const { mutateAsync: addComment, isPending: isSubmitting } = useAddCommentMutation()

  // Group comments: find all root comments, and map child comments to their parentId
  const commentsTree = useMemo(() => {
    const rootComments: MarketComment[] = []
    const childrenMap = new Map<string, MarketComment[]>()

    comments.forEach((c) => {
      if (c.parentId || c.parent_id) {
        const pId = c.parentId || c.parent_id
        const list = childrenMap.get(pId!) || []
        list.push(c)
        childrenMap.set(pId!, list)
      } else {
        rootComments.push(c)
      }
    });

    // Sort roots based on the selected sort criteria
    if (sort === 'newest') {
      rootComments.sort(
        (a, b) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
      )
    } else {
      rootComments.sort((a, b) => b.content.length - a.content.length)
    }

    return { rootComments, childrenMap }
  }, [comments, sort])

  const handleSend = async () => {
    if (!profile) {
      toast.error('Connect your wallet to comment.')
      return
    }
    const content = draft.trim()
    if (!content) return

    try {
      await addComment({
        postId,
        authorId: profile.id,
        content,
      })
      setDraft('')
      toast.success('Comment added successfully!')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to add comment.')
    }
  }

  return (
    <section className="verity-card overflow-hidden">
      <div className="flex items-center justify-between gap-3 border-b border-dashed border-stone-surface p-5">
        <h2 className="flex items-center gap-2 text-[23px] font-semibold leading-[1.2] tracking-[-0.44px] text-charcoal-primary">
          <MessageCircle className="h-5 w-5 text-sky-blue" />
          {title}
        </h2>
        <div className="grid grid-cols-2 rounded-[32px] bg-parchment-card p-1 shadow-[var(--shadow-subtle)]">
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
        <div className="flex gap-3 rounded-[12px] bg-parchment-card p-3 shadow-[var(--shadow-subtle)]">
          <input
            className="min-w-0 flex-1 bg-transparent text-sm tracking-[-0.18px] text-charcoal-primary outline-none placeholder:text-ash"
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && draft.trim() && !isSubmitting) {
                void handleSend()
              }
            }}
            placeholder="Write a comment..."
            disabled={isSubmitting}
            value={draft}
          />
          <button
            aria-label="Send comment"
            className="flex h-9 w-9 items-center justify-center rounded-full bg-midnight text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
            disabled={!draft.trim() || isSubmitting}
            onClick={handleSend}
            type="button"
          >
            {isSubmitting ? (
              <Loader2 className="h-4 w-4 animate-spin text-white" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </button>
        </div>
      </div>

      {loading ? (
        <CommentsSkeleton />
      ) : commentsTree.rootComments.length > 0 ? (
        <div className="flex flex-col">
          {commentsTree.rootComments.map((comment) => {
            const replies = commentsTree.childrenMap.get(comment.id) || []
            const sortedReplies = replies.sort(
              (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
            )

            return (
              <div key={comment.id} className="border-b border-dashed border-stone-surface last:border-b-0">
                <CommentRow comment={comment} onReplyClick={() => setReplyingToComment(comment)} />
                {sortedReplies.length > 0 && (
                  <div className="bg-parchment-card/30 pl-12 pr-4 pb-3 flex flex-col gap-2 border-t border-dashed border-stone-surface/30">
                    {sortedReplies.map((reply) => (
                      <CommentRow 
                        key={reply.id} 
                        comment={reply} 
                        isReply 
                        onReplyClick={() => setReplyingToComment(reply)} 
                      />
                    ))}
                  </div>
                )}
              </div>
            )
          })}
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
            Start the discussion.
          </p>
        </div>
      )}

      <CommentModal
        replyToComment={replyingToComment}
        isOpen={Boolean(replyingToComment)}
        onClose={() => setReplyingToComment(null)}
      />
    </section>
  )
}

function CommentRow({
  comment,
  isReply = false,
  onReplyClick,
}: {
  comment: MarketComment
  isReply?: boolean
  onReplyClick: () => void
}) {
  const avatarUrl = comment.author?.avatar_url || comment.author?.avatarUrl
  return (
    <article className={`flex gap-3 p-4 ${isReply ? 'pt-2 pb-2' : ''}`}>
      {avatarUrl ? (
        <span
          className={`rounded-[10px] bg-cover bg-center shadow-[var(--shadow-subtle)] shrink-0 ${isReply ? 'h-7 w-7' : 'h-10 w-10'}`}
          style={{ backgroundImage: `url(${avatarUrl})` }}
        />
      ) : (
        <div className={`verity-blob shrink-0 bg-sky-blue ${isReply ? 'h-7 w-7' : 'h-10 w-10'}`}>
          <span className="verity-blob-smile" />
        </div>
      )}
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
        <p className={`mt-1 whitespace-pre-wrap leading-[1.47] tracking-[-0.2px] text-graphite ${isReply ? 'text-sm' : 'text-[15px]'}`}>
          {comment.content}
        </p>
        <div className="mt-2 flex gap-4 font-mono text-[11px] text-ash">
          <button 
            className="hover:text-charcoal-primary font-semibold" 
            onClick={onReplyClick}
            type="button"
          >
            Reply
          </button>
        </div>
      </div>
    </article>
  )
}

export function CommentsSkeleton() {
  return (
    <div className="flex flex-col animate-pulse">
      {[1, 2, 3].map((i) => (
        <div key={i} className="flex gap-3 p-4 border-b border-dashed border-stone-surface">
          <div className="h-8 w-8 shrink-0 rounded-full bg-stone-surface" />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 mb-1.5">
              <div className="h-3.5 w-20 rounded bg-stone-surface" />
              <div className="h-3 w-12 rounded bg-stone-surface" />
            </div>
            <div className="space-y-1.5">
              <div className="h-3 w-full rounded bg-stone-surface" />
              <div className="h-3 w-5/6 rounded bg-stone-surface" />
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
