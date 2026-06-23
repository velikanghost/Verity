"use client"

import Link from "next/link"
import { useAuth } from "@/components/providers/AuthModals"
import {
  ArrowRight,
  BadgeCheck,
  CircleDollarSign,
  HandCoins,
  MessageSquareText,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  UsersRound,
} from "lucide-react"
import ThemeToggle from "@/components/layout/ThemeToggle"

const steps = [
  {
    icon: Sparkles,
    label: "Post a Take",
    text: "Share a claim, forecast, or conviction with the community.",
  },
  {
    icon: TrendingUp,
    label: "Turn it into a Market",
    text: "Strong ideas become Upvote/Downvote signal markets.",
  },
  {
    icon: HandCoins,
    label: "Fund the pool",
    text: "Creators and liquidity providers help markets bond with Arc USDC.",
  },
  {
    icon: BadgeCheck,
    label: "Trade outcomes",
    text: "Qualified markets open for USDC-backed trading and rewards.",
  },
]

const stats = [
  ["Signal first", "Markets start with social conviction"],
  ["Zero Signing", "Developer-controlled smart contract wallets"],
  ["Pool rewards", "Creators and LPs can earn after bonding"],
]

const statIcons = {
  "Signal first": MessageSquareText,
  "Zero Signing": ShieldCheck,
  "Pool rewards": CircleDollarSign,
}

export default function LandingPage({
  loading = false,
}: {
  loading?: boolean
}) {
  const { login } = useAuth()

  return (
    <main className="min-h-screen overflow-hidden bg-warm-canvas text-charcoal-primary">
      <header className="mx-auto flex w-full max-w-[1180px] items-center justify-between px-4 py-3 sm:px-6 sm:py-4">
        <Link
          className="clickable-surface flex items-center gap-3 rounded-[14px] p-2"
          href="/"
        >
          <span className="verity-blob landing-wiggle flex h-10 w-10 items-center justify-center bg-sunburst-yellow font-semibold text-midnight [--landing-rotate:-6deg]">
            V
            <span className="verity-blob-smile" />
          </span>
          <span className="text-[21px] font-semibold tracking-[-0.35px]">
            Verity
          </span>
        </Link>

        <div className="flex items-center gap-2">
          <ThemeToggle />
        </div>
      </header>

      <section className="relative mx-auto grid min-h-[calc(100vh-76px)] w-full max-w-[1180px] items-center gap-6 px-4 pb-8 pt-2 sm:gap-10 sm:px-6 sm:pb-12 lg:grid-cols-[1fr_460px] lg:pb-16">
        <div className="pointer-events-none absolute left-[5%] top-[18%] hidden h-10 w-10 rounded-[999px] bg-sunburst-yellow sm:block landing-float" />
        <div className="pointer-events-none absolute right-[48%] top-[10%] hidden h-8 w-8 rounded-[999px] bg-ember-orange sm:block landing-float-slow" />

        <div className="relative z-10 max-w-3xl landing-pop">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-white-surface px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-graphite shadow-subtle sm:mb-5 sm:text-xs">
            <span className="h-2 w-2 rounded-full bg-meadow-green" />
            Social prediction markets on Arc
          </div>

          <h1 className="max-w-[760px] text-[40px] font-semibold leading-[0.98] tracking-[-1.1px] text-midnight sm:text-[68px] sm:tracking-[-2.11px]">
            Where conviction becomes a market.
          </h1>

          <p className="mt-4 max-w-[610px] text-[16px] leading-[1.52] tracking-[-0.2px] text-graphite sm:mt-5 sm:text-[19px] sm:tracking-[-0.22px]">
            Verity turns posts into community-backed prediction markets. Rally
            Upvote/Downvote signals, fund launch pools, provide liquidity, and
            trade outcomes with Arc USDC.
          </p>

          <div className="mt-6 flex flex-col gap-3 sm:mt-7 sm:flex-row">
            <button
              className="clickable verity-pill flex h-12 w-full items-center justify-center gap-2 bg-inverse px-6 text-sm font-semibold tracking-[-0.18px] text-inverse-text hover:opacity-90 disabled:cursor-wait disabled:opacity-70 sm:w-auto"
              disabled={loading}
              onClick={login}
              type="button"
            >
              {loading ? "Loading" : "Get Started (Email OTP)"}
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>

          <div className="mt-6 grid gap-3 sm:mt-8 sm:grid-cols-3 sm:gap-4">
            {stats.map(([label, text]) => {
              const Icon = statIcons[label as keyof typeof statIcons]
              return (
                <div
                  className="landing-pop rounded-[12px] bg-white-surface p-5 border border-border/60 shadow-subtle hover:shadow-sm hover:-translate-y-0.5 transition-all duration-200 flex flex-col gap-3.5"
                  key={label}
                >
                  <div className="flex items-center justify-between w-full">
                    <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.14em] text-ash">
                      {label}
                    </p>
                    {Icon && (
                      <span className="flex h-7 w-7 items-center justify-center rounded-[8px] bg-stone-surface/60 text-ember-orange shadow-subtle border border-border">
                        <Icon className="h-4 w-4" />
                      </span>
                    )}
                  </div>
                  <p className="text-sm leading-[1.45] tracking-[-0.18px] text-graphite">
                    {text}
                  </p>
                </div>
              )
            })}
          </div>
        </div>

        <LandingVisual />
      </section>

      <section className="border-y border-stone-surface bg-parchment-card py-3">
        <div className="landing-marquee flex w-max gap-3 whitespace-nowrap px-4 font-mono text-[11px] font-semibold uppercase tracking-[0.14em] text-ash">
          {Array.from({ length: 2 }).map((_, loop) => (
            <span className="flex gap-3" key={loop}>
              <span>Take</span>
              <span className="text-ember-orange">Market</span>
              <span>Upvote</span>
              <span className="text-meadow-green">Fund pools</span>
              <span>Provide liquidity</span>
              <span className="text-sky-blue">Trade outcomes</span>
              <span>Earn rewards</span>
              <span>Arc USDC</span>
            </span>
          ))}
        </div>
      </section>

      <section className="border-t border-stone-surface bg-white-surface/55">
        <div className="mx-auto grid w-full max-w-[1180px] gap-3 px-4 py-6 sm:px-6 sm:py-8 lg:grid-cols-4">
          {steps.map((step, index) => (
            <article
              className="clickable-card landing-pop rounded-[10px] bg-white-surface p-5 shadow-subtle"
              key={step.label}
            >
              <div className="flex items-center justify-between gap-3">
                <span className="flex h-11 w-11 items-center justify-center rounded-[16px] bg-parchment-card text-ember-orange shadow-subtle">
                  <step.icon className="h-5 w-5" />
                </span>
                <span className="font-mono text-[12px] font-semibold text-ash">
                  0{index + 1}
                </span>
              </div>
              <h2 className="mt-5 text-[19px] font-semibold tracking-[-0.25px] text-charcoal-primary">
                {step.label}
              </h2>
              <p className="mt-2 text-sm leading-normal tracking-[-0.18px] text-graphite">
                {step.text}
              </p>
            </article>
          ))}
        </div>
      </section>
    </main>
  )
}

function LandingVisual() {
  return (
    <div className="relative mx-auto h-[430px] w-full max-w-[460px] sm:h-[520px]">
      <div className="absolute left-1 top-6 verity-blob landing-float h-16 w-16 bg-sky-blue [--landing-rotate:-8deg] sm:left-2 sm:top-8 sm:h-24 sm:w-24">
        <span className="verity-blob-smile" />
      </div>
      <div className="absolute right-7 top-0 verity-blob landing-float-slow h-14 w-14 bg-meadow-green [--landing-rotate:10deg] sm:right-8 sm:top-2 sm:h-20 sm:w-20">
        <span className="verity-blob-smile" />
      </div>
      <div className="absolute bottom-8 right-2 verity-blob landing-wiggle h-16 w-16 bg-ember-orange [--landing-rotate:7deg] sm:h-24 sm:w-24">
        <span className="verity-blob-smile" />
      </div>
      <div className="absolute left-[42%] top-14 flex h-12 w-12 items-center justify-center rounded-[18px] bg-white-surface text-ember-orange shadow-sm landing-float sm:h-14 sm:w-14">
        <MessageSquareText className="h-6 w-6" />
      </div>

      <div className="absolute left-3 right-3 top-20 rounded-[24px] bg-obsidian p-3 text-white shadow-[(--shadow-lg)] landing-pop sm:left-8 sm:right-8 sm:top-24 sm:p-4">
        <div className="rounded-[18px] bg-[#171717] p-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-white/55">
                Market
              </p>
              <h2 className="mt-2 text-[20px] font-semibold leading-[1.12] tracking-[-0.36px] sm:text-[23px] sm:tracking-[-0.44px]">
                Will community signals beat the crowd?
              </h2>
            </div>
            <span className="rounded-full bg-meadow-green px-3 py-1 font-mono text-[10px] font-semibold uppercase text-white">
              Live
            </span>
          </div>

          <div className="mt-6 grid grid-cols-2 gap-2">
            <div className="rounded-[14px] bg-meadow-green p-4">
              <p className="text-sm font-semibold">Upvote</p>
              <p className="mt-4 font-mono text-2xl font-semibold">68%</p>
            </div>
            <div className="rounded-[14px] bg-white/10 p-4">
              <p className="text-sm font-semibold text-white/70">Downvote</p>
              <p className="mt-4 font-mono text-2xl font-semibold text-white/70">
                32%
              </p>
            </div>
          </div>

          <div className="mt-5 rounded-[14px] bg-white p-4 text-charcoal-primary">
            <div className="flex items-center justify-between">
              <span className="font-mono text-[11px] font-semibold uppercase tracking-[0.14em] text-ash">
                Pool funding
              </span>
              <CircleDollarSign className="h-5 w-5 text-meadow-green" />
            </div>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-stone-surface">
              <div className="h-full bg-meadow-green landing-progress" />
            </div>
            <p className="mt-3 font-mono text-xs text-ash">
              14.40 / 20.00 USDC
            </p>
          </div>
        </div>
      </div>

      <div className="absolute bottom-16 left-0 max-w-[230px] rounded-[18px] bg-white-surface p-3 shadow-sm landing-float-slow sm:bottom-20 sm:p-4">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-[14px] bg-sunburst-yellow text-midnight">
            <UsersRound className="h-5 w-5" />
          </span>
          <div>
            <p className="text-sm font-semibold tracking-[-0.18px]">
              120 people rallied
            </p>
            <p className="font-mono text-[11px] text-ash">
              signals before trading
            </p>
          </div>
        </div>
      </div>

      <div className="absolute right-0 top-[310px] max-w-[230px] rounded-[18px] bg-white-surface p-3 shadow-sm landing-float sm:top-[330px] sm:p-4">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-[14px] bg-meadow-green/10 text-meadow-green">
            <ShieldCheck className="h-5 w-5" />
          </span>
          <div>
            <p className="text-sm font-semibold tracking-[-0.18px]">
              Zero signing latency
            </p>
            <p className="font-mono text-[11px] text-ash">
              developer-controlled wallet flow
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
