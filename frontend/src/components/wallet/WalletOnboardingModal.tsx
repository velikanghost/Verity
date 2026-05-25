"use client";

import { useEffect, useMemo, useState } from "react";
import {
  BadgeCheck,
  CheckCircle2,
  CircleDollarSign,
  Loader2,
  ShieldCheck,
  Sparkles,
  UserRound,
  Wallet,
  X,
} from "lucide-react";
import { useAccount, useSwitchChain } from "wagmi";
import { arcTestnet, shortAddress } from "@/lib/arc";
import { useTradingActivation } from "@/hooks/useTradingActivation";
import { useWalletProfile } from "@/hooks/useWalletProfile";
import { useUpdateProfileMutation } from "@/store/verity/verityQueries";

type OnboardingStep =
  | "network"
  | "checking"
  | "activate"
  | "profile-error"
  | "username"
  | "success";

const ONBOARDING_STORAGE_PREFIX = "verity-wallet-onboarding-complete";

function looksGeneratedUsername(username?: string | null) {
  return !username || /^user_[a-f0-9]{4}_\d{4}$/i.test(username);
}

function normalizeUsername(value: string) {
  return value.trim().replace(/^@+/, "");
}

function getUsernameError(username: string) {
  if (username.length < 3) return "Use at least 3 characters.";
  if (username.length > 24) return "Keep it under 24 characters.";
  if (!/^[a-zA-Z0-9_]+$/.test(username)) {
    return "Use letters, numbers, and underscores only.";
  }
  return null;
}

function getOnboardingStorageKey(address?: string) {
  return address
    ? `${ONBOARDING_STORAGE_PREFIX}:${address.toLowerCase()}`
    : null;
}

function getStoredOnboardingComplete(address?: string) {
  if (typeof window === "undefined") return false;
  const key = getOnboardingStorageKey(address);
  return key ? window.localStorage.getItem(key) === "true" : false;
}

function setStoredOnboardingComplete(address?: string) {
  if (typeof window === "undefined") return;
  const key = getOnboardingStorageKey(address);
  if (key) window.localStorage.setItem(key, "true");
}

export default function WalletOnboardingModal() {
  const { address, isConnected } = useAccount();
  const { switchChainAsync, isPending: isSwitching } = useSwitchChain();
  const { profile, isLoading: profileLoading, refetch } = useWalletProfile();
  const {
    activateTrading,
    activationError,
    isActivated,
    isActivating,
    isArcTestnet,
    isChecking,
  } = useTradingActivation();
  const { mutateAsync: updateProfile } = useUpdateProfileMutation();

  const [username, setUsername] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [networkError, setNetworkError] = useState<string | null>(null);
  const [isSavingUsername, setIsSavingUsername] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [setupComplete, setSetupComplete] = useState(false);

  useEffect(() => {
    if (!address) {
      setShowSuccess(false);
      setUsername("");
      setFormError(null);
      setNetworkError(null);
      setSetupComplete(false);
      return;
    }

    setSetupComplete(getStoredOnboardingComplete(address));
  }, [address]);

  useEffect(() => {
    if (profile?.username) {
      setUsername(looksGeneratedUsername(profile.username) ? "" : profile.username);
    }
  }, [profile?.username]);

  const needsUsername = Boolean(profile && looksGeneratedUsername(profile.username));
  const normalizedUsername = normalizeUsername(username);
  const usernameError = useMemo(
    () => getUsernameError(normalizedUsername),
    [normalizedUsername],
  );
  const visibleUsernameError = username ? usernameError : null;

  const step: OnboardingStep | null = useMemo(() => {
    if (!isConnected || !address) return null;
    if (setupComplete && !showSuccess) return null;
    if (!isArcTestnet) return "network";
    if (isChecking || profileLoading) return "checking";
    if (!isActivated) return "activate";
    if (!profile) return "profile-error";
    if (needsUsername) return "username";
    if (showSuccess) return "success";
    return null;
  }, [
    address,
    isActivated,
    isArcTestnet,
    isChecking,
    isConnected,
    needsUsername,
    profile,
    profileLoading,
    setupComplete,
    showSuccess,
  ]);

  useEffect(() => {
    if (!address || setupComplete || !isActivated || !profile || needsUsername) return;
    setStoredOnboardingComplete(address);
    setSetupComplete(true);
  }, [address, isActivated, needsUsername, profile, setupComplete]);

  async function handleActivate() {
    setFormError(null);
    try {
      await activateTrading();
      if (profile && !needsUsername) {
        setStoredOnboardingComplete(address);
        setSetupComplete(true);
        setShowSuccess(true);
      }
    } catch (caught) {
      setFormError(
        caught instanceof Error ? caught.message : "Wallet activation failed.",
      );
    }
  }

  async function handleSwitchNetwork() {
    setNetworkError(null);

    try {
      await switchChainAsync({ chainId: arcTestnet.id });
    } catch (caught) {
      setNetworkError(
        caught instanceof Error
          ? caught.message
          : "Your wallet could not switch networks automatically.",
      );
    }
  }

  async function handleUsernameSave() {
    if (!profile) return;
    setFormError(null);

    if (usernameError) {
      setFormError(usernameError);
      return;
    }

    setIsSavingUsername(true);
    try {
      await updateProfile({
        profileId: profile.id,
        input: {
          username: normalizedUsername,
          display_name: profile.display_name || profile.displayName || normalizedUsername,
          avatar_url: profile.avatar_url || profile.avatarUrl || null,
          bio: profile.bio || null,
        },
      });
      await refetch();
      setStoredOnboardingComplete(address);
      setSetupComplete(true);
      setShowSuccess(true);
    } catch (caught) {
      setFormError(
        caught instanceof Error ? caught.message : "That username could not be saved.",
      );
    } finally {
      setIsSavingUsername(false);
    }
  }

  if (!step) return null;

  const canClose = step === "success";

  return (
    <div
      aria-modal="true"
      aria-labelledby="wallet-onboarding-title"
      className="fixed inset-0 z-[100] flex items-end justify-center bg-obsidian/55 px-3 py-3 backdrop-blur-sm sm:items-center sm:p-6"
      role="dialog"
    >
      <div className="verity-card w-full max-w-[460px] overflow-hidden bg-warm-canvas">
        <div className="border-b border-stone-surface px-5 py-4">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-[18px] bg-parchment-card shadow-[var(--shadow-subtle)]">
                <Wallet className="h-5 w-5 text-charcoal-primary" />
              </div>
              <div>
                <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.16em] text-ash">
                  Wallet setup
                </p>
                <h2 className="text-[23px] font-semibold leading-[1.1] tracking-[-0.44px] text-midnight">
                  <span id="wallet-onboarding-title">
                  {step === "success" ? "You're ready" : "Activate Verity"}
                  </span>
                </h2>
              </div>
            </div>

            {canClose && (
              <button
                aria-label="Close onboarding"
                className="flex h-9 w-9 items-center justify-center rounded-full bg-parchment-card text-graphite shadow-[var(--shadow-subtle)] transition-colors hover:bg-stone-surface"
                onClick={() => setShowSuccess(false)}
                type="button"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>

        <div className="px-5 py-5">
          {step === "network" && (
            <StepShell
              accent="orange"
              body={`You're connected as ${shortAddress(address)}, but Verity trading runs on Arc Testnet. Use the wallet prompt below, or add the network manually with these details.`}
              icon={<ShieldCheck className="h-5 w-5" />}
              title="Switch your wallet to Arc"
            >
              <ManualNetworkDetails />
              <button
                className="verity-pill mt-5 flex h-11 w-full items-center justify-center gap-2 bg-brand-primary text-sm font-semibold tracking-[-0.18px] text-white transition-opacity hover:opacity-90 disabled:opacity-60"
                disabled={isSwitching}
                onClick={handleSwitchNetwork}
                type="button"
              >
                {isSwitching ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Opening wallet
                  </>
                ) : (
                  "Switch to Arc Testnet"
                )}
              </button>
              <ErrorLine message={networkError} />
            </StepShell>
          )}

          {step === "checking" && (
            <StepShell
              body="Checking your router approval and preparing your Verity profile."
              icon={<Loader2 className="h-5 w-5 animate-spin" />}
              title="Checking your wallet"
            >
              <ProgressSteps active={1} />
            </StepShell>
          )}

          {step === "activate" && (
            <StepShell
              body="Verity uses one router approval so you do not have to approve USDC again for every market action."
              icon={<ShieldCheck className="h-5 w-5" />}
              title="Activate your wallet for trading"
            >
              <div className="mt-4 rounded-[10px] bg-parchment-card p-4 shadow-[var(--shadow-subtle)]">
                <p className="font-mono text-xs font-semibold uppercase tracking-[0.16em] text-ash">
                  One-time router approval
                </p>
                <p className="mt-2 text-sm leading-[1.47] tracking-[-0.18px] text-graphite">
                  This lets the router coordinate funding pools, liquidity, and trades from one approval.
                </p>
              </div>
              <button
                className="verity-pill mt-5 flex h-11 w-full items-center justify-center gap-2 bg-inverse text-sm font-semibold tracking-[-0.18px] text-inverse-text transition-opacity hover:opacity-90 disabled:opacity-60"
                disabled={isActivating}
                onClick={handleActivate}
                type="button"
              >
                {isActivating ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Activating
                  </>
                ) : (
                  "Activate wallet"
                )}
              </button>
              <ErrorLine message={formError || activationError?.message} />
            </StepShell>
          )}

          {step === "profile-error" && (
            <StepShell
              accent="orange"
              body="Your wallet is activated, but your profile did not load. Try again so we can finish setup."
              icon={<UserRound className="h-5 w-5" />}
              title="Finish profile setup"
            >
              <button
                className="verity-pill mt-5 flex h-11 w-full items-center justify-center bg-inverse text-sm font-semibold tracking-[-0.18px] text-inverse-text transition-opacity hover:opacity-90"
                onClick={() => refetch()}
                type="button"
              >
                Reload profile
              </button>
            </StepShell>
          )}

          {step === "username" && (
            <StepShell
              body="Pick a handle before entering Verity. You can change it later from your profile."
              icon={<UserRound className="h-5 w-5" />}
              title="Choose your username"
            >
              <label className="mt-5 block">
                <span className="font-mono text-[11px] font-semibold uppercase tracking-[0.16em] text-ash">
                  Username
                </span>
                <div className="mt-2 flex h-11 items-center rounded-[10px] bg-white-surface px-3 shadow-[var(--shadow-subtle)] focus-within:ring-2 focus-within:ring-stone-surface">
                  <span className="font-mono text-sm text-ash">@</span>
                  <input
                    autoFocus
                    className="min-w-0 flex-1 bg-transparent px-1 text-sm font-semibold tracking-[-0.18px] text-charcoal-primary outline-none placeholder:text-ash"
                    disabled={isSavingUsername}
                    maxLength={24}
                    onChange={(event) => setUsername(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") void handleUsernameSave();
                    }}
                    placeholder="your_handle"
                    value={username}
                  />
                </div>
              </label>
              <p className="mt-2 text-xs tracking-[-0.14px] text-ash">
                Letters, numbers, and underscores. No spaces.
              </p>
              <button
                className="verity-pill mt-5 flex h-11 w-full items-center justify-center gap-2 bg-inverse text-sm font-semibold tracking-[-0.18px] text-inverse-text transition-opacity hover:opacity-90 disabled:opacity-60"
                disabled={isSavingUsername || Boolean(usernameError)}
                onClick={handleUsernameSave}
                type="button"
              >
                {isSavingUsername ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Saving
                  </>
                ) : (
                  "Continue"
                )}
              </button>
              <ErrorLine message={formError || visibleUsernameError} />
            </StepShell>
          )}

          {step === "success" && (
            <StepShell
              accent="green"
              body="Your wallet is activated and your Verity profile is ready."
              icon={<CheckCircle2 className="h-5 w-5" />}
              title="You can start trading"
            >
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <MiniCard
                  icon={<BadgeCheck className="h-4 w-4" />}
                  label="Trading"
                  value="Activated"
                />
                <MiniCard
                  icon={<CircleDollarSign className="h-4 w-4" />}
                  label="Arc USDC"
                  value="Fund wallet"
                />
              </div>
              <p className="mt-4 text-sm leading-[1.47] tracking-[-0.18px] text-graphite">
                Add Arc testnet USDC to fund pools, provide liquidity, and trade markets.
              </p>
              <button
                className="verity-pill mt-5 flex h-11 w-full items-center justify-center gap-2 bg-inverse text-sm font-semibold tracking-[-0.18px] text-inverse-text transition-opacity hover:opacity-90"
                onClick={() => setShowSuccess(false)}
                type="button"
              >
                Start exploring
                <Sparkles className="h-4 w-4" />
              </button>
            </StepShell>
          )}
        </div>
      </div>
    </div>
  );
}

function StepShell({
  accent = "blue",
  body,
  children,
  icon,
  title,
}: {
  accent?: "blue" | "green" | "orange";
  body: string;
  children?: React.ReactNode;
  icon: React.ReactNode;
  title: string;
}) {
  const accentClass =
    accent === "green"
      ? "bg-meadow-green/10 text-meadow-green"
      : accent === "orange"
        ? "bg-ember-orange/10 text-ember-orange"
        : "bg-sky-blue/10 text-sky-blue";

  return (
    <div>
      <div className={`flex h-11 w-11 items-center justify-center rounded-[18px] ${accentClass}`}>
        {icon}
      </div>
      <h3 className="mt-4 text-[23px] font-semibold leading-[1.2] tracking-[-0.44px] text-charcoal-primary">
        {title}
      </h3>
      <p className="mt-2 text-[15px] leading-[1.47] tracking-[-0.2px] text-graphite">
        {body}
      </p>
      {children}
    </div>
  );
}

function ProgressSteps({ active }: { active: number }) {
  const labels = ["Connect", "Activate", "Username"];

  return (
    <div className="mt-5 grid grid-cols-3 gap-2">
      {labels.map((label, index) => (
        <div
          className={`rounded-[10px] px-3 py-2 text-center font-mono text-[11px] font-semibold uppercase tracking-[0.12em] shadow-[var(--shadow-subtle)] ${
            index <= active
              ? "bg-inverse text-inverse-text"
              : "bg-parchment-card text-ash"
          }`}
          key={label}
        >
          {label}
        </div>
      ))}
    </div>
  );
}

function MiniCard({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-[10px] bg-white-surface p-3 shadow-[var(--shadow-subtle)]">
      <div className="flex items-center gap-2 text-meadow-green">{icon}</div>
      <p className="mt-3 text-sm font-semibold tracking-[-0.18px] text-charcoal-primary">
        {value}
      </p>
      <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-ash">
        {label}
      </p>
    </div>
  );
}

function ManualNetworkDetails() {
  const rows = [
    { label: "Network", value: arcTestnet.name },
    { label: "Chain ID", value: String(arcTestnet.id) },
    { label: "RPC", value: arcTestnet.rpcUrls.default.http[0] },
    { label: "Currency", value: arcTestnet.nativeCurrency.symbol },
  ];

  return (
    <div className="mt-4 rounded-[10px] bg-parchment-card p-4 shadow-[var(--shadow-subtle)]">
      <p className="font-mono text-xs font-semibold uppercase tracking-[0.16em] text-ash">
        Manual wallet details
      </p>
      <div className="mt-3 grid gap-2">
        {rows.map((row) => (
          <div className="grid grid-cols-[84px_1fr] gap-3" key={row.label}>
            <span className="font-mono text-[11px] uppercase tracking-[0.12em] text-ash">
              {row.label}
            </span>
            <span className="break-all font-mono text-xs font-semibold text-charcoal-primary">
              {row.value}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function ErrorLine({ message }: { message?: string | null }) {
  if (!message) return null;

  return (
    <p className="mt-3 rounded-[10px] bg-ember-orange/10 px-3 py-2 text-sm leading-[1.35] tracking-[-0.18px] text-ember-orange">
      {message}
    </p>
  );
}
