import { create } from "zustand"

interface DrawerState {
  isQuickActionsOpen: boolean
  openQuickActions: () => void
  closeQuickActions: () => void

  isComposeOpen: boolean
  openCompose: () => void
  closeCompose: () => void

  tradeMarketId: string | null
  isTradeDrawerOpen: boolean
  openTradeDrawer: (marketId: string) => void
  closeTradeDrawer: () => void
}

export const useDrawerStore = create<DrawerState>((set) => ({
  isQuickActionsOpen: false,
  openQuickActions: () => set({ isQuickActionsOpen: true }),
  closeQuickActions: () => set({ isQuickActionsOpen: false }),

  isComposeOpen: false,
  openCompose: () => set({ isComposeOpen: true, isQuickActionsOpen: false }),
  closeCompose: () => set({ isComposeOpen: false }),

  tradeMarketId: null,
  isTradeDrawerOpen: false,
  openTradeDrawer: (marketId) =>
    set({ tradeMarketId: marketId, isTradeDrawerOpen: true }),
  closeTradeDrawer: () =>
    set({ tradeMarketId: null, isTradeDrawerOpen: false }),
}))
