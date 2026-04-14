"use client"

import { useState, useEffect } from "react"
import { Input } from "@/components/ui/input"
import {
  Terminal, MessageSquare, Wrench, Image as ImageIcon, Sparkles, Tag,
  Users, CreditCard, ListOrdered, FlaskConical, Home, LayoutDashboard,
  LogOut, ChevronRight, ShieldOff, Loader2, Shield, FileText
} from "lucide-react"

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
