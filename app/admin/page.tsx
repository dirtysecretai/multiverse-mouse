"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { 
  Terminal, 
  Lock, 
  LogOut, 
  Store, 
  AlertTriangle,
  Activity,
  MessageSquare,
  CheckCircle,
  XCircle
} from "lucide-react"
import Link from "next/link"

interface AdminState {
  isShopOpen: boolean
  isMaintenanceMode: boolean
}

interface EchoMessage {
  id: string
  message: string
  visibleName: boolean
  name?: string
  timestamp: number
}

export default function AdminPage() {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  
  const [adminState, setAdminState] = useState<AdminState>({
    isShopOpen: false,
    isMaintenanceMode: false,
  })
  
  const [echoMessages, setEchoMessages] = useState<EchoMessage[]>([])
  const [showPassword, setShowPassword] = useState(false)

  // Admin password - Change this to your secure password
  const ADMIN_PASSWORD = "multipassword1010"

  // Load authentication and admin state from localStorage on mount
  useEffect(() => {
    const authStatus = localStorage.getItem("multiverse-admin-auth")
    if (authStatus === "true") {
      setIsAuthenticated(true)
    }

    const savedState = localStorage.getItem("multiverse-admin-state")
    if (savedState) {
      try {
        setAdminState(JSON.parse(savedState))
      } catch (error) {
        console.error("Failed to parse admin state:", error)
      }
    }

    const messages = localStorage.getItem("echo-messages")
    if (messages) {
      try {
        setEchoMessages(JSON.parse(messages))
      } catch (error) {
        console.error("Failed to parse echo messages:", error)
      }
    }
  }, [])

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault()
    if (password === ADMIN_PASSWORD) {
      setIsAuthenticated(true)
      localStorage.setItem("multiverse-admin-auth", "true")
      setError("")
    } else {
      setError("INVALID_CREDENTIALS")
    }
  }

  const handleLogout = () => {
    setIsAuthenticated(false)
    localStorage.removeItem("multiverse-admin-auth")
    setPassword("")
  }

  const updateAdminState = (updates: Partial<AdminState>) => {
    const newState = { ...adminState, ...updates }
    setAdminState(newState)
    localStorage.setItem("multiverse-admin-state", JSON.stringify(newState))
    
    // Trigger storage event for other tabs
    window.dispatchEvent(new Event("storage"))
  }

  const clearEchoMessages = () => {
    if (confirm("Are you sure you want to clear all echo messages?")) {
      setEchoMessages([])
      localStorage.removeItem("echo-messages")
    }
  }

  const deleteMessage = (id: string) => {
    const updated = echoMessages.filter(msg => msg.id !== id)
    setEchoMessages(updated)
    localStorage.setItem("echo-messages", JSON.stringify(updated))
  }

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleString()
  }

  // Login Screen
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-[#050810] flex flex-col items-center justify-center px-4 relative overflow-hidden">
        {/* Grid Background */}
        <div className="absolute inset-0 bg-[linear-gradient(rgba(0,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(0,255,255,0.02)_1px,transparent_1px)] bg-[size:40px_40px]" />
        
        {/* Ambient Glow */}
        <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-cyan-500/10 rounded-full blur-[150px] pointer-events-none" />

        <div className="relative w-full max-w-md">
          {/* Terminal Header */}
          <div className="flex items-center gap-2 px-4 py-2 bg-slate-900/60 border border-cyan-500/30 rounded-t-xl">
            <div className="flex gap-1.5">
              <div className="w-2.5 h-2.5 rounded-full bg-red-500" />
              <div className="w-2.5 h-2.5 rounded-full bg-yellow-500" />
              <div className="w-2.5 h-2.5 rounded-full bg-green-500" />
            </div>
            <span className="text-[11px] font-mono text-cyan-400/70 ml-2">admin@multiverse:~</span>
          </div>

          {/* Login Form */}
          <div className="p-8 rounded-b-xl border-x border-b border-cyan-500/30 bg-slate-900/50 backdrop-blur-xl">
            <div className="flex flex-col items-center mb-6">
              <div className="p-4 rounded-xl bg-cyan-500/10 border border-cyan-500/30 mb-4">
                <Lock className="w-8 h-8 text-cyan-400" />
              </div>
              <h1 className="text-2xl font-bold text-white mb-2">Admin Access</h1>
              <p className="text-slate-400 text-sm font-mono">AUTHENTICATION_REQUIRED</p>
            </div>

            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="block text-sm font-mono text-cyan-400 mb-2">
                  <Terminal className="w-3 h-3 inline mr-1" />
                  PASSWORD
                </label>
                <Input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter admin password"
                  className="bg-slate-950/50 border-slate-700/50 text-white font-mono focus:border-cyan-500/50"
                />
              </div>

              {error && (
                <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm font-mono">
                  <XCircle className="w-4 h-4 inline mr-2" />
                  {error}
                </div>
              )}

              <Button
                type="submit"
                className="w-full bg-cyan-500 hover:bg-cyan-400 text-black font-mono font-semibold"
              >
                AUTHENTICATE
              </Button>
            </form>

            <div className="mt-6 pt-6 border-t border-slate-800/50 text-center">
              <Link 
                href="/"
                className="text-sm text-slate-400 hover:text-cyan-400 font-mono transition-colors"
              >
                <span className="text-cyan-500">&gt;</span> Return to Portal
              </Link>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // Admin Dashboard
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
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-cyan-500/10 border border-cyan-500/30">
                <Terminal className="w-5 h-5 text-cyan-400" />
              </div>
              <div>
                <h1 className="text-lg font-bold text-white">Admin Dashboard</h1>
                <p className="text-xs font-mono text-slate-500">MULTIVERSE_CONTROL_PANEL</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Link
                href="/"
                className="text-sm text-slate-400 hover:text-cyan-400 font-mono transition-colors"
              >
                View Portal
              </Link>
              <Button
                onClick={handleLogout}
                variant="outline"
                className="bg-slate-900/50 border-slate-700 hover:border-red-500/50 text-slate-400 hover:text-red-400 font-mono"
              >
                <LogOut className="w-4 h-4 mr-2" />
                Logout
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="relative max-w-6xl mx-auto px-6 py-8">
        {/* Status Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          {/* Shop Status */}
          <div className="p-5 rounded-xl border border-slate-700/50 bg-slate-900/40 backdrop-blur-sm">
            <div className="flex items-center gap-3 mb-3">
              <Store className="w-5 h-5 text-cyan-400" />
              <h3 className="font-mono text-sm text-slate-400">STORE_STATUS</h3>
            </div>
            <div className={`text-2xl font-bold mb-1 ${adminState.isShopOpen ? 'text-cyan-400' : 'text-slate-500'}`}>
              {adminState.isShopOpen ? 'ONLINE' : 'OFFLINE'}
            </div>
            <p className="text-xs text-slate-600 font-mono">
              {adminState.isShopOpen ? 'Accepting commissions' : 'Store is closed'}
            </p>
          </div>

          {/* Maintenance Status */}
          <div className="p-5 rounded-xl border border-slate-700/50 bg-slate-900/40 backdrop-blur-sm">
            <div className="flex items-center gap-3 mb-3">
              <AlertTriangle className="w-5 h-5 text-yellow-400" />
              <h3 className="font-mono text-sm text-slate-400">MAINTENANCE</h3>
            </div>
            <div className={`text-2xl font-bold mb-1 ${adminState.isMaintenanceMode ? 'text-yellow-400' : 'text-slate-500'}`}>
              {adminState.isMaintenanceMode ? 'ACTIVE' : 'INACTIVE'}
            </div>
            <p className="text-xs text-slate-600 font-mono">
              {adminState.isMaintenanceMode ? 'Banner displayed' : 'Normal operation'}
            </p>
          </div>

          {/* Messages */}
          <div className="p-5 rounded-xl border border-slate-700/50 bg-slate-900/40 backdrop-blur-sm">
            <div className="flex items-center gap-3 mb-3">
              <MessageSquare className="w-5 h-5 text-fuchsia-400" />
              <h3 className="font-mono text-sm text-slate-400">ECHO_CHAMBER</h3>
            </div>
            <div className="text-2xl font-bold text-fuchsia-400 mb-1">
              {echoMessages.length}
            </div>
            <p className="text-xs text-slate-600 font-mono">
              Total messages
            </p>
          </div>
        </div>

        {/* Controls */}
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-4">
            <Activity className="w-5 h-5 text-cyan-400" />
            <h2 className="text-lg font-bold text-white">System Controls</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Shop Toggle */}
            <div className="p-5 rounded-xl border border-cyan-500/30 bg-slate-900/40 backdrop-blur-sm">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-white mb-1">Shop Status</h3>
                  <p className="text-sm text-slate-400 font-mono">
                    Toggle commission availability
                  </p>
                </div>
                <Switch
                  checked={adminState.isShopOpen}
                  onCheckedChange={(checked) => updateAdminState({ isShopOpen: checked })}
                  className="data-[state=checked]:bg-cyan-500"
                />
              </div>
            </div>

            {/* Maintenance Toggle */}
            <div className="p-5 rounded-xl border border-yellow-500/30 bg-slate-900/40 backdrop-blur-sm">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-white mb-1">Maintenance Mode</h3>
                  <p className="text-sm text-slate-400 font-mono">
                    Display maintenance banner
                  </p>
                </div>
                <Switch
                  checked={adminState.isMaintenanceMode}
                  onCheckedChange={(checked) => updateAdminState({ isMaintenanceMode: checked })}
                  className="data-[state=checked]:bg-yellow-500"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Echo Messages */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <MessageSquare className="w-5 h-5 text-fuchsia-400" />
              <h2 className="text-lg font-bold text-white">Echo Chamber Messages</h2>
            </div>
            {echoMessages.length > 0 && (
              <Button
                onClick={clearEchoMessages}
                variant="outline"
                className="bg-slate-900/50 border-slate-700 hover:border-red-500/50 text-slate-400 hover:text-red-400 font-mono text-sm"
              >
                Clear All
              </Button>
            )}
          </div>

          {echoMessages.length === 0 ? (
            <div className="p-8 rounded-xl border border-slate-700/50 bg-slate-900/40 backdrop-blur-sm text-center">
              <Terminal className="w-12 h-12 text-slate-600 mx-auto mb-3" />
              <p className="text-slate-500 font-mono text-sm">NO_MESSAGES_YET</p>
            </div>
          ) : (
            <div className="space-y-3">
              {echoMessages.map((msg) => (
                <div
                  key={msg.id}
                  className="p-4 rounded-xl border border-slate-700/50 bg-slate-900/40 backdrop-blur-sm hover:border-slate-600/50 transition-colors"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        {msg.visibleName && msg.name && (
                          <span className="text-cyan-400 font-mono text-sm font-semibold">
                            {msg.name}
                          </span>
                        )}
                        <span className="text-slate-600 font-mono text-xs">
                          {formatDate(msg.timestamp)}
                        </span>
                      </div>
                      <p className="text-slate-300 text-sm whitespace-pre-wrap">
                        {msg.message}
                      </p>
                    </div>
                    <Button
                      onClick={() => deleteMessage(msg.id)}
                      variant="ghost"
                      size="sm"
                      className="text-slate-500 hover:text-red-400 hover:bg-red-500/10"
                    >
                      <XCircle className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="relative py-6 text-center text-slate-600 text-xs font-mono border-t border-slate-800/50 mt-12">
        <span className="text-cyan-500/50">&gt;</span> © 2026 MULTIVERSE MOUSE LAB <span className="text-fuchsia-500/50">//</span> ADMIN_PANEL
      </footer>
    </div>
  )
}