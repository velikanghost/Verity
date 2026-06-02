import PublicProfileView from "@/components/profile/PublicProfileView"

interface PublicProfilePageProps {
  params: Promise<{
    userId: string
  }>
}

export default async function PublicProfilePage({
  params,
}: PublicProfilePageProps) {
  const { userId } = await params

  return <PublicProfileView userId={userId} />
}
