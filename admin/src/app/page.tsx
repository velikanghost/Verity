"use client"

import { useState, useEffect } from "react"
import { apiRequest } from "@/store/apiClient"
import { toast } from "react-hot-toast"
import {
  ShieldAlert,
  Swords,
  TrendingUp,
  Key,
  Mail,
  LogOut,
  Calendar,
  CheckCircle,
  HelpCircle,
  RefreshCw,
  Plus,
  Trash2,
  Wallet,
  Copy,
  Info,
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

const PREDEFINED_PROPOSITIONS = [
  "wins the match",
  "scores first goal",
  "leads at halftime",
  "has more corner kicks",
  "keeps a clean sheet",
  "has over 2.5 yellow cards",
  "scores in both halves",
  "ends in a draw",
  "receives a red card",
  "commits more fouls",
  "has over 1.5 offsides",
]

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
  const [pvpResolutionSource, setPvpResolutionSource] = useState("World Cup Oracle")
  const [pvpOptions, setPvpOptions] = useState<string[]>([
    "wins the match",
    "scores first goal",
    "leads at halftime",
    "has more corner kicks",
    "keeps a clean sheet",
    "has over 2.5 yellow cards",
    "scores in both halves",
  ])

  // Admin Wallet & Balance State
  const [adminBalances, setAdminBalances] = useState<{
    adminAddress: string
    arcBalance: number
    usdcBalance: number
    preDepositUsdcPerOption: number
    creationFeeUsdc: number
  } | null>(null)

  // Options Pool Selector State
  const [availableOptions, setAvailableOptions] = useState<string[]>(PREDEFINED_PROPOSITIONS)
  const [customOptionText, setCustomOptionText] = useState("")

  // Arbitration / Resolve Form State
  const [selectedMarketId, setSelectedMarketId] = useState<string | null>(null)
  const [winningOutcome, setWinningOutcome] = useState<"YES" | "NO">("YES")
  const [resolveTxHash, setResolveTxHash] = useState("0x" + "a".repeat(64))
  const [adminAddress, setAdminAddress] = useState("0x0000000000000000000000000000000000000000")

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

  // Add custom option to pool helper
  function handleAddCustomOption() {
    const text = customOptionText.trim().toLowerCase()
    if (!text) return
    if (availableOptions.includes(text)) {
      toast.error("Option already exists in the pool.")
      return
    }
    setAvailableOptions([...availableOptions, text])
    if (pvpOptions.length < 7) {
      setPvpOptions([...pvpOptions, text])
    }
    setCustomOptionText("")
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
      // Fetch markets directly with the admin filter query
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
      const response = await apiRequest<{ token: string; user: any }>("/auth/verify-otp", {
        method: "POST",
        body: JSON.stringify({ email: email.trim(), code: otpCode.trim() }),
      })
      
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

  // Deploy PvP Parent + 7 Child events
  async function handleDeployPvpEvent(e: React.FormEvent) {
    e.preventDefault()
    if (!pvpQuestion.trim() || !pvpDeadline || !pvpResolutionSource.trim()) {
      toast.error("Please fill all fields.")
      return
    }

    if (pvpOptions.length !== 7 || pvpOptions.some(opt => !opt.trim())) {
      toast.error("You must specify exactly 7 options.")
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
          options: pvpOptions.map(opt => opt.trim()),
        }),
      })
      toast.success("Successfully deployed PvP Event + 7 Proposition markets!")
      setPvpQuestion("")
      setPvpDeadline("")
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
            <h1 className="text-2xl font-bold mt-3 tracking-tight">Verity Admin Login</h1>
            <p className="text-xs text-ash mt-1">Please authenticate to access administrative moderation controls.</p>
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
              <button
                type="submit"
                disabled={loading}
                className="verity-pill w-full h-11 bg-indigo-600 text-white hover:bg-indigo-500 text-xs uppercase tracking-wider disabled:opacity-50"
              >
                {loading ? "Requesting OTP..." : "Send OTP Verification Code"}
              </button>
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
                <button
                  type="button"
                  onClick={() => setOtpSent(false)}
                  className="verity-pill flex-1 h-11 bg-stone-100 hover:bg-stone-200 text-stone-700 dark:bg-zinc-800 dark:hover:bg-zinc-700 dark:text-zinc-300 text-xs uppercase tracking-wider"
                >
                  Back
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="verity-pill flex-[2] h-11 bg-indigo-600 text-white hover:bg-indigo-500 text-xs uppercase tracking-wider disabled:opacity-50"
                >
                  {loading ? "Verifying..." : "Verify & Sign In"}
                </button>
              </div>
            </form>
          )}

          <div className="relative flex py-2 items-center">
            <div className="flex-grow border-t border-border"></div>
            <span className="flex-shrink mx-4 text-[10px] font-mono font-bold uppercase text-ash">Or Direct JWT</span>
            <div className="flex-grow border-t border-border"></div>
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
            <button
              type="submit"
              className="verity-pill w-full h-11 bg-stone-900 text-white hover:bg-stone-800 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-xs uppercase tracking-wider"
            >
              Direct JWT Login
            </button>
          </form>
        </div>
      </main>
    )
  }

  // Render Admin Console Dashboard
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
              <h1 className="font-bold text-sm leading-tight text-charcoal-primary dark:text-white">Admin Console</h1>
              <span className="text-[10px] font-mono text-ash uppercase">Verity Predictions</span>
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
            <div className="verity-card p-5 bg-gradient-to-br from-indigo-500/[0.04] via-transparent to-transparent border border-indigo-500/10 flex flex-col gap-4">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="h-9 w-9 rounded-lg bg-indigo-500/10 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
                    <Wallet className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-xs font-bold uppercase tracking-wider text-ash">Admin Wallet Status</h3>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className="font-mono text-[10px] text-charcoal-primary dark:text-zinc-300">
                        {adminBalances.adminAddress.slice(0, 6)}...{adminBalances.adminAddress.slice(-4)}
                      </span>
                      <button
                        type="button"
                        onClick={() => copyToClipboard(adminBalances.adminAddress)}
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
                  <span className="block text-[10px] font-bold text-ash uppercase">USDC Balance</span>
                  <span className="font-mono text-base font-bold text-charcoal-primary dark:text-white">
                    {adminBalances.usdcBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
                <div>
                  <span className="block text-[10px] font-bold text-ash uppercase">Gas (ARC) Balance</span>
                  <span className="font-mono text-base font-bold text-charcoal-primary dark:text-white">
                    {adminBalances.arcBalance.toLocaleString(undefined, { minimumFractionDigits: 4, maximumFractionDigits: 4 })}
                  </span>
                </div>
              </div>

              <div className="p-3 bg-stone-50 dark:bg-zinc-900/30 rounded-lg border border-border dark:border-zinc-800/80 flex items-start gap-2">
                <Info className="h-4 w-4 text-indigo-500 shrink-0 mt-0.5" />
                <div className="text-[10px] text-ash leading-relaxed">
                  <p className="font-semibold text-charcoal-primary dark:text-zinc-300">PvP Event Cost Estimator:</p>
                  <p>Deployment requires funding 7 child options with <span className="font-bold text-indigo-600 dark:text-indigo-400">{adminBalances.preDepositUsdcPerOption.toFixed(2)} USDC</span> each.</p>
                  <p className="mt-0.5">Total funding cost: <span className="font-bold text-indigo-600 dark:text-indigo-400">{(adminBalances.preDepositUsdcPerOption * 7).toFixed(2)} USDC</span> + gas fees.</p>
                </div>
              </div>
            </div>
          )}

          <div className="verity-card p-5 flex flex-col gap-4">
            <div className="border-b border-border pb-3">
              <h2 className="text-base font-bold tracking-tight text-charcoal-primary dark:text-white flex items-center gap-2">
                <Swords className="h-5 w-5 text-indigo-500" />
                Deploy World Cup PvP Matchup
              </h2>
              <p className="text-xs text-ash mt-0.5">Creates a parent event and 7 YES/NO proposition child markets.</p>
            </div>

            <form onSubmit={handleDeployPvpEvent} className="flex flex-col gap-4">
              <div className="space-y-1.5">
                <label className="block text-[10px] font-bold uppercase tracking-wider text-ash">
                  Match Title / Question
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. USA vs Paraguay"
                  value={pvpQuestion}
                  onChange={(e) => setPvpQuestion(e.target.value)}
                  className="w-full h-11 px-3 border border-border dark:border-zinc-800 bg-transparent text-sm rounded-[10px] outline-none focus:border-indigo-500 transition-colors"
                />
              </div>

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

              {/* Options Pool Selector */}
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="block text-[10px] font-bold uppercase tracking-wider text-ash">
                    Propositions Pool (Select exactly 7)
                  </span>
                  <span className={`text-[10px] font-bold font-mono px-1.5 py-0.5 rounded ${
                    pvpOptions.length === 7 ? "bg-green-500/10 text-green-600" : "bg-amber-500/10 text-amber-600"
                  }`}>
                    Selected: {pvpOptions.length} / 7
                  </span>
                </div>

                {/* Predefined Propositions List */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 bg-stone-50 dark:bg-zinc-900/30 p-3 rounded-[10px] border border-border dark:border-zinc-800 max-h-48 overflow-y-auto">
                  {availableOptions.map((opt) => {
                    const isSelected = pvpOptions.includes(opt)
                    return (
                      <label
                        key={opt}
                        className={`flex items-center gap-2 p-2 rounded-lg cursor-pointer border text-xs transition-all ${
                          isSelected
                            ? "bg-indigo-50/50 dark:bg-indigo-950/20 border-indigo-200 dark:border-indigo-900/50 text-indigo-900 dark:text-indigo-200 font-semibold"
                            : "bg-white dark:bg-zinc-900 border-border dark:border-zinc-800/80 text-charcoal-primary dark:text-zinc-300 hover:bg-stone-50/50"
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isSelected}
                          className="rounded text-indigo-600 focus:ring-indigo-500 border-border dark:border-zinc-800"
                          onChange={() => {
                            if (isSelected) {
                              setPvpOptions(pvpOptions.filter((o) => o !== opt))
                            } else {
                              if (pvpOptions.length >= 7) {
                                toast.error("You can select exactly 7 options. Please uncheck another option first.")
                              } else {
                                setPvpOptions([...pvpOptions, opt])
                              }
                            }
                          }}
                        />
                        <span className="truncate">{opt}</span>
                      </label>
                    )
                  })}
                </div>

                {/* Add Custom Proposition */}
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

              <button
                type="submit"
                disabled={loading || pvpOptions.length !== 7}
                className="verity-pill w-full h-11 bg-indigo-600 text-white hover:bg-indigo-500 text-xs uppercase tracking-wider shadow-subtle disabled:opacity-40 disabled:cursor-not-allowed mt-2"
              >
                {loading ? "Deploying..." : pvpOptions.length !== 7 ? `Select ${7 - pvpOptions.length} More Option(s)` : "Deploy Event & Options"}
              </button>
            </form>
          </div>
        </section>

        {/* Right Side: Prediction Markets Arbitration */}
        <section className="lg:col-span-7 flex flex-col gap-6">
          
          {/* Resolve Dialog Modal Card */}
          {selectedMarketId && (
            (() => {
              const selectedMarket = markets.find((m) => m.id === selectedMarketId)
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

                  <form onSubmit={handleResolveMarket} className="flex flex-col gap-4">
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

                    <button
                      type="submit"
                      disabled={loading}
                      className="verity-pill w-full h-11 bg-amber-500 hover:bg-amber-600 text-white font-bold uppercase tracking-wider text-xs shadow-md mt-2 disabled:opacity-50"
                    >
                      {loading ? "Finalizing Settlement..." : "Publish Settlement & Distribute Pools"}
                    </button>
                  </form>
                </div>
              )
            })()
          )}

          {/* Market Moderation Dashboard */}
          <div className="verity-card overflow-hidden">
            <div className="p-4 border-b border-border bg-white dark:bg-zinc-900/40 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold tracking-tight text-charcoal-primary dark:text-white flex items-center gap-1.5">
                  <TrendingUp className="h-4 w-4" />
                  Prediction Market Moderation
                </h3>
                <p className="text-xs text-ash mt-0.5 font-mono">Approve qualified markets for trading and resolve settled markets.</p>
              </div>

              <button
                onClick={fetchMarkets}
                disabled={marketsLoading}
                className="h-8 w-8 rounded-lg hover:bg-stone-100 dark:hover:bg-zinc-800 border border-border flex items-center justify-center text-ash hover:text-charcoal-primary dark:hover:text-white transition-colors"
              >
                <RefreshCw className={`h-4 w-4 ${marketsLoading ? "animate-spin" : ""}`} />
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
                      <tr key={market.id} className="hover:bg-stone-50/40 dark:hover:bg-zinc-900/20">
                        <td className="p-3 align-middle">
                          <span className="block font-semibold text-charcoal-primary dark:text-zinc-100 font-sans text-xs truncate max-w-[280px]">
                            {market.question}
                          </span>
                          <span className="text-[9px] text-ash block mt-0.5">
                            ID: {market.id.slice(-6).toUpperCase()} • Cat: {market.category}
                          </span>
                        </td>
                        <td className="p-3 align-middle">
                          <span className={`inline-flex px-1.5 py-0.5 rounded text-[8px] font-bold uppercase tracking-wider font-mono ${
                            market.status === "qualified"
                              ? "bg-amber-500/10 text-amber-600"
                              : market.status === "tradable"
                                ? "bg-green-500/10 text-green-600"
                                : market.status === "open_for_votes"
                                  ? "bg-blue-500/10 text-blue-600"
                                  : "bg-zinc-500/10 text-zinc-500"
                          }`}>
                            {market.status}
                          </span>
                        </td>
                        <td className="p-3 text-right align-middle shrink-0">
                          {market.status === "qualified" && (
                            <button
                              onClick={() => handleApproveTrading(market.id)}
                              className="px-2 py-1 bg-green-500 hover:bg-green-600 text-white rounded text-[10px] font-bold uppercase tracking-wider font-mono cursor-pointer transition-colors shadow-subtle"
                            >
                              Approve Trading
                            </button>
                          )}
                          {(market.status === "tradable" || market.status === "resolving") && (
                            <button
                              onClick={() => setSelectedMarketId(market.id)}
                              className="px-2 py-1 bg-amber-500 hover:bg-amber-600 text-white rounded text-[10px] font-bold uppercase tracking-wider font-mono cursor-pointer transition-colors shadow-subtle"
                            >
                              Arbitrate Resolve
                            </button>
                          )}
                          {!["qualified", "tradable", "resolving"].includes(market.status) && (
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
    </div>
  )
}
