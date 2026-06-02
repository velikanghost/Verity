import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { apiRequest } from "../apiClient"
import type {
  FeedPost,
  MarketComment,
  MarketInput,
  MarketPosition,
  MarketPost,
  MarketTrade,
  MarketTradeAction,
  VoteSide,
  Profile,
} from "@/lib/verity"

export const verityKeys = {
  feed: (viewerProfileId?: string, onlyMarkets?: boolean) =>
    ["feed", viewerProfileId ?? "", onlyMarkets ?? false] as const,
  comments: (postId: string) => ["comments", postId] as const,
  positions: (marketId: string, profileId: string) =>
    ["positions", marketId, profileId] as const,
  trades: (marketId: string) => ["trades", marketId] as const,
  dailyVotes: (userId: string) => ["daily-votes", userId] as const,
}

export function useDailyVotesQuery(userId: string) {
  return useQuery({
    queryKey: verityKeys.dailyVotes(userId),
    queryFn: () =>
      apiRequest<{
        votesLimit: number
        votesUsed: number
        votesRemaining: number
        date: string
      }>(`/users/${userId}/daily-votes`),
    enabled: Boolean(userId),
  })
}

export function useUserProfileQuery(idOrUsername: string) {
  return useQuery({
    queryKey: ["user-profile", idOrUsername] as const,
    queryFn: () =>
      apiRequest<Profile>(`/users/${encodeURIComponent(idOrUsername)}`),
    enabled: Boolean(idOrUsername),
  })
}

export function useUpdateProfileMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({
      profileId,
      input,
    }: {
      profileId: string
      input: Pick<
        Profile,
        "username" | "display_name" | "avatar_url" | "bio"
      > & { isOnboarded?: boolean }
    }) =>
      apiRequest<Profile>(`/users/${profileId}`, {
        method: "PATCH",
        body: JSON.stringify(input),
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["wallet-profile"] })
    },
  })
}

export function useFeedQuery(viewerProfileId?: string, onlyMarkets = false) {
  return useQuery({
    queryKey: verityKeys.feed(viewerProfileId, onlyMarkets),
    queryFn: () => {
      const params = new URLSearchParams()
      if (viewerProfileId) params.set("userId", viewerProfileId)
      if (onlyMarkets) params.set("onlyMarkets", "true")
      const query = params.toString()
      return apiRequest<FeedPost[]>(`/feed${query ? `?${query}` : ""}`)
    },
    placeholderData: (previousData, previousQuery) => {
      if (!previousQuery) return undefined
      const prevKey = previousQuery.queryKey
      const prevOnlyMarkets = prevKey[2]
      if (prevOnlyMarkets !== onlyMarkets) {
        return undefined
      }
      return previousData
    },
  })
}

export function usePostCommentsQuery(postId: string) {
  return useQuery({
    queryKey: verityKeys.comments(postId),
    queryFn: () =>
      apiRequest<MarketComment[]>(
        `/comments?postId=${encodeURIComponent(postId)}`,
      ),
    enabled: Boolean(postId),
  })
}

export function usePostQuery(postId: string, viewerProfileId?: string) {
  return useQuery({
    queryKey: ["post", postId, viewerProfileId || ""] as const,
    queryFn: () => {
      const params = new URLSearchParams()
      if (viewerProfileId) params.set("viewerProfileId", viewerProfileId)
      const query = params.toString()
      return apiRequest<FeedPost>(
        `/posts/${encodeURIComponent(postId)}${query ? `?${query}` : ""}`,
      )
    },
    enabled: Boolean(postId),
  })
}

export function useMarketPositionsQuery(marketId: string, profileId: string) {
  return useQuery({
    queryKey: verityKeys.positions(marketId, profileId),
    queryFn: () =>
      apiRequest<MarketPosition[]>(
        `/markets/${marketId}/positions?profileId=${encodeURIComponent(profileId)}`,
      ),
    enabled: Boolean(marketId && profileId),
  })
}

export function useMarketTradesQuery(marketId: string) {
  return useQuery({
    queryKey: verityKeys.trades(marketId),
    queryFn: () => apiRequest<MarketTrade[]>(`/markets/${marketId}/trades`),
    enabled: Boolean(marketId),
  })
}

export function useUserPortfolioQuery(userId: string) {
  return useQuery({
    queryKey: ["user-portfolio", userId] as const,
    queryFn: () =>
      apiRequest<MarketPosition[]>(
        `/markets/user-positions/${encodeURIComponent(userId)}`,
      ),
    enabled: Boolean(userId),
  })
}

export function useUserTradesQuery(userId: string) {
  return useQuery({
    queryKey: ["user-trades", userId] as const,
    queryFn: () =>
      apiRequest<MarketTrade[]>(
        `/markets/user-trades/${encodeURIComponent(userId)}`,
      ),
    enabled: Boolean(userId),
  })
}

export function useCreateNormalPostMutation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: { authorId: string; content: string }) =>
      apiRequest<unknown>("/posts", {
        method: "POST",
        body: JSON.stringify({ ...body, type: "normal" }),
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["feed"] })
    },
  })
}

export function useValidateMarketPostMutation() {
  return useMutation({
    mutationFn: (body: MarketInput) =>
      apiRequest<unknown>("/posts/validate", {
        method: "POST",
        body: JSON.stringify(body),
      }),
  })
}

export function useCreateMarketPostMutation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: { authorId: string } & MarketInput) =>
      apiRequest<{ post: FeedPost; warning: string | null }>("/posts", {
        method: "POST",
        body: JSON.stringify({ ...body, type: "market" }),
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["feed"] })
    },
  })
}

export function useToggleLikeMutation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({
      postId,
      profileId,
      currentlyLiked,
    }: {
      postId: string
      profileId: string
      currentlyLiked: boolean
    }) =>
      apiRequest<null>(`/posts/${postId}/like`, {
        method: "POST",
        body: JSON.stringify({
          userId: profileId,
          currentlyActive: currentlyLiked,
        }),
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["feed"] })
    },
  })
}

export function useToggleReshareMutation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({
      postId,
      profileId,
      currentlyReshared,
    }: {
      postId: string
      profileId: string
      currentlyReshared: boolean
    }) =>
      apiRequest<null>(`/posts/${postId}/reshare`, {
        method: "POST",
        body: JSON.stringify({
          userId: profileId,
          currentlyActive: currentlyReshared,
        }),
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["feed"] })
    },
  })
}

export function useAddCommentMutation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({
      postId,
      authorId,
      content,
      parentId,
    }: {
      postId: string
      authorId: string
      content: string
      parentId?: string
    }) =>
      apiRequest<null>(`/posts/${postId}/comment`, {
        method: "POST",
        body: JSON.stringify({ authorId, content, parentId }),
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["comments"] })
      void qc.invalidateQueries({ queryKey: ["feed"] })
    },
  })
}

export function useCastFreeVoteMutation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({
      marketId,
      userId,
      side,
    }: {
      marketId: string
      userId: string
      side: VoteSide
    }) =>
      apiRequest<{
        market: MarketPost
        dailyVotes: {
          votesLimit: number
          votesUsed: number
          votesRemaining: number
          date: string
        }
      }>(`/markets/${marketId}/vote`, {
        method: "POST",
        body: JSON.stringify({ userId, side }),
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["feed"] })
      void qc.invalidateQueries({ queryKey: ["daily-votes"] })
    },
  })
}

export function useApproveMarketForTradingMutation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (marketId: string) =>
      apiRequest<MarketPost>(`/markets/${marketId}/approve-trading`, {
        method: "POST",
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["feed"] })
    },
  })
}

export function useResolveMarketMutation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({
      marketId,
      winningOutcome,
      txHash,
      adminAddress,
    }: {
      marketId: string
      winningOutcome: "YES" | "NO"
      txHash: string
      adminAddress: string
    }) =>
      apiRequest<any>(`/markets/${marketId}/resolve`, {
        method: "POST",
        body: JSON.stringify({ winningOutcome, txHash, adminAddress }),
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["feed"] })
      void qc.invalidateQueries({ queryKey: ["pool-state"] })
    },
  })
}

export function useExecuteMarketTradeMutation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({
      marketId,
      ...body
    }: {
      marketId: string
      profileId: string
      side: VoteSide
      action: MarketTradeAction
      amount: number
      feeAmount?: number
      grossAmount?: number
      txHash?: string | null
    }) =>
      apiRequest<null>(`/markets/${marketId}/trade`, {
        method: "POST",
        body: JSON.stringify(body),
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["feed"] })
      void qc.invalidateQueries({ queryKey: ["positions"] })
      void qc.invalidateQueries({ queryKey: ["trades"] })
    },
  })
}

export function usePoolStateQuery(marketId: string) {
  return useQuery({
    queryKey: ["pool-state", marketId] as const,
    queryFn: () => apiRequest<any>(`/markets/${marketId}/pool`),
    enabled: Boolean(marketId),
  })
}

export function useMarketDetailQuery(
  marketId: string,
  viewerProfileId?: string,
) {
  return useQuery({
    queryKey: ["market-detail", marketId, viewerProfileId || ""] as const,
    queryFn: () => {
      const params = new URLSearchParams()
      if (viewerProfileId) params.set("userId", viewerProfileId)
      const query = params.toString()
      return apiRequest<FeedPost>(
        `/markets/${encodeURIComponent(marketId)}${query ? `?${query}` : ""}`,
      )
    },
    enabled: Boolean(marketId),
  })
}

export function useLPPositionsQuery(marketId: string, userId: string) {
  return useQuery({
    queryKey: ["lp-positions", marketId, userId] as const,
    queryFn: () =>
      apiRequest<any[]>(
        `/markets/${marketId}/lp-positions?userId=${encodeURIComponent(userId)}`,
      ),
    enabled: Boolean(marketId && userId),
  })
}

export function useFundPoolMutation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({
      marketId,
      creatorId,
      creatorWallet,
      txHash,
    }: {
      marketId: string
      creatorId: string
      creatorWallet: string
      txHash: string
    }) =>
      apiRequest<any>(`/markets/${marketId}/fund-pool`, {
        method: "POST",
        body: JSON.stringify({ creatorId, creatorWallet, txHash }),
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["feed"] })
      void qc.invalidateQueries({ queryKey: ["pool-state"] })
    },
  })
}

export function useAddLiquidityMutation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({
      marketId,
      userId,
      amount,
      txHash,
    }: {
      marketId: string
      userId: string
      amount: number
      txHash: string
    }) =>
      apiRequest<any>(`/markets/${marketId}/add-liquidity`, {
        method: "POST",
        body: JSON.stringify({ userId, amount, txHash }),
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["feed"] })
      void qc.invalidateQueries({ queryKey: ["pool-state"] })
      void qc.invalidateQueries({ queryKey: ["lp-positions"] })
    },
  })
}

export function useRemoveLiquidityMutation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({
      marketId,
      userId,
      lpShares,
      txHash,
    }: {
      marketId: string
      userId: string
      lpShares: number
      txHash: string
    }) =>
      apiRequest<any>(`/markets/${marketId}/remove-liquidity`, {
        method: "POST",
        body: JSON.stringify({ userId, lpShares, txHash }),
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["feed"] })
      void qc.invalidateQueries({ queryKey: ["pool-state"] })
      void qc.invalidateQueries({ queryKey: ["lp-positions"] })
    },
  })
}

export function useDevQualifyMutation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (marketId: string) =>
      apiRequest<any>(`/markets/${marketId}/dev-qualify`, {
        method: "POST",
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["feed"] })
    },
  })
}

export function useNotificationsQuery(userId: string) {
  return useQuery({
    queryKey: ["notifications", userId] as const,
    queryFn: () =>
      apiRequest<any[]>(`/notifications?userId=${encodeURIComponent(userId)}`),
    enabled: Boolean(userId),
  })
}

export function useMarkNotificationReadMutation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({
      notificationId,
      userId,
    }: {
      notificationId: string
      userId: string
    }) =>
      apiRequest<any>(`/notifications/${notificationId}/read`, {
        method: "PATCH",
        body: JSON.stringify({ userId }),
      }),
    onSuccess: (_, { notificationId }) => {
      void qc.invalidateQueries({ queryKey: ["notifications"] })
    },
  })
}

export function useMarkAllNotificationsReadMutation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (userId: string) =>
      apiRequest<any>(`/notifications/read-all`, {
        method: "POST",
        body: JSON.stringify({ userId }),
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["notifications"] })
    },
  })
}

export function useProfileActivityQuery(
  profileId: string,
  tab: string,
  viewerId?: string,
) {
  return useQuery({
    queryKey: ["profile-activity", profileId, tab, viewerId || ""] as const,
    queryFn: () => {
      const params = new URLSearchParams()
      params.set("profileId", profileId)
      params.set("tab", tab)
      if (viewerId) params.set("userId", viewerId)
      return apiRequest<FeedPost[]>(`/posts?${params.toString()}`)
    },
    enabled: Boolean(profileId && tab),
  })
}

export function useIsFollowingQuery(targetId: string, viewerId: string) {
  return useQuery({
    queryKey: ["is-following", targetId, viewerId] as const,
    queryFn: () =>
      apiRequest<{ following: boolean }>(`/users/${targetId}/is-following`),
    enabled: Boolean(targetId && viewerId),
  })
}

export function useFollowUserMutation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (targetId: string) =>
      apiRequest<{ success: boolean }>(`/users/${targetId}/follow`, {
        method: "POST",
      }),
    onSuccess: (_, targetId) => {
      void qc.invalidateQueries({ queryKey: ["is-following", targetId] })
      void qc.invalidateQueries({ queryKey: ["wallet-profile"] })
      void qc.invalidateQueries({ queryKey: ["feed"] })
    },
  })
}

export function useUnfollowUserMutation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (targetId: string) =>
      apiRequest<{ success: boolean }>(`/users/${targetId}/unfollow`, {
        method: "POST",
      }),
    onSuccess: (_, targetId) => {
      void qc.invalidateQueries({ queryKey: ["is-following", targetId] })
      void qc.invalidateQueries({ queryKey: ["wallet-profile"] })
      void qc.invalidateQueries({ queryKey: ["feed"] })
    },
  })
}
