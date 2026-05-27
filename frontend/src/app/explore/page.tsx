import { Search, Sparkles, TrendingUp } from "lucide-react";
import PagePanel from "@/components/layout/PagePanel";
import PeopleDiscovery from "@/components/profile/PeopleDiscovery";

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
      <section className="verity-card p-4">
        <div className="relative">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-ash" />
          <input
            className="h-12 w-full rounded-[32px] bg-parchment-card pl-12 pr-4 text-[15px] tracking-[-0.2px] text-charcoal-primary shadow-[(--shadow-subtle)] outline-none placeholder:text-ash focus:ring-2 focus:ring-stone-surface"
            placeholder="Search markets, users, topics..."
            type="text"
          />
        </div>
      </section>

      <section className="verity-card p-4 sm:p-5">
        <h2 className="flex items-center gap-2 font-mono text-xs font-semibold uppercase tracking-[0.16em] text-charcoal-primary">
          <Sparkles className="h-4 w-4 text-sunburst-yellow" />
          Topics
        </h2>
        <div className="mt-4 flex flex-wrap gap-2">
          {TOPICS.map((topic) => (
            <button
              className="verity-pill bg-parchment-card px-4 py-2 text-sm font-medium tracking-[-0.18px] text-graphite shadow-[(--shadow-subtle)] transition-colors hover:bg-stone-surface"
              key={topic}
              type="button"
            >
              {topic}
            </button>
          ))}
        </div>
      </section>

      <PeopleDiscovery />

      <section className="verity-card overflow-hidden">
        <div className="border-b border-dashed border-stone-surface p-4 sm:p-5">
          <h2 className="flex items-center gap-2 font-mono text-xs font-semibold uppercase tracking-[0.16em] text-charcoal-primary">
            <TrendingUp className="h-4 w-4 text-meadow-green" />
            Moving Now
          </h2>
        </div>
        {DISCOVERIES.map((item) => (
          <article
            className="border-b border-dashed border-stone-surface p-4 transition-colors last:border-b-0 hover:bg-parchment-card sm:p-5"
            key={item.title}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="font-semibold leading-snug tracking-[-0.18px] text-charcoal-primary">{item.title}</h3>
                <p className="mt-2 font-mono text-xs text-ash">{item.meta}</p>
              </div>
              <span className="font-mono text-sm font-semibold text-meadow-green">{item.trend}</span>
            </div>
          </article>
        ))}
      </section>
    </PagePanel>
  );
}
