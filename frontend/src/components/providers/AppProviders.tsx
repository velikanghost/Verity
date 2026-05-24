"use client";

import "@rainbow-me/rainbowkit/styles.css";
import { RainbowKitProvider, getDefaultConfig } from "@rainbow-me/rainbowkit";
import { useState, type ReactNode } from "react";
import { WagmiProvider } from "wagmi";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { arcTestnet, arcTransport } from "@/lib/arc";
import { RightPanelSlotProvider } from "@/hooks/useRightPanelSlot";
import { Toaster } from "react-hot-toast";
import WalletOnboardingModal from "@/components/wallet/WalletOnboardingModal";

const config = getDefaultConfig({
  appName: "Verity",
  projectId: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || "34bb558c5125cd9604951f37559e91ff",
  chains: [arcTestnet],
  transports: {
    [arcTestnet.id]: arcTransport,
  },
  ssr: true,
});

export default function AppProviders({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60 * 1000,
            refetchOnWindowFocus: false,
            retry: false,
          },
        },
      })
  );

  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider>
          <RightPanelSlotProvider>
            {children}
            <WalletOnboardingModal />
            <Toaster position="top-right" toastOptions={{ duration: 5000 }} />
          </RightPanelSlotProvider>
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
