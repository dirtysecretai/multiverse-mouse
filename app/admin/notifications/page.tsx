"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Terminal, ArrowLeft, Bell } from "lucide-react"
import { NotificationManager } from "@/components/NotificationManager"

export default function NotificationsPage() {
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

  return (
    <div className="min-h-screen bg-[#050810] relative overflow-hidden">
      <div className="fixed inset-0 bg-[linear-gradient(rgba(0,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(0,255,255,0.02)_1px,transparent_1px)] bg-[size:40px_40px] pointer-events-none" />
      <div className="fixed top-20 left-20 w-96 h-96 bg-cyan-500/5 rounded-full blur-3xl" />
      <div className="fixed bottom-20 right-20 w-96 h-96 bg-fuchsia-500/5 rounded-full blur-3xl" />

      <div className="relative z-10 p-6 max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-cyan-500 flex items-center gap-3">
              <Bell size={32} /> NOTIFICATIONS
            </h1>
            <p className="text-slate-500 text-sm mt-1">Manage user notifications</p>
          </div>
          <Button
            onClick={() => window.location.href = '/admin'}
            className="bg-slate-700 hover:bg-slate-600 text-white"
          >
            <ArrowLeft size={16} className="mr-2" /> Back
          </Button>
        </div>

        <NotificationManager />
      </div>
    </div>
  )
}
