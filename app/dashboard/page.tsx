"use client"

import { useState, useEffect } from "react"
import { Ticket, LogOut, CreditCard, Image as ImageIcon, Receipt, Settings, Terminal, Sparkles, Video, ArrowRight, ShieldCheck } from "lucide-react"
import { useRouter } from "next/navigation"
import Link from "next/link"

interface UserData {
  id: number
  email: string
  ticketBalance: number
}

interface GeneratedImage {
  id: number
  prompt: string
  imageUrl: string
  model: string
  createdAt: string
  expiresAt: string
  videoMetadata?: {
    isVideo?: boolean
    thumbnailUrl?: string
    duration?: string
    resolution?: string
  } | null
}

interface Purchase {
  id: number
  type: string
  description: string
  amount: number
  date: string
  status: string
  paypalOrderId: string
}

export default function DashboardPage() {
  const router = useRouter()
  const [user, setUser] = useState<UserData | null>(null)
  const [loading, setLoading] = useState(true)
  const [generatedImages, setGeneratedImages] = useState<GeneratedImage[]>([])
  const [totalImageCount, setTotalImageCount] = useState(0)
  const [hasPromptStudioDev, setHasPromptStudioDev] = useState(false)
  const [isMaintenanceMode, setIsMaintenanceMode] = useState(false)

  // Echo Chamber state
  const [echoMessage, setEchoMessage] = useState("")
  const [isTransmitting, setIsTransmitting] = useState(false)
  const [submitSuccess, setSubmitSuccess] = useState(false)

  useEffect(() => {
    checkAuth()
    fetchMaintenanceStatus()
  }, [])

  // Refresh ticket balance when tab becomes visible
  useEffect(() => {
    if (!user?.id) return
    const refreshBalance = async () => {
      try {
        const res = await fetch(`/api/user/tickets?userId=${user.id}`)
        const data = await res.json()
        if (data.success) {
          setUser(prev => prev ? { ...prev, ticketBalance: data.balance } : prev)
        }
      } catch {}
    }
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') refreshBalance()
    }
    document.addEventListener('visibilitychange', handleVisibility)
    return () => document.removeEventListener('visibilitychange', handleVisibility)
  }, [user?.id])

  const checkAuth = async () => {
    try {
      const res = await fetch('/api/auth/session', { cache: 'no-store' })
      const data = await res.json()
      if (!data.authenticated) { router.push('/login'); return }
      setUser(data.user)
      const ticketRes = await fetch(`/api/user/tickets?userId=${data.user.id}`)
      const ticketData = await ticketRes.json()
      if (ticketData.success) {
        setUser(prev => prev ? { ...prev, ticketBalance: ticketData.balance } : prev)
      }
      fetchSubscriptionStatus()
      fetchGeneratedImages()
    } catch {
      router.push('/login')
    } finally {
      setLoading(false)
    }
  }

  const fetchMaintenanceStatus = async () => {
    try {
      const res = await fetch('/api/admin/config')
      if (res.ok) {
        const data = await res.json()
        setIsMaintenanceMode(!!data.isMaintenanceMode)
      }
    } catch {}
  }

  const fetchGeneratedImages = async () => {
    try {
      const res = await fetch('/api/my-images?page=1&limit=5')
      const data = await res.json()
      if (data.success) {
        setGeneratedImages(data.images)
        setTotalImageCount(data.pagination?.total || data.images.length)
      }
    } catch {}
  }

  const fetchSubscriptionStatus = async () => {
    try {
      const res = await fetch('/api/user/subscription')
      const data = await res.json()
      if (data.success) setHasPromptStudioDev(data.hasPromptStudioDev)
    } catch {}
  }

  const handleEchoSubmit = async () => {
    if (!echoMessage.trim()) return
    setIsTransmitting(true)
    setSubmitSuccess(false)
    try {
      const response = await fetch('/api/echo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: echoMessage })
      })
      if (!response.ok) throw new Error('Failed')
      setEchoMessage("")
      setSubmitSuccess(true)
      setTimeout(() => setSubmitSuccess(false), 2000)
    } catch {}
    finally { setIsTransmitting(false) }
  }

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' })
    router.push('/')
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#050810] flex items-center justify-center">
        <div className="w-5 h-5 rounded-full border-2 border-slate-700 border-t-cyan-400 animate-spin" />
      </div>
    )
  }

  if (!user) return null

  const ADMIN_EMAILS = ["dirtysecretai@gmail.com", "promptandprotocol@gmail.com"]
  const isAdmin = ADMIN_EMAILS.includes(user.email)

  const tools = [
    {
      id: 'portal-v2',
      label: 'AI Design Studio',
      sublabel: 'Portal V2',
      href: '/',
      icon: Sparkles,
      accent: 'text-cyan-400',
      border: 'border-cyan-500/20 hover:border-cyan-400/50',
      bg: 'bg-cyan-500/5',
      iconBg: 'bg-cyan-500/15',
      btnClass: 'bg-cyan-500/15 hover:bg-cyan-500/25 border border-cyan-500/30 text-cyan-300',
      badge: 'NEW',
      maintenance: false,
    },
    {
      id: 'main-scanner',
      label: 'Legacy Scanner (Main)',
      sublabel: 'Classic',
      href: '/scanner',
      icon: ImageIcon,
      accent: 'text-violet-400',
      border: 'border-violet-500/20 hover:border-violet-400/50',
      bg: 'bg-violet-500/5',
      iconBg: 'bg-violet-500/15',
      btnClass: 'bg-violet-500/15 hover:bg-violet-500/25 border border-violet-500/30 text-violet-300',
      badge: null,
      maintenance: isMaintenanceMode,
    },
    {
      id: 'video-scanner',
      label: 'Video Scanner',
      sublabel: 'Dedicated',
      href: '/video-scanner',
      icon: Video,
      accent: 'text-orange-400',
      border: 'border-orange-500/20 hover:border-orange-400/50',
      bg: 'bg-orange-500/5',
      iconBg: 'bg-orange-500/15',
      btnClass: 'bg-orange-500/15 hover:bg-orange-500/25 border border-orange-500/30 text-orange-300',
      badge: null,
      maintenance: isMaintenanceMode,
    },
  ]

  return (
    <div className="min-h-screen bg-[#050810] text-white">
      {/* Subtle grid */}
      <div className="fixed inset-0 bg-[linear-gradient(rgba(255,255,255,0.015)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.015)_1px,transparent_1px)] bg-[size:40px_40px] pointer-events-none" />
      {/* Ambient glows */}
      <div className="fixed top-0 left-1/4 w-[500px] h-[300px] bg-cyan-500/5 rounded-full blur-3xl pointer-events-none" />
      <div className="fixed bottom-0 right-1/4 w-[400px] h-[300px] bg-fuchsia-500/5 rounded-full blur-3xl pointer-events-none" />

      <div className="relative z-10 max-w-4xl mx-auto px-4 py-10">

        {/* Header */}
        <div className="flex items-start justify-between mb-8">
          <div>
            <p className="text-[11px] font-mono text-slate-600 uppercase tracking-widest mb-1">AI Design Studio</p>
            <h1 className="text-3xl font-black text-white tracking-tight">Dashboard</h1>
            <p className="text-slate-500 text-sm mt-0.5">Welcome back, {user.email.split('@')[0]}</p>
          </div>
          <div className="flex items-center gap-2">
            {/* Ticket balance */}
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-cyan-500/20 bg-black/40 font-mono text-xs">
              <Ticket size={11} className="text-cyan-500/70" />
              <span className="text-cyan-400 tabular-nums">{user.ticketBalance.toLocaleString()}</span>
            </div>
            {/* User badge */}
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-white/8 bg-white/3">
              <div className="w-5 h-5 rounded-full bg-gradient-to-br from-cyan-500 to-fuchsia-500 flex items-center justify-center text-[10px] font-black text-black">
                {user.email[0].toUpperCase()}
              </div>
              <span className="text-xs text-slate-400 max-w-[130px] truncate hidden sm:block">{user.email}</span>
              {hasPromptStudioDev && (
                <span className="text-[9px] font-black bg-gradient-to-r from-purple-500 to-cyan-500 text-white px-1.5 py-0.5 rounded-full leading-none">
                  DEV
                </span>
              )}
            </div>
            {/* Admin portal shortcut */}
            {isAdmin && (
              <Link href="/admin">
                <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-cyan-500/30 bg-cyan-500/10 hover:border-cyan-400/50 hover:bg-cyan-500/15 text-xs text-cyan-400 transition-all">
                  <ShieldCheck size={12} />
                  <span className="hidden sm:inline">Admin</span>
                </button>
              </Link>
            )}
            {/* Logout */}
            <button
              onClick={handleLogout}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-white/8 bg-white/3 hover:border-red-500/30 hover:bg-red-500/5 hover:text-red-400 text-xs text-slate-400 transition-all"
            >
              <LogOut size={12} />
              <span className="hidden sm:inline">Logout</span>
            </button>
          </div>
        </div>

        {/* Recent Generations */}
        <div className="rounded-2xl border border-white/6 bg-white/2 backdrop-blur-sm p-5 mb-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <ImageIcon size={14} className="text-fuchsia-400" />
              <span className="text-sm font-semibold text-white">Recent Generations</span>
              {totalImageCount > 0 && (
                <span className="text-[10px] font-mono text-slate-500 bg-white/5 px-2 py-0.5 rounded-full">{totalImageCount.toLocaleString()} total</span>
              )}
            </div>
            <Link href="/my-images">
              <button className="flex items-center gap-1 text-xs text-fuchsia-400 hover:text-fuchsia-300 transition-colors">
                View All <ArrowRight size={11} />
              </button>
            </Link>
          </div>

          {generatedImages.length === 0 ? (
            <div className="flex items-center justify-center h-24 rounded-xl border border-dashed border-white/8 text-slate-600 text-sm">
              No generations yet
            </div>
          ) : (
            <div className="grid grid-cols-5 gap-2">
              {generatedImages.slice(0, 5).map((img, idx) => (
                <Link href="/my-images" key={img.id || idx}>
                  <div className="aspect-square rounded-lg overflow-hidden border border-white/6 hover:border-fuchsia-500/40 transition-all group relative">
                    <img
                      src={img.videoMetadata?.isVideo ? (img.videoMetadata.thumbnailUrl || img.imageUrl) : `/api/images/${img.id}?thumb=1`}
                      alt={`Generation ${idx + 1}`}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                    />
                    {img.videoMetadata?.isVideo && (
                      <div className="absolute bottom-1 left-1 flex items-center gap-0.5 bg-black/70 rounded px-1 py-0.5">
                        <svg className="w-2.5 h-2.5 text-orange-400" fill="currentColor" viewBox="0 0 24 24">
                          <polygon points="5 3 19 12 5 21 5 3" />
                        </svg>
                      </div>
                    )}
                  </div>
                </Link>
              ))}
              {generatedImages.length < 5 && [...Array(5 - generatedImages.length)].map((_, idx) => (
                <div key={`empty-${idx}`} className="aspect-square rounded-lg border border-white/4 bg-white/2 flex items-center justify-center">
                  <ImageIcon className="text-slate-700" size={14} />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Tools */}
        <div className="grid grid-cols-3 gap-3 mb-4">
          {tools.map((tool) => {
            const Icon = tool.icon
            if (tool.maintenance) {
              return (
                <div key={tool.id} className="rounded-2xl border border-yellow-500/20 bg-yellow-500/5 p-4 flex flex-col relative">
                  <span className="absolute top-3 right-3 text-[9px] font-black px-2 py-0.5 rounded-full bg-yellow-500/20 text-yellow-400 border border-yellow-500/30">
                    MAINTENANCE
                  </span>
                  <div className="flex items-center gap-2.5 mb-2">
                    <div className="w-8 h-8 rounded-xl bg-yellow-500/10 flex items-center justify-center shrink-0">
                      <Icon size={16} className="text-yellow-400/60" />
                    </div>
                    <div>
                      <p className="text-sm font-black text-yellow-400/70">{tool.label}</p>
                      <p className="text-[10px] text-slate-600 font-mono">{tool.sublabel}</p>
                    </div>
                  </div>
                  <p className="text-xs text-slate-600 mt-auto">Temporarily offline</p>
                </div>
              )
            }
            return (
              <Link key={tool.id} href={tool.href}>
                <div className={`group rounded-2xl border ${tool.border} ${tool.bg} backdrop-blur-sm p-4 flex flex-col h-full transition-all duration-200 hover:shadow-xl cursor-pointer relative`}>
                  {tool.badge && (
                    <span className="absolute top-3 right-3 text-[9px] font-black px-2 py-0.5 rounded-full bg-cyan-500 text-black">
                      {tool.badge}
                    </span>
                  )}
                  <div className="flex items-center gap-2.5 mb-2">
                    <div className={`w-8 h-8 rounded-xl ${tool.iconBg} flex items-center justify-center shrink-0`}>
                      <Icon size={16} className={tool.accent} />
                    </div>
                    <div>
                      <p className={`text-sm font-black ${tool.accent}`}>{tool.label}</p>
                      <p className="text-[10px] text-slate-600 font-mono">{tool.sublabel}</p>
                    </div>
                  </div>
                  <button className={`mt-auto w-full flex items-center justify-center gap-1 py-1.5 rounded-lg text-[11px] font-semibold transition-all ${tool.btnClass}`}>
                    Open <ArrowRight size={10} />
                  </button>
                </div>
              </Link>
            )
          })}
        </div>

        {/* Bottom row: Account + Shop */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">

          {/* Account */}
          <div className="rounded-2xl border border-white/6 bg-white/2 backdrop-blur-sm p-5">
            <p className="text-[11px] font-mono text-slate-600 uppercase tracking-widest mb-3">Account</p>
            <div className="space-y-2">
              <Link href="/subscriptions">
                <button className="w-full flex items-center gap-2 px-3 py-2 rounded-lg border border-white/6 bg-white/2 hover:border-purple-500/30 hover:bg-purple-500/5 text-xs text-slate-400 hover:text-purple-400 transition-all">
                  <Settings size={12} />
                  Manage Subscriptions
                </button>
              </Link>
              <Link href="/purchase-history">
                <button className="w-full flex items-center gap-2 px-3 py-2 rounded-lg border border-white/6 bg-white/2 hover:border-cyan-500/30 hover:bg-cyan-500/5 text-xs text-slate-400 hover:text-cyan-400 transition-all">
                  <Receipt size={12} />
                  Purchase History
                </button>
              </Link>
              <Link href="/requests-feedback">
                <button className="w-full flex items-center gap-2 px-3 py-2 rounded-lg border border-white/6 bg-white/2 hover:border-fuchsia-500/30 hover:bg-fuchsia-500/5 text-xs text-slate-400 hover:text-fuchsia-400 transition-all">
                  <Terminal size={12} />
                  Feedback
                </button>
              </Link>
            </div>
          </div>

          {/* Shop */}
          <div className="rounded-2xl border border-white/6 bg-white/2 backdrop-blur-sm p-5">
            <p className="text-[11px] font-mono text-slate-600 uppercase tracking-widest mb-3">Shop</p>
            <div className="space-y-2">
              <Link href="/buy-tickets">
                <div className="flex items-center justify-between px-3 py-2.5 rounded-lg border border-cyan-500/20 bg-cyan-500/5 hover:border-cyan-400/40 hover:bg-cyan-500/10 transition-all cursor-pointer group">
                  <div className="flex items-center gap-2">
                    <Ticket size={13} className="text-cyan-400" />
                    <div>
                      <p className="text-xs font-semibold text-cyan-400">Buy Tickets</p>
                      <p className="text-[10px] text-slate-600">
                        {hasPromptStudioDev ? 'Dev tier — 30% off' : 'From $5.00'}
                      </p>
                    </div>
                  </div>
                  <ArrowRight size={12} className="text-cyan-500/50 group-hover:text-cyan-400 transition-colors" />
                </div>
              </Link>
              {!hasPromptStudioDev && (
                <Link href="/prompting-studio/subscribe">
                  <div className="flex items-center justify-between px-3 py-2.5 rounded-lg border border-purple-500/20 bg-purple-500/5 hover:border-purple-400/40 hover:bg-purple-500/10 transition-all cursor-pointer group">
                    <div className="flex items-center gap-2">
                      <Sparkles size={13} className="text-purple-400" />
                      <div>
                        <p className="text-xs font-semibold text-purple-400">Upgrade to Dev Tier</p>
                        <p className="text-[10px] text-slate-600">30% off tickets · From $20</p>
                      </div>
                    </div>
                    <ArrowRight size={12} className="text-purple-500/50 group-hover:text-purple-400 transition-colors" />
                  </div>
                </Link>
              )}
              {hasPromptStudioDev && (
                <Link href="/subscriptions">
                  <div className="flex items-center justify-between px-3 py-2.5 rounded-lg border border-purple-500/20 bg-purple-500/5 hover:border-purple-400/40 hover:bg-purple-500/10 transition-all cursor-pointer group">
                    <div className="flex items-center gap-2">
                      <Sparkles size={13} className="text-purple-400" />
                      <div>
                        <p className="text-xs font-semibold text-purple-400">Dev Tier Active</p>
                        <p className="text-[10px] text-slate-600">Manage subscription</p>
                      </div>
                    </div>
                    <ArrowRight size={12} className="text-purple-500/50 group-hover:text-purple-400 transition-colors" />
                  </div>
                </Link>
              )}
            </div>
          </div>
        </div>

        {/* Quick Message */}
        <div className="rounded-2xl border border-white/6 bg-white/2 backdrop-blur-sm p-5">
          <p className="text-[11px] font-mono text-slate-600 uppercase tracking-widest mb-3">Quick Message</p>
          <div className="flex gap-2">
            <input
              value={echoMessage}
              onChange={(e) => setEchoMessage(e.target.value)}
              placeholder="Send feedback or a request..."
              className="flex-1 bg-black/30 border border-white/8 rounded-lg px-3 py-2 text-xs text-white placeholder-slate-600 outline-none focus:border-cyan-500/40 transition-colors"
              onKeyDown={(e) => e.key === 'Enter' && !isTransmitting && echoMessage.trim() && handleEchoSubmit()}
            />
            <button
              onClick={handleEchoSubmit}
              disabled={isTransmitting || !echoMessage.trim()}
              className="px-4 py-2 rounded-lg bg-gradient-to-r from-cyan-500/20 to-fuchsia-500/20 border border-cyan-500/30 text-cyan-300 text-xs font-semibold hover:from-cyan-500/30 hover:to-fuchsia-500/30 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
            >
              {submitSuccess ? '✓' : isTransmitting ? '...' : 'Send'}
            </button>
          </div>
        </div>

      </div>
    </div>
  )
}
