"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { ArrowLeft, Zap, Image, Settings, RefreshCw, Copy, ExternalLink, Globe, Layers } from "lucide-react"
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

interface GeneratedImage {
  url: string
  width?: number
  height?: number
}

interface Result {
  images: GeneratedImage[]
  description: string
  elapsed: number
  requestId: string
}

export default function NanaBanana2PrototypePage() {
  const router = useRouter()
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

  // UI state
  const [isGenerating, setIsGenerating] = useState(false)
  const [result, setResult] = useState<Result | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [selectedImage, setSelectedImage] = useState<GeneratedImage | null>(null)

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

  const handleGenerate = async () => {
    if (!prompt.trim()) return
    setIsGenerating(true)
    setError(null)
    setResult(null)
    setSelectedImage(null)

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
        setResult(data)
        setSelectedImage(data.images[0] || null)
      }
    } catch (err: any) {
      setError(err.message || 'Network error')
    } finally {
      setIsGenerating(false)
    }
  }

  const randomizeSeed = () => setSeed(String(Math.floor(Math.random() * 2147483647)))
  const clearSeed = () => setSeed("")

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#050810] flex items-center justify-center">
        <div className="text-yellow-400 font-mono animate-pulse">Loading...</div>
      </div>
    )
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

      <div className="max-w-7xl mx-auto px-4 py-6 flex gap-6">

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
              Seed <span className="text-slate-600 normal-case font-normal">(optional — for reproducibility)</span>
            </label>
            <div className="flex gap-2">
              <input
                type="number"
                value={seed}
                onChange={e => setSeed(e.target.value)}
                placeholder="Leave blank for random"
                className="flex-1 px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 focus:border-yellow-500 text-white text-sm placeholder:text-slate-600 focus:outline-none"
              />
              <button
                onClick={randomizeSeed}
                className="px-2 py-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-300 transition-all"
                title="Random seed"
              >
                <RefreshCw size={14} />
              </button>
              {seed && (
                <button
                  onClick={clearSeed}
                  className="px-2 py-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-300 transition-all text-xs"
                >
                  ✕
                </button>
              )}
            </div>
          </div>

          {/* Toggles */}
          <div className="p-4 rounded-xl border border-slate-800 bg-slate-900/60 space-y-3">
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">
              Options
            </label>

            {/* Limit Generations */}
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-white">Limit Generations</p>
                <p className="text-[10px] text-slate-500">Force single output per prompt, ignore multi-image instructions</p>
              </div>
              <button
                onClick={() => setLimitGenerations(v => !v)}
                className={`relative w-11 h-6 rounded-full transition-all flex-shrink-0 ${
                  limitGenerations ? 'bg-yellow-500' : 'bg-slate-700'
                }`}
              >
                <span className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${
                  limitGenerations ? 'left-6' : 'left-1'
                }`} />
              </button>
            </div>

            {/* Web Search */}
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-white flex items-center gap-1.5">
                  <Globe size={12} className="text-cyan-400" />
                  Enable Web Search
                </p>
                <p className="text-[10px] text-slate-500">Let the model use live web data to inform generation</p>
              </div>
              <button
                onClick={() => setEnableWebSearch(v => !v)}
                className={`relative w-11 h-6 rounded-full transition-all flex-shrink-0 ${
                  enableWebSearch ? 'bg-cyan-500' : 'bg-slate-700'
                }`}
              >
                <span className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${
                  enableWebSearch ? 'left-6' : 'left-1'
                }`} />
              </button>
            </div>
          </div>

          {/* Generate Button */}
          <button
            onClick={handleGenerate}
            disabled={isGenerating || !prompt.trim()}
            className={`w-full py-4 rounded-xl font-black text-sm tracking-widest transition-all ${
              isGenerating || !prompt.trim()
                ? 'bg-slate-800 text-slate-600 cursor-not-allowed'
                : 'bg-gradient-to-r from-yellow-500 to-orange-500 text-black hover:from-yellow-400 hover:to-orange-400 shadow-lg shadow-yellow-500/20'
            }`}
          >
            {isGenerating ? (
              <span className="flex items-center justify-center gap-2">
                <Zap size={16} className="animate-pulse" />
                GENERATING...
              </span>
            ) : (
              <span className="flex items-center justify-center gap-2">
                <Zap size={16} />
                GENERATE ({numImages} image{numImages > 1 ? 's' : ''})
              </span>
            )}
          </button>

          {/* Current params summary */}
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

        {/* ── Right panel: Output ── */}
        <div className="flex-1 min-w-0">

          {/* Error */}
          {error && (
            <div className="mb-4 p-4 rounded-xl border border-red-500/40 bg-red-500/10">
              <p className="text-red-400 font-bold text-sm">Generation Failed</p>
              <p className="text-red-300 text-xs mt-1">{error}</p>
            </div>
          )}

          {/* Loading */}
          {isGenerating && (
            <div className="flex flex-col items-center justify-center h-96 rounded-xl border border-yellow-500/20 bg-slate-900/40">
              <Zap size={48} className="text-yellow-400 animate-pulse mb-4" />
              <p className="text-yellow-400 font-bold">Generating with NanoBanana Pro 2...</p>
              <p className="text-slate-500 text-xs mt-2">
                {resolution} resolution · {numImages} image{numImages > 1 ? 's' : ''} · {aspectRatio} ratio
              </p>
              <div className="flex gap-1 mt-4">
                <div className="w-2 h-2 bg-yellow-500 rounded-full animate-pulse" />
                <div className="w-2 h-2 bg-yellow-500 rounded-full animate-pulse" style={{ animationDelay: '0.2s' }} />
                <div className="w-2 h-2 bg-yellow-500 rounded-full animate-pulse" style={{ animationDelay: '0.4s' }} />
              </div>
            </div>
          )}

          {/* Results */}
          {result && !isGenerating && (
            <div className="space-y-4">
              {/* Meta */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-xs text-green-400 font-bold bg-green-500/10 border border-green-500/30 px-2 py-1 rounded-full">
                    ✓ {result.images.length} image{result.images.length > 1 ? 's' : ''} generated
                  </span>
                  <span className="text-xs text-slate-500 font-mono">
                    {(result.elapsed / 1000).toFixed(1)}s
                  </span>
                  <span className="text-[10px] text-slate-600 font-mono">{result.requestId}</span>
                </div>
              </div>

              {/* Description (if any) */}
              {result.description && (
                <div className="p-3 rounded-lg border border-slate-700 bg-slate-900/40">
                  <p className="text-[10px] text-slate-500 uppercase font-bold mb-1">Model Description</p>
                  <p className="text-sm text-slate-300">{result.description}</p>
                </div>
              )}

              {/* Image grid */}
              {result.images.length > 1 && (
                <div className={`grid gap-3 ${result.images.length === 2 ? 'grid-cols-2' : result.images.length === 3 ? 'grid-cols-3' : 'grid-cols-2'}`}>
                  {result.images.map((img, i) => (
                    <div
                      key={i}
                      onClick={() => setSelectedImage(img)}
                      className={`relative rounded-xl overflow-hidden cursor-pointer border-2 transition-all ${
                        selectedImage?.url === img.url
                          ? 'border-yellow-500 shadow-lg shadow-yellow-500/20'
                          : 'border-slate-700 hover:border-yellow-500/50'
                      }`}
                    >
                      <img src={img.url} alt={`Generated ${i + 1}`} className="w-full object-contain bg-slate-900" />
                      <div className="absolute bottom-0 left-0 right-0 bg-black/60 px-2 py-1 flex items-center justify-between">
                        <span className="text-[10px] text-slate-400">#{i + 1}</span>
                        {img.width && <span className="text-[10px] text-slate-500">{img.width}×{img.height}</span>}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Selected / single image */}
              {selectedImage && (
                <div className="rounded-xl overflow-hidden border border-slate-700 bg-slate-900">
                  <img
                    src={selectedImage.url}
                    alt="Generated image"
                    className="w-full object-contain max-h-[70vh]"
                  />
                  <div className="p-3 flex items-center justify-between border-t border-slate-800">
                    <div className="text-xs text-slate-400 font-mono">
                      {selectedImage.width && selectedImage.height
                        ? `${selectedImage.width} × ${selectedImage.height} · ${outputFormat.toUpperCase()}`
                        : outputFormat.toUpperCase()}
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => navigator.clipboard.writeText(selectedImage.url)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs transition-all"
                      >
                        <Copy size={12} />
                        Copy URL
                      </button>
                      <a
                        href={selectedImage.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-yellow-500/20 hover:bg-yellow-500/30 text-yellow-400 text-xs transition-all"
                      >
                        <ExternalLink size={12} />
                        Open
                      </a>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Empty state */}
          {!result && !isGenerating && !error && (
            <div className="flex flex-col items-center justify-center h-96 rounded-xl border border-slate-800 bg-slate-900/20">
              <Layers size={48} className="text-slate-700 mb-4" />
              <p className="text-slate-500 font-medium">Set your parameters and generate</p>
              <p className="text-slate-600 text-xs mt-1">fal-ai/nano-banana-2</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
