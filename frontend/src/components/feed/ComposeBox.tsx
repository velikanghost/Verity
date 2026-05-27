'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { BarChart2 } from 'lucide-react'
import { type MarketInput, type Profile } from '@/lib/verity'
import { reviewPredictionPost, type VerityAgentReview } from '@/lib/verityAgent'
import { useUsdcTransfer } from '@/hooks/useUsdcTransfer'
import {
  useCreateMarketPostMutation,
  useCreateNormalPostMutation,
} from '@/store/verity/verityQueries'
import { toast } from 'react-hot-toast'
import { formatWeb3Error } from '@/lib/arc'

interface ComposeBoxProps {
  profile: Profile | null
  onCreated: () => void
}

type ComposeIntent = 'take' | 'market'
type PythAssetSymbol = 'BTC' | 'ETH' | 'SOL' | 'PYTH'

function generateObjectId(): string {
  const timestamp = Math.floor(new Date().getTime() / 1000)
    .toString(16)
    .padStart(8, '0')
  const machine = Math.floor(Math.random() * 16777215)
    .toString(16)
    .padStart(6, '0')
  const pid = Math.floor(Math.random() * 65535)
    .toString(16)
    .padStart(4, '0')
  const increment = Math.floor(Math.random() * 16777215)
    .toString(16)
    .padStart(6, '0')
  return (timestamp + machine + pid + increment).substring(0, 24)
}

const MARKET_CATEGORIES = [
  'Crypto',
  'Culture',
  'Economics',
  'Miscellaneous',
  'Politics',
  'Sports',
] as const

interface DetectedPyth {
  isPyth: boolean
  asset?: PythAssetSymbol
  priceFeedId?: string
  targetPrice?: number
  resolveAbove?: boolean
  assetName?: string
}

interface PythAssetDefinition {
  keys: string[]
  symbol: PythAssetSymbol
  name: string
  feedId: string
}

const PYTH_ASSETS: PythAssetDefinition[] = [
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
    asset: matchedAsset.symbol,
    priceFeedId: matchedAsset.feedId,
    targetPrice: priceValue,
    resolveAbove,
    assetName: matchedAsset.name,
  }
}

export default function ComposeBox({ profile, onCreated }: ComposeBoxProps) {
  const composerRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const marketQuestionRef = useRef<HTMLInputElement>(null)
  const { createMarketPreDeposit } = useUsdcTransfer()
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

  useEffect(() => {
    function applyIntent(intent: ComposeIntent) {
      setIsMarket(intent === 'market')
      window.requestAnimationFrame(() => {
        composerRef.current?.scrollIntoView({
          behavior: 'smooth',
          block: 'center',
        })
        if (intent === 'market') {
          marketQuestionRef.current?.focus()
        } else {
          textareaRef.current?.focus()
        }
      })
    }

    const storedIntent = window.sessionStorage.getItem(
      'verity-compose-intent',
    ) as ComposeIntent | null
    if (storedIntent === 'take' || storedIntent === 'market') {
      window.sessionStorage.removeItem('verity-compose-intent')
      applyIntent(storedIntent)
    }

    function handleComposeIntent(event: Event) {
      const intent = (event as CustomEvent<ComposeIntent>).detail
      if (intent === 'take' || intent === 'market') applyIntent(intent)
    }

    window.addEventListener('verity-compose-intent', handleComposeIntent)
    return () =>
      window.removeEventListener('verity-compose-intent', handleComposeIntent)
  }, [])

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
        content: market.question.trim(),
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
    [market, detectedPyth],
  )

  const liveAgentReview = useMemo(() => {
    const finalMarket = { ...market }
    if (detectedPyth.isPyth) {
      finalMarket.resolutionSource = 'Pyth Network Price Oracle'
      finalMarket.yesCondition = `${detectedPyth.assetName}/USD price is ${detectedPyth.resolveAbove ? '>=' : '<'} $${detectedPyth.targetPrice} at the deadline according to Pyth.`
      finalMarket.noCondition = `${detectedPyth.assetName}/USD price is ${detectedPyth.resolveAbove ? '<' : '>='} $${detectedPyth.targetPrice} at the deadline according to Pyth.`
    }
    return reviewPredictionPost({
      ...finalMarket,
      content: market.question.trim(),
    })
  }, [market, detectedPyth])

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
    if (!isMarket) return 'Take'
    if (!predictionApproved) return 'Review'
    return 'Pay 11 USDC & Create Market'
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

        const finalMarket = { ...market }

        if (detectedPyth.isPyth) {
          priceFeedId = detectedPyth.priceFeedId
          targetPrice = Math.round((detectedPyth.targetPrice || 0) * 1e8)
          resolveAbove = detectedPyth.resolveAbove

          finalMarket.resolutionSource = 'Pyth Network Price Oracle'
          finalMarket.yesCondition = `${detectedPyth.assetName}/USD price is ${detectedPyth.resolveAbove ? '>=' : '<'} $${detectedPyth.targetPrice} at the deadline according to Pyth.`
          finalMarket.noCondition = `${detectedPyth.assetName}/USD price is ${detectedPyth.resolveAbove ? '<' : '>='} $${detectedPyth.targetPrice} at the deadline according to Pyth.`
        }

        const marketId = generateObjectId()
        const payment = await createMarketPreDeposit(marketId, 10)
        const result = await createMarketPost({
          authorId: profile.id,
          marketId,
          ...finalMarket,
          content: finalMarket.question.trim(),
          creationFeeTxHash: payment.hash,
          feeCollectorAddress: payment.factoryAddress,
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
      const msg = formatWeb3Error(caught)
      setError(msg)
      toast.error(msg, { id: tid })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div
      className="verity-card flex gap-3 p-4 sm:gap-4 sm:p-5"
      ref={composerRef}
    >
      {/* Avatar */}
      <div className="shrink-0">
        <div className="verity-blob h-10 w-10 animate-pulse bg-ember-orange">
          <span className="verity-blob-smile" />
        </div>
      </div>

      <div className="flex-1 flex flex-col pt-1">
        {!isMarket && (
          <textarea
            ref={textareaRef}
            disabled={!profile || saving}
            onChange={(event) => setContent(event.target.value)}
            placeholder={
              profile ? "What's your conviction?" : 'Connect wallet to post'
            }
            value={content}
            className="min-h-[60px] w-full resize-none border-none bg-transparent text-[19px] font-semibold leading-[1.3] tracking-[-0.25px] text-midnight outline-none placeholder:text-ash"
          />
        )}

        {isMarket && (
          <div className="grid gap-3 rounded-[12px] bg-parchment-card p-3 shadow-[(--shadow-subtle)]">
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-[10px] bg-white-surface px-3 py-2 font-mono text-[11px] text-ash shadow-[(--shadow-subtle)]">
              <span>
                Prediction posts cost 11 USDC (1 USDC fee + 10 USDC creator
                launch liquidity)
              </span>
              <span>Verity AI review required</span>
            </div>

            <input
              ref={marketQuestionRef}
              className="h-10 rounded-[10px] bg-white-surface px-3 text-sm tracking-[-0.18px] text-charcoal-primary shadow-[(--shadow-subtle)] outline-none placeholder:text-ash focus:ring-2 focus:ring-stone-surface"
              disabled={!profile || saving}
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
                className="h-10 rounded-[10px] bg-white-surface px-3 text-sm tracking-[-0.18px] text-charcoal-primary shadow-[(--shadow-subtle)] outline-none"
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
                className="h-10 rounded-[10px] bg-white-surface px-3 text-sm tracking-[-0.18px] text-charcoal-primary shadow-[(--shadow-subtle)] outline-none"
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
              <div className="flex flex-col gap-1.5 rounded-[10px] bg-meadow-green/10 p-3 shadow-[(--shadow-subtle)]">
                <p className="text-xs font-semibold leading-relaxed text-charcoal-primary">
                  Verity detected this is a quantitative price prediction for{' '}
                  <span className="text-meadow-green">
                    {detectedPyth.assetName}
                  </span>
                  .
                </p>
                <div className="mt-1 grid grid-cols-3 gap-2 rounded-[10px] bg-white-surface p-2 font-mono text-[10px] text-ash shadow-[(--shadow-subtle)]">
                  <div className="flex flex-col gap-0.5">
                    <span>FEED</span>
                    <span className="font-semibold text-charcoal-primary">
                      {detectedPyth.asset}/USD
                    </span>
                  </div>
                  <div className="flex flex-col gap-0.5">
                    <span>TARGET</span>
                    <span className="font-semibold text-charcoal-primary">
                      ${detectedPyth.targetPrice?.toLocaleString()}
                    </span>
                  </div>
                  <div className="flex flex-col gap-0.5">
                    <span>CONDITION</span>
                    <span className="font-semibold text-charcoal-primary">
                      {detectedPyth.resolveAbove
                        ? 'Price >= Target'
                        : 'Price < Target'}
                    </span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="grid gap-2 border-t border-dashed border-stone-surface pt-2">
                <label className="text-[10px] font-semibold uppercase tracking-wider text-ash">
                  Resolution Criteria Details
                </label>
                <input
                  className="h-10 rounded-[10px] bg-white-surface px-3 text-sm tracking-[-0.18px] text-charcoal-primary shadow-[(--shadow-subtle)] outline-none placeholder:text-ash"
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
                    className="h-10 rounded-[10px] bg-white-surface px-3 text-sm tracking-[-0.18px] text-charcoal-primary shadow-[(--shadow-subtle)] outline-none placeholder:text-ash focus:ring-2 focus:ring-meadow-green/25"
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
                    className="h-10 rounded-[10px] bg-white-surface px-3 text-sm tracking-[-0.18px] text-charcoal-primary shadow-[(--shadow-subtle)] outline-none placeholder:text-ash focus:ring-2 focus:ring-ember-orange/20"
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

            <div className="rounded-[10px] bg-white-surface p-3 shadow-[(--shadow-subtle)]">
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <span className="font-mono text-[11px] font-semibold uppercase tracking-[0.12em] text-charcoal-primary">
                  Verity AI Agent
                </span>
                <span
                  className={`font-mono text-[11px] font-semibold ${visibleAgentReview.approved ? 'text-meadow-green' : 'text-ember-orange'}`}
                >
                  {visibleAgentReview.score}/100
                </span>
              </div>
              <p className="mb-2 text-sm text-graphite">
                {reviewIsCurrent ? visibleAgentReview.summary : marketReadyText}
              </p>
              <div className="grid gap-1">
                {visibleAgentReview.findings.slice(0, 3).map((finding) => (
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
            </div>
          </div>
        )}

        {error && <p className="mt-2 text-sm text-ember-orange">{error}</p>}

        <div className="mt-2 flex items-center justify-between border-t border-dashed border-stone-surface pt-3">
          <div className="flex items-center gap-1 text-ash">
            <button
              aria-label="Create market"
              aria-pressed={isMarket}
              className={`clickable-icon p-2 hover:text-charcoal-primary ${
                isMarket ? 'bg-meadow-green/10 text-meadow-green' : ''
              }`}
              onClick={() => setIsMarket((current) => !current)}
              type="button"
            >
              <BarChart2 className="w-5 h-5" />
            </button>
          </div>

          <button
            className={`verity-pill px-5 py-2 text-sm font-semibold tracking-[-0.18px] ${
              canUsePrimaryAction
                ? 'clickable bg-inverse text-inverse-text hover:opacity-90'
                : 'cursor-not-allowed bg-stone-surface text-smoke'
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
