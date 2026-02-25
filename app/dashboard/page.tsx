"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Ticket, LogOut, CreditCard, Image as ImageIcon, Download, ExternalLink, Receipt, ChevronUp, ChevronDown, Settings, Terminal, AlertTriangle } from "lucide-react"
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

interface CarouselImage {
  id: number
  imageUrl: string
  side: string
  position: number
}

interface DisplayCarouselImage {
  id: string
  url: string
  alt: string
}

// --- VERTICAL CAROUSEL COMPONENT (4K OPTIMIZED + CLICKABLE) ---
function VerticalCarousel({ images, side, onClick }: { images: DisplayCarouselImage[]; side: string; onClick?: () => void }) {
  const [index, setIndex] = useState(0)
  const [isHovered, setIsHovered] = useState(false)

  const goUp = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (images && images.length > 0) {
      setIndex((p) => (p - 1 + images.length) % images.length)
    }
  }

  const goDown = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (images && images.length > 0) {
      setIndex((p) => (p + 1) % images.length)
    }
  }

  useEffect(() => {
    if (images && images.length > 0 && !isHovered) {
      const int = setInterval(() => {
        setIndex((p) => (p + 1) % images.length)
      }, 6000)
      return () => clearInterval(int)
    }
  }, [images?.length, isHovered])

  // Empty state - clickable to add images
  if (!images || images.length === 0) {
    return (
      <div
        onClick={onClick}
        className="h-full flex flex-col border-2 border-dashed border-cyan-500/30 bg-gradient-to-b from-slate-950 to-slate-900/90 rounded-2xl overflow-hidden shadow-[0_0_40px_rgba(0,0,0,0.6)] cursor-pointer hover:border-cyan-400/50 hover:bg-slate-900/50 transition-all group"
      >
        <div className="px-4 py-3 border-b border-cyan-500/20 bg-slate-900/90 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-slate-600" />
            <span className="text-xs font-mono text-slate-500 uppercase tracking-wider">{side}_gallery</span>
          </div>
          <Settings size={14} className="text-slate-600 group-hover:text-cyan-400 transition-colors" />
        </div>
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="text-center">
            <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-slate-800/50 flex items-center justify-center group-hover:bg-cyan-500/10 group-hover:border-cyan-500/30 border-2 border-transparent transition-all">
              <ImageIcon size={32} className="text-slate-600 group-hover:text-cyan-400 transition-colors" />
            </div>
            <p className="text-slate-400 text-sm font-medium group-hover:text-cyan-400 transition-colors">Tap to customize</p>
            <p className="text-slate-600 text-xs mt-1">Add up to 5 images</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div
      onClick={onClick}
      className="h-full flex flex-col border-2 border-cyan-500/30 bg-gradient-to-b from-slate-950 to-slate-900/90 rounded-2xl overflow-hidden shadow-[0_0_40px_rgba(0,0,0,0.6)] hover:border-cyan-400/50 transition-colors cursor-pointer group"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Header */}
      <div className="px-4 py-3 border-b border-cyan-500/20 bg-slate-900/90 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse shadow-[0_0_8px_rgba(34,197,94,0.5)]" />
          <span className="text-xs text-cyan-400 font-mono uppercase tracking-widest">{side}_gallery</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-slate-500 font-mono">4K</span>
          <span className="text-xs text-slate-400 font-mono bg-slate-800 px-2 py-0.5 rounded">
            {(index + 1).toString().padStart(2, '0')}/{images.length.toString().padStart(2, '0')}
          </span>
          <Settings size={14} className="text-slate-600 group-hover:text-cyan-400 transition-colors" />
        </div>
      </div>

      {/* Image Display */}
      <div className="flex-1 relative bg-black/20">
        {images.map((img, i) => (
          <img
            key={img.id}
            src={img.url}
            alt={img.alt}
            loading="lazy"
            className={`absolute inset-0 w-full h-full object-cover transition-all duration-1000 ease-in-out ${
              i === index
                ? "opacity-100 scale-100"
                : i < index
                ? "opacity-0 scale-105 -translate-y-2"
                : "opacity-0 scale-105 translate-y-2"
            }`}
            style={{ imageRendering: 'auto' }}
          />
        ))}

        {/* Gradient overlays for depth */}
        <div className="absolute inset-0 bg-gradient-to-t from-slate-950/40 via-transparent to-slate-950/20 pointer-events-none" />

        {/* Edit overlay on hover */}
        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center pointer-events-none">
          <div className="bg-slate-900/90 backdrop-blur-sm px-4 py-2 rounded-lg border border-cyan-500/30 flex items-center gap-2">
            <Settings size={16} className="text-cyan-400" />
            <span className="text-sm text-cyan-400 font-medium">Tap to edit</span>
          </div>
        </div>

        {/* Navigation controls */}
        <div className={`absolute top-1/2 -translate-y-1/2 right-3 flex flex-col gap-2 transition-opacity duration-300 ${isHovered ? 'opacity-100' : 'opacity-40'}`}>
          <button
            onClick={goUp}
            className="p-2 rounded-lg bg-slate-950/80 backdrop-blur-sm border border-cyan-500/30 text-cyan-400 hover:text-cyan-300 hover:bg-slate-900/90 hover:border-cyan-400/50 transition-all shadow-lg"
          >
            <ChevronUp size={18} />
          </button>
          <button
            onClick={goDown}
            className="p-2 rounded-lg bg-slate-950/80 backdrop-blur-sm border border-cyan-500/30 text-cyan-400 hover:text-cyan-300 hover:bg-slate-900/90 hover:border-cyan-400/50 transition-all shadow-lg"
          >
            <ChevronDown size={18} />
          </button>
        </div>

        {/* Image indicator dots */}
        <div className={`absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5 transition-opacity duration-300 ${isHovered ? 'opacity-100' : 'opacity-60'}`}>
          {images.map((_, i) => (
            <button
              key={i}
              onClick={(e) => {
                e.stopPropagation()
                setIndex(i)
              }}
              className={`w-2 h-2 rounded-full transition-all ${
                i === index
                  ? 'bg-cyan-400 shadow-[0_0_8px_rgba(34,211,238,0.5)] scale-125'
                  : 'bg-slate-600 hover:bg-slate-500'
              }`}
            />
          ))}
        </div>
      </div>

      {/* Footer */}
      <div className="px-4 py-3 border-t border-cyan-500/20 bg-slate-900/90">
        <p className="text-xs text-slate-400 line-clamp-1">{images[index]?.alt || `Image ${index + 1}`}</p>
      </div>
    </div>
  )
}

export default function DashboardPage() {
  const router = useRouter()
  const [user, setUser] = useState<UserData | null>(null)
  const [loading, setLoading] = useState(true)
  const [generatedImages, setGeneratedImages] = useState<GeneratedImage[]>([])
  const [totalImageCount, setTotalImageCount] = useState(0) // Total images across all pages
  const [purchases, setPurchases] = useState<Purchase[]>([])
  const [hasPromptStudioDev, setHasPromptStudioDev] = useState(false)
  const [isMaintenanceMode, setIsMaintenanceMode] = useState(false)

  // Carousel state
  const [carouselImages, setCarouselImages] = useState<CarouselImage[]>([])

  // Echo Chamber state (mini version)
  const [echoMessage, setEchoMessage] = useState("")
  const [isTransmitting, setIsTransmitting] = useState(false)
  const [submitSuccess, setSubmitSuccess] = useState(false)

  useEffect(() => {
    checkAuth()
    fetchMaintenanceStatus()
  }, [])

  // Refresh ticket balance when tab becomes visible (e.g. after using another scanner page)
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

      if (!data.authenticated) {
        router.push('/login')
        return
      }

      setUser(data.user)

      // Fetch fresh ticket balance (session response may be browser-cached)
      const ticketRes = await fetch(`/api/user/tickets?userId=${data.user.id}`)
      const ticketData = await ticketRes.json()
      if (ticketData.success) {
        setUser(prev => prev ? { ...prev, ticketBalance: ticketData.balance } : prev)
      }

      // Check subscription status
      fetchSubscriptionStatus()

      // Fetch generated images
      fetchGeneratedImages()

      // Fetch purchase history
      fetchPurchases()

      // Fetch carousel images
      fetchCarouselImages()
      
    } catch (error) {
      console.error('Auth check failed:', error)
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
    } catch (err) {
      console.error("Config fetch failed:", err)
    }
  }

  const fetchGeneratedImages = async () => {
    try {
      const res = await fetch('/api/my-images?page=1&limit=50')
      const data = await res.json()

      if (data.success) {
        setGeneratedImages(data.images)
        // Use total from pagination for accurate count
        setTotalImageCount(data.pagination?.total || data.images.length)
      }
    } catch (error) {
      console.error('Failed to fetch images:', error)
    }
  }

  const fetchPurchases = async () => {
    try {
      const res = await fetch('/api/purchases')
      const data = await res.json()

      if (Array.isArray(data)) {
        setPurchases(data)
      }
    } catch (error) {
      console.error('Failed to fetch purchases:', error)
    }
  }

  const fetchSubscriptionStatus = async () => {
    try {
      const res = await fetch('/api/user/subscription')
      const data = await res.json()

      if (data.success) {
        setHasPromptStudioDev(data.hasPromptStudioDev)
      }
    } catch (error) {
      console.error('Failed to fetch subscription status:', error)
    }
  }

  const fetchCarouselImages = async () => {
    try {
      const res = await fetch('/api/user/carousel')
      const data = await res.json()

      if (data.success) {
        setCarouselImages(data.images)
      }
    } catch (error) {
      console.error('Failed to fetch carousel images:', error)
    }
  }

  // Echo Chamber submit (mini version)
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

      if (!response.ok) throw new Error('Failed to send message')

      setEchoMessage("")
      setSubmitSuccess(true)
      setTimeout(() => setSubmitSuccess(false), 2000)
    } catch (err) {
      console.error("Submit failed:", err)
    } finally {
      setIsTransmitting(false)
    }
  }

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' })
    router.push('/')
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric', 
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const daysUntilExpiry = (expiresAt: string) => {
    const now = new Date()
    const expiry = new Date(expiresAt)
    const diff = expiry.getTime() - now.getTime()
    return Math.ceil(diff / (1000 * 60 * 60 * 24))
  }

  const downloadImage = async (imageUrl: string, prompt: string) => {
    try {
      // For iOS/mobile, we need to handle downloads differently
      const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent)
      const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
      
      if (isIOS || isMobile) {
        // On iOS/mobile, open in new tab so user can long-press to save
        const link = document.createElement('a')
        link.href = imageUrl
        link.target = '_blank'
        link.rel = 'noopener noreferrer'
        link.click()
        
        // Show instruction alert after a moment
        setTimeout(() => {
          alert('Tip: Long-press the image and select "Save to Photos" or "Download Image"')
        }, 500)
      } else {
        // Desktop: Direct download
        const response = await fetch(imageUrl)
        const blob = await response.blob()
        const url = window.URL.createObjectURL(blob)
        
        const link = document.createElement('a')
        link.href = url
        link.download = `multiverse-${prompt.substring(0, 30).replace(/[^a-z0-9]/gi, '-')}.png`
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
        window.URL.revokeObjectURL(url)
      }
    } catch (error) {
      console.error('Download failed:', error)
      // Fallback: just open in new tab
      window.open(imageUrl, '_blank')
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#050810] flex items-center justify-center">
        <div className="text-cyan-400 text-xl font-mono">LOADING...</div>
      </div>
    )
  }

  if (!user) return null

  // Check if user is admin
  const isAdmin = user?.email === "dirtysecretai@gmail.com"

  // Show maintenance page to non-admins only
  // Don't block dashboard completely - show maintenance on scanner buttons instead

  // Convert carousel images to display format
  const leftDisplayImages: DisplayCarouselImage[] = carouselImages
    .filter(c => c.side === 'left')
    .sort((a, b) => a.position - b.position)
    .map(img => ({
      id: img.id.toString(),
      url: img.imageUrl,
      alt: `Scan ${img.position}`
    }))

  const rightDisplayImages: DisplayCarouselImage[] = carouselImages
    .filter(c => c.side === 'right')
    .sort((a, b) => a.position - b.position)
    .map(img => ({
      id: img.id.toString(),
      url: img.imageUrl,
      alt: `Scan ${img.position}`
    }))

  return (
    <div className="min-h-screen bg-[#050810] text-white relative overflow-hidden">
      {/* Background effects */}
      <div className="fixed inset-0 bg-[linear-gradient(rgba(0,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(0,255,255,0.02)_1px,transparent_1px)] bg-[size:40px_40px] pointer-events-none" />
      <div className="fixed top-20 left-20 w-96 h-96 bg-cyan-500/5 rounded-full blur-3xl" />
      <div className="fixed bottom-20 right-20 w-96 h-96 bg-fuchsia-500/5 rounded-full blur-3xl" />

      {/* Main Layout with Carousels */}
      <div className="relative z-10 flex items-start justify-center gap-4 p-4 min-h-screen">
        {/* LEFT CAROUSEL - 4K Optimized */}
        <aside className="hidden xl:block w-80 2xl:w-96 h-screen sticky top-0 py-4">
          <VerticalCarousel images={leftDisplayImages} side="left" onClick={() => router.push('/dashboard/carousel/left')} />
        </aside>

        {/* CENTER CONTENT */}
        <div className="flex-1 max-w-4xl p-2">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-2">
            <h1 className="text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-fuchsia-500">
              YOUR DASHBOARD
            </h1>
            <div className="flex items-center gap-2">
              <Link href="/">
                <Button className="bg-slate-800/80 border border-cyan-500/50 text-cyan-400 hover:bg-cyan-500/20 hover:border-cyan-400 px-4 h-9 text-sm font-medium">
                  <ExternalLink size={14} className="mr-1.5" />
                  Home
                </Button>
              </Link>
              <Button
                onClick={handleLogout}
                className="bg-slate-800/80 border border-slate-600 text-slate-400 hover:bg-red-500/10 hover:border-red-500/50 hover:text-red-400 px-4 h-9 text-sm font-medium"
              >
                <LogOut size={14} className="mr-1.5" />
                Logout
              </Button>
            </div>
          </div>
          <p className="text-slate-400 text-sm">Welcome back, {user.email.split('@')[0]}!</p>
        </div>

        {/* Main Dashboard Section */}
        <div className="p-6 rounded-xl border-2 border-slate-700 bg-slate-900/80 backdrop-blur-sm mb-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left: Recent Images Preview */}
            <div className="lg:col-span-2">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <ImageIcon className="text-fuchsia-400" size={18} />
                  <span className="text-sm text-slate-400">Recent Images</span>
                  <span className="text-xs text-fuchsia-400 font-bold">({totalImageCount} total)</span>
                </div>
                <Link href="/my-images">
                  <Button className="bg-fuchsia-600 hover:bg-fuchsia-500 font-bold text-xs h-7 px-3">
                    View All
                  </Button>
                </Link>
              </div>

              {generatedImages.length === 0 ? (
                <div className="p-8 rounded-lg border border-fuchsia-500/30 bg-slate-950/50 text-center">
                  <ImageIcon className="mx-auto text-slate-600 mb-2" size={32} />
                  <p className="text-slate-500 text-sm">No images yet</p>
                  <p className="text-slate-600 text-xs">Generate your first image to see it here</p>
                </div>
              ) : (
                <div className="grid grid-cols-4 gap-2">
                  {/* Large recent image/video */}
                  <div className="col-span-2 row-span-2">
                    <Link href="/my-images">
                      <div className="aspect-square rounded-lg border-2 border-fuchsia-500/30 overflow-hidden hover:border-fuchsia-400 transition-all cursor-pointer group relative">
                        <img
                          src={generatedImages[0]?.videoMetadata?.thumbnailUrl || generatedImages[0]?.imageUrl}
                          alt="Most recent"
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                        />
                        {generatedImages[0]?.videoMetadata?.isVideo && (
                          <div className="absolute bottom-2 left-2 flex items-center gap-1 bg-black/70 rounded px-1.5 py-0.5">
                            <svg className="w-3 h-3 text-orange-400" fill="currentColor" viewBox="0 0 24 24">
                              <polygon points="5 3 19 12 5 21 5 3" />
                            </svg>
                            <span className="text-orange-400 text-[10px] font-mono">VIDEO</span>
                          </div>
                        )}
                      </div>
                    </Link>
                  </div>
                  {/* 4 smaller images/videos */}
                  {generatedImages.slice(1, 5).map((img, idx) => (
                    <Link href="/my-images" key={img.id || idx}>
                      <div className="aspect-square rounded-lg border border-slate-700 overflow-hidden hover:border-fuchsia-400 transition-all cursor-pointer group relative">
                        <img
                          src={img.videoMetadata?.thumbnailUrl || img.imageUrl}
                          alt={`Recent ${idx + 2}`}
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
                  {/* Empty placeholders if less than 5 images */}
                  {generatedImages.length < 5 && [...Array(5 - generatedImages.length)].map((_, idx) => (
                    <div key={`empty-${idx}`} className="aspect-square rounded-lg border border-slate-800 bg-slate-950/30 flex items-center justify-center">
                      <ImageIcon className="text-slate-700" size={16} />
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Right: User Info + Action Buttons + Quick Message */}
            <div className="flex flex-col">
              {/* User Info */}
              <div className="mb-4 pb-4 border-b border-slate-700/50">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-r from-cyan-500 to-fuchsia-500 flex items-center justify-center font-bold text-black">
                    {user.email.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-white font-medium truncate">{user.email}</p>
                    <p className="text-[10px] text-slate-500 font-mono">ID: {user.id}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-cyan-500/10 border border-cyan-500/30 flex-1">
                    <Ticket className="text-cyan-400" size={16} />
                    <span className="text-lg font-black text-cyan-400">{user.ticketBalance}</span>
                    <span className="text-xs text-slate-400">tickets</span>
                  </div>
                  <Link href="/buy-tickets">
                    <Button className="bg-gradient-to-r from-cyan-500 to-fuchsia-500 hover:from-cyan-400 hover:to-fuchsia-400 text-black font-bold text-sm h-9 px-4">
                      <CreditCard size={14} className="mr-1" />
                      Buy
                    </Button>
                  </Link>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="space-y-2 mb-4">
                <Link href="/subscriptions">
                  <Button className="w-full bg-slate-800 hover:bg-purple-500/20 text-purple-400 border border-purple-500/50 hover:border-purple-400 font-medium text-sm h-9">
                    <Settings className="mr-2" size={14} />
                    Manage Subscriptions
                  </Button>
                </Link>
                <Link href="/purchase-history">
                  <Button className="w-full bg-slate-800 hover:bg-slate-700 text-cyan-400 border border-slate-600 font-medium text-sm h-9">
                    <Receipt className="mr-2" size={14} />
                    Purchase History
                  </Button>
                </Link>
                <Link href="/requests-feedback">
                  <Button className="w-full bg-slate-800 hover:bg-fuchsia-500/20 text-fuchsia-400 border border-fuchsia-500/50 hover:border-fuchsia-400 font-medium text-sm h-9">
                    <Terminal className="mr-2" size={14} />
                    Feedback
                  </Button>
                </Link>
              </div>

              {/* Quick Message */}
              <div className="pt-4 border-t border-slate-700/50">
                <p className="text-xs text-slate-500 uppercase tracking-wider mb-2">Quick Message</p>
                <div className="flex gap-2">
                  <Input
                    value={echoMessage}
                    onChange={(e) => setEchoMessage(e.target.value)}
                    placeholder="Send feedback..."
                    className="flex-1 bg-slate-950 border-slate-700 text-white placeholder-slate-600 h-9 text-sm"
                    onKeyDown={(e) => e.key === 'Enter' && !isTransmitting && echoMessage.trim() && handleEchoSubmit()}
                  />
                  <Button
                    onClick={handleEchoSubmit}
                    disabled={isTransmitting || !echoMessage.trim()}
                    size="sm"
                    className="bg-gradient-to-r from-cyan-500 to-fuchsia-500 hover:from-cyan-400 hover:to-fuchsia-400 text-black font-bold px-3 h-9"
                  >
                    {isTransmitting ? "..." : "→"}
                  </Button>
                </div>
                {submitSuccess && (
                  <p className="mt-2 text-cyan-400 text-center text-xs">Sent!</p>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Scanners Section */}
        <div className="p-6 rounded-xl border-2 border-purple-500/30 bg-slate-900/80 backdrop-blur-sm mb-6">
          <div className="flex items-center justify-between gap-4 mb-4">
            {/* Left: Title */}
            <div className="flex items-center gap-3">
              <svg className="text-purple-400" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M10 2v7.527a2 2 0 0 1-.211.896L4.72 20.55a1 1 0 0 0 .9 1.45h12.76a1 1 0 0 0 .9-1.45l-5.069-10.127A2 2 0 0 1 14 9.527V2"></path>
                <path d="M8.5 2h7"></path>
                <path d="M7 16h10"></path>
              </svg>
              <div>
                <div className="text-xl font-black text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-cyan-400">
                  SCANNERS
                </div>
                <p className="text-sm text-slate-400">AI Image Generation</p>
              </div>
            </div>

            {/* Right: Tier Badge */}
            {hasPromptStudioDev ? (
              <span className="text-[10px] font-bold bg-gradient-to-r from-purple-500 to-cyan-500 text-white px-3 py-1 rounded-full">
                DEV TIER
              </span>
            ) : (
              <span className="text-[10px] font-medium bg-slate-700 text-slate-300 px-3 py-1 rounded-full">
                FREE TIER
              </span>
            )}
          </div>

          {/* Scanner Options */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3 gap-4">
            {/* Main Scanner - Always accessible */}
            {isMaintenanceMode ? (
              <div className="p-4 rounded-xl border-2 border-yellow-500/50 bg-yellow-500/10 relative overflow-hidden">
                <div className="flex items-center gap-3 mb-2">
                  <div className="p-2 rounded-lg bg-yellow-500/20">
                    <svg className="w-5 h-5 text-yellow-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
                      <polyline points="9 22 9 12 15 12 15 22"></polyline>
                    </svg>
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-bold text-yellow-400">Main Scanner</h3>
                      <span className="text-[9px] px-2 py-0.5 rounded-full bg-yellow-500 text-black font-bold">MAINTENANCE</span>
                    </div>
                    <p className="text-[10px] text-slate-500">Temporarily offline</p>
                  </div>
                </div>
                <p className="text-xs text-slate-400">Scanner is under maintenance and will be back soon.</p>
              </div>
            ) : (
              <Link href="/">
                <div className="p-4 rounded-xl border-2 border-green-500/30 bg-slate-950/50 hover:border-green-400 hover:bg-green-500/5 transition-all cursor-pointer group">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="p-2 rounded-lg bg-green-500/20 group-hover:bg-green-500/30 transition-colors">
                      <svg className="w-5 h-5 text-green-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
                        <polyline points="9 22 9 12 15 12 15 22"></polyline>
                      </svg>
                    </div>
                    <div>
                      <h3 className="font-bold text-green-400">Main Scanner</h3>
                      <p className="text-[10px] text-slate-500">AI image generator</p>
                    </div>
                  </div>
                  <p className="text-xs text-slate-400">Generate AI images across all available models. The primary scanner.</p>
                </div>
              </Link>
            )}

            {/* Legacy Scanner - Dev Tier Only */}
            {isMaintenanceMode ? (
              <div className="p-4 rounded-xl border-2 border-yellow-500/50 bg-yellow-500/10 relative overflow-hidden">
                <div className="flex items-center gap-3 mb-2">
                  <div className="p-2 rounded-lg bg-yellow-500/20">
                    <svg className="w-5 h-5 text-yellow-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="12" r="3"></circle>
                      <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"></path>
                    </svg>
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-bold text-yellow-400">Legacy Scanner</h3>
                      <span className="text-[9px] px-2 py-0.5 rounded-full bg-yellow-500 text-black font-bold">MAINTENANCE</span>
                    </div>
                    <p className="text-[10px] text-slate-500">Temporarily offline</p>
                  </div>
                </div>
                <p className="text-xs text-slate-400">Scanner is under maintenance and will be back soon.</p>
              </div>
            ) : (
              <Link href="/prompting-studio/legacy">
                <div className="p-4 rounded-xl border-2 border-cyan-500/30 bg-slate-950/50 hover:border-cyan-400 hover:bg-cyan-500/5 transition-all cursor-pointer group">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="p-2 rounded-lg bg-cyan-500/20 group-hover:bg-cyan-500/30 transition-colors">
                      <svg className="w-5 h-5 text-cyan-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="12" cy="12" r="3"></circle>
                        <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"></path>
                      </svg>
                    </div>
                    <div>
                      <h3 className="font-bold text-cyan-400">Legacy Scanner</h3>
                      <p className="text-[10px] text-slate-500">AI image generator</p>
                    </div>
                  </div>
                  <p className="text-xs text-slate-400">Alternative AI image generator with a different layout and feel.</p>
                </div>
              </Link>
            )}

            {/* Video Scanner - Dev Tier Only */}
            {isMaintenanceMode ? (
              <div className="p-4 rounded-xl border-2 border-yellow-500/50 bg-yellow-500/10 relative overflow-hidden">
                <div className="flex items-center gap-3 mb-2">
                  <div className="p-2 rounded-lg bg-yellow-500/20">
                    <svg className="w-5 h-5 text-yellow-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="2" y="2" width="20" height="20" rx="2.18" ry="2.18"></rect>
                      <line x1="7" y1="2" x2="7" y2="22"></line>
                      <line x1="17" y1="2" x2="17" y2="22"></line>
                      <line x1="2" y1="12" x2="22" y2="12"></line>
                      <line x1="2" y1="7" x2="7" y2="7"></line>
                      <line x1="2" y1="17" x2="7" y2="17"></line>
                      <line x1="17" y1="17" x2="22" y2="17"></line>
                      <line x1="17" y1="7" x2="22" y2="7"></line>
                    </svg>
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-bold text-yellow-400">Video Scanner</h3>
                      <span className="text-[9px] px-2 py-0.5 rounded-full bg-yellow-500 text-black font-bold">MAINTENANCE</span>
                    </div>
                    <p className="text-[10px] text-slate-500">Temporarily offline</p>
                  </div>
                </div>
                <p className="text-xs text-slate-400">Scanner is under maintenance and will be back soon.</p>
              </div>
            ) : (
              <Link href="/video-scanner">
                <div className="p-4 rounded-xl border-2 border-orange-500/30 bg-slate-950/50 hover:border-orange-400 hover:bg-orange-500/5 transition-all cursor-pointer group">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="p-2 rounded-lg bg-orange-500/20 group-hover:bg-orange-500/30 transition-colors">
                      <svg className="w-5 h-5 text-orange-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="2" y="2" width="20" height="20" rx="2.18" ry="2.18"></rect>
                        <polygon points="10 8 16 12 10 16 10 8"></polygon>
                      </svg>
                    </div>
                    <div>
                      <h3 className="font-bold text-orange-400">Video Scanner</h3>
                      <p className="text-[10px] text-slate-500">Image-to-video generation</p>
                    </div>
                  </div>
                  <p className="text-xs text-slate-400">Transform images into 5-10s videos with AI motion generation.</p>
                </div>
              </Link>
            )}


          </div>
        </div>

        {/* AI Design Studio Section */}
        <div className="p-6 rounded-xl border-2 border-emerald-500/30 bg-slate-900/80 backdrop-blur-sm mb-8">
          <div className="flex items-center justify-between gap-4 mb-4">
            <div className="flex items-center gap-3">
              <svg className="text-emerald-400" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="m21.64 3.64-1.28-1.28a1.21 1.21 0 0 0-1.72 0L2.36 18.64a1.21 1.21 0 0 0 0 1.72l1.28 1.28a1.2 1.2 0 0 0 1.72 0L21.64 5.36a1.2 1.2 0 0 0 0-1.72Z"></path>
                <path d="m14 7 3 3"></path>
                <path d="M5 6v4"></path>
                <path d="M19 14v4"></path>
                <path d="M10 2v2"></path>
                <path d="M7 8H3"></path>
                <path d="M21 16h-4"></path>
                <path d="M11 3H9"></path>
              </svg>
              <div>
                <div className="text-xl font-black text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-teal-400">
                  AI DESIGN STUDIO
                </div>
                <p className="text-sm text-slate-400">Creative Canvas & AI Tools</p>
              </div>
            </div>

            {hasPromptStudioDev ? (
              <span className="text-[10px] font-bold bg-gradient-to-r from-emerald-500 to-teal-500 text-white px-3 py-1 rounded-full">
                DEV TIER
              </span>
            ) : (
              <span className="text-[10px] font-medium bg-slate-700 text-slate-300 px-3 py-1 rounded-full">
                FREE TIER
              </span>
            )}
          </div>

          {/* Canvas Options */}
          {isMaintenanceMode ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 rounded-xl border-2 border-yellow-500/50 bg-yellow-500/10 relative overflow-hidden">
                <div className="flex items-center gap-3 mb-2">
                  <div className="p-2 rounded-lg bg-yellow-500/20">
                    <svg className="w-5 h-5 text-yellow-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="2" y="2" width="20" height="20" rx="2"></rect>
                      <path d="M2 7h20"></path><path d="M2 12h20"></path><path d="M2 17h20"></path>
                      <path d="M7 2v20"></path><path d="M12 2v20"></path><path d="M17 2v20"></path>
                    </svg>
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-bold text-yellow-400">Composition Canvas</h3>
                      <span className="text-[9px] px-2 py-0.5 rounded-full bg-yellow-500 text-black font-bold">MAINTENANCE</span>
                    </div>
                    <p className="text-[10px] text-slate-500">Temporarily offline</p>
                  </div>
                </div>
                <p className="text-xs text-slate-400">Canvas is under maintenance and will be back soon.</p>
              </div>
              <div className="p-4 rounded-xl border-2 border-yellow-500/50 bg-yellow-500/10 relative overflow-hidden">
                <div className="flex items-center gap-3 mb-2">
                  <div className="p-2 rounded-lg bg-yellow-500/20">
                    <svg className="w-5 h-5 text-yellow-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                      <circle cx="8.5" cy="8.5" r="1.5"></circle>
                      <polyline points="21 15 16 10 5 21"></polyline>
                    </svg>
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-bold text-yellow-400">Scanner Canvas</h3>
                      <span className="text-[9px] px-2 py-0.5 rounded-full bg-yellow-500 text-black font-bold">MAINTENANCE</span>
                    </div>
                    <p className="text-[10px] text-slate-500">Temporarily offline</p>
                  </div>
                </div>
                <p className="text-xs text-slate-400">Scanner is under maintenance and will be back soon.</p>
              </div>
            </div>
          ) : hasPromptStudioDev ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* AI Composition Canvas */}
              <Link href="/composition-canvas">
                <div className="p-4 rounded-xl border-2 border-purple-500/30 bg-slate-950/50 hover:border-purple-400 hover:bg-purple-500/5 transition-all cursor-pointer group h-full">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="p-2 rounded-lg bg-purple-500/20 group-hover:bg-purple-500/30 transition-colors">
                      <svg className="w-5 h-5 text-purple-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="2" y="2" width="20" height="20" rx="2"></rect>
                        <path d="M2 7h20"></path><path d="M2 12h20"></path><path d="M2 17h20"></path>
                        <path d="M7 2v20"></path><path d="M12 2v20"></path><path d="M17 2v20"></path>
                      </svg>
                    </div>
                    <div>
                      <h3 className="font-black text-purple-400 text-base mb-0.5">Composition Canvas</h3>
                      <p className="text-[10px] text-slate-500">Layer-based AI composition</p>
                    </div>
                  </div>
                  <p className="text-xs text-slate-400 mb-2">Layer-based composition with grid regeneration and session saving.</p>
                  <div className="flex flex-wrap gap-1.5">
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-400">Grid System</span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-pink-500/20 text-pink-400">AI Regeneration</span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-fuchsia-500/20 text-fuchsia-400">Save Sessions</span>
                  </div>
                </div>
              </Link>
              {/* Scanner Canvas */}
              <Link href="/prompting-studio/canvas">
                <div className="p-4 rounded-xl border-2 border-fuchsia-500/30 bg-slate-950/50 hover:border-fuchsia-400 hover:bg-fuchsia-500/5 transition-all cursor-pointer group h-full">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="p-2 rounded-lg bg-fuchsia-500/20 group-hover:bg-fuchsia-500/30 transition-colors">
                      <svg className="w-5 h-5 text-fuchsia-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                        <circle cx="8.5" cy="8.5" r="1.5"></circle>
                        <polyline points="21 15 16 10 5 21"></polyline>
                      </svg>
                    </div>
                    <div>
                      <h3 className="font-black text-fuchsia-400 text-base mb-0.5">Scanner Canvas</h3>
                      <p className="text-[10px] text-slate-500">3 modes + infinite canvas</p>
                    </div>
                  </div>
                  <p className="text-xs text-slate-400 mb-2">Canvas/Fullscreen/Studio modes, 6 scanners, reference panel, session saving.</p>
                  <div className="flex flex-wrap gap-1.5">
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-fuchsia-500/20 text-fuchsia-400">6 Scanners</span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-400">3 Modes</span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-400">Infinite Canvas</span>
                  </div>
                </div>
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Locked Composition Canvas */}
              <div className="p-4 rounded-xl border-2 border-slate-700 bg-slate-950/30 relative overflow-hidden">
                <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-[1px] flex items-center justify-center z-10">
                  <div className="text-center">
                    <div className="w-10 h-10 mx-auto mb-2 rounded-full bg-slate-800 flex items-center justify-center">
                      <svg className="w-5 h-5 text-slate-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                        <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                      </svg>
                    </div>
                    <p className="text-xs text-slate-400 font-medium mb-2">Dev Tier Required</p>
                    <Link href="/prompting-studio/subscribe">
                      <Button className="bg-gradient-to-r from-purple-600 to-cyan-600 hover:from-purple-500 hover:to-cyan-500 text-white font-bold text-xs h-7 px-4">
                        Upgrade
                      </Button>
                    </Link>
                  </div>
                </div>
                <div className="opacity-40">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="p-2 rounded-lg bg-purple-500/20">
                      <svg className="w-5 h-5 text-purple-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="2" y="2" width="20" height="20" rx="2"></rect>
                        <path d="M2 7h20"></path><path d="M2 12h20"></path><path d="M2 17h20"></path>
                        <path d="M7 2v20"></path><path d="M12 2v20"></path><path d="M17 2v20"></path>
                      </svg>
                    </div>
                    <div>
                      <h3 className="font-black text-purple-400">Composition Canvas</h3>
                      <p className="text-[10px] text-slate-500">Layer-based AI composition</p>
                    </div>
                  </div>
                  <p className="text-xs text-slate-400">Layer-based composition with grid regeneration and session saving.</p>
                </div>
              </div>
              {/* Locked Scanner Canvas */}
              <div className="p-4 rounded-xl border-2 border-slate-700 bg-slate-950/30 relative overflow-hidden">
                <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-[1px] flex items-center justify-center z-10">
                  <div className="text-center">
                    <div className="w-10 h-10 mx-auto mb-2 rounded-full bg-slate-800 flex items-center justify-center">
                      <svg className="w-5 h-5 text-slate-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                        <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                      </svg>
                    </div>
                    <p className="text-xs text-slate-400 font-medium mb-2">Dev Tier Required</p>
                    <Link href="/prompting-studio/upgrade">
                      <Button className="bg-gradient-to-r from-purple-600 to-cyan-600 hover:from-purple-500 hover:to-cyan-500 text-white font-bold text-xs h-7 px-4">
                        Upgrade
                      </Button>
                    </Link>
                  </div>
                </div>
                <div className="opacity-40">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="p-2 rounded-lg bg-fuchsia-500/20">
                      <svg className="w-5 h-5 text-fuchsia-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                        <circle cx="8.5" cy="8.5" r="1.5"></circle>
                        <polyline points="21 15 16 10 5 21"></polyline>
                      </svg>
                    </div>
                    <div>
                      <h3 className="font-black text-fuchsia-400">Scanner Canvas</h3>
                      <p className="text-[10px] text-slate-500">3 modes + infinite canvas</p>
                    </div>
                  </div>
                  <p className="text-xs text-slate-400">Canvas/Fullscreen/Studio modes, 6 scanners, reference panel, session saving.</p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Shop Section */}
        <div className="p-6 rounded-xl border-2 border-yellow-500/30 bg-slate-900/80 backdrop-blur-sm mb-8">
          <div className="flex items-center gap-3 mb-4">
            <svg className="text-yellow-400" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="9" cy="21" r="1"></circle>
              <circle cx="20" cy="21" r="1"></circle>
              <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"></path>
            </svg>
            <div>
              <div className="text-xl font-black text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 to-orange-400">
                SHOP
              </div>
              <p className="text-sm text-slate-400">Get tickets & unlock features</p>
            </div>
          </div>

          {!hasPromptStudioDev ? (
            /* Free Tier: Show both buy tickets and upgrade */
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Buy Tickets */}
              <Link href="/buy-tickets">
                <div className="p-6 rounded-xl border-2 border-cyan-500/30 bg-gradient-to-br from-cyan-500/10 to-transparent hover:border-cyan-400 hover:from-cyan-500/20 transition-all cursor-pointer group">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="p-3 rounded-lg bg-cyan-500/20 group-hover:bg-cyan-500/30 transition-colors">
                      <svg className="w-6 h-6 text-cyan-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M15.5 2H8.6c-.4 0-.8.2-1.1.5-.3.3-.5.7-.5 1.1v12.8c0 .4.2.8.5 1.1.3.3.7.5 1.1.5h9.8c.4 0 .8-.2 1.1-.5.3-.3.5-.7.5-1.1V6.5L15.5 2z"></path>
                        <polyline points="14 2 14 8 20 8"></polyline>
                        <line x1="16" y1="13" x2="8" y2="13"></line>
                        <line x1="16" y1="17" x2="8" y2="17"></line>
                        <polyline points="10 9 9 9 8 9"></polyline>
                      </svg>
                    </div>
                    <div className="flex-1">
                      <h3 className="font-black text-cyan-400 text-lg">Buy Tickets</h3>
                      <p className="text-xs text-slate-500">Fuel your AI generations</p>
                    </div>
                  </div>
                  <p className="text-sm text-slate-300 mb-3">
                    Purchase ticket packs from <strong className="text-white">25 to 1000 tickets</strong>. 1 ticket = 1 AI generation.
                  </p>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-cyan-400">Starting at $5.00</span>
                    <svg className="w-4 h-4 text-cyan-400 group-hover:translate-x-1 transition-transform" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="9 18 15 12 9 6"></polyline>
                    </svg>
                  </div>
                </div>
              </Link>

              {/* Upgrade to Dev */}
              <Link href="/prompting-studio/subscribe">
                <div className="p-6 rounded-xl border-2 border-purple-500/30 bg-gradient-to-br from-purple-500/10 to-transparent hover:border-purple-400 hover:from-purple-500/20 transition-all cursor-pointer group relative overflow-hidden">
                  {/* Sparkle effect */}
                  <div className="absolute top-2 right-2">
                    <svg className="w-5 h-5 text-purple-400 opacity-50" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M12 0l2.4 7.2h7.6l-6 4.8 2.4 7.2-6-4.8-6 4.8 2.4-7.2-6-4.8h7.6z"></path>
                    </svg>
                  </div>

                  <div className="flex items-center gap-3 mb-3">
                    <div className="p-3 rounded-lg bg-gradient-to-br from-purple-500/20 to-cyan-500/20 group-hover:from-purple-500/30 group-hover:to-cyan-500/30 transition-colors">
                      <svg className="w-6 h-6 text-purple-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M10 2v7.527a2 2 0 0 1-.211.896L4.72 20.55a1 1 0 0 0 .9 1.45h12.76a1 1 0 0 0 .9-1.45l-5.069-10.127A2 2 0 0 1 14 9.527V2"></path>
                        <path d="M8.5 2h7"></path>
                        <path d="M7 16h10"></path>
                      </svg>
                    </div>
                    <div className="flex-1">
                      <h3 className="font-black text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-cyan-400 text-lg">Upgrade to Dev Tier</h3>
                      <p className="text-xs text-slate-500">Unlock pro features</p>
                    </div>
                  </div>
                  <p className="text-sm text-slate-300 mb-3">
                    Get <strong className="text-white">Scanner Canvas, AI prompting, and 30% off</strong> all ticket packages.
                  </p>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-purple-400">Starting at $20</span>
                    <svg className="w-4 h-4 text-purple-400 group-hover:translate-x-1 transition-transform" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="9 18 15 12 9 6"></polyline>
                    </svg>
                  </div>
                </div>
              </Link>
            </div>
          ) : (
            /* Dev Tier: Single big buy tickets button */
            <Link href="/buy-tickets">
              <div className="p-8 rounded-xl border-2 border-cyan-500/40 bg-gradient-to-br from-cyan-500/10 via-purple-500/5 to-transparent hover:border-cyan-400 hover:from-cyan-500/20 transition-all cursor-pointer group">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="p-4 rounded-xl bg-gradient-to-br from-cyan-500/20 to-purple-500/20 group-hover:from-cyan-500/30 group-hover:to-purple-500/30 transition-colors">
                      <svg className="w-8 h-8 text-cyan-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M15.5 2H8.6c-.4 0-.8.2-1.1.5-.3.3-.5.7-.5 1.1v12.8c0 .4.2.8.5 1.1.3.3.7.5 1.1.5h9.8c.4 0 .8-.2 1.1-.5.3-.3.5-.7.5-1.1V6.5L15.5 2z"></path>
                        <polyline points="14 2 14 8 20 8"></polyline>
                        <line x1="16" y1="13" x2="8" y2="13"></line>
                        <line x1="16" y1="17" x2="8" y2="17"></line>
                        <polyline points="10 9 9 9 8 9"></polyline>
                      </svg>
                    </div>
                    <div>
                      <h3 className="font-black text-cyan-400 text-2xl mb-1">Buy Tickets</h3>
                      <p className="text-sm text-slate-400">
                        <span className="text-purple-400 font-bold">✨ Dev Tier Discount:</span> Save up to 37% on all ticket packages
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <p className="text-xs text-slate-500 mb-1">Packages from</p>
                      <p className="text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-purple-400">$3.50</p>
                    </div>
                    <svg className="w-6 h-6 text-cyan-400 group-hover:translate-x-2 transition-transform" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="9 18 15 12 9 6"></polyline>
                    </svg>
                  </div>
                </div>
              </div>
            </Link>
          )}
        </div>

        </div>

        {/* RIGHT CAROUSEL - 4K Optimized */}
        <aside className="hidden xl:block w-80 2xl:w-96 h-screen sticky top-0 py-4">
          <VerticalCarousel images={rightDisplayImages} side="right" onClick={() => router.push('/dashboard/carousel/right')} />
        </aside>
      </div>
    </div>
  )
}







