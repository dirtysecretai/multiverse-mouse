"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Sparkles, Zap, Crown, ArrowLeft, Terminal, CheckCircle } from "lucide-react"
import Link from "next/link"

interface CommissionTierProps {
  title: string
  price: string
  description: string
  features: string[]
  icon: React.ReactNode
  accentColor: "cyan" | "fuchsia" | "gradient"
  commandName: string
}

interface AdminState {
  isShopOpen: boolean
  isMaintenanceMode: boolean
}

function CommissionTierCard({ title, price, description, features, icon, accentColor, commandName }: CommissionTierProps) {
  const [isHovered, setIsHovered] = useState(false)

  const getBorderColor = () => {
    switch (accentColor) {
      case "cyan":
        return "border-cyan-500/30 hover:border-cyan-400/60"
      case "fuchsia":
        return "border-fuchsia-500/30 hover:border-fuchsia-400/60"
      case "gradient":
        return "border-cyan-500/30 hover:border-fuchsia-400/60"
    }
  }

  const getGlowColor = () => {
    switch (accentColor) {
      case "cyan":
        return "hover:shadow-[0_0_40px_rgba(0,255,255,0.15),inset_0_0_60px_rgba(0,255,255,0.05)]"
      case "fuchsia":
        return "hover:shadow-[0_0_40px_rgba(255,0,255,0.15),inset_0_0_60px_rgba(255,0,255,0.05)]"
      case "gradient":
        return "hover:shadow-[0_0_50px_rgba(0,255,255,0.2),inset_0_0_80px_rgba(255,0,255,0.05)]"
    }
  }

  const getIconColor = () => {
    switch (accentColor) {
      case "cyan":
        return "text-cyan-400"
      case "fuchsia":
        return "text-fuchsia-400"
      case "gradient":
        return "text-fuchsia-400"
    }
  }

  const getTitleGradient = () => {
    switch (accentColor) {
      case "cyan":
        return "text-cyan-400"
      case "fuchsia":
        return "text-fuchsia-400"
      case "gradient":
        return "bg-gradient-to-r from-cyan-400 to-fuchsia-500 bg-clip-text text-transparent"
    }
  }

  const getButtonStyle = () => {
    switch (accentColor) {
      case "cyan":
        return "bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-400 border border-cyan-500/50 hover:border-cyan-400"
      case "fuchsia":
        return "bg-fuchsia-500/20 hover:bg-fuchsia-500/30 text-fuchsia-400 border border-fuchsia-500/50 hover:border-fuchsia-400"
      case "gradient":
        return "bg-gradient-to-r from-cyan-500 to-fuchsia-500 hover:from-cyan-400 hover:to-fuchsia-400 text-white border-0"
    }
  }

  const getCheckColor = () => {
    switch (accentColor) {
      case "cyan":
        return "text-cyan-400"
      case "fuchsia":
        return "text-fuchsia-400"
      case "gradient":
        return "text-cyan-400"
    }
  }

  return (
    <div
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className={`
        relative flex flex-col rounded-xl overflow-hidden
        bg-slate-900/50 backdrop-blur-xl
        border ${getBorderColor()} ${getGlowColor()}
        transition-all duration-500
      `}
    >
      {/* Terminal Header */}
      <div className="flex items-center gap-2 px-4 py-2 bg-slate-950/80 border-b border-slate-800/50">
        <div className="flex gap-1.5">
          <div className="w-2 h-2 rounded-full bg-red-500/70" />
          <div className="w-2 h-2 rounded-full bg-yellow-500/70" />
          <div className="w-2 h-2 rounded-full bg-green-500/70" />
        </div>
        <span className="text-[10px] font-mono text-slate-500 ml-2">{commandName}</span>
      </div>

      {/* Popular Badge */}
      {accentColor === "gradient" && (
        <div className="absolute top-12 right-4 px-3 py-1 rounded bg-gradient-to-r from-cyan-500 to-fuchsia-500 text-[10px] font-mono font-bold text-white uppercase tracking-wider shadow-[0_0_20px_rgba(0,255,255,0.3)]">
          RECOMMENDED
        </div>
      )}

      {/* Scanline Effect on Hover */}
      {isHovered && (
        <div className="absolute inset-0 pointer-events-none bg-[repeating-linear-gradient(0deg,transparent,transparent_2px,rgba(0,255,255,0.02)_2px,rgba(0,255,255,0.02)_4px)] z-10" />
      )}

      <div className="flex-1 p-6">
        {/* Icon */}
        <div className={`mb-4 ${getIconColor()}`}>
          <div className="inline-flex p-3 rounded-lg bg-slate-800/50 border border-slate-700/50">
            {icon}
          </div>
        </div>

        {/* Title */}
        <h3 className={`text-xl font-bold mb-2 ${getTitleGradient()}`}>{title}</h3>

        {/* Price */}
        <div className="mb-4 flex items-baseline gap-2">
          <span className="text-4xl font-black text-white font-mono">{price}</span>
          <span className="text-slate-500 text-sm font-mono">USD</span>
        </div>

        {/* Description */}
        <p className="text-slate-400 text-sm mb-6 leading-relaxed">{description}</p>

        {/* Features */}
        <ul className="space-y-3 mb-6">
          {features.map((feature, index) => (
            <li key={index} className="flex items-start gap-3 text-sm text-slate-300">
              <CheckCircle className={`w-4 h-4 mt-0.5 flex-shrink-0 ${getCheckColor()}`} />
              <span>{feature}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* Footer */}
      <div className="p-6 pt-0">
        <Button className={`w-full h-12 font-mono font-semibold ${getButtonStyle()}`}>
          SELECT_TIER
        </Button>
      </div>

      {/* Corner Accents */}
      <div className={`absolute top-10 left-0 w-8 h-[2px] ${accentColor === "fuchsia" ? "bg-fuchsia-500/50" : "bg-cyan-500/50"}`} />
      <div className={`absolute bottom-0 right-0 w-8 h-[2px] ${accentColor === "fuchsia" ? "bg-fuchsia-500/50" : "bg-cyan-500/50"}`} />
    </div>
  )
}

export default function CommissionsPage() {
  const [adminState, setAdminState] = useState<AdminState>({
    isShopOpen: false,
    isMaintenanceMode: false,
  })

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

  const commissionTiers: CommissionTierProps[] = [
    {
      title: "Basic Edit",
      price: "$15",
      description: "Quick edits and simple modifications to existing content. Perfect for minor touch-ups.",
      features: [
        "Color corrections & grading",
        "Simple text overlays",
        "Basic transitions & cuts",
        "1-2 day turnaround",
        "One revision included",
      ],
      icon: <Zap className="w-6 h-6" />,
      accentColor: "cyan",
      commandName: "tier --basic",
    },
    {
      title: "Full Custom",
      price: "$45",
      description: "Complete custom creation tailored to your vision. The full multiverse experience.",
      features: [
        "Full custom design & concept",
        "Advanced VFX & effects",
        "Multiple revisions included",
        "3-5 day turnaround",
        "Source files included",
        "Priority support",
      ],
      icon: <Sparkles className="w-6 h-6" />,
      accentColor: "gradient",
      commandName: "tier --custom",
    },
    {
      title: "Multiverse Exclusive",
      price: "$100",
      description: "Premium tier with exclusive features and priority support. For serious creators only.",
      features: [
        "Everything in Full Custom",
        "Priority queue placement",
        "Unlimited revisions",
        "Exclusive effects pack",
        "24hr express option",
        "1-on-1 consultation call",
        "Behind-the-scenes assets",
      ],
      icon: <Crown className="w-6 h-6" />,
      accentColor: "fuchsia",
      commandName: "tier --exclusive",
    },
  ]

  // If shop is closed, show message
  if (!adminState.isShopOpen) {
    return (
      <div className="min-h-screen bg-[#050810] flex flex-col items-center justify-center px-4 relative overflow-hidden">
        {/* Grid Background */}
        <div className="absolute inset-0 bg-[linear-gradient(rgba(0,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(0,255,255,0.02)_1px,transparent_1px)] bg-[size:40px_40px]" />
        
        <div className="relative text-center max-w-md">
          <div className="inline-flex p-4 rounded-xl bg-slate-900/60 border border-slate-700/50 mb-6">
            <Terminal className="w-12 h-12 text-slate-600" />
          </div>
          
          <h1 className="text-2xl font-bold text-white mb-3">Commissions Paused</h1>
          <p className="text-slate-400 mb-6">
            The commission queue is currently closed. Check back when the store is online.
          </p>
          
          <Link href="/">
            <Button className="bg-slate-800 hover:bg-slate-700 text-white border border-slate-700">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Return to Portal
            </Button>
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#050810] relative overflow-hidden">
      {/* Grid Background */}
      <div className="fixed inset-0 bg-[linear-gradient(rgba(0,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(0,255,255,0.02)_1px,transparent_1px)] bg-[size:40px_40px] pointer-events-none" />
      
      {/* Ambient Glows */}
      <div className="fixed top-0 left-1/4 w-[600px] h-[400px] bg-cyan-500/10 rounded-full blur-[150px] pointer-events-none" />
      <div className="fixed bottom-0 right-1/4 w-[600px] h-[400px] bg-fuchsia-500/10 rounded-full blur-[150px] pointer-events-none" />

      {/* Header */}
      <header className="relative border-b border-slate-800/50 bg-slate-950/50 backdrop-blur-sm">
        <div className="max-w-6xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <Link href="/" className="flex items-center gap-3 text-slate-400 hover:text-white transition-colors group">
              <div className="p-2 rounded-lg bg-slate-800/50 border border-slate-700/50 group-hover:border-cyan-500/30 transition-colors">
                <ArrowLeft className="w-4 h-4" />
              </div>
              <span className="text-sm font-mono">cd ../portal</span>
            </Link>

            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse shadow-[0_0_8px_rgba(0,255,255,0.8)]" />
              <span className="text-xs font-mono text-cyan-400">STORE_ONLINE</span>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="relative max-w-6xl mx-auto px-6 py-12">
        {/* Page Title */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-900/60 border border-cyan-500/20 mb-6">
            <Terminal className="w-4 h-4 text-cyan-400" />
            <span className="text-xs font-mono text-cyan-400/70">multiverse@commissions:~</span>
          </div>

          <h1 className="text-4xl md:text-5xl font-black italic mb-4 bg-gradient-to-r from-cyan-400 via-white to-fuchsia-500 bg-clip-text text-transparent">
            COMMISSION TIERS
          </h1>
          
          <p className="text-slate-400 max-w-xl mx-auto font-mono text-sm">
            <span className="text-cyan-500">&gt;</span> Select your tier and let&apos;s create something extraordinary.
          </p>
        </div>

        {/* Tiers Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
          {commissionTiers.map((tier) => (
            <CommissionTierCard key={tier.title} {...tier} />
          ))}
        </div>

        {/* Bottom Info */}
        <div className="text-center">
          <div className="inline-flex flex-col items-center p-6 rounded-xl bg-slate-900/40 border border-slate-700/50">
            <p className="text-slate-400 text-sm mb-3">
              <span className="text-fuchsia-400 font-mono">?</span> Questions about a tier?
            </p>
            <p className="text-slate-500 text-xs font-mono">
              DM on Instagram or drop a message in the Echo Chamber
            </p>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="relative py-6 text-center text-slate-600 text-xs font-mono border-t border-slate-800/50">
        <span className="text-cyan-500/50">&gt;</span> © 2026 AI DESIGN STUDIO <span className="text-fuchsia-500/50">//</span> ALL_RIGHTS_RESERVED
      </footer>
    </div>
  )
}