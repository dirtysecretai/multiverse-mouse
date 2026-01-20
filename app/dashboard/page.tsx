"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Ticket, LogOut, CreditCard, Image as ImageIcon, Download, ExternalLink } from "lucide-react"
import { useRouter } from "next/navigation"
import Link from "next/link"

interface UserData {
  id: number
  email: string
  ticketBalance: number
}

interface GeneratedImage {
  id: number
  prompt: string
  imageUrl: string
  createdAt: string
  expiresAt: string
}

interface Purchase {
  id: number
  type: string
  description: string
  amount: number
  date: string
  status: string
  paypalOrderId: string
}

export default function DashboardPage() {
  const router = useRouter()
  const [user, setUser] = useState<UserData | null>(null)
  const [loading, setLoading] = useState(true)
  const [generatedImages, setGeneratedImages] = useState<GeneratedImage[]>([])
  const [purchases, setPurchases] = useState<Purchase[]>([])
  const [selectedImage, setSelectedImage] = useState<GeneratedImage | null>(null)

  useEffect(() => {
    checkAuth()
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
      
      // Fetch generated images
      fetchGeneratedImages()
      
      // Fetch purchase history
      fetchPurchases()
      
    } catch (error) {
      console.error('Auth check failed:', error)
      router.push('/login')
    } finally {
      setLoading(false)
    }
  }

  const fetchGeneratedImages = async () => {
    try {
      const res = await fetch('/api/my-images')
      const data = await res.json()
      
      if (data.success) {
        setGeneratedImages(data.images)
      }
    } catch (error) {
      console.error('Failed to fetch images:', error)
    }
  }

  const fetchPurchases = async () => {
    try {
      const res = await fetch('/api/purchases')
      const data = await res.json()
      
      if (Array.isArray(data)) {
        setPurchases(data)
      }
    } catch (error) {
      console.error('Failed to fetch purchases:', error)
    }
  }

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' })
    router.push('/')
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric', 
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const daysUntilExpiry = (expiresAt: string) => {
    const now = new Date()
    const expiry = new Date(expiresAt)
    const diff = expiry.getTime() - now.getTime()
    return Math.ceil(diff / (1000 * 60 * 60 * 24))
  }

  const downloadImage = async (imageUrl: string, prompt: string) => {
    try {
      // For iOS/mobile, we need to handle downloads differently
      const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent)
      const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
      
      if (isIOS || isMobile) {
        // On iOS/mobile, open in new tab so user can long-press to save
        const link = document.createElement('a')
        link.href = imageUrl
        link.target = '_blank'
        link.rel = 'noopener noreferrer'
        link.click()
        
        // Show instruction alert after a moment
        setTimeout(() => {
          alert('Tip: Long-press the image and select "Save to Photos" or "Download Image"')
        }, 500)
      } else {
        // Desktop: Direct download
        const response = await fetch(imageUrl)
        const blob = await response.blob()
        const url = window.URL.createObjectURL(blob)
        
        const link = document.createElement('a')
        link.href = url
        link.download = `multiverse-${prompt.substring(0, 30).replace(/[^a-z0-9]/gi, '-')}.png`
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
        window.URL.revokeObjectURL(url)
      }
    } catch (error) {
      console.error('Download failed:', error)
      // Fallback: just open in new tab
      window.open(imageUrl, '_blank')
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#050810] flex items-center justify-center">
        <div className="text-cyan-400 text-xl font-mono">LOADING...</div>
      </div>
    )
  }

  if (!user) return null

  return (
    <div className="min-h-screen bg-[#050810] text-white relative overflow-hidden">
      {/* Background effects */}
      <div className="fixed inset-0 bg-[linear-gradient(rgba(0,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(0,255,255,0.02)_1px,transparent_1px)] bg-[size:40px_40px] pointer-events-none" />
      <div className="fixed top-20 left-20 w-96 h-96 bg-cyan-500/5 rounded-full blur-3xl" />
      <div className="fixed bottom-20 right-20 w-96 h-96 bg-fuchsia-500/5 rounded-full blur-3xl" />

      <div className="relative z-10 max-w-6xl mx-auto p-6">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-2">
            <h1 className="text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-fuchsia-500">
              YOUR DASHBOARD
            </h1>
            <div className="flex items-center gap-3">
              <Link href="/">
                <Button 
                  variant="outline"
                  className="border-cyan-500 text-cyan-400 hover:bg-cyan-500 hover:text-black"
                >
                  <ExternalLink size={16} className="mr-2" />
                  Home
                </Button>
              </Link>
              <Button 
                onClick={handleLogout}
                variant="outline"
                className="border-slate-700 text-slate-300 hover:border-red-500 hover:text-red-400"
              >
                <LogOut size={16} className="mr-2" />
                Logout
              </Button>
            </div>
          </div>
          <p className="text-slate-400 text-sm">Welcome back, {user.email.split('@')[0]}!</p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          {/* Available Tickets */}
          <div className="p-6 rounded-xl border-2 border-cyan-500/30 bg-slate-900/80 backdrop-blur-sm">
            <div className="flex items-center justify-between mb-4">
              <Ticket className="text-cyan-400" size={32} />
              <span className="text-4xl font-black text-cyan-400">{user.ticketBalance}</span>
            </div>
            <p className="text-sm text-slate-400 mb-4">Available Tickets</p>
            <Link href="/buy-tickets">
              <Button className="w-full bg-gradient-to-r from-cyan-500 to-fuchsia-500 hover:from-cyan-400 hover:to-fuchsia-400 text-black font-bold">
                <CreditCard size={16} className="mr-2" />
                Buy More Tickets
              </Button>
            </Link>
          </div>

          {/* Generated Images */}
          <div className="p-6 rounded-xl border-2 border-fuchsia-500/30 bg-slate-900/80 backdrop-blur-sm">
            <div className="flex items-center justify-between mb-4">
              <ImageIcon className="text-fuchsia-400" size={32} />
              <span className="text-4xl font-black text-fuchsia-400">{generatedImages.length}</span>
            </div>
            <p className="text-sm text-slate-400 mb-4">Generated Images</p>
            <Link href="/">
              <Button className="w-full bg-slate-700 hover:bg-slate-600 font-bold">
                Generate Images
              </Button>
            </Link>
          </div>

          {/* Account Info */}
          <div className="p-6 rounded-xl border-2 border-slate-700 bg-slate-900/80 backdrop-blur-sm">
            <div className="flex items-center justify-between mb-4">
              <div className="w-10 h-10 rounded-full bg-gradient-to-r from-cyan-500 to-fuchsia-500 flex items-center justify-center font-bold text-black">
                {user.email.charAt(0).toUpperCase()}
              </div>
              <span className="text-xs text-slate-500 font-mono">ID: {user.id}</span>
            </div>
            <p className="text-sm text-slate-400 mb-1">Email</p>
            <p className="text-xs text-white truncate">{user.email}</p>
          </div>
        </div>

        {/* Generated Images Section */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-2xl font-black text-cyan-400">YOUR GENERATED IMAGES</h2>
            {generatedImages.length > 0 && (
              <p className="text-sm text-slate-500">Stored for 30 days</p>
            )}
          </div>

          {generatedImages.length === 0 ? (
            <div className="p-12 rounded-xl border-2 border-dashed border-slate-800 bg-slate-900/30 text-center">
              <ImageIcon className="mx-auto text-slate-700 mb-4" size={48} />
              <p className="text-slate-500 mb-4">No images generated yet</p>
              <p className="text-xs text-slate-600 mb-4">Purchase tickets and start generating AI images!</p>
              <div className="flex gap-3 justify-center">
                <Link href="/buy-tickets">
                  <Button className="bg-cyan-500 hover:bg-cyan-400 text-black font-bold">
                    Buy Tickets
                  </Button>
                </Link>
                <Link href="/">
                  <Button variant="outline" className="border-slate-700 hover:border-cyan-500">
                    Start Generating
                  </Button>
                </Link>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {generatedImages.map((image) => (
                <div key={image.id} className="group relative">
                  <div 
                    className="aspect-square rounded-xl overflow-hidden border-2 border-slate-800 hover:border-cyan-500 transition-all cursor-pointer bg-slate-900"
                    onClick={() => setSelectedImage(image)}
                  >
                    <img 
                      src={image.imageUrl} 
                      alt={image.prompt}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
                      <div className="absolute bottom-0 left-0 right-0 p-4">
                        <p className="text-xs text-white line-clamp-2 mb-2">{image.prompt}</p>
                        <div className="flex gap-2">
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              downloadImage(image.imageUrl, image.prompt)
                            }}
                            className="flex-1 bg-cyan-500 hover:bg-cyan-400 text-black text-xs font-bold py-2 px-3 rounded-lg flex items-center justify-center gap-1"
                          >
                            <Download size={12} />
                            Download
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              setSelectedImage(image)
                            }}
                            className="bg-slate-700 hover:bg-slate-600 text-white text-xs font-bold py-2 px-3 rounded-lg"
                          >
                            View
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="mt-2 flex items-center justify-between text-xs">
                    <span className="text-slate-500">{formatDate(image.createdAt)}</span>
                    <span className={`${daysUntilExpiry(image.expiresAt) < 7 ? 'text-yellow-400' : 'text-slate-600'}`}>
                      {daysUntilExpiry(image.expiresAt)} days left
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Purchase History */}
        <div>
          <h2 className="text-2xl font-black text-cyan-400 mb-4">PURCHASE HISTORY</h2>
          
          {purchases.length === 0 ? (
            <div className="p-8 rounded-xl border border-slate-800 bg-slate-900/30 text-center">
              <CreditCard className="mx-auto text-slate-700 mb-2" size={32} />
              <p className="text-slate-500">No purchases yet</p>
              <p className="text-xs text-slate-600 mt-1">Your ticket purchase history will appear here</p>
            </div>
          ) : (
            <div className="space-y-3">
              {purchases.map((purchase) => (
                <div key={purchase.id} className="p-4 rounded-xl border border-slate-800 bg-slate-900/40 hover:border-cyan-500/30 transition-colors">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4 flex-1">
                      <div className="w-10 h-10 rounded-full bg-cyan-500/20 flex items-center justify-center">
                        <Ticket className="text-cyan-400" size={20} />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <p className="text-sm font-bold text-white">
                            {purchase.description}
                          </p>
                          <span className="px-2 py-0.5 text-xs font-bold bg-green-500/20 text-green-400 rounded">
                            {purchase.status}
                          </span>
                        </div>
                        <p className="text-xs text-slate-500">{formatDate(purchase.date)}</p>
                        <p className="text-xs text-slate-600 font-mono mt-0.5">{purchase.paypalOrderId}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-bold text-cyan-400">${purchase.amount.toFixed(2)}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Image Viewer Modal */}
      {selectedImage && (
        <div 
          className="fixed inset-0 bg-black/90 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={() => setSelectedImage(null)}
        >
          <div className="relative max-w-5xl w-full" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={() => setSelectedImage(null)}
              className="absolute -top-12 right-0 text-white hover:text-cyan-400 transition-colors"
            >
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
            
            <div className="bg-slate-900 rounded-2xl overflow-hidden border-2 border-cyan-500/30">
              <img 
                src={selectedImage.imageUrl} 
                alt={selectedImage.prompt}
                className="w-full h-auto"
              />
              <div className="p-6 border-t border-slate-800">
                <p className="text-sm text-slate-300 mb-4">{selectedImage.prompt}</p>
                <div className="flex gap-3">
                  <button
                    onClick={() => downloadImage(selectedImage.imageUrl, selectedImage.prompt)}
                    className="flex-1 bg-cyan-500 hover:bg-cyan-400 text-black font-bold py-3 px-4 rounded-lg flex items-center justify-center gap-2"
                  >
                    <Download size={16} />
                    {typeof window !== 'undefined' && /iPad|iPhone|iPod/.test(navigator.userAgent) 
                      ? 'Open to Save' 
                      : 'Download Full Size'}
                  </button>
                  <a
                    href={selectedImage.imageUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="bg-slate-700 hover:bg-slate-600 text-white font-bold py-3 px-4 rounded-lg flex items-center justify-center gap-2"
                  >
                    <ExternalLink size={16} />
                    Open in New Tab
                  </a>
                  <button
                    onClick={() => {
                      // Save prompt to localStorage
                      localStorage.setItem('rescan_prompt', selectedImage.prompt)
                      // Redirect to homepage
                      router.push('/')
                    }}
                    className="bg-fuchsia-500 hover:bg-fuchsia-400 text-white font-bold py-3 px-4 rounded-lg flex items-center justify-center gap-2"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    Rescan
                  </button>
                </div>
                <div className="mt-4 flex items-center justify-between text-xs text-slate-500">
                  <span>Generated: {formatDate(selectedImage.createdAt)}</span>
                  <span>Expires: {formatDate(selectedImage.expiresAt)} ({daysUntilExpiry(selectedImage.expiresAt)} days)</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}







