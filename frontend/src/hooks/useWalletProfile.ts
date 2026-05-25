'use client'

import { useQuery } from '@tanstack/react-query'
import { usePrivyWallet } from '@/hooks/usePrivyWallet'
import { usePrivy } from '@privy-io/react-auth'
import { apiRequest } from '@/store/apiClient'
import { useEffect } from 'react'

export function useWalletProfile() {
  const { address, isConnected } = usePrivyWallet()
  const { getAccessToken, authenticated } = usePrivy()

  const {
    data: profile,
    refetch,
    isLoading,
  } = useQuery({
    queryKey: ['wallet-profile', address] as const,
    queryFn: async () => {
      if (!address) return null
      try {
        // Fetch the token directly from Privy to prevent race conditions on page load
        const token = await getAccessToken()
        if (!token) return null
        localStorage.setItem('verity_auth_token', token)

        const res = await apiRequest<any>(`/users/wallet/${address}`)
        if (!res) return null
        if (res.token) {
          localStorage.setItem('verity_auth_token', res.token)
        }
        // If the API response contains a nested user object, use it; otherwise, use the response object itself.
        const userProfile = res.user !== undefined ? res.user : res
        return userProfile || null
      } catch (err) {
        console.error('Error fetching wallet profile:', err)
        return null
      }
    },
    enabled: isConnected && Boolean(address) && authenticated,
  })

  // Handle localstorage cleanup when disconnected
  useEffect(() => {
    if (!isConnected) {
      localStorage.removeItem('verity_auth_token')
    }
  }, [isConnected])

  return {
    profile: profile || null,
    isLoading,
    refetch,
  }
}
