"use client";

import { useEffect, useState } from "react";
import { useAccount } from "wagmi";
import { getDevProfile, getOrCreateProfile, type Profile } from "@/lib/verity";
import { hasApiConfig } from "@/api/client";

export function useWalletProfile() {
  const { address, isConnected } = useAccount();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function load() {
      if (!hasApiConfig()) {
        setProfile(null);
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const nextProfile = address && isConnected ? await getOrCreateProfile(address) : await getDevProfile();
        if (active) setProfile(nextProfile);
      } catch (caught) {
        if (active) {
          setError(caught instanceof Error ? caught.message : "Unable to load profile.");
          setProfile(null);
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    load();

    return () => {
      active = false;
    };
  }, [address, isConnected]);

  return {
    address,
    isConnected: isConnected || Boolean(profile),
    profile,
    setProfile,
    loading,
    error,
  };
}
