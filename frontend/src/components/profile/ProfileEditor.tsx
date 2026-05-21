'use client'

import { useState } from 'react'
import { BadgeCheck, Save } from 'lucide-react'
import WalletConnectControl from '@/components/wallet/WalletConnectControl'
import { useWalletProfile } from '@/hooks/useWalletProfile'
import { displayHandle, displayName, type Profile } from '@/lib/verity'
import { useUpdateProfileMutation } from '@/store/verity/verityQueries'

export default function ProfileEditor() {
  const { profile, isLoading } = useWalletProfile()
  const isConnected = Boolean(profile)

  return (
    <section className="rounded-[18px] border border-border bg-surface p-5 shadow-sm">
      <div className="mb-5">
        <WalletConnectControl />
      </div>

      <div className="flex items-center gap-4">
        <div
          className="h-16 w-16 rounded-full bg-cover bg-center bg-inverse"
          style={
            profile?.avatar_url
              ? { backgroundImage: `url(${profile.avatar_url})` }
              : undefined
          }
        />
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-black text-foreground">
              {isConnected ? displayName(profile) : 'Connect wallet'}
            </h2>
            {profile && (
              <BadgeCheck className="h-5 w-5 text-brand-secondary" />
            )}
          </div>
          <p className="font-mono text-sm text-muted">
            {isConnected ? displayHandle(profile) : '@wallet'}
          </p>
        </div>
      </div>

      {profile && (
        <div className="mt-5 rounded-[10px] border border-dashed border-border bg-surface-muted p-4">
          <div className="flex items-center justify-between gap-3">
            <span className="font-mono text-xs font-black uppercase tracking-[0.14em] text-muted">
              Signal Points
            </span>
            <span className="font-mono text-lg font-black text-foreground">
              {profile.signalPoints || 0}
            </span>
          </div>
          <div className="mt-4 grid grid-cols-3 gap-2">
            <SignalMetric
              label="Correct"
              value={profile.freeVotesCorrect || 0}
            />
            <SignalMetric label="Wrong" value={profile.freeVotesWrong || 0} />
            <SignalMetric label="Total" value={profile.freeVotesTotal || 0} />
          </div>
          <p className="mt-2 text-sm text-muted">
            Signal Points activate when markets resolve. Correct early votes and
            correct minority votes earn bonus reputation.
          </p>
        </div>
      )}

      <ProfileForm
        error={null}
        key={profile?.id || 'empty'}
        loading={isLoading}
        profile={profile}
      />
    </section>
  )
}

function SignalMetric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-[8px] bg-surface p-3">
      <p className="font-mono text-base font-black text-foreground">
        {value}
      </p>
      <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted">
        {label}
      </p>
    </div>
  )
}

function ProfileForm({
  profile,
  loading,
  error,
}: {
  profile: Profile | null
  loading: boolean
  error: string | null
}) {
  const [username, setUsername] = useState(profile?.username || '')
  const [display, setDisplay] = useState(profile?.display_name || '')
  const [avatar, setAvatar] = useState(profile?.avatar_url || '')
  const [bio, setBio] = useState(profile?.bio || '')
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const { mutateAsync: updateProfile } = useUpdateProfileMutation()

  async function save() {
    if (!profile) return

    setSaving(true)
    setMessage(null)

    try {
      await updateProfile({
        profileId: profile.id,
        input: {
          username: username.trim(),
          display_name: display.trim() || null,
          avatar_url: avatar.trim() || null,
          bio: bio.trim() || null,
        },
      })
      setMessage('Profile saved.')
    } catch (caught) {
      setMessage(
        caught instanceof Error ? caught.message : 'Unable to save profile.',
      )
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <div className="mt-5 grid gap-3">
        <input
          className="h-11 rounded-[10px] border border-border bg-surface-solid px-3 text-sm text-foreground outline-none"
          disabled={!profile || saving}
          onChange={(event) => setUsername(event.target.value)}
          placeholder="username"
          value={username}
        />
        <input
          className="h-11 rounded-[10px] border border-border bg-surface-solid px-3 text-sm text-foreground outline-none"
          disabled={!profile || saving}
          onChange={(event) => setDisplay(event.target.value)}
          placeholder="Display name"
          value={display}
        />
        <input
          className="h-11 rounded-[10px] border border-border bg-surface-solid px-3 text-sm text-foreground outline-none"
          disabled={!profile || saving}
          onChange={(event) => setAvatar(event.target.value)}
          placeholder="Avatar URL"
          value={avatar}
        />
        <textarea
          className="min-h-24 rounded-[10px] border border-border bg-surface-solid p-3 text-sm text-foreground outline-none"
          disabled={!profile || saving}
          onChange={(event) => setBio(event.target.value)}
          placeholder="Bio"
          value={bio}
        />
      </div>

      {(message || error || loading) && (
        <p className="mt-3 text-sm text-muted">
          {loading ? 'Loading profile...' : message || error}
        </p>
      )}

      <button
        className="mt-4 flex h-11 w-full items-center justify-center gap-2 rounded-[13px] bg-inverse font-mono text-xs font-black uppercase tracking-[0.14em] text-inverse-text disabled:cursor-not-allowed disabled:opacity-60"
        disabled={!profile || saving}
        onClick={save}
        type="button"
      >
        {saving ? 'Saving' : 'Save Profile'} <Save className="h-4 w-4" />
      </button>
    </>
  )
}
