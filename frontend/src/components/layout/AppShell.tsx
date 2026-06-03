"use client"

import Sidebar from "@/components/layout/Sidebar"
import RightPanel from "@/components/layout/RightPanel"
import MobileNav from "@/components/layout/MobileNav"
import MobileComposeButton from "@/components/layout/MobileComposeButton"
import { useSocket } from "@/hooks/useSocket"
import { useWalletProfile } from "@/hooks/useWalletProfile"
import { useEffect } from "react"
import { usePathname } from "next/navigation"

export default function AppShell({ children }: { children: React.ReactNode }) {
  const { profile } = useWalletProfile()
  const { joinRoom, leaveRoom } = useSocket()
  const pathname = usePathname()
  
  const isMarketsListingPage = pathname === "/markets"

  useEffect(() => {
    if (profile?.id) {
      joinRoom(`user:${profile.id}`)
      return () => {
        leaveRoom(`user:${profile.id}`)
      }
    }
  }, [profile?.id, joinRoom, leaveRoom])

  return (
    <>
      <div className="mx-auto flex min-h-screen w-full max-w-[1300px] justify-center gap-3 px-2 sm:px-3 xl:gap-6 xl:px-5">
        <div className="sticky top-0 hidden h-screen w-[76px] shrink-0 flex-col py-4 sm:flex xl:w-[280px]">
          <Sidebar />
        </div>

        <main className={`min-w-0 flex-1 ${isMarketsListingPage ? "max-w-[1000px]" : "max-w-[672px]"} pb-24 sm:pb-0`}>
          {children}
        </main>

        {!isMarketsListingPage && (
          <aside className="sticky top-0 hidden h-screen w-[312px] shrink-0 flex-col py-4 lg:flex">
            <RightPanel />
          </aside>
        )}
      </div>
      <MobileComposeButton />
      <MobileNav />
    </>
  )
}

