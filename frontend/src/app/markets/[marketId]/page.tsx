import PagePanel from '@/components/layout/PagePanel'
import MarketDetail from '@/components/markets/MarketDetail'

export default async function MarketDetailPage({
  params,
}: {
  params: Promise<{ marketId: string }>
}) {
  const { marketId } = await params

  return <MarketDetail marketId={marketId} />
}
