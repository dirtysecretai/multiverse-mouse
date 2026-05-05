"use client"

import { useState, useEffect } from "react"
import { Input } from "@/components/ui/input"
import { ClipboardCheck, Plus, Trash2, Edit2, Check, X, ChevronLeft, Loader2, Copy, Ticket, Eye, EyeOff } from "lucide-react"

interface AuditAccount {
  id: number
  username: string
  internalEmail: string
  plainPassword: string
  notes: string | null
  ticketBalance: number
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

function CopyButton({ value, label }: { value: string; label?: string }) {
  const [copied, setCopied] = useState(false)
  const copy = () => {
    navigator.clipboard.writeText(value).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    })
  }
  return (
    <button
      onClick={copy}
      className="flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-white/[0.04] border border-white/[0.08] text-slate-500 hover:text-cyan-400 hover:border-cyan-500/20 transition-colors shrink-0"
    >
      <Copy size={9} />
      {copied ? "Copied!" : (label ?? "Copy")}
    </button>
  )
}

export default function AuditAccountsPage() {
  const { ok: authed, password: adminPassword } = useAdminAuth()
  const [accounts, setAccounts] = useState<AuditAccount[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")

  // New account form
  const [newNotes, setNewNotes]     = useState("")
  const [newTickets, setNewTickets] = useState("100")

  // Inline edit state
  const [editingId, setEditingId]       = useState<number | null>(null)
  const [editNotes, setEditNotes]       = useState("")
  const [editTickets, setEditTickets]   = useState("")

  // Visibility toggle per account
  const [visiblePw, setVisiblePw] = useState<Set<number>>(new Set())

  const authHeaders = () => ({ "Content-Type": "application/json", "x-admin-password": adminPassword })

  const fetchAccounts = async () => {
    setLoading(true)
    try {
      const res = await fetch("/api/admin/audit-accounts", { headers: { "x-admin-password": adminPassword } })
      if (res.ok) setAccounts(await res.json())
    } finally { setLoading(false) }
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
        body: JSON.stringify({ notes: newNotes || null, tickets: parseInt(newTickets) || 100 }),
      })
      const data = await res.json()
      if (res.ok) {
        setNewNotes(""); setNewTickets("100"); setShowForm(false)
        // Show new account's password immediately
        setVisiblePw(prev => new Set([...prev, data.id]))
        await fetchAccounts()
      } else {
        setError(data.error || "Failed to create account")
      }
    } finally { setSaving(false) }
  }

  const startEdit = (a: AuditAccount) => {
    setEditingId(a.id)
    setEditNotes(a.notes ?? "")
    setEditTickets(String(a.ticketBalance))
  }

  const saveEdit = async (id: number) => {
    setSaving(true)
    try {
      const res = await fetch("/api/admin/audit-accounts", {
        method: "PUT",
        headers: authHeaders(),
        body: JSON.stringify({ id, notes: editNotes || null, tickets: parseInt(editTickets) || 0 }),
      })
      if (res.ok) { setEditingId(null); await fetchAccounts() }
    } finally { setSaving(false) }
  }

  const handleDelete = async (id: number, username: string) => {
    if (!confirm(`Remove audit account "${username}"? The underlying user account will remain in the database.`)) return
    const res = await fetch(`/api/admin/audit-accounts?id=${id}`, { method: "DELETE", headers: { "x-admin-password": adminPassword } })
    if (res.ok) await fetchAccounts()
    else alert("Failed to remove account")
  }

  const togglePw = (id: number) => setVisiblePw(prev => {
    const next = new Set(prev)
    next.has(id) ? next.delete(id) : next.add(id)
    return next
  })

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
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <button onClick={() => window.location.href = "/admin"}
              className="w-8 h-8 rounded-lg bg-white/[0.04] border border-white/[0.07] flex items-center justify-center hover:bg-white/[0.07] transition-colors text-slate-400 hover:text-white">
              <ChevronLeft size={15} />
            </button>
            <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
              <ClipboardCheck size={16} className="text-amber-400" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-white leading-none">Audit Accounts</h1>
              <p className="text-[11px] text-slate-600 mt-0.5">Merchant auditor accounts — bypass maintenance mode</p>
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
        <div className="mb-5 p-3 rounded-xl border border-amber-500/15 bg-amber-500/[0.04] text-[11px] text-amber-400/60 leading-relaxed">
          Credentials are auto-generated. Give the login email + password to the auditor — they sign in at <span className="text-amber-400">/login</span> and can use the site freely regardless of maintenance mode.
        </div>

        {/* Add form */}
        {showForm && (
          <form onSubmit={handleAdd} className="mb-6 p-4 rounded-xl border border-amber-500/20 bg-amber-500/[0.03] space-y-3">
            <p className="text-xs font-semibold text-amber-400/70 uppercase tracking-wider">New Audit Account</p>
            <p className="text-[11px] text-slate-600">Username and password will be auto-generated.</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] text-slate-500 mb-1 flex items-center gap-1"><Ticket size={10} /> Starting tickets</label>
                <Input
                  type="number"
                  placeholder="100"
                  value={newTickets}
                  onChange={e => setNewTickets(e.target.value)}
                  min={0}
                  className="bg-white/[0.04] border-white/10 text-white placeholder:text-slate-600 h-9 text-sm"
                />
              </div>
              <div>
                <label className="text-[11px] text-slate-500 mb-1 block">Notes (optional)</label>
                <Input
                  placeholder="e.g. SegPay auditor"
                  value={newNotes}
                  onChange={e => setNewNotes(e.target.value)}
                  className="bg-white/[0.04] border-white/10 text-white placeholder:text-slate-600 h-9 text-sm"
                />
              </div>
            </div>
            {error && <p className="text-xs text-red-400">{error}</p>}
            <div className="flex gap-2">
              <button type="submit" disabled={saving}
                className="flex items-center gap-1.5 text-xs font-bold px-3 py-2 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-400 hover:bg-amber-500/20 transition-colors disabled:opacity-50">
                {saving ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} />}
                Generate Account
              </button>
              <button type="button" onClick={() => { setShowForm(false); setError("") }}
                className="text-xs px-3 py-2 rounded-lg bg-white/[0.03] border border-white/[0.07] text-slate-500 hover:text-white transition-colors">
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
        ) : accounts.length === 0 ? (
          <div className="text-center py-12 text-slate-600 text-sm">No audit accounts yet.</div>
        ) : (
          <div className="space-y-3">
            {accounts.map(account => {
              const isEditing = editingId === account.id
              const pwVisible = visiblePw.has(account.id)

              return (
                <div key={account.id} className="rounded-xl border border-white/[0.07] bg-white/[0.02] overflow-hidden">
                  {/* Top strip */}
                  <div className="flex items-center justify-between px-4 pt-3 pb-2 border-b border-white/[0.05]">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-white font-mono">{account.username}</span>
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20">Auditor</span>
                    </div>
                    <div className="flex items-center gap-1">
                      {!isEditing && (
                        <button onClick={() => startEdit(account)}
                          className="p-1.5 rounded-lg hover:bg-white/[0.06] text-slate-600 hover:text-amber-400 transition-colors" title="Edit">
                          <Edit2 size={12} />
                        </button>
                      )}
                      <button onClick={() => handleDelete(account.id, account.username)}
                        className="p-1.5 rounded-lg hover:bg-red-500/10 text-slate-600 hover:text-red-400 transition-colors" title="Remove">
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </div>

                  {/* Credentials */}
                  <div className="px-4 py-2.5 space-y-1.5 border-b border-white/[0.05]">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-slate-600 w-16 shrink-0">Login email</span>
                      <span className="text-[11px] text-slate-300 font-mono flex-1 truncate">{account.internalEmail}</span>
                      <CopyButton value={account.internalEmail} />
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-slate-600 w-16 shrink-0">Password</span>
                      <span className="text-[11px] text-slate-300 font-mono flex-1">
                        {pwVisible ? account.plainPassword : '••••••••'}
                      </span>
                      <button onClick={() => togglePw(account.id)}
                        className="p-1 text-slate-600 hover:text-slate-400 transition-colors shrink-0">
                        {pwVisible ? <EyeOff size={11} /> : <Eye size={11} />}
                      </button>
                      <CopyButton value={account.plainPassword} />
                    </div>
                  </div>

                  {/* Edit or view mode */}
                  <div className="px-4 py-2.5">
                    {isEditing ? (
                      <div className="space-y-2.5">
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="text-[11px] text-slate-500 mb-1 flex items-center gap-1"><Ticket size={10} /> Ticket balance</label>
                            <Input type="number" value={editTickets} onChange={e => setEditTickets(e.target.value)} min={0}
                              className="bg-white/[0.04] border-white/10 text-white placeholder:text-slate-600 h-8 text-sm" />
                          </div>
                          <div>
                            <label className="text-[11px] text-slate-500 mb-1 block">Notes</label>
                            <Input value={editNotes} onChange={e => setEditNotes(e.target.value)} placeholder="optional"
                              className="bg-white/[0.04] border-white/10 text-white placeholder:text-slate-600 h-8 text-sm" />
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <button onClick={() => saveEdit(account.id)} disabled={saving}
                            className="flex items-center gap-1 text-xs font-bold px-2.5 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/20 transition-colors disabled:opacity-50">
                            {saving ? <Loader2 size={11} className="animate-spin" /> : <Check size={11} />} Save
                          </button>
                          <button onClick={() => setEditingId(null)}
                            className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg bg-white/[0.03] border border-white/[0.07] text-slate-500 hover:text-white transition-colors">
                            <X size={11} /> Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center gap-4 text-[11px] text-slate-500">
                        <span className="flex items-center gap-1">
                          <Ticket size={10} className="text-amber-400/60" />
                          <span className="text-amber-400/80 font-medium">{account.ticketBalance}</span> tickets
                        </span>
                        {account.notes && <span className="italic truncate">{account.notes}</span>}
                        <span className="ml-auto text-[10px] text-slate-700">
                          Added {new Date(account.addedAt).toLocaleDateString()}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
