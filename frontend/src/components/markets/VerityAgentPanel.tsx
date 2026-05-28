'use client'

import { Bot, CheckCircle2, AlertTriangle } from 'lucide-react'
import type { MarketPost } from '@/lib/verity'
import { reviewPredictionPost, type VerityAgentReview } from '@/lib/verityAgent'

interface VerityAgentPanelProps {
  market?: MarketPost | null
  review?: VerityAgentReview | null
  compact?: boolean
}

function reviewMarket(market: MarketPost): VerityAgentReview {
  return reviewPredictionPost({
    content: '',
    question: market.question,
    category: market.category,
    deadline: market.deadline,
    resolutionSource: market.resolution_source,
    yesCondition: market.yes_condition,
    noCondition: market.no_condition,
  })
}

export default function VerityAgentPanel({
  compact = false,
  market,
  review,
}: VerityAgentPanelProps) {
  const agentReview = review || (market ? reviewMarket(market) : null)
  if (!agentReview) return null

  const Icon = agentReview.approved ? CheckCircle2 : AlertTriangle

  return (
    <section
      className={`rounded-[10px] bg-white-surface shadow-[(--shadow-subtle)] ${
        compact ? 'p-3' : 'p-4'
      }`}
    >
      <div className="mb-2 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span
            className={`flex h-8 w-8 items-center justify-center rounded-[10px] ${
              agentReview.approved ? 'bg-meadow-green/10' : 'bg-ember-orange/10'
            }`}
          >
            <Bot className="h-4 w-4 text-charcoal-primary" />
          </span>
          <h2 className="font-mono text-[11px] font-semibold uppercase tracking-[0.12em] text-charcoal-primary">
            Verity AI Agent
          </h2>
        </div>
        <span className="rounded-full bg-parchment-card px-2.5 py-1 font-mono text-xs font-semibold text-charcoal-primary shadow-[(--shadow-subtle)]">
          {agentReview.score}/100
        </span>
      </div>
      <div className="flex gap-2">
        <Icon
          className={`mt-0.5 h-4 w-4 shrink-0 ${agentReview.approved ? 'text-meadow-green' : 'text-ember-orange'}`}
        />
        <div className="min-w-0">
          <p
            className={`${compact ? 'text-xs' : 'text-sm'} font-medium tracking-[-0.18px] text-graphite`}
          >
            {agentReview.summary}
          </p>
          {!compact && (
            <div className="mt-3 grid gap-2">
              {agentReview.findings.map((finding) => (
                <p
                  className={`text-xs ${
                    finding.severity === 'blocker'
                      ? 'text-ember-orange'
                      : finding.severity === 'warning'
                        ? 'text-ash'
                        : 'text-meadow-green'
                  }`}
                  key={finding.message}
                >
                  {finding.message}
                </p>
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  )
}
