"use client"

import { useState, useEffect } from "react"
import { Input } from "@/components/ui/input"
import { ClipboardCheck, Plus, Trash2, Edit2, Check, X, ChevronLeft, Loader2, StickyNote } from "lucide-react"

interface AuditAccount {
  id: number
  email: string
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

export default function AuditAccountsPage() {
  const { ok: authed, password: adminPassword } = useAdminAuth()
  const [accounts, setAccounts] = useState<AuditAccount[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editNotes, setEditNotes] = useState("")

  const [newEmail, setNewEmail] = useState("")
  const [newNotes, setNewNotes] = useState("")

  const authHeaders = () => ({ "Content-Type": "application/json", "x-admin-password": adminPassword })

  const fetchAccounts = async () => {
    setLoading(true)
    try {
      const res = await fetch("/api/admin/audit-accounts", { headers: { "x-admin-password": adminPassword } })
      if (res.ok) setAccounts(await res.json())
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { if (authed) fetchAccounts() }, [authed])

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setSaving(true)
    try {
      const res = await fetch("/api/admin/audit-accounts", {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({ email: newEmail, notes: newNotes || null }),
      })
      const data = await res.json()
      if (res.ok) {
        setNewEmail(""); setNewNotes(""); setShowForm(false)
        await fetchAccounts()
      } else {
        setError(data.error || "Failed to add account")
      }
    } finally {
      setSaving(false)
    }
  }

  const saveEdit = async (id: number) => {
    setSaving(true)
    try {
      const res = await fetch("/api/admin/audit-accounts", {
        method: "PUT",
        headers: authHeaders(),
        body: JSON.stringify({ id, notes: editNotes || null }),
      })
      if (res.ok) { setEditingId(null); await fetchAccounts() }
    } finally { setSaving(false) }
  }

  const handleDelete = async (id: number, email: string) => {
    if (!confirm(`Remove ${email} from audit accounts?`)) return
    const res = await fetch(`/api/admin/audit-accounts?id=${id}`, { method: "DELETE", headers: { "x-admin-password": adminPassword } })
    if (res.ok) await fetchAccounts()
    else alert("Failed to remove account")
  }

  if (authed === null) return (
    <div className="min-h-screen bg-[#09090f] flex items-center justify-center">
      <Loader2 size={20} className="text-slate-600 animate-spin" />
    </div>
  )

  if (!authed) return (
    <div className="min-h-screen bg-[#09090f] flex items-center justify-center p-6">
      <div className="text-center">
        <p className="text-slate-400 mb-4">Admin authentication required.</p>
        <button onClick={() => window.location.href = "/admin"} className="text-sm text-cyan-400 hover:underline">
          Go to Admin Login
        </button>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-[#09090f] relative">
      <div className="fixed top-0 left-1/2 -translate-x-1/2 w-[500px] h-[250px] bg-amber-500/[0.03] rounded-full blur-3xl pointer-events-none" />

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
            <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
              <ClipboardCheck size={16} className="text-amber-400" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-white leading-none">Audit Accounts</h1>
              <p className="text-[11px] text-slate-600 mt-0.5">Bypass maintenance mode for merchant auditors</p>
            </div>
          </div>
          <button
            onClick={() => { setShowForm(!showForm); setError("") }}
            className="flex items-center gap-1.5 text-xs font-bold px-3 py-2 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-400 hover:bg-amber-500/20 transition-colors"
          >
            <Plus size={13} /> Add Account
          </button>
        </div>

        {/* Info banner */}
        <div className="mb-5 p-3 rounded-xl border border-amber-500/15 bg-amber-500/[0.05] text-[11px] text-amber-400/70 leading-relaxed">
          Audit accounts can use the site freely regardless of maintenance mode. Add the email addresses of merchant auditors (SegPay, CCBill, PaymentCloud) here, give them tickets, and share the login.
        </div>

        {/* Add form */}
        {showForm && (
          <form onSubmit={handleAdd} className="mb-6 p-4 rounded-xl border border-white/[0.08] bg-white/[0.03] space-y-3">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">New Audit Account</p>
            <Input
              type="email"
              placeholder="auditor@merchant.com"
              value={newEmail}
              onChange={e => setNewEmail(e.target.value)}
              required
              className="bg-white/[0.04] border-white/10 text-white placeholder:text-slate-600 h-9 text-sm"
            />
            <Input
              placeholder="Notes — e.g. SegPay auditor (optional)"
              value={newNotes}
              onChange={e => setNewNotes(e.target.value)}
              className="bg-white/[0.04] border-white/10 text-white placeholder:text-slate-600 h-9 text-sm"
            />
            {error && <p className="text-xs text-red-400">{error}</p>}
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={saving}
                className="flex items-center gap-1.5 text-xs font-bold px-3 py-2 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-400 hover:bg-amber-500/20 transition-colors disabled:opacity-50"
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
              return (
                <div key={account.id} className="p-4 rounded-xl border border-white/[0.07] bg-white/[0.02] hover:bg-white/[0.04] transition-colors">
                  {isEditing ? (
                    <div className="space-y-3">
                      <p className="text-sm font-semibold text-white">{account.email}</p>
                      <div>
                        <label className="text-[11px] text-slate-500 mb-1 flex items-center gap-1">
                          <StickyNote size={10} /> Notes
                        </label>
                        <Input
                          placeholder="Notes (optional)"
                          value={editNotes}
                          onChange={e => setEditNotes(e.target.value)}
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
                          onClick={() => setEditingId(null)}
                          className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg bg-white/[0.03] border border-white/[0.07] text-slate-500 hover:text-white transition-colors"
                        >
                          <X size={11} /> Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-semibold text-white truncate">{account.email}</p>
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20">
                            Auditor
                          </span>
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
                          onClick={() => { setEditingId(account.id); setEditNotes(account.notes ?? "") }}
                          className="p-1.5 rounded-lg hover:bg-white/[0.06] text-slate-600 hover:text-amber-400 transition-colors"
                          title="Edit notes"
                        >
                          <Edit2 size={13} />
                        </button>
                        <button
                          onClick={() => handleDelete(account.id, account.email)}
                          className="p-1.5 rounded-lg hover:bg-red-500/10 text-slate-600 hover:text-red-400 transition-colors"
                          title="Remove"
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
                No audit accounts configured.
              </div>
            )}
          </div>
        )}

        <div className="mt-8 pt-5 border-t border-white/[0.05] space-y-1.5">
          <p className="text-[10px] font-semibold text-slate-600 uppercase tracking-widest">How It Works</p>
          <div className="text-[11px] text-slate-600 space-y-1">
            <p>Audit accounts bypass <span className="text-amber-400">maintenance mode</span> and the <span className="text-amber-400">generation block</span> on all scanners.</p>
            <p>They are not admins — they cannot access the /admin panel.</p>
            <p>Give them tickets via the Users page, then share the login credentials.</p>
          </div>
        </div>

      </div>
    </div>
  )
}
