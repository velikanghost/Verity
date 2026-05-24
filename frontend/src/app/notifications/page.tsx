import { Bell, CheckCircle2, MessageCircle, TrendingUp } from "lucide-react";
import PagePanel from "@/components/layout/PagePanel";

const NOTIFICATIONS = [
  {
    icon: TrendingUp,
    title: "Market moved 12%",
    body: "OpenAI launches GPT-5 before end of Q3 2026? moved toward YES.",
    time: "12m",
  },
  {
    icon: MessageCircle,
    title: "New reply",
    body: "Alice Wang replied to your comment on the AI shopping market.",
    time: "1h",
  },
  {
    icon: CheckCircle2,
    title: "Settlement ready",
    body: "A market you followed is ready for resolution review.",
    time: "3h",
  },
];

export default function NotificationsPage() {
  return (
    <PagePanel
      description="Signals from markets, creators, replies, and settlements you care about."
      eyebrow="Inbox"
      title="Notifications"
    >
      <section className="verity-card overflow-hidden">
        <div className="border-b border-dashed border-stone-surface p-4 sm:p-5">
          <h2 className="flex items-center gap-2 font-mono text-xs font-semibold uppercase tracking-[0.16em] text-charcoal-primary">
            <Bell className="h-4 w-4 text-meadow-green" />
            Recent
          </h2>
        </div>
        {NOTIFICATIONS.map((notification) => (
          <article
            className="flex gap-3 border-b border-dashed border-stone-surface p-4 transition-colors last:border-b-0 hover:bg-parchment-card sm:gap-4 sm:p-5"
            key={notification.title}
          >
            <div className="verity-blob flex h-10 w-10 shrink-0 items-center justify-center bg-sky-blue text-midnight">
              <notification.icon className="h-5 w-5" />
              <span className="verity-blob-smile" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-4">
                <h3 className="font-semibold tracking-[-0.18px] text-charcoal-primary">{notification.title}</h3>
                <span className="font-mono text-xs text-ash">{notification.time}</span>
              </div>
              <p className="mt-1 text-sm leading-relaxed tracking-[-0.18px] text-graphite">{notification.body}</p>
            </div>
          </article>
        ))}
      </section>
    </PagePanel>
  );
}
