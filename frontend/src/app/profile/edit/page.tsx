"use client"

import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import { useWalletProfile } from "@/hooks/useWalletProfile"
import ProfileForm from "@/components/profile/ProfileForm"

export default function EditProfilePage() {
  const { profile, isLoading } = useWalletProfile()

  return (
    <div className="flex flex-col gap-4 py-4">
      {/* Back button and page title */}
      <div className="flex items-center gap-3">
        <Link
          className="flex h-10 w-10 items-center justify-center rounded-full bg-stone-surface text-charcoal-primary hover:bg-stone-surface/80 transition-colors"
          href="/profile"
          title="Back to profile"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold tracking-[-0.5px] text-midnight">
            Edit Profile
          </h1>
          <p className="text-xs text-ash">
            Update your public profile details and avatar.
          </p>
        </div>
      </div>

      <section className="verity-card p-5">
        {!profile && !isLoading ? (
          <div className="py-8 text-center text-sm font-medium tracking-[-0.18px] text-ash">
            Please connect your wallet to edit your profile.
          </div>
        ) : (
          <ProfileForm profile={profile} loading={isLoading} />
        )}
      </section>
    </div>
  )
}
