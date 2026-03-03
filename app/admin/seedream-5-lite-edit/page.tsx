"use client"

import { useState, useEffect, useRef } from "react"
import { ArrowLeft, Sparkles, Upload, X, Copy, ExternalLink, RefreshCw, Image as ImageIcon, Settings } from "lucide-react"
import Link from "next/link"

// ─── Constants ────────────────────────────────────────────────────────────────

const IMAGE_SIZE_PRESETS = [
  { value: "auto_2K", label: "Auto 2K", desc: "Default · ~2048px" },
  { value: "auto_3K", label: "Auto 3K", desc: "Larger · ~3072px" },
  { value: "square_hd", label: "Square HD", desc: "1:1 HD" },
  { value: "square", label: "Square", desc: "1:1" },
  { value: "landscape_16_9", label: "16:9", desc: "Landscape" },
  { value: "portrait_16_9", label: "9:16", desc: "Portrait" },
  { value: "landscape_4_3", label: "4:3", desc: "Landscape" },
  { value: "portrait_4_3", label: "3:4", desc: "Portrait" },
  { value: "custom", label: "Custom", desc: "W × H" },
]

const MAX_IMAGES = 10

interface UploadedImage {
  base64: string
  preview: string
  name: string
}

interface GeneratedImage {
  url: string
  width?: number
  height?: number
}

interface Result {
  images: GeneratedImage[]
  seed?: number
  elapsed: number
  requestId: string
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function SeedDream5LiteEditPage() {
  // Auth
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [password, setPassword] = useState("")

  // Inputs
  const [uploadedImages, setUploadedImages] = useState<UploadedImage[]>([])
  const [prompt, setPrompt] = useState("")
  const [imageSize, setImageSize] = useState("auto_2K")
  const [customWidth, setCustomWidth] = useState("1280")
  const [customHeight, setCustomHeight] = useState("720")
  const [numImages, setNumImages] = useState(1)
  const [maxImages, setMaxImages] = useState(1)
  const [enableSafetyChecker, setEnableSafetyChecker] = useState(true)

  // UI state
  const [isGenerating, setIsGenerating] = useState(false)
  const [result, setResult] = useState<Result | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [selectedImage, setSelectedImage] = useState<GeneratedImage | null>(null)
  const [isDragging, setIsDragging] = useState(false)

  const fileInputRef = useRef<HTMLInputElement>(null)

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
        body: JSON.stringify({ password }),
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

  // ─── Image upload helpers ─────────────────────────────────────────────────

  const processFiles = (files: FileList | null) => {
    if (!files) return
    const remaining = MAX_IMAGES - uploadedImages.length
    if (remaining <= 0) return

    Array.from(files).slice(0, remaining).forEach(file => {
      if (!file.type.startsWith('image/')) return
      const reader = new FileReader()
      reader.onload = (e) => {
        const base64 = e.target?.result as string
        setUploadedImages(prev => [
          ...prev,
          { base64, preview: base64, name: file.name },
        ])
      }
      reader.readAsDataURL(file)
    })
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    processFiles(e.target.files)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    processFiles(e.dataTransfer.files)
  }

  const removeImage = (index: number) => {
    setUploadedImages(prev => prev.filter((_, i) => i !== index))
  }

  const moveImage = (from: number, to: number) => {
    setUploadedImages(prev => {
      const next = [...prev]
      const [item] = next.splice(from, 1)
      next.splice(to, 0, item)
      return next
    })
  }

  // ─── Generation ──────────────────────────────────────────────────────────

  const handleGenerate = async () => {
    if (!prompt.trim()) return
    setIsGenerating(true)
    setError(null)
    setResult(null)
    setSelectedImage(null)

    try {
      const body: Record<string, unknown> = {
        prompt,
        images_base64: uploadedImages.map(img => img.base64),
        image_size: imageSize,
        num_images: numImages,
        max_images: maxImages,
        enable_safety_checker: enableSafetyChecker,
      }

      if (imageSize === 'custom') {
        body.custom_width = customWidth
        body.custom_height = customHeight
      }

      const res = await fetch('/api/admin/seedream-5-lite-edit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
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

  // ─── Auth gate ────────────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#050810] flex items-center justify-center">
        <div className="text-teal-400 font-mono animate-pulse">Loading...</div>
      </div>
    )
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-[#050810] flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <h1 className="text-3xl font-black text-center text-transparent bg-clip-text bg-gradient-to-r from-teal-400 to-cyan-400 mb-6">
            SEEDREAM 5.0 LITE EDIT
          </h1>
          <form onSubmit={handleLogin} className="p-6 rounded-xl border border-slate-800 bg-slate-900/60">
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="Admin password"
              className="w-full p-3 rounded-lg bg-slate-950 border border-slate-700 text-white focus:border-teal-500 focus:outline-none mb-4"
            />
            <button type="submit" className="w-full py-3 rounded-lg bg-gradient-to-r from-teal-500 to-cyan-500 text-black font-black">
              ACCESS
            </button>
          </form>
        </div>
      </div>
    )
  }

  // ─── Main UI ──────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-[#050810] text-white">
      <div className="fixed inset-0 bg-[linear-gradient(rgba(20,184,166,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(20,184,166,0.02)_1px,transparent_1px)] bg-[size:40px_40px] pointer-events-none" />

      {/* Header */}
      <div className="sticky top-0 z-20 border-b border-teal-500/20 bg-slate-900/80 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/admin/prototype">
              <button className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 transition-all">
                <ArrowLeft size={16} className="text-slate-400" />
              </button>
            </Link>
            <div>
              <h1 className="text-lg font-black text-transparent bg-clip-text bg-gradient-to-r from-teal-400 to-cyan-400">
                SEEDREAM 5.0 LITE EDIT
              </h1>
              <p className="text-[10px] text-slate-500 font-mono">fal-ai/bytedance/seedream/v5/lite/edit · Prototype</p>
            </div>
          </div>
          <span className="text-[10px] font-bold px-2 py-1 rounded-full bg-teal-500/20 text-teal-400">
            PROTOTYPE
          </span>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6 flex gap-6">

        {/* ── Left Panel: Controls ── */}
        <div className="w-80 flex-shrink-0 space-y-4">

          {/* Reference Image Upload */}
          <div className="p-4 rounded-xl border border-slate-800 bg-slate-900/60">
            <div className="flex items-center justify-between mb-3">
              <label className="text-xs font-bold text-teal-400 uppercase tracking-wider">
                Reference Images
              </label>
              <span className="text-[10px] text-slate-500">
                {uploadedImages.length}/{MAX_IMAGES}
              </span>
            </div>

            {/* Upload zone */}
            {uploadedImages.length < MAX_IMAGES && (
              <div
                onDragOver={e => { e.preventDefault(); setIsDragging(true) }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-xl p-4 text-center cursor-pointer transition-all mb-3 ${
                  isDragging
                    ? 'border-teal-400 bg-teal-500/10'
                    : 'border-slate-700 hover:border-teal-500/50 hover:bg-slate-800/50'
                }`}
              >
                <Upload size={20} className="mx-auto text-slate-500 mb-1" />
                <p className="text-xs text-slate-400">
                  Click or drag images
                </p>
                <p className="text-[10px] text-slate-600 mt-0.5">
                  Up to {MAX_IMAGES - uploadedImages.length} more
                </p>
              </div>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={handleFileChange}
            />

            {/* Uploaded image thumbnails */}
            {uploadedImages.length > 0 && (
              <div className="space-y-2">
                {uploadedImages.map((img, i) => (
                  <div key={i} className="flex items-center gap-2 p-2 rounded-lg bg-slate-800/60 border border-slate-700/50 group">
                    <div className="relative flex-shrink-0">
                      <img src={img.preview} alt="" className="w-10 h-10 rounded object-cover" />
                      <span className="absolute -top-1 -left-1 text-[9px] font-black bg-teal-500 text-black rounded px-1 leading-tight">
                        F{i + 1}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[11px] font-bold text-white truncate">Figure {i + 1}</p>
                      <p className="text-[10px] text-slate-500 truncate">{img.name}</p>
                    </div>
                    <div className="flex flex-col gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                      {i > 0 && (
                        <button
                          onClick={() => moveImage(i, i - 1)}
                          className="text-[9px] text-slate-400 hover:text-white px-1"
                          title="Move up"
                        >▲</button>
                      )}
                      {i < uploadedImages.length - 1 && (
                        <button
                          onClick={() => moveImage(i, i + 1)}
                          className="text-[9px] text-slate-400 hover:text-white px-1"
                          title="Move down"
                        >▼</button>
                      )}
                    </div>
                    <button
                      onClick={() => removeImage(i)}
                      className="p-1 rounded text-slate-600 hover:text-red-400 hover:bg-red-500/10 transition-all flex-shrink-0"
                    >
                      <X size={12} />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {uploadedImages.length === 0 && (
              <p className="text-[10px] text-slate-600 text-center">
                No images added — model will generate from prompt only
              </p>
            )}
          </div>

          {/* Prompt */}
          <div className="p-4 rounded-xl border border-slate-800 bg-slate-900/60">
            <label className="block text-xs font-bold text-teal-400 uppercase tracking-wider mb-2">
              Prompt
            </label>
            <textarea
              value={prompt}
              onChange={e => setPrompt(e.target.value)}
              placeholder="Describe the edit... Use 'Figure 1', 'Figure 2', etc. to reference uploaded images."
              rows={6}
              className="w-full p-3 rounded-lg bg-slate-950 border border-slate-700 focus:border-teal-500 text-white text-sm placeholder:text-slate-600 focus:outline-none resize-none"
            />
            {uploadedImages.length > 0 && (
              <div className="mt-2 p-2 rounded-lg bg-teal-500/5 border border-teal-500/20">
                <p className="text-[10px] text-teal-400 font-bold mb-1">Tip — Figure References</p>
                <div className="flex flex-wrap gap-1">
                  {uploadedImages.map((_, i) => (
                    <button
                      key={i}
                      onClick={() => setPrompt(p => p + (p.endsWith(' ') || p === '' ? '' : ' ') + `Figure ${i + 1}`)}
                      className="text-[10px] bg-teal-500/10 hover:bg-teal-500/20 text-teal-300 border border-teal-500/20 rounded px-2 py-0.5 transition-all"
                    >
                      + Figure {i + 1}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Image Size */}
          <div className="p-4 rounded-xl border border-slate-800 bg-slate-900/60">
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
              Image Size
            </label>
            <div className="grid grid-cols-3 gap-1.5 mb-2">
              {IMAGE_SIZE_PRESETS.map(preset => (
                <button
                  key={preset.value}
                  onClick={() => setImageSize(preset.value)}
                  className={`py-2 px-1 rounded-lg text-center transition-all ${
                    imageSize === preset.value
                      ? 'bg-teal-500 text-black'
                      : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-white'
                  }`}
                >
                  <p className="text-[11px] font-bold leading-tight">{preset.label}</p>
                  <p className={`text-[9px] leading-tight ${imageSize === preset.value ? 'text-black/70' : 'text-slate-600'}`}>
                    {preset.desc}
                  </p>
                </button>
              ))}
            </div>
            {imageSize === 'custom' && (
              <div className="mt-2 space-y-2">
                <p className="text-[10px] text-slate-500">Total pixels: 2560×1440 → 3072×3072 range</p>
                <div className="flex gap-2">
                  <div className="flex-1">
                    <label className="text-[10px] text-slate-500 block mb-1">Width</label>
                    <input
                      type="number"
                      value={customWidth}
                      onChange={e => setCustomWidth(e.target.value)}
                      placeholder="1280"
                      className="w-full px-2 py-1.5 rounded-lg bg-slate-950 border border-slate-700 focus:border-teal-500 text-white text-xs focus:outline-none"
                    />
                  </div>
                  <div className="flex-1">
                    <label className="text-[10px] text-slate-500 block mb-1">Height</label>
                    <input
                      type="number"
                      value={customHeight}
                      onChange={e => setCustomHeight(e.target.value)}
                      placeholder="720"
                      className="w-full px-2 py-1.5 rounded-lg bg-slate-950 border border-slate-700 focus:border-teal-500 text-white text-xs focus:outline-none"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* num_images / max_images */}
          <div className="p-4 rounded-xl border border-slate-800 bg-slate-900/60 space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
                Generations <span className="text-slate-600 normal-case font-normal">(num_images)</span>
              </label>
              <div className="grid grid-cols-4 gap-1.5">
                {[1, 2, 3, 4].map(n => (
                  <button
                    key={n}
                    onClick={() => setNumImages(n)}
                    className={`py-2 rounded-lg text-sm font-black transition-all ${
                      numImages === n
                        ? 'bg-teal-500 text-black'
                        : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-white'
                    }`}
                  >
                    {n}
                  </button>
                ))}
              </div>
              <p className="text-[10px] text-slate-600 mt-1.5">Number of separate model generations to run</p>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
                Max per generation <span className="text-slate-600 normal-case font-normal">(max_images)</span>
              </label>
              <div className="grid grid-cols-4 gap-1.5">
                {[1, 2, 3, 4].map(n => (
                  <button
                    key={n}
                    onClick={() => setMaxImages(n)}
                    className={`py-2 rounded-lg text-sm font-black transition-all ${
                      maxImages === n
                        ? 'bg-cyan-500 text-black'
                        : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-white'
                    }`}
                  >
                    {n}
                  </button>
                ))}
              </div>
              <p className="text-[10px] text-slate-600 mt-1.5">
                Model may return up to this many per generation.
                Total: {numImages}–{numImages * maxImages} image{numImages * maxImages !== 1 ? 's' : ''}
              </p>
            </div>
          </div>

          {/* Options */}
          <div className="p-4 rounded-xl border border-slate-800 bg-slate-900/60">
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">
              Options
            </label>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-white">Safety Checker</p>
                <p className="text-[10px] text-slate-500">Enable content safety filtering</p>
              </div>
              <button
                onClick={() => setEnableSafetyChecker(v => !v)}
                className={`relative w-11 h-6 rounded-full transition-all flex-shrink-0 ${
                  enableSafetyChecker ? 'bg-teal-500' : 'bg-slate-700'
                }`}
              >
                <span className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${
                  enableSafetyChecker ? 'left-6' : 'left-1'
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
                : 'bg-gradient-to-r from-teal-500 to-cyan-500 text-black hover:from-teal-400 hover:to-cyan-400 shadow-lg shadow-teal-500/20'
            }`}
          >
            {isGenerating ? (
              <span className="flex items-center justify-center gap-2">
                <RefreshCw size={16} className="animate-spin" />
                GENERATING...
              </span>
            ) : (
              <span className="flex items-center justify-center gap-2">
                <Sparkles size={16} />
                GENERATE
              </span>
            )}
          </button>

          {/* Params summary */}
          <div className="p-3 rounded-xl border border-slate-800 bg-slate-950/60 font-mono text-[10px] text-slate-500 space-y-1">
            <p className="text-slate-400 font-bold mb-1">Current Parameters</p>
            <p>image_size: <span className="text-teal-400">{imageSize === 'custom' ? `${customWidth}×${customHeight}` : imageSize}</span></p>
            <p>num_images: <span className="text-cyan-400">{numImages}</span></p>
            <p>max_images: <span className="text-cyan-400">{maxImages}</span></p>
            <p>enable_safety_checker: <span className={enableSafetyChecker ? 'text-green-400' : 'text-red-400'}>{String(enableSafetyChecker)}</span></p>
            <p>image_urls: <span className="text-slate-400">{uploadedImages.length} uploaded</span></p>
          </div>
        </div>

        {/* ── Right Panel: Output ── */}
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
            <div className="flex flex-col items-center justify-center h-96 rounded-xl border border-teal-500/20 bg-slate-900/40">
              <Sparkles size={48} className="text-teal-400 animate-pulse mb-4" />
              <p className="text-teal-400 font-bold">Generating with SeedDream 5.0 Lite...</p>
              <p className="text-slate-500 text-xs mt-2">
                {imageSize === 'custom' ? `${customWidth}×${customHeight}` : imageSize}
                {uploadedImages.length > 0 ? ` · ${uploadedImages.length} reference image${uploadedImages.length !== 1 ? 's' : ''}` : ''}
              </p>
              <div className="flex gap-1 mt-4">
                <div className="w-2 h-2 bg-teal-500 rounded-full animate-pulse" />
                <div className="w-2 h-2 bg-teal-500 rounded-full animate-pulse" style={{ animationDelay: '0.2s' }} />
                <div className="w-2 h-2 bg-teal-500 rounded-full animate-pulse" style={{ animationDelay: '0.4s' }} />
              </div>
            </div>
          )}

          {/* Results */}
          {result && !isGenerating && (
            <div className="space-y-4">
              {/* Meta bar */}
              <div className="flex items-center gap-3 flex-wrap">
                <span className="text-xs text-green-400 font-bold bg-green-500/10 border border-green-500/30 px-2 py-1 rounded-full">
                  ✓ {result.images.length} image{result.images.length !== 1 ? 's' : ''} generated
                </span>
                <span className="text-xs text-slate-500 font-mono">
                  {(result.elapsed / 1000).toFixed(1)}s
                </span>
                {result.seed !== undefined && (
                  <span className="text-[10px] text-purple-400 font-mono bg-purple-500/10 border border-purple-500/20 px-2 py-0.5 rounded-full">
                    seed: {result.seed}
                  </span>
                )}
                <span className="text-[10px] text-slate-600 font-mono">{result.requestId}</span>
              </div>

              {/* Thumbnail grid (multi-image) */}
              {result.images.length > 1 && (
                <div className={`grid gap-3 ${result.images.length === 2 ? 'grid-cols-2' : result.images.length === 3 ? 'grid-cols-3' : 'grid-cols-2'}`}>
                  {result.images.map((img, i) => (
                    <div
                      key={i}
                      onClick={() => setSelectedImage(img)}
                      className={`relative rounded-xl overflow-hidden cursor-pointer border-2 transition-all ${
                        selectedImage?.url === img.url
                          ? 'border-teal-500 shadow-lg shadow-teal-500/20'
                          : 'border-slate-700 hover:border-teal-500/50'
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
                        ? `${selectedImage.width} × ${selectedImage.height}`
                        : imageSize}
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
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-teal-500/20 hover:bg-teal-500/30 text-teal-400 text-xs transition-all"
                      >
                        <ExternalLink size={12} />
                        Open
                      </a>
                      <a
                        href={selectedImage.url}
                        download
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-400 text-xs transition-all"
                      >
                        ↓ Download
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
              <ImageIcon size={48} className="text-slate-700 mb-4" />
              <p className="text-slate-500 font-medium">Upload images and write a prompt to begin</p>
              <p className="text-slate-600 text-xs mt-1">fal-ai/bytedance/seedream/v5/lite/edit</p>
              <div className="mt-4 p-3 rounded-lg border border-slate-800 bg-slate-900/40 max-w-sm text-center">
                <p className="text-[10px] text-slate-500 leading-relaxed">
                  Upload up to 10 reference images (labeled Figure 1–10) and describe how to edit them using natural language.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
