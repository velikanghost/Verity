import React, { useState, useEffect } from "react"
import { apiRequest } from "@/store/apiClient"
import { toast } from "react-hot-toast"
import { Button } from "@/components/ui/button"
import { Loader2, Plus, FolderOpen } from "lucide-react"

interface Category {
  _id: string
  slug: string
  displayName: string
  isActive: boolean
  createdAt?: string
}

export default function CategoriesTab() {
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(false)
  const [isCreating, setIsCreating] = useState(false)

  // New Category Form State
  const [slug, setSlug] = useState("")
  const [displayName, setDisplayName] = useState("")

  async function fetchCategories() {
    setLoading(true)
    try {
      const data = await apiRequest<Category[]>("/categories/admin")
      setCategories(data)
    } catch (err: any) {
      toast.error(err.message || "Failed to load categories.")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void fetchCategories()
  }, [])

  async function handleCreateCategory(e: React.FormEvent) {
    e.preventDefault()
    try {
      const payload = {
        slug: slug.trim().toLowerCase(),
        displayName: displayName.trim(),
      }

      await apiRequest("/categories", {
        method: "POST",
        body: JSON.stringify(payload),
        headers: { "Content-Type": "application/json" },
      })
      toast.success("Category created successfully!")
      setIsCreating(false)
      setSlug("")
      setDisplayName("")
      void fetchCategories()
    } catch (err: any) {
      toast.error(err.message || "Failed to create category.")
    }
  }

  async function toggleActive(id: string, currentStatus: boolean) {
    try {
      await apiRequest(`/categories/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ isActive: !currentStatus }),
        headers: { "Content-Type": "application/json" },
      })
      toast.success(`Category ${!currentStatus ? "activated" : "deactivated"}!`)
      void fetchCategories()
    } catch (err: any) {
      toast.error(err.message || "Failed to update category status.")
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold font-sans text-stone-900 leading-tight">
            Category Management
          </h2>
          <p className="text-sm text-stone-500 font-sans mt-1 max-w-xl">
            Create and manage categories that group prediction events, coupons, and missions.
          </p>
        </div>
        <Button
          onClick={() => setIsCreating(!isCreating)}
          className="gap-2 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold"
        >
          <Plus className="w-4 h-4" />
          Create Category
        </Button>
      </div>

      {isCreating && (
        <form onSubmit={handleCreateCategory} className="bg-white border border-stone-200 rounded-xl p-6 shadow-sm flex flex-col gap-4">
          <h3 className="font-bold text-stone-900">New Category Details</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold font-mono text-stone-500 uppercase tracking-wider">
                Slug (Unique Identifier)
              </label>
              <input
                required
                type="text"
                placeholder="e.g. sports, politics, crypto"
                value={slug}
                onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-_]/g, ""))}
                className="h-10 px-3 border border-stone-200 rounded-lg outline-none focus:border-indigo-500 text-sm font-semibold text-stone-900"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold font-mono text-stone-500 uppercase tracking-wider">
                Display Name
              </label>
              <input
                required
                type="text"
                placeholder="e.g. Sports, Politics, Crypto"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="h-10 px-3 border border-stone-200 rounded-lg outline-none focus:border-indigo-500 text-sm font-semibold text-stone-900"
              />
            </div>
          </div>
          <div className="flex justify-end pt-2 border-t border-stone-100 mt-2">
            <Button type="button" variant="ghost" onClick={() => setIsCreating(false)} className="mr-2">Cancel</Button>
            <Button type="submit" className="bg-indigo-600 hover:bg-indigo-500 text-white font-semibold">Save Category</Button>
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
                <th className="px-6 py-4 font-bold">Slug</th>
                <th className="px-6 py-4 font-bold">Display Name</th>
                <th className="px-6 py-4 font-bold">Status</th>
                <th className="px-6 py-4 font-bold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {categories.map((category) => (
                <tr key={category._id} className="hover:bg-stone-50/50 transition-colors">
                  <td className="px-6 py-4 font-bold text-stone-900 font-mono">{category.slug}</td>
                  <td className="px-6 py-4 font-semibold text-indigo-600">{category.displayName}</td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center px-2 py-1 rounded-md text-xs font-bold uppercase tracking-wide ${category.isActive ? 'bg-emerald-100 text-emerald-700' : 'bg-stone-100 text-stone-500'}`}>
                      {category.isActive ? "Active" : "Disabled"}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => toggleActive(category._id, category.isActive)}
                      className="text-xs font-semibold"
                    >
                      {category.isActive ? "Disable" : "Enable"}
                    </Button>
                  </td>
                </tr>
              ))}
              {categories.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-6 py-8 text-center text-stone-500 font-medium">
                    No categories found.
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
