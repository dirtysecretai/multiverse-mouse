"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { ChevronLeft, ChevronRight, Download, ExternalLink, Copy, Sparkles, AlertTriangle } from "lucide-react"
import { useRouter } from "next/navigation"

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

// Pagination Controls Component
function PaginationControls({
  pagination,
  onPageChange,
  isLoading
}: {
  pagination: PaginationInfo
  onPageChange: (page: number) => void
  isLoading: boolean
}) {
  const { page, totalPages, total } = pagination

  if (totalPages <= 1) return null

  return (
    <div className="flex items-center justify-center gap-4 py-4">
      <Button
        onClick={() => onPageChange(page - 1)}
        disabled={page <= 1 || isLoading}
        className="bg-slate-800 hover:bg-slate-700 disabled:opacity-50"
      >
        <ChevronLeft size={16} className="mr-1" />
        Previous
      </Button>

      <div className="flex items-center gap-2">
        {/* First page */}
        {page > 2 && (
          <>
            <button
              onClick={() => onPageChange(1)}
              className="w-8 h-8 rounded bg-slate-800 hover:bg-slate-700 text-sm"
            >
              1
            </button>
            {page > 3 && <span className="text-slate-500">...</span>}
          </>
        )}

        {/* Previous page */}
        {page > 1 && (
          <button
            onClick={() => onPageChange(page - 1)}
            className="w-8 h-8 rounded bg-slate-800 hover:bg-slate-700 text-sm"
          >
            {page - 1}
          </button>
        )}

        {/* Current page */}
        <button className="w-8 h-8 rounded bg-cyan-500 text-black font-bold text-sm">
          {page}
        </button>

        {/* Next page */}
        {page < totalPages && (
          <button
            onClick={() => onPageChange(page + 1)}
            className="w-8 h-8 rounded bg-slate-800 hover:bg-slate-700 text-sm"
          >
            {page + 1}
          </button>
        )}

        {/* Last page */}
        {page < totalPages - 1 && (
          <>
            {page < totalPages - 2 && <span className="text-slate-500">...</span>}
            <button
              onClick={() => onPageChange(totalPages)}
              className="w-8 h-8 rounded bg-slate-800 hover:bg-slate-700 text-sm"
            >
              {totalPages}
            </button>
          </>
        )}
      </div>

      <Button
        onClick={() => onPageChange(page + 1)}
        disabled={page >= totalPages || isLoading}
        className="bg-slate-800 hover:bg-slate-700 disabled:opacity-50"
      >
        Next
        <ChevronRight size={16} className="ml-1" />
      </Button>

      <span className="text-xs text-slate-500 ml-2">
        {total} total images
      </span>
    </div>
  )
}

export default function MyImagesGalleryPage() {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(true)
  const [images, setImages] = useState<GeneratedImage[]>([])
  const [selectedImage, setSelectedImage] = useState<GeneratedImage | null>(null)
  const [user, setUser] = useState<any>(null)
  const [isMaintenanceMode, setIsMaintenanceMode] = useState(false)
  const [pagination, setPagination] = useState<PaginationInfo>({
    page: 1,
    limit: 50,
    total: 0,
    totalPages: 0
  })

  useEffect(() => {
    checkAuth()
    fetchMaintenanceStatus()
    fetchImages(1)
  }, [])

  const checkAuth = async () => {
    try {
      const res = await fetch('/api/auth/session')
      const data = await res.json()

      if (!data.authenticated) {
        router.push('/login')
        return
      }

      setUser(data.user)
    } catch (error) {
      console.error('Auth check failed:', error)
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
    } catch (err) {
      console.error("Config fetch failed:", err)
    }
  }

  const fetchImages = async (page: number) => {
    setIsLoading(true)
    try {
      const res = await fetch(`/api/my-images?page=${page}&limit=50`)
      if (res.ok) {
        const data = await res.json()
        setImages(data.images)
        setPagination(data.pagination)
      }
    } catch (error) {
      console.error("Error fetching images:", error)
    } finally {
      setIsLoading(false)
    }
  }

  const handlePageChange = (newPage: number) => {
    fetchImages(newPage)
    // Scroll to top when changing pages
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString()
  }

  const getModelDisplayName = (model: string) => {
    if (model === 'nano-banana') return 'NanoBanana Cluster'
    if (model === 'nano-banana-pro') return 'NanoBanana Pro'
    if (model === 'seedream-4.5') return 'SeeDream 4.5'
    if (model === 'wan-2.5') return 'WAN 2.5 Video'
    if (model === 'kling-v3') return 'Kling 3.0 Video'
    if (model === 'kling-o3') return 'Kling O3 Video'
    if (model.includes('gemini') && model.includes('pro')) return 'Gemini Pro'
    if (model.includes('gemini') && model.includes('flash')) return 'Gemini Flash'
    return model
  }

  const downloadImage = async (imageUrl: string, prompt: string) => {
    try {
      const response = await fetch(imageUrl)
      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${prompt.substring(0, 50)}.png`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
    } catch (error) {
      console.error('Download failed:', error)
    }
  }

  const copyPrompt = async (prompt: string) => {
    try {
      // Try modern clipboard API first
      await navigator.clipboard.writeText(prompt)
      alert('Prompt copied to clipboard!')
    } catch (err) {
      // Fallback for mobile/older browsers
      try {
        const textArea = document.createElement('textarea')
        textArea.value = prompt
        textArea.style.position = 'fixed'
        textArea.style.left = '-999999px'
        textArea.style.top = '-999999px'
        document.body.appendChild(textArea)
        textArea.focus()
        textArea.select()
        const successful = document.execCommand('copy')
        document.body.removeChild(textArea)

        if (successful) {
          alert('Prompt copied to clipboard!')
        } else {
          alert('Failed to copy. Please copy manually.')
        }
      } catch (fallbackErr) {
        console.error('Copy failed:', fallbackErr)
        alert('Copy failed. Please try again or copy manually.')
      }
    }
  }

  // Check if user is admin
  const isAdmin = user?.email === "dirtysecretai@gmail.com"

  // Show maintenance page to non-admins only
  if (isMaintenanceMode && !isAdmin) {
    return (
      <div className="min-h-screen bg-[#050810] flex items-center justify-center p-6">
        <div className="text-center p-12 rounded-2xl border-2 border-yellow-500/30 bg-yellow-500/5 backdrop-blur-sm max-w-md">
          <AlertTriangle className="mx-auto text-yellow-500 mb-4 animate-pulse" size={64} />
          <h1 className="text-2xl font-black text-yellow-400 mb-3">MAINTENANCE MODE</h1>
          <p className="text-slate-400 text-sm">The image gallery is temporarily offline. We'll be back soon!</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-white p-6">
      {/* Header */}
      <div className="max-w-7xl mx-auto mb-4">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-fuchsia-500 mb-2">
              MY IMAGE GALLERY
            </h1>
            <p className="text-slate-400 text-sm">
              {pagination.total} total images generated
            </p>
          </div>
          <Button
            onClick={() => router.push('/dashboard')}
            className="bg-slate-800 hover:bg-slate-700 text-white"
          >
            Back to Dashboard
          </Button>
        </div>

        {/* Top Pagination */}
        <PaginationControls
          pagination={pagination}
          onPageChange={handlePageChange}
          isLoading={isLoading}
        />
      </div>

      {/* Images Grid */}
      {isLoading ? (
        <div className="text-center text-slate-500 py-12">Loading images...</div>
      ) : images.length === 0 ? (
        <div className="max-w-7xl mx-auto text-center py-12">
          <p className="text-slate-500 mb-4">No images generated yet</p>
          <Button
            onClick={() => router.push('/')}
            className="bg-cyan-500 hover:bg-cyan-400 text-black font-bold"
          >
            Start Generating
          </Button>
        </div>
      ) : (
        <>
          <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {images.map((image) => (
              <div
                key={image.id}
                onClick={() => setSelectedImage(image)}
                className="group cursor-pointer rounded-xl border border-slate-800 bg-slate-900/60 overflow-hidden hover:border-cyan-500/50 transition-all"
              >
                {/* Image or Video */}
                <div className="aspect-square bg-slate-950 relative overflow-hidden">
                  {image.videoMetadata?.isVideo ? (
                    <>
                      <img
                        src={image.videoMetadata.thumbnailUrl || image.imageUrl}
                        alt={image.prompt}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                      <div className="absolute bottom-2 left-2 flex items-center gap-1 bg-black/70 rounded px-1.5 py-0.5">
                        <svg className="w-3 h-3 text-orange-400" fill="currentColor" viewBox="0 0 24 24">
                          <polygon points="5 3 19 12 5 21 5 3" />
                        </svg>
                        <span className="text-orange-400 text-[10px] font-mono">VIDEO</span>
                      </div>
                    </>
                  ) : (
                    <img
                      src={image.imageUrl}
                      alt={image.prompt}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  )}
                  <div className="absolute top-2 right-2">
                    <span className="px-2 py-1 rounded-lg bg-black/80 text-xs text-cyan-400 font-mono">
                      {getModelDisplayName(image.model)}
                    </span>
                  </div>
                </div>

                {/* Info */}
                <div className="p-3">
                  <p className="text-xs text-slate-400 line-clamp-2 mb-2">{image.prompt}</p>
                  <div className="flex items-center justify-between text-[10px] text-slate-500">
                    <span>{formatDate(image.createdAt)}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Bottom Pagination */}
          <div className="max-w-7xl mx-auto mt-8">
            <PaginationControls
              pagination={pagination}
              onPageChange={handlePageChange}
              isLoading={isLoading}
            />
          </div>
        </>
      )}

      {/* Image Modal - Full Screen */}
      {selectedImage && (
        <div
          className="fixed inset-0 bg-black z-50 flex flex-col"
          onClick={() => setSelectedImage(null)}
        >
          {/* Close Button */}
          <button
            onClick={() => setSelectedImage(null)}
            className="absolute top-4 right-4 text-white/70 hover:text-white transition-colors z-20 p-2 rounded-full bg-black/50 hover:bg-black/80"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>

          {/* Full Image/Video Area */}
          <div
            className="flex-1 flex items-center justify-center p-4 min-h-0"
            onClick={(e) => e.stopPropagation()}
          >
            {selectedImage.videoMetadata?.isVideo ? (
              <video
                src={selectedImage.imageUrl}
                controls
                autoPlay
                loop
                className="max-w-full max-h-full object-contain rounded-lg"
              />
            ) : (
              <img
                src={selectedImage.imageUrl}
                alt={selectedImage.prompt}
                className="max-w-full max-h-full object-contain"
              />
            )}
          </div>

          {/* Bottom Info Panel */}
          <div
            className="bg-slate-900/95 backdrop-blur-sm border-t border-slate-700 p-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="max-w-4xl mx-auto">
              {/* Prompt and Model */}
              <div className="flex items-start gap-3 mb-3">
                <Sparkles className="text-cyan-400 flex-shrink-0 mt-0.5" size={16} />
                <div className="flex-1 min-w-0">
                  <p className="text-white text-sm line-clamp-2">{selectedImage.prompt}</p>
                  <div className="flex items-center gap-3 mt-2 text-xs text-slate-400">
                    <span className="px-2 py-0.5 rounded bg-cyan-500/20 text-cyan-400 font-mono">
                      {getModelDisplayName(selectedImage.model)}
                    </span>
                    <span>{formatDate(selectedImage.createdAt)}</span>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="grid grid-cols-4 gap-2">
                <button
                  onClick={() => downloadImage(selectedImage.imageUrl, selectedImage.prompt)}
                  className="bg-cyan-500 hover:bg-cyan-400 text-black font-bold py-2.5 px-3 rounded-lg flex items-center justify-center gap-2 text-sm"
                >
                  <Download size={16} />
                  <span className="hidden sm:inline">Download</span>
                </button>

                <button
                  onClick={() => copyPrompt(selectedImage.prompt)}
                  className="bg-purple-600 hover:bg-purple-500 text-white font-bold py-2.5 px-3 rounded-lg flex items-center justify-center gap-2 text-sm"
                >
                  <Copy size={16} />
                  <span className="hidden sm:inline">Copy Prompt</span>
                </button>

                <button
                  onClick={() => {
                    localStorage.setItem('rescan_prompt', selectedImage.prompt)
                    if (selectedImage.referenceImageUrls && selectedImage.referenceImageUrls.length > 0) {
                      localStorage.setItem('rescan_reference_images', JSON.stringify(selectedImage.referenceImageUrls))
                    } else {
                      localStorage.removeItem('rescan_reference_images')
                    }
                    router.push('/')
                  }}
                  className="bg-fuchsia-600 hover:bg-fuchsia-500 text-white font-bold py-2.5 px-3 rounded-lg flex items-center justify-center gap-2 text-sm"
                >
                  <Sparkles size={16} />
                  <span className="hidden sm:inline">Rescan</span>
                </button>

                <a
                  href={selectedImage.imageUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="bg-slate-700 hover:bg-slate-600 text-white font-bold py-2.5 px-3 rounded-lg flex items-center justify-center gap-2 text-sm"
                >
                  <ExternalLink size={16} />
                  <span className="hidden sm:inline">Open</span>
                </a>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
