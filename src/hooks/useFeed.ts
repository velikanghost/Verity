"use client";

import { useCallback, useEffect, useState } from "react";
import { fetchFeed, type FeedPost } from "@/lib/verity";
import { hasSupabaseConfig } from "@/lib/supabase";

export function useFeed(profileId?: string, onlyMarkets = false) {
  const [items, setItems] = useState<FeedPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!hasSupabaseConfig()) {
      setItems([]);
      setError("Add Supabase environment variables to load live Verity data.");
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      setItems(await fetchFeed(profileId, onlyMarkets));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to load feed.");
    } finally {
      setLoading(false);
    }
  }, [onlyMarkets, profileId]);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      void reload();
    }, 0);

    return () => window.clearTimeout(timeout);
  }, [reload]);

  return { items, loading, error, reload };
}
