"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { 
  Terminal, RefreshCw, Clock, Store, AlertTriangle, MessageSquare, Activity 
} from "lucide-react"

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
  const [isLoading, setIsLoading] = useState(true)
  const [adminState, setAdminState] = useState<AdminState>({
    isShopOpen: false,
    isMaintenanceMode: false,
  })
  const [echoMessages, setEchoMessages] = useState<EchoMessage[]>([])

  const ADMIN_PASSWORD = "multipassword1010"

  const fetchCloudData = async () => {
    setIsLoading(true)
    try {
      // Fetch Messages
      const msgRes = await fetch('/api/echo')
      const msgData = await msgRes.json()
      setEchoMessages(msgData)

      // Fetch Site Config
      const configRes = await fetch('/api/admin/config')
      const configData = await configRes.json()
      setAdminState({
        isShopOpen: configData.isShopOpen,
        isMaintenanceMode: configData.isMaintenanceMode,
      })
    } catch (err) {
      console.error("Sync failed:", err)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    const authStatus = localStorage.getItem("multiverse-admin-auth")
    if (authStatus === "true") {
      setIsAuthenticated(true)
      fetchCloudData()
    }
  }, [])

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault()
    if (password === ADMIN_PASSWORD) {
      setIsAuthenticated(true)
      localStorage.setItem("multiverse-admin-auth", "true")
      fetchCloudData()
    }
  }

  const updateAdminState = async (updates: Partial<AdminState>) => {
    const newState = { ...adminState, ...updates }
    setAdminState(newState) // Update UI immediately

    try {
      await fetch('/api/admin/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newState),
      })
    } catch (err) {
      console.error("Cloud sync failed:", err)
    }
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-[#050810] flex flex-col items-center justify-center px-4">
        <div className="w-full max-w-md p-8 rounded-xl border border-cyan-500/30 bg-slate-900/50 backdrop-blur-xl">
          <h1 className="text-xl font-mono text-cyan-400 mb-6 text-center">ADMIN_AUTH_REQUIRED</h1>
          <form onSubmit={handleLogin} className="space-y-4">
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter password"
              className="bg-slate-950/50 border-slate-700/50 text-white"
            />
            <Button type="submit" className="w-full bg-cyan-500 hover:bg-cyan-400 text-black font-mono">AUTHENTICATE</Button>
          </form>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#050810] text-slate-200 font-mono p-8">
      <div className="max-w-6xl mx-auto">
        <header className="flex justify-between items-center border-b border-cyan-500/30 pb-6 mb-8">
          <div className="flex items-center gap-3">
            <Terminal className="text-cyan-400" />
            <h1 className="text-xl font-bold">MULTIVERSE_ADMIN_PANEL</h1>
          </div>
          <button onClick={fetchCloudData} className="p-2 text-cyan-400 hover:bg-cyan-500/10 rounded-lg">
            <RefreshCw className={isLoading ? "animate-spin" : ""} />
          </button>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
          <div className="p-6 rounded-xl border border-slate-800 bg-slate-900/40">
            <Store className="text-cyan-400 mb-2" />
            <div className="text-2xl font-bold">{adminState.isShopOpen ? "OPEN" : "CLOSED"}</div>
            <p className="text-xs text-slate-500">GLOBAL_SHOP_STATUS</p>
          </div>
          <div className="p-6 rounded-xl border border-slate-800 bg-slate-900/40">
            <AlertTriangle className="text-yellow-400 mb-2" />
            <div className="text-2xl font-bold">{adminState.isMaintenanceMode ? "ACTIVE" : "INACTIVE"}</div>
            <p className="text-xs text-slate-500">MAINTENANCE_BANNER</p>
          </div>
          <div className="p-6 rounded-xl border border-slate-800 bg-slate-900/40">
            <MessageSquare className="text-fuchsia-400 mb-2" />
            <div className="text-2xl font-bold">{echoMessages.length}</div>
            <p className="text-xs text-slate-500">CLOUD_MESSAGES</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-12">
          <div className="p-6 rounded-xl border border-cyan-500/20 bg-slate-900/40 flex justify-between items-center">
            <span>SHOP_TOGGLE</span>
            <Switch checked={adminState.isShopOpen} onCheckedChange={(checked) => updateAdminState({ isShopOpen: checked })} />
          </div>
          <div className="p-6 rounded-xl border border-yellow-500/20 bg-slate-900/40 flex justify-between items-center">
            <span>MAINTENANCE_TOGGLE</span>
            <Switch checked={adminState.isMaintenanceMode} onCheckedChange={(checked) => updateAdminState({ isMaintenanceMode: checked })} />
          </div>
        </div>

        <h2 className="text-lg font-bold mb-6 flex items-center gap-2 text-cyan-400">
          <Activity size={20} /> LIVE_ECHO_STREAM
        </h2>
        <div className="space-y-4">
          {echoMessages.map((msg) => (
            <div key={msg.id} className="p-4 rounded-xl border border-slate-800 bg-slate-900/60">
              <div className="flex justify-between text-xs mb-2">
                <span className="text-cyan-400 font-bold">{msg.name || "ANONYMOUS"}</span>
                <span className="text-slate-600 flex items-center gap-1"><Clock size={10} /> {new Date(msg.createdAt).toLocaleString()}</span>
              </div>
              <p className="text-sm text-slate-300">{msg.message}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}