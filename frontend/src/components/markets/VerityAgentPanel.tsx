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
      className={`rounded-[10px] border ${
        agentReview.approved
          ? 'border-[(--color-brand-secondary)]/30 bg-[(--color-brand-secondary)]/10'
          : 'border-[(--color-brand-accent)]/30 bg-[(--color-brand-accent)]/10'
      } ${compact ? 'p-3' : 'p-4'}`}
    >
      <div className="mb-2 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Bot className="h-4 w-4 text-[(--foreground)]" />
          <h2 className="font-mono text-[11px] font-black uppercase tracking-[0.14em] text-[(--foreground)]">
            Verity AI Agent
          </h2>
        </div>
        <span className="font-mono text-xs font-black text-[(--foreground)]">
          {agentReview.score}/100
        </span>
      </div>
      <div className="flex gap-2">
        <Icon
          className={`mt-0.5 h-4 w-4 shrink-0 ${agentReview.approved ? 'text-[(--color-brand-secondary)]' : 'text-[(--color-brand-accent)]'}`}
        />
        <div className="min-w-0">
          <p
            className={`${compact ? 'text-xs' : 'text-sm'} font-medium text-[(--foreground)]`}
          >
            {agentReview.summary}
          </p>
          {!compact && (
            <div className="mt-3 grid gap-2">
              {agentReview.findings.map((finding) => (
                <p
                  className={`text-xs ${
                    finding.severity === 'blocker'
                      ? 'text-[(--color-brand-accent)]'
                      : finding.severity === 'warning'
                        ? 'text-[(--muted)]'
                        : 'text-[(--color-brand-secondary)]'
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
