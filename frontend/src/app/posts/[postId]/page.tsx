import PostDetailView from "@/components/post/PostDetailView"

interface PostDetailPageProps {
  params: Promise<{
    postId: string
  }>
}

export default async function PostDetailPage({ params }: PostDetailPageProps) {
  const { postId } = await params

  return <PostDetailView postId={postId} />
}
