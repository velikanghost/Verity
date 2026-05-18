import PagePanel from "@/components/layout/PagePanel";
import MarketDetail from "@/components/markets/MarketDetail";

export default async function MarketDetailPage({
  params,
}: {
  params: Promise<{ marketId: string }>;
}) {
  const { marketId } = await params;

  return (
    <PagePanel
      description="Review the full conditions, fees, and liquidity before backing a side with Arc testnet USDC."
      eyebrow="Opinion Market"
      title="Market Details"
    >
      <MarketDetail marketId={marketId} />
    </PagePanel>
  );
}
