'use client'

import { usePrivy } from '@privy-io/react-auth'
import Sidebar from '@/components/layout/Sidebar'
import RightPanel from '@/components/layout/RightPanel'
import MobileNav from '@/components/layout/MobileNav'
import MobileComposeButton from '@/components/layout/MobileComposeButton'
import LandingPage from '@/components/landing/LandingPage'

export default function AppShell({ children }: { children: React.ReactNode }) {
  const { authenticated, ready } = usePrivy()
  const isLocked = !ready || !authenticated

  if (isLocked) {
    return <LandingPage loading={!ready} />
  }

  return (
    <>
      <div className="mx-auto flex min-h-screen w-full max-w-[1220px] justify-center gap-3 px-2 sm:px-3 xl:gap-6 xl:px-5">
        <header className="sticky top-0 hidden h-screen w-[76px] shrink-0 flex-col py-4 sm:flex xl:w-[244px]">
          <Sidebar />
        </header>

        <main className="min-w-0 flex-1 max-w-[672px] pb-24 sm:pb-0">
          {children}
        </main>

        <aside className="sticky top-0 hidden h-screen w-[312px] shrink-0 flex-col py-4 lg:flex">
          <RightPanel />
        </aside>
      </div>
      <MobileComposeButton />
      <MobileNav />
    </>
  )
}
