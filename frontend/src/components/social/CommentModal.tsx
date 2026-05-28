"use client";

import React, { useState, useEffect, useRef } from "react";
import { X, Loader2 } from "lucide-react";
import { useAddCommentMutation } from "@/store/verity/verityQueries";
import { displayName, displayHandle, relativeTime, type FeedPost, type MarketComment } from "@/lib/verity";
import { useWalletProfile } from "@/hooks/useWalletProfile";
import toast from "react-hot-toast";

interface CommentModalProps {
  post?: FeedPost | null;
  replyToComment?: MarketComment | null;
  isOpen: boolean;
  onClose: () => void;
}

export default function CommentModal({ post, replyToComment, isOpen, onClose }: CommentModalProps) {
  const [commentText, setCommentText] = useState("");
  const { profile } = useWalletProfile();
  const { mutateAsync: addComment, isPending: isSubmitting } = useAddCommentMutation();
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (isOpen) {
      setCommentText("");
      // Focus textarea when modal opens
      setTimeout(() => {
        textareaRef.current?.focus();
      }, 50);
    }
  }, [isOpen]);

  if (!isOpen || (!post && !replyToComment)) return null;

  const parentAuthor = replyToComment ? replyToComment.author : post?.author;
  const parentTime = replyToComment ? replyToComment.created_at : post?.created_at;
  const parentContent = replyToComment ? replyToComment.content : (post?.market?.question || post?.content);
  const parentId = replyToComment?.id;
  const postId = replyToComment ? replyToComment.post_id : post?.id;

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
        postId: postId!,
        authorId: profile.id,
        content: text,
        parentId,
      });
      toast.success("Comment posted!");
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to post comment.");
    }
  };

  const parentAvatarUrl = parentAuthor?.avatar_url || parentAuthor?.avatarUrl;
  const myAvatarUrl = profile?.avatar_url || profile?.avatarUrl;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-midnight/35 px-4 py-6 backdrop-blur-sm">
      {/* Backdrop overlay */}
      <div className="absolute inset-0" onClick={onClose} />

      {/* Modal Dialog Card */}
      <section className="verity-card relative z-10 w-full max-w-[520px] flex flex-col overflow-hidden bg-white-surface p-5 shadow-xl animate-in fade-in-50 zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-dashed border-stone-surface">
          <span className="font-mono text-xs font-semibold uppercase tracking-[0.12em] text-ash">
            Post Reply
          </span>
          <button
            aria-label="Close"
            className="flex h-8 w-8 items-center justify-center rounded-full bg-parchment-card text-charcoal-primary shadow-[(--shadow-subtle)] transition-colors hover:bg-stone-surface"
            onClick={onClose}
            type="button"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-4 flex flex-col">
          {/* Parent Post Context Row */}
          <div className="flex gap-3">
            <div className="flex flex-col items-center shrink-0">
              {parentAvatarUrl ? (
                <span
                  className="h-10 w-10 rounded-[14px] bg-cover bg-center shadow-[(--shadow-subtle)]"
                  style={{ backgroundImage: `url(${parentAvatarUrl})` }}
                />
              ) : (
                <span className="verity-blob h-10 w-10 bg-sky-blue">
                  <span className="verity-blob-smile" />
                </span>
              )}
              {/* Connector line */}
              <div className="w-0.5 grow bg-stone-300 my-2 min-h-[30px]" />
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-baseline gap-1.5 text-sm">
                <span className="font-semibold text-charcoal-primary">
                  {displayName(parentAuthor)}
                </span>
                <span className="font-mono text-xs text-ash">
                  {displayHandle(parentAuthor)}
                </span>
                <span className="text-ash">&middot;</span>
                <span className="font-mono text-xs text-ash">
                  {parentTime ? relativeTime(parentTime) : "now"}
                </span>
              </div>
              <p className="mt-1 text-sm leading-relaxed text-graphite line-clamp-4">
                {parentContent}
              </p>
              <div className="mt-2 text-xs text-ash font-mono">
                Replying to{" "}
                <span className="text-sky-blue font-semibold">
                  {displayHandle(parentAuthor)}
                </span>
              </div>
            </div>
          </div>

          {/* User Reply Editor */}
          <div className="flex gap-3 mt-3">
            <div className="shrink-0">
              {myAvatarUrl ? (
                <span
                  className="h-10 w-10 rounded-[14px] bg-cover bg-center shadow-[(--shadow-subtle)]"
                  style={{ backgroundImage: `url(${myAvatarUrl})` }}
                />
              ) : (
                <span className="verity-blob h-10 w-10 bg-sunburst-yellow">
                  <span className="verity-blob-smile" />
                </span>
              )}
            </div>

            <div className="flex-1 min-w-0">
              <textarea
                ref={textareaRef}
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                placeholder="Post your reply..."
                disabled={isSubmitting}
                className="w-full min-h-[90px] bg-transparent text-charcoal-primary placeholder-ash text-sm outline-none resize-none pt-2"
              />
            </div>
          </div>

          {/* Footer controls */}
          <div className="flex items-center justify-between border-t border-dashed border-stone-surface pt-3 mt-3">
            <div className="text-xs text-ash font-mono">
              {commentText.length} characters
            </div>
            <button
              type="submit"
              disabled={isSubmitting || !commentText.trim()}
              className="verity-pill flex h-10 px-5 items-center justify-center bg-inverse text-sm font-semibold tracking-[-0.18px] text-inverse-text transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Posting...
                </>
              ) : (
                "Reply"
              )}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
