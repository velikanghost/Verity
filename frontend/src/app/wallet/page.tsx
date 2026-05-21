import PagePanel from "@/components/layout/PagePanel";
import DailyVotesCard from "@/components/wallet/DailyVotesCard";
import WalletSummary from "@/components/wallet/WalletSummary";
import PortfolioPositions from "@/components/wallet/PortfolioPositions";

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
      </section>

      <section className="mt-4">
        <PortfolioPositions />
      </section>
    </PagePanel>
  );
}
