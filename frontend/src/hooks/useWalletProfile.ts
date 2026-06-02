"use client"

import { useAuth } from "@/components/providers/AuthModals"

export function useWalletProfile() {
  const { user, loading } = useAuth()

  return {
    profile: user,
    isLoading: loading,
    refetch: async () => {
      // No-op as the AuthContext handles profile loading
    },
  }
}
