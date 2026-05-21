'use client'

import { ConnectButton } from '@rainbow-me/rainbowkit'
import { AlertTriangle, ChevronDown, Wallet } from 'lucide-react'

export default function WalletConnectControl() {
  return (
    <ConnectButton.Custom>
      {({
        account,
        chain,
        openAccountModal,
        openChainModal,
        openConnectModal,
        mounted,
      }) => {
        const ready = mounted
        const connected = ready && account && chain
        const wrongNetwork = connected && chain.unsupported

        if (!ready) {
          return (
            <button
              className="flex h-11 w-full items-center justify-center rounded-[13px] bg-inverse px-4 font-mono text-xs font-black uppercase tracking-[0.14em] text-inverse-text opacity-70"
              type="button"
            >
              Wallet
            </button>
          )
        }

        if (!connected) {
          return (
            <button
              className="flex h-11 w-full items-center justify-center gap-2 rounded-[13px] bg-inverse px-4 font-mono text-xs font-black uppercase tracking-[0.14em] text-inverse-text transition-opacity hover:opacity-85"
              onClick={openConnectModal}
              type="button"
            >
              <Wallet className="h-4 w-4" />
              Connect
            </button>
          )
        }

        if (wrongNetwork) {
          return (
            <button
              className="flex h-11 w-full items-center justify-center gap-2 rounded-[13px] bg-red-400 px-4 font-mono text-xs font-black uppercase tracking-[0.14em] text-black transition-opacity hover:opacity-85"
              onClick={openChainModal}
              type="button"
            >
              <AlertTriangle className="h-4 w-4" />
              Switch
            </button>
          )
        }

        return (
          <button
            className="flex h-11 w-full items-center justify-center gap-2 rounded-[13px] border border-border bg-surface-muted px-4 font-mono text-xs font-black text-foreground transition-colors hover:bg-surface-hover"
            onClick={openAccountModal}
            type="button"
          >
            {account.displayName}
            <ChevronDown className="h-4 w-4" />
          </button>
        )
      }}
    </ConnectButton.Custom>
  )
}
