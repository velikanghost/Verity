'use client'

import React from 'react'
import { useQuery } from '@tanstack/react-query'
import { apiRequest } from '@/store/apiClient'
import type { Profile } from '@/lib/verity'
import {
  X,
  Mail,
  Key,
  ShieldCheck,
  Loader2,
  Sparkles,
  AlertTriangle,
  ExternalLink,
  ChevronRight,
  Copy,
  Check,
} from 'lucide-react'
import { useAuthStore } from '@/store/authStore'

export function useProfileQuery() {
  return useQuery<Profile | null>({
    queryKey: ['profile'],
    queryFn: async () => {
      const token =
        typeof window !== 'undefined'
          ? localStorage.getItem('verity_auth_token')
          : null
      if (!token) return null
      try {
        return await apiRequest<Profile>('/auth/me')
      } catch (err) {
        localStorage.removeItem('verity_auth_token')
        return null
      }
    },
    staleTime: 60 * 1000,
  })
}

export function useAuth() {
  const { data: user, isLoading: loading } = useProfileQuery()
  const authenticated = !!user

  const login = useAuthStore((s) => s.login)
  const logout = useAuthStore((s) => s.logout)
  const executeTxBatch = useAuthStore((s) => s.executeTxBatch)

  return {
    user: user ?? null,
    authenticated,
    loading,
    login,
    logout,
    executeTxBatch,
  }
}

export default function AuthModals() {
  const authModalStep = useAuthStore((s) => s.authModalStep)
  const email = useAuthStore((s) => s.email)
  const otpCode = useAuthStore((s) => s.otpCode)
  const usernameInput = useAuthStore((s) => s.usernameInput)
  const isSubmittingOtp = useAuthStore((s) => s.isSubmittingOtp)
  const isRequestingOtp = useAuthStore((s) => s.isRequestingOtp)
  const authError = useAuthStore((s) => s.authError)
  const copied = useAuthStore((s) => s.copied)

  const txConfirmState = useAuthStore((s) => s.txConfirmState)
  const isExecutingTx = useAuthStore((s) => s.isExecutingTx)
  const txError = useAuthStore((s) => s.txError)

  const setAuthModalStep = useAuthStore((s) => s.setAuthModalStep)
  const setEmail = useAuthStore((s) => s.setEmail)
  const setOtpCode = useAuthStore((s) => s.setOtpCode)
  const setUsernameInput = useAuthStore((s) => s.setUsernameInput)
  const setCopied = useAuthStore((s) => s.setCopied)

  const handleRequestOtp = useAuthStore((s) => s.handleRequestOtp)
  const handleVerifyOtp = useAuthStore((s) => s.handleVerifyOtp)
  const handleSaveOnboarding = useAuthStore((s) => s.handleSaveOnboarding)
  const handleConfirmTx = useAuthStore((s) => s.handleConfirmTx)
  const handleCancelTx = useAuthStore((s) => s.handleCancelTx)

  const { user } = useAuth()
  const walletAddr = user?.walletAddress || ''

  const handleCopyAddress = () => {
    if (!walletAddr) return
    navigator.clipboard.writeText(walletAddr)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <>
      {/* 1. PASSWORDLESS EMAIL OTP AUTHENTICATION MODAL */}
      {authModalStep !== 'idle' && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-midnight/40 backdrop-blur-md px-4 py-6 animate-fade-in">
          <div className="w-full max-w-[440px] overflow-hidden rounded-[12px] border border-border bg-surface-solid p-6 shadow-2xl transition-all duration-300">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-stone-surface pb-4 mb-5">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-[10px] bg-sky-blue/10 border border-sky-blue/20">
                  <ShieldCheck className="h-5 w-5 text-sky-blue" />
                </div>
                <div>
                  <p className="font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-ash">
                    Verity Identity
                  </p>
                  <h3 className="text-lg font-bold text-charcoal-primary">
                    {authModalStep === 'email' && 'Sign In / Sign Up'}
                    {authModalStep === 'otp' && 'Enter Verification Code'}
                    {authModalStep === 'onboarding' && 'Setup Profile'}
                    {authModalStep === 'success' && 'Welcome to Verity!'}
                  </h3>
                </div>
              </div>
              {authModalStep !== 'success' &&
                authModalStep !== 'onboarding' && (
                  <button
                    onClick={() => setAuthModalStep('idle')}
                    className="rounded-lg p-1.5 text-ash hover:bg-stone-surface hover:text-midnight transition-colors"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
            </div>

            {/* Email Step */}
            {authModalStep === 'email' && (
              <form onSubmit={handleRequestOtp} className="space-y-4">
                <p className="text-sm text-ash leading-relaxed">
                  Enter your email address to receive a passwordless
                  authentication code. If you don't have an account, we will
                  create one for you.
                </p>
                <div className="space-y-2">
                  <label className="block text-xs font-mono font-bold uppercase tracking-wider text-ash">
                    Email Address
                  </label>
                  <div className="flex h-11 items-center rounded-[10px] border border-border bg-white-surface px-4 focus-within:border-sky-blue/50 transition-colors">
                    <Mail className="h-4 w-4 text-ash mr-2" />
                    <input
                      type="email"
                      required
                      placeholder="you@example.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full bg-transparent text-sm text-charcoal-primary outline-none placeholder:text-stone-surface"
                      disabled={isRequestingOtp}
                    />
                  </div>
                </div>

                {authError && (
                  <p className="text-xs text-ember-orange font-medium">
                    {authError}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={isRequestingOtp}
                  className="w-full flex h-11 items-center justify-center gap-2 verity-pill rounded-[10px] bg-inverse text-sm font-semibold text-inverse-text transition-opacity hover:opacity-90 disabled:opacity-50"
                >
                  {isRequestingOtp ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Sending OTP...
                    </>
                  ) : (
                    <>
                      Send Access Code
                      <ChevronRight className="h-4 w-4" />
                    </>
                  )}
                </button>
              </form>
            )}

            {/* OTP Step */}
            {authModalStep === 'otp' && (
              <form onSubmit={handleVerifyOtp} className="space-y-4">
                <p className="text-sm text-ash leading-relaxed">
                  We've sent a 6-digit verification code to your email. Enter it below to authorize.
                </p>
                <div className="space-y-2">
                  <label className="block text-xs font-mono font-bold uppercase tracking-wider text-ash">
                    Verification Code
                  </label>
                  <div className="flex h-11 items-center rounded-[10px] border border-border bg-white-surface px-4 focus-within:border-sky-blue/50 transition-colors">
                    <Key className="h-4 w-4 text-ash mr-2" />
                    <input
                      type="text"
                      required
                      maxLength={6}
                      pattern="[0-9]*"
                      placeholder="000000"
                      value={otpCode}
                      onChange={(e) => setOtpCode(e.target.value)}
                      className="w-full bg-transparent text-sm text-charcoal-primary font-mono tracking-widest outline-none placeholder:text-stone-surface"
                      disabled={isSubmittingOtp}
                    />
                  </div>
                </div>

                {authError && (
                  <p className="text-xs text-ember-orange font-medium">
                    {authError}
                  </p>
                )}

                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => setAuthModalStep('email')}
                    className="flex-1 h-11 rounded-[10px] border border-border bg-transparent text-graphite text-sm font-semibold hover:bg-stone-surface transition-colors"
                  >
                    Back
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmittingOtp || otpCode.length !== 6}
                    className="flex-1 w-full flex h-11 items-center justify-center gap-2 verity-pill rounded-[10px] bg-inverse text-sm font-semibold text-inverse-text transition-opacity hover:opacity-90 disabled:opacity-50"
                  >
                    {isSubmittingOtp ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Verifying...
                      </>
                    ) : (
                      'Verify'
                    )}
                  </button>
                </div>
              </form>
            )}

            {/* Onboarding Step */}
            {authModalStep === 'onboarding' && (
              <form onSubmit={handleSaveOnboarding} className="space-y-4">
                <p className="text-sm text-ash leading-relaxed">
                  Choose a unique username to represent your predictions and
                  Takes on Verity.
                </p>
                <div className="space-y-2">
                  <label className="block text-xs font-mono font-bold uppercase tracking-wider text-ash">
                    Choose Username
                  </label>
                  <div className="flex h-11 items-center rounded-[10px] border border-border bg-white-surface px-4 focus-within:border-sky-blue/50 transition-colors">
                    <span className="text-sm font-mono text-ash mr-1">
                      @
                    </span>
                    <input
                      type="text"
                      required
                      placeholder="username"
                      value={usernameInput}
                      onChange={(e) => setUsernameInput(e.target.value)}
                      className="w-full bg-transparent text-sm text-charcoal-primary outline-none placeholder:text-stone-surface"
                      disabled={isSubmittingOtp}
                    />
                  </div>
                  <p className="text-[10px] text-ash font-mono">
                    3-24 characters. Letters, numbers, and underscores only.
                  </p>
                </div>

                <button
                  type="submit"
                  disabled={isSubmittingOtp || usernameInput.length < 3}
                  className="w-full flex h-11 items-center justify-center gap-2 verity-pill rounded-[10px] bg-inverse text-sm font-semibold text-inverse-text transition-opacity hover:opacity-90 disabled:opacity-50"
                >
                  {isSubmittingOtp ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    'Save & Continue'
                  )}
                </button>
              </form>
            )}

            {/* Success Step (Wallet Address & Funding Details) */}
            {authModalStep === 'success' && (
              <div className="space-y-5 py-2">
                <div className="rounded-[10px] border border-stone-surface bg-parchment-card p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs text-ash">
                      Your Circle SCA Wallet Address
                    </span>
                    <button
                      onClick={handleCopyAddress}
                      className="flex items-center gap-1.5 text-xs text-sky-blue font-semibold hover:underline"
                    >
                      {copied ? (
                        <>
                          <Check className="h-3.5 w-3.5 text-meadow-green" />
                          <span className="text-meadow-green">Copied</span>
                        </>
                      ) : (
                        <>
                          <Copy className="h-3.5 w-3.5" />
                          <span>Copy</span>
                        </>
                      )}
                    </button>
                  </div>
                  <div className="font-mono text-sm font-bold text-charcoal-primary break-all bg-surface-solid p-2.5 rounded-lg border border-stone-surface">
                    {walletAddr || 'Generating secure SCA wallet...'}
                  </div>
                </div>

                <div className="flex items-center justify-between gap-4 p-4 rounded-[10px] bg-sky-blue/5 border border-sky-blue/20">
                  <div className="space-y-1 text-left">
                    <h4 className="text-xs font-bold text-midnight">
                      Need Arc Testnet Funds?
                    </h4>
                    <p className="text-[11px] text-ash leading-relaxed">
                      Copy your SCA address above and get testnet USDC and ARC
                      from the faucet to cover gas and trading.
                    </p>
                  </div>
                  <a
                    className="flex items-center gap-1 text-xs font-semibold text-sky-blue hover:underline shrink-0"
                    href="https://faucet.circle.com"
                    rel="noopener noreferrer"
                    target="_blank"
                  >
                    Faucet
                    <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                </div>

                <button
                  onClick={() => setAuthModalStep('idle')}
                  className="w-full flex h-11 items-center justify-center gap-2 verity-pill rounded-[10px] bg-inverse text-sm font-semibold text-inverse-text transition-opacity hover:opacity-90"
                >
                  Start Exploring
                  <Sparkles className="h-4 w-4 text-sunburst-yellow animate-pulse" />
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 2. TRANSACTION CONFIRMATION MODAL (Zero-Signing UX) */}
      {txConfirmState.isOpen && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-midnight/40 backdrop-blur-md px-4 py-6 animate-fade-in">
          <div className="w-full max-w-[460px] overflow-hidden rounded-[12px] border border-border bg-surface-solid p-6 shadow-2xl transition-all duration-300">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-stone-surface pb-4 mb-5">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-[10px] bg-meadow-green/10 border border-meadow-green/20">
                  <ShieldCheck className="h-5 w-5 text-meadow-green" />
                </div>
                <div>
                  <p className="font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-ash">
                    Zero-Signing Transaction
                  </p>
                  <h3 className="text-lg font-bold text-charcoal-primary">
                    Confirm Action
                  </h3>
                </div>
              </div>
              {!isExecutingTx && (
                <button
                  onClick={handleCancelTx}
                  className="rounded-lg p-1.5 text-ash hover:bg-stone-surface hover:text-midnight transition-colors"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>

            {/* Content Body */}
            <div className="space-y-5">
              <div className="rounded-[10px] border border-stone-surface bg-white-surface p-4 space-y-3">
                <p className="text-xs font-mono font-bold uppercase tracking-wider text-ash">
                  Action Detail
                </p>
                <p className="text-base font-semibold text-charcoal-primary leading-snug">
                  {txConfirmState.description}
                </p>
              </div>

              {/* Cost Summary Table */}
              <div className="rounded-[10px] border border-stone-surface bg-parchment-card p-4 space-y-3.5">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-ash">Total USDC Value</span>
                  <span className="font-mono font-semibold text-charcoal-primary">
                    {txConfirmState.estimatedCostUsdc.toFixed(2)} USDC
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-ash">Network Gas Fee</span>
                  <span className="font-mono text-graphite font-semibold flex items-center gap-1">
                    Paid by Wallet (ARC)
                  </span>
                </div>
                <div className="h-px bg-white/5" />
                <div className="flex items-center justify-between text-sm">
                  <span className="text-midnight font-medium">
                    Estimated Total Cost
                  </span>
                  <span className="font-mono font-bold text-charcoal-primary text-base">
                    {txConfirmState.estimatedCostUsdc.toFixed(2)} USDC + Gas
                  </span>
                </div>
              </div>

              {/* Warning on-chain message */}
              <div className="flex items-start gap-2.5 rounded-[10px] bg-sunburst-yellow/10 border border-sunburst-yellow/20 p-3.5 text-xs text-sunburst-yellow">
                <AlertTriangle className="h-4.5 w-4.5 shrink-0 mt-0.5" />
                <p className="leading-relaxed">
                  This transaction is processed programmatically on Arc Testnet
                  via your secure developer-controlled smart wallet. No manual
                  signing or browser extension required.
                </p>
              </div>

              {txError && (
                <div className="rounded-[10px] bg-ember-orange/10 border border-ember-orange/20 p-3.5 text-xs text-ember-orange font-medium leading-relaxed max-h-[120px] overflow-y-auto">
                  {txError}
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={handleCancelTx}
                  disabled={isExecutingTx}
                  className="flex-1 h-11 rounded-[10px] border border-border bg-transparent text-graphite text-sm font-semibold hover:bg-stone-surface transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmTx}
                  disabled={isExecutingTx}
                  className="flex-1 h-11 rounded-[10px] bg-meadow-green hover:bg-meadow-green/90 text-inverse-text text-sm font-semibold transition-colors shadow-lg shadow-emerald-950/20 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {isExecutingTx ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Executing...
                    </>
                  ) : (
                    'Confirm & Execute'
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
