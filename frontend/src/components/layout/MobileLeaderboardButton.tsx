"use client"

import { Trophy } from "lucide-react"
import Link from "next/link"
import { usePathname, useSearchParams } from "next/navigation"
import { Suspense } from "react"

function ButtonContent() {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const isPvpArena = pathname === "/markets" && searchParams.get("tab") === "pvp-arena"

  if (isPvpArena) return null

  return (
    <Link
      href="/leaderboard"
      className="fixed bottom-[calc(env(safe-area-inset-bottom)+82px)] right-4 z-50 sm:hidden clickable flex h-14 w-14 items-center justify-center rounded-full bg-brand-primary text-white shadow-sm"
      aria-label="View Leaderboard"
    >
      <Trophy className="h-6 w-6" />
    </Link>
  )
}

export default function MobileLeaderboardButton() {
  return (
    <Suspense fallback={null}>
      <ButtonContent />
    </Suspense>
  )
}
