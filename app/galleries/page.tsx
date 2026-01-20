"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { ArrowLeft, Lock, ShoppingCart, Crown } from "lucide-react"
import Link from "next/link"

interface Gallery {
  id: number
  title: string
  description: string
  coverImageUrl: string
  price: number
  isActive: boolean
  isFeatured: boolean
  accessType: string
  images: { id: number }[]
}

export default function AllGalleriesPage() {
  const router = useRouter()
  const [galleries, setGalleries] = useState<Gallery[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchGalleries()
  }, [])

  const fetchGalleries = async () => {
    try {
      const res = await fetch('/api/galleries')
      if (res.ok) {
        const data = await res.json()
        setGalleries(data)
      }
    } catch (error) {
      console.error('Failed to fetch galleries:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#050810] flex items-center justify-center">
        <div className="text-cyan-400 font-mono">LOADING_GALLERIES...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#050810] relative overflow-hidden font-mono">
      <div className="fixed inset-0 bg-[linear-gradient(rgba(0,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(0,255,255,0.02)_1px,transparent_1px)] bg-[size:40px_40px] pointer-events-none" />
      
      <div className="relative z-10 max-w-7xl mx-auto p-6">
        {/* Header */}
        <div className="mb-8">
          <Link href="/">
            <Button className="mb-4 bg-slate-800 hover:bg-slate-700 text-white">
              <ArrowLeft size={16} className="mr-2" />
              BACK TO PORTAL
            </Button>
          </Link>

          <h1 className="text-4xl md:text-5xl font-black italic mb-2 text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-fuchsia-500">
            ALL GALLERIES
          </h1>
          <p className="text-slate-400 text-sm uppercase tracking-widest">
            Exclusive AI-generated content collections
          </p>
        </div>

        {/* Gallery Grid */}
        {galleries.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-slate-500 text-lg">No galleries available yet.</p>
            <p className="text-slate-600 text-sm mt-2">Check back soon for new content!</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {galleries.map((gallery) => (
              <Link key={gallery.id} href={`/gallery/${gallery.id}`}>
                <div className="group relative rounded-xl border border-cyan-500/20 bg-slate-900/50 overflow-hidden hover:border-cyan-400/50 transition-all duration-300 cursor-pointer backdrop-blur-sm">
                  {/* Featured Badge */}
                  {gallery.isFeatured && (
                    <div className="absolute top-3 left-3 z-10 px-2 py-1 bg-fuchsia-500 rounded-md flex items-center gap-1">
                      <Crown size={12} className="text-black" />
                      <span className="text-[10px] font-black text-black uppercase">Featured</span>
                    </div>
                  )}

                  {/* Cover Image */}
                  <div className="relative aspect-[4/3] bg-slate-800 overflow-hidden">
                    <img 
                      src={gallery.coverImageUrl}
                      alt={gallery.title}
                      className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-transparent to-transparent opacity-60" />
                    
                    {/* Scanline effect */}
                    <div className="absolute inset-0 pointer-events-none bg-[repeating-linear-gradient(0deg,transparent,transparent_2px,rgba(0,255,255,0.03)_2px,rgba(0,255,255,0.03)_4px)]" />

                    {/* Image Count */}
                    <div className="absolute top-3 right-3 px-2 py-1 bg-black/60 backdrop-blur-sm rounded-md border border-cyan-500/30">
                      <span className="text-[10px] text-cyan-400 font-bold">{gallery.images.length} IMAGES</span>
                    </div>

                    {/* Lock Overlay for paid galleries */}
                    {gallery.accessType !== 'free' && (
                      <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/40 backdrop-blur-sm">
                        <div className="text-center">
                          <Lock className="w-8 h-8 text-cyan-400 mx-auto mb-2" />
                          <p className="text-xs text-cyan-400 font-bold uppercase">Click to View</p>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Info */}
                  <div className="p-4">
                    <h3 className="text-lg font-black text-white mb-2 group-hover:text-cyan-400 transition-colors">
                      {gallery.title}
                    </h3>
                    <p className="text-sm text-slate-400 mb-4 line-clamp-2">
                      {gallery.description}
                    </p>

                    <div className="flex items-center justify-between border-t border-slate-700 pt-3">
                      {gallery.accessType === 'free' ? (
                        <span className="text-sm font-bold text-green-400 uppercase">Free Access</span>
                      ) : gallery.accessType === 'patreon' ? (
                        <span className="text-sm font-bold text-fuchsia-400 uppercase">Patreon Only</span>
                      ) : gallery.accessType === 'subscription' ? (
                        <span className="text-sm font-bold text-cyan-400 uppercase">All-Access</span>
                      ) : (
                        <div className="text-2xl font-black text-cyan-400">
                          ${gallery.price}
                        </div>
                      )}

                      <div className="text-xs text-slate-500 uppercase tracking-wider">
                        {gallery.accessType === 'free' ? 'View Now' : 'Purchase'}
                      </div>
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
