"use client";

import { RainbowKitProvider, getDefaultConfig } from "@rainbow-me/rainbowkit";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";
import { WagmiProvider } from "wagmi";
import { arcTestnet, arcTransport } from "@/lib/arc";

const config = getDefaultConfig({
  appName: "Verity",
  projectId: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || "verity-local",
  chains: [arcTestnet],
  transports: {
    [arcTestnet.id]: arcTransport,
  },
  ssr: true,
});

export default function AppProviders({ children }: { children: ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());

  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider>{children}</RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
