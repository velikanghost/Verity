"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import {
  BarChart2,
  ShieldCheck,
  Plus,
  Trash2,
  Calendar,
  Sparkles,
  HelpCircle,
} from "lucide-react"
import { type MarketInput, type Profile } from "@/lib/verity"
import { reviewPredictionPost, type VerityAgentReview } from "@/lib/verityAgent"
import { useUsdcTransfer } from "@/hooks/useUsdcTransfer"
import { useAuth } from "@/components/providers/AuthModals"
import {
  useCreateMarketPostMutation,
  useCreateNormalPostMutation,
  useValidateMarketPostMutation,
} from "@/store/verity/verityQueries"
import { toast } from "react-hot-toast"
import {
  FACTORY_ADDRESS,
  arcUsdcAddress,
  publicClient,
  erc20Abi,
} from "@/lib/arc"
import type { Address } from "viem"

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
  const { user, executeTxBatch } = useAuth()
  const { createMarketPreDeposit } = useUsdcTransfer()
  const { mutateAsync: validateMarketPost } = useValidateMarketPostMutation()
  const { mutateAsync: createMarketPost } = useCreateMarketPostMutation()
  const { mutateAsync: createNormalPost } = useCreateNormalPostMutation()

  const [content, setContent] = useState("")
  const [isMarket, setIsMarket] = useState(false)
  const [isMultiOption, setIsMultiOption] = useState(false)
  const [options, setOptions] = useState<string[]>(["", "", ""])

  const [market, setMarket] = useState<MarketInput>({
    content: "",
    question: "",
    category: "Sports",
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

  useEffect(() => {
    function applyIntent(intent: ComposeIntent) {
      setIsMarket(intent === "market")
      window.requestAnimationFrame(() => {
        composerRef.current?.scrollIntoView({
          behavior: "smooth",
          block: "center",
        })
        if (intent === "market") {
          marketQuestionRef.current?.focus()
        } else {
          textareaRef.current?.focus()
        }
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

  const canUsePrimaryAction = useMemo(() => {
    if (!user || saving || isValidating) return false
    if (!isMarket) return content.trim().length > 0
    return hasMarketFields
  }, [content, hasMarketFields, isMarket, user, saving, isValidating])

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

  const dynamicCost = useMemo(() => {
    const optionCount = isMultiOption
      ? options.filter((o) => o.trim().length > 0).length
      : 1
    return optionCount * 11
  }, [isMultiOption, options])

  const primaryLabel = useMemo(() => {
    if (saving) return "Posting..."
    if (isValidating) return "Reviewing..."
    if (!isMarket) return "Take"
    if (!predictionApproved) return "Review"
    return `Pay ${dynamicCost} USDC & Create Market`
  }, [isMarket, predictionApproved, saving, isValidating, dynamicCost])

  async function submit() {
    if (!user || !canUsePrimaryAction) return

    if (isMarket && !predictionApproved) {
      await runAgentReview()
      return
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
          const optionMarketIds = validOptions.map(() => generateObjectId())
          const totalCostRaw = BigInt(validOptions.length * 11 * 1e6)
          const calls: Array<{
            contractAddress: string
            abiFunctionSignature: string
            abiParameters: any[]
          }> = []

          // Check Factory allowance
          const allowance = await publicClient.readContract({
            address: arcUsdcAddress,
            abi: erc20Abi,
            functionName: "allowance",
            args: [user.walletAddress as `0x${string}`, FACTORY_ADDRESS],
          })

          if (allowance < totalCostRaw) {
            calls.push({
              contractAddress: arcUsdcAddress,
              abiFunctionSignature: "approve(address,uint256)",
              abiParameters: [FACTORY_ADDRESS, totalCostRaw],
            })
          }

          // Batch createMarketPreDeposit calls
          optionMarketIds.forEach((childId) => {
            const formattedChildId = ("0x" + childId.padEnd(64, "0")) as Address
            calls.push({
              contractAddress: FACTORY_ADDRESS,
              abiFunctionSignature: "createMarketPreDeposit(bytes32,uint256)",
              abiParameters: [formattedChildId, BigInt("10000000")],
            })
          })

          txHash = await executeTxBatch(
            calls,
            `Deploy Multi-Option Market (${validOptions.length} Options) with ${validOptions.length * 10} USDC Pool Liquidity`,
            validOptions.length * 11,
          )

          await createMarketPost({
            authorId: user.id,
            marketId,
            ...finalMarket,
            yesCondition: "Any of the options wins",
            noCondition: "None of the options wins",
            content: finalMarket.question.trim(),
            creationFeeTxHash: txHash,
            feeCollectorAddress: FACTORY_ADDRESS,
            options: validOptions,
            optionMarketIds,
          })
        } else {
          // Binary Market Pre-Deposit
          const payment = await createMarketPreDeposit(marketId, 10)
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
          category: "Sports",
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
      } else {
        await createNormalPost({ authorId: user.id, content })
        toast.success("Post successfully published!", { id: tid })
      }

      setContent("")
      onCreated()
    } catch (caught: any) {
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
      className="verity-card flex flex-col gap-3 p-4 sm:gap-4 sm:p-5 border border-border bg-surface-solid shadow-[(--shadow-subtle)] transition-all duration-300"
      ref={composerRef}
    >
      {/* Main Composer Row */}
      <div className="flex gap-3 sm:gap-4">
        {/* Avatar */}
        <div className="shrink-0">
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
              placeholder={
                user
                  ? "What's your conviction? Post a Take..."
                  : "Connect wallet to post a Take"
              }
              value={content}
              className="min-h-[60px] w-full resize-none border-none bg-transparent text-[19px] font-semibold leading-[1.3] tracking-[-0.25px] text-charcoal-primary outline-none placeholder:text-ash"
            />
          )}

          {isMarket && (
            <div className="grid gap-3 rounded-xl bg-surface-muted/50 dark:bg-surface-muted/30 p-4 border border-border">
              {/* Mode Selector (Binary vs Multi-Option) */}
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-charcoal-primary">
                  Market Outcome Mode
                </span>
                <div className="flex rounded-lg bg-stone-surface/50 dark:bg-stone-surface/30 p-1 border border-border text-xs font-semibold">
                  <button
                    type="button"
                    onClick={() => {
                      setIsMultiOption(false)
                      setAgentReview(null)
                      setReviewedSignature("")
                    }}
                    className={`px-3 py-1.5 rounded-md transition-all ${
                      !isMultiOption
                        ? "bg-surface-solid text-charcoal-primary border border-border shadow-sm"
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
                    className={`px-3 py-1.5 rounded-md transition-all ${
                      isMultiOption
                        ? "bg-surface-solid text-charcoal-primary border border-border shadow-sm"
                        : "text-ash hover:text-charcoal-primary"
                    }`}
                  >
                    Multi-Option List
                  </button>
                </div>
              </div>

              {/* Question */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-mono font-bold uppercase tracking-wider text-ash">
                  Market Question
                </label>
                <input
                  ref={marketQuestionRef}
                  className="w-full h-11 rounded-xl border border-border bg-surface-solid px-4 text-sm text-charcoal-primary outline-none placeholder:text-ash focus:border-meadow-green/50 focus:ring-1 focus:ring-meadow-green/20 transition-all"
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
                    {MARKET_CATEGORIES.map((category) => (
                      <option
                        key={category}
                        className="bg-surface-solid text-charcoal-primary"
                      >
                        {category}
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
                    <input
                      className="w-full bg-transparent text-sm text-charcoal-primary outline-none"
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
                      Cost:{" "}
                      {options.filter((o) => o.trim().length > 0).length * 11}{" "}
                      USDC
                    </span>
                  </div>

                  <div className="space-y-2 max-h-[180px] overflow-y-auto pr-1">
                    {options.map((opt, i) => (
                      <div key={i} className="flex gap-2">
                        <div className="flex-1 flex h-9 items-center rounded-lg border border-border bg-surface-solid px-3 focus-within:border-meadow-green/50 transition-colors">
                          <span className="text-[11px] font-mono text-ash mr-1.5">
                            #{i + 1}
                          </span>
                          <input
                            type="text"
                            value={opt}
                            onChange={(e) =>
                              handleOptionChange(i, e.target.value)
                            }
                            placeholder={`Option ${i + 1}`}
                            className="w-full bg-transparent text-xs text-charcoal-primary outline-none placeholder:text-ash"
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
                    <input
                      className="w-full h-10 rounded-xl border border-border bg-surface-solid px-4 text-xs text-charcoal-primary outline-none placeholder:text-ash focus:border-meadow-green/50 focus:ring-1 focus:ring-meadow-green/20 transition-all"
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
                <div className="flex flex-col gap-1.5 rounded-xl bg-meadow-green/5 dark:bg-meadow-green/10 border border-meadow-green/20 p-3.5 shadow-[var(--shadow-subtle)]">
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
                  <input
                    className="w-full h-10 rounded-xl border border-border bg-surface-solid px-4 text-xs text-charcoal-primary outline-none placeholder:text-ash focus:border-meadow-green/50 focus:ring-1 focus:ring-meadow-green/20 transition-all"
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
                    <input
                      className="h-10 rounded-xl border border-border bg-surface-solid px-4 text-xs text-charcoal-primary outline-none placeholder:text-ash focus:border-meadow-green/50 focus:ring-1 focus:ring-meadow-green/20 transition-all"
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
                    <input
                      className="h-10 rounded-xl border border-border bg-surface-solid px-4 text-xs text-charcoal-primary outline-none placeholder:text-ash focus:border-meadow-green/50 focus:ring-1 focus:ring-meadow-green/20 transition-all"
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

          {/* Action Row */}
          <div className="flex items-center justify-between border-t border-border pt-3 mt-1">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setIsMarket((current) => !current)}
                disabled={saving || isValidating}
                className={`flex h-9 w-9 items-center justify-center rounded-lg border border-border text-ash hover:text-charcoal-primary hover:bg-surface-hover transition-all cursor-pointer disabled:opacity-50 ${
                  isMarket
                    ? "bg-meadow-green/10 text-meadow-green border-meadow-green/30"
                    : ""
                }`}
                title="Toggle prediction market fields"
              >
                <BarChart2 className="w-5 h-5" />
              </button>
            </div>

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
