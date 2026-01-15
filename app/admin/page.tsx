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
  RefreshCw,
  XCircle,
  Clock
} from "lucide-react"
import Link from "next/link"

interface AdminState {
  isShopOpen: boolean
  isMaintenanceMode: boolean
}

interface EchoMessage {
  id: number
  message: string
  visibleName: boolean
  name?: string
  createdAt: string
}

export default function AdminPage() {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [isLoading, setIsLoading] = useState(true)
  
  const [adminState, setAdminState] = useState<AdminState>({
    isShopOpen: false,
    isMaintenanceMode: false,
  })
  
  const [echoMessages, setEchoMessages] = useState<EchoMessage[]>([])

  const ADMIN_PASSWORD = "multipassword1010"

  // Fetch real messages from the cloud database
  const fetchCloudMessages = async () => {
    setIsLoading(true)
    try {
      const response = await fetch('/api/echo')
      const data = await response.json()
      setEchoMessages(data)
    } catch (err) {
      console.error("Failed to fetch transmissions:", err)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    const authStatus = localStorage.getItem("multiverse-admin-auth")
    if (authStatus === "true") {
      setIsAuthenticated(true)
      fetchCloudMessages()
    }

    const savedState = localStorage.getItem("multiverse-admin-state")
    if (savedState) {
      try {
        setAdminState(JSON.parse(savedState))
      } catch (error) {
        console.error("Failed to parse admin state:", error)
      }
    }
  }, [])

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault()
    if (password === ADMIN_PASSWORD) {
      setIsAuthenticated(true)
      localStorage.setItem("multiverse-admin-auth", "true")
      fetchCloudMessages()
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
    window.dispatchEvent(new Event("storage"))
  }

  // Login Screen
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-[#050810] flex flex-col items-center justify-center px-4 relative overflow-hidden">
        <div className="absolute inset-0 bg-[linear-gradient(rgba(0,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(0,255,255,0.02)_1px,transparent_1px)] bg-[size:40px_40px]" />
        <div className="relative w-full max-w-md">
          <div className="flex items-center gap-2 px-4 py-2 bg-slate-900/60 border border-cyan-500/30 rounded-t-xl">
             <div className="flex gap-1.5"><div className="w-2.5 h-2.5 rounded-full bg-red-500" /><div className="w-2.5 h-2.5 rounded-full bg-yellow-500" /><div className="w-2.5 h-2.5 rounded-full bg-green-500" /></div>
             <span className="text-[11px] font-mono text-cyan-400/70 ml-2">admin@multiverse:~</span>
          </div>
          <div className="p-8 rounded-b-xl border-x border-b border-cyan-500/30 bg-slate-900/50 backdrop-blur-xl">
            <h1 className="text-2xl font-bold text-white mb-6 text-center">Admin Access</h1>
            <form onSubmit={handleLogin} className="space-y-4">
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter password"
                className="bg-slate-950/50 border-slate-700/50 text-white font-mono"
              />
              <Button type="submit" className="w-full bg-cyan-500 hover:bg-cyan-400 text-black font-mono font-semibold">AUTHENTICATE</Button>
            </form>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#050810] relative overflow-hidden">
      <div className="fixed inset-0 bg-[linear-gradient(rgba(0,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(0,255,255,0.02)_1px,transparent_1px)] bg-[size:40px_40px] pointer-events-none" />
      
      <header className="relative border-b border-slate-800/50 bg-slate-950/50 backdrop-blur-sm">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Terminal className="text-cyan-400" />
            <h1 className="text-lg font-bold text-white">Multiverse Admin</h1>
          </div>
          <div className="flex items-center gap-4">
            <button onClick={fetchCloudMessages} className="p-2 text-cyan-400 hover:bg-cyan-500/10 rounded-lg">
              <RefreshCw className={isLoading ? "animate-spin" : ""} size={18} />
            </button>
            <Button onClick={handleLogout} variant="outline" className="text-slate-400 border-slate-700 hover:text-red-400">Logout</Button>
          </div>
        </div>
      </header>

      <main className="relative max-w-6xl mx-auto px-6 py-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <div className="p-5 rounded-xl border border-slate-700/50 bg-slate-900/40 backdrop-blur-sm">
            <Store className="w-5 h-5 text-cyan-400 mb-2" />
            <div className={`text-2xl font-bold ${adminState.isShopOpen ? 'text-cyan-400' : 'text-slate-500'}`}>
              {adminState.isShopOpen ? 'ONLINE' : 'OFFLINE'}
            </div>
            <p className="text-xs text-slate-600 font-mono">STORE_STATUS</p>
          </div>

          <div className="p-5 rounded-xl border border-slate-700/50 bg-slate-900/40 backdrop-blur-sm">
            <AlertTriangle className="w-5 h-5 text-yellow-400 mb-2" />
            <div className={`text-2xl font-bold ${adminState.isMaintenanceMode ? 'text-yellow-400' : 'text-slate-500'}`}>
              {adminState.isMaintenanceMode ? 'ACTIVE' : 'INACTIVE'}
            </div>
            <p className="text-xs text-slate-600 font-mono">MAINTENANCE_MODE</p>
          </div>

          <div className="p-5 rounded-xl border border-slate-700/50 bg-slate-900/40 backdrop-blur-sm">
            <MessageSquare className="w-5 h-5 text-fuchsia-400 mb-2" />
            <div className="text-2xl font-bold text-fuchsia-400">{echoMessages.length}</div>
            <p className="text-xs text-slate-600 font-mono">CLOUD_MESSAGES</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-12">
           <div className="p-5 rounded-xl border border-cyan-500/30 bg-slate-900/40 flex justify-between items-center">
              <div><h3 className="text-white font-bold">Shop Toggle</h3><p className="text-xs text-slate-500">Enable/Disable commissions</p></div>
              <Switch checked={adminState.isShopOpen} onCheckedChange={(checked) => updateAdminState({ isShopOpen: checked })} className="data-[state=checked]:bg-cyan-500" />
           </div>
           <div className="p-5 rounded-xl border border-yellow-500/30 bg-slate-900/40 flex justify-between items-center">
              <div><h3 className="text-white font-bold">Maintenance</h3><p className="text-xs text-slate-500">Force system banner</p></div>
              <Switch checked={adminState.isMaintenanceMode} onCheckedChange={(checked) => updateAdminState({ isMaintenanceMode: checked })} className="data-[state=checked]:bg-yellow-500" />
           </div>
        </div>

        <div>
          <h2 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
            <Activity className="text-cyan-400" size={20} /> ECHO_CHAMBER_FEED
          </h2>
          {isLoading ? (
            <div className="text-center py-12 text-slate-500 animate-pulse font-mono">SCANNING_FREQUENCIES...</div>
          ) : echoMessages.length === 0 ? (
            <div className="text-center py-12 border border-dashed border-slate-800 rounded-xl text-slate-600 font-mono">NO_DATA_STREAM</div>
          ) : (
            <div className="space-y-4">
              {echoMessages.map((msg) => (
                <div key={msg.id} className="p-5 rounded-xl border border-slate-800 bg-slate-900/60 backdrop-blur-sm group hover:border-cyan-500/30 transition-all">
                  <div className="flex justify-between items-start mb-3">
                    <span className="text-cyan-400 font-mono text-xs font-bold">{msg.name || "ANONYMOUS"}</span>
                    <span className="text-slate-600 text-[10px] flex items-center gap-1">
                      <Clock size={10} /> {new Date(msg.createdAt).toLocaleString()}
                    </span>
                  </div>
                  <p className="text-slate-300 text-sm leading-relaxed">{msg.message}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  )
}