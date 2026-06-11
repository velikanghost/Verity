"use client"

import { useState, useEffect, useMemo, useCallback } from "react"
import { apiRequest } from "@/store/apiClient"
import { toast } from "react-hot-toast"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  ShieldAlert,
  Swords,
  TrendingUp,
  Mail,
  LogOut,
  RefreshCw,
  Plus,
  Wallet,
  Copy,
  Info,
  ChevronDown,
  ChevronUp,
  Trophy,
  Flag,
  Target,
  AlertTriangle,
  Minus,
} from "lucide-react"

interface Market {
  id: string
  question: string
  category: string
  deadline: string
  status: string
  resolutionSource?: string
  yesCondition?: string
  noCondition?: string
}

/* ─────────────────────────────────────────────
   Category-based proposition builder types
   ───────────────────────────────────────────── */
interface CategoryState {
  enabled: boolean
  line?: number // handicap line (e.g. 9.5 corners)
}

const CORNER_LINES = [6.5, 7.5, 8.5, 9.5, 10.5]
const GOAL_LINES = [0.5, 1.5, 2.5, 3.5, 4.5]
const CARD_LINES = [2.5, 3.5, 4.5, 5.5, 6.5]

function parseTeams(question: string): { teamA: string; teamB: string } {
  const vsMatch = question.match(/(.+?)\s+vs\.?\s+(.+)/i)
  if (vsMatch) return { teamA: vsMatch[1].trim(), teamB: vsMatch[2].trim() }
  const dashMatch = question.match(/(.+?)\s+-\s+(.+)/)
  if (dashMatch)
    return { teamA: dashMatch[1].trim(), teamB: dashMatch[2].trim() }
  return { teamA: "Team A", teamB: "Team B" }
}

export default function AdminPage() {
  const [token, setToken] = useState("")
  const [isAuthorized, setIsAuthorized] = useState(false)
  const [email, setEmail] = useState("")
  const [otpCode, setOtpCode] = useState("")
  const [otpSent, setOtpSent] = useState(false)
  const [loading, setLoading] = useState(false)

  // Standard markets state
  const [markets, setMarkets] = useState<Market[]>([])
  const [marketsLoading, setMarketsLoading] = useState(false)

  // PvP Event Form State
  const [pvpQuestion, setPvpQuestion] = useState("")
  const [pvpDeadline, setPvpDeadline] = useState("")
  const [pvpResolutionSource, setPvpResolutionSource] =
    useState("World Cup Oracle")

  // Category-based proposition builder state
  const [categories, setCategories] = useState<Record<string, CategoryState>>({
    winner: { enabled: false },
    corners: { enabled: false, line: 9.5 },
    goals: { enabled: false, line: 2.5 },
    cards: { enabled: false, line: 3.5 },
    firstScore: { enabled: false },
    redCard: { enabled: false },
  })

  // Custom propositions
  const [customOptions, setCustomOptions] = useState<string[]>([])
  const [customOptionText, setCustomOptionText] = useState("")

  // Admin Wallet & Balance State
  const [adminBalances, setAdminBalances] = useState<{
    adminAddress: string
    arcBalance: number
    usdcBalance: number
    preDepositUsdcPerOption: number
    creationFeeUsdc: number
  } | null>(null)

  // Arbitration / Resolve Form State
  const [selectedMarketId, setSelectedMarketId] = useState<string | null>(null)

  // Add Liquidity Dialog State
  const [isAddLiquidityOpen, setIsAddLiquidityOpen] = useState(false)
  const [liquidityAmount, setLiquidityAmount] = useState("40")
  const [liquidityMarketId, setLiquidityMarketId] = useState<string | null>(
    null,
  )
  const [winningOutcome, setWinningOutcome] = useState<"YES" | "NO">("YES")
  const [resolveTxHash, setResolveTxHash] = useState("0x" + "a".repeat(64))
  const [adminAddress, setAdminAddress] = useState(
    "0x0000000000000000000000000000000000000000",
  )

  // Parse team names from question
  const { teamA, teamB } = useMemo(() => parseTeams(pvpQuestion), [pvpQuestion])

  const hasTeams = pvpQuestion.trim().length > 0

  // Build propositions from enabled categories
  const generatedOptions = useMemo(() => {
    const opts: string[] = []
    const a = hasTeams ? teamA : "Team A"
    const b = hasTeams ? teamB : "Team B"

    if (categories.winner.enabled) {
      opts.push(`${a} wins the match`)
      opts.push(`Match ends in a draw`)
      opts.push(`${b} wins the match`)
    }

    if (categories.firstScore.enabled) {
      opts.push(`${a} scores first`)
      opts.push(`No goal in the match`)
      opts.push(`${b} scores first`)
    }

    if (categories.redCard.enabled) {
      opts.push(`At least one red card shown`)
      opts.push(`No red cards shown`)
    }

    if (categories.corners.enabled && categories.corners.line != null) {
      const line = categories.corners.line
      opts.push(`Match has under ${line} corners`)
      opts.push(`Match has over ${line} corners`)
    }

    if (categories.goals.enabled && categories.goals.line != null) {
      const line = categories.goals.line
      opts.push(`Match has under ${line} goals`)
      opts.push(`Match has over ${line} goals`)
    }

    if (categories.cards.enabled && categories.cards.line != null) {
      const line = categories.cards.line
      opts.push(`Match has under ${line} yellow cards`)
      opts.push(`Match has over ${line} yellow cards`)
    }

    return [...opts, ...customOptions]
  }, [categories, customOptions, teamA, teamB, hasTeams])

  const toggleCategory = useCallback((key: string) => {
    setCategories((prev) => ({
      ...prev,
      [key]: { ...prev[key], enabled: !prev[key].enabled },
    }))
  }, [])

  const setCategoryLine = useCallback((key: string, line: number) => {
    setCategories((prev) => ({
      ...prev,
      [key]: { ...prev[key], line },
    }))
  }, [])

  // Fetch admin status/balances
  async function fetchAdminStatus() {
    try {
      const data = await apiRequest<any>("/pvp/admin-status")
      setAdminBalances(data)
      if (data.adminAddress) {
        setAdminAddress(data.adminAddress)
      }
    } catch (err: any) {
      console.error("Failed to fetch admin status/balances:", err)
    }
  }

  // Copy helper
  function copyToClipboard(text: string) {
    void navigator.clipboard.writeText(text)
    toast.success("Address copied to clipboard!")
  }

  // Add custom option
  function handleAddCustomOption() {
    const text = customOptionText.trim()
    if (!text) return
    if (
      [...generatedOptions]
        .map((o) => o.toLowerCase())
        .includes(text.toLowerCase())
    ) {
      toast.error("Option already exists.")
      return
    }
    setCustomOptions([...customOptions, text])
    setCustomOptionText("")
  }

  function handleRemoveCustomOption(index: number) {
    setCustomOptions(customOptions.filter((_, i) => i !== index))
  }

  // Check auth on load
  useEffect(() => {
    const storedToken = localStorage.getItem("verity_admin_auth_token")
    if (storedToken) {
      setToken(storedToken)
      setIsAuthorized(true)
      void fetchMarkets()
      void fetchAdminStatus()
    }
  }, [])

  // Fetch standard & PvP child markets for moderation
  async function fetchMarkets() {
    setMarketsLoading(true)
    try {
      const data = await apiRequest<any[]>("/markets?admin=true")
      const parsed: Market[] = data.map((item: any) => ({
        id: item.id || item._id,
        question: item.question,
        category: item.category,
        deadline: item.deadline,
        status: item.status,
        resolutionSource: item.resolutionSource || item.resolution_source,
        yesCondition: item.yesCondition || item.yes_condition,
        noCondition: item.noCondition || item.no_condition,
      }))
      setMarkets(parsed)
    } catch (err: any) {
      toast.error(err.message || "Failed to load markets.")
    } finally {
      setMarketsLoading(false)
    }
  }

  // Handle direct JWT paste login
  function handleDirectLogin(e: React.FormEvent) {
    e.preventDefault()
    if (!token.trim()) return
    localStorage.setItem("verity_admin_auth_token", token.trim())
    setIsAuthorized(true)
    toast.success("Authenticated with JWT Token!")
    void fetchMarkets()
    void fetchAdminStatus()
  }

  // Request OTP via backend auth APIs
  async function handleRequestOtp(e: React.FormEvent) {
    e.preventDefault()
    if (!email.trim()) return
    setLoading(true)
    try {
      await apiRequest("/auth/request-otp", {
        method: "POST",
        body: JSON.stringify({ email: email.trim() }),
      })
      setOtpSent(true)
      toast.success("OTP sent to your email!")
    } catch (err: any) {
      toast.error(err.message || "Failed to request OTP.")
    } finally {
      setLoading(false)
    }
  }

  // Verify OTP via backend auth APIs
  async function handleVerifyOtp(e: React.FormEvent) {
    e.preventDefault()
    if (!otpCode.trim()) return
    setLoading(true)
    try {
      const response = await apiRequest<{ token: string; user: any }>(
        "/auth/verify-otp",
        {
          method: "POST",
          body: JSON.stringify({ email: email.trim(), code: otpCode.trim() }),
        },
      )

      if (response.user?.role !== "admin") {
        throw new Error("This account does not have administrator privileges.")
      }

      localStorage.setItem("verity_admin_auth_token", response.token)
      setToken(response.token)
      setIsAuthorized(true)
      toast.success("Successfully logged in as Admin!")
      void fetchMarkets()
      void fetchAdminStatus()
    } catch (err: any) {
      toast.error(err.message || "Verification failed.")
    } finally {
      setLoading(false)
    }
  }

  // Deploy PvP Parent + child events
  async function handleDeployPvpEvent(e: React.FormEvent) {
    e.preventDefault()
    if (!pvpQuestion.trim() || !pvpDeadline || !pvpResolutionSource.trim()) {
      toast.error("Please fill all fields.")
      return
    }

    if (
      generatedOptions.length < 3 ||
      generatedOptions.some((opt) => !opt.trim())
    ) {
      toast.error(
        "You must enable enough categories for at least 3 propositions.",
      )
      return
    }

    setLoading(true)
    try {
      await apiRequest("/pvp/events", {
        method: "POST",
        body: JSON.stringify({
          question: pvpQuestion.trim(),
          deadline: new Date(pvpDeadline).toISOString(),
          resolutionSource: pvpResolutionSource.trim(),
          options: generatedOptions.map((opt) => opt.trim()),
        }),
      })
      toast.success(
        `Successfully deployed PvP Event + ${generatedOptions.length} Proposition markets!`,
      )
      setPvpQuestion("")
      setPvpDeadline("")
      setCategories({
        winner: { enabled: false },
        corners: { enabled: false, line: 9.5 },
        goals: { enabled: false, line: 2.5 },
        cards: { enabled: false, line: 3.5 },
        firstScore: { enabled: false },
        redCard: { enabled: false },
      })
      setCustomOptions([])
      void fetchMarkets()
      void fetchAdminStatus()
    } catch (err: any) {
      toast.error(err.message || "Failed to deploy event.")
    } finally {
      setLoading(false)
    }
  }

  // Approve Qualified prediction market
  async function handleApproveTrading(marketId: string) {
    setLoading(true)
    try {
      await apiRequest(`/markets/${marketId}/approve-trading`, {
        method: "POST",
      })
      toast.success("Market approved for trading!")
      void fetchMarkets()
    } catch (err: any) {
      toast.error(err.message || "Failed to approve market.")
    } finally {
      setLoading(false)
    }
  }

  const openAddLiquidityModal = (marketId: string) => {
    setLiquidityMarketId(marketId)
    setLiquidityAmount("40")
    setIsAddLiquidityOpen(true)
  }

  // Add Liquidity to a prediction market pool
  async function handleAddLiquidity(e?: React.FormEvent) {
    if (e) e.preventDefault()
    if (!liquidityMarketId) return

    const amount = parseFloat(liquidityAmount)
    if (isNaN(amount) || amount <= 0) {
      toast.error("Please enter a valid positive number.")
      return
    }

    setLoading(true)
    try {
      const response = await apiRequest<{ success: boolean; txHash: string }>(
        `/markets/${liquidityMarketId}/admin-deposit-liquidity`,
        {
          method: "POST",
          body: JSON.stringify({ amount }),
          headers: { "Content-Type": "application/json" },
        },
      )
      toast.success(`Liquidity added successfully! Tx: ${response.txHash}`)
      setIsAddLiquidityOpen(false)
      void fetchMarkets()
    } catch (err: any) {
      toast.error(err.message || "Failed to add liquidity.")
    } finally {
      setLoading(false)
    }
  }

  // Resolve prediction market
  async function handleResolveMarket(e: React.FormEvent) {
    e.preventDefault()
    if (!selectedMarketId) return
    setLoading(true)
    try {
      await apiRequest(`/markets/${selectedMarketId}/resolve`, {
        method: "POST",
        body: JSON.stringify({
          winningOutcome,
          txHash: resolveTxHash.trim(),
          adminAddress: adminAddress.trim(),
        }),
      })
      toast.success("Market resolved successfully!")
      setSelectedMarketId(null)
      void fetchMarkets()
      void fetchAdminStatus()
    } catch (err: any) {
      toast.error(err.message || "Failed to resolve market.")
    } finally {
      setLoading(false)
    }
  }

  function handleLogOut() {
    localStorage.removeItem("verity_admin_auth_token")
    setIsAuthorized(false)
    setToken("")
    setOtpSent(false)
    setOtpCode("")
    setEmail("")
    toast.success("Logged out successfully.")
  }

  // Render Login Panel
  if (!isAuthorized) {
    return (
      <main className="min-h-screen flex items-center justify-center p-4">
        <div className="verity-card p-6 sm:p-8 w-full max-w-md flex flex-col gap-6">
          <div className="flex flex-col items-center text-center">
            <span className="flex h-12 w-12 items-center justify-center rounded-[14px] bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
              <ShieldAlert className="h-6 w-6" />
            </span>
            <h1 className="text-2xl font-bold mt-3 tracking-tight">
              Verity Admin Login
            </h1>
            <p className="text-xs text-ash mt-1">
              Please authenticate to access administrative moderation controls.
            </p>
          </div>

          {/* Tab Selection */}
          <div className="flex border-b border-border pb-px gap-3 text-sm">
            <span className="font-semibold text-charcoal-primary border-b-2 border-charcoal-primary pb-2 flex items-center gap-1.5">
              <Mail className="h-4 w-4" />
              OTP / Credentials
            </span>
          </div>

          {!otpSent ? (
            <form onSubmit={handleRequestOtp} className="flex flex-col gap-4">
              <div className="space-y-1.5">
                <label className="block text-[10px] font-bold uppercase tracking-wider text-ash">
                  Administrator Email
                </label>
                <input
                  type="email"
                  required
                  placeholder="admin@verity.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full h-11 px-3 border border-border dark:border-zinc-800 bg-transparent text-sm rounded-[10px] outline-none focus:border-indigo-500 transition-colors"
                />
              </div>
              <Button
                type="submit"
                disabled={loading}
                className="w-full h-11 bg-indigo-600 hover:bg-indigo-500 text-white text-xs uppercase tracking-wider font-semibold rounded-[8px] transition-colors cursor-pointer"
              >
                {loading ? "Requesting OTP..." : "Send OTP Verification Code"}
              </Button>
            </form>
          ) : (
            <form onSubmit={handleVerifyOtp} className="flex flex-col gap-4">
              <div className="space-y-1.5">
                <label className="block text-[10px] font-bold uppercase tracking-wider text-ash">
                  OTP Verification Code
                </label>
                <input
                  type="text"
                  required
                  maxLength={6}
                  placeholder="123456"
                  value={otpCode}
                  onChange={(e) => setOtpCode(e.target.value)}
                  className="w-full h-11 px-3 text-center border border-border dark:border-zinc-800 bg-transparent text-lg font-bold tracking-widest rounded-[10px] outline-none focus:border-indigo-500 transition-colors"
                />
              </div>
              <div className="flex gap-2">
                <Button
                  type="button"
                  onClick={() => setOtpSent(false)}
                  variant="secondary"
                  className="flex-1 h-11 bg-stone-100 hover:bg-stone-200 text-stone-700 dark:bg-zinc-800 dark:hover:bg-zinc-700 dark:text-zinc-300 text-xs uppercase tracking-wider font-semibold rounded-[8px] cursor-pointer"
                >
                  Back
                </Button>
                <Button
                  type="submit"
                  disabled={loading}
                  className="flex-2 h-11 bg-indigo-600 hover:bg-indigo-500 text-white text-xs uppercase tracking-wider font-semibold rounded-[8px] disabled:opacity-50 cursor-pointer"
                >
                  {loading ? "Verifying..." : "Verify & Sign In"}
                </Button>
              </div>
            </form>
          )}

          <div className="relative flex py-2 items-center">
            <div className="grow border-t border-border"></div>
            <span className="shrink mx-4 text-[10px] font-mono font-bold uppercase text-ash">
              Or Direct JWT
            </span>
            <div className="grow border-t border-border"></div>
          </div>

          <form onSubmit={handleDirectLogin} className="flex flex-col gap-3">
            <div className="space-y-1.5">
              <label className="block text-[10px] font-bold uppercase tracking-wider text-ash">
                JWT Auth Token
              </label>
              <textarea
                placeholder="Paste verity_auth_token from localStorage"
                value={token}
                onChange={(e) => setToken(e.target.value)}
                rows={2}
                className="w-full p-2 border border-border dark:border-zinc-800 bg-transparent text-[11px] font-mono rounded-[10px] outline-none focus:border-indigo-500 transition-colors"
              />
            </div>
            <Button
              type="submit"
              className="w-full h-11 bg-stone-900 text-white hover:bg-stone-800 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-xs uppercase tracking-wider font-semibold rounded-[8px] cursor-pointer"
            >
              Direct JWT Login
            </Button>
          </form>
        </div>
      </main>
    )
  }

  // ─── Render Admin Console Dashboard ───────────────────────────
  return (
    <div className="min-h-screen flex flex-col">
      {/* Navbar Header */}
      <header className="border-b border-border dark:border-zinc-800 bg-white dark:bg-zinc-900/50 backdrop-blur sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-[10px] bg-indigo-600 text-white font-bold text-lg">
              A
            </div>
            <div>
              <h1 className="font-bold text-sm leading-tight text-charcoal-primary dark:text-white">
                Admin Console
              </h1>
              <span className="text-[10px] font-mono text-ash uppercase">
                Verity Predictions
              </span>
            </div>
          </div>

          <button
            onClick={handleLogOut}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border hover:border-red-400 hover:text-red-500 transition-all font-mono text-xs text-ash"
          >
            <LogOut className="h-3.5 w-3.5" />
            Sign Out
          </button>
        </div>
      </header>

      {/* Main Grid Content */}
      <main className="max-w-7xl mx-auto px-4 py-6 grid grid-cols-1 lg:grid-cols-12 gap-6 flex-1 w-full">
        {/* Left Side: PvP Event Deployment */}
        <section className="lg:col-span-5 flex flex-col gap-6">
          {/* Admin Wallet Status Card */}
          {adminBalances && (
            <div className="verity-card p-5 bg-linear-to-br from-indigo-500/4 via-transparent to-transparent border border-indigo-500/10 flex flex-col gap-4">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="h-9 w-9 rounded-lg bg-indigo-500/10 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
                    <Wallet className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-xs font-bold uppercase tracking-wider text-ash">
                      Admin Wallet Status
                    </h3>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className="font-mono text-[10px] text-charcoal-primary dark:text-zinc-300">
                        {adminBalances.adminAddress.slice(0, 6)}...
                        {adminBalances.adminAddress.slice(-4)}
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          copyToClipboard(adminBalances.adminAddress)
                        }
                        className="text-ash hover:text-indigo-600 p-0.5 rounded transition-colors"
                        title="Copy Address"
                      >
                        <Copy className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <span className="inline-flex px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[9px] font-bold font-mono uppercase">
                    Arc Testnet
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 mt-2 pt-3 border-t border-border dark:border-zinc-800/80">
                <div>
                  <span className="block text-[10px] font-bold text-ash uppercase">
                    USDC Balance
                  </span>
                  <span className="font-mono text-base font-bold text-charcoal-primary dark:text-white">
                    {adminBalances.usdcBalance.toLocaleString(undefined, {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </span>
                </div>
                <div>
                  <span className="block text-[10px] font-bold text-ash uppercase">
                    Gas (ARC) Balance
                  </span>
                  <span className="font-mono text-base font-bold text-charcoal-primary dark:text-white">
                    {adminBalances.arcBalance.toLocaleString(undefined, {
                      minimumFractionDigits: 4,
                      maximumFractionDigits: 4,
                    })}
                  </span>
                </div>
              </div>

              <div className="p-3 bg-stone-50 dark:bg-zinc-900/30 rounded-lg border border-border dark:border-zinc-800/80 flex items-start gap-2">
                <Info className="h-4 w-4 text-indigo-500 shrink-0 mt-0.5" />
                <div className="text-[10px] text-ash leading-relaxed">
                  <p className="font-semibold text-charcoal-primary dark:text-zinc-300">
                    PvP Event Cost Estimator:
                  </p>
                  <p>
                    Deployment requires funding each child option with{" "}
                    <span className="font-bold text-indigo-600 dark:text-indigo-400">
                      {adminBalances.preDepositUsdcPerOption.toFixed(2)} USDC
                    </span>
                    .
                  </p>
                  <p className="mt-0.5">
                    Total funding cost for {generatedOptions.length} options:{" "}
                    <span className="font-bold text-indigo-600 dark:text-indigo-400">
                      {(
                        adminBalances.preDepositUsdcPerOption *
                        generatedOptions.length
                      ).toFixed(2)}{" "}
                      USDC
                    </span>{" "}
                    + gas fees.
                  </p>
                </div>
              </div>
            </div>
          )}

          <div className="verity-card p-5 flex flex-col gap-5">
            <div className="border-b border-border pb-3">
              <h2 className="text-base font-bold tracking-tight text-charcoal-primary dark:text-white flex items-center gap-2">
                <Swords className="h-5 w-5 text-indigo-500" />
                Deploy World Cup PvP Matchup
              </h2>
              <p className="text-xs text-ash mt-0.5">
                Creates a parent event and child proposition markets.
              </p>
            </div>

            <form
              onSubmit={handleDeployPvpEvent}
              className="flex flex-col gap-5"
            >
              {/* Match Title */}
              <div className="space-y-1.5">
                <label className="block text-[10px] font-bold uppercase tracking-wider text-ash">
                  Match Title / Question
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Paraguay vs Japan"
                  value={pvpQuestion}
                  onChange={(e) => setPvpQuestion(e.target.value)}
                  className="w-full h-11 px-3 border border-border dark:border-zinc-800 bg-transparent text-sm rounded-[10px] outline-none focus:border-indigo-500 transition-colors"
                />
                {hasTeams && (
                  <div className="flex items-center gap-2 mt-1.5">
                    <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-indigo-50 dark:bg-indigo-950/30 border border-indigo-100 dark:border-indigo-900/40 text-[11px] font-semibold text-indigo-700 dark:text-indigo-300">
                      <Flag className="h-3 w-3" />
                      {teamA}
                    </span>
                    <span className="text-[10px] font-bold text-ash">vs</span>
                    <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-rose-50 dark:bg-rose-950/30 border border-rose-100 dark:border-rose-900/40 text-[11px] font-semibold text-rose-700 dark:text-rose-300">
                      <Flag className="h-3 w-3" />
                      {teamB}
                    </span>
                  </div>
                )}
              </div>

              {/* Deadline */}
              <div className="space-y-1.5">
                <label className="block text-[10px] font-bold uppercase tracking-wider text-ash">
                  Event Lock-In Deadline
                </label>
                <input
                  type="datetime-local"
                  required
                  value={pvpDeadline}
                  onChange={(e) => setPvpDeadline(e.target.value)}
                  className="w-full h-11 px-3 border border-border dark:border-zinc-800 bg-transparent text-sm rounded-[10px] outline-none focus:border-indigo-500 transition-colors text-ash"
                />
              </div>

              {/* Resolution Source */}
              <div className="space-y-1.5">
                <label className="block text-[10px] font-bold uppercase tracking-wider text-ash">
                  Resolution Oracle Source
                </label>
                <input
                  type="text"
                  required
                  placeholder="World Cup Match Stats API"
                  value={pvpResolutionSource}
                  onChange={(e) => setPvpResolutionSource(e.target.value)}
                  className="w-full h-11 px-3 border border-border dark:border-zinc-800 bg-transparent text-sm rounded-[10px] outline-none focus:border-indigo-500 transition-colors"
                />
              </div>

              {/* ─── Category-Based Proposition Builder ─── */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="block text-[10px] font-bold uppercase tracking-wider text-ash">
                    Market Propositions
                  </span>
                  <span
                    className={`text-[10px] font-bold font-mono px-1.5 py-0.5 rounded ${
                      generatedOptions.length >= 3
                        ? "bg-green-500/10 text-green-600"
                        : "bg-amber-500/10 text-amber-600"
                    }`}
                  >
                    {generatedOptions.length} propositions
                  </span>
                </div>

                {/* ─── Winner Category ─── */}
                <CategoryCard
                  title="Match Winner"
                  subtitle="3-way: Win / Draw / Win"
                  icon={<Trophy className="h-4 w-4" />}
                  enabled={categories.winner.enabled}
                  onToggle={() => toggleCategory("winner")}
                  accentColor="indigo"
                >
                  <div className="grid grid-cols-3 gap-2">
                    <div className="flex flex-col items-center gap-1.5 p-3 rounded-lg bg-indigo-50/80 dark:bg-indigo-950/20 border border-indigo-100 dark:border-indigo-900/40">
                      <span className="text-[10px] font-bold uppercase text-ash tracking-wider">
                        Home
                      </span>
                      <span className="text-sm font-bold text-indigo-700 dark:text-indigo-300 text-center leading-tight">
                        {hasTeams ? teamA : "Team A"}
                      </span>
                    </div>
                    <div className="flex flex-col items-center gap-1.5 p-3 rounded-lg bg-stone-100/80 dark:bg-zinc-800/40 border border-stone-200 dark:border-zinc-700/60">
                      <span className="text-[10px] font-bold uppercase text-ash tracking-wider">
                        Draw
                      </span>
                      <span className="text-sm font-bold text-stone-600 dark:text-zinc-300 text-center leading-tight">
                        Draw
                      </span>
                    </div>
                    <div className="flex flex-col items-center gap-1.5 p-3 rounded-lg bg-rose-50/80 dark:bg-rose-950/20 border border-rose-100 dark:border-rose-900/40">
                      <span className="text-[10px] font-bold uppercase text-ash tracking-wider">
                        Away
                      </span>
                      <span className="text-sm font-bold text-rose-700 dark:text-rose-300 text-center leading-tight">
                        {hasTeams ? teamB : "Team B"}
                      </span>
                    </div>
                  </div>
                </CategoryCard>

                {/* ─── First Team to Score Category ─── */}
                <CategoryCard
                  title="First Team to Score"
                  subtitle="3-way: Team A / No Goal / Team B"
                  icon={<Target className="h-4 w-4" />}
                  enabled={categories.firstScore.enabled}
                  onToggle={() => toggleCategory("firstScore")}
                  accentColor="orange"
                >
                  <div className="grid grid-cols-3 gap-2">
                    <div className="flex flex-col items-center gap-1.5 p-3 rounded-lg bg-orange-50/80 dark:bg-orange-950/20 border border-orange-100 dark:border-orange-900/40">
                      <span className="text-[10px] font-bold uppercase text-ash tracking-wider">
                        Home
                      </span>
                      <span className="text-sm font-bold text-orange-700 dark:text-orange-300 text-center leading-tight">
                        {hasTeams ? teamA : "Team A"}
                      </span>
                    </div>
                    <div className="flex flex-col items-center gap-1.5 p-3 rounded-lg bg-stone-100/80 dark:bg-zinc-800/40 border border-stone-200 dark:border-zinc-700/60">
                      <span className="text-[10px] font-bold uppercase text-ash tracking-wider">
                        No Goal
                      </span>
                      <span className="text-sm font-bold text-stone-600 dark:text-zinc-300 text-center leading-tight">
                        No Goal
                      </span>
                    </div>
                    <div className="flex flex-col items-center gap-1.5 p-3 rounded-lg bg-rose-50/80 dark:bg-rose-950/20 border border-rose-100 dark:border-rose-900/40">
                      <span className="text-[10px] font-bold uppercase text-ash tracking-wider">
                        Away
                      </span>
                      <span className="text-sm font-bold text-rose-700 dark:text-rose-300 text-center leading-tight">
                        {hasTeams ? teamB : "Team B"}
                      </span>
                    </div>
                  </div>
                </CategoryCard>

                {/* ─── Red Card Category ─── */}
                <CategoryCard
                  title="Red Card"
                  subtitle="Red card shown in match"
                  icon={<ShieldAlert className="h-4 w-4" />}
                  enabled={categories.redCard.enabled}
                  onToggle={() => toggleCategory("redCard")}
                  accentColor="red"
                >
                  <div className="grid grid-cols-2 gap-2">
                    <div className="flex flex-col items-center gap-1.5 p-3 rounded-lg bg-red-50/80 dark:bg-red-950/20 border border-red-100 dark:border-red-900/40">
                      <span className="text-[10px] font-bold uppercase text-ash tracking-wider">
                        Yes
                      </span>
                      <span className="text-sm font-bold text-red-700 dark:text-red-300 text-center leading-tight">
                        Red card shown
                      </span>
                    </div>
                    <div className="flex flex-col items-center gap-1.5 p-3 rounded-lg bg-stone-100/80 dark:bg-zinc-800/40 border border-stone-200 dark:border-zinc-700/60">
                      <span className="text-[10px] font-bold uppercase text-ash tracking-wider">
                        No
                      </span>
                      <span className="text-sm font-bold text-stone-600 dark:text-zinc-300 text-center leading-tight">
                        No red cards
                      </span>
                    </div>
                  </div>
                </CategoryCard>

                {/* ─── Corners Category ─── */}
                <CategoryCard
                  title="Corners"
                  subtitle={`Over / Under ${categories.corners.line}`}
                  icon={<Flag className="h-4 w-4" />}
                  enabled={categories.corners.enabled}
                  onToggle={() => toggleCategory("corners")}
                  accentColor="emerald"
                >
                  <div className="space-y-2.5">
                    <span className="block text-[10px] font-bold uppercase text-ash tracking-wider">
                      Select handicap line
                    </span>
                    <div className="flex gap-1.5">
                      {CORNER_LINES.map((line) => (
                        <button
                          key={line}
                          type="button"
                          onClick={() => setCategoryLine("corners", line)}
                          className={`flex-1 h-9 rounded-lg text-xs font-bold transition-all border ${
                            categories.corners.line === line
                              ? "bg-emerald-600 text-white border-emerald-600 shadow-sm"
                              : "bg-white dark:bg-zinc-900 border-border dark:border-zinc-700 text-stone-600 dark:text-zinc-400 hover:border-emerald-400 hover:text-emerald-600"
                          }`}
                        >
                          {line}
                        </button>
                      ))}
                    </div>
                    <div className="grid grid-cols-2 gap-2 mt-1">
                      <div className="flex items-center justify-center gap-1.5 p-2 rounded-lg bg-emerald-50/80 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/40">
                        <ChevronDown className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                        <span className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-300">
                          Under {categories.corners.line}
                        </span>
                      </div>
                      <div className="flex items-center justify-center gap-1.5 p-2 rounded-lg bg-emerald-50/80 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/40">
                        <ChevronUp className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                        <span className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-300">
                          Over {categories.corners.line}
                        </span>
                      </div>
                    </div>
                  </div>
                </CategoryCard>

                {/* ─── Goals Category ─── */}
                <CategoryCard
                  title="Goals"
                  subtitle={`Over / Under ${categories.goals.line}`}
                  icon={<Target className="h-4 w-4" />}
                  enabled={categories.goals.enabled}
                  onToggle={() => toggleCategory("goals")}
                  accentColor="amber"
                >
                  <div className="space-y-2.5">
                    <span className="block text-[10px] font-bold uppercase text-ash tracking-wider">
                      Select handicap line
                    </span>
                    <div className="flex gap-1.5">
                      {GOAL_LINES.map((line) => (
                        <button
                          key={line}
                          type="button"
                          onClick={() => setCategoryLine("goals", line)}
                          className={`flex-1 h-9 rounded-lg text-xs font-bold transition-all border ${
                            categories.goals.line === line
                              ? "bg-amber-500 text-white border-amber-500 shadow-sm"
                              : "bg-white dark:bg-zinc-900 border-border dark:border-zinc-700 text-stone-600 dark:text-zinc-400 hover:border-amber-400 hover:text-amber-600"
                          }`}
                        >
                          {line}
                        </button>
                      ))}
                    </div>
                    <div className="grid grid-cols-2 gap-2 mt-1">
                      <div className="flex items-center justify-center gap-1.5 p-2 rounded-lg bg-amber-50/80 dark:bg-amber-950/20 border border-amber-100 dark:border-amber-900/40">
                        <ChevronDown className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
                        <span className="text-[11px] font-semibold text-amber-700 dark:text-amber-300">
                          Under {categories.goals.line}
                        </span>
                      </div>
                      <div className="flex items-center justify-center gap-1.5 p-2 rounded-lg bg-amber-50/80 dark:bg-amber-950/20 border border-amber-100 dark:border-amber-900/40">
                        <ChevronUp className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
                        <span className="text-[11px] font-semibold text-amber-700 dark:text-amber-300">
                          Over {categories.goals.line}
                        </span>
                      </div>
                    </div>
                  </div>
                </CategoryCard>

                {/* ─── Yellow Cards Category ─── */}
                <CategoryCard
                  title="Yellow Cards"
                  subtitle={`Over / Under ${categories.cards.line}`}
                  icon={<AlertTriangle className="h-4 w-4" />}
                  enabled={categories.cards.enabled}
                  onToggle={() => toggleCategory("cards")}
                  accentColor="yellow"
                >
                  <div className="space-y-2.5">
                    <span className="block text-[10px] font-bold uppercase text-ash tracking-wider">
                      Select handicap line
                    </span>
                    <div className="flex gap-1.5">
                      {CARD_LINES.map((line) => (
                        <button
                          key={line}
                          type="button"
                          onClick={() => setCategoryLine("cards", line)}
                          className={`flex-1 h-9 rounded-lg text-xs font-bold transition-all border ${
                            categories.cards.line === line
                              ? "bg-yellow-500 text-white border-yellow-500 shadow-sm"
                              : "bg-white dark:bg-zinc-900 border-border dark:border-zinc-700 text-stone-600 dark:text-zinc-400 hover:border-yellow-400 hover:text-yellow-600"
                          }`}
                        >
                          {line}
                        </button>
                      ))}
                    </div>
                    <div className="grid grid-cols-2 gap-2 mt-1">
                      <div className="flex items-center justify-center gap-1.5 p-2 rounded-lg bg-yellow-50/80 dark:bg-yellow-950/20 border border-yellow-100 dark:border-yellow-900/40">
                        <ChevronDown className="h-3.5 w-3.5 text-yellow-600 dark:text-yellow-400" />
                        <span className="text-[11px] font-semibold text-yellow-700 dark:text-yellow-300">
                          Under {categories.cards.line}
                        </span>
                      </div>
                      <div className="flex items-center justify-center gap-1.5 p-2 rounded-lg bg-yellow-50/80 dark:bg-yellow-950/20 border border-yellow-100 dark:border-yellow-900/40">
                        <ChevronUp className="h-3.5 w-3.5 text-yellow-600 dark:text-yellow-400" />
                        <span className="text-[11px] font-semibold text-yellow-700 dark:text-yellow-300">
                          Over {categories.cards.line}
                        </span>
                      </div>
                    </div>
                  </div>
                </CategoryCard>

                {/* ─── Custom Propositions ─── */}
                <div className="rounded-xl border border-dashed border-border dark:border-zinc-700 p-3 space-y-2.5">
                  <span className="block text-[10px] font-bold uppercase text-ash tracking-wider">
                    Custom Propositions
                  </span>
                  {customOptions.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {customOptions.map((opt, idx) => (
                        <span
                          key={idx}
                          className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-stone-100 dark:bg-zinc-800 border border-border dark:border-zinc-700 text-[11px] font-medium text-stone-700 dark:text-zinc-300"
                        >
                          {opt}
                          <button
                            type="button"
                            onClick={() => handleRemoveCustomOption(idx)}
                            className="text-stone-400 hover:text-red-500 transition-colors ml-0.5"
                          >
                            <Minus className="h-3 w-3" />
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="Type custom proposition..."
                      value={customOptionText}
                      onChange={(e) => setCustomOptionText(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault()
                          handleAddCustomOption()
                        }
                      }}
                      className="flex-1 h-9 px-3 border border-border dark:border-zinc-800 bg-transparent text-xs rounded-[8px] outline-none focus:border-indigo-500 transition-colors"
                    />
                    <button
                      type="button"
                      onClick={handleAddCustomOption}
                      className="px-3 h-9 bg-indigo-50 hover:bg-indigo-100 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-indigo-600 dark:text-zinc-200 rounded-[8px] text-xs font-semibold flex items-center gap-1 transition-all border border-indigo-100 dark:border-zinc-700"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      Add
                    </button>
                  </div>
                </div>
              </div>

              {/* ─── Summary Preview ─── */}
              {generatedOptions.length > 0 && (
                <div className="rounded-xl bg-stone-50 dark:bg-zinc-900/40 border border-border dark:border-zinc-800 p-3">
                  <span className="block text-[10px] font-bold uppercase text-ash tracking-wider mb-2">
                    Preview — {generatedOptions.length} propositions will be
                    created
                  </span>
                  <div className="space-y-1">
                    {generatedOptions.map((opt, idx) => (
                      <div
                        key={idx}
                        className="flex items-center gap-2 text-[11px] text-stone-600 dark:text-zinc-400"
                      >
                        <span className="h-1.5 w-1.5 rounded-full bg-indigo-400 shrink-0" />
                        {opt}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <Button
                type="submit"
                disabled={loading || generatedOptions.length < 3}
                className="w-full h-11 bg-indigo-600 hover:bg-indigo-500 text-white text-xs uppercase tracking-wider font-semibold rounded-[8px] shadow-sm disabled:opacity-40 disabled:cursor-not-allowed mt-1 cursor-pointer"
              >
                {loading
                  ? "Deploying..."
                  : generatedOptions.length < 3
                    ? `Enable more categories (${generatedOptions.length}/3 min)`
                    : `Deploy Event — ${generatedOptions.length} Propositions`}
              </Button>
            </form>
          </div>
        </section>

        {/* Right Side: Prediction Markets Arbitration */}
        <section className="lg:col-span-7 flex flex-col gap-6">
          {/* Resolve Dialog Modal Card */}
          {selectedMarketId &&
            (() => {
              const selectedMarket = markets.find(
                (m) => m.id === selectedMarketId,
              )
              return (
                <div className="verity-card p-5 border border-amber-300 dark:border-amber-950 bg-amber-500/5">
                  <div className="flex items-center justify-between border-b border-dashed border-border pb-3 mb-4">
                    <div>
                      <h3 className="text-base font-bold tracking-tight text-amber-600 dark:text-amber-400">
                        Arbitrate / Resolve Prediction Market
                      </h3>
                      <span className="text-[10px] font-mono text-ash uppercase block truncate max-w-[280px]">
                        Question: {selectedMarket?.question}
                      </span>
                      <span className="text-[9px] font-mono text-ash uppercase block">
                        Market ID: {selectedMarketId}
                      </span>
                    </div>
                    <button
                      onClick={() => setSelectedMarketId(null)}
                      className="text-xs text-ash hover:text-charcoal-primary dark:hover:text-white underline"
                    >
                      Cancel
                    </button>
                  </div>

                  <form
                    onSubmit={handleResolveMarket}
                    className="flex flex-col gap-4"
                  >
                    <div className="space-y-2">
                      <label className="block text-[10px] font-bold uppercase tracking-wider text-ash">
                        Winning Outcome
                      </label>
                      <div className="flex bg-white dark:bg-zinc-900 border border-border dark:border-zinc-800 rounded-[10px] p-0.5 w-fit">
                        <button
                          type="button"
                          onClick={() => setWinningOutcome("YES")}
                          className={`px-4 py-2 rounded-[8px] text-xs font-bold transition-all ${
                            winningOutcome === "YES"
                              ? "bg-meadow-green text-white shadow-subtle"
                              : "text-ash hover:text-charcoal-primary dark:hover:text-white"
                          }`}
                        >
                          Resolve {selectedMarket?.yesCondition || "YES"}
                        </button>
                        <button
                          type="button"
                          onClick={() => setWinningOutcome("NO")}
                          className={`px-4 py-2 rounded-[8px] text-xs font-bold transition-all ${
                            winningOutcome === "NO"
                              ? "bg-ember-orange text-white shadow-subtle"
                              : "text-ash hover:text-charcoal-primary dark:hover:text-white"
                          }`}
                        >
                          Resolve {selectedMarket?.noCondition || "NO"}
                        </button>
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <label className="block text-[10px] font-bold uppercase tracking-wider text-ash">
                        On-Chain Settlement TX Hash
                      </label>
                      <input
                        type="text"
                        required
                        value={resolveTxHash}
                        onChange={(e) => setResolveTxHash(e.target.value)}
                        className="w-full h-11 px-3 border border-border dark:border-zinc-800 bg-white dark:bg-zinc-900 font-mono text-[11px] rounded-[10px] outline-none"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="block text-[10px] font-bold uppercase tracking-wider text-ash">
                        Fee Collector / Admin Wallet Address
                      </label>
                      <input
                        type="text"
                        required
                        value={adminAddress}
                        onChange={(e) => setAdminAddress(e.target.value)}
                        className="w-full h-11 px-3 border border-border dark:border-zinc-800 bg-white dark:bg-zinc-900 font-mono text-[11px] rounded-[10px] outline-none"
                      />
                    </div>

                    <Button
                      type="submit"
                      disabled={loading}
                      className="w-full h-11 bg-amber-500 hover:bg-amber-600 text-white font-bold uppercase tracking-wider text-xs shadow-md mt-2 disabled:opacity-50 cursor-pointer"
                    >
                      {loading
                        ? "Finalizing Settlement..."
                        : "Publish Settlement & Distribute Pools"}
                    </Button>
                  </form>
                </div>
              )
            })()}

          {/* Market Moderation Dashboard */}
          <div className="verity-card overflow-hidden">
            <div className="p-4 border-b border-border bg-white dark:bg-zinc-900/40 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold tracking-tight text-charcoal-primary dark:text-white flex items-center gap-1.5">
                  <TrendingUp className="h-4 w-4" />
                  Prediction Market Moderation
                </h3>
                <p className="text-xs text-ash mt-0.5 font-mono">
                  Approve qualified markets for trading and resolve settled
                  markets.
                </p>
              </div>

              <button
                onClick={fetchMarkets}
                disabled={marketsLoading}
                className="h-8 w-8 rounded-lg hover:bg-stone-100 dark:hover:bg-zinc-800 border border-border flex items-center justify-center text-ash hover:text-charcoal-primary dark:hover:text-white transition-colors"
              >
                <RefreshCw
                  className={`h-4 w-4 ${marketsLoading ? "animate-spin" : ""}`}
                />
              </button>
            </div>

            {marketsLoading && markets.length === 0 ? (
              <div className="p-10 text-center text-sm text-ash animate-pulse">
                Loading prediction markets...
              </div>
            ) : markets.length === 0 ? (
              <div className="p-10 text-center text-sm text-ash font-mono">
                No active prediction markets found.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-left text-xs font-mono">
                  <thead>
                    <tr className="border-b border-border bg-stone-50 dark:bg-zinc-900/40 text-ash uppercase font-bold tracking-wider">
                      <th className="p-3">Market Question</th>
                      <th className="p-3 w-[100px]">Status</th>
                      <th className="p-3 w-[150px] text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border dark:divide-zinc-800">
                    {markets.map((market) => (
                      <tr
                        key={market.id}
                        className="hover:bg-stone-50/40 dark:hover:bg-zinc-900/20"
                      >
                        <td className="p-3 align-middle">
                          <span className="block font-semibold text-charcoal-primary dark:text-zinc-100 font-sans text-xs truncate max-w-[280px]">
                            {market.question}
                          </span>
                          <span className="text-[9px] text-ash block mt-0.5">
                            ID: {market.id.slice(-6).toUpperCase()} • Cat:{" "}
                            {market.category}
                          </span>
                        </td>
                        <td className="p-3 align-middle">
                          <span
                            className={`inline-flex px-1.5 py-0.5 rounded text-[8px] font-bold uppercase tracking-wider font-mono ${
                              market.status === "qualified"
                                ? "bg-amber-500/10 text-amber-600"
                                : market.status === "tradable"
                                  ? "bg-green-500/10 text-green-600"
                                  : market.status === "open_for_votes"
                                    ? "bg-blue-500/10 text-blue-600"
                                    : "bg-zinc-500/10 text-zinc-500"
                            }`}
                          >
                            {market.status}
                          </span>
                        </td>
                        <td className="p-3 text-right align-middle shrink-0 flex items-center justify-end gap-1.5">
                          {market.status === "qualified" && (
                            <Button
                              onClick={() => handleApproveTrading(market.id)}
                              variant="default"
                              size="sm"
                              className="bg-emerald-600 hover:bg-emerald-500 text-white font-semibold rounded-[8px] transition-colors cursor-pointer"
                            >
                              Approve Trading
                            </Button>
                          )}
                          {market.status === "funding_pool" && (
                            <Button
                              onClick={() => openAddLiquidityModal(market.id)}
                              variant="default"
                              size="sm"
                              className="bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-[8px] transition-colors cursor-pointer"
                            >
                              Add Liquidity
                            </Button>
                          )}
                          {market.status === "tradable" && (
                            <>
                              <Button
                                onClick={() => openAddLiquidityModal(market.id)}
                                variant="outline"
                                size="sm"
                                className="border-indigo-200 dark:border-indigo-900 text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-950/20 font-semibold rounded-[8px] transition-colors cursor-pointer"
                              >
                                Add Liquidity
                              </Button>
                              <Button
                                onClick={() => setSelectedMarketId(market.id)}
                                variant="default"
                                size="sm"
                                className="bg-amber-500 hover:bg-amber-600 text-white font-semibold rounded-[8px] transition-colors cursor-pointer"
                              >
                                Arbitrate Resolve
                              </Button>
                            </>
                          )}
                          {market.status === "resolving" && (
                            <Button
                              onClick={() => setSelectedMarketId(market.id)}
                              variant="default"
                              size="sm"
                              className="bg-amber-500 hover:bg-amber-600 text-white font-semibold rounded-[8px] transition-colors cursor-pointer"
                            >
                              Arbitrate Resolve
                            </Button>
                          )}
                          {![
                            "qualified",
                            "funding_pool",
                            "tradable",
                            "resolving",
                          ].includes(market.status) && (
                            <span className="text-[10px] text-ash font-mono uppercase">
                              No Actions
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </section>
      </main>

      {/* Dialog for Add Liquidity */}
      <Dialog open={isAddLiquidityOpen} onOpenChange={setIsAddLiquidityOpen}>
        <DialogContent className="sm:max-w-[425px] bg-white dark:bg-zinc-950 border border-border dark:border-zinc-800 rounded-lg shadow-lg">
          <form onSubmit={handleAddLiquidity}>
            <DialogHeader>
              <DialogTitle className="text-base font-bold text-charcoal-primary dark:text-white">
                Deposit Pre-Market Liquidity
              </DialogTitle>
              <DialogDescription className="text-xs text-ash mt-1">
                Fund the on-chain escrow balance for this prediction market.
                Funding meets the threshold to activate the market for trading.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4 my-2">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-mono font-bold uppercase tracking-wider text-ash">
                  Market ID
                </label>
                <input
                  type="text"
                  disabled
                  value={liquidityMarketId || ""}
                  className="w-full h-9 px-3 border border-border dark:border-zinc-800 bg-stone-50 dark:bg-zinc-900 text-xs font-mono rounded-[8px] outline-none text-ash"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-mono font-bold uppercase tracking-wider text-ash">
                  USDC Deposit Amount
                </label>
                <input
                  type="number"
                  min="1"
                  required
                  value={liquidityAmount}
                  onChange={(e) => setLiquidityAmount(e.target.value)}
                  className="w-full h-9 px-3 border border-border dark:border-zinc-800 bg-white dark:bg-zinc-900 text-sm font-semibold rounded-[8px] outline-none focus:border-indigo-500 transition-colors"
                />
              </div>
            </div>
            <DialogFooter className="flex gap-2 justify-end pt-2 border-t border-border dark:border-zinc-800/80">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsAddLiquidityOpen(false)}
                className="h-9 px-4 rounded-[8px] text-xs font-semibold cursor-pointer border border-border"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={loading}
                className="h-9 px-4 rounded-[8px] text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white cursor-pointer"
              >
                {loading ? "Depositing..." : "Confirm Deposit"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}

/* ──────────────────────────────────────────────
   CategoryCard — reusable toggle card component
   ────────────────────────────────────────────── */
function CategoryCard({
  title,
  subtitle,
  icon,
  enabled,
  onToggle,
  accentColor,
  children,
}: {
  title: string
  subtitle: string
  icon: React.ReactNode
  enabled: boolean
  onToggle: () => void
  accentColor: string
  children: React.ReactNode
}) {
  // Map accent colors to classes
  const colorMap: Record<
    string,
    { bg: string; border: string; text: string; toggle: string }
  > = {
    indigo: {
      bg: "bg-indigo-50/50 dark:bg-indigo-950/10",
      border: "border-indigo-200 dark:border-indigo-900/50",
      text: "text-indigo-600 dark:text-indigo-400",
      toggle: "bg-indigo-600",
    },
    emerald: {
      bg: "bg-emerald-50/50 dark:bg-emerald-950/10",
      border: "border-emerald-200 dark:border-emerald-900/50",
      text: "text-emerald-600 dark:text-emerald-400",
      toggle: "bg-emerald-600",
    },
    amber: {
      bg: "bg-amber-50/50 dark:bg-amber-950/10",
      border: "border-amber-200 dark:border-amber-900/50",
      text: "text-amber-600 dark:text-amber-400",
      toggle: "bg-amber-500",
    },
    yellow: {
      bg: "bg-yellow-50/50 dark:bg-yellow-950/10",
      border: "border-yellow-200 dark:border-yellow-900/50",
      text: "text-yellow-600 dark:text-yellow-400",
      toggle: "bg-yellow-500",
    },
  }

  const colors = colorMap[accentColor] || colorMap.indigo

  return (
    <div
      className={`rounded-xl border transition-all overflow-hidden ${
        enabled
          ? `${colors.bg} ${colors.border}`
          : "border-border dark:border-zinc-800 bg-white dark:bg-zinc-900/30"
      }`}
    >
      {/* Header — always visible */}
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center justify-between p-3 gap-3 cursor-pointer group"
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <div
            className={`h-8 w-8 rounded-lg flex items-center justify-center shrink-0 transition-colors ${
              enabled
                ? `${colors.toggle} text-white`
                : "bg-stone-100 dark:bg-zinc-800 text-stone-400 dark:text-zinc-500 group-hover:text-stone-600"
            }`}
          >
            {icon}
          </div>
          <div className="text-left min-w-0">
            <span className="block text-sm font-bold text-charcoal-primary dark:text-white leading-tight">
              {title}
            </span>
            <span className="block text-[10px] text-ash font-mono truncate">
              {subtitle}
            </span>
          </div>
        </div>

        {/* Toggle Switch */}
        <div
          className={`relative h-6 w-11 rounded-full shrink-0 transition-colors ${
            enabled ? colors.toggle : "bg-stone-200 dark:bg-zinc-700"
          }`}
        >
          <div
            className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
              enabled ? "translate-x-5" : "translate-x-0.5"
            }`}
          />
        </div>
      </button>

      {/* Body — collapsible */}
      <div
        className={`transition-all overflow-hidden ${
          enabled ? "max-h-[500px] opacity-100" : "max-h-0 opacity-0"
        }`}
      >
        <div className="px-3 pb-3">{children}</div>
      </div>
    </div>
  )
}
