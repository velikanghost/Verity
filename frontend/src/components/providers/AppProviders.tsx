"use client";

import { useState, type ReactNode } from "react";
import { PrivyProvider } from "@privy-io/react-auth";
import { SmartWalletsProvider } from "@privy-io/react-auth/smart-wallets";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "next-themes";
import { RightPanelSlotProvider } from "@/hooks/useRightPanelSlot";
import { Toaster } from "react-hot-toast";
import PrivyOnboardingModal from "@/components/wallet/PrivyOnboardingModal";
import { usePrivy } from "@privy-io/react-auth";
import { useEffect } from "react";
import { arcTestnet } from "@/lib/arc";

function PrivyTokenSyncer() {
  const { authenticated, getAccessToken } = usePrivy();

  useEffect(() => {
    if (authenticated) {
      getAccessToken().then((token) => {
        if (token) {
          localStorage.setItem("verity_auth_token", token);
        }
      });
    } else {
      localStorage.removeItem("verity_auth_token");
    }
  }, [authenticated, getAccessToken]);

  return null;
}

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
    <PrivyProvider
      appId={process.env.NEXT_PUBLIC_PRIVY_APP_ID || "cm6t6fff00000000000000000"}
      config={{
        loginMethods: ["email"],
        supportedChains: [arcTestnet],
        defaultChain: arcTestnet,
        appearance: {
          theme: "dark",
          accentColor: "#676FFF",
        },
        embeddedWallets: {
          ethereum: {
            createOnLogin: "off",
          },
        },
      }}
    >
      <SmartWalletsProvider>
        <QueryClientProvider client={queryClient}>
          <ThemeProvider attribute="data-theme" defaultTheme="system" enableSystem>
            <RightPanelSlotProvider>
              <PrivyTokenSyncer />
              {children}
              <PrivyOnboardingModal />
              <Toaster position="top-right" toastOptions={{ duration: 5000 }} />
            </RightPanelSlotProvider>
          </ThemeProvider>
        </QueryClientProvider>
      </SmartWalletsProvider>
    </PrivyProvider>
  );
}
