import Link from 'next/link'
import {
  ArrowRight,
  BadgeCheck,
  CircleDollarSign,
  Flag,
  MessageCircle,
  Repeat2,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  UserPlus,
  Vote,
} from 'lucide-react'

const STEPS = [
  {
    title: 'Post a claim',
    body: 'Start with a normal post or a prediction question. A good market has a clear deadline, source, and YES/NO conditions.',
    icon: Sparkles,
    color: 'bg-sunburst-yellow/25 text-deep-amber',
  },
  {
    title: 'Signal early',
    body: 'Upvote or Downvote signals are free daily social signals. They help the community decide which ideas deserve a real market.',
    icon: Vote,
    color: 'bg-sky-blue/10 text-sky-blue',
  },
  {
    title: 'Pool Funding',
    body: 'Qualified markets gather launch-pool USDC. Funding the pool helps open trading and may earn liquidity rewards when the market trades.',
    icon: CircleDollarSign,
    color: 'bg-meadow-green/10 text-meadow-green',
  },
  {
    title: 'Trade conviction',
    body: 'Buy YES if you think the event resolves true. Buy NO if you think it resolves false. Sell lets you reduce or exit a position.',
    icon: TrendingUp,
    color: 'bg-ember-orange/10 text-ember-orange',
  },
]

const GLOSSARY = [
  {
    term: 'Upvote / Downvote',
    detail:
      'Free daily signals used before a market is fully tradable. They measure social conviction, not paid exposure.',
  },
  {
    term: 'Buy YES / Buy NO',
    detail:
      'USDC-backed positions. YES backs the event happening; NO backs the event not happening.',
  },
  {
    term: 'Sell',
    detail:
      'Use Sell to close part or all of your outcome shares before resolution, based on available liquidity.',
  },
  {
    term: 'Liquidity',
    detail:
      'USDC available in a market pool. Liquidity providers help trades execute and may earn rewards from market activity.',
  },
  {
    term: 'Pool Funding',
    detail:
      'USDC contributions that help a qualified market reach its launch threshold and can become reward-earning liquidity.',
  },
  {
    term: 'Resolution',
    detail:
      'The final outcome process. Markets resolve using their stated source, deadline, and YES/NO conditions.',
  },
]

const SOCIAL = [
  {
    title: 'Profiles',
    body: 'Your profile shows posts, markets, comments, likes, followers, and following.',
    icon: BadgeCheck,
  },
  {
    title: 'Follow graph',
    body: 'Follow creators whose markets, posts, or signal history you want to track.',
    icon: UserPlus,
  },
  {
    title: 'Comments',
    body: 'Discuss evidence, ask for clarification, and leave context below posts and markets.',
    icon: MessageCircle,
  },
  {
    title: 'Reshares',
    body: 'Bring useful claims and markets back into the feed when they deserve attention.',
    icon: Repeat2,
  },
]

export default function HowItWorksPage() {
  return (
    <div className="flex flex-col gap-3 py-3 sm:py-4">
      <section className="verity-card relative overflow-hidden p-5 sm:p-8">
        <div className="absolute -right-10 -top-10 h-32 w-32 rounded-full bg-sunburst-yellow/25" />
        <div className="absolute right-20 top-16 h-14 w-14 rounded-full bg-sky-blue/10" />

        <div className="relative max-w-[620px]">
          <p className="font-mono text-xs font-semibold uppercase tracking-[0.16em] text-ember-orange">
            Verity Guide
          </p>
          <h1 className="mt-2 text-[34px] font-semibold leading-[1.05] tracking-[-0.9px] text-midnight sm:text-[52px] sm:tracking-[-1.14px]">
            How Verity works
          </h1>
          <p className="mt-4 text-[17px] leading-[1.5] tracking-[-0.22px] text-graphite">
            Verity is a social prediction network. Posts can gather free
            community signals, become USDC-backed markets, and resolve through
            clear outcome rules.
          </p>
          <div className="mt-6 flex flex-wrap gap-2">
            <Link
              className="verity-pill flex h-11 items-center gap-2 bg-midnight px-5 text-sm font-semibold tracking-[-0.18px] text-white transition-colors hover:bg-charcoal-primary"
              href="/"
            >
              Go to feed <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              className="verity-pill flex h-11 items-center bg-parchment-card px-5 text-sm font-semibold tracking-[-0.18px] text-charcoal-primary shadow-[var(--shadow-subtle)] transition-colors hover:bg-stone-surface"
              href="/explore"
            >
              Explore markets
            </Link>
          </div>
        </div>
      </section>

      <section className="grid gap-3 md:grid-cols-2">
        {STEPS.map((step, index) => (
          <article className="verity-card p-4 sm:p-5" key={step.title}>
            <div className="mb-5 flex items-center justify-between">
              <span
                className={`flex h-11 w-11 items-center justify-center rounded-[12px] ${step.color}`}
              >
                <step.icon className="h-5 w-5" />
              </span>
              <span className="font-mono text-xs font-semibold text-ash">
                0{index + 1}
              </span>
            </div>
            <h2 className="text-[23px] font-semibold leading-[1.2] tracking-[-0.44px] text-charcoal-primary">
              {step.title}
            </h2>
            <p className="mt-2 text-[15px] leading-[1.47] tracking-[-0.2px] text-graphite">
              {step.body}
            </p>
          </article>
        ))}
      </section>

      <section className="verity-card overflow-hidden">
        <div className="border-b border-dashed border-stone-surface p-4 sm:p-5">
          <h2 className="flex items-center gap-2 font-mono text-xs font-semibold uppercase tracking-[0.16em] text-charcoal-primary">
            <ShieldCheck className="h-4 w-4 text-meadow-green" />
            Core Terms
          </h2>
        </div>
        <div className="grid md:grid-cols-2">
          {GLOSSARY.map((item) => (
            <article
              className="border-b border-dashed border-stone-surface p-4 md:odd:border-r sm:p-5"
              key={item.term}
            >
              <h3 className="font-semibold tracking-[-0.18px] text-charcoal-primary">
                {item.term}
              </h3>
              <p className="mt-2 text-sm leading-[1.45] tracking-[-0.18px] text-graphite">
                {item.detail}
              </p>
            </article>
          ))}
        </div>
      </section>

      <section className="verity-card p-4 sm:p-5">
        <div className="mb-5 flex items-center justify-between gap-3">
          <div>
            <h2 className="text-[23px] font-semibold leading-[1.2] tracking-[-0.44px] text-charcoal-primary">
              What happens at resolution?
            </h2>
            <p className="mt-1 text-sm tracking-[-0.18px] text-ash">
              Every market should have a source, deadline, and clear conditions.
            </p>
          </div>
          <Flag className="h-5 w-5 text-ember-orange" />
        </div>
        <div className="grid gap-3 md:grid-cols-3">
          <ResolutionCard
            label="Source"
            text="The place used to verify the outcome, such as an official feed, oracle, or public announcement."
          />
          <ResolutionCard
            label="Conditions"
            text="YES and NO conditions explain exactly what must be true for either side to win."
          />
          <ResolutionCard
            label="Payout"
            text="Winning outcome shares can be redeemed after the market resolves."
          />
        </div>
      </section>

      <section className="verity-card p-4 sm:p-5">
        <div className="mb-5 flex items-center justify-between gap-3">
          <div>
            <h2 className="text-[23px] font-semibold leading-[1.2] tracking-[-0.44px] text-charcoal-primary">
              Ways to earn
            </h2>
            <p className="mt-1 text-sm tracking-[-0.18px] text-ash">
              Rewards depend on market activity and final outcomes.
            </p>
          </div>
          <CircleDollarSign className="h-5 w-5 text-meadow-green" />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <ResolutionCard
            label="Fund pools"
            text="Contribute USDC before a market opens to help it reach launch liquidity and participate in potential liquidity rewards."
          />
          <ResolutionCard
            label="Provide liquidity"
            text="Add liquidity to active markets so traders can buy and sell more smoothly. Liquidity providers may earn from trading activity."
          />
        </div>
      </section>

      <section className="verity-card p-4 sm:p-5">
        <h2 className="text-[23px] font-semibold leading-[1.2] tracking-[-0.44px] text-charcoal-primary">
          Social features
        </h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {SOCIAL.map((item) => (
            <article
              className="rounded-[12px] bg-parchment-card p-4 shadow-[var(--shadow-subtle)]"
              key={item.title}
            >
              <item.icon className="mb-3 h-5 w-5 text-charcoal-primary" />
              <h3 className="font-semibold tracking-[-0.18px] text-charcoal-primary">
                {item.title}
              </h3>
              <p className="mt-2 text-sm leading-[1.45] tracking-[-0.18px] text-graphite">
                {item.body}
              </p>
            </article>
          ))}
        </div>
      </section>
    </div>
  )
}

function ResolutionCard({ label, text }: { label: string; text: string }) {
  return (
    <div className="rounded-[12px] bg-parchment-card p-4 shadow-[var(--shadow-subtle)]">
      <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-ash">
        {label}
      </p>
      <p className="mt-2 text-sm leading-[1.45] tracking-[-0.18px] text-graphite">
        {text}
      </p>
    </div>
  )
}
