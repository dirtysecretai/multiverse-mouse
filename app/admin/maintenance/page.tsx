"use client"

import { useState, useEffect, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Terminal, RefreshCw, AlertTriangle, Wrench, ArrowLeft, Sparkles
} from "lucide-react"

// Model definitions
const MODELS = [
  { id: 'nanoBanana', name: 'NanoBanana', color: 'cyan', icon: '⚡' },
  { id: 'nanoBananaPro', name: 'NanoBanana Pro', color: 'purple', icon: '✨' },
  { id: 'seedream', name: 'SeeDream 4.5', color: 'orange', icon: '🌟' },
  { id: 'flux2', name: 'FLUX 2', color: 'blue', icon: '🔥' },
  { id: 'proScannerV3', name: 'Pro Scanner v3', color: 'fuchsia', icon: '💎' },
  { id: 'flashScannerV25', name: 'Flash Scanner v2.5', color: 'emerald', icon: '⚡' },
]

const SCANNERS = [
  { id: 'mainScanner', name: 'Main Scanner', path: 'multiverse-portal.tsx' },
  { id: 'legacyScanner', name: 'Legacy Scanner', path: 'prompting-studio/legacy' },
  { id: 'adminScanner', name: 'Admin Scanner', path: 'admin/scanner' },
  { id: 'canvasScanner', name: 'Canvas Scanner', path: 'prompting-studio/canvas' },
]

interface AdminState {
  isMaintenanceMode: boolean
  echoChamberMaintenance: boolean

  // Scanner-level maintenance
  mainScannerMaintenance: boolean
  legacyScannerMaintenance: boolean
  adminScannerMaintenance: boolean
  canvasScannerMaintenance: boolean
  videoScannerMaintenance: boolean

  // Video scanner model maintenance
  klingV3Maintenance: boolean
  wan25Maintenance: boolean

  // Per-scanner, per-model maintenance
  [key: string]: boolean
}

export default function MaintenancePage() {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [password, setPassword] = useState("")
  const [isLoading, setIsLoading] = useState(true)
  const [adminState, setAdminState] = useState<AdminState>({
    isMaintenanceMode: false,
    echoChamberMaintenance: false,
    mainScannerMaintenance: false,
    legacyScannerMaintenance: false,
    adminScannerMaintenance: false,
    canvasScannerMaintenance: false,
    videoScannerMaintenance: false,
    klingV3Maintenance: false,
    wan25Maintenance: false,
  })

  const fetchCloudData = useCallback(async () => {
    setIsLoading(true)
    try {
      const configRes = await fetch('/api/admin/config')
      if (configRes.ok) {
        const configData = await configRes.json()
        setAdminState(configData)
      }
    } catch (err) {
      console.error("Sync failed:", err)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    const authStatus = localStorage.getItem("multiverse-admin-auth")
    const savedPassword = sessionStorage.getItem("admin-password")

    if (authStatus === "true" && savedPassword) {
      setIsAuthenticated(true)
      fetchCloudData()
    } else {
      localStorage.removeItem("multiverse-admin-auth")
    }
  }, [fetchCloudData])

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
        fetchCloudData()
      } else {
        alert("Invalid password")
      }
    } catch (error) {
      console.error("Auth error:", error)
      alert("Authentication failed")
    }
  }

  const updateAdminState = async (updates: Partial<AdminState>) => {
    const newState = { ...adminState, ...updates } as AdminState
    setAdminState(newState)

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

  // Toggle a specific model for a specific scanner
  const toggleScannerModel = (scanner: string, model: string) => {
    const key = `${scanner}_${model}`
    updateAdminState({ [key]: !adminState[key] })
  }

  // Toggle ALL models for a specific scanner
  const toggleAllModels = (scanner: string) => {
    const updates: Record<string, boolean> = {}

    // Check if all models are currently offline
    const allOffline = MODELS.every(model => adminState[`${scanner}_${model.id}`])

    // Toggle all models to the opposite state
    MODELS.forEach(model => {
      updates[`${scanner}_${model.id}`] = !allOffline
    })

    updateAdminState(updates)
  }

  // Toggle a model globally (for all 4 scanners: Main, Legacy, Admin, Canvas)
  const toggleModelGlobally = (model: string) => {
    const currentValue = adminState[`mainScanner_${model}`]
    const newValue = !currentValue

    updateAdminState({
      [`mainScanner_${model}`]: newValue,
      [`legacyScanner_${model}`]: newValue,
      [`adminScanner_${model}`]: newValue,
      [`canvasScanner_${model}`]: newValue,
    })
  }

  // Check if a model is globally enabled (all 4 scanners have same state)
  const isModelGloballyEnabled = (model: string) => {
    const main = adminState[`mainScanner_${model}`]
    const legacy = adminState[`legacyScanner_${model}`]
    const admin = adminState[`adminScanner_${model}`]
    const canvas = adminState[`canvasScanner_${model}`]
    return main && legacy && admin && canvas
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

      <div className="relative z-10 p-6 max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 to-orange-500 flex items-center gap-3">
              <Wrench size={32} /> MAINTENANCE_CONTROL
            </h1>
            <p className="text-slate-500 text-sm mt-1">Per-scanner, per-model maintenance system</p>
          </div>
          <div className="flex gap-2">
            <Button
              onClick={() => window.location.href = '/admin'}
              className="bg-slate-700 hover:bg-slate-600 text-white"
            >
              <ArrowLeft size={16} className="mr-2" /> Back
            </Button>
            <Button onClick={fetchCloudData} disabled={isLoading} className="bg-cyan-500 hover:bg-cyan-400 text-black">
              <RefreshCw className={isLoading ? 'animate-spin' : ''} size={16} />
            </Button>
          </div>
        </div>

        {/* Master Maintenance Toggle */}
        <div className="mb-8">
          <div className={`p-6 rounded-xl border-2 ${adminState.isMaintenanceMode ? 'border-yellow-500/50 bg-yellow-500/10' : 'border-slate-800 bg-slate-900/40'}`}>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <AlertTriangle size={24} className={adminState.isMaintenanceMode ? 'text-yellow-400' : 'text-slate-600'} />
                <span className="font-bold text-white text-lg">GLOBAL MAINTENANCE MODE</span>
              </div>
              <button
                onClick={() => updateAdminState({ isMaintenanceMode: !adminState.isMaintenanceMode })}
                className={`relative w-16 h-8 rounded-full transition-all ${
                  adminState.isMaintenanceMode ? 'bg-yellow-500' : 'bg-slate-600'
                }`}
              >
                <div className={`absolute top-1 w-6 h-6 bg-white rounded-full transition-transform ${
                  adminState.isMaintenanceMode ? 'left-9' : 'left-1'
                }`} />
              </button>
            </div>
            <p className="text-sm text-slate-400">{adminState.isMaintenanceMode ? 'Site is locked - users cannot access' : 'All systems operational'}</p>
          </div>
        </div>

        {/* Global Models Maintenance */}
        <div className="mb-8">
          <h2 className="text-xl font-bold text-fuchsia-400 mb-4 font-mono flex items-center gap-2">
            <Sparkles size={20} /> GLOBAL_MODELS_MAINTENANCE
          </h2>
          <p className="text-xs text-slate-500 mb-4">Toggle models across all 4 scanners (Main, Legacy, Admin, Canvas)</p>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {MODELS.map((model) => {
              const isEnabled = isModelGloballyEnabled(model.id)
              return (
                <button
                  key={model.id}
                  onClick={() => toggleModelGlobally(model.id)}
                  className={`p-4 rounded-xl border-2 transition-all ${
                    isEnabled
                      ? 'border-red-500 bg-red-500/20'
                      : 'border-green-500 bg-green-500/10'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-2xl">{model.icon}</span>
                    <div className={`w-3 h-3 rounded-full ${isEnabled ? 'bg-red-500' : 'bg-green-500'}`} />
                  </div>
                  <div className="text-left">
                    <p className="font-bold text-white text-sm">{model.name}</p>
                    <p className="text-xs text-slate-400 mt-1">
                      {isEnabled ? 'OFFLINE (Global)' : 'ONLINE'}
                    </p>
                  </div>
                </button>
              )
            })}
          </div>
        </div>

        {/* Video Scanner Controls */}
        <div className="mb-8">
          <h2 className="text-xl font-bold text-orange-400 mb-4 font-mono flex items-center gap-2">
            <Wrench size={20} /> VIDEO_SCANNER_CONTROLS
          </h2>
          <div className="p-6 rounded-xl bg-slate-900/60 backdrop-blur-sm border border-slate-800">
            {/* Scanner-level toggle */}
            <div className="flex items-center justify-between mb-6 pb-4 border-b border-slate-800">
              <div>
                <h3 className="text-lg font-bold text-white">Video Scanner</h3>
                <p className="text-xs text-slate-500">app/video-scanner</p>
              </div>
              <div className="flex items-center gap-3">
                <span className={`text-xs font-bold ${adminState.videoScannerMaintenance ? 'text-red-400' : 'text-green-400'}`}>
                  {adminState.videoScannerMaintenance ? 'OFFLINE' : 'ONLINE'}
                </span>
                <button
                  onClick={() => updateAdminState({ videoScannerMaintenance: !adminState.videoScannerMaintenance })}
                  className={`relative w-14 h-7 rounded-full transition-all ${
                    adminState.videoScannerMaintenance ? 'bg-red-500' : 'bg-green-500'
                  }`}
                >
                  <div className={`absolute top-1 w-5 h-5 bg-white rounded-full transition-transform ${
                    adminState.videoScannerMaintenance ? 'left-8' : 'left-1'
                  }`} />
                </button>
              </div>
            </div>

            {/* Per-model toggles */}
            <p className="text-xs text-slate-500 mb-3 uppercase tracking-wider font-bold">Model Controls</p>
            <div className="grid grid-cols-2 gap-3">
              {[
                { id: 'klingV3Maintenance', name: 'Kling 3.0', icon: '🎬' },
                { id: 'wan25Maintenance', name: 'WAN 2.5', icon: '🌊' },
              ].map((model) => {
                const isOffline = adminState[model.id]
                return (
                  <button
                    key={model.id}
                    onClick={() => updateAdminState({ [model.id]: !adminState[model.id] })}
                    className={`p-4 rounded-xl border-2 transition-all text-left ${
                      isOffline
                        ? 'border-red-500 bg-red-500/20'
                        : 'border-green-500 bg-green-500/10'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-2xl">{model.icon}</span>
                      <div className={`w-3 h-3 rounded-full ${isOffline ? 'bg-red-500' : 'bg-green-500'}`} />
                    </div>
                    <p className="font-bold text-white text-sm">{model.name}</p>
                    <p className={`text-xs mt-1 ${isOffline ? 'text-red-400' : 'text-green-400'}`}>
                      {isOffline ? 'OFFLINE — Maintenance' : 'ONLINE'}
                    </p>
                  </button>
                )
              })}
            </div>
          </div>
        </div>

        {/* Per-Scanner Model Controls */}
        <div className="mb-8">
          <h2 className="text-xl font-bold text-cyan-400 mb-4 font-mono flex items-center gap-2">
            <Wrench size={20} /> PER_SCANNER_CONTROLS
          </h2>
          <div className="space-y-6">
            {SCANNERS.map((scanner) => (
              <div key={scanner.id} className="p-6 rounded-xl bg-slate-900/60 backdrop-blur-sm border border-slate-800">
                {/* Scanner Header */}
                <div className="mb-4 pb-3 border-b border-slate-800">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <h3 className="text-lg font-bold text-white">{scanner.name}</h3>
                      <p className="text-xs text-slate-500">{scanner.path}</p>
                    </div>
                    <button
                      onClick={() => updateAdminState({ [`${scanner.id}Maintenance`]: !adminState[`${scanner.id}Maintenance`] })}
                      className={`relative w-14 h-7 rounded-full transition-all ${
                        adminState[`${scanner.id}Maintenance`] ? 'bg-red-500' : 'bg-green-500'
                      }`}
                    >
                      <div className={`absolute top-1 w-5 h-5 bg-white rounded-full transition-transform ${
                        adminState[`${scanner.id}Maintenance`] ? 'left-8' : 'left-1'
                      }`} />
                    </button>
                  </div>

                  {/* ALL MODELS Toggle */}
                  <button
                    onClick={() => toggleAllModels(scanner.id)}
                    className={`w-full p-2 rounded-lg border-2 transition-all text-sm font-bold ${
                      MODELS.every(model => adminState[`${scanner.id}_${model.id}`])
                        ? 'border-red-500 bg-red-500/20 text-red-400'
                        : 'border-yellow-500 bg-yellow-500/20 text-yellow-400'
                    }`}
                  >
                    {MODELS.every(model => adminState[`${scanner.id}_${model.id}`])
                      ? '✓ Turn ALL Models ON'
                      : '⚠ Turn ALL Models OFF'}
                  </button>
                </div>

                {/* Model Toggles */}
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2">
                  {MODELS.map((model) => {
                    const key = `${scanner.id}_${model.id}`
                    const isOffline = adminState[key]
                    return (
                      <button
                        key={key}
                        onClick={() => toggleScannerModel(scanner.id, model.id)}
                        className={`p-3 rounded-lg border transition-all ${
                          isOffline
                            ? 'border-red-500/50 bg-red-500/10'
                            : 'border-green-500/50 bg-green-500/5'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-lg">{model.icon}</span>
                          <div className={`w-2 h-2 rounded-full ${isOffline ? 'bg-red-500' : 'bg-green-500'}`} />
                        </div>
                        <p className="text-xs font-bold text-white truncate">{model.name}</p>
                        <p className={`text-[10px] mt-0.5 ${isOffline ? 'text-red-400' : 'text-green-400'}`}>
                          {isOffline ? 'OFF' : 'ON'}
                        </p>
                      </button>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
