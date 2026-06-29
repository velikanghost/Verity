"use client"

import { useState, useEffect } from "react"
import { apiRequest } from "@/store/apiClient"
import { io } from "socket.io-client"
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
import { LogOut, TrendingUp, BarChart4, Sparkles, Ticket, FolderOpen } from "lucide-react"

// Import modular sub-components
import LoginPanel from "@/components/LoginPanel"
import BalancesCard from "@/components/BalancesCard"
import MarketsTable from "@/components/MarketsTable"
import CreateMarketDrawer from "@/components/CreateMarketDrawer"
import ResolveMarketDrawer from "@/components/ResolveMarketDrawer"
import MetricsTab from "@/components/MetricsTab"
import CouponsTab from "@/components/CouponsTab"
import MissionsTab from "@/components/MissionsTab"
import CategoriesTab from "@/components/CategoriesTab"

interface Market {
  id: string
  question: string
  category: string
  deadline: string
  status: string
  resolutionSource?: string
  yesCondition?: string
  noCondition?: string
  outcomes?: string[]
  outcomeCount?: number
  proposalReasoning?: string | null
  proposalCitations?: string[] | null
  proposalProposer?: string | null
  proposalDisputer?: string | null
  disputed?: boolean
  proposedOutcome?: boolean | null
  proposedOutcomeIndex?: number | null
  proposedAt?: string | null
  disputeWindowSeconds?: number
  resolvedOutcome?: string | null
}

interface AdminMetrics {
  users: {
    total: number
    real: number
    bots: number
  }
  pvpUsers: {
    submitted: {
      total: number
      real: number
      bots: number
    }
    played: {
      total: number
      real: number
      bots: number
    }
  }
  pvpMatchesCount: number
  volumeAndFees: {
    overallVolume: number
    overallFees: number
    standardVolume: number
    standardFees: number
    pvpVolume: number
    pvpFees: number
    creationFeesCollected: number
    combinedFees: number
  }
  recentTrades: {
    marketId: string
    marketQuestion: string
    amountUsdc: number
    createdAt: string
  }[]
  activityTimeline: {
    label: string
    signups: number
    trades: number
    tickets: number
  }[]
}

export default function AdminPage() {
  const [token, setToken] = useState("")
  const [isAuthorized, setIsAuthorized] = useState(false)
  const [loading, setLoading] = useState(false)

  // Active Tab
  const [activeTab, setActiveTab] = useState<
    "moderation" | "metrics" | "coupons" | "missions" | "categories"
  >("moderation")

  // Markets state
  const [markets, setMarkets] = useState<Market[]>([])
  const [marketsLoading, setMarketsLoading] = useState(false)

  // Filter & Search & Sort states
  const [searchQuery, setSearchQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const [categoryFilter, setCategoryFilter] = useState("all")
  const [sortBy, setSortBy] = useState("newest")

  // Pagination states
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 10

  // Drawers open/close states
  const [isCreateDrawerOpen, setIsCreateDrawerOpen] = useState(false)
  const [isResolveDrawerOpen, setIsResolveDrawerOpen] = useState(false)

  // Admin Wallet & Balance State
  const [adminBalances, setAdminBalances] = useState<{
    adminAddress: string
    arcBalance: number
    usdcBalance: number
    preDepositUsdcPerOption: number
    creationFeeUsdc: number
  } | null>(null)

  // Contract Balances State
  const [contractBalances, setContractBalances] = useState<{
    fpmmUsdcBalance: number
    factoryUsdcBalance: number
    adminUsdcBalance: number
    adminAddress: string
  } | null>(null)
  const [contractBalancesLoading, setContractBalancesLoading] = useState(false)
  const [isClaimingCreatorLiquidity, setIsClaimingCreatorLiquidity] = useState(false)

  // Metrics Data State
  const [metricsData, setMetricsData] = useState<AdminMetrics | null>(null)
  const [metricsLoading, setMetricsLoading] = useState(false)
  const [metricsTimeframe, setMetricsTimeframe] = useState<string>("7d")

  // Arbitration / Settle State
  const [selectedMarketId, setSelectedMarketId] = useState<string | null>(null)

  // Add Liquidity Dialog State
  const [isAddLiquidityOpen, setIsAddLiquidityOpen] = useState(false)
  const [liquidityAmount, setLiquidityAmount] = useState("40")
  const [liquidityMarketId, setLiquidityMarketId] = useState<string | null>(
    null,
  )

  const [winningOutcome, setWinningOutcome] = useState<string>("YES")
  const [resolveTxHash, setResolveTxHash] = useState("")
  const [adminAddress, setAdminAddress] = useState(
    "0x0000000000000000000000000000000000000000",
  )

  const [now, setNow] = useState(Date.now())
  useEffect(() => {
    if (!selectedMarketId) return
    const timer = setInterval(() => {
      setNow(Date.now())
    }, 1000)
    return () => clearInterval(timer)
  }, [selectedMarketId])

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

  // Fetch metrics data
  async function fetchMetricsData(timeframe?: string) {
    setMetricsLoading(true)
    try {
      const tf = timeframe || metricsTimeframe
      const data = await apiRequest<AdminMetrics>(`/pvp/admin-metrics?timeframe=${tf}`)
      setMetricsData(data)
    } catch (err: any) {
      toast.error(err.message || "Failed to load admin metrics.")
    } finally {
      setMetricsLoading(false)
    }
  }

  // Fetch contract balances
  async function fetchContractBalances() {
    setContractBalancesLoading(true)
    try {
      const data = await apiRequest<any>("/pvp/contract-balances")
      setContractBalances(data)
    } catch (err: any) {
      console.error("Failed to fetch contract balances:", err)
    } finally {
      setContractBalancesLoading(false)
    }
  }

  // Batch claim creator liquidity
  async function handleBatchClaimCreatorLiquidity() {
    setIsClaimingCreatorLiquidity(true)
    const loadingToast = toast.loading("Batch claiming creator liquidity from resolved PvP markets...")
    try {
      const result = await apiRequest<any>("/pvp/admin/claim-creator-liquidity", {
        method: "POST",
      })
      toast.dismiss(loadingToast)
      
      const { claimed, skipped, failed } = result.summary || { claimed: 0, skipped: 0, failed: 0 }
      toast.success(
        `Batch claim completed! Claimed: ${claimed}, Skipped: ${skipped}, Failed: ${failed}`,
        { duration: 5000 }
      )
      
      // Refresh balances & markets
      void fetchAdminStatus()
      void fetchContractBalances()
      void fetchMarkets()
    } catch (err: any) {
      toast.dismiss(loadingToast)
      toast.error(err.message || "Failed to batch claim creator liquidity.")
    } finally {
      setIsClaimingCreatorLiquidity(false)
    }
  }

  // Check auth on load
  useEffect(() => {
    const storedToken = localStorage.getItem("verity_admin_auth_token")
    if (storedToken) {
      setToken(storedToken)
      setIsAuthorized(true)
      void fetchMarkets()
      void fetchAdminStatus()
      void fetchMetricsData()
      void fetchContractBalances()
    }
  }, [])

  // Re-fetch metrics when timeframe changes
  useEffect(() => {
    if (isAuthorized) {
      void fetchMetricsData(metricsTimeframe)
    }
  }, [metricsTimeframe, isAuthorized])

  // Real-time socket updates listener
  useEffect(() => {
    if (!isAuthorized) return

    const socketUrl = process.env.NEXT_PUBLIC_API_URL?.replace("/api", "") || "http://localhost:5080"
    const socket = io(`${socketUrl}/socket`, {
      transports: ["websocket"],
    })

    socket.on("connect", () => {
      console.log("Admin socket client connected successfully")
      socket.emit("join-room", "feed")
    })

    socket.on("feed-updated", () => {
      console.log("Feed updated, refreshing admin dashboard in real-time...")
      void fetchMetricsData()
      void fetchMarkets()
      void fetchAdminStatus()
      void fetchContractBalances()
    })

    return () => {
      socket.disconnect()
    }
  }, [isAuthorized, metricsTimeframe])

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
        outcomes: item.outcomes || [],
        outcomeCount: item.outcomeCount ?? 2,
        proposalReasoning: item.proposalReasoning || item.proposal_reasoning,
        proposalCitations: item.proposalCitations || item.proposal_citations,
        proposalProposer: item.proposalProposer || item.proposal_proposer,
        proposalDisputer: item.proposalDisputer || item.proposal_disputer,
        disputed: item.disputed ?? false,
        proposedOutcome: item.proposedOutcome ?? null,
        proposedAt: item.proposedAt || item.proposed_at || null,
        disputeWindowSeconds: item.disputeWindowSeconds ?? 120,
        resolvedOutcome: item.resolvedOutcome || item.resolved_outcome || null,
      }))
      setMarkets(parsed)
    } catch (err: any) {
      toast.error(err.message || "Failed to load markets.")
    } finally {
      setMarketsLoading(false)
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
      void fetchMetricsData()
    } catch (err: any) {
      toast.error(err.message || "Failed to approve market.")
    } finally {
      setLoading(false)
    }
  }

  const openAddLiquidityModal = (marketId: string) => {
    setLiquidityMarketId(marketId)
    const defaultAmount = adminBalances?.preDepositUsdcPerOption?.toString() || "40"
    setLiquidityAmount(defaultAmount)
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
      void fetchMetricsData()
    } catch (err: any) {
      toast.error(err.message || "Failed to add liquidity.")
    } finally {
      setLoading(false)
    }
  }

  function handleLogOut() {
    localStorage.removeItem("verity_admin_auth_token")
    setIsAuthorized(false)
    setToken("")
    toast.success("Logged out successfully.")
  }

  const getProposedOutcomeText = (market: Market) => {
    if (
      market.proposedOutcomeIndex !== null &&
      market.proposedOutcomeIndex !== undefined
    ) {
      return market.outcomes?.[market.proposedOutcomeIndex] || "None"
    }
    if (market.proposedOutcome === null || market.proposedOutcome === undefined)
      return "None"
    const opts =
      market.outcomes && market.outcomes.length > 0
        ? market.outcomes
        : ["YES", "NO"]
    if (market.proposedOutcome === true) {
      return opts[0] || "YES"
    } else {
      return opts[1] || "NO"
    }
  }

  const handleOpenArbitrateResolve = (market: Market) => {
    setSelectedMarketId(market.id)
    setResolveTxHash("")
    const outcomes =
      market.outcomes && market.outcomes.length > 0
        ? market.outcomes
        : ["YES", "NO"]
    setWinningOutcome(outcomes[0])
    setIsResolveDrawerOpen(true)
  }

  // Load auth context wrapper
  const handleAuthSuccess = () => {
    void fetchMarkets()
    void fetchAdminStatus()
    void fetchMetricsData()
    void fetchContractBalances()
  }

  if (!isAuthorized) {
    return (
      <LoginPanel
        token={token}
        setToken={setToken}
        setIsAuthorized={setIsAuthorized}
        onSuccess={handleAuthSuccess}
      />
    )
  }

  return (
    <div className="min-h-screen flex flex-col bg-stone-50 text-stone-900 font-sans">
      {/* Navbar Header */}
      <header className="border-b border-stone-200 bg-white sticky top-0 z-50 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-[10px] bg-indigo-600 text-white font-bold text-lg shadow-sm">
                V
              </div>
              <div>
                <h1 className="font-bold text-sm leading-tight text-stone-900">
                  Verity Console
                </h1>
                <span className="text-[10px] font-mono text-stone-500 uppercase tracking-wider">
                  Admin Platform
                </span>
              </div>
            </div>

            {/* Navigation Tabs */}
            <nav className="flex items-center gap-1 bg-stone-100 p-1 rounded-lg">
              <button
                onClick={() => setActiveTab("moderation")}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
                  activeTab === "moderation"
                    ? "bg-white text-stone-950 shadow-xs"
                    : "text-stone-600 hover:text-stone-900"
                }`}
              >
                <TrendingUp className="h-3.5 w-3.5" />
                Moderation
              </button>
              <button
                onClick={() => setActiveTab("metrics")}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
                  activeTab === "metrics"
                    ? "bg-white text-stone-950 shadow-xs"
                    : "text-stone-600 hover:text-stone-900"
                }`}
              >
                <BarChart4 className="h-3.5 w-3.5" />
                Metrics
              </button>
              <button
                onClick={() => setActiveTab("coupons")}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
                  activeTab === "coupons"
                    ? "bg-white text-stone-950 shadow-xs"
                    : "text-stone-600 hover:text-stone-900"
                }`}
              >
                <Ticket className="h-3.5 w-3.5" />
                Coupons
              </button>
              <button
                onClick={() => setActiveTab("missions")}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
                  activeTab === "missions"
                    ? "bg-white text-stone-950 shadow-xs"
                    : "text-stone-600 hover:text-stone-900"
                }`}
              >
                <Sparkles className="h-3.5 w-3.5" />
                Missions
              </button>
              <button
                onClick={() => setActiveTab("categories")}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
                  activeTab === "categories"
                    ? "bg-white text-stone-950 shadow-xs"
                    : "text-stone-600 hover:text-stone-900"
                }`}
              >
                <FolderOpen className="h-3.5 w-3.5" />
                Categories
              </button>
            </nav>
          </div>

          <button
            onClick={handleLogOut}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-stone-200 hover:border-red-200 hover:bg-red-50 hover:text-red-600 transition-all font-mono text-xs text-stone-500 cursor-pointer"
          >
            <LogOut className="h-3.5 w-3.5" />
            Sign Out
          </button>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-7xl mx-auto px-4 py-6 flex flex-col gap-6 flex-1 w-full">
        {/* Balances & Operations Top Row */}
        <BalancesCard
          adminBalances={adminBalances}
          contractBalances={contractBalances}
          contractBalancesLoading={contractBalancesLoading}
          onRefreshContractBalances={fetchContractBalances}
          activeTab={activeTab}
          onOpenCreateDrawer={() => setIsCreateDrawerOpen(true)}
          onBatchClaimCreatorLiquidity={handleBatchClaimCreatorLiquidity}
          isClaiming={isClaimingCreatorLiquidity}
        />

        {/* Tab content conditional rendering */}
        {activeTab === "moderation" && (
          <MarketsTable
            marketsLoading={marketsLoading}
            markets={markets}
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
            categoryFilter={categoryFilter}
            setCategoryFilter={setCategoryFilter}
            statusFilter={statusFilter}
            setStatusFilter={setStatusFilter}
            sortBy={sortBy}
            setSortBy={setSortBy}
            currentPage={currentPage}
            setCurrentPage={setCurrentPage}
            itemsPerPage={itemsPerPage}
            fetchMarkets={fetchMarkets}
            handleApproveTrading={handleApproveTrading}
            openAddLiquidityModal={openAddLiquidityModal}
            handleOpenArbitrateResolve={handleOpenArbitrateResolve}
          />
        )}
        {activeTab === "metrics" && (
          <MetricsTab
            metricsLoading={metricsLoading}
            metricsData={metricsData}
            fetchMetricsData={fetchMetricsData}
            timeframe={metricsTimeframe}
            setTimeframe={setMetricsTimeframe}
            contractBalances={contractBalances}
            contractBalancesLoading={contractBalancesLoading}
          />
        )}
        {activeTab === "coupons" && <CouponsTab />}
        {activeTab === "missions" && <MissionsTab />}
        {activeTab === "categories" && <CategoriesTab />}
      </main>

      {/* Create PvP Event Drawer */}
      <CreateMarketDrawer
        isOpen={isCreateDrawerOpen}
        onClose={() => setIsCreateDrawerOpen(false)}
        adminBalances={adminBalances}
        fetchMarkets={fetchMarkets}
        fetchAdminStatus={fetchAdminStatus}
        fetchMetricsData={fetchMetricsData}
      />

      {/* Arbitrate Resolve/Dispute Drawer */}
      <ResolveMarketDrawer
        isOpen={isResolveDrawerOpen}
        onClose={() => setIsResolveDrawerOpen(false)}
        selectedMarketId={selectedMarketId}
        markets={markets}
        fetchMarkets={fetchMarkets}
        fetchAdminStatus={fetchAdminStatus}
        fetchMetricsData={fetchMetricsData}
        winningOutcome={winningOutcome}
        setWinningOutcome={setWinningOutcome}
        resolveTxHash={resolveTxHash}
        setResolveTxHash={setResolveTxHash}
        adminAddress={adminAddress}
        setAdminAddress={setAdminAddress}
        now={now}
      />

      {/* Dialog for Add Liquidity */}
      <Dialog open={isAddLiquidityOpen} onOpenChange={setIsAddLiquidityOpen}>
        <DialogContent className="sm:max-w-[425px] bg-white border border-stone-200 rounded-lg shadow-lg">
          <form onSubmit={handleAddLiquidity}>
            <DialogHeader>
              <DialogTitle className="text-base font-bold text-stone-900">
                Deposit Pre-Market Liquidity
              </DialogTitle>
              <DialogDescription className="text-xs text-stone-500 mt-1">
                Fund the on-chain escrow balance for this prediction market.
                Funding meets the threshold to activate the market for trading.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4 my-2">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-mono font-bold uppercase tracking-wider text-stone-500">
                  Market ID
                </label>
                <input
                  type="text"
                  disabled
                  value={liquidityMarketId || ""}
                  className="w-full h-9 px-3 border border-stone-200 bg-stone-50 text-xs font-mono rounded-lg outline-none text-stone-400"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-mono font-bold uppercase tracking-wider text-stone-500">
                  USDC Deposit Amount
                </label>
                <input
                  type="number"
                  min="1"
                  required
                  value={liquidityAmount}
                  onChange={(e) => setLiquidityAmount(e.target.value)}
                  className="w-full h-9 px-3 border border-stone-200 bg-white text-sm font-semibold rounded-lg outline-none focus:border-indigo-500 transition-colors"
                />
              </div>
            </div>
            <DialogFooter className="flex gap-2 justify-end pt-2 border-t border-stone-150">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsAddLiquidityOpen(false)}
                className="h-9 px-4 rounded-lg text-xs font-semibold cursor-pointer border border-stone-200 hover:bg-stone-50 transition-colors"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={loading}
                className="h-9 px-4 rounded-lg text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white cursor-pointer shadow-xs transition-colors"
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
