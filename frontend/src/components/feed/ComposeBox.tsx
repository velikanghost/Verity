'use client'

import { useMemo, useState } from 'react'
import { Image as ImageIcon, BarChart2, Smile, MapPin } from 'lucide-react'
import { type MarketInput, type Profile } from '@/lib/verity'
import { reviewPredictionPost, type VerityAgentReview } from '@/lib/verityAgent'
import { useUsdcTransfer } from '@/hooks/useUsdcTransfer'
import {
  useCreateMarketPostMutation,
  useCreateNormalPostMutation,
} from '@/store/verity/verityQueries'
import { toast } from 'react-hot-toast'

interface ComposeBoxProps {
  profile: Profile | null
  onCreated: () => void
}

const MARKET_CREATION_FEE_USDC = 1

const MARKET_CATEGORIES = [
  'Crypto',
  'Culture',
  'Economics',
  'Miscellaneous',
  'Politics',
  'Sports',
]

interface DetectedPyth {
  isPyth: boolean
  asset?: 'BTC' | 'ETH' | 'SOL' | 'PYTH'
  priceFeedId?: string
  targetPrice?: number
  resolveAbove?: boolean
  assetName?: string
}

const PYTH_ASSETS = [
  {
    keys: ['btc', 'bitcoin'],
    symbol: 'BTC',
    name: 'Bitcoin',
    feedId: 'e62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43',
  },
  {
    keys: ['eth', 'ethereum'],
    symbol: 'ETH',
    name: 'Ethereum',
    feedId: 'ff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace',
  },
  {
    keys: ['sol', 'solana'],
    symbol: 'SOL',
    name: 'Solana',
    feedId: 'ef0d8b6fda2ceba41da15d4095d1da392a0d2f8ed0c6c7bc0f4cfac8c280b56d',
  },
  {
    keys: ['pyth'],
    symbol: 'PYTH',
    name: 'Pyth Network',
    feedId: 'ff95c1c7087f17b7e28d94fbc2be6e3d063074fc4c5207c74495c1840b71e19d',
  },
]

function detectPythMarket(category: string, question: string): DetectedPyth {
  if (category !== 'Crypto') {
    return { isPyth: false }
  }

  const q = question.toLowerCase()

  const matchedAsset = PYTH_ASSETS.find((asset) =>
    asset.keys.some((key) => {
      const regex = new RegExp(`\\b${key}\\b`, 'i')
      return regex.test(q)
    }),
  )

  if (!matchedAsset) {
    return { isPyth: false }
  }

  const priceRegex = /(?:\$)?\s*(\d{1,3}(?:,\d{3})*(?:\.\d+)?)\s*(k)?\b/i
  const match = q.match(priceRegex)
  if (!match) {
    return { isPyth: false }
  }

  let priceValue = parseFloat(match[1].replace(/,/g, ''))
  const isK = !!match[2]
  if (isK) {
    priceValue *= 1000
  }

  if (Number.isNaN(priceValue) || priceValue <= 0) {
    return { isPyth: false }
  }

  const resolveAbove = !/\b(below|under|drop|less|down|falling)\b/i.test(q)

  return {
    isPyth: true,
    asset: matchedAsset.symbol as any,
    priceFeedId: matchedAsset.feedId,
    targetPrice: priceValue,
    resolveAbove,
    assetName: matchedAsset.name,
  }
}

export default function ComposeBox({ profile, onCreated }: ComposeBoxProps) {
  const { transferToTreasury } = useUsdcTransfer()
  const { mutateAsync: createMarketPost } = useCreateMarketPostMutation()
  const { mutateAsync: createNormalPost } = useCreateNormalPostMutation()
  const [content, setContent] = useState('')
  const [isMarket, setIsMarket] = useState(false)
  const [market, setMarket] = useState<MarketInput>({
    content: '',
    question: '',
    category: 'Crypto',
    deadline: '',
    resolutionSource: '',
    yesCondition: '',
    noCondition: '',
  })

  const [agentReview, setAgentReview] = useState<VerityAgentReview | null>(null)
  const [reviewedSignature, setReviewedSignature] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const detectedPyth = useMemo(() => {
    return detectPythMarket(market.category, market.question)
  }, [market.category, market.question])

  const hasMarketFields = useMemo(() => {
    const commonOk =
      market.question.trim().length > 0 &&
      market.category.trim().length > 0 &&
      market.deadline.trim().length > 0

    if (!commonOk) return false

    if (detectedPyth.isPyth) {
      return (
        detectedPyth.targetPrice !== undefined &&
        !Number.isNaN(detectedPyth.targetPrice) &&
        detectedPyth.targetPrice > 0
      )
    }

    return (
      market.resolutionSource.trim().length > 0 &&
      market.yesCondition.trim().length > 0 &&
      market.noCondition.trim().length > 0
    )
  }, [market, detectedPyth])

  const marketSignature = useMemo(
    () =>
      JSON.stringify({
        content: content.trim(),
        question: market.question.trim(),
        category: market.category.trim(),
        deadline: market.deadline,
        resolutionSource: detectedPyth.isPyth
          ? 'Pyth Network Price Oracle'
          : market.resolutionSource.trim(),
        yesCondition: detectedPyth.isPyth
          ? `${detectedPyth.assetName}/USD price is ${detectedPyth.resolveAbove ? '>=' : '<'} $${detectedPyth.targetPrice} at the deadline according to Pyth.`
          : market.yesCondition.trim(),
        noCondition: detectedPyth.isPyth
          ? `${detectedPyth.assetName}/USD price is ${detectedPyth.resolveAbove ? '<' : '>='} $${detectedPyth.targetPrice} at the deadline according to Pyth.`
          : market.noCondition.trim(),
        isPyth: detectedPyth.isPyth,
        priceFeedId: detectedPyth.priceFeedId,
        targetPrice: detectedPyth.targetPrice,
        resolveAbove: detectedPyth.resolveAbove,
      }),
    [content, market, detectedPyth],
  )

  const liveAgentReview = useMemo(() => {
    let finalMarket = { ...market }
    if (detectedPyth.isPyth) {
      finalMarket.resolutionSource = 'Pyth Network Price Oracle'
      finalMarket.yesCondition = `${detectedPyth.assetName}/USD price is ${detectedPyth.resolveAbove ? '>=' : '<'} $${detectedPyth.targetPrice} at the deadline according to Pyth.`
      finalMarket.noCondition = `${detectedPyth.assetName}/USD price is ${detectedPyth.resolveAbove ? '<' : '>='} $${detectedPyth.targetPrice} at the deadline according to Pyth.`
    }
    return reviewPredictionPost({
      ...finalMarket,
      content,
    })
  }, [content, market, detectedPyth])

  const reviewIsCurrent = Boolean(
    agentReview && reviewedSignature === marketSignature,
  )
  const predictionApproved = Boolean(reviewIsCurrent && agentReview?.approved)
  const visibleAgentReview =
    reviewIsCurrent && agentReview ? agentReview : liveAgentReview

  const canUsePrimaryAction = useMemo(() => {
    if (!profile || saving) return false
    if (!isMarket) return content.trim().length > 0
    return hasMarketFields
  }, [content, hasMarketFields, isMarket, profile, saving])

  function runAgentReview() {
    setAgentReview(liveAgentReview)
    setReviewedSignature(marketSignature)
    setError(liveAgentReview.approved ? null : liveAgentReview.summary)
  }

  const primaryLabel = useMemo(() => {
    if (saving) return 'Posting'
    if (!isMarket) return 'Post'
    if (!predictionApproved) return 'Review'
    return `Pay ${MARKET_CREATION_FEE_USDC} USDC & Post`
  }, [isMarket, predictionApproved, saving])

  const marketReadyText = useMemo(() => {
    return 'Verity AI reviews prediction quality before the Arc testnet USDC creation payment is enabled.'
  }, [])

  async function submit() {
    if (!profile || !canUsePrimaryAction) return

    if (isMarket && !predictionApproved) {
      runAgentReview()
      return
    }

    setSaving(true)
    setError(null)

    const tid = toast.loading(
      isMarket ? 'Processing market payment...' : 'Publishing post...',
    )

    try {
      if (isMarket) {
        let priceFeedId: string | undefined
        let targetPrice: number | undefined
        let resolveAbove: boolean | undefined

        let finalMarket = { ...market }

        if (detectedPyth.isPyth) {
          priceFeedId = detectedPyth.priceFeedId
          targetPrice = Math.round((detectedPyth.targetPrice || 0) * 1e8)
          resolveAbove = detectedPyth.resolveAbove

          finalMarket.resolutionSource = 'Pyth Network Price Oracle'
          finalMarket.yesCondition = `${detectedPyth.assetName}/USD price is ${detectedPyth.resolveAbove ? '>=' : '<'} $${detectedPyth.targetPrice} at the deadline according to Pyth.`
          finalMarket.noCondition = `${detectedPyth.assetName}/USD price is ${detectedPyth.resolveAbove ? '<' : '>='} $${detectedPyth.targetPrice} at the deadline according to Pyth.`
        }

        const payment = await transferToTreasury(MARKET_CREATION_FEE_USDC)
        const result = await createMarketPost({
          authorId: profile.id,
          ...finalMarket,
          content,
          creationFeeTxHash: payment.hash,
          feeCollectorAddress: payment.treasuryAddress,
          priceFeedId,
          targetPrice,
          resolveAbove,
        })

        if (result.warning) setError(result.warning)
        setMarket({
          content: '',
          question: '',
          category: 'Crypto',
          deadline: '',
          resolutionSource: '',
          yesCondition: '',
          noCondition: '',
        })
        setAgentReview(null)
        setReviewedSignature('')
        setIsMarket(false)
        toast.success('Market successfully created!', { id: tid })
      } else {
        await createNormalPost({ authorId: profile.id, content })
        toast.success('Post successfully published!', { id: tid })
      }

      setContent('')
      onCreated()
    } catch (caught: any) {
      const msg = caught?.message || 'Unable to create post.'
      setError(msg)
      toast.error(msg, { id: tid })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex gap-4 rounded-[18px] border border-[(--border)] bg-[(--surface)] p-4 shadow-sm">
      {/* Avatar */}
      <div className="shrink-0">
        <div className="h-10 w-10 rounded-full bg-[(--inverse)] animate-pulse" />
      </div>

      <div className="flex-1 flex flex-col pt-1">
        <textarea
          disabled={!profile || saving}
          onChange={(event) => setContent(event.target.value)}
          placeholder={
            profile ? "What's your conviction?" : 'Connect wallet to post'
          }
          value={content}
          className="min-h-[60px] w-full resize-none border-none bg-transparent text-lg font-semibold text-[(--foreground)] outline-none placeholder:text-[(--muted)]"
        />

        {isMarket && (
          <div className="mt-3 grid gap-3 rounded-[13px] border border-dashed border-[(--border)] bg-[(--surface-muted)] p-3">
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-[8px] border border-[(--border)] bg-[(--surface)] px-3 py-2 font-mono text-[11px] text-[(--muted)]">
              <span>
                Prediction posts cost {MARKET_CREATION_FEE_USDC} Arc testnet
                USDC
              </span>
              <span>Verity AI review required</span>
            </div>

            <input
              className="h-10 rounded-[8px] border border-[(--border)] bg-[(--surface)] px-3 text-sm text-[(--foreground)] outline-none placeholder:text-[(--muted)]"
              onChange={(event) =>
                setMarket((current) => ({
                  ...current,
                  question: event.target.value,
                }))
              }
              placeholder="Market question (e.g. Will BTC reach $100k?)"
              value={market.question}
            />

            <div className="grid gap-2 sm:grid-cols-2">
              <select
                className="h-10 rounded-[8px] border border-[(--border)] bg-[(--surface)] px-3 text-sm text-[(--foreground)] outline-none"
                onChange={(event) =>
                  setMarket((current) => ({
                    ...current,
                    category: event.target.value,
                  }))
                }
                value={market.category}
              >
                {MARKET_CATEGORIES.map((category) => (
                  <option key={category}>{category}</option>
                ))}
              </select>
              <input
                className="h-10 rounded-[8px] border border-[(--border)] bg-[(--surface)] px-3 text-sm text-[(--foreground)] outline-none"
                onChange={(event) =>
                  setMarket((current) => ({
                    ...current,
                    deadline: event.target.value,
                  }))
                }
                type="datetime-local"
                value={market.deadline}
              />
            </div>

            {/* Pyth Programmatic Detection Display OR Manual Resolution Fields */}
            {detectedPyth.isPyth ? (
              <div className="rounded-[10px] border border-[(--color-brand-secondary)]/30 bg-[(--color-brand-secondary)]/5 p-3 flex flex-col gap-1.5">
                <p className="text-xs text-[(--foreground)] font-semibold leading-relaxed">
                  Verity detected this is a quantitative price prediction for{' '}
                  <span className="text-[(--color-brand-secondary)]">
                    {detectedPyth.assetName}
                  </span>
                  .
                </p>
                <div className="mt-1 grid grid-cols-3 gap-2 rounded-[8px] bg-[(--surface)] border border-[(--border)] p-2 font-mono text-[10px] text-[(--muted)]">
                  <div className="flex flex-col gap-0.5">
                    <span>FEED</span>
                    <span className="font-bold text-[(--foreground)]">
                      {detectedPyth.asset}/USD
                    </span>
                  </div>
                  <div className="flex flex-col gap-0.5">
                    <span>TARGET</span>
                    <span className="font-bold text-[(--foreground)]">
                      ${detectedPyth.targetPrice?.toLocaleString()}
                    </span>
                  </div>
                  <div className="flex flex-col gap-0.5">
                    <span>CONDITION</span>
                    <span className="font-bold text-[(--foreground)]">
                      {detectedPyth.resolveAbove
                        ? 'Price >= Target'
                        : 'Price < Target'}
                    </span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="grid gap-2 border-t border-dashed border-[(--border)] pt-2">
                <label className="text-[10px] font-bold text-[(--muted)] uppercase tracking-wider">
                  Resolution Criteria Details
                </label>
                <input
                  className="h-10 rounded-[8px] border border-[(--border)] bg-[(--surface)] px-3 text-sm text-[(--foreground)] outline-none placeholder:text-[(--muted)]"
                  onChange={(event) =>
                    setMarket((current) => ({
                      ...current,
                      resolutionSource: event.target.value,
                    }))
                  }
                  placeholder="Resolution source (e.g. CoinGecko, official reports)"
                  value={market.resolutionSource}
                />
                <div className="grid gap-2 sm:grid-cols-2">
                  <input
                    className="h-10 rounded-[8px] border border-[(--color-brand-secondary)]/40 bg-[(--surface)] px-3 text-sm text-[(--foreground)] outline-none placeholder:text-[(--muted)]"
                    onChange={(event) =>
                      setMarket((current) => ({
                        ...current,
                        yesCondition: event.target.value,
                      }))
                    }
                    placeholder="YES condition details"
                    value={market.yesCondition}
                  />
                  <input
                    className="h-10 rounded-[8px] border border-[(--color-brand-accent)]/40 bg-[(--surface)] px-3 text-sm text-[(--foreground)] outline-none placeholder:text-[(--muted)]"
                    onChange={(event) =>
                      setMarket((current) => ({
                        ...current,
                        noCondition: event.target.value,
                      }))
                    }
                    placeholder="NO condition details"
                    value={market.noCondition}
                  />
                </div>
              </div>
            )}

            <div className="rounded-[10px] border border-[(--border)] bg-[(--surface)] p-3">
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <span className="font-mono text-[11px] font-black uppercase tracking-[0.12em] text-[(--foreground)]">
                  Verity AI Agent
                </span>
                <span
                  className={`font-mono text-[11px] font-bold ${visibleAgentReview.approved ? 'text-[(--color-brand-secondary)]' : 'text-[(--color-brand-accent)]'}`}
                >
                  {visibleAgentReview.score}/100
                </span>
              </div>
              <p className="mb-2 text-sm text-[(--muted)]">
                {reviewIsCurrent ? visibleAgentReview.summary : marketReadyText}
              </p>
              <div className="grid gap-1">
                {visibleAgentReview.findings.slice(0, 3).map((finding) => (
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
            </div>
          </div>
        )}

        {error && (
          <p className="mt-2 text-sm text-[(--color-brand-accent)]">{error}</p>
        )}

        <div className="mt-2 flex items-center justify-between border-t border-dashed border-[(--border)] pt-3">
          <div className="flex items-center gap-1 text-[(--muted)]">
            <button
              aria-label="Add image"
              className="rounded-full p-2 transition-colors hover:bg-[(--surface-hover)] hover:text-[(--foreground)]"
              type="button"
            >
              <ImageIcon className="w-5 h-5" />
            </button>
            <button
              aria-label="Create market"
              aria-pressed={isMarket}
              className={`rounded-full p-2 transition-colors hover:bg-[(--surface-hover)] hover:text-[(--foreground)] ${
                isMarket
                  ? 'bg-[(--color-brand-secondary)]/10 text-[(--color-brand-secondary)]'
                  : ''
              }`}
              onClick={() => setIsMarket((current) => !current)}
              type="button"
            >
              <BarChart2 className="w-5 h-5" />
            </button>
            <button
              aria-label="Add emoji"
              className="hidden rounded-full p-2 transition-colors hover:bg-[(--surface-hover)] hover:text-[(--foreground)] sm:block"
              type="button"
            >
              <Smile className="w-5 h-5" />
            </button>
            <button
              aria-label="Add location"
              className="hidden rounded-full p-2 transition-colors hover:bg-[(--surface-hover)] hover:text-[(--foreground)] sm:block"
              type="button"
            >
              <MapPin className="w-5 h-5" />
            </button>
          </div>

          <button
            className={`rounded-[10px] px-5 py-2 font-mono text-[10px] font-black uppercase tracking-[0.16em] transition-opacity ${
              canUsePrimaryAction
                ? 'bg-[(--inverse)] text-[(--inverse-text)] hover:opacity-85'
                : 'cursor-not-allowed bg-zinc-300 text-zinc-500'
            }`}
            disabled={!canUsePrimaryAction}
            onClick={submit}
            type="button"
          >
            {primaryLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
