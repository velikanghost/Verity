"use client"

import { useState } from "react"
import { Save } from "lucide-react"
import { type Profile } from "@/lib/verity"
import { useUpdateProfileMutation } from "@/store/verity/verityQueries"
import { toast } from "react-hot-toast"

interface ProfileFormProps {
  profile: Profile | null
  loading: boolean
  error?: string | null
}

export default function ProfileForm({
  profile,
  loading,
  error = null,
}: ProfileFormProps) {
  const [username, setUsername] = useState(profile?.username || "")
  const [display, setDisplay] = useState(profile?.display_name || "")
  const [avatar, setAvatar] = useState(profile?.avatar_url || "")
  const [avatarPreview, setAvatarPreview] = useState(profile?.avatar_url || "")
  const [avatarNotice, setAvatarNotice] = useState<string | null>(null)
  const [bio, setBio] = useState(profile?.bio || "")
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const { mutateAsync: updateProfile } = useUpdateProfileMutation()

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    if (!file.type.startsWith("image/")) {
      toast.error("Please select an image file.")
      return
    }

    const reader = new FileReader()
    reader.onload = (e) => {
      const img = new Image()
      img.onload = () => {
        const canvas = document.createElement("canvas")
        const MAX_WIDTH = 160
        const MAX_HEIGHT = 160
        let width = img.width
        let height = img.height

        if (width > height) {
          if (width > MAX_WIDTH) {
            height *= MAX_WIDTH / width
            width = MAX_WIDTH
          }
        } else {
          if (height > MAX_HEIGHT) {
            width *= MAX_HEIGHT / height
            height = MAX_HEIGHT
          }
        }

        canvas.width = width
        canvas.height = height
        const ctx = canvas.getContext("2d")
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height)
          const dataUrl = canvas.toDataURL("image/jpeg", 0.8)
          setAvatarPreview(dataUrl)

          if (dataUrl.length <= 500) {
            setAvatar(dataUrl)
            setAvatarNotice("Image compressed and ready to save.")
            toast.success("Image loaded.")
            return
          }

          setAvatarNotice(
            "Preview loaded, but direct image uploads need backend storage. Paste a hosted image URL below to save it publicly.",
          )
          toast.error(
            "Upload preview loaded. Use an image URL to save it for now.",
          )
        }
      }
      img.src = e.target?.result as string
    }
    reader.readAsDataURL(file)
  }

  async function save() {
    if (!profile) return

    const trimmedAvatar = avatar.trim()
    const isAvatarLikeUrl =
      trimmedAvatar.length === 0 ||
      /^https?:\/\//i.test(trimmedAvatar) ||
      /^data:image\//i.test(trimmedAvatar)

    if (!isAvatarLikeUrl) {
      const errMsg = "Avatar must be a hosted image URL."
      setMessage(errMsg)
      toast.error(errMsg)
      return
    }

    if (trimmedAvatar.length > 500) {
      const errMsg =
        "Avatar URL is too long. Use a hosted image link instead of a direct file upload."
      setMessage(errMsg)
      toast.error(errMsg)
      return
    }

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
      setMessage("Profile saved.")
      toast.success("Profile updated successfully!")
    } catch (caught) {
      const errMsg =
        caught instanceof Error ? caught.message : "Unable to save profile."
      setMessage(errMsg)
      toast.error(errMsg)
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <div className="mt-5 grid gap-3">
        <div>
          <label className="block text-xs font-semibold text-ash uppercase tracking-wider mb-1">
            Username
          </label>
          <input
            className="h-11 w-full rounded-[10px] bg-white-surface px-3 text-sm tracking-[-0.18px] text-charcoal-primary shadow-[(--shadow-subtle)] outline-none placeholder:text-ash focus:ring-2 focus:ring-stone-surface"
            disabled={!profile || saving}
            onChange={(event) => setUsername(event.target.value)}
            placeholder="Username"
            value={username}
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-ash uppercase tracking-wider mb-1">
            Display Name
          </label>
          <input
            className="h-11 w-full rounded-[10px] bg-white-surface px-3 text-sm tracking-[-0.18px] text-charcoal-primary shadow-[(--shadow-subtle)] outline-none placeholder:text-ash focus:ring-2 focus:ring-stone-surface"
            disabled={!profile || saving}
            onChange={(event) => setDisplay(event.target.value)}
            placeholder="Display name"
            value={display}
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-ash uppercase tracking-wider mb-1">
            Avatar Picture
          </label>
          <div className="flex items-center gap-4 rounded-[10px] border border-dashed border-border bg-surface-muted p-3">
            {avatarPreview ? (
              <div
                className="h-12 w-12 shrink-0 rounded-[14px] border border-border bg-cover bg-center shadow-[(--shadow-subtle)]"
                style={{ backgroundImage: `url(${avatarPreview})` }}
              />
            ) : (
              <div className="verity-blob h-12 w-12 bg-sky-blue shrink-0">
                <span className="verity-blob-smile scale-75" />
              </div>
            )}
            <div className="flex-1">
              <label className="clickable verity-pill inline-flex h-8 cursor-pointer items-center justify-center gap-2 border border-border bg-white-surface px-3 text-[11px] font-semibold text-charcoal-primary shadow-[(--shadow-subtle)] hover:bg-surface-hover">
                Upload Avatar
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  disabled={!profile || saving}
                  onChange={handleFileChange}
                />
              </label>
              <p className="mt-1 text-[10px] text-ash font-mono">
                Upload previews locally. Hosted URLs save publicly.
              </p>
            </div>
          </div>
          <input
            className="mt-2 h-11 w-full rounded-[10px] bg-white-surface px-3 text-sm tracking-[-0.18px] text-charcoal-primary shadow-[(--shadow-subtle)] outline-none placeholder:text-ash focus:ring-2 focus:ring-stone-surface"
            disabled={!profile || saving}
            onChange={(event) => {
              setAvatar(event.target.value)
              setAvatarPreview(event.target.value)
              setAvatarNotice(null)
            }}
            placeholder="https://example.com/avatar.jpg"
            value={avatar}
          />
          {avatarNotice && (
            <p className="mt-2 text-xs leading-5 text-ash">{avatarNotice}</p>
          )}
        </div>

        <div>
          <label className="block text-xs font-semibold text-ash uppercase tracking-wider mb-1">
            Bio
          </label>
          <textarea
            className="min-h-24 w-full rounded-[10px] bg-white-surface p-3 text-sm tracking-[-0.18px] text-charcoal-primary shadow-[(--shadow-subtle)] outline-none placeholder:text-ash focus:ring-2 focus:ring-stone-surface"
            disabled={!profile || saving}
            onChange={(event) => setBio(event.target.value)}
            placeholder="Bio"
            value={bio}
          />
        </div>
      </div>

      {(message || error || loading) && (
        <p className="mt-3 text-sm text-ash">
          {loading ? "Loading profile..." : message || error}
        </p>
      )}

      <button
        className="verity-pill mt-4 flex h-11 w-full items-center justify-center gap-2 bg-inverse text-sm font-semibold tracking-[-0.18px] text-inverse-text transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
        disabled={!profile || saving}
        onClick={save}
        type="button"
      >
        {saving ? "Saving" : "Save Profile"} <Save className="h-4 w-4" />
      </button>
    </>
  )
}
