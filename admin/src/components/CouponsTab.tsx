import React, { useState, useEffect } from "react"
import { apiRequest } from "@/store/apiClient"
import { toast } from "react-hot-toast"
import { Button } from "@/components/ui/button"
import { Loader2, Plus, Edit2, Trash2 } from "lucide-react"

export default function CouponsTab() {
  const [coupons, setCoupons] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [isCreating, setIsCreating] = useState(false)

  // New Coupon Form State
  const [code, setCode] = useState("")
  const [multiplier, setMultiplier] = useState(1.5)
  const [maxUsesPerUser, setMaxUsesPerUser] = useState(1)
  const [maxTotalUses, setMaxTotalUses] = useState<number | "">("")

  async function fetchCoupons() {
    setLoading(true)
    try {
      const data = await apiRequest<any[]>("/coupons")
      setCoupons(data)
    } catch (err: any) {
      toast.error(err.message || "Failed to load coupons.")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void fetchCoupons()
  }, [])

  async function handleCreateCoupon(e: React.FormEvent) {
    e.preventDefault()
    try {
      const payload: any = {
        code: code.trim(),
        multiplier: Number(multiplier),
        maxUsesPerUser: Number(maxUsesPerUser),
      }
      if (maxTotalUses !== "") {
        payload.maxTotalUses = Number(maxTotalUses)
      }

      await apiRequest("/coupons", {
        method: "POST",
        body: JSON.stringify(payload),
        headers: { "Content-Type": "application/json" },
      })
      toast.success("Coupon created successfully!")
      setIsCreating(false)
      setCode("")
      setMultiplier(1.5)
      setMaxUsesPerUser(1)
      setMaxTotalUses("")
      void fetchCoupons()
    } catch (err: any) {
      toast.error(err.message || "Failed to create coupon.")
    }
  }

  async function toggleActive(id: string, currentStatus: boolean) {
    try {
      await apiRequest(`/coupons/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ isActive: !currentStatus }),
        headers: { "Content-Type": "application/json" },
      })
      toast.success(`Coupon ${!currentStatus ? "activated" : "deactivated"}!`)
      void fetchCoupons()
    } catch (err: any) {
      toast.error(err.message || "Failed to update coupon status.")
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold font-sans text-stone-900 leading-tight">
            Coupon Management
          </h2>
          <p className="text-sm text-stone-500 font-sans mt-1 max-w-xl">
            Create and manage promotional codes that grant XP multipliers to users when submitting predictions.
          </p>
        </div>
        <Button
          onClick={() => setIsCreating(!isCreating)}
          className="gap-2 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold"
        >
          <Plus className="w-4 h-4" />
          Create Coupon
        </Button>
      </div>

      {isCreating && (
        <form onSubmit={handleCreateCoupon} className="bg-white border border-stone-200 rounded-xl p-6 shadow-sm flex flex-col gap-4">
          <h3 className="font-bold text-stone-900">New Coupon Details</h3>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold font-mono text-stone-500 uppercase tracking-wider">
                Code
              </label>
              <input
                required
                type="text"
                placeholder="e.g. SUMMER24"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                className="h-10 px-3 border border-stone-200 rounded-lg outline-none focus:border-indigo-500 text-sm font-semibold text-stone-900"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold font-mono text-stone-500 uppercase tracking-wider">
                Multiplier
              </label>
              <input
                required
                type="number"
                step="0.1"
                min="1.0"
                value={multiplier}
                onChange={(e) => setMultiplier(parseFloat(e.target.value))}
                className="h-10 px-3 border border-stone-200 rounded-lg outline-none focus:border-indigo-500 text-sm font-semibold text-stone-900"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold font-mono text-stone-500 uppercase tracking-wider">
                Max Uses / User
              </label>
              <input
                required
                type="number"
                min="1"
                value={maxUsesPerUser}
                onChange={(e) => setMaxUsesPerUser(parseInt(e.target.value))}
                className="h-10 px-3 border border-stone-200 rounded-lg outline-none focus:border-indigo-500 text-sm font-semibold text-stone-900"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold font-mono text-stone-500 uppercase tracking-wider">
                Max Total Uses
              </label>
              <input
                type="number"
                min="1"
                placeholder="Unlimited"
                value={maxTotalUses}
                onChange={(e) => setMaxTotalUses(e.target.value ? parseInt(e.target.value) : "")}
                className="h-10 px-3 border border-stone-200 rounded-lg outline-none focus:border-indigo-500 text-sm font-semibold text-stone-900"
              />
            </div>
          </div>
          <div className="flex justify-end pt-2 border-t border-stone-100 mt-2">
            <Button type="button" variant="ghost" onClick={() => setIsCreating(false)} className="mr-2">Cancel</Button>
            <Button type="submit" className="bg-indigo-600 hover:bg-indigo-500 text-white font-semibold">Save Coupon</Button>
          </div>
        </form>
      )}

      {loading ? (
        <div className="flex justify-center p-10"><Loader2 className="animate-spin text-indigo-500 w-8 h-8" /></div>
      ) : (
        <div className="bg-white border border-stone-200 rounded-xl overflow-hidden shadow-sm">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-stone-50 text-stone-500 font-mono text-[10px] uppercase tracking-wider border-b border-stone-200">
              <tr>
                <th className="px-6 py-4 font-bold">Code</th>
                <th className="px-6 py-4 font-bold">Multiplier</th>
                <th className="px-6 py-4 font-bold">Uses / Max Total</th>
                <th className="px-6 py-4 font-bold">Max Per User</th>
                <th className="px-6 py-4 font-bold">Status</th>
                <th className="px-6 py-4 font-bold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {coupons.map((coupon) => (
                <tr key={coupon._id} className="hover:bg-stone-50/50 transition-colors">
                  <td className="px-6 py-4 font-bold text-stone-900 font-mono">{coupon.code}</td>
                  <td className="px-6 py-4 font-semibold text-indigo-600">{coupon.multiplier}x</td>
                  <td className="px-6 py-4 font-medium text-stone-600">
                    {coupon.currentTotalUses} / {coupon.maxTotalUses || "∞"}
                  </td>
                  <td className="px-6 py-4 font-medium text-stone-600">{coupon.maxUsesPerUser}</td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center px-2 py-1 rounded-md text-xs font-bold uppercase tracking-wide ${coupon.isActive ? 'bg-emerald-100 text-emerald-700' : 'bg-stone-100 text-stone-500'}`}>
                      {coupon.isActive ? "Active" : "Disabled"}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => toggleActive(coupon._id, coupon.isActive)}
                      className="text-xs font-semibold"
                    >
                      {coupon.isActive ? "Disable" : "Enable"}
                    </Button>
                  </td>
                </tr>
              ))}
              {coupons.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-stone-500 font-medium">
                    No coupons found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
