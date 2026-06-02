"use client"

import { useRouter } from "next/navigation"
import {
  Bell,
  CheckCircle2,
  MessageCircle,
  TrendingUp,
  Heart,
  UserPlus,
  Loader2,
} from "lucide-react"
import PagePanel from "@/components/layout/PagePanel"
import {
  useNotificationsQuery,
  useMarkNotificationReadMutation,
  useMarkAllNotificationsReadMutation,
} from "@/store/verity/verityQueries"
import { useWalletProfile } from "@/hooks/useWalletProfile"
import { relativeTime } from "@/lib/verity"

const ICON_MAP: Record<string, any> = {
  reply: MessageCircle,
  comment: MessageCircle,
  like: Heart,
  follow: UserPlus,
  settlement: CheckCircle2,
  market_move: TrendingUp,
  market_funded: TrendingUp,
  market_registered: TrendingUp,
}

export default function NotificationsPage() {
  const router = useRouter()
  const { profile, isLoading: profileLoading } = useWalletProfile()
  const {
    data: notifications = [],
    isLoading: notificationsLoading,
    refetch,
  } = useNotificationsQuery(profile?.id || "")
  const { mutateAsync: markRead } = useMarkNotificationReadMutation()
  const { mutateAsync: markAllRead, isPending: markAllReadPending } =
    useMarkAllNotificationsReadMutation()

  async function handleMarkRead(id: string) {
    try {
      await markRead({ notificationId: id, userId: profile?.id || "" })
      await refetch()
    } catch (e) {
      // Ignore
    }
  }

  async function handleMarkAllRead() {
    if (!profile?.id) return
    try {
      await markAllRead(profile.id)
      await refetch()
    } catch (e) {
      // Ignore
    }
  }

  if (profileLoading) {
    return (
      <PagePanel
        description="Signals from markets, creators, replies, and settlements you care about."
        eyebrow="Inbox"
        title="Notifications"
      >
        <div className="flex flex-col items-center justify-center p-12 text-ash">
          <Loader2 className="h-6 w-6 animate-spin text-sky-blue" />
          <p className="mt-2 text-sm font-medium">Loading...</p>
        </div>
      </PagePanel>
    )
  }

  if (!profile) {
    return (
      <PagePanel
        description="Signals from markets, creators, replies, and settlements you care about."
        eyebrow="Inbox"
        title="Notifications"
      >
        <div className="verity-card flex flex-col items-center gap-3 p-8 text-center text-sm font-medium text-ash bg-surface-solid border border-border rounded-xl shadow-[(--shadow-subtle)]">
          <Bell className="h-10 w-10 text-ash animate-bounce" />
          <p className="max-w-xs text-graphite font-semibold">
            Connect your wallet to see your replies, market movements, and
            settlement updates.
          </p>
        </div>
      </PagePanel>
    )
  }

  return (
    <PagePanel
      description="Signals from markets, creators, replies, and settlements you care about."
      eyebrow="Inbox"
      title="Notifications"
    >
      <section className="verity-card overflow-hidden bg-surface-solid border border-border rounded-xl shadow-[(--shadow-subtle)]">
        <div className="border-b border-dashed border-stone-surface p-4 sm:p-5 flex items-center justify-between">
          <h2 className="flex items-center gap-2 font-mono text-xs font-semibold uppercase tracking-[0.16em] text-charcoal-primary">
            <Bell className="h-4 w-4 text-meadow-green" />
            Recent
          </h2>
          {notifications.filter((n: any) => !n.read).length > 0 && (
            <button
              onClick={handleMarkAllRead}
              disabled={markAllReadPending}
              className="font-mono text-xs text-sky-blue hover:text-sky-blue/80 font-bold transition-colors cursor-pointer disabled:opacity-50"
            >
              Mark all read
            </button>
          )}
        </div>

        {notificationsLoading ? (
          <div className="flex flex-col items-center justify-center p-12 text-ash animate-pulse">
            <Loader2 className="h-6 w-6 animate-spin text-sky-blue" />
            <p className="mt-2 text-sm">Loading signals...</p>
          </div>
        ) : notifications.length > 0 ? (
          notifications.map((notification: any) => {
            const IconComponent =
              ICON_MAP[notification.type?.toLowerCase()] || Bell

            return (
              <article
                className={`flex gap-3 border-b border-dashed border-stone-surface p-4 transition-colors last:border-b-0 cursor-pointer sm:gap-4 sm:p-5 ${
                  notification.read
                    ? "hover:bg-stone-surface/30 opacity-70"
                    : "bg-sky-blue/5 hover:bg-sky-blue/10"
                }`}
                key={notification.id}
                onClick={() => {
                  if (!notification.read) {
                    void handleMarkRead(notification.id)
                  }
                  if (notification.targetId) {
                    if (
                      [
                        "settlement",
                        "market_move",
                        "market_funded",
                        "market_registered",
                      ].includes(notification.type?.toLowerCase())
                    ) {
                      router.push(`/markets/${notification.targetId}`)
                    } else {
                      router.push(`/posts/${notification.targetId}`)
                    }
                  }
                }}
              >
                <div
                  className={`verity-blob flex h-10 w-10 shrink-0 items-center justify-center text-midnight ${
                    notification.read
                      ? "bg-stone-surface text-ash"
                      : "bg-sky-blue text-midnight"
                  }`}
                >
                  <IconComponent className="h-5 w-5" />
                  <span className="verity-blob-smile" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-4">
                    <h3
                      className={`font-semibold tracking-[-0.18px] truncate ${
                        notification.read
                          ? "text-graphite font-normal"
                          : "text-charcoal-primary"
                      }`}
                    >
                      {notification.title}
                    </h3>
                    <span className="font-mono text-xs text-ash whitespace-nowrap">
                      {relativeTime(notification.createdAt)}
                    </span>
                  </div>
                  <p className="mt-1 text-sm leading-relaxed tracking-[-0.18px] text-graphite">
                    {notification.body}
                  </p>
                </div>
              </article>
            )
          })
        ) : (
          <div className="flex flex-col items-center gap-3 p-12 text-center text-sm font-medium text-ash">
            <span className="verity-blob block h-16 w-20 bg-stone-surface">
              <span className="verity-blob-smile" />
            </span>
            <p className="text-graphite">No notifications yet.</p>
          </div>
        )}
      </section>
    </PagePanel>
  )
}
