"use client"

import { useState, useEffect, useRef } from "react"
import { Input } from "@/components/ui/input"
import {
  Terminal, MessageSquare, Wrench, Image as ImageIcon, Sparkles, Tag,
  Users, CreditCard, ListOrdered, FlaskConical, Home, LayoutDashboard,
  LogOut, ChevronRight, ShieldOff, Loader2, Shield, FileText, HardDrive, Cloud, AlertCircle, RotateCcw
} from "lucide-react"

interface TableStats { total: number; blob: number; r2: number }
interface MigrationStats {
  generatedImage: TableStats
  trainingData:   TableStats
  carouselImage:  TableStats
  overall:        TableStats
  errorCount:     number
}

function ProgressBar({ value, total, color = "bg-cyan-500" }: { value: number; total: number; color?: string }) {
  const pct = total > 0 ? Math.min(100, (value / total) * 100) : 0
  return (
    <div className="h-1.5 w-full rounded-full bg-white/[0.06] overflow-hidden">
      <div className={`h-full rounded-full transition-all duration-500 ${color}`} style={{ width: `${pct}%` }} />
    </div>
  )
}

function StatRow({ label, stats }: { label: string; stats: TableStats }) {
  const pct = stats.total > 0 ? ((stats.r2 / stats.total) * 100).toFixed(1) : "0.0"
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-[11px]">
        <span className="text-slate-400">{label}</span>
        <span className="text-slate-500 tabular-nums">{stats.r2.toLocaleString()} / {stats.total.toLocaleString()} <span className="text-slate-600">({pct}%)</span></span>
      </div>
      <ProgressBar value={stats.r2} total={stats.total} />
    </div>
  )
}

function MigrationPanel() {
  const [stats, setStats] = useState<MigrationStats | null>(null)
  const [error, setError] = useState(false)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const intervalRef = useRef<NodeJS.Timeout | null>(null)

  const fetchStats = async (manual = false) => {
    if (manual) setRefreshing(true)
    try {
      // cache-busting param ensures we always get fresh data
      const res = await fetch(`/api/admin/migration-stats?t=${Date.now()}`)
      if (!res.ok) throw new Error()
      const data = await res.json()
      setStats(data)
      setLastUpdated(new Date())
      setError(false)
    } catch {
      setError(true)
    } finally {
      if (manual) setRefreshing(false)
    }
  }

  useEffect(() => {
    fetchStats()
    intervalRef.current = setInterval(() => fetchStats(), 5000)
    return () => { if (intervalRef.current) clearInterval(intervalRef.current) }
  }, [])

  const isDone = stats && stats.overall.blob === 0
  const isRunning = stats && stats.overall.blob > 0

  return (
    <div className="rounded-xl bg-white/[0.03] border border-white/[0.07] p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-orange-500/15 flex items-center justify-center">
            <HardDrive size={13} className="text-orange-400" />
          </div>
          <div>
            <p className="text-sm font-semibold text-white leading-none">Storage Migration</p>
            <p className="text-[10px] text-slate-600 mt-0.5">Vercel Blob → Cloudflare R2</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {isRunning && (
            <span className="flex items-center gap-1 text-[10px] text-amber-400/80">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
              Running
            </span>
          )}
          {isDone && (
            <span className="flex items-center gap-1 text-[10px] text-emerald-400/80">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              Complete
            </span>
          )}
          {lastUpdated && (
            <span className="text-[10px] text-slate-700 tabular-nums">
              {lastUpdated.toLocaleTimeString()}
            </span>
          )}
          <button
            onClick={() => fetchStats(true)}
            disabled={refreshing}
            className="flex items-center gap-1 text-[10px] text-slate-500 hover:text-slate-300 bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.07] rounded-lg px-2 py-1 transition-all disabled:opacity-40"
          >
            <RotateCcw size={10} className={refreshing ? "animate-spin" : ""} />
            Refresh
          </button>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 text-[11px] text-red-400/80">
          <AlertCircle size={12} />
          Could not reach migration-stats API
        </div>
      )}

      {stats && (
        <>
          {/* Overall big counter */}
          <div className="rounded-lg bg-white/[0.03] border border-white/[0.05] p-3 space-y-2">
            <div className="flex items-end justify-between">
              <div>
                <p className="text-[10px] text-slate-600 uppercase tracking-widest">Overall</p>
                <p className="text-2xl font-bold text-white tabular-nums leading-none mt-0.5">
                  {stats.overall.r2.toLocaleString()}
                  <span className="text-sm font-normal text-slate-600"> / {stats.overall.total.toLocaleString()}</span>
                </p>
              </div>
              <div className="text-right">
                <p className="text-[10px] text-slate-600 tabular-nums">
                  {stats.overall.total > 0 ? ((stats.overall.r2 / stats.overall.total) * 100).toFixed(2) : "0.00"}%
                </p>
                <p className="text-[10px] text-orange-400/70 tabular-nums mt-0.5">
                  {stats.overall.blob.toLocaleString()} remaining
                </p>
              </div>
            </div>
            <ProgressBar value={stats.overall.r2} total={stats.overall.total} color="bg-gradient-to-r from-cyan-500 to-fuchsia-500" />
          </div>

          {/* Per-table rows */}
          <div className="space-y-3">
            <StatRow label="Generated Images"   stats={stats.generatedImage} />
            <StatRow label="Training Data"       stats={stats.trainingData} />
            <StatRow label="Carousel Images"     stats={stats.carouselImage} />
          </div>

          {/* Storage badges */}
          <div className="flex gap-2 pt-0.5">
            <div className="flex items-center gap-1.5 text-[11px] text-slate-500 bg-white/[0.03] border border-white/[0.06] rounded-lg px-2.5 py-1.5">
              <Cloud size={11} className="text-orange-400" />
              <span className="tabular-nums text-slate-400">{stats.overall.blob.toLocaleString()}</span>
              <span>on Vercel Blob</span>
            </div>
            <div className="flex items-center gap-1.5 text-[11px] text-slate-500 bg-white/[0.03] border border-white/[0.06] rounded-lg px-2.5 py-1.5">
              <HardDrive size={11} className="text-cyan-400" />
              <span className="tabular-nums text-slate-400">{stats.overall.r2.toLocaleString()}</span>
              <span>on R2</span>
            </div>
            {stats.errorCount > 0 && (
              <div className="flex items-center gap-1.5 text-[11px] text-red-400/80 bg-red-500/[0.06] border border-red-500/20 rounded-lg px-2.5 py-1.5">
                <AlertCircle size={11} />
                <span className="tabular-nums">{stats.errorCount}</span>
                <span>errors</span>
              </div>
            )}
          </div>
        </>
      )}

      {!stats && !error && (
        <div className="flex items-center gap-2 text-[11px] text-slate-600">
          <Loader2 size={12} className="animate-spin" />
          Loading stats...
        </div>
      )}
    </div>
  )
}

const TOOL_PAGES = [
  {
    group: "People",
    items: [
      { name: "Users",             description: "Accounts, subs & transactions", href: "/admin/users",         icon: Users,         color: "bg-purple-500/15 text-purple-400",   border: "hover:border-purple-500/30" },
      { name: "Dev Tier",          description: "Dev subscriptions & analytics",  href: "/admin/dev-tier",      icon: CreditCard,    color: "bg-emerald-500/15 text-emerald-400", border: "hover:border-emerald-500/30" },
      { name: "Promotions",        description: "Discount codes & free tickets",  href: "/admin/promotions",    icon: Tag,           color: "bg-green-500/15 text-green-400",     border: "hover:border-green-500/30" },
      { name: "Feedback",          description: "User feedback & echo stream",    href: "/admin/feedback",      icon: MessageSquare, color: "bg-fuchsia-500/15 text-fuchsia-400", border: "hover:border-fuchsia-500/30" },
    ]
  },
  {
    group: "Content",
    items: [
      { name: "News & Notifications", description: "Articles, notifications & pages", href: "/admin/news",     icon: FileText,      color: "bg-fuchsia-500/15 text-fuchsia-400", border: "hover:border-fuchsia-500/30" },
      { name: "Images",            description: "Generated images & carousel",    href: "/admin/images",        icon: ImageIcon,     color: "bg-pink-500/15 text-pink-400",       border: "hover:border-pink-500/30" },
      { name: "Scanner",           description: "Admin scanner & testing tools",  href: "/admin/scanner",       icon: Sparkles,      color: "bg-violet-500/15 text-violet-400",   border: "hover:border-violet-500/30" },
      { name: "Prototype",         description: "Experimental features",          href: "/admin/prototype",     icon: FlaskConical,  color: "bg-amber-500/15 text-amber-400",     border: "hover:border-amber-500/30" },
    ]
  },
  {
    group: "System",
    items: [
      { name: "Queue",             description: "Generation queue & concurrency", href: "/admin/queue",         icon: ListOrdered,   color: "bg-blue-500/15 text-blue-400",       border: "hover:border-blue-500/30" },
      { name: "Maintenance",       description: "Feature & model toggles",        href: "/admin/maintenance",   icon: Wrench,        color: "bg-orange-500/15 text-orange-400",   border: "hover:border-orange-500/30" },
      { name: "Admins",            description: "Admin accounts & permissions",   href: "/admin/accounts",      icon: Shield,        color: "bg-cyan-500/15 text-cyan-400",       border: "hover:border-cyan-500/30" },
    ]
  },
]

const NAV_LINKS = [
  { name: "Portal V2", href: "/admin/portal-v2", icon: Home },
  { name: "Dashboard",  href: "/dashboard",       icon: LayoutDashboard },
]

export default function AdminPage() {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [sessionEmail, setSessionEmail] = useState<string | null>(null)
  const [isAdminAccount, setIsAdminAccount] = useState<boolean | null>(null)
  const [sessionChecked, setSessionChecked] = useState(false)

  useEffect(() => {
    const check = async () => {
      try {
        const res = await fetch('/api/admin/verify')
        if (res.ok) {
          const data = await res.json()
          setSessionEmail(data.email)
          setIsAdminAccount(data.isAdmin)

          // Only restore auth if they're an admin account
          if (data.isAdmin) {
            const authStatus = localStorage.getItem("multiverse-admin-auth")
            const savedPassword = sessionStorage.getItem("admin-password")
            if (authStatus === "true" && savedPassword) {
              setIsAuthenticated(true)
            } else {
              localStorage.removeItem("multiverse-admin-auth")
            }
          } else {
            localStorage.removeItem("multiverse-admin-auth")
            sessionStorage.removeItem("admin-password")
          }
        }
      } catch {
        // ignore
      } finally {
        setSessionChecked(true)
      }
    }
    check()
  }, [])

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    try {
      const res = await fetch('/api/admin/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password })
      })
      const data = await res.json()
      if (res.ok) {
        sessionStorage.setItem("admin-password", password)
        localStorage.setItem("multiverse-admin-auth", "true")
        if (data.email) setSessionEmail(data.email)
        setIsAuthenticated(true)
      } else {
        setError(data.error || "Authentication failed")
      }
    } catch {
      setError("Authentication failed")
    }
  }

  const handleLogout = () => {
    localStorage.removeItem("multiverse-admin-auth")
    sessionStorage.removeItem("admin-password")
    setIsAuthenticated(false)
  }

  // Loading
  if (!sessionChecked) {
    return (
      <div className="min-h-screen bg-[#09090f] flex items-center justify-center">
        <Loader2 size={20} className="text-slate-600 animate-spin" />
      </div>
    )
  }

  // Signed in but not an admin account
  if (sessionChecked && isAdminAccount === false && sessionEmail) {
    return (
      <div className="min-h-screen bg-[#09090f] flex items-center justify-center p-6">
        <div className="w-full max-w-sm text-center">
          <div className="w-12 h-12 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center mx-auto mb-4">
            <ShieldOff size={22} className="text-red-400" />
          </div>
          <h1 className="text-xl font-bold text-white">Access Denied</h1>
          <p className="text-sm text-slate-500 mt-2">
            <span className="text-slate-300">{sessionEmail}</span> is not authorized for admin access.
          </p>
          <button
            onClick={() => window.location.href = '/dashboard'}
            className="mt-6 px-5 py-2 rounded-xl bg-white/[0.05] border border-white/10 text-sm text-slate-400 hover:text-white hover:bg-white/[0.08] transition-all"
          >
            Back to Dashboard
          </button>
        </div>
      </div>
    )
  }

  // Not signed in at all
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-[#09090f] flex items-center justify-center p-6">
        <div className="w-full max-w-sm">
          <div className="text-center mb-8">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-cyan-500/20 to-fuchsia-500/20 border border-white/10 flex items-center justify-center mx-auto mb-4">
              <Terminal size={22} className="text-cyan-400" />
            </div>
            <h1 className="text-xl font-bold text-white">Admin Access</h1>
            <p className="text-sm text-slate-500 mt-1">Authorized personnel only</p>
            {sessionEmail && isAdminAccount && (
              <p className="text-xs text-emerald-400/70 mt-2">Signed in as {sessionEmail}</p>
            )}
            {!sessionEmail && (
              <p className="text-xs text-amber-400/60 mt-2">You must be signed in with an admin account</p>
            )}
          </div>
          <form onSubmit={handleLogin} className="space-y-3">
            <Input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="bg-white/[0.04] border-white/10 text-white placeholder:text-slate-600 focus:border-cyan-500/50 h-11"
              autoFocus
            />
            {error && <p className="text-xs text-red-400">{error}</p>}
            <button
              type="submit"
              className="w-full h-11 rounded-xl bg-gradient-to-r from-cyan-500 to-fuchsia-500 text-black text-sm font-bold hover:opacity-90 transition-opacity"
            >
              Authenticate
            </button>
          </form>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#09090f] relative">
      {/* Subtle ambient glow */}
      <div className="fixed top-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-cyan-500/[0.04] rounded-full blur-3xl pointer-events-none" />

      <div className="relative z-10 max-w-3xl mx-auto px-5 py-8">

        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-cyan-500/20 to-fuchsia-500/20 border border-white/10 flex items-center justify-center">
              <Terminal size={16} className="text-cyan-400" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-white leading-none">Admin Panel</h1>
              {sessionEmail ? (
                <p className="text-[11px] text-emerald-400/60 mt-0.5">{sessionEmail}</p>
              ) : (
                <p className="text-[11px] text-slate-600 mt-0.5">Control center</p>
              )}
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="flex items-center gap-1.5 text-xs text-slate-600 hover:text-red-400 transition-colors py-1.5 px-3 rounded-lg hover:bg-red-500/5"
          >
            <LogOut size={12} />
            Sign out
          </button>
        </div>

        {/* Tool groups */}
        <div className="space-y-6">
          {TOOL_PAGES.map((group) => (
            <div key={group.group}>
              <p className="text-[10px] font-semibold text-slate-600 uppercase tracking-widest mb-2.5 px-0.5">
                {group.group}
              </p>
              <div className="grid grid-cols-2 gap-2">
                {group.items.map((item) => (
                  <button
                    key={item.name}
                    onClick={() => window.location.href = item.href}
                    className={`group flex items-center gap-3 p-3.5 rounded-xl bg-white/[0.03] border border-white/[0.07] ${item.border} hover:bg-white/[0.06] transition-all text-left`}
                  >
                    <div className={`w-8 h-8 rounded-lg ${item.color} flex items-center justify-center shrink-0`}>
                      <item.icon size={15} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-white leading-none">{item.name}</p>
                      <p className="text-[11px] text-slate-500 mt-0.5 leading-snug truncate">{item.description}</p>
                    </div>
                    <ChevronRight size={13} className="text-slate-700 group-hover:text-slate-500 shrink-0 transition-colors" />
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Migration stats */}
        <div className="mt-6">
          <MigrationPanel />
        </div>

        {/* Navigation links */}
        <div className="mt-6 pt-5 border-t border-white/[0.06] flex gap-2">
          {NAV_LINKS.map((link) => (
            <button
              key={link.name}
              onClick={() => window.location.href = link.href}
              className="flex items-center gap-2 py-2 px-4 rounded-lg bg-white/[0.03] border border-white/[0.07] hover:bg-white/[0.06] hover:border-white/15 transition-all text-sm text-slate-400 hover:text-white"
            >
              <link.icon size={13} />
              {link.name}
            </button>
          ))}
        </div>

      </div>
    </div>
  )
}
