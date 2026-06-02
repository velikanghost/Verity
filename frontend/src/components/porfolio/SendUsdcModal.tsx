"use client"

import React, { useState } from "react"
import { X, Loader2 } from "lucide-react"
import { useUsdcTransfer } from "@/hooks/useUsdcTransfer"
import toast from "react-hot-toast"

interface SendUsdcModalProps {
  isOpen: boolean
  onClose: () => void
  usdcBalance: number
  onSuccess?: () => void
}

export default function SendUsdcModal({
  isOpen,
  onClose,
  usdcBalance,
  onSuccess,
}: SendUsdcModalProps) {
  const [recipient, setRecipient] = useState("")
  const [amountInput, setAmountInput] = useState("")
  const [isSending, setIsSending] = useState(false)
  const { transferUsdc } = useUsdcTransfer()

  if (!isOpen) return null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    const amount = parseFloat(amountInput)
    if (!recipient || isNaN(amount) || amount <= 0) {
      toast.error("Please provide a valid recipient address and amount.")
      return
    }

    if (amount > usdcBalance) {
      toast.error(
        `Insufficient USDC balance. You have ${usdcBalance.toFixed(2)} USDC.`,
      )
      return
    }

    setIsSending(true)
    const toastId = toast.loading("Sending USDC...")
    try {
      await transferUsdc(recipient, amount)
      toast.success(`Successfully sent ${amount} USDC! ✓`, { id: toastId })
      setRecipient("")
      setAmountInput("")
      onSuccess?.()
      onClose()
    } catch (err: any) {
      toast.dismiss(toastId)
      if (!err.message?.includes("rejected")) {
        toast.error(err.message || "Failed to send USDC.")
      }
    } finally {
      setIsSending(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-midnight/40 backdrop-blur-md px-4 py-6 animate-fade-in">
      <div className="verity-card w-full max-w-[440px] bg-white-surface p-6 shadow-[(--shadow-sm)] border border-border relative">
        <button
          onClick={onClose}
          className="absolute right-4 top-4 text-ash hover:text-charcoal-primary transition-colors cursor-pointer"
        >
          <X className="h-5 w-5" />
        </button>

        <h3 className="text-lg font-semibold tracking-[-0.18px] text-charcoal-primary">
          Send USDC
        </h3>
        <p className="mt-1 text-xs text-ash">
          Transfer USDC from your Smart Contract Account (SCA) to any EVM
          address.
        </p>

        <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-4">
          <div>
            <label className="block font-mono text-[10px] font-semibold uppercase tracking-[0.12em] text-ash mb-1.5">
              Recipient Address
            </label>
            <input
              type="text"
              required
              placeholder="0x..."
              disabled={isSending}
              value={recipient}
              onChange={(e) => setRecipient(e.target.value)}
              className="w-full h-10 rounded-[8px] border border-border bg-stone-surface px-3 font-mono text-xs text-charcoal-primary focus:outline-none focus:border-border-strong"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block font-mono text-[10px] font-semibold uppercase tracking-[0.12em] text-ash">
                Amount (USDC)
              </label>
              <button
                type="button"
                disabled={isSending}
                onClick={() => setAmountInput(usdcBalance.toString())}
                className="font-mono text-[10px] font-semibold text-ember-orange hover:opacity-80 cursor-pointer"
              >
                Max ({usdcBalance.toFixed(2)})
              </button>
            </div>
            <input
              type="number"
              step="any"
              min="0.0001"
              required
              disabled={isSending}
              placeholder="0.00"
              value={amountInput}
              onChange={(e) => setAmountInput(e.target.value)}
              className="w-full h-10 rounded-[8px] border border-border bg-stone-surface px-3 font-mono text-sm text-charcoal-primary focus:outline-none focus:border-border-strong"
            />
          </div>

          <button
            type="submit"
            disabled={isSending}
            className="verity-pill mt-2 flex h-11 w-full items-center justify-center gap-2 bg-inverse px-4 text-sm font-semibold tracking-[-0.18px] text-inverse-text transition-opacity hover:opacity-90 disabled:opacity-50 cursor-pointer"
          >
            {isSending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Processing...
              </>
            ) : (
              "Confirm Send"
            )}
          </button>
        </form>
      </div>
    </div>
  )
}
