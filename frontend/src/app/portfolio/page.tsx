import PagePanel from "@/components/layout/PagePanel"
import DailyVotesCard from "@/components/porfolio/DailyVotesCard"
import PortfolioDashboard from "@/components/porfolio/PortfolioDashboard"

export default function WalletPage() {
  return (
    <PagePanel
      description="Manage your stakes, view prediction P&L, perform USDC transfers, and track daily signals."
      eyebrow="Portfolio"
      title="Prediction Portfolio"
    >
      <PortfolioDashboard />

      <section className="mt-6 border-t border-border pt-6">
        <h3 className="text-sm font-semibold uppercase tracking-[0.12em] text-charcoal-primary mb-4">
          Utility & Resources
        </h3>
        <div className="grid gap-3 sm:grid-cols-3">
          <DailyVotesCard />
        </div>
      </section>
    </PagePanel>
  )
}
