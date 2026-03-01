"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { ArrowLeft, FlaskConical } from "lucide-react"
import { useRouter } from "next/navigation"
import Link from "next/link"

export default function AdminPrototypePage() {
  const router = useRouter()
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [password, setPassword] = useState("")

  useEffect(() => {
    const authStatus = localStorage.getItem("multiverse-admin-auth")
    const savedPassword = sessionStorage.getItem("admin-password")
    if (authStatus === "true" && savedPassword) {
      setIsAuthenticated(true)
    }
    setIsLoading(false)
  }, [])

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const response = await fetch('/api/admin/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password })
      })
      if (response.ok) {
        sessionStorage.setItem("admin-password", password)
        localStorage.setItem("multiverse-admin-auth", "true")
        setIsAuthenticated(true)
      } else {
        alert("Invalid password")
      }
    } catch {
      alert("Authentication failed")
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center">
        <div className="text-cyan-400 text-xl">Loading...</div>
      </div>
    )
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <div className="mb-8 text-center">
            <h1 className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-violet-400 to-purple-500 mb-2">
              PROTOTYPE LAB
            </h1>
            <p className="text-slate-500 text-sm">Authentication Required</p>
          </div>
          <form onSubmit={handleLogin} className="p-6 rounded-xl border border-slate-800 bg-slate-900/60 backdrop-blur-sm">
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter admin password"
              className="w-full p-3 rounded-lg bg-slate-950 border border-slate-700 text-white focus:border-violet-500 focus:outline-none mb-4"
            />
            <Button type="submit" className="w-full bg-gradient-to-r from-violet-500 to-purple-500 hover:from-violet-400 hover:to-purple-400 text-white font-bold">
              ACCESS PROTOTYPE LAB
            </Button>
          </form>
        </div>
      </div>
    )
  }

  const prototypes = [
    {
      name: "Multiverse Portal V1",
      description: "Original Multiverse Portal design with cyan/purple color scheme, preserved as an archive before the AI Design Studio rebrand.",
      href: "/admin/portal-original",
      status: "Archived",
      statusColor: "text-slate-400 bg-slate-500/20",
      gradient: "from-cyan-500/20 to-slate-800/20",
      border: "border-cyan-500/30 hover:border-cyan-400",
      titleColor: "text-cyan-400",
      features: ["Original Design", "Cyan/Purple", "Reference"],
      featureColors: ["bg-cyan-500/20 text-cyan-400", "bg-purple-500/20 text-purple-400", "bg-slate-500/20 text-slate-400"],
    },
    {
      name: "AI Canvas",
      description: "Drawing and painting tool with AI-powered generation. Not yet available to users.",
      href: "/ai-canvas",
      status: "In Development",
      statusColor: "text-violet-400 bg-violet-500/20",
      gradient: "from-emerald-500/20 to-teal-500/20",
      border: "border-emerald-500/30 hover:border-emerald-400",
      titleColor: "text-emerald-400",
      features: ["Draw & Paint", "Upload Images", "AI Generation"],
      featureColors: ["bg-emerald-500/20 text-emerald-400", "bg-teal-500/20 text-teal-400", "bg-cyan-500/20 text-cyan-400"],
    },
    {
      name: "Video Scanner — Kling O3",
      description: "Archived version of the Video Scanner with all three models: WAN 2.5, Kling O3, and Kling 3.0. Kling O3 was removed from the live scanner.",
      href: "/admin/video-scanner-kling-o3",
      status: "Archived",
      statusColor: "text-orange-400 bg-orange-500/20",
      gradient: "from-orange-500/20 to-yellow-500/20",
      border: "border-orange-500/30 hover:border-orange-400",
      titleColor: "text-orange-400",
      features: ["WAN 2.5", "Kling O3", "Kling 3.0"],
      featureColors: ["bg-orange-500/20 text-orange-400", "bg-yellow-500/20 text-yellow-400", "bg-amber-500/20 text-amber-400"],
    },
    {
      name: "Custom Model Scanner",
      description: "Create reusable custom models from up to 8 reference images for consistent generations.",
      href: "/custom-model-scanner",
      status: "In Development",
      statusColor: "text-violet-400 bg-violet-500/20",
      gradient: "from-purple-500/20 to-pink-500/20",
      border: "border-purple-500/30 hover:border-purple-400",
      titleColor: "text-purple-400",
      features: ["Custom Models", "8 References", "Reusable"],
      featureColors: ["bg-purple-500/20 text-purple-400", "bg-pink-500/20 text-pink-400", "bg-fuchsia-500/20 text-fuchsia-400"],
    },
    {
      name: "NanoBanana Pro 2",
      description: "Full-parameter prototype for fal-ai/nano-banana-2. Customize aspect ratio, resolution, safety tolerance, web search, seed, and more.",
      href: "/admin/nano-banana-2",
      status: "Prototype",
      statusColor: "text-yellow-400 bg-yellow-500/20",
      gradient: "from-yellow-500/20 to-orange-500/20",
      border: "border-yellow-500/30 hover:border-yellow-400",
      titleColor: "text-yellow-400",
      features: ["All Params", "4K Support", "Web Search"],
      featureColors: ["bg-yellow-500/20 text-yellow-400", "bg-orange-500/20 text-orange-400", "bg-cyan-500/20 text-cyan-400"],
    },
  ]

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-white p-6">
      {/* Background effects */}
      <div className="fixed inset-0 bg-[linear-gradient(rgba(139,92,246,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(139,92,246,0.02)_1px,transparent_1px)] bg-[size:40px_40px] pointer-events-none" />
      <div className="fixed top-20 left-20 w-96 h-96 bg-violet-500/5 rounded-full blur-3xl pointer-events-none" />
      <div className="fixed bottom-20 right-20 w-96 h-96 bg-purple-500/5 rounded-full blur-3xl pointer-events-none" />

      <div className="max-w-4xl mx-auto relative z-10">
        {/* Header */}
        <div className="flex items-center justify-between mb-10">
          <div>
            <h1 className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-violet-400 to-purple-500 mb-2 flex items-center gap-3">
              <FlaskConical size={32} className="text-violet-400" />
              PROTOTYPE LAB
            </h1>
            <p className="text-slate-400 text-sm">Experimental features not yet available to users</p>
          </div>
          <Button
            onClick={() => router.push('/admin')}
            className="bg-slate-800 hover:bg-slate-700 text-white"
          >
            <ArrowLeft size={16} className="mr-2" />
            Admin Panel
          </Button>
        </div>

        {/* Prototype Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {prototypes.map((proto) => (
            <Link key={proto.name} href={proto.href}>
              <div className={`p-6 rounded-2xl border-2 ${proto.border} bg-gradient-to-br ${proto.gradient} backdrop-blur-sm transition-all cursor-pointer group`}>
                <div className="flex items-center justify-between mb-4">
                  <h2 className={`text-xl font-black ${proto.titleColor}`}>{proto.name}</h2>
                  <span className={`text-[10px] font-bold px-2 py-1 rounded-full ${proto.statusColor}`}>
                    {proto.status}
                  </span>
                </div>
                <p className="text-sm text-slate-300 mb-4">{proto.description}</p>
                <div className="flex flex-wrap gap-2">
                  {proto.features.map((feature, i) => (
                    <span key={feature} className={`text-xs px-2 py-1 rounded-full ${proto.featureColors[i]}`}>
                      {feature}
                    </span>
                  ))}
                </div>
              </div>
            </Link>
          ))}
        </div>

        {prototypes.length === 0 && (
          <div className="text-center py-20">
            <FlaskConical size={48} className="mx-auto text-slate-600 mb-4" />
            <p className="text-slate-500 text-lg">No prototypes yet</p>
            <p className="text-slate-600 text-sm mt-2">Experimental features will appear here</p>
          </div>
        )}
      </div>
    </div>
  )
}
