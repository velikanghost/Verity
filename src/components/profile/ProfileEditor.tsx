"use client";

import { useState } from "react";
import { BadgeCheck, Save } from "lucide-react";
import WalletConnectControl from "@/components/wallet/WalletConnectControl";
import { useWalletProfile } from "@/hooks/useWalletProfile";
import { displayHandle, displayName, updateProfile, type Profile } from "@/lib/verity";

export default function ProfileEditor() {
  const { profile, setProfile, isConnected, loading, error } = useWalletProfile();

  return (
    <section className="rounded-[18px] border border-[var(--border)] bg-[var(--surface)] p-5 shadow-sm">
      <div className="mb-5">
        <WalletConnectControl />
      </div>

      <div className="flex items-center gap-4">
        <div
          className="h-16 w-16 rounded-full bg-cover bg-center bg-[var(--inverse)]"
          style={profile?.avatar_url ? { backgroundImage: `url(${profile.avatar_url})` } : undefined}
        />
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-black text-[var(--foreground)]">
              {isConnected ? displayName(profile) : "Connect wallet"}
            </h2>
            {profile && <BadgeCheck className="h-5 w-5 text-brand-secondary" />}
          </div>
          <p className="font-mono text-sm text-[var(--muted)]">
            {isConnected ? displayHandle(profile) : "@wallet"}
          </p>
        </div>
      </div>

      <ProfileForm
        error={error}
        key={profile?.id || "empty"}
        loading={loading}
        profile={profile}
        setProfile={setProfile}
      />
    </section>
  );
}

function ProfileForm({
  profile,
  setProfile,
  loading,
  error,
}: {
  profile: Profile | null;
  setProfile: (profile: Profile | null) => void;
  loading: boolean;
  error: string | null;
}) {
  const [username, setUsername] = useState(profile?.username || "");
  const [display, setDisplay] = useState(profile?.display_name || "");
  const [avatar, setAvatar] = useState(profile?.avatar_url || "");
  const [bio, setBio] = useState(profile?.bio || "");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function save() {
    if (!profile) return;

    setSaving(true);
    setMessage(null);

    try {
      const nextProfile = await updateProfile(profile.id, {
        username: username.trim(),
        display_name: display.trim() || null,
        avatar_url: avatar.trim() || null,
        bio: bio.trim() || null,
      });
      setProfile(nextProfile);
      setMessage("Profile saved.");
    } catch (caught) {
      setMessage(caught instanceof Error ? caught.message : "Unable to save profile.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <div className="mt-5 grid gap-3">
        <input
          className="h-11 rounded-[10px] border border-[var(--border)] bg-[var(--surface-solid)] px-3 text-sm text-[var(--foreground)] outline-none"
          disabled={!profile || saving}
          onChange={(event) => setUsername(event.target.value)}
          placeholder="username"
          value={username}
        />
        <input
          className="h-11 rounded-[10px] border border-[var(--border)] bg-[var(--surface-solid)] px-3 text-sm text-[var(--foreground)] outline-none"
          disabled={!profile || saving}
          onChange={(event) => setDisplay(event.target.value)}
          placeholder="Display name"
          value={display}
        />
        <input
          className="h-11 rounded-[10px] border border-[var(--border)] bg-[var(--surface-solid)] px-3 text-sm text-[var(--foreground)] outline-none"
          disabled={!profile || saving}
          onChange={(event) => setAvatar(event.target.value)}
          placeholder="Avatar URL"
          value={avatar}
        />
        <textarea
          className="min-h-24 rounded-[10px] border border-[var(--border)] bg-[var(--surface-solid)] p-3 text-sm text-[var(--foreground)] outline-none"
          disabled={!profile || saving}
          onChange={(event) => setBio(event.target.value)}
          placeholder="Bio"
          value={bio}
        />
      </div>

      {(message || error || loading) && (
        <p className="mt-3 text-sm text-[var(--muted)]">{loading ? "Loading profile..." : message || error}</p>
      )}

      <button
        className="mt-4 flex h-11 w-full items-center justify-center gap-2 rounded-[13px] bg-[var(--inverse)] font-mono text-xs font-black uppercase tracking-[0.14em] text-[var(--inverse-text)] disabled:cursor-not-allowed disabled:opacity-60"
        disabled={!profile || saving}
        onClick={save}
        type="button"
      >
        {saving ? "Saving" : "Save Profile"} <Save className="h-4 w-4" />
      </button>
    </>
  );
}
