"use client"

import { useState, useEffect } from "react"
import { Input } from "@/components/ui/input"
import {
  Shield, Plus, Trash2, Edit2, Check, X, ChevronLeft,
  Loader2, Lock, Unlock, Zap, StickyNote
} from "lucide-react"

interface AdminAccount {
  id: number
  email: string
  canAccessAdmin: boolean
  concurrencyLimit: number | null
  notes: string | null
  addedAt: string
}

function useAdminAuth() {
  const [state, setState] = useState<{ ok: boolean | null; password: string }>({ ok: null, password: "" })
  useEffect(() => {
    const auth = localStorage.getItem("multiverse-admin-auth")
    const pass = sessionStorage.getItem("admin-password") || ""
    setState({ ok: auth === "true" && !!pass, password: pass })
  }, [])
  return state
}

export default function AdminAccountsPage() {
  const { ok: authed, password: adminPassword } = useAdminAuth()
  const [accounts, setAccounts] = useState<AdminAccount[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")

  const [newEmail, setNewEmail] = useState("")
  const [newCanAccess, setNewCanAccess] = useState(true)
  const [newConcurrency, setNewConcurrency] = useState("")
  const [newNotes, setNewNotes] = useState("")

  // Inline edit state
  const [editValues, setEditValues] = useState<Record<number, {
    canAccessAdmin: boolean
    concurrencyLimit: string
    notes: string
  }>>({})

  useEffect(() => {
    if (authed) fetchAccounts()
  }, [authed])

  const authHeaders = () => ({
    "Content-Type": "application/json",
    "x-admin-password": adminPassword,
  })

  const fetchAccounts = async () => {
    setLoading(true)
    try {
      const res = await fetch("/api/admin/accounts", { headers: { "x-admin-password": adminPassword } })
      if (res.ok) setAccounts(await res.json())
    } finally {
      setLoading(false)
    }
  }

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setSaving(true)
    try {
      const res = await fetch("/api/admin/accounts", {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({
          email: newEmail,
          canAccessAdmin: newCanAccess,
          concurrencyLimit: newConcurrency ? parseInt(newConcurrency) : null,
          notes: newNotes || null,
        }),
      })
      const data = await res.json()
      if (res.ok) {
        setNewEmail(""); setNewCanAccess(true); setNewConcurrency(""); setNewNotes("")
        setShowForm(false)
        await fetchAccounts()
      } else {
        setError(data.error || "Failed to add account")
      }
    } finally {
      setSaving(false)
    }
  }

  const startEdit = (account: AdminAccount) => {
    setEditingId(account.id)
    setEditValues(prev => ({
      ...prev,
      [account.id]: {
        canAccessAdmin: account.canAccessAdmin,
        concurrencyLimit: account.concurrencyLimit?.toString() ?? "",
        notes: account.notes ?? "",
      }
    }))
  }

  const cancelEdit = () => setEditingId(null)

  const saveEdit = async (id: number) => {
    setSaving(true)
    const vals = editValues[id]
    try {
      const res = await fetch("/api/admin/accounts", {
        method: "PUT",
        headers: authHeaders(),
        body: JSON.stringify({
          id,
          canAccessAdmin: vals.canAccessAdmin,
          concurrencyLimit: vals.concurrencyLimit || null,
          notes: vals.notes || null,
        }),
      })
      if (res.ok) {
        setEditingId(null)
        await fetchAccounts()
      }
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: number, email: string) => {
    if (!confirm(`Remove ${email} from admin accounts?`)) return
    const res = await fetch(`/api/admin/accounts?id=${id}`, { method: "DELETE", headers: { "x-admin-password": adminPassword } })
    const data = await res.json()
    if (res.ok) {
      await fetchAccounts()
    } else {
      alert(data.error || "Failed to remove account")
    }
  }

  if (authed === null) {
    return (
      <div className="min-h-screen bg-[#09090f] flex items-center justify-center">
        <Loader2 size={20} className="text-slate-600 animate-spin" />
      </div>
    )
  }

  if (!authed) {
    return (
      <div className="min-h-screen bg-[#09090f] flex items-center justify-center p-6">
        <div className="text-center">
          <p className="text-slate-400 mb-4">Admin authentication required.</p>
          <button onClick={() => window.location.href = "/admin"}
            className="text-sm text-cyan-400 hover:underline">Go to Admin Login</button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#09090f] relative">
      <div className="fixed top-0 left-1/2 -translate-x-1/2 w-[500px] h-[250px] bg-cyan-500/[0.03] rounded-full blur-3xl pointer-events-none" />

      <div className="relative z-10 max-w-2xl mx-auto px-5 py-8">

        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <button
              onClick={() => window.location.href = "/admin"}
              className="w-8 h-8 rounded-lg bg-white/[0.04] border border-white/[0.07] flex items-center justify-center hover:bg-white/[0.07] transition-colors text-slate-400 hover:text-white"
            >
              <ChevronLeft size={15} />
            </button>
            <div className="w-9 h-9 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center">
              <Shield size={16} className="text-cyan-400" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-white leading-none">Admin Accounts</h1>
              <p className="text-[11px] text-slate-600 mt-0.5">Manage access & permissions</p>
            </div>
          </div>
          <button
            onClick={() => { setShowForm(!showForm); setError("") }}
            className="flex items-center gap-1.5 text-xs font-bold px-3 py-2 rounded-lg bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 hover:bg-cyan-500/20 transition-colors"
          >
            <Plus size={13} /> Add Account
          </button>
        </div>

        {/* Add form */}
        {showForm && (
          <form onSubmit={handleAdd} className="mb-6 p-4 rounded-xl border border-white/[0.08] bg-white/[0.03] space-y-3">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">New Admin Account</p>
            <Input
              type="email"
              placeholder="email@example.com"
              value={newEmail}
              onChange={e => setNewEmail(e.target.value)}
              required
              className="bg-white/[0.04] border-white/10 text-white placeholder:text-slate-600 h-9 text-sm"
            />
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] text-slate-500 mb-1 block">Concurrency limit</label>
                <Input
                  type="number"
                  placeholder="null = default"
                  value={newConcurrency}
                  onChange={e => setNewConcurrency(e.target.value)}
                  min={1}
                  className="bg-white/[0.04] border-white/10 text-white placeholder:text-slate-600 h-9 text-sm"
                />
              </div>
              <div className="flex items-end pb-1">
                <label className="flex items-center gap-2 text-sm text-slate-300 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={newCanAccess}
                    onChange={e => setNewCanAccess(e.target.checked)}
                    className="w-4 h-4 rounded accent-cyan-500"
                  />
                  Can access admin panel
                </label>
              </div>
            </div>
            <Input
              placeholder="Notes (optional)"
              value={newNotes}
              onChange={e => setNewNotes(e.target.value)}
              className="bg-white/[0.04] border-white/10 text-white placeholder:text-slate-600 h-9 text-sm"
            />
            {error && <p className="text-xs text-red-400">{error}</p>}
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={saving}
                className="flex items-center gap-1.5 text-xs font-bold px-3 py-2 rounded-lg bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 hover:bg-cyan-500/20 transition-colors disabled:opacity-50"
              >
                {saving ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} />}
                Add
              </button>
              <button
                type="button"
                onClick={() => { setShowForm(false); setError("") }}
                className="text-xs px-3 py-2 rounded-lg bg-white/[0.03] border border-white/[0.07] text-slate-500 hover:text-white transition-colors"
              >
                Cancel
              </button>
            </div>
          </form>
        )}

        {/* Accounts list */}
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 size={18} className="text-slate-600 animate-spin" />
          </div>
        ) : (
          <div className="space-y-2">
            {accounts.map(account => {
              const isEditing = editingId === account.id
              const vals = editValues[account.id]

              return (
                <div
                  key={account.id}
                  className="p-4 rounded-xl border border-white/[0.07] bg-white/[0.02] hover:bg-white/[0.04] transition-colors"
                >
                  {isEditing ? (
                    // Edit mode
                    <div className="space-y-3">
                      <p className="text-sm font-semibold text-white">{account.email}</p>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="text-[11px] text-slate-500 mb-1 flex items-center gap-1">
                            <Zap size={10} /> Concurrency limit
                          </label>
                          <Input
                            type="number"
                            placeholder="null = default"
                            value={vals.concurrencyLimit}
                            onChange={e => setEditValues(prev => ({ ...prev, [account.id]: { ...vals, concurrencyLimit: e.target.value } }))}
                            min={1}
                            className="bg-white/[0.04] border-white/10 text-white placeholder:text-slate-600 h-8 text-sm"
                          />
                        </div>
                        <div className="flex items-end pb-1">
                          <label className="flex items-center gap-2 text-sm text-slate-300 cursor-pointer select-none">
                            <input
                              type="checkbox"
                              checked={vals.canAccessAdmin}
                              onChange={e => setEditValues(prev => ({ ...prev, [account.id]: { ...vals, canAccessAdmin: e.target.checked } }))}
                              className="w-4 h-4 rounded accent-cyan-500"
                            />
                            Admin panel access
                          </label>
                        </div>
                      </div>
                      <div>
                        <label className="text-[11px] text-slate-500 mb-1 flex items-center gap-1">
                          <StickyNote size={10} /> Notes
                        </label>
                        <Input
                          placeholder="Notes (optional)"
                          value={vals.notes}
                          onChange={e => setEditValues(prev => ({ ...prev, [account.id]: { ...vals, notes: e.target.value } }))}
                          className="bg-white/[0.04] border-white/10 text-white placeholder:text-slate-600 h-8 text-sm"
                        />
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => saveEdit(account.id)}
                          disabled={saving}
                          className="flex items-center gap-1 text-xs font-bold px-3 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/20 transition-colors disabled:opacity-50"
                        >
                          {saving ? <Loader2 size={11} className="animate-spin" /> : <Check size={11} />}
                          Save
                        </button>
                        <button
                          onClick={cancelEdit}
                          className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg bg-white/[0.03] border border-white/[0.07] text-slate-500 hover:text-white transition-colors"
                        >
                          <X size={11} /> Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    // View mode
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-semibold text-white truncate">{account.email}</p>
                          {account.canAccessAdmin ? (
                            <span className="flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                              <Lock size={8} /> Admin
                            </span>
                          ) : (
                            <span className="flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-700/50 text-slate-500 border border-slate-700">
                              <Unlock size={8} /> No Access
                            </span>
                          )}
                          {account.concurrencyLimit !== null && (
                            <span className="flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded bg-violet-500/10 text-violet-400 border border-violet-500/20">
                              <Zap size={8} /> {account.concurrencyLimit} concurrent
                            </span>
                          )}
                        </div>
                        {account.notes && (
                          <p className="text-[11px] text-slate-500 mt-1 italic">{account.notes}</p>
                        )}
                        <p className="text-[10px] text-slate-700 mt-1">
                          Added {new Date(account.addedAt).toLocaleDateString()}
                        </p>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          onClick={() => startEdit(account)}
                          className="p-1.5 rounded-lg hover:bg-white/[0.06] text-slate-600 hover:text-cyan-400 transition-colors"
                          title="Edit permissions"
                        >
                          <Edit2 size={13} />
                        </button>
                        <button
                          onClick={() => handleDelete(account.id, account.email)}
                          className="p-1.5 rounded-lg hover:bg-red-500/10 text-slate-600 hover:text-red-400 transition-colors"
                          title="Remove admin"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}

            {accounts.length === 0 && (
              <div className="text-center py-12 text-slate-600 text-sm">
                No admin accounts configured.
              </div>
            )}
          </div>
        )}

        {/* Legend */}
        <div className="mt-8 pt-5 border-t border-white/[0.05] space-y-1.5">
          <p className="text-[10px] font-semibold text-slate-600 uppercase tracking-widest">Permission Reference</p>
          <div className="grid grid-cols-1 gap-1 text-[11px] text-slate-600">
            <span><span className="text-cyan-400">Admin panel access</span> — Can log into /admin with the password</span>
            <span><span className="text-violet-400">Concurrency limit</span> — Max simultaneous generations for this user (null = system default)</span>
          </div>
        </div>

      </div>
    </div>
  )
}
