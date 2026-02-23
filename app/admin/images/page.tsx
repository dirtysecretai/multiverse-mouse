"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Image as ImageIcon, User, Calendar, Sparkles, ChevronLeft, ChevronRight, RefreshCw, Download, Images, X } from "lucide-react"
import { useRouter } from "next/navigation"

interface GeneratedImage {
  id: number
  prompt: string
  imageUrl: string
  model: string
  ticketCost: number
  referenceImageUrls: string[]
  createdAt: string
  user: {
    id: number
    email: string
    name: string | null
  }
}

interface PaginationInfo {
  page: number
  limit: number
  total: number
  totalPages: number
}

export default function AdminImagesPage() {
  const router = useRouter()
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [password, setPassword] = useState("")
  const [isLoading, setIsLoading] = useState(true)
  const [images, setImages] = useState<GeneratedImage[]>([])
  const [pagination, setPagination] = useState<PaginationInfo>({
    page: 1,
    limit: 50,
    total: 0,
    totalPages: 0
  })
  const [selectedImage, setSelectedImage] = useState<GeneratedImage | null>(null)
  const [viewingRefImage, setViewingRefImage] = useState<string | null>(null)

  // Check authentication
  useEffect(() => {
    const authStatus = localStorage.getItem("multiverse-admin-auth")
    const savedPassword = sessionStorage.getItem("admin-password")
    
    if (authStatus === "true" && savedPassword) {
      setIsAuthenticated(true)
      fetchImages(1)
    } else {
      setIsLoading(false)
    }
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
        setIsAuthenticated(true)
        localStorage.setItem("multiverse-admin-auth", "true")
        fetchImages(1)
      } else {
        alert("❌ Invalid password")
      }
    } catch (error) {
      console.error("Auth error:", error)
      alert("❌ Authentication failed")
    }
  }

  const fetchImages = async (page: number) => {
    setIsLoading(true)
    try {
      const res = await fetch(`/api/admin/images?page=${page}&limit=50`)
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

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString()
  }

  // Login screen
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <div className="mb-8 text-center">
            <h1 className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-fuchsia-500 mb-2">
              ADMIN IMAGE GALLERY
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
            <Button type="submit" className="w-full bg-gradient-to-r from-cyan-500 to-fuchsia-500 hover:from-cyan-400 hover:to-fuchsia-400 text-black font-bold">
              ACCESS GALLERY
            </Button>
          </form>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-white p-6">
      {/* Header */}
      <div className="max-w-7xl mx-auto mb-8">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-fuchsia-500 mb-2">
              IMAGE GALLERY
            </h1>
            <p className="text-slate-400 text-sm">
              {pagination.total} total generations • Page {pagination.page} of {pagination.totalPages}
            </p>
          </div>
          <Button
            onClick={() => router.push('/admin')}
            className="bg-slate-800 hover:bg-slate-700 text-white"
          >
            Back to Admin
          </Button>
        </div>

        {/* Top Pagination Controls */}
        {pagination.totalPages > 1 && (
          <div className="flex items-center justify-center gap-2">
            <Button
              onClick={() => fetchImages(pagination.page - 1)}
              disabled={pagination.page === 1}
              className="bg-slate-800 hover:bg-slate-700 disabled:opacity-50"
            >
              <ChevronLeft size={16} className="mr-1" />
              Previous
            </Button>
            <span className="text-sm text-slate-400 px-4">
              Page {pagination.page} of {pagination.totalPages}
            </span>
            <Button
              onClick={() => fetchImages(pagination.page + 1)}
              disabled={pagination.page >= pagination.totalPages}
              className="bg-slate-800 hover:bg-slate-700 disabled:opacity-50"
            >
              Next
              <ChevronRight size={16} className="ml-1" />
            </Button>
          </div>
        )}
      </div>

      {/* Images Grid */}
      {isLoading ? (
        <div className="text-center text-slate-500">Loading images...</div>
      ) : (
        <>
          <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {images.map((image) => (
              <div
                key={image.id}
                onClick={() => setSelectedImage(image)}
                className="group cursor-pointer rounded-xl border border-slate-800 bg-slate-900/60 overflow-hidden hover:border-cyan-500/50 transition-all"
              >
                {/* Image */}
                <div className="aspect-square bg-slate-950 relative overflow-hidden">
                  <img
                    src={image.imageUrl}
                    alt={image.prompt}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                  <div className="absolute top-2 right-2 flex gap-1">
                    {image.referenceImageUrls && image.referenceImageUrls.length > 0 && (
                      <span className="px-2 py-1 rounded-lg bg-fuchsia-500/90 text-xs text-white font-bold flex items-center gap-1">
                        <Images size={10} />
                        {image.referenceImageUrls.length}
                      </span>
                    )}
                    <span className="px-2 py-1 rounded-lg bg-black/80 text-xs text-cyan-400 font-mono">
                      {image.model === 'nano-banana' ? 'NanoBanana' :
                       image.model === 'nano-banana-pro' ? 'NanoBanana Pro' :
                       image.model === 'seedream-4.5' ? 'SeeDream 4.5' :
                       image.model.includes('flash') ? 'Flash' : 'Pro'}
                    </span>
                  </div>
                </div>

                {/* Info */}
                <div className="p-3">
                  <p className="text-xs text-slate-400 line-clamp-2 mb-2">{image.prompt}</p>
                  <div className="flex items-center gap-2 text-[10px] text-slate-500">
                    <User size={10} />
                    <span className="truncate">{image.user.email}</span>
                  </div>
                  <div className="flex items-center gap-2 text-[10px] text-slate-500 mt-1">
                    <Calendar size={10} />
                    <span>{formatDate(image.createdAt)}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Bottom Pagination Controls */}
          {pagination.totalPages > 1 && (
            <div className="max-w-7xl mx-auto mt-8 flex items-center justify-center gap-2">
              <Button
                onClick={() => {
                  fetchImages(pagination.page - 1)
                  window.scrollTo({ top: 0, behavior: 'smooth' })
                }}
                disabled={pagination.page === 1}
                className="bg-slate-800 hover:bg-slate-700 disabled:opacity-50"
              >
                <ChevronLeft size={16} className="mr-1" />
                Previous
              </Button>
              <span className="text-sm text-slate-400 px-4">
                Page {pagination.page} of {pagination.totalPages}
              </span>
              <Button
                onClick={() => {
                  fetchImages(pagination.page + 1)
                  window.scrollTo({ top: 0, behavior: 'smooth' })
                }}
                disabled={pagination.page >= pagination.totalPages}
                className="bg-slate-800 hover:bg-slate-700 disabled:opacity-50"
              >
                Next
                <ChevronRight size={16} className="ml-1" />
              </Button>
            </div>
          )}
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

          {/* Full Image Area */}
          <div
            className="flex-1 flex items-center justify-center p-4 min-h-0"
            onClick={(e) => e.stopPropagation()}
          >
            <img
              src={selectedImage.imageUrl}
              alt={selectedImage.prompt}
              className="max-w-full max-h-full object-contain"
            />
          </div>

          {/* Bottom Info Panel */}
          <div
            className="bg-slate-900/95 backdrop-blur-sm border-t border-slate-700 p-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="max-w-4xl mx-auto">
              {/* Prompt and Info */}
              <div className="flex items-start gap-3 mb-3">
                <Sparkles className="text-cyan-400 flex-shrink-0 mt-0.5" size={16} />
                <div className="flex-1 min-w-0">
                  <p className="text-white text-sm line-clamp-2">{selectedImage.prompt}</p>
                  <div className="flex flex-wrap items-center gap-3 mt-2 text-xs text-slate-400">
                    <span className="px-2 py-0.5 rounded bg-cyan-500/20 text-cyan-400 font-mono">
                      {selectedImage.model === 'nano-banana' ? 'NanoBanana' :
                       selectedImage.model === 'nano-banana-pro' ? 'NanoBanana Pro' :
                       selectedImage.model === 'seedream-4.5' ? 'SeeDream 4.5' :
                       selectedImage.model}
                    </span>
                    <span className="flex items-center gap-1">
                      <User size={12} />
                      {selectedImage.user.email}
                    </span>
                    <span>{selectedImage.ticketCost} ticket(s)</span>
                    <span>{formatDate(selectedImage.createdAt)}</span>
                  </div>
                </div>
              </div>

              {/* Reference Images */}
              {selectedImage.referenceImageUrls && selectedImage.referenceImageUrls.length > 0 && (
                <div className="mb-3 p-3 rounded-lg bg-slate-800/50 border border-slate-700">
                  <div className="flex items-center gap-2 mb-2">
                    <Images size={14} className="text-fuchsia-400" />
                    <span className="text-xs font-bold text-fuchsia-400">
                      {selectedImage.referenceImageUrls.length} Reference Image{selectedImage.referenceImageUrls.length > 1 ? 's' : ''}
                    </span>
                  </div>
                  <div className="flex gap-2 flex-wrap">
                    {selectedImage.referenceImageUrls.map((refUrl, idx) => (
                      <div key={idx} className="relative group">
                        <img
                          src={refUrl}
                          alt={`Reference ${idx + 1}`}
                          className="h-16 w-16 object-cover rounded-lg border border-slate-600 cursor-pointer hover:border-fuchsia-500 transition-colors"
                          onClick={() => setViewingRefImage(refUrl)}
                        />
                        <a
                          href={refUrl}
                          download={`reference-${idx + 1}.png`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="absolute -top-1 -right-1 bg-cyan-500 hover:bg-cyan-400 text-black rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <Download size={10} />
                        </a>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="grid grid-cols-3 gap-2">
                <a
                  href={selectedImage.imageUrl}
                  download
                  target="_blank"
                  rel="noopener noreferrer"
                  className="bg-cyan-500 hover:bg-cyan-400 text-black font-bold py-2.5 px-3 rounded-lg flex items-center justify-center gap-2 text-sm"
                >
                  <Download size={16} />
                  Download
                </a>

                <button
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(selectedImage.prompt)
                      alert('Prompt copied!')
                    } catch (err) {
                      try {
                        const textArea = document.createElement('textarea')
                        textArea.value = selectedImage.prompt
                        textArea.style.position = 'fixed'
                        textArea.style.left = '-999999px'
                        textArea.style.top = '-999999px'
                        document.body.appendChild(textArea)
                        textArea.focus()
                        textArea.select()
                        const successful = document.execCommand('copy')
                        document.body.removeChild(textArea)
                        if (successful) {
                          alert('Prompt copied!')
                        } else {
                          alert('Failed to copy. Please copy manually.')
                        }
                      } catch (fallbackErr) {
                        console.error('Copy failed:', fallbackErr)
                        alert('Copy failed. Please try again or copy manually.')
                      }
                    }
                  }}
                  className="bg-purple-600 hover:bg-purple-500 text-white font-bold py-2.5 px-3 rounded-lg flex items-center justify-center gap-2 text-sm"
                >
                  <Sparkles size={16} />
                  Copy Prompt
                </button>

                <button
                  onClick={() => {
                    localStorage.setItem('admin_rescan_prompt', selectedImage.prompt)
                    if (selectedImage.referenceImageUrls && selectedImage.referenceImageUrls.length > 0) {
                      localStorage.setItem('admin_rescan_reference_images', JSON.stringify(selectedImage.referenceImageUrls))
                    } else {
                      localStorage.removeItem('admin_rescan_reference_images')
                    }
                    router.push('/admin/scanner')
                  }}
                  className="bg-fuchsia-600 hover:bg-fuchsia-500 text-white font-bold py-2.5 px-3 rounded-lg flex items-center justify-center gap-2 text-sm"
                >
                  <RefreshCw size={16} />
                  Rescan
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Reference Image Full View */}
      {viewingRefImage && (
        <div
          className="fixed inset-0 bg-black/95 z-[60] flex flex-col"
          onClick={() => setViewingRefImage(null)}
        >
          {/* Close Button */}
          <button
            onClick={() => setViewingRefImage(null)}
            className="absolute top-4 right-4 text-white/70 hover:text-white transition-colors z-20 p-2 rounded-full bg-black/50 hover:bg-black/80"
          >
            <X size={24} />
          </button>

          {/* Reference Image */}
          <div className="flex-1 flex items-center justify-center p-4 min-h-0">
            <img
              src={viewingRefImage}
              alt="Reference Image"
              className="max-w-full max-h-full object-contain"
              onClick={(e) => e.stopPropagation()}
            />
          </div>

          {/* Bottom Controls */}
          <div
            className="bg-slate-900/95 backdrop-blur-sm border-t border-slate-700 p-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="max-w-md mx-auto flex gap-3">
              <a
                href={viewingRefImage}
                download="reference-image.png"
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 bg-cyan-500 hover:bg-cyan-400 text-black font-bold py-2.5 px-4 rounded-lg flex items-center justify-center gap-2 text-sm"
              >
                <Download size={16} />
                Download Reference
              </a>
              <button
                onClick={() => setViewingRefImage(null)}
                className="flex-1 bg-slate-700 hover:bg-slate-600 text-white font-bold py-2.5 px-4 rounded-lg text-sm"
              >
                Back
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
