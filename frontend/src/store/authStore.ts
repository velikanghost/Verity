import { create } from "zustand"
import { apiRequest } from "@/store/apiClient"
import type { Profile } from "@/lib/verity"
import { toast } from "react-hot-toast"
import { queryClient } from "@/lib/queryClient"

export interface TxCall {
  contractAddress: string
  abiFunctionSignature: string
  abiParameters: any[]
}

export interface TxConfirmationState {
  isOpen: boolean
  calls: TxCall[]
  description: string
  estimatedCostUsdc: number
  resolve: ((txHash: string) => void) | null
  reject: ((err: Error) => void) | null
}

export interface AuthStore {
  authModalStep: "idle" | "email" | "otp" | "onboarding" | "success"
  email: string
  otpCode: string
  usernameInput: string
  isSubmittingOtp: boolean
  isRequestingOtp: boolean
  authError: string
  copied: boolean

  txConfirmState: TxConfirmationState
  isExecutingTx: boolean
  txError: string

  setAuthModalStep: (
    step: "idle" | "email" | "otp" | "onboarding" | "success",
  ) => void
  setEmail: (email: string) => void
  setOtpCode: (otpCode: string) => void
  setUsernameInput: (username: string) => void
  setAuthError: (error: string) => void
  setCopied: (copied: boolean) => void
  setTxConfirmState: (state: Partial<TxConfirmationState>) => void
  setTxError: (error: string) => void
  setIsExecutingTx: (isExecuting: boolean) => void

  login: () => void
  logout: () => void
  executeTxBatch: (
    calls: TxCall[],
    description: string,
    estimatedCostUsdc: number,
  ) => Promise<string>

  handleRequestOtp: (e: React.FormEvent) => Promise<void>
  handleVerifyOtp: (e: React.FormEvent) => Promise<void>
  handleSaveOnboarding: (e: React.FormEvent) => Promise<void>
  handleConfirmTx: () => Promise<void>
  handleCancelTx: () => void
}

export const useAuthStore = create<AuthStore>((set, get) => ({
  authModalStep: "idle",
  email: "",
  otpCode: "",
  usernameInput: "",
  isSubmittingOtp: false,
  isRequestingOtp: false,
  authError: "",
  copied: false,

  txConfirmState: {
    isOpen: false,
    calls: [],
    description: "",
    estimatedCostUsdc: 0,
    resolve: null,
    reject: null,
  },
  isExecutingTx: false,
  txError: "",

  setAuthModalStep: (authModalStep) => {
    if (authModalStep === "idle" || authModalStep === "success") {
      set({ authModalStep, email: "", otpCode: "", authError: "" })
    } else {
      set({ authModalStep })
    }
  },
  setEmail: (email) => set({ email }),
  setOtpCode: (otpCode) => set({ otpCode }),
  setUsernameInput: (usernameInput) => set({ usernameInput }),
  setAuthError: (authError) => set({ authError }),
  setCopied: (copied) => set({ copied }),
  setTxConfirmState: (state) =>
    set((s) => ({ txConfirmState: { ...s.txConfirmState, ...state } })),
  setTxError: (txError) => set({ txError }),
  setIsExecutingTx: (isExecutingTx) => set({ isExecutingTx }),

  login: () => {
    set({ authModalStep: "email", authError: "", email: "", otpCode: "" })
  },

  logout: () => {
    localStorage.removeItem("verity_auth_token")
    queryClient.setQueryData(["profile"], null)
    queryClient.invalidateQueries()
  },

  executeTxBatch: (calls, description, estimatedCostUsdc) => {
    const user = queryClient.getQueryData<Profile>(["profile"])
    if (!user) {
      get().login()
      return Promise.reject(
        new Error("User must be signed in to execute transactions."),
      )
    }

    return new Promise<string>((resolve, reject) => {
      set({
        txConfirmState: {
          isOpen: true,
          calls,
          description,
          estimatedCostUsdc,
          resolve,
          reject,
        },
        txError: "",
      })
    })
  },

  handleRequestOtp: async (e) => {
    e.preventDefault()
    const { email } = get()
    if (!email || !email.includes("@")) {
      set({ authError: "Please enter a valid email address." })
      return
    }

    set({ isRequestingOtp: true, authError: "" })
    try {
      await apiRequest("/auth/request-otp", {
        method: "POST",
        body: JSON.stringify({ email }),
      })
      set({ authModalStep: "otp", otpCode: "" })
    } catch (err: any) {
      set({ authError: err.message || "Failed to send OTP code." })
    } finally {
      set({ isRequestingOtp: false })
    }
  },

  handleVerifyOtp: async (e) => {
    e.preventDefault()
    const { email, otpCode } = get()
    if (otpCode.length !== 6) {
      set({ authError: "OTP code must be 6 digits." })
      return
    }

    set({ isSubmittingOtp: true, authError: "" })
    try {
      const res = await apiRequest<{ token: string; user: Profile }>(
        "/auth/verify-otp",
        {
          method: "POST",
          body: JSON.stringify({ email, code: otpCode }),
        },
      )

      localStorage.setItem("verity_auth_token", res.token)
      queryClient.setQueryData(["profile"], res.user)

      if (!res.user.isOnboarded) {
        set({
          authModalStep: "onboarding",
          usernameInput: res.user.username || "",
          email: "",
          otpCode: "",
          authError: "",
        })
      } else {
        set({ authModalStep: "idle", email: "", otpCode: "", authError: "" })
      }
      queryClient.invalidateQueries()
    } catch (err: any) {
      set({ authError: err.message || "Invalid or expired OTP code." })
    } finally {
      set({ isSubmittingOtp: false })
    }
  },

  handleSaveOnboarding: async (e) => {
    e.preventDefault()
    const user = queryClient.getQueryData<Profile>(["profile"])
    if (!user) return

    const { usernameInput } = get()
    const trimmed = usernameInput.trim().replace(/^@+/, "")
    if (trimmed.length < 3) {
      set({ authError: "Username must be at least 3 characters." })
      return
    }
    if (trimmed.length > 24) {
      set({ authError: "Username must be under 24 characters." })
      return
    }
    if (!/^[a-zA-Z0-9_]+$/.test(trimmed)) {
      set({ authError: "Letters, numbers, and underscores only." })
      return
    }

    set({ isSubmittingOtp: true, authError: "" })
    try {
      const updated = await apiRequest<Profile>(`/users/${user.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          username: trimmed,
          display_name: trimmed.charAt(0).toUpperCase() + trimmed.slice(1),
          isOnboarded: true,
        }),
      })

      queryClient.setQueryData(["profile"], updated)
      set({
        authModalStep: "success",
        email: "",
        otpCode: "",
        authError: "",
        usernameInput: "",
      })
      queryClient.invalidateQueries()
    } catch (err: any) {
      set({ authError: err.message || "Failed to update profile settings." })
    } finally {
      set({ isSubmittingOtp: false })
    }
  },

  handleConfirmTx: async () => {
    const { txConfirmState } = get()
    if (!txConfirmState.resolve || !txConfirmState.reject) return

    set({ isExecutingTx: true, txError: "" })
    try {
      const res = await apiRequest<{ txHash: string }>(
        "/circle-wallet/execute-batch",
        {
          method: "POST",
          body: JSON.stringify(
            {
              calls: txConfirmState.calls,
              estimatedCostUsdc: txConfirmState.estimatedCostUsdc,
            },
            (key, value) => {
              if (typeof value === "bigint") {
                return value.toString()
              }
              return value
            },
          ),
        },
      )

      toast.success("Transaction executed successfully!")
      txConfirmState.resolve(res.txHash)
      set((s) => ({ txConfirmState: { ...s.txConfirmState, isOpen: false } }))
      queryClient.invalidateQueries()
    } catch (err: any) {
      const parsedError = err.message || "Transaction execution failed."
      set({ txError: parsedError })
    } finally {
      set({ isExecutingTx: false })
    }
  },

  handleCancelTx: () => {
    const { txConfirmState } = get()
    if (txConfirmState.reject) {
      txConfirmState.reject(new Error("Transaction rejected by user."))
    }
    set((s) => ({ txConfirmState: { ...s.txConfirmState, isOpen: false } }))
  },
}))
