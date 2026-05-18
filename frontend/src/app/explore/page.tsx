import { Search, Sparkles, TrendingUp } from "lucide-react";
import PagePanel from "@/components/layout/PagePanel";

const TOPICS = ["AI/Tech", "Crypto", "Culture", "Economics", "Politics", "Sports"];

const DISCOVERIES = [
  {
    title: "OpenAI launches GPT-5 before end of Q3 2026?",
    meta: "8.9k USDC · 42% YES",
    trend: "+12%",
  },
  {
    title: "Ethereum breaks $5,000 before August 1st?",
    meta: "32.1k USDC · 81% YES",
    trend: "+7%",
  },
  {
    title: "Will a fully AI-generated song hit the Billboard Top 10 in 2026?",
    meta: "5.0k USDC · 41% YES",
    trend: "+4%",
  },
];

export default function ExplorePage() {
  return (
    <PagePanel
      description="Find markets, creators, and conversations gaining conviction across Verity."
      eyebrow="Discover"
      title="Explore"
    >
      <section className="rounded-[18px] border border-[var(--border)] bg-[var(--surface)] p-4 shadow-sm">
        <div className="relative">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-[var(--muted)]" />
          <input
            className="h-12 w-full rounded-[13px] border border-[var(--border)] bg-[var(--surface-solid)] pl-12 pr-4 text-[var(--foreground)] outline-none placeholder:text-[var(--muted)] focus:border-[var(--border-strong)]"
            placeholder="Search markets, users, topics..."
            type="text"
          />
        </div>
      </section>

      <section className="rounded-[18px] border border-[var(--border)] bg-[var(--surface)] p-5 shadow-sm">
        <h2 className="flex items-center gap-2 font-mono text-xs font-black uppercase tracking-[0.16em] text-[var(--foreground)]">
          <Sparkles className="h-4 w-4 text-brand-secondary" />
          Topics
        </h2>
        <div className="mt-4 flex flex-wrap gap-2">
          {TOPICS.map((topic) => (
            <button
              className="rounded-[8px] border border-[var(--border)] bg-[var(--surface-solid)] px-3 py-2 text-sm font-medium text-[var(--foreground)] transition-colors hover:border-[var(--border-strong)]"
              key={topic}
              type="button"
            >
              {topic}
            </button>
          ))}
        </div>
      </section>

      <section className="rounded-[18px] border border-[var(--border)] bg-[var(--surface)] shadow-sm">
        <div className="border-b border-dashed border-[var(--border)] p-5">
          <h2 className="flex items-center gap-2 font-mono text-xs font-black uppercase tracking-[0.16em] text-[var(--foreground)]">
            <TrendingUp className="h-4 w-4 text-brand-secondary" />
            Moving Now
          </h2>
        </div>
        {DISCOVERIES.map((item) => (
          <article
            className="border-b border-dashed border-[var(--border)] p-5 last:border-b-0"
            key={item.title}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="font-black leading-snug text-[var(--foreground)]">{item.title}</h3>
                <p className="mt-2 font-mono text-xs text-[var(--muted)]">{item.meta}</p>
              </div>
              <span className="font-mono text-sm font-black text-brand-secondary">{item.trend}</span>
            </div>
          </article>
        ))}
      </section>
    </PagePanel>
  );
}
