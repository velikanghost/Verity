import { BarChart3, Trophy } from "lucide-react";
import PagePanel from "@/components/layout/PagePanel";
import ProfileEditor from "@/components/profile/ProfileEditor";

const STATS = [
  { label: "Accuracy", value: "0%" },
  { label: "Markets", value: "0" },
  { label: "Volume", value: "0" },
];

export default function ProfilePage() {
  return (
    <PagePanel
      description="Your public reputation, market history, and prediction performance."
      eyebrow="Profile"
      title="Profile"
    >
      <ProfileEditor />

      <section className="rounded-[18px] border border-[(--border)] bg-[(--surface)] p-5 shadow-sm">
        <div className="mt-5 grid grid-cols-3 gap-2">
          {STATS.map((stat) => (
            <div className="rounded-[13px] bg-[(--surface-muted)] p-4" key={stat.label}>
              <p className="text-2xl font-black text-[(--foreground)]">{stat.value}</p>
              <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-[(--muted)]">
                {stat.label}
              </p>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-[18px] border border-[(--border)] bg-[(--surface)] shadow-sm">
        <div className="border-b border-dashed border-[(--border)] p-5">
          <h2 className="flex items-center gap-2 font-mono text-xs font-black uppercase tracking-[0.16em] text-[(--foreground)]">
            <BarChart3 className="h-4 w-4 text-[(--color-brand-secondary)]" />
            Recent Activity
          </h2>
        </div>
        <div className="p-5">
          <p className="font-medium text-[(--muted)]">No reputation activity yet.</p>
        </div>
      </section>

      <section className="rounded-[18px] border border-[(--border)] bg-[(--surface)] p-5 shadow-sm">
        <h2 className="flex items-center gap-2 font-mono text-xs font-black uppercase tracking-[0.16em] text-[(--foreground)]">
          <Trophy className="h-4 w-4 text-yellow-500" />
          Badge
        </h2>
        <p className="mt-3 text-sm text-[(--muted)]">
          Top 10% predictor in AI/Tech markets this month.
        </p>
      </section>
    </PagePanel>
  );
}
