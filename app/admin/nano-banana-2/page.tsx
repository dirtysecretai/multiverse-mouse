"use client"

import { useState, useEffect } from "react"
import { ArrowLeft, Zap, RefreshCw, Copy, ExternalLink, Globe, Layers, ChevronLeft, ChevronRight, Trash2, AlertTriangle } from "lucide-react"
import Link from "next/link"

const ASPECT_RATIOS = [
  { value: "auto", label: "Auto" },
  { value: "1:1", label: "1:1" },
  { value: "16:9", label: "16:9" },
  { value: "9:16", label: "9:16" },
  { value: "4:3", label: "4:3" },
  { value: "3:4", label: "3:4" },
  { value: "3:2", label: "3:2" },
  { value: "2:3", label: "2:3" },
  { value: "4:5", label: "4:5" },
  { value: "5:4", label: "5:4" },
  { value: "21:9", label: "21:9" },
]

const RESOLUTIONS = ["0.5K", "1K", "2K", "4K"] as const
const OUTPUT_FORMATS = ["png", "jpeg", "webp"] as const
const SAFETY_LEVELS = [
  { value: "1", label: "1 — Strictest" },
  { value: "2", label: "2 — Strict" },
  { value: "3", label: "3 — Moderate" },
  { value: "4", label: "4 — Default" },
  { value: "5", label: "5 — Permissive" },
  { value: "6", label: "6 — Least Strict" },
]

const MAX_FEED = 25
const MAX_CONCURRENT = 2
const FEED_KEY = 'nb2-session-feed'
const ACTIVE_KEY = 'nb2-active-count'

interface GeneratedImage {
  url: string
  width?: number
  height?: number
}

interface CarouselEntry {
  id: string
  images: GeneratedImage[]
  currentIndex: number
  prompt: string
  elapsed: number
  requestId: string
  description?: string
}

interface LoadingEntry {
  id: string
  prompt: string
  numImages: number
  resolution: string
  aspectRatio: string
}

export default function NanaBanana2PrototypePage() {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [password, setPassword] = useState("")

  // Generation params
  const [prompt, setPrompt] = useState("")
  const [aspectRatio, setAspectRatio] = useState("auto")
  const [resolution, setResolution] = useState<"0.5K" | "1K" | "2K" | "4K">("1K")
  const [numImages, setNumImages] = useState(1)
  const [outputFormat, setOutputFormat] = useState<"png" | "jpeg" | "webp">("png")
  const [safetyTolerance, setSafetyTolerance] = useState("4")
  const [seed, setSeed] = useState("")
  const [limitGenerations, setLimitGenerations] = useState(true)
  const [enableWebSearch, setEnableWebSearch] = useState(false)

  // Feed + concurrent state
  const [sessionFeed, setSessionFeed] = useState<CarouselEntry[]>([])
  const [loadingEntries, setLoadingEntries] = useState<LoadingEntry[]>([])
  // Slots blocked because the page was refreshed mid-generation
  const [blockedSlots, setBlockedSlots] = useState(0)
  const [error, setError] = useState<string | null>(null)

  // ── Restore on mount ──────────────────────────────────────────────────────
  useEffect(() => {
    // Auth
    const authStatus = localStorage.getItem("multiverse-admin-auth")
    const savedPassword = sessionStorage.getItem("admin-password")
    if (authStatus === "true" && savedPassword) setIsAuthenticated(true)

    // Restore session feed
    try {
      const saved = localStorage.getItem(FEED_KEY)
      if (saved) setSessionFeed(JSON.parse(saved).slice(0, MAX_FEED))
    } catch {}

    // Restore blocked slots from a previous interrupted generation
    try {
      const count = parseInt(sessionStorage.getItem(ACTIVE_KEY) || '0') || 0
      if (count > 0) setBlockedSlots(count)
    } catch {}

    setIsLoading(false)
  }, [])

  // ── Persist feed to localStorage on every change ──────────────────────────
  useEffect(() => {
    try {
      localStorage.setItem(FEED_KEY, JSON.stringify(sessionFeed))
    } catch {}
  }, [sessionFeed])

  // ── Track active count in sessionStorage so refreshes see the right state ─
  const bumpActiveCount = (delta: number) => {
    try {
      const current = parseInt(sessionStorage.getItem(ACTIVE_KEY) || '0') || 0
      sessionStorage.setItem(ACTIVE_KEY, String(Math.max(0, current + delta)))
    } catch {}
  }

  const resetBlockedSlots = () => {
    setBlockedSlots(0)
    try { sessionStorage.setItem(ACTIVE_KEY, '0') } catch {}
  }

  // ── Derived queue state ───────────────────────────────────────────────────
  const totalActive = loadingEntries.length + blockedSlots
  const canGenerate = totalActive < MAX_CONCURRENT && prompt.trim().length > 0

  // ── Generate ──────────────────────────────────────────────────────────────
  const handleGenerate = async () => {
    if (!canGenerate) return

    const loadingId = `loading-${Date.now()}-${Math.random().toString(36).slice(2)}`
    const entry: LoadingEntry = {
      id: loadingId,
      prompt: prompt.trim(),
      numImages,
      resolution,
      aspectRatio,
    }

    setLoadingEntries(prev => [...prev, entry])
    bumpActiveCount(+1)
    setError(null)

    try {
      const res = await fetch('/api/admin/nano-banana-2', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt,
          aspect_ratio: aspectRatio,
          resolution,
          num_images: numImages,
          output_format: outputFormat,
          safety_tolerance: safetyTolerance,
          seed: seed.trim() || undefined,
          limit_generations: limitGenerations,
          enable_web_search: enableWebSearch,
        }),
      })

      const data = await res.json()
      if (!res.ok || !data.success) {
        setError(data.error || 'Generation failed')
      } else {
        const carousel: CarouselEntry = {
          id: `gen-${Date.now()}-${Math.random().toString(36).slice(2)}`,
          images: data.images,
          currentIndex: 0,
          prompt: prompt.trim(),
          elapsed: data.elapsed,
          requestId: data.requestId,
          description: data.description,
        }
        setSessionFeed(prev => [carousel, ...prev].slice(0, MAX_FEED))
      }
    } catch (err: any) {
      setError(err.message || 'Network error')
    } finally {
      setLoadingEntries(prev => prev.filter(e => e.id !== loadingId))
      bumpActiveCount(-1)
    }
  }

  // ── Carousel navigation ───────────────────────────────────────────────────
  const navigate = (id: string, direction: 'prev' | 'next') => {
    setSessionFeed(prev => prev.map(c => {
      if (c.id !== id) return c
      const total = c.images.length
      const newIndex = direction === 'prev'
        ? (c.currentIndex - 1 + total) % total
        : (c.currentIndex + 1) % total
      return { ...c, currentIndex: newIndex }
    }))
  }

  const goToIndex = (id: string, index: number) => {
    setSessionFeed(prev => prev.map(c =>
      c.id === id ? { ...c, currentIndex: index } : c
    ))
  }

  const removeEntry = (id: string) => {
    setSessionFeed(prev => prev.filter(c => c.id !== id))
  }

  const randomizeSeed = () => setSeed(String(Math.floor(Math.random() * 2147483647)))
  const clearSeed = () => setSeed("")

  // ── Auth gate ─────────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#050810] flex items-center justify-center">
        <div className="text-yellow-400 font-mono animate-pulse">Loading...</div>
      </div>
    )
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const res = await fetch('/api/admin/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password })
      })
      if (res.ok) {
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

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-[#050810] flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <h1 className="text-3xl font-black text-center text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 to-orange-500 mb-6">
            NANO BANANA 2 PROTOTYPE
          </h1>
          <form onSubmit={handleLogin} className="p-6 rounded-xl border border-slate-800 bg-slate-900/60">
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Admin password"
              className="w-full p-3 rounded-lg bg-slate-950 border border-slate-700 text-white focus:border-yellow-500 focus:outline-none mb-4"
            />
            <button type="submit" className="w-full py-3 rounded-lg bg-gradient-to-r from-yellow-500 to-orange-500 text-black font-black">
              ACCESS
            </button>
          </form>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#050810] text-white">
      <div className="fixed inset-0 bg-[linear-gradient(rgba(234,179,8,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(234,179,8,0.02)_1px,transparent_1px)] bg-[size:40px_40px] pointer-events-none" />

      {/* Header */}
      <div className="sticky top-0 z-20 border-b border-yellow-500/20 bg-slate-900/80 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/admin/prototype">
              <button className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 transition-all">
                <ArrowLeft size={16} className="text-slate-400" />
              </button>
            </Link>
            <div>
              <h1 className="text-lg font-black text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 to-orange-400">
                NANO BANANA PRO 2
              </h1>
              <p className="text-[10px] text-slate-500 font-mono">fal-ai/nano-banana-2 · Prototype</p>
            </div>
          </div>
          <span className="text-[10px] font-bold px-2 py-1 rounded-full bg-yellow-500/20 text-yellow-400">
            PROTOTYPE
          </span>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6 flex gap-6 items-start">

        {/* ── Left panel: Controls ── */}
        <div className="w-80 flex-shrink-0 space-y-4">

          {/* Prompt */}
          <div className="p-4 rounded-xl border border-slate-800 bg-slate-900/60">
            <label className="block text-xs font-bold text-yellow-400 uppercase tracking-wider mb-2">
              Prompt
            </label>
            <textarea
              value={prompt}
              onChange={e => setPrompt(e.target.value)}
              placeholder="Describe the image to generate..."
              rows={5}
              className="w-full p-3 rounded-lg bg-slate-950 border border-slate-700 focus:border-yellow-500 text-white text-sm placeholder:text-slate-600 focus:outline-none resize-none"
            />
          </div>

          {/* Aspect Ratio */}
          <div className="p-4 rounded-xl border border-slate-800 bg-slate-900/60">
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
              Aspect Ratio
            </label>
            <div className="grid grid-cols-4 gap-1.5">
              {ASPECT_RATIOS.map(ar => (
                <button
                  key={ar.value}
                  onClick={() => setAspectRatio(ar.value)}
                  className={`py-1.5 px-1 rounded-lg text-xs font-bold transition-all ${
                    aspectRatio === ar.value
                      ? 'bg-yellow-500 text-black'
                      : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-white'
                  }`}
                >
                  {ar.label}
                </button>
              ))}
            </div>
          </div>

          {/* Resolution */}
          <div className="p-4 rounded-xl border border-slate-800 bg-slate-900/60">
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
              Resolution
            </label>
            <div className="grid grid-cols-4 gap-1.5">
              {RESOLUTIONS.map(r => (
                <button
                  key={r}
                  onClick={() => setResolution(r)}
                  className={`py-2 rounded-lg text-xs font-bold transition-all ${
                    resolution === r
                      ? 'bg-orange-500 text-black'
                      : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-white'
                  }`}
                >
                  {r}
                </button>
              ))}
            </div>
          </div>

          {/* Num Images */}
          <div className="p-4 rounded-xl border border-slate-800 bg-slate-900/60">
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
              Number of Images
            </label>
            <div className="grid grid-cols-4 gap-1.5">
              {[1, 2, 3, 4].map(n => (
                <button
                  key={n}
                  onClick={() => setNumImages(n)}
                  className={`py-2 rounded-lg text-sm font-black transition-all ${
                    numImages === n
                      ? 'bg-yellow-500 text-black'
                      : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-white'
                  }`}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>

          {/* Safety Tolerance */}
          <div className="p-4 rounded-xl border border-slate-800 bg-slate-900/60">
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
              Safety Tolerance
            </label>
            <div className="space-y-1">
              {SAFETY_LEVELS.map(s => (
                <button
                  key={s.value}
                  onClick={() => setSafetyTolerance(s.value)}
                  className={`w-full text-left px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                    safetyTolerance === s.value
                      ? 'bg-red-500/20 border border-red-500/50 text-red-400'
                      : 'bg-slate-800 text-slate-500 hover:bg-slate-700 hover:text-white'
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          {/* Output Format */}
          <div className="p-4 rounded-xl border border-slate-800 bg-slate-900/60">
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
              Output Format
            </label>
            <div className="grid grid-cols-3 gap-1.5">
              {OUTPUT_FORMATS.map(f => (
                <button
                  key={f}
                  onClick={() => setOutputFormat(f)}
                  className={`py-2 rounded-lg text-xs font-bold uppercase transition-all ${
                    outputFormat === f
                      ? 'bg-cyan-500 text-black'
                      : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-white'
                  }`}
                >
                  {f}
                </button>
              ))}
            </div>
          </div>

          {/* Seed */}
          <div className="p-4 rounded-xl border border-slate-800 bg-slate-900/60">
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
              Seed <span className="text-slate-600 normal-case font-normal">(optional)</span>
            </label>
            <div className="flex gap-2">
              <input
                type="number"
                value={seed}
                onChange={e => setSeed(e.target.value)}
                placeholder="Leave blank for random"
                className="flex-1 px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 focus:border-yellow-500 text-white text-sm placeholder:text-slate-600 focus:outline-none"
              />
              <button onClick={randomizeSeed} className="px-2 py-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-300 transition-all" title="Random seed">
                <RefreshCw size={14} />
              </button>
              {seed && (
                <button onClick={clearSeed} className="px-2 py-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-300 transition-all text-xs">
                  ✕
                </button>
              )}
            </div>
          </div>

          {/* Toggles */}
          <div className="p-4 rounded-xl border border-slate-800 bg-slate-900/60 space-y-3">
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Options</label>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-white">Limit Generations</p>
                <p className="text-[10px] text-slate-500">Force single output per prompt</p>
              </div>
              <button
                onClick={() => setLimitGenerations(v => !v)}
                className={`relative w-11 h-6 rounded-full transition-all flex-shrink-0 ${limitGenerations ? 'bg-yellow-500' : 'bg-slate-700'}`}
              >
                <span className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${limitGenerations ? 'left-6' : 'left-1'}`} />
              </button>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-white flex items-center gap-1.5">
                  <Globe size={12} className="text-cyan-400" />
                  Enable Web Search
                </p>
                <p className="text-[10px] text-slate-500">Use live web data to inform generation</p>
              </div>
              <button
                onClick={() => setEnableWebSearch(v => !v)}
                className={`relative w-11 h-6 rounded-full transition-all flex-shrink-0 ${enableWebSearch ? 'bg-cyan-500' : 'bg-slate-700'}`}
              >
                <span className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${enableWebSearch ? 'left-6' : 'left-1'}`} />
              </button>
            </div>
          </div>

          {/* Generate Button */}
          <button
            onClick={handleGenerate}
            disabled={!canGenerate}
            className={`w-full py-4 rounded-xl font-black text-sm tracking-widest transition-all ${
              !canGenerate
                ? 'bg-slate-800 text-slate-600 cursor-not-allowed'
                : 'bg-gradient-to-r from-yellow-500 to-orange-500 text-black hover:from-yellow-400 hover:to-orange-400 shadow-lg shadow-yellow-500/20'
            }`}
          >
            <span className="flex items-center justify-center gap-2">
              <Zap size={16} className={loadingEntries.length > 0 ? 'animate-pulse' : ''} />
              GENERATE
              <span className={`text-xs font-bold px-1.5 py-0.5 rounded-full ${
                totalActive >= MAX_CONCURRENT
                  ? 'bg-slate-700 text-slate-500'
                  : totalActive > 0
                    ? 'bg-black/30 text-black/70'
                    : 'bg-black/20 text-black/60'
              }`}>
                {totalActive}/{MAX_CONCURRENT}
              </span>
            </span>
          </button>

          {/* Params summary */}
          <div className="p-3 rounded-xl border border-slate-800 bg-slate-950/60 font-mono text-[10px] text-slate-500 space-y-1">
            <p className="text-slate-400 font-bold mb-1">Current Parameters</p>
            <p>aspect_ratio: <span className="text-yellow-400">{aspectRatio}</span></p>
            <p>resolution: <span className="text-orange-400">{resolution}</span></p>
            <p>num_images: <span className="text-yellow-400">{numImages}</span></p>
            <p>output_format: <span className="text-cyan-400">{outputFormat}</span></p>
            <p>safety_tolerance: <span className="text-red-400">{safetyTolerance}</span></p>
            <p>limit_generations: <span className="text-yellow-400">{String(limitGenerations)}</span></p>
            <p>enable_web_search: <span className="text-cyan-400">{String(enableWebSearch)}</span></p>
            {seed && <p>seed: <span className="text-purple-400">{seed}</span></p>}
          </div>
        </div>

        {/* ── Right panel: Session Feed ── */}
        <div className="flex-1 min-w-0 flex flex-col gap-3">

          {/* Interrupted generations warning */}
          {blockedSlots > 0 && (
            <div className="flex items-center gap-3 p-3 rounded-xl border border-amber-500/40 bg-amber-500/10">
              <AlertTriangle size={16} className="text-amber-400 flex-shrink-0" />
              <p className="text-amber-300 text-xs flex-1">
                <span className="font-bold">{blockedSlots} generation{blockedSlots > 1 ? 's' : ''}</span> {blockedSlots > 1 ? 'were' : 'was'} interrupted by a page refresh and cannot be recovered.
              </p>
              <button
                onClick={resetBlockedSlots}
                className="text-[10px] font-bold px-2.5 py-1 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-400 transition-all flex-shrink-0"
              >
                Reset
              </button>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="p-4 rounded-xl border border-red-500/40 bg-red-500/10">
              <p className="text-red-400 font-bold text-sm">Generation Failed</p>
              <p className="text-red-300 text-xs mt-1">{error}</p>
            </div>
          )}

          {/* Active loading entries */}
          {loadingEntries.map(entry => (
            <div key={entry.id} className="flex items-center gap-4 p-4 rounded-xl border border-yellow-500/20 bg-slate-900/40">
              <Zap size={22} className="text-yellow-400 animate-pulse flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-yellow-400 font-bold text-sm">Generating...</p>
                <p className="text-slate-500 text-xs truncate mt-0.5">{entry.prompt}</p>
              </div>
              <div className="text-right flex-shrink-0">
                <p className="text-[10px] text-slate-500 font-mono">{entry.resolution} · {entry.numImages} img · {entry.aspectRatio}</p>
              </div>
              <div className="flex gap-1 flex-shrink-0">
                <div className="w-1.5 h-1.5 bg-yellow-500 rounded-full animate-pulse" />
                <div className="w-1.5 h-1.5 bg-yellow-500 rounded-full animate-pulse" style={{ animationDelay: '0.2s' }} />
                <div className="w-1.5 h-1.5 bg-yellow-500 rounded-full animate-pulse" style={{ animationDelay: '0.4s' }} />
              </div>
            </div>
          ))}

          {/* Feed header */}
          {sessionFeed.length > 0 && (
            <div className="flex items-center justify-between px-1">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                Session Feed{' '}
                <span className="text-slate-600 normal-case font-normal">{sessionFeed.length}/{MAX_FEED}</span>
              </p>
              <button
                onClick={() => setSessionFeed([])}
                className="text-[10px] text-slate-600 hover:text-red-400 transition-all flex items-center gap-1"
              >
                <Trash2 size={10} />
                Clear all
              </button>
            </div>
          )}

          {/* Scrollable carousel feed */}
          {sessionFeed.length > 0 && (
            <div className="overflow-y-auto space-y-4 pr-1" style={{ maxHeight: 'calc(100vh - 120px)' }}>
              {sessionFeed.map(entry => {
                const img = entry.images[entry.currentIndex]
                return (
                  <div key={entry.id} className="rounded-xl border border-slate-700/80 bg-slate-900/60 overflow-hidden">
                    {/* Image area */}
                    <div className="relative bg-slate-950" style={{ height: '460px' }}>
                      <img
                        src={img.url}
                        alt={`Generated image ${entry.currentIndex + 1}`}
                        className="w-full h-full object-contain"
                        loading="lazy"
                      />

                      {/* Prev / Next arrows */}
                      {entry.images.length > 1 && (
                        <>
                          <button
                            onClick={() => navigate(entry.id, 'prev')}
                            className="absolute left-2 top-1/2 -translate-y-1/2 p-2 rounded-full bg-black/60 hover:bg-black/85 text-white transition-all backdrop-blur-sm"
                          >
                            <ChevronLeft size={22} />
                          </button>
                          <button
                            onClick={() => navigate(entry.id, 'next')}
                            className="absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-full bg-black/60 hover:bg-black/85 text-white transition-all backdrop-blur-sm"
                          >
                            <ChevronRight size={22} />
                          </button>

                          {/* Dot indicators */}
                          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-1.5">
                            {entry.images.map((_, i) => (
                              <button
                                key={i}
                                onClick={() => goToIndex(entry.id, i)}
                                className={`h-1.5 rounded-full transition-all ${
                                  i === entry.currentIndex
                                    ? 'bg-yellow-400 w-4'
                                    : 'bg-white/40 w-1.5 hover:bg-white/70'
                                }`}
                              />
                            ))}
                          </div>
                        </>
                      )}

                      {/* Top-right badges */}
                      <div className="absolute top-2 right-2 flex items-center gap-1.5">
                        {entry.images.length > 1 && (
                          <span className="px-2 py-0.5 rounded-full bg-black/65 text-[10px] text-white font-bold backdrop-blur-sm">
                            {entry.currentIndex + 1}/{entry.images.length}
                          </span>
                        )}
                        <button
                          onClick={() => removeEntry(entry.id)}
                          className="p-1 rounded-full bg-black/65 text-slate-400 hover:text-red-400 transition-all backdrop-blur-sm"
                          title="Remove"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </div>

                    {/* Info bar */}
                    <div className="p-3 border-t border-slate-800 space-y-2">
                      <p className="text-xs text-slate-300 line-clamp-2 leading-relaxed">{entry.prompt}</p>
                      {entry.description && (
                        <p className="text-[10px] text-slate-500 italic line-clamp-1">{entry.description}</p>
                      )}
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <span className="text-[10px] text-slate-600 font-mono">{(entry.elapsed / 1000).toFixed(1)}s</span>
                          {img.width && img.height && (
                            <span className="text-[10px] text-slate-600 font-mono">{img.width}×{img.height}</span>
                          )}
                          <span className="text-[10px] text-slate-700 font-mono truncate max-w-[100px]">{entry.requestId}</span>
                        </div>
                        <div className="flex gap-1.5">
                          <button
                            onClick={() => navigator.clipboard.writeText(img.url)}
                            className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] transition-all"
                          >
                            <Copy size={10} />
                            Copy URL
                          </button>
                          <a
                            href={img.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-yellow-500/20 hover:bg-yellow-500/30 text-yellow-400 text-[10px] transition-all"
                          >
                            <ExternalLink size={10} />
                            Open
                          </a>
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {/* Empty state */}
          {sessionFeed.length === 0 && loadingEntries.length === 0 && !error && blockedSlots === 0 && (
            <div className="flex flex-col items-center justify-center h-96 rounded-xl border border-slate-800 bg-slate-900/20">
              <Layers size={48} className="text-slate-700 mb-4" />
              <p className="text-slate-500 font-medium">Set your parameters and generate</p>
              <p className="text-slate-600 text-xs mt-1">fal-ai/nano-banana-2 · Feed persists across refreshes</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
