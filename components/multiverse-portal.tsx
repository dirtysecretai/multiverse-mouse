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
  <svg viewBox="0 0 24 24" className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
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

interface PortalCardProps {
  icon: React.ReactNode
  label: string
  sublabel: string
  variant: "primary" | "default" | "secondary"
  href: string
}

// --- COMPONENTS ---
function PortalCard({ icon, label, sublabel, variant, href }: PortalCardProps) {
  const [isHovered, setIsHovered] = useState(false)
  const getCardStyle = () => {
    switch (variant) {
      case "primary": return "border-cyan-500/40 bg-gradient-to-br from-cyan-500/10 via-slate-900/50 to-cyan-500/5 hover:shadow-[0_0_40px_rgba(0,255,255,0.15)]"
      case "secondary": return "border-fuchsia-500/30 bg-gradient-to-br from-fuchsia-500/10 via-slate-900/50 to-fuchsia-500/5 hover:shadow-[0_0_40px_rgba(255,0,255,0.12)]"
      default: return "border-slate-700/50 bg-gradient-to-br from-slate-800/50 via-slate-900/50 to-slate-800/50"
    }
  }

  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className="block group" onMouseEnter={() => setIsHovered(true)} onMouseLeave={() => setIsHovered(false)}>
      <div className={`relative p-5 rounded-xl border transition-all duration-300 overflow-hidden ${getCardStyle()}`}>
        <div className="relative z-10 flex items-center gap-4">
          <div className={`p-4 rounded-xl border ${variant === 'primary' ? 'text-cyan-400 border-cyan-500/30' : variant === 'secondary' ? 'text-fuchsia-400 border-fuchsia-500/30' : 'text-slate-400 border-slate-700/50'}`}>
            {icon}
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-bold text-white group-hover:text-cyan-400 transition-colors">{label}</h3>
            <p className="text-sm text-slate-400 font-mono uppercase tracking-wider">{sublabel}</p>
          </div>
          <ExternalLink className="w-5 h-5 text-slate-400 group-hover:text-cyan-400" />
        </div>
      </div>
    </a>
  )
}

function VerticalCarousel({ images, side }: { images: CarouselImage[]; side: string }) {
  const [currentIndex, setCurrentIndex] = useState(0)
  useEffect(() => {
    const interval = setInterval(() => setCurrentIndex((prev) => (prev + 1) % images.length), 4000)
    return () => clearInterval(interval)
  }, [images.length])

  return (
    <div className="h-full flex flex-col border-x border-cyan-500/20 bg-slate-950/50 overflow-hidden relative">
      <div className="flex-1 transition-transform duration-700 ease-out" style={{ transform: `translateY(-${currentIndex * 100}%)` }}>
        {images.map((img) => (
          <div key={img.id} className="h-full w-full relative">
            <img src={img.url} alt={img.alt} className="w-full h-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-transparent to-slate-950/40" />
          </div>
        ))}
      </div>
    </div>
  )
}

export default function MultiversePortal() {
  const [adminState, setAdminState] = useState<AdminState>({ isShopOpen: false, isMaintenanceMode: false })
  const [echoMessage, setEchoMessage] = useState("")
  const [visibleName, setVisibleName] = useState(false)
  const [userName, setUserName] = useState("")
  const [isTransmitting, setIsTransmitting] = useState(false)
  const [submitSuccess, setSubmitSuccess] = useState(false)

  // RESTORED 20 IMAGES
  const leftImages: CarouselImage[] = [
    { id: "1", url: "https://i.imgur.com/VAviOOl.jpeg", alt: "1" }, { id: "2", url: "https://i.imgur.com/JjGdipN.jpeg", alt: "2" },
    { id: "3", url: "https://i.imgur.com/jfLcnuN.jpeg", alt: "3" }, { id: "4", url: "https://i.imgur.com/jZevNYN.png", alt: "4" },
    { id: "5", url: "https://i.imgur.com/OZmPGdW.jpeg", alt: "5" }, { id: "6", url: "https://i.imgur.com/McL3pRS.jpeg", alt: "6" },
    { id: "7", url: "https://i.imgur.com/7Si0CqR.jpeg", alt: "7" }, { id: "8", url: "https://i.imgur.com/6Hy6d7a.jpeg", alt: "8" },
    { id: "9", url: "https://i.imgur.com/MHxSiU7.jpeg", alt: "9" }, { id: "10", url: "https://i.imgur.com/GmQLP3O.jpeg", alt: "10" },
  ]

  const rightImages: CarouselImage[] = [
    { id: "11", url: "https://i.imgur.com/YY45ukt.jpeg", alt: "11" }, { id: "12", url: "https://i.imgur.com/NUZIGgf.jpeg", alt: "12" },
    { id: "13", url: "https://i.imgur.com/a3lTUTN.jpeg", alt: "13" }, { id: "14", url: "https://i.imgur.com/JB1y5an.png", alt: "14" },
    { id: "15", url: "https://i.imgur.com/LhfxYdE.jpeg", alt: "15" }, { id: "16", url: "https://i.imgur.com/DhGNK5c.jpeg", alt: "16" },
    { id: "17", url: "https://i.imgur.com/jqZi1t2.jpeg", alt: "17" }, { id: "18", url: "https://i.imgur.com/JhQqsYs.jpeg", alt: "18" },
    { id: "19", url: "https://i.imgur.com/L3uqQTb.jpeg", alt: "19" }, { id: "20", url: "https://i.imgur.com/1rbyw9S.jpeg", alt: "20" },
  ]

  useEffect(() => {
    const fetchConfig = async () => {
      const res = await fetch('/api/admin/config')
      if (res.ok) {
        const data = await res.json()
        setAdminState({ isShopOpen: !!data.isShopOpen, isMaintenanceMode: !!data.isMaintenanceMode })
      }
    }
    fetchConfig()
    const int = setInterval(fetchConfig, 30000)
    return () => clearInterval(int)
  }, [])

  const handleSubmit = async () => {
    if (!echoMessage.trim()) return
    setIsTransmitting(true)
    try {
      const res = await fetch('/api/echo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: visibleName ? userName : "Anonymous", message: echoMessage, visibleName })
      })
      if (res.ok) {
        setEchoMessage(""); setSubmitSuccess(true); setTimeout(() => setSubmitSuccess(false), 3000)
      }
    } catch (e) { alert("Signal lost.") } finally { setIsTransmitting(false) }
  }

  if (adminState.isMaintenanceMode) {
    return (
      <div className="min-h-screen bg-[#050810] flex flex-col items-center justify-center p-4">
        <h1 className="text-4xl font-black italic text-cyan-400 mb-8">MULTIVERSE MOUSE</h1>
        <div className="w-full max-w-lg space-y-4">
          <PortalCard icon={<PatreonIcon />} label="Enter the Patreon" sublabel="EXCLUSIVE_CONTENT" variant="primary" href="https://www.patreon.com/DirtySecretAi" />
          <PortalCard icon={<InstagramIcon />} label="Main Instagram" sublabel="@MULTIVERSEMOUSE" variant="default" href="https://www.instagram.com/multiuniverseai" />
          <PortalCard icon={<InstagramIcon />} label="Backup Portal #1" sublabel="@DSECRETAI" variant="secondary" href="https://www.instagram.com/dsecretai" />
          <PortalCard icon={<InstagramIcon />} label="Backup Portal #2" sublabel="@SYNTHETICARCADIA" variant="secondary" href="https://www.instagram.com/syntheticarcadia" />
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#050810] grid grid-cols-1 lg:grid-cols-[300px_1fr_300px] gap-6 p-6">
      <aside className="hidden lg:block h-[calc(100vh-48px)] sticky top-6"><VerticalCarousel images={leftImages} side="left" /></aside>
      <main className="flex flex-col items-center py-8">
        <h1 className="text-4xl font-black italic mb-8 text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-fuchsia-500">MULTIVERSE MOUSE</h1>
        <div className="w-full max-w-lg space-y-4 mb-8">
          <PortalCard icon={<PatreonIcon />} label="Enter the Patreon" sublabel="EXCLUSIVE_CONTENT" variant="primary" href="https://www.patreon.com/DirtySecretAi" />
          <PortalCard icon={<InstagramIcon />} label="Main Instagram" sublabel="@MULTIVERSEMOUSE" variant="default" href="https://www.instagram.com/multiuniverseai" />
          <PortalCard icon={<InstagramIcon />} label="Backup Portal #1" sublabel="@DSECRETAI" variant="secondary" href="https://www.instagram.com/dsecretai" />
          <PortalCard icon={<InstagramIcon />} label="Backup Portal #2" sublabel="@SYNTHETICARCADIA" variant="secondary" href="https://www.instagram.com/syntheticarcadia" />
        </div>
        <div className="w-full max-w-lg bg-slate-900/40 p-5 rounded-xl border border-slate-700/50">
          <div className="flex items-center gap-2 mb-4 text-cyan-400 font-mono text-sm"><Terminal className="w-4 h-4" /> echo_chamber</div>
          {visibleName && <Input value={userName} onChange={(e) => setUserName(e.target.value)} placeholder="Name..." className="bg-slate-950 mb-3" />}
          <Textarea value={echoMessage} onChange={(e) => setEchoMessage(e.target.value)} placeholder="Message..." className="bg-slate-950 mb-4 resize-none" />
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-2 text-sm text-slate-400"><Switch checked={visibleName} onCheckedChange={setVisibleName} /> visible_name</div>
            <Button onClick={handleSubmit} disabled={isTransmitting || !echoMessage.trim()} className="bg-cyan-500 text-black font-mono">{isTransmitting ? "SENDING..." : "TRANSMIT"}</Button>
          </div>
          {submitSuccess && <p className="mt-4 text-cyan-400 text-center">✓ TRANSMISSION_RECEIVED</p>}
        </div>
      </main>
      <aside className="hidden lg:block h-[calc(100vh-48px)] sticky top-6"><VerticalCarousel images={rightImages} side="right" /></aside>
    </div>
  )
}

