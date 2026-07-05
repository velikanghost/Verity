"use client"

import Sidebar from "@/components/layout/Sidebar"
import RightPanel from "@/components/layout/RightPanel"
import MobileNav from "@/components/layout/MobileNav"
import MobileLeaderboardButton from "@/components/layout/MobileLeaderboardButton"
import MobileHeader from "@/components/layout/MobileHeader"
import ComposeBox from "@/components/feed/ComposeBox"
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerClose } from "@/components/ui/drawer"
import { useDrawerStore } from "@/store/drawerStore"
import { X } from "lucide-react"
import { useSocket } from "@/hooks/useSocket"
import { useWalletProfile } from "@/hooks/useWalletProfile"
import { useEffect } from "react"
import { usePathname } from "next/navigation"

export default function AppShell({ children }: { children: React.ReactNode }) {
  const { profile } = useWalletProfile()
  const { joinRoom, leaveRoom } = useSocket()
  const pathname = usePathname()
  const { isComposeOpen, closeCompose } = useDrawerStore()

  const isFullWidthPage = pathname === "/markets" || pathname === "/portfolio"

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
      <div className="mx-auto flex min-h-screen w-full max-w-[1300px] justify-center gap-3 px-4 sm:px-3 xl:gap-6 xl:px-5">
        <div className="sticky top-0 hidden h-screen w-[76px] shrink-0 flex-col py-4 sm:flex xl:w-[280px]">
          <Sidebar />
        </div>

        <main
          className={`min-w-0 flex-1 ${isFullWidthPage ? "max-w-[1000px]" : "max-w-[672px]"} pb-24 sm:pb-0`}
        >
          <MobileHeader />
          {children}
        </main>

        {!isFullWidthPage && (
          <aside className="sticky top-0 hidden h-screen w-[340px] shrink-0 flex-col py-4 lg:flex">
            <RightPanel />
          </aside>
        )}
      </div>
      <MobileLeaderboardButton />
      <MobileNav />

      {/* Global Propose Market Drawer for Mobile actions */}
      <Drawer open={isComposeOpen} onOpenChange={(open) => !open && closeCompose()}>
        <DrawerContent className="max-h-[92vh] rounded-t-3xl border-t border-stone-surface bg-warm-canvas pb-6 px-4 outline-none overflow-y-auto">
          <DrawerHeader className="relative flex items-center justify-between border-b border-stone-surface pb-3 pt-2 mb-4">
            <DrawerTitle className="font-heading text-lg font-bold text-charcoal-primary">
              Propose a Market
            </DrawerTitle>
            <DrawerClose className="rounded-full p-1.5 hover:bg-stone-surface text-ash hover:text-charcoal-primary transition-colors">
              <X className="h-4.5 w-4.5" />
            </DrawerClose>
          </DrawerHeader>
          <ComposeBox profile={profile as any} onCreated={() => closeCompose()} />
        </DrawerContent>
      </Drawer>
    </>
  )
}
