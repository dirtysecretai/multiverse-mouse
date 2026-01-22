"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Image as ImageIcon, User, Calendar, Sparkles, ChevronLeft, ChevronRight } from "lucide-react"
import { useRouter } from "next/navigation"

interface GeneratedImage {
  id: number
  prompt: string
  imageUrl: string
  model: string
  ticketCost: number
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

        {/* Pagination Controls */}
        <div className="flex items-center gap-2">
          <Button
            onClick={() => fetchImages(pagination.page - 1)}
            disabled={pagination.page === 1}
            className="bg-slate-800 hover:bg-slate-700 disabled:opacity-50"
          >
            <ChevronLeft size={16} />
          </Button>
          <span className="text-sm text-slate-400 px-4">
            Page {pagination.page} of {pagination.totalPages}
          </span>
          <Button
            onClick={() => fetchImages(pagination.page + 1)}
            disabled={pagination.page >= pagination.totalPages}
            className="bg-slate-800 hover:bg-slate-700 disabled:opacity-50"
          >
            <ChevronRight size={16} />
          </Button>
        </div>
      </div>

      {/* Images Grid */}
      {isLoading ? (
        <div className="text-center text-slate-500">Loading images...</div>
      ) : (
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
                <div className="absolute top-2 right-2">
                  <span className="px-2 py-1 rounded-lg bg-black/80 text-xs text-cyan-400 font-mono">
                    {image.model === 'nano-banana' ? 'NanoBanana Cluster' : 
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
      )}

      {/* Image Modal */}
      {selectedImage && (
        <div
          className="fixed inset-0 bg-black/90 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={() => setSelectedImage(null)}
        >
          <div
            className="max-w-5xl w-full bg-slate-900 rounded-2xl border-2 border-cyan-500/30 overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Image */}
            <div className="max-h-[60vh] overflow-hidden bg-slate-950">
              <img
                src={selectedImage.imageUrl}
                alt={selectedImage.prompt}
                className="w-full h-full object-contain"
              />
            </div>

            {/* Details */}
            <div className="p-6">
              <div className="flex items-start gap-4 mb-4">
                <Sparkles className="text-cyan-400 flex-shrink-0" size={20} />
                <div className="flex-1">
                  <p className="text-white text-sm mb-2">{selectedImage.prompt}</p>
                  <div className="grid grid-cols-2 gap-4 text-xs text-slate-400">
                    <div>
                      <span className="font-bold text-slate-300">User:</span> {selectedImage.user.email}
                    </div>
                    <div>
                      <span className="font-bold text-slate-300">Model:</span> {selectedImage.model}
                    </div>
                    <div>
                      <span className="font-bold text-slate-300">Cost:</span> {selectedImage.ticketCost} ticket(s)
                    </div>
                    <div>
                      <span className="font-bold text-slate-300">Date:</span> {formatDate(selectedImage.createdAt)}
                    </div>
                  </div>
                </div>
              </div>

              <Button
                onClick={() => setSelectedImage(null)}
                className="w-full bg-slate-800 hover:bg-slate-700"
              >
                Close
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
