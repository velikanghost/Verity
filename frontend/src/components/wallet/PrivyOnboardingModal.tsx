'use client'

import { useEffect, useMemo, useState, useRef } from 'react'
import { usePrivy, useCreateWallet, useWallets } from '@privy-io/react-auth'
import { useWalletProfile } from '@/hooks/useWalletProfile'
import { usePrivyWallet } from '@/hooks/usePrivyWallet'
import { useUpdateProfileMutation } from '@/store/verity/verityQueries'
import {
  Sparkles,
  Loader2,
  CheckCircle2,
  UserRound,
  Wallet,
  Copy,
  Check,
  ExternalLink,
  ChevronRight,
} from 'lucide-react'

type OnboardingStep = 'create-wallet' | 'username' | 'deposit' | 'success'

const ONBOARDING_STORAGE_PREFIX = 'verity-wallet-onboarding-complete'

function looksGeneratedUsername(username?: string | null) {
  return !username || /^user_[a-f0-9]{4}_\d{4}$/i.test(username)
}

function getOnboardingStorageKey(address?: string) {
  return address
    ? `${ONBOARDING_STORAGE_PREFIX}:${address.toLowerCase()}`
    : null
}

function getStoredOnboardingComplete(address?: string) {
  if (typeof window === 'undefined' || !address) return false
  const key = getOnboardingStorageKey(address)
  return key ? window.localStorage.getItem(key) === 'true' : false
}

function setStoredOnboardingComplete(address?: string) {
  if (typeof window === 'undefined' || !address) return
  const key = getOnboardingStorageKey(address)
  if (key) window.localStorage.setItem(key, 'true')
}

export default function PrivyOnboardingModal() {
  const { ready, authenticated, user } = usePrivy()
  const { wallets } = useWallets()
  const { createWallet } = useCreateWallet()
  const { profile, isLoading: profileLoading, refetch } = useWalletProfile()
  const { address: smartWalletAddress } = usePrivyWallet()
  const { mutateAsync: updateProfile } = useUpdateProfileMutation()

  const [username, setUsername] = useState('')
  const [copied, setCopied] = useState(false)
  const [depositAmount, setDepositAmount] = useState('')
  const [formError, setFormError] = useState<string | null>(null)
  const [isCreatingWallet, setIsCreatingWallet] = useState(false)
  const [isSavingUsername, setIsSavingUsername] = useState(false)
  const [showSuccess, setShowSuccess] = useState(false)
  const [setupComplete, setSetupComplete] = useState(false)
  const isInitialLoad = useRef(true)

  // Retrieve the active embedded wallet address
  const activeAddress = useMemo(() => {
    const embeddedWallet = wallets.find((w) => w.walletClientType === 'privy')
    return embeddedWallet?.address || user?.wallet?.address
  }, [wallets, user])

  const needsUsername = Boolean(
    profile && looksGeneratedUsername(profile.username),
  )
  const hasEmbeddedWallet = Boolean(activeAddress)

  const isCompleted = useMemo(() => {
    if (!ready || !authenticated || !user?.id) return false
    return Boolean(profile?.isOnboarded) || getStoredOnboardingComplete(user.id)
  }, [ready, authenticated, user?.id, profile?.isOnboarded])

  useEffect(() => {
    if (isCompleted) {
      if (user?.id) {
        setStoredOnboardingComplete(user.id)
      }
      setSetupComplete(true)
      isInitialLoad.current = false
    } else if (profile && !profileLoading) {
      if (!needsUsername && isInitialLoad.current) {
        if (user?.id) {
          setStoredOnboardingComplete(user.id)
        }
        setSetupComplete(true)
      }
      isInitialLoad.current = false
    }
  }, [isCompleted, profile, profileLoading, needsUsername, user?.id])

  useEffect(() => {
    if (profile?.username) {
      setUsername(
        looksGeneratedUsername(profile.username) ? '' : profile.username,
      )
    }
  }, [profile?.username])

  // Determine current active step in the onboarding flow
  const step: OnboardingStep | 'loading' | null = useMemo(() => {
    if (!ready || !authenticated) return null
    if (setupComplete && !showSuccess) return null
    if (hasEmbeddedWallet && !smartWalletAddress && !setupComplete)
      return 'loading'
    if (profileLoading && !setupComplete) return 'loading'
    if (!hasEmbeddedWallet) return 'create-wallet'
    if (needsUsername) return 'username'
    if (showSuccess) return 'success'
    return 'deposit'
  }, [
    ready,
    authenticated,
    hasEmbeddedWallet,
    smartWalletAddress,
    needsUsername,
    profileLoading,
    setupComplete,
    showSuccess,
  ])

  async function handleCreateWallet() {
    setFormError(null)
    setIsCreatingWallet(true)
    try {
      await createWallet()
      await refetch()
    } catch (err) {
      setFormError(
        err instanceof Error ? err.message : 'Failed to create secure wallet.',
      )
    } finally {
      setIsCreatingWallet(false)
    }
  }

  async function handleUsernameSave() {
    if (!profile || !smartWalletAddress) return
    setFormError(null)

    const trimmed = username.trim().replace(/^@+/, '')
    if (trimmed.length < 3) {
      setFormError('Use at least 3 characters.')
      return
    }
    if (trimmed.length > 24) {
      setFormError('Keep it under 24 characters.')
      return
    }
    if (!/^[a-zA-Z0-9_]+$/.test(trimmed)) {
      setFormError('Use letters, numbers, and underscores only.')
      return
    }

    setIsSavingUsername(true)
    try {
      await updateProfile({
        profileId: profile.id,
        input: {
          username: trimmed,
          display_name: profile.display_name || profile.displayName || trimmed,
          avatar_url: profile.avatar_url || profile.avatarUrl || null,
          bio: profile.bio || null,
          isOnboarded: true,
        },
      })
      await refetch()
    } catch (err) {
      setFormError(
        err instanceof Error ? err.message : 'Failed to save username.',
      )
    } finally {
      setIsSavingUsername(false)
    }
  }

  function handleCopyAddress() {
    if (!smartWalletAddress) return
    navigator.clipboard.writeText(smartWalletAddress)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  async function handleProceedToSuccess() {
    if (profile && user?.id) {
      try {
        await updateProfile({
          profileId: profile.id,
          input: {
            username: profile.username,
            display_name:
              profile.display_name || profile.displayName || profile.username,
            avatar_url: profile.avatar_url || profile.avatarUrl || null,
            bio: profile.bio || null,
            isOnboarded: true,
          },
        })
        await refetch()
      } catch (err) {
        console.error('Failed to persist onboarding status to database:', err)
      }
      setStoredOnboardingComplete(user.id)
      setSetupComplete(true)
      setShowSuccess(true)
    }
  }

  if (!step) return null

  return (
    <div
      aria-modal="true"
      className="fixed inset-0 z-100 flex items-end justify-center bg-midnight/60 px-4 py-4 backdrop-blur-md sm:items-center sm:p-6 animate-fade-in"
      role="dialog"
    >
      <div className="verity-card w-full max-w-[460px] overflow-hidden bg-surface-solid border border-border shadow-2xl rounded-xl transform transition-all duration-300">
        {/* Header */}
        <div className="border-b border-border px-6 py-5 bg-surface-solid">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-[14px] bg-stone-surface shadow-[(--shadow-subtle)] border border-border">
              <Wallet className="h-5 w-5 text-charcoal-primary" />
            </div>
            <div>
              <p className="font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-ash">
                Onboarding Portal
              </p>
              <h2 className="text-xl font-bold tracking-[-0.03em] text-charcoal-primary">
                {step === 'success' ? 'All Set!' : 'Secure Your Profile'}
              </h2>
            </div>
          </div>
        </div>

        {/* Content Body */}
        <div className="px-6 py-6 bg-surface-solid">
          {step === 'loading' && (
            <div className="flex flex-col items-center justify-center py-8 text-ash space-y-3">
              <Loader2 className="h-8 w-8 animate-spin text-sky-blue" />
              <p className="text-sm font-semibold text-charcoal-primary">
                Loading secure profile...
              </p>
            </div>
          )}

          {step === 'create-wallet' && (
            <div className="space-y-5 animate-slide-up">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-sunburst-yellow/10 text-sunburst-yellow">
                <Wallet className="h-6 w-6" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-charcoal-primary tracking-[-0.02em]">
                  Activate Your Verity Wallet
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-graphite">
                  To participate in pools, predict markets, and claim rewards,
                  you need to activate a secure, self-custodial smart wallet on
                  Verity.
                </p>
              </div>

              <button
                className="verity-pill flex h-11 w-full items-center justify-center gap-2 bg-inverse px-4 text-sm font-semibold tracking-[-0.18px] text-inverse-text transition-opacity hover:opacity-90 cursor-pointer shadow-md disabled:opacity-50"
                disabled={isCreatingWallet}
                onClick={handleCreateWallet}
                type="button"
              >
                {isCreatingWallet ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Activating Wallet...
                  </>
                ) : (
                  <>
                    Activate Verity Wallet
                    <ChevronRight className="h-4 w-4" />
                  </>
                )}
              </button>
              {formError && (
                <p className="text-xs text-ember-orange font-semibold mt-2">
                  {formError}
                </p>
              )}
            </div>
          )}

          {step === 'username' && (
            <div className="space-y-5 animate-slide-up">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-sky-blue/10 text-sky-blue">
                <UserRound className="h-6 w-6" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-charcoal-primary tracking-[-0.02em]">
                  Choose Your Username
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-graphite">
                  Select a unique handle. This will identify your predictions,
                  social posts, and comments on Verity.
                </p>
              </div>

              <div className="space-y-2">
                <label className="block text-xs font-mono font-bold uppercase tracking-wider text-ash">
                  Username
                </label>
                <div className="flex h-11 items-center rounded-xl bg-surface-solid border border-border px-4 shadow-[(--shadow-subtle)] focus-within:border-charcoal-primary/40 transition-all">
                  <span className="font-mono text-sm text-ash mr-1">@</span>
                  <input
                    autoFocus
                    className="min-w-0 flex-1 bg-transparent text-sm font-semibold text-charcoal-primary outline-none placeholder:text-ash"
                    disabled={isSavingUsername}
                    maxLength={24}
                    onChange={(e) => setUsername(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') void handleUsernameSave()
                    }}
                    placeholder="handle"
                    value={username}
                  />
                </div>
                <p className="text-[11px] text-ash">
                  3-24 characters. Letters, numbers, and underscores only.
                </p>
              </div>

              <button
                className="verity-pill flex h-11 w-full items-center justify-center gap-2 bg-inverse px-4 text-sm font-semibold tracking-[-0.18px] text-inverse-text transition-opacity hover:opacity-90 cursor-pointer shadow-md disabled:opacity-50"
                disabled={isSavingUsername || !username}
                onClick={handleUsernameSave}
                type="button"
              >
                {isSavingUsername ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    Continue
                    <ChevronRight className="h-4 w-4" />
                  </>
                )}
              </button>
              {formError && (
                <p className="text-xs text-ember-orange font-semibold mt-2">
                  {formError}
                </p>
              )}
            </div>
          )}

          {step === 'deposit' && (
            <div className="space-y-5 animate-slide-up">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-sunburst-yellow/10 text-sunburst-yellow">
                <Wallet className="h-6 w-6" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-charcoal-primary tracking-[-0.02em]">
                  Fund Your Wallet
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-graphite">
                  To forecast markets or fund liquidity pools, send Arc Testnet
                  USDC to your wallet address:
                </p>
              </div>

              <div className="rounded-xl border border-border bg-stone-surface p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs text-ash">
                    Your Wallet Address
                  </span>
                  <button
                    className="flex items-center gap-1.5 text-xs text-sky-blue font-semibold hover:underline cursor-pointer disabled:opacity-50"
                    disabled={!smartWalletAddress}
                    onClick={handleCopyAddress}
                    type="button"
                  >
                    {copied ? (
                      <>
                        <Check className="h-3.5 w-3.5 text-meadow-green animate-scale-up" />
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
                <div className="font-mono text-sm font-bold text-charcoal-primary break-all bg-surface-solid p-2.5 rounded-lg border border-border min-h-[46px] flex items-center justify-start">
                  {smartWalletAddress ? (
                    smartWalletAddress
                  ) : (
                    <div className="flex items-center gap-2 text-ash text-xs font-normal">
                      <Loader2 className="h-3.5 w-3.5 animate-spin text-sky-blue" />
                      <span>Initializing smart wallet...</span>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex items-center justify-between gap-4 p-4 rounded-xl bg-sky-blue/5 border border-sky-blue/10">
                <div className="space-y-1">
                  <h4 className="text-xs font-bold text-charcoal-primary">
                    Need Testnet Funds?
                  </h4>
                  <p className="text-xs text-graphite">
                    Get free testnet USDC instantly from the faucet.
                  </p>
                </div>
                <a
                  className="flex items-center gap-1 text-xs font-semibold text-sky-blue hover:underline shrink-0"
                  href="https://faucet.circle.com"
                  rel="noopener noreferrer"
                  target="_blank"
                >
                  Go to Faucet
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
              </div>

              <div className="flex gap-3">
                <button
                  className="verity-pill flex-1 h-11 border border-border text-graphite text-sm font-semibold hover:bg-stone-surface transition-all cursor-pointer disabled:opacity-50"
                  disabled={!smartWalletAddress}
                  onClick={handleProceedToSuccess}
                  type="button"
                >
                  Skip for now
                </button>
                <button
                  className="verity-pill flex-1 h-11 bg-inverse text-inverse-text text-sm font-semibold hover:opacity-90 transition-all cursor-pointer shadow-md disabled:opacity-50"
                  disabled={!smartWalletAddress}
                  onClick={handleProceedToSuccess}
                  type="button"
                >
                  Done
                </button>
              </div>
            </div>
          )}

          {step === 'success' && (
            <div className="space-y-5 animate-slide-up text-center py-2">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-meadow-green/10 text-meadow-green mx-auto">
                <CheckCircle2 className="h-8 w-8" />
              </div>
              <div className="space-y-2">
                <h3 className="text-xl font-bold text-charcoal-primary tracking-[-0.02em]">
                  Welcome to Verity!
                </h3>
                <p className="text-sm leading-relaxed text-graphite max-w-sm mx-auto">
                  Your secure profile is registered, and your wallet is ready.
                  You are set to start forecasting and exploring the feed.
                </p>
              </div>

              <button
                className="verity-pill flex h-11 w-full items-center justify-center gap-2 bg-inverse text-inverse-text text-sm font-semibold hover:opacity-90 transition-all cursor-pointer shadow-md mt-6"
                onClick={() => setShowSuccess(false)}
                type="button"
              >
                Start Exploring
                <Sparkles className="h-4 w-4 text-sunburst-yellow animate-pulse" />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
