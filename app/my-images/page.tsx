"use client"

import { useState, useEffect } from "react"
import { ChevronLeft, ChevronRight, Download, ExternalLink, Copy, Sparkles, AlertTriangle, Trash2, X, CheckSquare, Square, Image as ImageIcon, LayoutDashboard } from "lucide-react"
import { useRouter } from "next/navigation"
import Link from "next/link"

interface GeneratedImage {
  id: number
  prompt: string
  imageUrl: string
  model: string
  referenceImageUrls: string[]
  createdAt: string
  expiresAt: string
  videoMetadata?: {
    isVideo?: boolean
    thumbnailUrl?: string
    duration?: string
    resolution?: string
  } | null
}

interface PaginationInfo {
  page: number
  limit: number
  total: number
  totalPages: number
}

export default function MyImagesGalleryPage() {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(true)
  const [images, setImages] = useState<GeneratedImage[]>([])
  const [selectedImage, setSelectedImage] = useState<GeneratedImage | null>(null)
  const [user, setUser] = useState<any>(null)
  const [isMaintenanceMode, setIsMaintenanceMode] = useState(false)
  const [pagination, setPagination] = useState<PaginationInfo>({ page: 1, limit: 8, total: 0, totalPages: 0 })
  const [typeFilter, setTypeFilter] = useState<'all' | 'image' | 'video'>('all')

  // Multi-select & delete state
  const [isSelectMode, setIsSelectMode] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set())
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  useEffect(() => {
    checkAuth()
    fetchMaintenanceStatus()
    fetchImages(1, typeFilter)
  }, [])

  useEffect(() => {
    fetchImages(1, typeFilter)
  }, [typeFilter])

  const checkAuth = async () => {
    try {
      const res = await fetch('/api/auth/session')
      const data = await res.json()
      if (!data.authenticated) { router.push('/login'); return }
      setUser(data.user)
    } catch {
      router.push('/login')
    }
  }

  const fetchMaintenanceStatus = async () => {
    try {
      const res = await fetch('/api/admin/config')
      if (res.ok) {
        const data = await res.json()
        setIsMaintenanceMode(!!data.isMaintenanceMode)
      }
    } catch {}
  }

  const fetchImages = async (page: number, type: 'all' | 'image' | 'video' = typeFilter) => {
    setIsLoading(true)
    try {
      const typeParam = type !== 'all' ? `&type=${type}` : ''
      const res = await fetch(`/api/my-images?page=${page}&limit=8${typeParam}`)
      if (res.ok) {
        const data = await res.json()
        setImages(data.images)
        setPagination(data.pagination)
      }
    } catch {}
    finally { setIsLoading(false) }
  }

  const handlePageChange = (newPage: number) => {
    fetchImages(newPage, typeFilter)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const exitSelectMode = () => {
    setIsSelectMode(false)
    setSelectedIds(new Set())
  }

  const toggleSelect = (id: number) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const selectAll = () => setSelectedIds(new Set(images.map(img => img.id)))

  const handleDeleteConfirmed = async () => {
    if (selectedIds.size === 0) return
    setIsDeleting(true)
    try {
      const res = await fetch('/api/my-images', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: Array.from(selectedIds) }),
      })
      if (res.ok) {
        setImages(prev => prev.filter(img => !selectedIds.has(img.id)))
        setPagination(prev => ({ ...prev, total: prev.total - selectedIds.size }))
        exitSelectMode()
      }
    } catch {}
    finally {
      setIsDeleting(false)
      setShowDeleteConfirm(false)
    }
  }

  const formatDate = (dateString: string) => {
    const d = new Date(dateString)
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  }

  const getModelDisplayName = (model: string) => {
    if (model === 'nano-banana') return 'NanaBanana'
    if (model === 'nano-banana-pro') return 'NanaBanana Pro'
    if (model === 'seedream-4.5') return 'SeeDream 4.5'
    if (model === 'wan-2.5') return 'WAN 2.5'
    if (model === 'kling-v3') return 'Kling 3.0'
    if (model === 'kling-o3') return 'Kling O3'
    if (model === 'seedance-1.5') return 'SeeDance 1.5'
    if (model.includes('gemini') && model.includes('pro')) return 'Gemini Pro'
    if (model.includes('gemini') && model.includes('flash')) return 'Gemini Flash'
    return model
  }

  const downloadImage = async (image: GeneratedImage) => {
    try {
      const isVideo = !!image.videoMetadata?.isVideo
      const src = isVideo ? image.imageUrl : `/api/images/${image.id}?download=1`
      const response = await fetch(src)
      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${image.prompt.substring(0, 50)}.${isVideo ? 'mp4' : 'png'}`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
    } catch {}
  }

  const copyPrompt = async (prompt: string) => {
    try {
      await navigator.clipboard.writeText(prompt)
    } catch {
      try {
        const ta = document.createElement('textarea')
        ta.value = prompt
        ta.style.cssText = 'position:fixed;left:-999999px'
        document.body.appendChild(ta)
        ta.focus(); ta.select()
        document.execCommand('copy')
        document.body.removeChild(ta)
      } catch {}
    }
  }

  const isAdmin = user?.email === "dirtysecretai@gmail.com"

  if (isMaintenanceMode && !isAdmin) {
    return (
      <div className="min-h-screen bg-[#050810] flex items-center justify-center p-6">
        <div className="text-center p-12 rounded-2xl border border-yellow-500/30 bg-yellow-500/5 max-w-md">
          <AlertTriangle className="mx-auto text-yellow-500 mb-4 animate-pulse" size={48} />
          <h1 className="text-xl font-black text-yellow-400 mb-2">MAINTENANCE MODE</h1>
          <p className="text-slate-400 text-sm">The gallery is temporarily offline. We'll be back soon!</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#050810] text-white">
      {/* Subtle grid */}
      <div className="fixed inset-0 bg-[linear-gradient(rgba(255,255,255,0.015)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.015)_1px,transparent_1px)] bg-[size:40px_40px] pointer-events-none" />
      {/* Ambient glows */}
      <div className="fixed top-0 left-1/4 w-[500px] h-[300px] bg-fuchsia-500/5 rounded-full blur-3xl pointer-events-none" />
      <div className="fixed bottom-0 right-1/4 w-[400px] h-[300px] bg-cyan-500/5 rounded-full blur-3xl pointer-events-none" />

      <div className="relative z-10 max-w-6xl mx-auto px-4 py-6 sm:py-10">

        {/* Header — stacked on mobile, side-by-side on desktop */}
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-8">
          <div>
            <p className="text-[11px] font-mono text-slate-600 uppercase tracking-widest mb-1">AI Design Studio</p>
            <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">MY GENERATIONS</h1>
            <p className="text-slate-500 text-sm mt-0.5">
              {pagination.total > 0 ? `${pagination.total.toLocaleString()} total` : 'Your generated images & videos'}
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* Type filter */}
            <div className="flex items-center gap-0.5 p-1 rounded-lg border border-white/6 bg-black/30">
              {(['all', 'image', 'video'] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setTypeFilter(t)}
                  className={`px-3 py-1 rounded-md text-xs font-semibold transition-all ${
                    typeFilter === t
                      ? 'bg-white/10 text-white'
                      : 'text-slate-500 hover:text-slate-300'
                  }`}
                >
                  {t === 'all' ? 'All' : t === 'image' ? 'Images' : 'Videos'}
                </button>
              ))}
            </div>

            {/* Select / Delete controls */}
            {images.length > 0 && (
              isSelectMode ? (
                <div className="flex items-center gap-1.5 flex-wrap">
                  <button
                    onClick={selectAll}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-white/8 bg-white/3 hover:bg-white/6 text-slate-300 text-xs transition-all"
                  >
                    <CheckSquare size={12} />
                    All
                  </button>
                  {selectedIds.size > 0 && (
                    <button
                      onClick={() => setShowDeleteConfirm(true)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-red-500/30 bg-red-500/10 hover:bg-red-500/20 text-red-400 text-xs font-semibold transition-all"
                    >
                      <Trash2 size={12} />
                      Delete ({selectedIds.size})
                    </button>
                  )}
                  <button
                    onClick={exitSelectMode}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-white/6 bg-white/2 hover:bg-white/5 text-slate-400 text-xs transition-all"
                  >
                    <X size={12} />
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setIsSelectMode(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-white/6 bg-white/2 hover:bg-white/5 text-slate-400 hover:text-white text-xs transition-all"
                >
                  <Square size={12} />
                  Select
                </button>
              )
            )}

            {/* Dashboard link */}
            <Link href="/dashboard">
              <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-white/6 bg-white/2 hover:border-white/15 hover:bg-white/5 text-xs text-slate-400 hover:text-white transition-all">
                <LayoutDashboard size={12} />
                Dashboard
              </button>
            </Link>
          </div>
        </div>

        {/* Grid */}
        {isLoading ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="rounded-2xl border border-white/4 bg-white/2 overflow-hidden animate-pulse">
                <div className="aspect-square bg-white/5" />
                <div className="p-3 space-y-2">
                  <div className="h-2.5 bg-white/5 rounded w-3/4" />
                  <div className="h-2.5 bg-white/5 rounded w-1/2" />
                </div>
              </div>
            ))}
          </div>
        ) : images.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 gap-4">
            <div className="w-16 h-16 rounded-2xl border border-white/6 bg-white/2 flex items-center justify-center">
              <ImageIcon size={28} className="text-slate-600" />
            </div>
            <p className="text-slate-500 text-sm">No generations yet</p>
            <Link href="/">
              <button className="flex items-center gap-2 px-4 py-2 rounded-lg bg-cyan-500/15 border border-cyan-500/30 text-cyan-300 text-xs font-semibold hover:bg-cyan-500/25 transition-all">
                <Sparkles size={12} />
                Start Generating
              </button>
            </Link>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              {images.map((image) => {
                const isSelected = selectedIds.has(image.id)
                return (
                  <div
                    key={image.id}
                    onClick={() => isSelectMode ? toggleSelect(image.id) : setSelectedImage(image)}
                    className={`group cursor-pointer rounded-2xl border overflow-hidden transition-all duration-200 ${
                      isSelectMode && isSelected
                        ? 'border-cyan-400/60 ring-2 ring-cyan-400/20 bg-white/3'
                        : isSelectMode
                        ? 'border-white/6 bg-white/2 hover:border-white/15'
                        : 'border-white/6 bg-white/2 hover:border-fuchsia-500/30 hover:shadow-lg hover:shadow-fuchsia-500/5'
                    }`}
                  >
                    {/* Thumbnail */}
                    <div className="aspect-square bg-black/40 relative overflow-hidden">
                      {image.videoMetadata?.isVideo ? (
                        <>
                          {(() => {
                            const thumb = image.videoMetadata?.thumbnailUrl
                            const videoUrl = image.imageUrl
                            // If no separate static thumbnail, use a video element to show the first frame
                            const needsVideoThumb = !thumb || thumb === videoUrl || /\.(mp4|webm|mov)(\?|$)/i.test(thumb)
                            return needsVideoThumb ? (
                              <video
                                src={videoUrl}
                                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                                muted playsInline preload="metadata"
                              />
                            ) : (
                              <img
                                src={thumb}
                                alt={image.prompt}
                                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                              />
                            )
                          })()}
                          <div className="absolute bottom-2 left-2 flex items-center gap-1 bg-black/70 backdrop-blur-sm rounded-md px-1.5 py-0.5">
                            <svg className="w-2.5 h-2.5 text-orange-400" fill="currentColor" viewBox="0 0 24 24">
                              <polygon points="5 3 19 12 5 21 5 3" />
                            </svg>
                            <span className="text-orange-400 text-[9px] font-mono font-bold">VIDEO</span>
                          </div>
                        </>
                      ) : (
                        <img
                          src={`/api/images/${image.id}?thumb=1`}
                          alt={image.prompt}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                      )}

                      {/* Model badge */}
                      <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <span className="px-1.5 py-0.5 rounded-md bg-black/80 backdrop-blur-sm text-[9px] text-cyan-400 font-mono">
                          {getModelDisplayName(image.model)}
                        </span>
                      </div>

                      {/* Select checkbox */}
                      {isSelectMode && (
                        <div className="absolute top-2 left-2">
                          {isSelected ? (
                            <div className="w-5 h-5 rounded-full bg-cyan-500 flex items-center justify-center shadow-lg">
                              <svg className="w-3 h-3 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                              </svg>
                            </div>
                          ) : (
                            <div className="w-5 h-5 rounded-full border-2 border-white/50 bg-black/40" />
                          )}
                        </div>
                      )}
                    </div>

                    {/* Info */}
                    <div className="p-3">
                      <p className="text-[11px] text-slate-400 line-clamp-2 leading-relaxed mb-1.5">{image.prompt}</p>
                      <p className="text-[10px] text-slate-600 font-mono">{formatDate(image.createdAt)}</p>
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Pagination */}
            {pagination.totalPages > 1 && (
              <div className="flex items-center justify-center gap-2 mt-8">
                <button
                  onClick={() => handlePageChange(pagination.page - 1)}
                  disabled={pagination.page <= 1 || isLoading}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-white/6 bg-white/2 hover:bg-white/5 text-slate-400 hover:text-white text-xs disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                >
                  <ChevronLeft size={13} />
                  Prev
                </button>

                <div className="flex items-center gap-1">
                  {pagination.page > 2 && (
                    <>
                      <button onClick={() => handlePageChange(1)} className="w-8 h-8 rounded-lg border border-white/6 bg-white/2 hover:bg-white/5 text-slate-400 text-xs transition-all">1</button>
                      {pagination.page > 3 && <span className="text-slate-600 text-xs px-1">…</span>}
                    </>
                  )}
                  {pagination.page > 1 && (
                    <button onClick={() => handlePageChange(pagination.page - 1)} className="w-8 h-8 rounded-lg border border-white/6 bg-white/2 hover:bg-white/5 text-slate-400 text-xs transition-all">{pagination.page - 1}</button>
                  )}
                  <button className="w-8 h-8 rounded-lg bg-cyan-500/20 border border-cyan-500/40 text-cyan-400 font-bold text-xs">{pagination.page}</button>
                  {pagination.page < pagination.totalPages && (
                    <button onClick={() => handlePageChange(pagination.page + 1)} className="w-8 h-8 rounded-lg border border-white/6 bg-white/2 hover:bg-white/5 text-slate-400 text-xs transition-all">{pagination.page + 1}</button>
                  )}
                  {pagination.page < pagination.totalPages - 1 && (
                    <>
                      {pagination.page < pagination.totalPages - 2 && <span className="text-slate-600 text-xs px-1">…</span>}
                      <button onClick={() => handlePageChange(pagination.totalPages)} className="w-8 h-8 rounded-lg border border-white/6 bg-white/2 hover:bg-white/5 text-slate-400 text-xs transition-all">{pagination.totalPages}</button>
                    </>
                  )}
                </div>

                <button
                  onClick={() => handlePageChange(pagination.page + 1)}
                  disabled={pagination.page >= pagination.totalPages || isLoading}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-white/6 bg-white/2 hover:bg-white/5 text-slate-400 hover:text-white text-xs disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                >
                  Next
                  <ChevronRight size={13} />
                </button>

                <span className="hidden sm:inline text-[10px] text-slate-600 font-mono ml-2">{pagination.total} total</span>
              </div>
            )}
          </>
        )}
      </div>

      {/* ── Image / Video Preview Modal ─────────────────────────────────────── */}
      {selectedImage && (
        <div className="fixed inset-0 bg-black/95 z-50 flex flex-col" onClick={() => setSelectedImage(null)}>

          {/* Close */}
          <button
            onClick={(e) => { e.stopPropagation(); setSelectedImage(null) }}
            className="absolute top-3 left-3 z-20 flex items-center gap-1.5 px-3 py-2 rounded-lg border border-white/10 bg-black/60 backdrop-blur-sm text-slate-300 hover:text-white text-xs font-medium transition-all"
          >
            <X size={13} />
            Close
          </button>

          {/* Full image / video */}
          <div className="flex-1 flex items-center justify-center p-4 pt-14 min-h-0" onClick={(e) => e.stopPropagation()}>
            {selectedImage.videoMetadata?.isVideo ? (
              <video
                src={selectedImage.imageUrl}
                controls autoPlay loop
                className="max-w-full max-h-full object-contain rounded-xl"
              />
            ) : (
              <img
                src={`/api/images/${selectedImage.id}`}
                alt={selectedImage.prompt}
                className="max-w-full max-h-full object-contain rounded-xl"
              />
            )}
          </div>

          {/* Bottom info panel */}
          <div className="border-t border-white/6 bg-black/80 backdrop-blur-sm px-3 py-3 sm:p-4" onClick={(e) => e.stopPropagation()}>
            <div className="max-w-4xl mx-auto">
              {/* Prompt + meta — compact on mobile */}
              <div className="flex items-start gap-2 mb-3">
                <Sparkles className="text-cyan-400 flex-shrink-0 mt-0.5" size={13} />
                <div className="flex-1 min-w-0">
                  <p className="text-white text-xs sm:text-sm line-clamp-2">{selectedImage.prompt}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="px-2 py-0.5 rounded-md bg-cyan-500/15 border border-cyan-500/20 text-cyan-400 text-[10px] font-mono">
                      {getModelDisplayName(selectedImage.model)}
                    </span>
                    <span className="text-[10px] text-slate-500">{formatDate(selectedImage.createdAt)}</span>
                  </div>
                </div>
              </div>

              {/* Action buttons — 2 cols on mobile, 4 on desktop */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <button
                  onClick={() => downloadImage(selectedImage)}
                  className="flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl bg-cyan-500/20 border border-cyan-500/30 text-cyan-300 text-xs font-semibold hover:bg-cyan-500/30 transition-all"
                >
                  <Download size={13} />
                  Download
                </button>

                <button
                  onClick={() => copyPrompt(selectedImage.prompt)}
                  className="flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl bg-purple-500/20 border border-purple-500/30 text-purple-300 text-xs font-semibold hover:bg-purple-500/30 transition-all"
                >
                  <Copy size={13} />
                  Copy Prompt
                </button>

                <button
                  onClick={() => {
                    localStorage.setItem('rescan_prompt', selectedImage.prompt)
                    if (selectedImage.referenceImageUrls?.length > 0) {
                      localStorage.setItem('rescan_reference_images', JSON.stringify(selectedImage.referenceImageUrls))
                    } else {
                      localStorage.removeItem('rescan_reference_images')
                    }
                    router.push('/')
                  }}
                  className="flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl bg-fuchsia-500/20 border border-fuchsia-500/30 text-fuchsia-300 text-xs font-semibold hover:bg-fuchsia-500/30 transition-all"
                >
                  <Sparkles size={13} />
                  Rescan
                </button>

                <a
                  href={selectedImage.videoMetadata?.isVideo ? selectedImage.imageUrl : `/api/images/${selectedImage.id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl bg-white/5 border border-white/10 text-slate-300 text-xs font-semibold hover:bg-white/10 transition-all"
                >
                  <ExternalLink size={13} />
                  Open
                </a>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Delete Confirmation ─────────────────────────────────────────────── */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-[9998] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div
            className="rounded-2xl border border-white/8 bg-[#0a0f1a] p-6 max-w-sm w-full shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center justify-center flex-shrink-0">
                <Trash2 className="text-red-400" size={18} />
              </div>
              <div>
                <h2 className="text-white font-bold text-base">Delete {selectedIds.size} item{selectedIds.size !== 1 ? 's' : ''}?</h2>
                <p className="text-slate-500 text-xs mt-0.5">This cannot be undone.</p>
              </div>
            </div>

            <p className="text-slate-400 text-sm mb-5 leading-relaxed">
              {selectedIds.size === 1
                ? 'Permanently delete this generation from your gallery?'
                : `Permanently delete these ${selectedIds.size} generations from your gallery?`}
            </p>

            <div className="flex gap-2">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                disabled={isDeleting}
                className="flex-1 py-2.5 rounded-xl border border-white/8 bg-white/3 hover:bg-white/6 text-slate-300 font-semibold text-xs transition-all disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteConfirmed}
                disabled={isDeleting}
                className="flex-1 py-2.5 rounded-xl bg-red-600/80 hover:bg-red-600 border border-red-500/30 disabled:opacity-50 text-white font-bold text-xs transition-all"
              >
                {isDeleting ? 'Deleting...' : `Delete ${selectedIds.size === 1 ? 'Item' : `${selectedIds.size} Items`}`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
