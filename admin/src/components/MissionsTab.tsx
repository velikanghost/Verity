"use client"

import { useState, useEffect } from "react"
import { apiRequest } from "@/store/apiClient"
import { toast } from "react-hot-toast"
import { Button } from "@/components/ui/button"
import {
  Sparkles,
  RefreshCw,
  Plus,
  Trash2,
  Edit2,
  Save,
  X,
  Check,
  Power,
} from "lucide-react"

interface Mission {
  id: string
  title: string
  xpReward: number
  actionUrl: string
  isActive: boolean
  missionType: "social" | "activity"
  verificationKey?: string | null
  rewardMultiplier?: number | null
  rewardMatchesCount?: number | null
}

export default function MissionsTab() {
  const [missions, setMissions] = useState<Mission[]>([])
  const [loading, setLoading] = useState(false)
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  // Creation form states
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [title, setTitle] = useState("")
  const [xpReward, setXpReward] = useState("100")
  const [actionUrl, setActionUrl] = useState("")
  const [missionType, setMissionType] = useState<"social" | "activity">("social")
  const [verificationKey, setVerificationKey] = useState("")
  const [rewardMultiplier, setRewardMultiplier] = useState("")
  const [rewardMatchesCount, setRewardMatchesCount] = useState("")

  // Editing states
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editTitle, setEditTitle] = useState("")
  const [editXpReward, setEditXpReward] = useState("")
  const [editActionUrl, setEditActionUrl] = useState("")
  const [editMissionType, setEditMissionType] = useState<"social" | "activity">("social")
  const [editVerificationKey, setEditVerificationKey] = useState("")
  const [editRewardMultiplier, setEditRewardMultiplier] = useState("")
  const [editRewardMatchesCount, setEditRewardMatchesCount] = useState("")

  // Fetch all missions for admin management
  async function fetchMissions() {
    setLoading(true)
    try {
      const data = await apiRequest<any[]>("/missions/admin")
      setMissions(data)
    } catch (err: any) {
      toast.error(err.message || "Failed to load missions.")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void fetchMissions()
  }, [])

  // Create new mission
  async function handleCreateMission(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim() || !actionUrl.trim()) {
      toast.error("Please fill in title and action URL.")
      return
    }

    const reward = xpReward.trim() ? parseInt(xpReward, 10) : 0
    if (isNaN(reward) || reward < 0) {
      toast.error("XP Reward must be a non-negative number.")
      return
    }

    const mult = rewardMultiplier.trim() ? parseFloat(rewardMultiplier) : null
    const matches = rewardMatchesCount.trim() ? parseInt(rewardMatchesCount, 10) : null

    if (reward > 0 && (mult !== null || matches !== null)) {
      toast.error("A mission cannot have both an XP reward and a Multiplier boost reward.")
      return
    }

    if (reward === 0 && mult === null && matches === null) {
      toast.error("A mission must have either an XP reward (> 0) or a Multiplier boost reward.")
      return
    }

    if ((mult !== null && matches === null) || (mult === null && matches !== null)) {
      toast.error("Both Reward Multiplier and Matches Count must be set, or both left empty.")
      return
    }

    if (mult !== null && (isNaN(mult) || mult < 1.0)) {
      toast.error("Reward Multiplier must be at least 1.0.")
      return
    }

    if (matches !== null && (isNaN(matches) || matches <= 0)) {
      toast.error("Reward Matches Count must be a positive integer.")
      return
    }

    setActionLoading("create")
    try {
      await apiRequest("/missions", {
        method: "POST",
        body: JSON.stringify({
          title: title.trim(),
          xpReward: reward > 0 ? reward : null,
          actionUrl: actionUrl.trim(),
          missionType,
          verificationKey: verificationKey || null,
          rewardMultiplier: mult,
          rewardMatchesCount: matches,
        }),
      })

      toast.success("Mission created successfully!")
      setTitle("")
      setXpReward("100")
      setActionUrl("")
      setMissionType("social")
      setVerificationKey("")
      setRewardMultiplier("")
      setRewardMatchesCount("")
      setShowCreateForm(false)
      void fetchMissions()
    } catch (err: any) {
      toast.error(err.message || "Failed to create mission.")
    } finally {
      setActionLoading(null)
    }
  }

  // Toggle mission active status
  async function handleToggleActive(mission: Mission) {
    const nextStatus = !mission.isActive
    setActionLoading(`toggle-${mission.id}`)
    try {
      await apiRequest(`/missions/${mission.id}`, {
        method: "PUT",
        body: JSON.stringify({ isActive: nextStatus }),
      })
      toast.success(`Mission is now ${nextStatus ? "active" : "inactive"}.`)
      void fetchMissions()
    } catch (err: any) {
      toast.error(err.message || "Failed to toggle status.")
    } finally {
      setActionLoading(null)
    }
  }

  // Delete mission
  async function handleDeleteMission(id: string) {
    if (!confirm("Are you sure you want to permanently delete this mission?")) {
      return
    }
    setActionLoading(`delete-${id}`)
    try {
      await apiRequest(`/missions/${id}`, {
        method: "DELETE",
      })
      toast.success("Mission deleted successfully.")
      void fetchMissions()
    } catch (err: any) {
      toast.error(err.message || "Failed to delete mission.")
    } finally {
      setActionLoading(null)
    }
  }

  // Edit mission start
  function startEditing(mission: Mission) {
    setEditingId(mission.id)
    setEditTitle(mission.title)
    setEditXpReward(mission.xpReward ? mission.xpReward.toString() : "")
    setEditActionUrl(mission.actionUrl)
    setEditMissionType(mission.missionType || "social")
    setEditVerificationKey(mission.verificationKey || "")
    setEditRewardMultiplier(mission.rewardMultiplier ? mission.rewardMultiplier.toString() : "")
    setEditRewardMatchesCount(mission.rewardMatchesCount ? mission.rewardMatchesCount.toString() : "")
  }

  // Save edited mission
  async function handleSaveEdit(id: string) {
    const reward = editXpReward.trim() ? parseInt(editXpReward, 10) : 0
    if (isNaN(reward) || reward < 0) {
      toast.error("XP Reward must be a non-negative number.")
      return
    }

    const mult = editRewardMultiplier.trim() ? parseFloat(editRewardMultiplier) : null
    const matches = editRewardMatchesCount.trim() ? parseInt(editRewardMatchesCount, 10) : null

    if (reward > 0 && (mult !== null || matches !== null)) {
      toast.error("A mission cannot have both an XP reward and a Multiplier boost reward.")
      return
    }

    if (reward === 0 && mult === null && matches === null) {
      toast.error("A mission must have either an XP reward (> 0) or a Multiplier boost reward.")
      return
    }

    if ((mult !== null && matches === null) || (mult === null && matches !== null)) {
      toast.error("Both Reward Multiplier and Matches Count must be set, or both left empty.")
      return
    }

    if (mult !== null && (isNaN(mult) || mult < 1.0)) {
      toast.error("Reward Multiplier must be at least 1.0.")
      return
    }

    if (matches !== null && (isNaN(matches) || matches <= 0)) {
      toast.error("Reward Matches Count must be a positive integer.")
      return
    }

    setActionLoading(`edit-${id}`)
    try {
      await apiRequest(`/missions/${id}`, {
        method: "PUT",
        body: JSON.stringify({
          title: editTitle.trim(),
          xpReward: reward > 0 ? reward : null,
          actionUrl: editActionUrl.trim(),
          missionType: editMissionType,
          verificationKey: editVerificationKey || null,
          rewardMultiplier: mult,
          rewardMatchesCount: matches,
        }),
      })
      toast.success("Mission updated successfully!")
      setEditingId(null)
      void fetchMissions()
    } catch (err: any) {
      toast.error(err.message || "Failed to save updates.")
    } finally {
      setActionLoading(null)
    }
  }

  return (
    <div className="verity-card bg-white border border-stone-200 shadow-xs overflow-hidden flex flex-col p-6 gap-6">
      {/* Header Row */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-stone-100 pb-5">
        <div>
          <h3 className="text-base font-bold text-stone-900 flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-indigo-600" />
            XP Mission Management
          </h3>
          <p className="text-xs text-stone-500 mt-0.5">
            Create and manage social and onboarding missions to incentivize user engagement with custom XP rewards.
          </p>
        </div>

        <div className="flex items-center gap-2 self-stretch sm:self-auto justify-end">
          <Button
            onClick={() => setShowCreateForm(!showCreateForm)}
            className="h-9 px-4 rounded-lg text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white cursor-pointer shadow-xs flex items-center gap-1.5"
          >
            <Plus className="h-4 w-4" />
            {showCreateForm ? "Cancel" : "Create Mission"}
          </Button>

          <button
            onClick={fetchMissions}
            disabled={loading}
            className="h-9 w-9 rounded-lg hover:bg-stone-100 bg-white border border-stone-200 flex items-center justify-center text-stone-500 hover:text-stone-950 transition-colors shadow-2xs cursor-pointer"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {/* Create Mission Form Panel */}
      {showCreateForm && (
        <form
          onSubmit={handleCreateMission}
          className="bg-stone-50 p-5 rounded-2xl border border-stone-200/60 flex flex-col gap-4 w-full"
        >
          <h4 className="text-sm font-bold text-stone-900">New XP Mission</h4>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-stone-600">Title</label>
              <input
                type="text"
                placeholder="e.g. Follow us on Twitter"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
                className="h-9 px-3 border border-stone-200 bg-white text-xs rounded-lg outline-none focus:border-indigo-500"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-stone-600">XP Reward</label>
              <input
                type="number"
                min="0"
                placeholder="Optional if boost reward is set"
                value={xpReward}
                onChange={(e) => {
                  const val = e.target.value
                  setXpReward(val)
                  if (val.trim() && parseInt(val, 10) > 0) {
                    setRewardMultiplier("")
                    setRewardMatchesCount("")
                  }
                }}
                className="h-9 px-3 border border-stone-200 bg-white text-xs rounded-lg outline-none focus:border-indigo-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-stone-600">Mission Type</label>
              <select
                value={missionType}
                onChange={(e) => {
                  const val = e.target.value as "social" | "activity"
                  setMissionType(val)
                  setVerificationKey("")
                }}
                className="h-9 px-3 border border-stone-200 bg-white text-xs rounded-lg outline-none focus:border-indigo-500"
              >
                <option value="social">Social (Twitter/Timer)</option>
                <option value="activity">On-Platform Activity</option>
              </select>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-stone-600">Verification Key</label>
              <select
                value={verificationKey}
                onChange={(e) => setVerificationKey(e.target.value)}
                className="h-9 px-3 border border-stone-200 bg-white text-xs rounded-lg outline-none focus:border-indigo-500"
              >
                {missionType === "social" ? (
                  <>
                    <option value="">None (3s Timer Verification)</option>
                    <option value="twitter_follow">twitter_follow (Check Follow)</option>
                    <option value="twitter_retweet">twitter_retweet (Check Retweet)</option>
                  </>
                ) : (
                  <>
                    <option value="">Select activity key...</option>
                    <option value="has_voted">has_voted (Placed Vote)</option>
                    <option value="has_commented">has_commented (Posted Comment)</option>
                    <option value="has_liked">has_liked (Liked Post)</option>
                    <option value="has_traded">has_traded (Traded Share)</option>
                    <option value="has_added_liquidity">has_added_liquidity (Added LP)</option>
                    <option value="has_created_market">has_created_market (Created Market)</option>
                    <option value="has_set_profile">has_set_profile (Completed Onboarding)</option>
                  </>
                )}
              </select>
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-stone-600">Action URL</label>
            <input
              type="text"
              placeholder="e.g. /markets or https://x.com/verity"
              value={actionUrl}
              onChange={(e) => setActionUrl(e.target.value)}
              required
              className="h-9 px-3 border border-stone-200 bg-white text-xs rounded-lg outline-none focus:border-indigo-500"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-stone-600">Reward Multiplier (XP Boost, e.g. 1.5)</label>
              <input
                type="number"
                step="0.1"
                min="1.0"
                placeholder="Optional (e.g. 1.5)"
                value={rewardMultiplier}
                onChange={(e) => {
                  const val = e.target.value
                  setRewardMultiplier(val)
                  if (val.trim()) {
                    setXpReward("0")
                  }
                }}
                className="h-9 px-3 border border-stone-200 bg-white text-xs rounded-lg outline-none focus:border-indigo-500"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-stone-600">Matches Count (Boost Duration)</label>
              <input
                type="number"
                min="1"
                placeholder="Optional (e.g. 3)"
                value={rewardMatchesCount}
                onChange={(e) => {
                  const val = e.target.value
                  setRewardMatchesCount(val)
                  if (val.trim()) {
                    setXpReward("0")
                  }
                }}
                className="h-9 px-3 border border-stone-200 bg-white text-xs rounded-lg outline-none focus:border-indigo-500"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="submit"
              disabled={actionLoading === "create"}
              className="h-9 px-4 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold"
            >
              {actionLoading === "create" ? "Creating..." : "Save Mission"}
            </Button>
          </div>
        </form>
      )}

      {/* Missions Listing Table */}
      {loading && missions.length === 0 ? (
        <div className="text-center py-12 text-sm text-stone-400 animate-pulse">
          Loading missions...
        </div>
      ) : missions.length === 0 ? (
        <div className="text-center py-12 text-sm text-stone-400">
          No missions configured. Click "Create Mission" above to add one.
        </div>
      ) : (
        <div className="overflow-x-auto border border-stone-200 rounded-xl">
          <table className="w-full border-collapse text-left text-xs">
            <thead>
              <tr className="border-b border-stone-200 bg-stone-50 text-stone-500 font-bold uppercase tracking-wider text-[10px]">
                <th className="p-4 w-[250px]">Mission</th>
                <th className="p-4 w-[200px]">Reward</th>
                <th className="p-4 w-[100px]">Status</th>
                <th className="p-4 text-right w-[180px]">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {missions.map((mission) => {
                const isEditing = editingId === mission.id
                const isActionPending = actionLoading?.includes(mission.id)

                return (
                  <tr
                    key={mission.id}
                    className="hover:bg-stone-50/50 transition-colors"
                  >
                    {/* Mission details / Editor */}
                    <td className="p-4 align-top">
                      {isEditing ? (
                        <div className="flex flex-col gap-2">
                          <input
                            type="text"
                            value={editTitle}
                            onChange={(e) => setEditTitle(e.target.value)}
                            className="h-8 px-2 border border-stone-250 bg-white text-xs font-semibold rounded-md outline-none focus:border-indigo-500"
                          />
                          <input
                            type="text"
                            value={editActionUrl}
                            onChange={(e) => setEditActionUrl(e.target.value)}
                            className="h-8 px-2 border border-stone-250 bg-white text-xs font-mono rounded-md outline-none focus:border-indigo-500"
                          />
                          <div className="grid grid-cols-2 gap-2 mt-1">
                            <select
                              value={editMissionType}
                              onChange={(e) => {
                                const val = e.target.value as "social" | "activity"
                                setEditMissionType(val)
                                setEditVerificationKey("")
                              }}
                              className="h-8 px-2 border border-stone-250 bg-white text-[10px] rounded-md outline-none focus:border-indigo-500"
                            >
                              <option value="social">Social</option>
                              <option value="activity">Activity</option>
                            </select>
                            <select
                              value={editVerificationKey}
                              onChange={(e) => setEditVerificationKey(e.target.value)}
                              className="h-8 px-2 border border-stone-250 bg-white text-[10px] rounded-md outline-none focus:border-indigo-500"
                            >
                              {editMissionType === "social" ? (
                                <>
                                  <option value="">None (Timer)</option>
                                  <option value="twitter_follow">twitter_follow</option>
                                  <option value="twitter_retweet">twitter_retweet</option>
                                </>
                              ) : (
                                <>
                                  <option value="">None</option>
                                  <option value="has_voted">has_voted</option>
                                  <option value="has_commented">has_commented</option>
                                  <option value="has_liked">has_liked</option>
                                  <option value="has_traded">has_traded</option>
                                  <option value="has_added_liquidity">has_added_liquidity</option>
                                  <option value="has_created_market">has_created_market</option>
                                  <option value="has_set_profile">has_set_profile</option>
                                </>
                              )}
                            </select>
                          </div>
                        </div>
                      ) : (
                        <div>
                          <span className="block font-bold text-stone-900 text-sm leading-snug">
                            {mission.title}
                          </span>
                          <span className="text-[10px] text-indigo-600 block mt-1 font-mono truncate max-w-[200px]">
                            {mission.actionUrl}
                          </span>
                          <span className="inline-flex gap-1.5 mt-1.5">
                            <span className="px-1.5 py-0.5 rounded-sm text-[9px] font-bold uppercase bg-stone-100 text-stone-600 border border-stone-200">
                              {mission.missionType || "social"}
                            </span>
                            {mission.verificationKey && (
                              <span className="px-1.5 py-0.5 rounded-sm text-[9px] font-mono bg-indigo-50 border border-indigo-100 text-indigo-600">
                                {mission.verificationKey}
                              </span>
                            )}
                          </span>
                        </div>
                      )}
                    </td>

                    {/* Reward Column */}
                    <td className="p-4 align-top">
                      {isEditing ? (
                        <div className="flex flex-col gap-2 min-w-[160px]">
                          <div className="flex flex-col gap-0.5">
                            <span className="text-[9px] font-bold text-stone-500">XP Reward</span>
                            <input
                              type="number"
                              value={editXpReward}
                              placeholder="e.g. 100"
                              onChange={(e) => {
                                const val = e.target.value
                                setEditXpReward(val)
                                if (val.trim() && parseInt(val, 10) > 0) {
                                  setEditRewardMultiplier("")
                                  setEditRewardMatchesCount("")
                                }
                              }}
                              className="h-8 w-full px-2 border border-stone-250 bg-white text-xs rounded-md outline-none focus:border-indigo-500"
                            />
                          </div>
                          <div className="flex flex-col gap-0.5">
                            <span className="text-[9px] font-bold text-stone-500">Boost Reward</span>
                            <div className="grid grid-cols-2 gap-1.5">
                              <input
                                type="number"
                                step="0.1"
                                min="1.0"
                                placeholder="Multiplier"
                                value={editRewardMultiplier}
                                onChange={(e) => {
                                  const val = e.target.value
                                  setEditRewardMultiplier(val)
                                  if (val.trim()) {
                                    setEditXpReward("")
                                  }
                                }}
                                className="h-8 w-full px-2 border border-stone-250 bg-white text-[10px] rounded-md outline-none focus:border-indigo-500"
                              />
                              <input
                                type="number"
                                min="1"
                                placeholder="Matches"
                                value={editRewardMatchesCount}
                                onChange={(e) => {
                                  const val = e.target.value
                                  setEditRewardMatchesCount(val)
                                  if (val.trim()) {
                                    setEditXpReward("")
                                  }
                                }}
                                className="h-8 w-full px-2 border border-stone-250 bg-white text-[10px] rounded-md outline-none focus:border-indigo-500"
                              />
                            </div>
                          </div>
                        </div>
                      ) : (
                        mission.xpReward && mission.xpReward > 0 ? (
                          <span className="font-mono font-bold text-amber-600 text-sm">
                            +{mission.xpReward} XP
                          </span>
                        ) : mission.rewardMultiplier && mission.rewardMatchesCount ? (
                          <span className="inline-flex px-1.5 py-0.5 rounded-sm text-[9px] font-bold bg-amber-50 border border-amber-100 text-amber-700">
                            {mission.rewardMultiplier}x boost ({mission.rewardMatchesCount} matches)
                          </span>
                        ) : (
                          <span className="text-stone-400 font-bold">-</span>
                        )
                      )}
                    </td>

                    {/* Status */}
                    <td className="p-4 align-top">
                      <span
                        className={`inline-flex px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                          mission.isActive
                            ? "bg-emerald-50 text-emerald-700 border border-emerald-100"
                            : "bg-stone-100 text-stone-500 border border-stone-200"
                        }`}
                      >
                        {mission.isActive ? "Active" : "Inactive"}
                      </span>
                    </td>

                    {/* Actions */}
                    <td className="p-4 text-right align-top">
                      <div className="flex items-center justify-end gap-1.5">
                        {isEditing ? (
                          <>
                            <button
                              onClick={() => handleSaveEdit(mission.id)}
                              disabled={isActionPending}
                              className="h-8 w-8 rounded-lg hover:bg-emerald-50 hover:text-emerald-700 bg-white border border-stone-200 flex items-center justify-center text-stone-500 transition-colors cursor-pointer"
                              title="Save Changes"
                            >
                              <Save className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => setEditingId(null)}
                              className="h-8 w-8 rounded-lg hover:bg-stone-150 bg-white border border-stone-200 flex items-center justify-center text-stone-500 hover:text-stone-900 transition-colors cursor-pointer"
                              title="Cancel Edit"
                            >
                              <X className="h-4 w-4" />
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              onClick={() => handleToggleActive(mission)}
                              disabled={isActionPending}
                              className={`h-8 w-8 rounded-lg border flex items-center justify-center transition-colors cursor-pointer ${
                                mission.isActive
                                  ? "hover:bg-amber-50 hover:text-amber-600 hover:border-amber-200 border-stone-200 text-stone-500"
                                  : "hover:bg-emerald-50 hover:text-emerald-600 hover:border-emerald-200 border-stone-200 text-stone-500"
                              }`}
                              title={mission.isActive ? "Deactivate" : "Activate"}
                            >
                              <Power className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => startEditing(mission)}
                              disabled={isActionPending}
                              className="h-8 w-8 rounded-lg hover:bg-stone-100 bg-white border border-stone-200 flex items-center justify-center text-stone-500 hover:text-stone-950 transition-colors cursor-pointer"
                              title="Edit Mission"
                            >
                              <Edit2 className="h-3.5 w-3.5" />
                            </button>
                            <button
                              onClick={() => handleDeleteMission(mission.id)}
                              disabled={isActionPending}
                              className="h-8 w-8 rounded-lg hover:bg-red-50 hover:text-red-600 hover:border-red-200 bg-white border border-stone-200 flex items-center justify-center text-stone-500 transition-colors cursor-pointer"
                              title="Delete Mission"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

