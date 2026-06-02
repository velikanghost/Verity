"use client"

import React, { useState } from "react"
import { X, Copy, Check } from "lucide-react"

interface ReceiveUsdcModalProps {
  isOpen: boolean
  onClose: () => void
  walletAddress: string
}

export default function ReceiveUsdcModal({
  isOpen,
  onClose,
  walletAddress,
}: ReceiveUsdcModalProps) {
  const [copied, setCopied] = useState(false)

  if (!isOpen) return null

  const handleCopy = () => {
    if (walletAddress) {
      navigator.clipboard.writeText(walletAddress)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(walletAddress)}&color=121212&bgcolor=ffffff`

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-midnight/40 backdrop-blur-md px-4 py-6 animate-fade-in">
      <div className="verity-card w-full max-w-[400px] bg-white-surface p-6 shadow-[(--shadow-sm)] border border-border relative text-center flex flex-col items-center">
        <button
          onClick={onClose}
          className="absolute right-4 top-4 text-ash hover:text-charcoal-primary transition-colors cursor-pointer"
        >
          <X className="h-5 w-5" />
        </button>

        <h3 className="text-lg font-semibold tracking-[-0.18px] text-charcoal-primary">
          Receive USDC
        </h3>
        <p className="mt-1 text-xs text-ash max-w-[280px]">
          Scan this QR code or copy the address below to transfer USDC to your
          Smart Contract Account (SCA).
        </p>

        {/* QR Code Container */}
        <div className="mt-6 p-4 rounded-[12px] bg-stone-surface border border-border shadow-[(--shadow-subtle)] flex items-center justify-center">
          <img
            src={qrCodeUrl}
            alt="Wallet QR Code"
            width={180}
            height={180}
            className="rounded-[6px]"
          />
        </div>

        {/* Address Display */}
        <div className="mt-6 w-full flex items-center justify-between gap-2 p-3 bg-stone-surface border border-border rounded-[8px] font-mono text-xs text-charcoal-primary text-left">
          <span className="truncate pr-2 select-all">{walletAddress}</span>
          <button
            onClick={handleCopy}
            className="flex items-center justify-center h-8 w-8 rounded-[6px] hover:bg-white-surface border border-transparent hover:border-border transition-colors cursor-pointer text-ash hover:text-charcoal-primary"
            title="Copy address"
          >
            {copied ? (
              <Check className="h-4 w-4 text-meadow-green" />
            ) : (
              <Copy className="h-4 w-4" />
            )}
          </button>
        </div>

        <p className="mt-4 font-mono text-[9px] text-ash uppercase tracking-wider">
          Network: Arc Testnet only
        </p>
      </div>
    </div>
  )
}
