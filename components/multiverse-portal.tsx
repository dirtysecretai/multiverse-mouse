"use client"

import { useState, useEffect, useRef } from "react"
import { Switch } from "@/components/ui/switch"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Send, AlertTriangle, ChevronUp, ChevronDown, ExternalLink, Terminal } from "lucide-react"
import Link from "next/link"

// Icons for Patreon and Instagram
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
  id: string
  message: string
  visibleName: boolean
  name?: string
  timestamp: number
}

interface PortalCardProps {
  icon: React.ReactNode
  label: string
  sublabel: string
  variant: "primary" | "default" | "secondary"
  href: string
  thumbnailUrl?: string
}

// Portal Card Component - Larger, more visual cards
function PortalCard({ icon, label, sublabel, variant, href, thumbnailUrl }: PortalCardProps) {
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
        {/* Background Pattern */}
        <div className="absolute inset-0 bg-[repeating-linear-gradient(45deg,transparent,transparent_10px,rgba(0,255,255,0.02)_10px,rgba(0,255,255,0.02)_20px)] opacity-0 group-hover:opacity-100 transition-opacity" />
        
        {/* Scanline Effect on Hover */}
        {isHovered && (
          <div className="absolute inset-0 pointer-events-none bg-[repeating-linear-gradient(0deg,transparent,transparent_2px,rgba(255,255,255,0.02)_2px,rgba(255,255,255,0.02)_4px)]" />
        )}

        <div className="relative z-10 flex items-center gap-4">
          {/* Left: Icon + Thumbnail */}
          <div className="flex-shrink-0">
            <div className={`p-4 rounded-xl border transition-all duration-300 ${getIconColor()}`}>
              {icon}
            </div>
          </div>

          {/* Center: Text Content */}
          <div className="flex-1 min-w-0">
            <h3 className="text-lg font-bold text-white mb-1 group-hover:text-cyan-400 transition-colors">
              {label}
            </h3>
            <p className="text-sm text-slate-400 font-mono uppercase tracking-wider">
              {sublabel}
            </p>
          </div>

          {/* Right: Arrow */}
          <div className="flex-shrink-0">
            <div className="p-2 rounded-lg bg-slate-800/50 border border-slate-700/50 group-hover:border-cyan-500/50 group-hover:bg-cyan-500/10 transition-all">
              <ExternalLink className="w-5 h-5 text-slate-400 group-hover:text-cyan-400 transition-colors" />
            </div>
          </div>
        </div>

        {/* Bottom Accent Line */}
        <div className={`absolute bottom-0 left-0 right-0 h-[2px] ${getAccentColor()} transform scale-x-0 group-hover:scale-x-100 transition-transform duration-300 origin-left`} />
        
        {/* Corner Accents */}
        <div className={`absolute top-0 right-0 w-12 h-[2px] ${getAccentColor()} opacity-50`} />
        <div className={`absolute bottom-0 left-0 w-12 h-[2px] ${getAccentColor()} opacity-50`} />
      </div>
    </a>
  )
}

// Vertical Carousel Component with 9:16 Aspect Ratio
function VerticalCarousel({ 
  images, 
  side 
}: { 
  images: CarouselImage[]
  side: "left" | "right" 
}) {
  const [currentIndex, setCurrentIndex] = useState(0)
  const [isAutoPlaying, setIsAutoPlaying] = useState(true)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!isAutoPlaying || images.length === 0) return
    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % images.length)
    }, 4000)
    return () => clearInterval(interval)
  }, [isAutoPlaying, images.length])

  const goUp = () => {
    setCurrentIndex((prev) => (prev - 1 + images.length) % images.length)
    setIsAutoPlaying(false)
  }

  const goDown = () => {
    setCurrentIndex((prev) => (prev + 1) % images.length)
    setIsAutoPlaying(false)
  }

  if (images.length === 0) {
    return (
      <div className="h-full flex flex-col">
        {/* Terminal Header */}
        <div className="flex items-center gap-2 px-3 py-2 bg-slate-900/80 border-b border-cyan-500/30">
          <div className="flex gap-1.5">
            <div className="w-2 h-2 rounded-full bg-red-500/70" />
            <div className="w-2 h-2 rounded-full bg-yellow-500/70" />
            <div className="w-2 h-2 rounded-full bg-green-500/70" />
          </div>
          <span className="text-[10px] font-mono text-cyan-400/70 uppercase tracking-wider">
            {side === "left" ? "feed_01" : "feed_02"}
          </span>
        </div>

        {/* Empty State */}
        <div className="flex-1 flex items-center justify-center border-x border-cyan-500/20 bg-slate-950/50">
          <div className="text-center p-4">
            <div className="w-16 h-16 mx-auto mb-3 rounded-lg border border-dashed border-cyan-500/30 flex items-center justify-center">
              <Terminal className="w-6 h-6 text-cyan-500/30" />
            </div>
            <p className="text-[10px] font-mono text-slate-600 uppercase">No data stream</p>
          </div>
        </div>

        {/* Terminal Footer */}
        <div className="px-3 py-2 bg-slate-900/80 border-t border-cyan-500/30">
          <div className="flex items-center justify-between">
            <span className="text-[9px] font-mono text-slate-600">0 / 0</span>
            <div className="flex gap-1">
              <div className="w-1.5 h-1.5 rounded-full bg-slate-700" />
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div 
      ref={containerRef}
      className="h-full flex flex-col group"
      onMouseEnter={() => setIsAutoPlaying(false)}
      onMouseLeave={() => setIsAutoPlaying(true)}
    >
      {/* Terminal Header */}
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
        <button
          onClick={goUp}
          className="p-1 rounded hover:bg-cyan-500/20 text-cyan-400/50 hover:text-cyan-400 transition-colors"
        >
          <ChevronUp className="w-4 h-4" />
        </button>
      </div>

      {/* Image Container with 9:16 Aspect Ratio */}
      <div className="flex-1 relative overflow-hidden border-x border-cyan-500/20 bg-slate-950/50">
        {/* Scanline Effect */}
        <div className="absolute inset-0 pointer-events-none z-10 bg-[repeating-linear-gradient(0deg,transparent,transparent_2px,rgba(0,255,255,0.03)_2px,rgba(0,255,255,0.03)_4px)]" />
        
        {/* Corner Decorations */}
        <div className="absolute top-0 left-0 w-4 h-4 border-t-2 border-l-2 border-cyan-500/50 z-20" />
        <div className="absolute top-0 right-0 w-4 h-4 border-t-2 border-r-2 border-cyan-500/50 z-20" />
        <div className="absolute bottom-0 left-0 w-4 h-4 border-b-2 border-l-2 border-cyan-500/50 z-20" />
        <div className="absolute bottom-0 right-0 w-4 h-4 border-b-2 border-r-2 border-cyan-500/50 z-20" />

        {/* Images with 9:16 Aspect Ratio Enforced */}
        <div 
          className="absolute inset-0 transition-transform duration-700 ease-out"
          style={{ transform: `translateY(-${currentIndex * 100}%)` }}
        >
          {images.map((image, index) => (
            <div 
              key={image.id} 
              className="absolute w-full h-full flex items-center justify-center"
              style={{ top: `${index * 100}%` }}
            >
              <div className="w-full aspect-[9/16]">
                <img
                  src={image.url}
                  alt={image.alt}
                  className="w-full h-full object-cover"
                />
              </div>
              {/* Image Overlay */}
              <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-transparent to-slate-950/40" />
            </div>
          ))}
        </div>

        {/* Glitch Line Animation */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden z-20">
          <div className="absolute w-full h-[2px] bg-cyan-400/30 animate-scan" />
        </div>
      </div>

      {/* Terminal Footer */}
      <div className="flex items-center justify-between px-3 py-2 bg-slate-900/80 border-t border-cyan-500/30">
        <span className="text-[9px] font-mono text-slate-500">
          {currentIndex + 1} / {images.length}
        </span>
        <button
          onClick={goDown}
          className="p-1 rounded hover:bg-cyan-500/20 text-cyan-400/50 hover:text-cyan-400 transition-colors"
        >
          <ChevronDown className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}

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

  // Load admin state from localStorage
  useEffect(() => {
    const savedState = localStorage.getItem("multiverse-admin-state")
    if (savedState) {
      try {
        setAdminState(JSON.parse(savedState))
      } catch (error) {
        console.error("Failed to parse admin state:", error)
      }
    }

    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === "multiverse-admin-state" && e.newValue) {
        try {
          setAdminState(JSON.parse(e.newValue))
        } catch (error) {
          console.error("Failed to parse admin state from storage event:", error)
        }
      }
    }

    window.addEventListener("storage", handleStorageChange)
    return () => window.removeEventListener("storage", handleStorageChange)
  }, [])

  const handleSubmitEcho = async () => {
    if (!echoMessage.trim()) return

    setIsTransmitting(true)

    try {
      // This sends the data to your new /api/echo/route.ts file
      const response = await fetch('/api/echo', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: visibleName ? userName : "Anonymous",
          message: echoMessage,
          visibleName: visibleName,
        }),
      })

      if (!response.ok) throw new Error('Failed to transmit')

      // If successful, clear the form and show the success message
      setEchoMessage("")
      setUserName("")
      setSubmitSuccess(true)
      setTimeout(() => setSubmitSuccess(false), 3000)
      
      console.log("Transmission saved to the cloud database.")
    } catch (error) {
      console.error("Transmission failed:", error)
      alert("The signal was lost. Please try again.")
    } finally {
      setIsTransmitting(false)
    }
  }

  /* Sample carousel images - replace these URLs with your actual images
  const leftCarouselImages: CarouselImage[] = [
    { id: "1", url: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=400&h=711&fit=crop", alt: "Content 1" },
    { id: "2", url: "https://images.unsplash.com/photo-1618556450994-a6a128ef0d9d?w=400&h=711&fit=crop", alt: "Content 2" },
    { id: "3", url: "https://images.unsplash.com/photo-1634017839464-5c339ebe3cb4?w=400&h=711&fit=crop", alt: "Content 3" },
  ]

  const rightCarouselImages: CarouselImage[] = [
    { id: "4", url: "https://images.unsplash.com/photo-1618005198919-d3d4b5a92ead?w=400&h=711&fit=crop", alt: "Content 4" },
    { id: "5", url: "https://images.unsplash.com/photo-1618556450991-2f1af64e8191?w=400&h=711&fit=crop", alt: "Content 5" },
    { id: "6", url: "https://images.unsplash.com/photo-1634017839489-5c21ca0ed0e5?w=400&h=711&fit=crop", alt: "Content 6" },
  ] */

 // Launch carousel images - Left feed
  const leftCarouselImages: CarouselImage[] = [
    { id: "1", url: "https://i.imgur.com/VAviOOl.jpeg", alt: "Multiverse Content 1" },
    { id: "2", url: "https://i.imgur.com/JjGdipN.jpeg", alt: "Multiverse Content 2" },
    { id: "3", url: "https://i.imgur.com/jfLcnuN.jpeg", alt: "Multiverse Content 3" },
    { id: "4", url: "https://i.imgur.com/jZevNYN.png", alt: "Multiverse Content 4" },
    { id: "5", url: "https://i.imgur.com/OZmPGdW.jpeg", alt: "Multiverse Content 5" },
    { id: "6", url: "https://i.imgur.com/McL3pRS.jpeg", alt: "Multiverse Content 6" },
    { id: "7", url: "https://i.imgur.com/7Si0CqR.jpeg", alt: "Multiverse Content 7" },
    { id: "8", url: "https://i.imgur.com/6Hy6d7a.jpeg", alt: "Multiverse Content 8" },
    { id: "9", url: "https://i.imgur.com/MHxSiU7.jpeg", alt: "Multiverse Content 9" },
    { id: "10", url: "https://i.imgur.com/GmQLP3O.jpeg", alt: "Multiverse Content 10" },
  ]

  // Launch carousel images - Right feed
  const rightCarouselImages: CarouselImage[] = [
    { id: "11", url: "https://i.imgur.com/YY45ukt.jpeg", alt: "Multiverse Content 11" },
    { id: "12", url: "https://i.imgur.com/NUZIGgf.jpeg", alt: "Multiverse Content 12" },
    { id: "13", url: "https://i.imgur.com/a3lTUTN.jpeg", alt: "Multiverse Content 13" },
    { id: "14", url: "https://i.imgur.com/JB1y5an.png", alt: "Multiverse Content 14" },
    { id: "15", url: "https://i.imgur.com/LhfxYdE.jpeg", alt: "Multiverse Content 15" },
    { id: "16", url: "https://i.imgur.com/DhGNK5c.jpeg", alt: "Multiverse Content 16" },
    { id: "17", url: "https://i.imgur.com/jqZi1t2.jpeg", alt: "Multiverse Content 17" },
    { id: "18", url: "https://i.imgur.com/JhQqsYs.jpeg", alt: "Multiverse Content 18" },
    { id: "19", url: "https://i.imgur.com/L3uqQTb.jpeg", alt: "Multiverse Content 19" },
    { id: "20", url: "https://i.imgur.com/1rbyw9S.jpeg", alt: "Multiverse Content 20" },
  ]
// FULL MAINTENANCE MODE - Show only centered screen
  if (adminState.isMaintenanceMode) {
    return (
      <div className="min-h-screen bg-[#050810] flex flex-col items-center justify-center px-4 relative overflow-hidden">
        {/* Grid Background */}
        <div className="fixed inset-0 bg-[linear-gradient(rgba(0,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(0,255,255,0.02)_1px,transparent_1px)] bg-[size:40px_40px] pointer-events-none" />
        
        {/* Ambient Glows */}
        <div className="fixed top-0 left-1/4 w-[800px] h-[600px] bg-cyan-500/5 rounded-full blur-[150px] pointer-events-none" />
        <div className="fixed bottom-0 right-1/4 w-[800px] h-[600px] bg-fuchsia-500/5 rounded-full blur-[150px] pointer-events-none" />

        <div className="relative text-center max-w-2xl w-full">
          {/* Terminal Header */}
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-slate-900/60 border border-yellow-500/30 rounded-lg mb-8">
            <AlertTriangle className="w-4 h-4 text-yellow-400" />
            <span className="text-xs font-mono text-yellow-400">SYSTEM_MAINTENANCE</span>
          </div>

          {/* Title */}
          <h1 className="text-5xl md:text-6xl font-black italic text-center mb-6 bg-gradient-to-r from-cyan-400 via-white to-fuchsia-500 bg-clip-text text-transparent drop-shadow-[0_0_40px_rgba(0,255,255,0.4)]">
            MULTIVERSE MOUSE
          </h1>

          {/* Maintenance Message */}
          <div className="mb-12 p-6 rounded-xl border border-yellow-500/30 bg-yellow-500/5 backdrop-blur-sm">
            <div className="flex items-center justify-center gap-3 mb-3">
              <div className="w-3 h-3 rounded-full bg-yellow-400 animate-pulse shadow-[0_0_12px_rgba(250,204,21,0.8)]" />
              <h2 className="text-2xl font-bold text-yellow-400 font-mono">SYSTEMS OFFLINE</h2>
            </div>
            <p className="text-slate-400 font-mono text-sm">
              <span className="text-yellow-500">&gt;</span> Portal undergoing maintenance. Normal operations will resume shortly.
            </p>
          </div>

          {/* Portal Cards - Only show social links */}
          <div className="space-y-4 mb-8">
            <PortalCard 
              icon={<PatreonIcon />} 
              label="Enter the Patreon" 
              sublabel="EXCLUSIVE_CONTENT"
              variant="primary"
              href="https://www.patreon.com/multiversemouse"
            />
            
            <PortalCard 
              icon={<InstagramIcon />} 
              label="Main Instagram" 
              sublabel="@MULTIVERSEMOUSE"
              variant="default"
              href="https://www.instagram.com/multiversemouse"
            />
            
            <PortalCard 
              icon={<InstagramIcon />} 
              label="Backup Portal #1" 
              sublabel="@MULTIVERSE.BACKUP1"
              variant="secondary"
              href="https://www.instagram.com/crockettmouseart"
            />
            
            <PortalCard 
              icon={<InstagramIcon />} 
              label="Backup Portal #2" 
              sublabel="@MULTIVERSE.BACKUP2"
              variant="secondary"
              href="https://www.instagram.com/syntheticarcadia"
            />
          </div>

          {/* Footer Message */}
          <p className="text-slate-600 text-xs font-mono">
            <span className="text-cyan-500/50">&gt;</span> © 2026 MULTIVERSE MOUSE LAB <span className="text-fuchsia-500/50">//</span> UNDER_MAINTENANCE
          </p>
        </div>
      </div>
    )
  }

  // NORMAL MODE - Full portal layout
  return (
    <div className="min-h-screen bg-[#050810] relative overflow-hidden">
      {/* Grid Background */}
      <div className="fixed inset-0 bg-[linear-gradient(rgba(0,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(0,255,255,0.02)_1px,transparent_1px)] bg-[size:40px_40px] pointer-events-none" />
      
      {/* Ambient Glows */}
      <div className="fixed top-0 left-1/4 w-[800px] h-[600px] bg-cyan-500/5 rounded-full blur-[150px] pointer-events-none" />
      <div className="fixed bottom-0 right-1/4 w-[800px] h-[600px] bg-fuchsia-500/5 rounded-full blur-[150px] pointer-events-none" />

      {/* Main Content Grid */}
      <main className="relative grid grid-cols-1 lg:grid-cols-[300px_1fr_300px] gap-6 max-w-7xl mx-auto px-6 py-6">
        {/* Left Carousel */}
        <div className="hidden lg:block h-[calc(100vh-48px)] sticky top-6">
          <div className="h-full rounded-xl border border-cyan-500/20 bg-slate-900/30 backdrop-blur-sm overflow-hidden shadow-[0_0_30px_rgba(0,255,255,0.05)]">
            <VerticalCarousel images={leftCarouselImages} side="left" />
          </div>
        </div>

        {/* Center Content */}
        <div className="flex flex-col items-center py-8 lg:py-12">
          {/* Terminal Header */}
          <div className="w-full max-w-lg mb-6">
            <div className="flex items-center gap-2 px-4 py-2 bg-slate-900/60 border border-cyan-500/20 rounded-t-lg">
              <div className="flex gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full bg-red-500" />
                <div className="w-2.5 h-2.5 rounded-full bg-yellow-500" />
                <div className="w-2.5 h-2.5 rounded-full bg-green-500" />
              </div>
              <span className="text-[11px] font-mono text-cyan-400/70 ml-2">multiverse@portal:~</span>
              <div className="flex-1" />
              <div className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse shadow-[0_0_8px_rgba(0,255,255,0.8)]" />
            </div>
          </div>

          {/* Title */}
          <h1 className="text-4xl md:text-5xl font-black italic text-center mb-3 bg-gradient-to-r from-cyan-400 via-white to-fuchsia-500 bg-clip-text text-transparent drop-shadow-[0_0_30px_rgba(0,255,255,0.3)]">
            MULTIVERSE MOUSE
          </h1>

          {/* Subtitle */}
          <p className="text-slate-400 text-center mb-4 font-mono text-sm">
            <span className="text-cyan-500">&gt;</span> Custom content portal. New drops weekly.
          </p>

          {/* Store Status */}
          <div
            className={`
              px-4 py-2 rounded-lg text-sm mb-8 font-mono
              border transition-all duration-300 relative overflow-hidden
              ${
                adminState.isShopOpen
                  ? "border-cyan-500/50 text-cyan-400 bg-cyan-500/10 shadow-[0_0_20px_rgba(0,255,255,0.1)]"
                  : "border-slate-700 text-slate-500 bg-slate-900/50"
              }
            `}
          >
            {adminState.isShopOpen && (
              <div className="absolute inset-0 bg-[repeating-linear-gradient(90deg,transparent,transparent_10px,rgba(0,255,255,0.03)_10px,rgba(0,255,255,0.03)_20px)]" />
            )}
            <span className="relative z-10 flex items-center gap-2">
              <span className={`w-2 h-2 rounded-full ${adminState.isShopOpen ? "bg-cyan-400 animate-pulse" : "bg-slate-600"}`} />
              {adminState.isShopOpen ? "STORE_STATUS: ONLINE" : "STORE_STATUS: <OFFLINE>"}
            </span>
          </div>

          {/* Commission Link (only when shop is open) */}
          {adminState.isShopOpen && (
            <Link
              href="/commissions"
              className="w-full max-w-lg mb-6 group"
            >
              <div className="relative p-5 rounded-xl border border-cyan-500/30 bg-gradient-to-r from-cyan-500/10 via-fuchsia-500/10 to-cyan-500/10 hover:from-cyan-500/20 hover:via-fuchsia-500/20 hover:to-cyan-500/20 transition-all duration-300 hover:shadow-[0_0_30px_rgba(0,255,255,0.15)] overflow-hidden">
                {/* Animated Border */}
                <div className="absolute inset-0 rounded-xl bg-gradient-to-r from-cyan-500 via-fuchsia-500 to-cyan-500 opacity-20 blur-sm group-hover:opacity-40 transition-opacity" />
                
                <div className="relative z-10 flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-bold text-white mb-1">Commission Tiers</h3>
                    <p className="text-sm text-slate-400 font-mono">
                      <span className="text-cyan-400">$15</span> - <span className="text-fuchsia-400">$100</span> // View pricing & packages
                    </p>
                  </div>
                  <div className="p-3 rounded-lg bg-slate-900/50 border border-cyan-500/30 group-hover:border-cyan-400/50 transition-colors">
                    <ExternalLink className="w-5 h-5 text-cyan-400" />
                  </div>
                </div>
              </div>
            </Link>
          )}

          {/* Portal Cards - Upgraded from buttons */}
          <div className="w-full max-w-lg flex flex-col gap-4 mb-8">
            <PortalCard 
              icon={<PatreonIcon />} 
              label="Enter the Patreon" 
              sublabel="EXCLUSIVE_CONTENT"
              variant="primary"
              href="https://www.patreon.com/DirtySecretAi"
            />
            
            <PortalCard 
              icon={<InstagramIcon />} 
              label="Main Instagram" 
              sublabel="@MULTIVERSEMOUSE"
              variant="default"
              href="https://www.instagram.com/multiuniverseai"
            />
            
            <PortalCard 
              icon={<InstagramIcon />} 
              label="Backup Portal #1" 
              sublabel="@MULTIVERSE.BACKUP1"
              variant="secondary"
              href="https://www.instagram.com/dsecretai"
            />
            
            <PortalCard 
              icon={<InstagramIcon />} 
              label="Backup Portal #2" 
              sublabel="@MULTIVERSE.BACKUP2"
              variant="secondary"
              href="https://www.instagram.com/syntheticarcadia"
            />
          </div>

          {/* Echo Chamber */}
          <div className="w-full max-w-lg rounded-xl border border-slate-700/50 bg-slate-900/40 backdrop-blur-sm overflow-hidden">
            {/* Echo Header */}
            <div className="flex items-center gap-2 px-4 py-3 bg-slate-900/60 border-b border-slate-700/50">
              <Terminal className="w-4 h-4 text-cyan-400" />
              <span className="text-sm font-mono text-cyan-400">echo_chamber</span>
              <div className="flex-1" />
              <span className="text-[10px] font-mono text-slate-600">INPUT_STREAM</span>
            </div>

            <div className="p-5">
              <p className="text-slate-400 text-sm mb-4">
                <span className="text-fuchsia-400 font-mono">&gt;</span> Have a custom request or an idea? Drop it here.
              </p>

              {/* Name Input - Shows when visible_name is ON */}
              {visibleName && (
                <Input
                  type="text"
                  placeholder="Enter alias/name..."
                  value={userName}
                  onChange={(e) => setUserName(e.target.value)}
                  className="bg-slate-950/50 border-slate-700/50 text-slate-200 placeholder:text-slate-600 mb-3 font-mono text-sm focus:border-cyan-500/50 focus:ring-cyan-500/20"
                />
              )}

              <Textarea
                placeholder="What should I create next?"
                value={echoMessage}
                onChange={(e) => setEchoMessage(e.target.value)}
                className="bg-slate-950/50 border-slate-700/50 text-slate-200 placeholder:text-slate-600 mb-4 min-h-[100px] resize-none font-mono text-sm focus:border-cyan-500/50 focus:ring-cyan-500/20"
              />

              {submitSuccess && (
                <div className="mb-4 p-3 rounded-lg bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 text-sm text-center font-mono">
                  <span className="text-green-400">✓</span> TRANSMISSION_RECEIVED
                </div>
              )}

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Switch
                    checked={visibleName}
                    onCheckedChange={setVisibleName}
                    className="data-[state=checked]:bg-cyan-500"
                  />
                  <span className="text-slate-400 text-sm font-mono">visible_name</span>
                </div>

                <Button 
                  onClick={handleSubmitEcho}
                  // This prevents double-sending while your cloud database is processing
                  disabled={!echoMessage.trim() || isTransmitting}
                  className="bg-cyan-500 hover:bg-cyan-400 text-black font-mono font-semibold gap-2 disabled:opacity-50 disabled:cursor-not-allowed min-w-[140px]"
                >
                  {isTransmitting ? (
                    <span className="flex items-center gap-2">
                      <div className="w-3 h-3 border-2 border-black/30 border-t-black rounded-full animate-spin" />
                      SENDING...
                    </span>
                  ) : (
                    <>
                      <Send className="w-4 h-4" />
                      TRANSMIT
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* Right Carousel */}
        <div className="hidden lg:block h-[calc(100vh-48px)] sticky top-6">
          <div className="h-full rounded-xl border border-fuchsia-500/20 bg-slate-900/30 backdrop-blur-sm overflow-hidden shadow-[0_0_30px_rgba(255,0,255,0.05)]">
            <VerticalCarousel images={rightCarouselImages} side="right" />
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="py-6 text-center text-slate-600 text-xs font-mono border-t border-slate-800/50">
        <span className="text-cyan-500/50">&gt;</span> © 2026 MULTIVERSE MOUSE LAB <span className="text-fuchsia-500/50">//</span> ALL_RIGHTS_RESERVED
      </footer>

      {/* Custom Styles for Scan Animation */}
      <style jsx global>{`
        @keyframes scan {
          0% { top: -2px; opacity: 0; }
          10% { opacity: 1; }
          90% { opacity: 1; }
          100% { top: 100%; opacity: 0; }
        }
        .animate-scan {
          animation: scan 3s linear infinite;
        }
      `}</style>
    </div>
  )
}

