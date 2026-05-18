import PagePanel from "@/components/layout/PagePanel";
import MarketBoard from "@/components/markets/MarketBoard";

export default function MarketsPage() {
  return (
    <PagePanel
      description="Track active markets, liquidity, and conviction before you take a side."
      eyebrow="Markets"
      title="Market Board"
    >
      <MarketBoard />
    </PagePanel>
  );
}
