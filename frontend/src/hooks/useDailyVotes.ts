"use client";

import { useCallback, useEffect, useState } from "react";
import { fetchDailyVotes } from "@/api/users";

export interface DailyVotes {
  votesLimit: number;
  votesUsed: number;
  votesRemaining: number;
  date: string;
}

const EMPTY_DAILY_VOTES: DailyVotes = {
  votesLimit: 10,
  votesUsed: 0,
  votesRemaining: 10,
  date: new Date().toISOString().slice(0, 10),
};

export function useDailyVotes(userId?: string) {
  const [dailyVotes, setDailyVotes] = useState<DailyVotes>(EMPTY_DAILY_VOTES);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    setError(null);
    try {
      setDailyVotes(await fetchDailyVotes(userId));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to load daily votes.");
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    if (!userId) return;

    let active = true;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const nextDailyVotes = await fetchDailyVotes(userId!);
        if (active) setDailyVotes(nextDailyVotes);
      } catch (caught) {
        if (active) setError(caught instanceof Error ? caught.message : "Unable to load daily votes.");
      } finally {
        if (active) setLoading(false);
      }
    }

    void load();

    return () => {
      active = false;
    };
  }, [userId]);

  return { dailyVotes, setDailyVotes, loading, error, reload };
}
