"use client"

import { Trophy } from "lucide-react"
import { usePathname, useSearchParams, useRouter } from "next/navigation"
import { Suspense } from "react"
import { DraggableFAB } from "@/components/ui/draggable-fab"

function ButtonContent() {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const isPvpArena = pathname === "/markets" && searchParams.get("tab") === "pvp-arena"

  const router = useRouter()
  if (isPvpArena) return null

  return (
    <DraggableFAB
      id="leaderboard"
      onClick={() => router.push("/leaderboard")}
      className="fixed bottom-[calc(env(safe-area-inset-bottom)+82px)] right-4 z-50 sm:hidden flex h-14 w-14 items-center justify-center rounded-full bg-brand-primary text-white shadow-sm cursor-pointer"
    >
      <Trophy className="h-6 w-6 pointer-events-none" />
    </DraggableFAB>
  )
}

export default function MobileLeaderboardButton() {
  return (
    <Suspense fallback={null}>
      <ButtonContent />
    </Suspense>
  )
}
