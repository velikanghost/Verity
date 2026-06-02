"use client"

import { useDailyVotesQuery } from "@/store/verity/verityQueries"

export interface DailyVotes {
  votesLimit: number
  votesUsed: number
  votesRemaining: number
  date: string
}

const EMPTY_DAILY_VOTES: DailyVotes = {
  votesLimit: 10,
  votesUsed: 0,
  votesRemaining: 10,
  date: new Date().toISOString().slice(0, 10),
}

export function useDailyVotes(userId?: string) {
  const { data, isLoading, refetch } = useDailyVotesQuery(userId || "")

  return {
    dailyVotes: data || EMPTY_DAILY_VOTES,
    isLoading,
    refetch,
  }
}
