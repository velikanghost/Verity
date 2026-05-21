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
      <section className="rounded-[18px] border border-[(--border)] bg-[(--surface)] shadow-sm">
        <div className="border-b border-dashed border-[(--border)] p-5">
          <h2 className="flex items-center gap-2 font-mono text-xs font-black uppercase tracking-[0.16em] text-[(--foreground)]">
            <Bell className="h-4 w-4 text-[(--color-brand-secondary)]" />
            Recent
          </h2>
        </div>
        {NOTIFICATIONS.map((notification) => (
          <article
            className="flex gap-4 border-b border-dashed border-[(--border)] p-5 last:border-b-0"
            key={notification.title}
          >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[(--inverse)] text-[(--inverse-text)]">
              <notification.icon className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-4">
                <h3 className="font-black text-[(--foreground)]">{notification.title}</h3>
                <span className="font-mono text-xs text-[(--muted)]">{notification.time}</span>
              </div>
              <p className="mt-1 text-sm leading-relaxed text-[(--muted)]">{notification.body}</p>
            </div>
          </article>
        ))}
      </section>
    </PagePanel>
  );
}
