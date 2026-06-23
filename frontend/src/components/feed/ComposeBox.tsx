"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import {
  ShieldCheck,
  Plus,
  Trash2,
  Calendar,
  Sparkles,
  HelpCircle,
  X,
} from "lucide-react"
import { type MarketInput, type Profile } from "@/lib/verity"
import { Input } from "@/components/ui/input"
import { reviewPredictionPost, type VerityAgentReview } from "@/lib/verityAgent"
import { useUsdcTransfer } from "@/hooks/useUsdcTransfer"
import { useUsdcBalance } from "@/hooks/useUsdcBalance"
import { useAuth } from "@/components/providers/AuthModals"
import { useMarketLimits } from "@/hooks/useMarketLimits"
import {
  useCreateMarketPostMutation,
  useValidateMarketPostMutation,
  useGetCategoriesQuery,
} from "@/store/verity/verityQueries"
import { toast } from "@/lib/toast"
import { FACTORY_ADDRESS } from "@/lib/arc"

interface ComposeBoxProps {
  profile: Profile | null
  onCreated: () => void
}

type ComposeIntent = "take" | "market"
type PythAssetSymbol = "BTC" | "ETH" | "SOL" | "PYTH"

function generateObjectId(): string {
  const timestamp = Math.floor(new Date().getTime() / 1000)
    .toString(16)
    .padStart(8, "0")
  const machine = Math.floor(Math.random() * 16777215)
    .toString(16)
    .padStart(6, "0")
  const pid = Math.floor(Math.random() * 65535)
    .toString(16)
    .padStart(4, "0")
  const increment = Math.floor(Math.random() * 16777215)
    .toString(16)
    .padStart(6, "0")
  return (timestamp + machine + pid + increment).substring(0, 24)
}

const MARKET_CATEGORIES = [
  "Sports",
  "Culture",
  "Crypto",
  "Economics",
  "Miscellaneous",
  "Politics",
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
    keys: ["btc", "bitcoin"],
    symbol: "BTC",
    name: "Bitcoin",
    feedId: "e62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43",
  },
  {
    keys: ["eth", "ethereum"],
    symbol: "ETH",
    name: "Ethereum",
    feedId: "ff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace",
  },
  {
    keys: ["sol", "solana"],
    symbol: "SOL",
    name: "Solana",
    feedId: "ef0d8b6fda2ceba41da15d4095d1da392a0d2f8ed0c6c7bc0f4cfac8c280b56d",
  },
  {
    keys: ["pyth"],
    symbol: "PYTH",
    name: "Pyth Network",
    feedId: "ff95c1c7087f17b7e28d94fbc2be6e3d063074fc4c5207c74495c1840b71e19d",
  },
]

function detectPythMarket(category: string, question: string): DetectedPyth {
  if (category !== "Crypto") {
    return { isPyth: false }
  }

  const q = question.toLowerCase()

  const matchedAsset = PYTH_ASSETS.find((asset) =>
    asset.keys.some((key) => {
      const regex = new RegExp(`\\b${key}\\b`, "i")
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

  let priceValue = parseFloat(match[1].replace(/,/g, ""))
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

export default function ComposeBox({ onCreated }: ComposeBoxProps) {
  const composerRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const marketQuestionRef = useRef<HTMLInputElement>(null)
  const { user, closeTxConfirm } = useAuth()
  const { createMarketPreDeposit } = useUsdcTransfer()
  const { rawBalance } = useUsdcBalance()
  const { data: limits } = useMarketLimits()
  const { data: categoriesData } = useGetCategoriesQuery()
  const { mutateAsync: validateMarketPost } = useValidateMarketPostMutation()
  const { mutateAsync: createMarketPost } = useCreateMarketPostMutation()

  const [content, setContent] = useState("")
  const [isMarket, setIsMarket] = useState(false)
  const [isMultiOption, setIsMultiOption] = useState(false)
  const [options, setOptions] = useState<string[]>(["", "", ""])

  const [market, setMarket] = useState<MarketInput>({
    content: "",
    question: "",
    category: "sports",
    deadline: "",
    resolutionSource: "",
    yesCondition: "",
    noCondition: "",
  })

  const [agentReview, setAgentReview] = useState<VerityAgentReview | null>(null)
  const [reviewedSignature, setReviewedSignature] = useState("")
  const [saving, setSaving] = useState(false)
  const [isValidating, setIsValidating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleFocusTake = () => {
    setIsMarket(true)
    if (content.trim()) {
      setMarket((current) => ({
        ...current,
        question: content,
      }))
    }
    window.requestAnimationFrame(() => {
      marketQuestionRef.current?.focus()
    })
  }

  useEffect(() => {
    function applyIntent(intent: ComposeIntent) {
      setIsMarket(true)
      window.requestAnimationFrame(() => {
        composerRef.current?.scrollIntoView({
          behavior: "smooth",
          block: "center",
        })
        marketQuestionRef.current?.focus()
      })
    }

    const storedIntent = window.sessionStorage.getItem(
      "verity-compose-intent",
    ) as ComposeIntent | null
    if (storedIntent === "take" || storedIntent === "market") {
      window.sessionStorage.removeItem("verity-compose-intent")
      applyIntent(storedIntent)
    }

    function handleComposeIntent(event: Event) {
      const intent = (event as CustomEvent<ComposeIntent>).detail
      if (intent === "take" || intent === "market") applyIntent(intent)
    }

    window.addEventListener("verity-compose-intent", handleComposeIntent)
    return () =>
      window.removeEventListener("verity-compose-intent", handleComposeIntent)
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

    if (isMultiOption) {
      const validOptions = options.filter((o) => o.trim().length > 0)
      return (
        validOptions.length >= 3 && market.resolutionSource.trim().length > 0
      )
    }

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
  }, [market, detectedPyth, isMultiOption, options])

  const marketSignature = useMemo(
    () =>
      JSON.stringify({
        content: market.question.trim(),
        question: market.question.trim(),
        category: market.category.trim(),
        deadline: market.deadline,
        resolutionSource: detectedPyth.isPyth
          ? "Pyth Network Price Oracle"
          : market.resolutionSource.trim(),
        yesCondition: isMultiOption
          ? "Any of the options wins"
          : detectedPyth.isPyth
            ? `${detectedPyth.assetName}/USD price is ${detectedPyth.resolveAbove ? ">=" : "<"} $${detectedPyth.targetPrice} at the deadline according to Pyth.`
            : market.yesCondition.trim(),
        noCondition: isMultiOption
          ? "None of the options wins"
          : detectedPyth.isPyth
            ? `${detectedPyth.assetName}/USD price is ${detectedPyth.resolveAbove ? "<" : ">="} $${detectedPyth.targetPrice} at the deadline according to Pyth.`
            : market.noCondition.trim(),
        isPyth: detectedPyth.isPyth,
        priceFeedId: detectedPyth.priceFeedId,
        targetPrice: detectedPyth.targetPrice,
        resolveAbove: detectedPyth.resolveAbove,
        options: isMultiOption
          ? options.filter((o) => o.trim().length > 0)
          : undefined,
      }),
    [market, detectedPyth, isMultiOption, options],
  )

  const liveAgentReview = useMemo(() => {
    const finalMarket = { ...market }
    if (isMultiOption) {
      finalMarket.yesCondition = "Any of the options wins"
      finalMarket.noCondition = "None of the options wins"
    } else if (detectedPyth.isPyth) {
      finalMarket.resolutionSource = "Pyth Network Price Oracle"
      finalMarket.yesCondition = `${detectedPyth.assetName}/USD price is ${detectedPyth.resolveAbove ? ">=" : "<"} $${detectedPyth.targetPrice} at the deadline according to Pyth.`
      finalMarket.noCondition = `${detectedPyth.assetName}/USD price is ${detectedPyth.resolveAbove ? "<" : ">="} $${detectedPyth.targetPrice} at the deadline according to Pyth.`
    }
    return reviewPredictionPost({
      ...finalMarket,
      content: market.question.trim(),
    })
  }, [market, detectedPyth, isMultiOption])

  const reviewIsCurrent = Boolean(
    agentReview && reviewedSignature === marketSignature,
  )
  const predictionApproved = Boolean(reviewIsCurrent && agentReview?.approved)
  const visibleAgentReview =
    reviewIsCurrent && agentReview ? agentReview : liveAgentReview

  const creatorLp = limits?.creatorMinLock ?? 5
  const creationFee = limits?.marketCreationFee ?? 1
  const dynamicCost = creatorLp + creationFee

  const requiredMarketCost = useMemo(() => {
    return dynamicCost
  }, [dynamicCost])

  const isBalanceInsufficient = useMemo(() => {
    if (!user || !isMarket) return false
    const rawRequired = BigInt(requiredMarketCost * 1e6)
    return rawBalance < rawRequired
  }, [user, isMarket, requiredMarketCost, rawBalance])

  const canUsePrimaryAction = useMemo(() => {
    if (!user || saving || isValidating) return false
    if (!isMarket) return content.trim().length > 0
    return hasMarketFields && !isBalanceInsufficient
  }, [
    content,
    hasMarketFields,
    isMarket,
    user,
    saving,
    isValidating,
    isBalanceInsufficient,
  ])

  async function runAgentReview() {
    setIsValidating(true)
    setError(null)

    try {
      // 1. Check client-side agent review first
      if (!liveAgentReview.approved) {
        setError(liveAgentReview.summary)
        setAgentReview(liveAgentReview)
        setReviewedSignature(marketSignature)
        return
      }

      // Build the final market payload for server-side validation
      const finalMarket = { ...market }
      if (isMultiOption) {
        finalMarket.yesCondition = "Any of the options wins"
        finalMarket.noCondition = "None of the options wins"
      } else if (detectedPyth.isPyth) {
        finalMarket.resolutionSource = "Pyth Network Price Oracle"
        finalMarket.yesCondition = `${detectedPyth.assetName}/USD price is ${detectedPyth.resolveAbove ? ">=" : "<"} $${detectedPyth.targetPrice} at the deadline according to Pyth.`
        finalMarket.noCondition = `${detectedPyth.assetName}/USD price is ${detectedPyth.resolveAbove ? "<" : ">="} $${detectedPyth.targetPrice} at the deadline according to Pyth.`
      }

      // 2. Run backend validation
      await validateMarketPost(finalMarket)

      // 3. Set approval only if backend validation successfully passes
      setAgentReview(liveAgentReview)
      setReviewedSignature(marketSignature)
    } catch (validationErr: any) {
      const msg = validationErr?.message || "Market validation failed"
      setError(msg)
      setAgentReview(null)
      setReviewedSignature("")
    } finally {
      setIsValidating(false)
    }
  }

  const handleAddOption = () => {
    setOptions((current) => [...current, ""])
  }

  const handleRemoveOption = (index: number) => {
    if (options.length <= 3) {
      toast.error("Multi-option markets require at least 3 options.")
      return
    }
    setOptions((current) => current.filter((_, i) => i !== index))
  }

  const handleOptionChange = (index: number, val: string) => {
    setOptions((current) => {
      const next = [...current]
      next[index] = val
      return next
    })
  }

  const primaryLabel = useMemo(() => {
    if (saving) return "Posting..."
    if (isValidating) return "Reviewing..."
    if (!isMarket) return "Post"
    if (!predictionApproved) return "Review"
    return `Pay ${dynamicCost} USDC & Create Market`
  }, [
    isMarket,
    predictionApproved,
    saving,
    isValidating,
    dynamicCost,
    isBalanceInsufficient,
  ])

  async function submit() {
    if (!user || !canUsePrimaryAction) return

    if (isMarket && !predictionApproved) {
      await runAgentReview()
      return
    }

    if (isMarket) {
      if (isBalanceInsufficient) {
        toast.error(
          `Insufficient USDC balance. You need at least ${requiredMarketCost} USDC to create a market`,
        )
        return
      }
    }

    setSaving(true)
    setError(null)

    const tid = toast.loading(
      isMarket ? "Processing market payment..." : "Publishing post...",
    )

    try {
      if (isMarket) {
        let priceFeedId: string | undefined
        let targetPrice: number | undefined
        let resolveAbove: boolean | undefined

        const finalMarket = { ...market }

        if (detectedPyth.isPyth && !isMultiOption) {
          priceFeedId = detectedPyth.priceFeedId
          targetPrice = Math.round((detectedPyth.targetPrice || 0) * 1e8)
          resolveAbove = detectedPyth.resolveAbove

          finalMarket.resolutionSource = "Pyth Network Price Oracle"
          finalMarket.yesCondition = `${detectedPyth.assetName}/USD price is ${detectedPyth.resolveAbove ? ">=" : "<"} $${detectedPyth.targetPrice} at the deadline according to Pyth.`
          finalMarket.noCondition = `${detectedPyth.assetName}/USD price is ${detectedPyth.resolveAbove ? "<" : ">="} $${detectedPyth.targetPrice} at the deadline according to Pyth.`
        }

        const marketId = generateObjectId()
        let txHash = ""

        if (isMultiOption) {
          const validOptions = options.filter((o) => o.trim().length > 0)
          const payment = await createMarketPreDeposit(marketId, creatorLp, true)
          txHash = payment.hash

          await createMarketPost({
            authorId: user.id,
            marketId,
            ...finalMarket,
            yesCondition: "Any of the options wins",
            noCondition: "None of the options wins",
            content: finalMarket.question.trim(),
            creationFeeTxHash: txHash,
            feeCollectorAddress: FACTORY_ADDRESS,
            outcomeCount: validOptions.length,
            outcomes: validOptions,
          })
        } else {
          // Binary Market Pre-Deposit
          const payment = await createMarketPreDeposit(marketId, creatorLp, true)
          txHash = payment.hash

          await createMarketPost({
            authorId: user.id,
            marketId,
            ...finalMarket,
            content: finalMarket.question.trim(),
            creationFeeTxHash: txHash,
            feeCollectorAddress: FACTORY_ADDRESS,
            priceFeedId,
            targetPrice,
            resolveAbove,
          })
        }

        setMarket({
          content: "",
          question: "",
          category: "sports",
          deadline: "",
          resolutionSource: "",
          yesCondition: "",
          noCondition: "",
        })
        setOptions(["", "", ""])
        setIsMultiOption(false)
        setAgentReview(null)
        setReviewedSignature("")
        setIsMarket(false)
        toast.success("Market successfully created!", { id: tid })
        closeTxConfirm()
      }

      setContent("")
      onCreated()
    } catch (caught: any) {
      closeTxConfirm()
      if (!caught.message?.includes("rejected")) {
        setError(caught.message || "Failed to submit post.")
        toast.error(caught.message || "Execution failed.", { id: tid })
      } else {
        toast.dismiss(tid)
      }
    } finally {
      setSaving(false)
    }
  }

  return (
    <div
      className="verity-card flex flex-col gap-3 p-4 sm:gap-4 sm:p-5 border border-border bg-surface-solid shadow-subtle transition-all duration-300"
      ref={composerRef}
    >
      {/* Main Composer Row */}
      <div className="flex gap-3 sm:gap-4">
        {/* Avatar */}
        <div className={`shrink-0 ${isMarket ? "hidden sm:block" : ""}`}>
          <div className="verity-blob h-10 w-10 animate-pulse bg-ember-orange">
            <span className="verity-blob-smile" />
          </div>
        </div>

        <div className="flex-1 flex flex-col pt-1 space-y-3">
          {!isMarket && (
            <textarea
              ref={textareaRef}
              disabled={!user || saving || isValidating}
              onChange={(event) => setContent(event.target.value)}
              onFocus={handleFocusTake}
              placeholder="What's your conviction? Create a Market..."
              value={content}
              className="min-h-[60px] w-full resize-none border-none bg-transparent text-[19px] font-semibold leading-[1.3] tracking-[-0.25px] text-charcoal-primary outline-none placeholder:text-ash"
            />
          )}

          {isMarket && (
            <div className="grid gap-3 rounded-xl bg-surface-muted/50 dark:bg-surface-muted/30 p-4 border border-border">
              {/* Mode Selector (Binary vs Multi-Option) */}
              <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between border-b border-border/40 pb-3 mb-1">
                <div className="flex items-center justify-between w-full sm:w-auto">
                  <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-ash">
                    Market Outcome Mode
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setIsMarket(false)
                      setContent("")
                    }}
                    className="flex h-7 w-7 sm:hidden items-center justify-center rounded-full bg-stone-100 hover:bg-stone-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-ash hover:text-charcoal-primary transition-all cursor-pointer"
                    aria-label="Cancel"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>

                <div className="flex items-center justify-between sm:justify-end gap-2 w-full sm:w-auto">
                  <div className="flex rounded-lg bg-stone-surface/50 dark:bg-stone-surface/30 p-0.5 border border-border text-xs font-semibold w-full sm:w-auto">
                    <button
                      type="button"
                      onClick={() => {
                        setIsMultiOption(false)
                        setAgentReview(null)
                        setReviewedSignature("")
                      }}
                      className={`flex-1 sm:flex-none text-center px-3 py-1.5 rounded-md transition-all cursor-pointer ${
                        !isMultiOption
                          ? "bg-white dark:bg-zinc-800 text-charcoal-primary border border-border/80 shadow-sm"
                          : "text-ash hover:text-charcoal-primary"
                      }`}
                    >
                      Binary YES/NO
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setIsMultiOption(true)
                        setAgentReview(null)
                        setReviewedSignature("")
                      }}
                      className={`flex-1 sm:flex-none text-center px-3 py-1.5 rounded-md transition-all cursor-pointer ${
                        isMultiOption
                          ? "bg-white dark:bg-zinc-800 text-charcoal-primary border border-border/80 shadow-sm"
                          : "text-ash hover:text-charcoal-primary"
                      }`}
                    >
                      Multi-Option List
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setIsMarket(false)
                      setContent("")
                    }}
                    className="hidden sm:flex h-8 w-8 items-center justify-center rounded-full bg-stone-100 hover:bg-stone-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-ash hover:text-charcoal-primary transition-all cursor-pointer shrink-0"
                    aria-label="Cancel"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {/* Question */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-mono font-bold uppercase tracking-wider text-ash">
                  Market Question
                </label>
                <Input
                  ref={marketQuestionRef}
                  className="w-full h-11 rounded-xl border border-border bg-surface-solid px-4 text-sm text-charcoal-primary focus-visible:ring-1 focus-visible:ring-meadow-green/20 focus-visible:border-meadow-green/50 focus-visible:ring-offset-0 transition-all"
                  disabled={!user || saving || isValidating}
                  onChange={(event) =>
                    setMarket((current) => ({
                      ...current,
                      question: event.target.value,
                    }))
                  }
                  placeholder="e.g., Who will win the FIFA World Cup Final?"
                  value={market.question}
                />
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                {/* Category */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-mono font-bold uppercase tracking-wider text-ash">
                    Category
                  </label>
                  <select
                    className="w-full h-11 rounded-xl border border-border bg-surface-solid px-4 text-sm text-charcoal-primary outline-none focus:border-meadow-green/50 focus:ring-1 focus:ring-meadow-green/20 transition-all"
                    disabled={!user || saving || isValidating}
                    onChange={(event) =>
                      setMarket((current) => ({
                        ...current,
                        category: event.target.value,
                      }))
                    }
                    value={market.category}
                  >
                    {(categoriesData && categoriesData.length > 0
                      ? categoriesData
                      : [
                          { slug: "sports", displayName: "Sports" },
                          { slug: "culture", displayName: "Culture" },
                          { slug: "crypto", displayName: "Crypto" },
                          { slug: "economics", displayName: "Economics" },
                          { slug: "miscellaneous", displayName: "Miscellaneous" },
                          { slug: "politics", displayName: "Politics" },
                        ]
                    ).map((cat) => (
                      <option
                        key={cat.slug}
                        value={cat.slug}
                        className="bg-surface-solid text-charcoal-primary"
                      >
                        {cat.displayName}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Deadline */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-mono font-bold uppercase tracking-wider text-ash">
                    Resolution Deadline
                  </label>
                  <div className="relative flex h-11 items-center rounded-xl border border-border bg-surface-solid px-4">
                    <Calendar className="h-4 w-4 text-ash mr-2" />
                    <Input
                      className="w-full bg-transparent text-sm text-charcoal-primary border-0 shadow-none focus-visible:ring-0 focus-visible:ring-offset-0 px-0 h-full"
                      disabled={!user || saving || isValidating}
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
                </div>
              </div>

              {/* Multi-Option Inputs Editor */}
              {isMultiOption ? (
                <div className="space-y-2 border-t border-border pt-3">
                  <div className="flex items-center justify-between">
                    <label className="text-[10px] font-mono font-bold uppercase tracking-wider text-ash">
                      Options Editor (Minimum 3 options)
                    </label>
                    <span className="text-[10px] font-mono text-ash">
                      Cost: {dynamicCost} USDC
                    </span>
                  </div>

                  <div className="space-y-2 max-h-[180px] overflow-y-auto pr-1">
                    {options.map((opt, i) => (
                      <div key={i} className="flex gap-2">
                        <div className="flex-1 flex h-9 items-center rounded-lg border border-border bg-surface-solid px-3 focus-within:border-meadow-green/50 transition-colors">
                          <span className="text-[11px] font-mono text-ash mr-1.5">
                            #{i + 1}
                          </span>
                          <Input
                            type="text"
                            value={opt}
                            onChange={(e) =>
                              handleOptionChange(i, e.target.value)
                            }
                            placeholder={`Option ${i + 1}`}
                            className="w-full bg-transparent text-xs text-charcoal-primary border-0 shadow-none focus-visible:ring-0 focus-visible:ring-offset-0 px-0 h-full"
                            disabled={saving}
                          />
                        </div>
                        <button
                          type="button"
                          onClick={() => handleRemoveOption(i)}
                          className="h-9 w-9 flex items-center justify-center rounded-lg border border-border hover:border-coral-red/35 hover:bg-coral-red/5 text-ash hover:text-coral-red transition-all cursor-pointer"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    ))}
                  </div>

                  <button
                    type="button"
                    onClick={handleAddOption}
                    className="w-full flex h-9 items-center justify-center gap-1.5 rounded-lg border border-dashed border-border bg-transparent text-xs font-semibold text-ash hover:text-charcoal-primary hover:bg-surface-hover transition-all cursor-pointer"
                  >
                    <Plus className="h-4 w-4" /> Add Option
                  </button>

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-mono font-bold uppercase tracking-wider text-ash">
                      Resolution Source
                    </label>
                    <Input
                      className="w-full h-10 rounded-xl border border-border bg-surface-solid px-4 text-xs text-charcoal-primary focus-visible:ring-1 focus-visible:ring-meadow-green/20 focus-visible:border-meadow-green/50 focus-visible:ring-offset-0 transition-all"
                      disabled={!user || saving || isValidating}
                      onChange={(event) =>
                        setMarket((current) => ({
                          ...current,
                          resolutionSource: event.target.value,
                        }))
                      }
                      placeholder="Specify the platform or site used to resolve the options winner"
                      value={market.resolutionSource}
                    />
                  </div>
                </div>
              ) : detectedPyth.isPyth ? (
                /* Pyth Quantitative Detector */
                <div className="flex flex-col gap-1.5 rounded-xl bg-meadow-green/5 dark:bg-meadow-green/10 border border-meadow-green/20 p-3.5 shadow-subtle">
                  <p className="text-xs font-semibold leading-relaxed text-meadow-green flex items-center gap-1.5">
                    <Sparkles className="h-4 w-4" /> Pyth Oracle Auto-Detection
                    Active
                  </p>
                  <div className="mt-1 grid grid-cols-3 gap-2 rounded-lg bg-surface-solid border border-border p-2.5 font-mono text-[9px] text-ash">
                    <div className="flex flex-col gap-0.5">
                      <span>FEED</span>
                      <span className="font-semibold text-charcoal-primary">
                        {detectedPyth.asset}/USD
                      </span>
                    </div>
                    <div className="flex flex-col gap-0.5">
                      <span>TARGET PRICE</span>
                      <span className="font-semibold text-charcoal-primary">
                        ${detectedPyth.targetPrice?.toLocaleString()}
                      </span>
                    </div>
                    <div className="flex flex-col gap-0.5">
                      <span>CONDITION</span>
                      <span className="font-bold text-meadow-green">
                        {detectedPyth.resolveAbove ? ">= Target" : "< Target"}
                      </span>
                    </div>
                  </div>
                </div>
              ) : (
                /* Classic Binary Custom Fields */
                <div className="space-y-2 border-t border-border pt-3">
                  <label className="text-[10px] font-mono font-bold uppercase tracking-wider text-ash">
                    Resolution Criteria Details
                  </label>
                  <Input
                    className="w-full h-10 rounded-xl border border-border bg-surface-solid px-4 text-xs text-charcoal-primary focus-visible:ring-1 focus-visible:ring-meadow-green/20 focus-visible:border-meadow-green/50 focus-visible:ring-offset-0 transition-all"
                    disabled={!user || saving || isValidating}
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
                    <Input
                      className="h-10 rounded-xl border border-border bg-surface-solid px-4 text-xs text-charcoal-primary focus-visible:ring-1 focus-visible:ring-meadow-green/20 focus-visible:border-meadow-green/50 focus-visible:ring-offset-0 transition-all"
                      disabled={!user || saving || isValidating}
                      onChange={(event) =>
                        setMarket((current) => ({
                          ...current,
                          yesCondition: event.target.value,
                        }))
                      }
                      placeholder="YES condition details (min 12 chars)"
                      value={market.yesCondition}
                    />
                    <Input
                      className="h-10 rounded-xl border border-border bg-surface-solid px-4 text-xs text-charcoal-primary focus-visible:ring-1 focus-visible:ring-meadow-green/20 focus-visible:border-meadow-green/50 focus-visible:ring-offset-0 transition-all"
                      disabled={!user || saving || isValidating}
                      onChange={(event) =>
                        setMarket((current) => ({
                          ...current,
                          noCondition: event.target.value,
                        }))
                      }
                      placeholder="NO condition details (min 12 chars)"
                      value={market.noCondition}
                    />
                  </div>
                </div>
              )}

              {/* Agent Review Section */}
              <div className="rounded-xl bg-surface-solid border border-border p-3.5">
                <div className="mb-2 flex items-center justify-between">
                  <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-ash">
                    Verity AI Review Status
                  </span>
                  <span
                    className={`font-mono text-xs font-bold ${
                      visibleAgentReview.approved
                        ? "text-meadow-green"
                        : "text-ember-orange"
                    }`}
                  >
                    {visibleAgentReview.score}/100
                  </span>
                </div>
                <p className="text-xs text-ash leading-relaxed mb-2.5">
                  {reviewIsCurrent
                    ? visibleAgentReview.summary
                    : "Verity AI validates your market's resolution details to ensure transparency and prevent ambiguous disputes."}
                </p>
                <div className="grid gap-1">
                  {visibleAgentReview.findings.slice(0, 3).map((finding) => (
                    <p
                      className={`text-[11px] font-semibold flex items-center gap-1.5 ${
                        finding.severity === "blocker"
                          ? "text-coral-red"
                          : finding.severity === "warning"
                            ? "text-ember-orange"
                            : "text-meadow-green"
                      }`}
                      key={finding.message}
                    >
                      {finding.severity === "blocker" ? "✕" : "✓"}{" "}
                      {finding.message}
                    </p>
                  ))}
                </div>
              </div>
            </div>
          )}

          {error && (
            <p className="text-xs text-coral-red font-semibold">{error}</p>
          )}

          {isMarket && user && isBalanceInsufficient && (
            <p className="text-xs text-red-500 font-semibold mt-1">
              Insufficient USDC balance. You need at least {requiredMarketCost}{" "}
              USDC
            </p>
          )}

          {/* Action Row */}
          <div className="flex items-center justify-end border-t border-border pt-3 mt-1">
            <button
              className={`verity-pill px-5 py-2 text-sm font-semibold tracking-[-0.18px] transition-all border ${
                canUsePrimaryAction
                  ? predictionApproved
                    ? "clickable bg-meadow-green text-white hover:bg-meadow-green/90 border-meadow-green/10 cursor-pointer shadow-md"
                    : "clickable bg-inverse text-inverse-text hover:opacity-90 border-transparent cursor-pointer"
                  : "cursor-not-allowed bg-stone-surface text-ash border-border"
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
    </div>
  )
}
