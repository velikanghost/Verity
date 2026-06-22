"use client"

import { toast } from "react-hot-toast"
import { Button } from "@/components/ui/button"
import { Wallet, Copy, Plus, Coins, ArrowDownToLine, RefreshCw } from "lucide-react"

interface BalancesCardProps {
  adminBalances: {
    adminAddress: string
    arcBalance: number
    usdcBalance: number
    preDepositUsdcPerOption: number
    creationFeeUsdc: number
  } | null
  contractBalances: {
    fpmmUsdcBalance: number
    factoryUsdcBalance: number
    adminUsdcBalance: number
    adminAddress: string
  } | null
  contractBalancesLoading: boolean
  onRefreshContractBalances: () => void
  activeTab: string
  onOpenCreateDrawer: () => void
  onBatchClaimCreatorLiquidity: () => void
  isClaiming: boolean
}

export default function BalancesCard({
  adminBalances,
  contractBalances,
  contractBalancesLoading,
  onRefreshContractBalances,
  activeTab,
  onOpenCreateDrawer,
  onBatchClaimCreatorLiquidity,
  isClaiming,
}: BalancesCardProps) {
  if (!adminBalances) return null

  function copyToClipboard(text: string) {
    void navigator.clipboard.writeText(text)
    toast.success("Address copied to clipboard!")
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 w-full">
      {/* Admin Wallet Card */}
      <div className="p-5 bg-white border border-stone-200 rounded-2xl flex items-center gap-4 shadow-sm relative overflow-hidden">
        <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-50 rounded-full -mr-8 -mt-8 opacity-50 pointer-events-none" />
        <div className="h-10 w-10 rounded-xl bg-indigo-600 flex items-center justify-center text-white shadow-md shrink-0">
          <Wallet className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="text-[10px] font-bold uppercase tracking-widest text-indigo-700">
            Admin Wallet
          </h3>
          <div className="flex items-center gap-1.5 mt-0.5">
            <span className="font-mono text-xs font-semibold text-stone-800 truncate block">
              {adminBalances.adminAddress}
            </span>
            <button
              type="button"
              onClick={() => copyToClipboard(adminBalances.adminAddress)}
              className="text-indigo-600 hover:text-indigo-800 p-1 rounded-md hover:bg-indigo-50 transition-colors cursor-pointer shrink-0"
              title="Copy Address"
            >
              <Copy className="h-3 w-3" />
            </button>
          </div>
          <div className="mt-1.5">
            <span className="font-mono text-base font-bold text-stone-900">
              {adminBalances.usdcBalance.toLocaleString(undefined, {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}{" "}
              USDC
            </span>
          </div>
        </div>
      </div>

      {/* Contract Balances Card */}
      <div className="p-5 bg-white border border-stone-200 rounded-2xl flex items-start gap-4 shadow-sm relative overflow-hidden">
        <div className="absolute top-0 right-0 w-24 h-24 bg-amber-50 rounded-full -mr-8 -mt-8 opacity-50 pointer-events-none" />
        <div className="h-10 w-10 rounded-xl bg-amber-500 flex items-center justify-center text-white shadow-md shrink-0">
          <Coins className="h-5 w-5" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between">
            <h3 className="text-[10px] font-bold uppercase tracking-widest text-amber-700">
              On-Chain Contracts
            </h3>
            <button
              onClick={onRefreshContractBalances}
              disabled={contractBalancesLoading}
              className="text-stone-400 hover:text-stone-600 p-1 rounded-md hover:bg-stone-50 transition-all cursor-pointer"
              title="Refresh contract balances"
            >
              <RefreshCw className={`h-3 w-3 ${contractBalancesLoading ? "animate-spin" : ""}`} />
            </button>
          </div>
          
          <div className="mt-2 space-y-1">
            <div className="flex items-center justify-between text-xs">
              <span className="text-stone-500 font-medium">FPMM Pools:</span>
              <span className="font-mono font-semibold text-stone-900">
                {contractBalances ? (
                  `${contractBalances.fpmmUsdcBalance.toLocaleString(undefined, {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })} USDC`
                ) : (
                  <span className="text-stone-300">...</span>
                )}
              </span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-stone-500 font-medium">Factory Escrow:</span>
              <span className="font-mono font-semibold text-stone-900">
                {contractBalances ? (
                  `${contractBalances.factoryUsdcBalance.toLocaleString(undefined, {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })} USDC`
                ) : (
                  <span className="text-stone-300">...</span>
                )}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Admin Actions Card */}
      <div className="p-5 bg-stone-50 border border-stone-200 rounded-2xl flex flex-col justify-center gap-2 shadow-inner">
        {activeTab === "moderation" ? (
          <>
            <Button
              onClick={onBatchClaimCreatorLiquidity}
              disabled={isClaiming}
              className="w-full bg-amber-600 hover:bg-amber-700 text-white font-semibold rounded-lg h-9 text-xs tracking-wide shadow-xs flex items-center justify-center gap-2 transition-all cursor-pointer"
            >
              <ArrowDownToLine className={`h-3.5 w-3.5 ${isClaiming ? "animate-bounce" : ""}`} />
              {isClaiming ? "Claiming LP..." : "Batch Claim Creator LP"}
            </Button>
            <Button
              onClick={onOpenCreateDrawer}
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-lg h-9 text-xs tracking-wide shadow-xs flex items-center justify-center gap-2 transition-all cursor-pointer"
            >
              <Plus className="h-3.5 w-3.5" />
              Create PvP Event
            </Button>
          </>
        ) : (
          <div className="text-center py-2">
            <span className="text-xs text-stone-500 italic">
              Switch to Moderation tab to perform actions.
            </span>
          </div>
        )}
      </div>
    </div>
  )
}
