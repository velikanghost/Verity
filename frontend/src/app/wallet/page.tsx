import { CircleDollarSign, Wallet } from "lucide-react";
import PagePanel from "@/components/layout/PagePanel";
import DailyVotesCard from "@/components/wallet/DailyVotesCard";
import WalletSummary from "@/components/wallet/WalletSummary";

export default function WalletPage() {
  return (
    <PagePanel
      description="Connected wallet, Arc testnet network status, and testnet USDC balance."
      eyebrow="Wallet"
      title="Arc Testnet Wallet"
    >
      <WalletSummary />

      <section className="grid gap-3 sm:grid-cols-3">
        <DailyVotesCard />

        <div className="rounded-[18px] border border-[var(--border)] bg-[var(--surface)] p-5 shadow-sm">
          <div className="flex items-center gap-2 text-[var(--muted)]">
            <Wallet className="h-5 w-5" />
            <span className="font-mono text-xs font-black uppercase tracking-[0.16em]">Positions</span>
          </div>
          <p className="mt-4 text-3xl font-black text-[var(--foreground)]">0</p>
          <p className="font-mono text-xs text-[var(--muted)]">Future backed positions</p>
        </div>

        <div className="rounded-[18px] border border-[var(--border)] bg-[var(--surface)] p-5 shadow-sm">
          <div className="flex items-center gap-2 text-brand-secondary">
            <CircleDollarSign className="h-5 w-5" />
            <span className="font-mono text-xs font-black uppercase tracking-[0.16em]">Earnings</span>
          </div>
          <p className="mt-4 text-3xl font-black text-[var(--foreground)]">0.00</p>
          <p className="font-mono text-xs text-[var(--muted)]">Future creator and payout earnings</p>
        </div>
      </section>
    </PagePanel>
  );
}
