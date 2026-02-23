"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { ArrowLeft } from "lucide-react"
import Link from "next/link"
import MultiversePortalLegacy from "@/components/multiverse-portal-legacy"

export default function AdminPortalOriginalPage() {
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
            <h1 className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-500 mb-2">
              PORTAL V1 — ARCHIVE
            </h1>
            <p className="text-slate-500 text-sm">Authentication Required</p>
          </div>
          <form onSubmit={handleLogin} className="p-6 rounded-xl border border-slate-800 bg-slate-900/60 backdrop-blur-sm">
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter admin password"
              className="w-full p-3 rounded-lg bg-slate-950 border border-slate-700 text-white focus:border-cyan-500 focus:outline-none mb-4"
            />
            <Button type="submit" className="w-full bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-400 hover:to-blue-400 text-black font-bold">
              ACCESS ARCHIVE
            </Button>
          </form>
        </div>
      </div>
    )
  }

  return (
    <div className="relative">
      {/* Floating back button */}
      <div className="fixed top-4 left-4 z-[9999]">
        <Link href="/admin/prototype">
          <Button className="bg-slate-900/90 backdrop-blur-sm hover:bg-slate-800 border border-slate-600 text-slate-300 h-9 px-3 shadow-lg">
            <ArrowLeft size={16} className="mr-1" />
            Prototype Lab
          </Button>
        </Link>
      </div>
      <MultiversePortalLegacy />
    </div>
  )
}
