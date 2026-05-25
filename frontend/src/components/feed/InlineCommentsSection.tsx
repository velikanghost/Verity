"use client";

import React, { useState } from "react";
import Link from "next/link";
import { Send, Loader2 } from "lucide-react";
import { usePostCommentsQuery, useAddCommentMutation } from "@/store/verity/verityQueries";
import { displayName, displayHandle, relativeTime, type Profile } from "@/lib/verity";
import toast from "react-hot-toast";

interface InlineCommentsSectionProps {
  postId: string;
  profile: Profile | null;
}

export default function InlineCommentsSection({ postId, profile }: InlineCommentsSectionProps) {
  const { data: comments, isLoading } = usePostCommentsQuery(postId);
  const { mutateAsync: addComment, isPending: isSubmitting } = useAddCommentMutation();
  const [commentText, setCommentText] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) {
      toast.error("Connect a wallet to leave a comment.");
      return;
    }
    const text = commentText.trim();
    if (!text) return;

    try {
      await addComment({
        postId,
        authorId: profile.id,
        content: text,
      });
      setCommentText("");
      toast.success("Comment posted!");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to post comment.");
    }
  };

  return (
    <div className="mt-4 border-t border-dashed border-stone-surface pt-4">
      {/* Comments List */}
      <div className="max-h-60 overflow-y-auto space-y-3 mb-4 pr-1 scrollbar-thin">
        {isLoading ? (
          <div className="flex items-center justify-center py-4 text-xs text-ash">
            <Loader2 className="h-4 w-4 animate-spin mr-2" />
            Loading comments...
          </div>
        ) : comments && comments.length > 0 ? (
          comments.map((comment) => (
            <div key={comment.id} className="flex gap-3 text-sm">
              <Link
                href={`/profile/${encodeURIComponent(comment.author.id)}`}
                className="verity-blob h-8 w-8 bg-sky-blue shrink-0"
              >
                <span className="verity-blob-smile scale-75" />
              </Link>
              <div className="min-w-0 flex-1 bg-surface-hover rounded-2xl px-3 py-2">
                <div className="flex items-baseline gap-1.5 mb-0.5">
                  <Link
                    href={`/profile/${encodeURIComponent(comment.author.id)}`}
                    className="font-semibold text-charcoal-primary hover:underline text-xs"
                  >
                    {displayName(comment.author)}
                  </Link>
                  <span className="font-mono text-[10px] text-ash">
                    {displayHandle(comment.author)}
                  </span>
                  <span className="text-[10px] text-ash">&middot;</span>
                  <span className="font-mono text-[10px] text-ash">
                    {relativeTime(comment.created_at)}
                  </span>
                </div>
                <p className="text-graphite text-xs leading-normal whitespace-pre-wrap">
                  {comment.content}
                </p>
              </div>
            </div>
          ))
        ) : (
          <div className="text-center py-3 text-xs text-ash font-medium">
            No comments yet. Start the conversation!
          </div>
        )}
      </div>

      {/* Comment Input */}
      {profile ? (
        <form onSubmit={handleSubmit} className="flex items-center gap-2">
          <div className="verity-blob h-8 w-8 bg-sunburst-yellow shrink-0">
            <span className="verity-blob-smile scale-75" />
          </div>
          <div className="relative flex-1">
            <input
              type="text"
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              placeholder="Write an inline reply..."
              disabled={isSubmitting}
              className="w-full bg-stone-surface text-charcoal-primary placeholder-ash text-xs rounded-full pl-4 pr-10 py-2 border border-transparent focus:border-stone-400 focus:outline-none transition-colors"
            />
            <button
              type="submit"
              disabled={isSubmitting || !commentText.trim()}
              className="absolute right-1 top-1/2 -translate-y-1/2 p-1.5 text-ash hover:text-charcoal-primary disabled:opacity-40 transition-colors"
              aria-label="Send comment"
            >
              {isSubmitting ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Send className="h-3.5 w-3.5" />
              )}
            </button>
          </div>
        </form>
      ) : (
        <div className="text-center py-2 bg-surface-hover rounded-xl text-xs text-ash font-medium">
          Connect your wallet to participate in the discussion.
        </div>
      )}
    </div>
  );
}
