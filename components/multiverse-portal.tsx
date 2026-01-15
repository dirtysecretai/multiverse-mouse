"use client"

import { useState, useEffect, useRef } from "react"
import { Switch } from "@/components/ui/switch"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Send, AlertTriangle, ChevronUp, ChevronDown, ExternalLink, Terminal } from "lucide-react"
import Link from "next/link"

// --- ICONS ---
const PatreonIcon = () => (
  <svg viewBox="0 0 24 24" className="w-6 h-6" fill="currentColor">
    <path d="M15.386.524c-4.764 0-8.64 3.876-8.64 8.64 0 4.75 3.876 8.613 8.64 8.613 4.75 0 8.614-3.864 8.614-8.613C24 4.4 20.136.524 15.386.524M.003 23.537h4.22V.524H.003" />
  </svg>
)

const InstagramIcon = () => (
  <svg
    viewBox="0 0 24 24"
    className="w-6 h-6"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
    <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
    <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
  </svg>
)

// --- INTERFACES ---
interface AdminState {
  isShopOpen: boolean
  isMaintenanceMode: boolean
}

interface CarouselImage {
  id: string
  url: string
  alt: string
}

interface EchoMessage {
  id: number // Unified to number to match database
  message: string
  visibleName: boolean
  name?: string
  createdAt: string
}

interface PortalCardProps {
  icon: React.ReactNode
  label: string
  sublabel: string
  variant: "primary" | "default" | "secondary"
  href: string
  thumbnailUrl?: string
}

// --- COMPONENTS ---
function PortalCard({ icon, label, sublabel, variant, href }: PortalCardProps) {
  const [isHovered, setIsHovered] = useState(false)

  const getCardStyle = () => {
    switch (variant) {
      case "primary":
        return "border-cyan-500/40 hover:border-cyan-400/70 bg-gradient-to-br from-cyan-500/10 via-slate-900/50 to-cyan-500/5 hover:shadow-[0_0_40px_rgba(0,255,255,0.15)]"
      case "secondary":
        return "border-fuchsia-500/30 hover:border-fuchsia-400/60 bg-gradient-to-br from-fuchsia-500/10 via-slate-900/50 to-fuchsia-500/5 hover:shadow-[0_0_40px_rgba(255,0,255,0.12)]"
      default:
        return "border-slate-700/50 hover:border-slate-600 bg-gradient-to-br from-slate-800/50 via-slate-900/50 to-slate-800/50 hover:shadow-[0_0_30px_rgba(148,163,184,0.1)]"
    }
  }

  const getIconColor = () => {
    switch (variant) {
      case "primary":
        return "text-cyan-400 bg-cyan-500/10 border-cyan-500/30"
      case "secondary":
        return "text-fuchsia-400 bg-fuchsia-500/10 border-fuchsia-500/30"
      default:
        return "text-slate-400 bg-slate-800/50 border-slate-700/50"
    }
  }

  const getAccentColor = () => {
    switch (variant) {
      case "primary":
        return "bg-cyan-500/50"
      case "secondary":
        return "bg-fuchsia-500/50"
      default:
        return "bg-slate-600/50"
    }
  }

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="block group"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div className={`relative p-5 rounded-xl border transition-all duration-300 overflow-hidden ${getCardStyle()}`}>
        <div className="absolute inset-0 bg-[repeating-linear-gradient(45deg,transparent,transparent_10px,rgba(0,255,255,0.02)_10px,rgba(0,255,255,0.02)_20px)] opacity-0 group-hover:opacity-100 transition-opacity" />
        {isHovered && (
          <div className="absolute inset-0 pointer-events-none bg-[repeating-linear-gradient(0deg,transparent,transparent_2px,rgba(255,255,255,0.02)_2px,rgba(255,255,255,0.02)_4px)]" />
        )}
        <div className="relative z-10 flex items-center gap-4">
          <div className="flex-shrink-0">
            <div className={`p-4 rounded-xl border transition-all duration-300 ${getIconColor()}`}>
              {icon}
            </div>
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-lg font-bold text-white mb-1 group-hover:text-cyan-400 transition-colors">
              {label}
            </h3>
            <p className="text-sm text-slate-400 font-mono uppercase tracking-wider">
              {sublabel}
            </p>
          </div>
          <div className="flex-shrink-0">
            <div className="p-2 rounded-lg bg-slate-800/50 border border-slate-700/50 group-hover:border-cyan-500/50 group-hover:bg-cyan-500/10 transition-all">
              <ExternalLink className="w-5 h-5 text-slate-400 group-hover:text-cyan-400 transition-colors" />
            </div>
          </div>
        </div>
        <div className={`absolute bottom-0 left-0 right-0 h-[2px] ${getAccentColor()} transform scale-x-0 group-hover:scale-x-100 transition-transform duration-300 origin-left`} />
      </div>
    </a>
  )
}

function VerticalCarousel({ images, side }: { images: CarouselImage[]; side: "left" | "right" }) {
  const [currentIndex, setCurrentIndex] = useState(0)
  const [isAutoPlaying, setIsAutoPlaying] = useState(true)

  useEffect(() => {
    if (!isAutoPlaying || images.length === 0) return
    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % images.length)
    }, 4000)
    return () => clearInterval(interval)
  }, [isAutoPlaying, images.length])

  const goUp = () => setCurrentIndex((prev) => (prev - 1 + images.length) % images.length)
  const goDown = () => setCurrentIndex((prev) => (prev + 1) % images.length)

  return (
    <div 
      className="h-full flex flex-col group"
      onMouseEnter={() => setIsAutoPlaying(false)}
      onMouseLeave={() => setIsAutoPlaying(true)}
    >
      <div className="flex items-center justify-between px-3 py-2 bg-slate-900/80 border-b border-cyan-500/30">
        <div className="flex items-center gap-2">
          <div className="flex gap-1.5">
            <div className="w-2 h-2 rounded-full bg-red-500/70" />
            <div className="w-2 h-2 rounded-full bg-yellow-500/70" />
            <div className="w-2 h-2 rounded-full bg-green-500/70" />
          </div>
          <span className="text-[10px] font-mono text-cyan-400/70 uppercase tracking-wider">
            {side === "left" ? "feed_01" : "feed_02"}
          </span>
        </div>
        <button onClick={goUp} className="p-1 rounded hover:bg-cyan-500/20 text-cyan-400/50 hover:text-cyan-400 transition-colors">
          <ChevronUp className="w-4 h-4" />
        </button>
      </div>

      <div className="flex-1 relative overflow-hidden border-x border-cyan-500/20 bg-slate-950/50">
        <div className="absolute inset-0 pointer-events-none z-10 bg-[repeating-linear-gradient(0deg,transparent,transparent_2px,rgba(0,255,255,0.03)_2px,rgba(0,255,255,0.03)_4px)]" />
        <div 
          className="absolute inset-0 transition-transform duration-700 ease-out"
          style={{ transform: `translateY(-${currentIndex * 100}%)` }}
        >
          {images.map((image, index) => (
            <div key={image.id} className="absolute w-full h-full" style={{ top: `${index * 100}%` }}>
              <img src={image.url} alt={image.alt} className="w-full h-full object-cover" />
              <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-transparent to-slate-950/40" />
            </div>
          ))}
        </div>
      </div>

      <div className="flex items-center justify-between px-3 py-2 bg-slate-900/80 border-t border-cyan-500/30">
        <span className="text-[9px] font-mono text-slate-500">{currentIndex + 1} / {images.length}</span>
        <button onClick={goDown} className="p-1 rounded hover:bg-cyan-500/20 text-cyan-400/50 hover:text-cyan-400 transition-colors">
          <ChevronDown className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}

// --- MAIN PORTAL ---
export default function MultiversePortal() {
  const [adminState, setAdminState] = useState<AdminState>({
    isShopOpen: false,
    isMaintenanceMode: false,
  })

  const [echoMessage, setEchoMessage] = useState("")
  const [visibleName, setVisibleName] = useState(false)
  const [userName, setUserName] = useState("")
  const [submitSuccess, setSubmitSuccess] = useState(false)
  const [isTransmitting, setIsTransmitting] = useState(false)

  // CLEANED SYNC LOGIC
  useEffect(() => {
    const fetchGlobalConfig = async () => {
      try {
        const response = await fetch('/api/admin/config')
        if (response.ok) {
          const data = await response.json()
          setAdminState({
            isShopOpen: !!data.isShopOpen, // Boolean forced
            isMaintenanceMode: !!data.isMaintenanceMode,
          })
        }
      } catch (err) {
        console.error("Portal sync failed:", err)
      }
    }

    fetchGlobalConfig()
    const interval = setInterval(fetchGlobalConfig, 30000) // Poll every 30s
    return () => clearInterval(interval)
  }, [])

  const handleSubmitEcho = async () => {
    if (!echoMessage.trim()) return
    setIsTransmitting(true)

    try {
      const response = await fetch('/api/echo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: visibleName ? userName : "Anonymous",
          message: echoMessage,
          visibleName: visibleName,
        }),
      })

      if (!response.ok) throw new Error('Failed to transmit')

      setEchoMessage("")
      setUserName("")
      setSubmitSuccess(true)
      setTimeout(() => setSubmitSuccess(false), 3000)
    } catch (error) {
      console.error("Transmission failed:", error)
      alert("The signal was lost. Please try again.")
    } finally {
      setIsTransmitting(false)
    }
  }

  // --- IMAGES ---
  const leftCarouselImages: CarouselImage[] = [
    { id: "1", url: "https://i.imgur.com/VAviOOl.jpeg", alt: "1" },
    { id: "2", url: "https://i.imgur.com/JjGdipN.jpeg", alt: "2" },
    { id: "3", url: "https://i.imgur.com/jfLcnuN.jpeg", alt: "3" },
    { id: "4", url: "https://i.imgur.com/jZevNYN.png", alt: "4" },
    { id: "5", url: "https://i.imgur.com/OZmPGdW.jpeg", alt: "5" },
  ]

  const rightCarouselImages: CarouselImage[] = [
    { id: "11", url: "https://i.imgur.com/YY45ukt.jpeg", alt: "11" },
    { id: "12", url: "https://i.imgur.com/NUZIGgf.jpeg", alt: "12" },
    { id: "13", url: "https://i.imgur.com/a3lTUTN.jpeg", alt: "13" },
    { id: "14", url: "https://i.imgur.com/JB1y5an.png", alt: "14" },
    { id: "15", url: "https://i.imgur.com/LhfxYdE.jpeg", alt: "15" },
  ]

  // --- RENDER ---
  if (adminState.isMaintenanceMode) {
    return (
      <div className="min-h-screen bg-[#050810] flex flex-col items-center justify-center px-4 relative overflow-hidden">
        <div className="fixed inset-0 bg-[linear-gradient(rgba(0,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(0,255,255,0.02)_1px,transparent_1px)] bg-[size:40px_40px] pointer-events-none" />
        <div className="relative text-center max-w-2xl w-full">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-slate-900/60 border border-yellow-500/30 rounded-lg mb-8">
            <AlertTriangle className="w-4 h-4 text-yellow-400" />
            <span className="text-xs font-mono text-yellow-400">SYSTEM_MAINTENANCE</span>
          </div>
          <h1 className="text-5xl md:text-6xl font-black italic mb-6 bg-gradient-to-r from-cyan-400 via-white to-fuchsia-500 bg-clip-text text-transparent">MULTIVERSE MOUSE</h1>
          <div className="mb-12 p-6 rounded-xl border border-yellow-500/30 bg-yellow-500/5 backdrop-blur-sm">
            <h2 className="text-2xl font-bold text-yellow-400 font-mono mb-2">SYSTEMS OFFLINE</h2>
            <p className="text-slate-400 text-sm">Portal undergoing maintenance. Check socials for updates.</p>
          </div>
          <div className="space-y-4">
            <PortalCard icon={<PatreonIcon />} label="Enter the Patreon" sublabel="EXCLUSIVE_CONTENT" variant="primary" href="https://www.patreon.com/DirtySecretAi" />
            <PortalCard icon={<InstagramIcon />} label="Main Instagram" sublabel="@MULTIVERSEMOUSE" variant="default" href="https://www.instagram.com/multiuniverseai" />
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#050810] relative overflow-hidden">
      <div className="fixed inset-0 bg-[linear-gradient(rgba(0,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(0,255,255,0.02)_1px,transparent_1px)] bg-[size:40px_40px] pointer-events-none" />
      <main className="relative grid grid-cols-1 lg:grid-cols-[300px_1fr_300px] gap-6 max-w-7xl mx-auto px-6 py-6">
        <div className="hidden lg:block h-[calc(100vh-48px)] sticky top-6">
          <VerticalCarousel images={leftCarouselImages} side="left" />
        </div>

        <div className="flex flex-col items-center py-8">
          <h1 className="text-4xl md:text-5xl font-black italic mb-3 bg-gradient-to-r from-cyan-400 via-white to-fuchsia-500 bg-clip-text text-transparent">MULTIVERSE MOUSE</h1>
          <p className="text-slate-400 text-center mb-8 font-mono text-sm">&gt; Custom content portal. New drops weekly.</p>

          <div className={`px-4 py-2 rounded-lg text-sm mb-8 font-mono border ${adminState.isShopOpen ? "border-cyan-500 text-cyan-400 bg-cyan-500/10" : "border-slate-700 text-slate-500 bg-slate-900/50"}`}>
            {adminState.isShopOpen ? "STORE_STATUS: ONLINE" : "STORE_STATUS: <OFFLINE>"}
          </div>

          <div className="w-full max-w-lg flex flex-col gap-4 mb-8">
            <PortalCard icon={<PatreonIcon />} label="Enter the Patreon" sublabel="EXCLUSIVE_CONTENT" variant="primary" href="https://www.patreon.com/DirtySecretAi" />
            <PortalCard icon={<InstagramIcon />} label="Main Instagram" sublabel="@MULTIVERSEMOUSE" variant="default" href="https://www.instagram.com/multiuniverseai" />
          </div>

          <div className="w-full max-w-lg rounded-xl border border-slate-700/50 bg-slate-900/40 p-5">
            <div className="flex items-center gap-2 mb-4">
              <Terminal className="w-4 h-4 text-cyan-400" />
              <span className="text-sm font-mono text-cyan-400">echo_chamber</span>
            </div>
            {visibleName && (
              <Input type="text" placeholder="Enter name..." value={userName} onChange={(e) => setUserName(e.target.value)} className="bg-slate-950 border-slate-700 text-white mb-3" />
            )}
            <Textarea placeholder="What should I create next?" value={echoMessage} onChange={(e) => setEchoMessage(e.target.value)} className="bg-slate-950 border-slate-700 text-white mb-4 resize-none" />
            {submitSuccess && <div className="mb-4 text-cyan-400 text-center">✓ TRANSMISSION_RECEIVED</div>}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Switch checked={visibleName} onCheckedChange={setVisibleName} className="data-[state=checked]:bg-cyan-500" />
                <span className="text-slate-400 text-sm font-mono">visible_name</span>
              </div>
              <Button onClick={handleSubmitEcho} disabled={!echoMessage.trim() || isTransmitting} className="bg-cyan-500 hover:bg-cyan-400 text-black font-mono">
                {isTransmitting ? "SENDING..." : "TRANSMIT"}
              </Button>
            </div>
          </div>
        </div>

        <div className="hidden lg:block h-[calc(100vh-48px)] sticky top-6">
          <VerticalCarousel images={rightCarouselImages} side="right" />
        </div>
      </main>
    </div>
  )
}

