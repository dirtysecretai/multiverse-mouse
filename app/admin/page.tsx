"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Terminal, MessageSquare, Wrench, Image as ImageIcon, Sparkles, Tag, Bell, Users, CreditCard, ListOrdered, FlaskConical
} from "lucide-react"

export default function AdminPage() {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [password, setPassword] = useState("")

  useEffect(() => {
    const authStatus = localStorage.getItem("multiverse-admin-auth")
    const savedPassword = sessionStorage.getItem("admin-password")

    if (authStatus === "true" && savedPassword) {
      setIsAuthenticated(true)
    } else {
      localStorage.removeItem("multiverse-admin-auth")
    }
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
        setIsAuthenticated(true)
        localStorage.setItem("multiverse-admin-auth", "true")
      } else {
        alert("Invalid password")
      }
    } catch (error) {
      console.error("Auth error:", error)
      alert("Authentication failed")
    }
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-[#050810] flex items-center justify-center p-6">
        <div className="w-full max-w-md p-8 rounded-2xl border-2 border-cyan-500/30 bg-slate-900/80 backdrop-blur-sm">
          <div className="text-center mb-8">
            <Terminal className="mx-auto text-cyan-400 mb-4" size={48} />
            <h1 className="text-2xl font-black text-cyan-400">ADMIN_ACCESS</h1>
            <p className="text-sm text-slate-500 mt-2">Authorized personnel only</p>
          </div>
          <form onSubmit={handleLogin}>
            <Input
              type="password"
              placeholder="Enter password..."
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="bg-slate-950 border-slate-700 text-white mb-4"
            />
            <Button type="submit" className="w-full bg-cyan-500 hover:bg-cyan-400 text-black font-bold">
              AUTHENTICATE
            </Button>
          </form>
        </div>
      </div>
    )
  }

  const adminPages = [
    {
      name: "Promotions",
      description: "Manage discount codes, subscriptions, and free tickets",
      href: "/admin/promotions",
      icon: Tag,
      gradient: "from-green-500 to-emerald-500",
      hoverGradient: "hover:from-green-400 hover:to-emerald-400",
      textColor: "text-black"
    },
    {
      name: "Feedback",
      description: "View user feedback, requests, and echo stream",
      href: "/admin/feedback",
      icon: MessageSquare,
      gradient: "from-fuchsia-500 to-pink-500",
      hoverGradient: "hover:from-fuchsia-400 hover:to-pink-400",
      textColor: "text-white"
    },
    {
      name: "Scanner",
      description: "Admin scanner tools and testing",
      href: "/admin/scanner",
      icon: Sparkles,
      gradient: "from-cyan-500 to-fuchsia-500",
      hoverGradient: "hover:from-cyan-400 hover:to-fuchsia-400",
      textColor: "text-black"
    },
    {
      name: "Images",
      description: "Manage generated images and carousel",
      href: "/admin/images",
      icon: ImageIcon,
      gradient: "from-fuchsia-500 to-purple-500",
      hoverGradient: "hover:from-fuchsia-400 hover:to-purple-400",
      textColor: "text-white"
    },
    {
      name: "Maintenance",
      description: "Toggle maintenance mode for features and models",
      href: "/admin/maintenance",
      icon: Wrench,
      gradient: "from-yellow-500 to-orange-500",
      hoverGradient: "hover:from-yellow-400 hover:to-orange-400",
      textColor: "text-black"
    },
    {
      name: "Notifications",
      description: "Create and manage user notifications",
      href: "/admin/notifications",
      icon: Bell,
      gradient: "from-blue-500 to-cyan-500",
      hoverGradient: "hover:from-blue-400 hover:to-cyan-400",
      textColor: "text-black"
    },
    {
      name: "Users",
      description: "View user accounts, subscriptions, and transactions",
      href: "/admin/users",
      icon: Users,
      gradient: "from-purple-500 to-indigo-500",
      hoverGradient: "hover:from-purple-400 hover:to-indigo-400",
      textColor: "text-white"
    },
    {
      name: "Dev Tier Analytics",
      description: "Manage Dev Tier subscriptions and view user analytics",
      href: "/admin/dev-tier",
      icon: CreditCard,
      gradient: "from-emerald-500 to-teal-500",
      hoverGradient: "hover:from-emerald-400 hover:to-teal-400",
      textColor: "text-black"
    },
    {
      name: "Queue Management",
      description: "Manage AI generation queue and concurrency limits",
      href: "/admin/queue",
      icon: ListOrdered,
      gradient: "from-cyan-500 to-blue-500",
      hoverGradient: "hover:from-cyan-400 hover:to-blue-400",
      textColor: "text-black"
    },
    {
      name: "Prototype",
      description: "Experimental features not yet available to users",
      href: "/admin/prototype",
      icon: FlaskConical,
      gradient: "from-violet-500 to-purple-500",
      hoverGradient: "hover:from-violet-400 hover:to-purple-400",
      textColor: "text-white"
    },
  ]

  return (
    <div className="min-h-screen bg-[#050810] relative overflow-hidden">
      <div className="fixed inset-0 bg-[linear-gradient(rgba(0,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(0,255,255,0.02)_1px,transparent_1px)] bg-[size:40px_40px] pointer-events-none" />
      <div className="fixed top-20 left-20 w-96 h-96 bg-cyan-500/5 rounded-full blur-3xl" />
      <div className="fixed bottom-20 right-20 w-96 h-96 bg-fuchsia-500/5 rounded-full blur-3xl" />

      <div className="relative z-10 p-6 max-w-4xl mx-auto">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-fuchsia-500 flex items-center justify-center gap-3">
            <Terminal size={40} /> ADMIN_TERMINAL
          </h1>
          <p className="text-slate-500 text-sm mt-2">System control panel</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {adminPages.map((page) => (
            <button
              key={page.name}
              onClick={() => window.location.href = page.href}
              className={`p-6 rounded-2xl border-2 border-slate-800 bg-slate-900/60 backdrop-blur-sm hover:border-slate-600 transition-all group text-left`}
            >
              <div className={`w-14 h-14 rounded-xl bg-gradient-to-r ${page.gradient} flex items-center justify-center mb-4 group-hover:scale-110 transition-transform`}>
                <page.icon size={28} className={page.textColor} />
              </div>
              <h2 className="text-xl font-bold text-white mb-2">{page.name}</h2>
              <p className="text-sm text-slate-400">{page.description}</p>
            </button>
          ))}
        </div>

        <div className="mt-12 text-center">
          <button
            onClick={() => {
              localStorage.removeItem("multiverse-admin-auth")
              sessionStorage.removeItem("admin-password")
              setIsAuthenticated(false)
            }}
            className="text-sm text-slate-500 hover:text-red-400 transition-colors"
          >
            Logout
          </button>
        </div>
      </div>
    </div>
  )
}
