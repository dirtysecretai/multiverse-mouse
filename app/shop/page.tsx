"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { ArrowLeft, Package, Crown, Zap, ChevronLeft, ChevronRight, ExternalLink } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"

interface Gallery {
  id: number
  title: string
  description: string
  coverImageUrl: string
  price: number
  accessType: string
  isActive: boolean
  images: { id: number }[]
}

interface Product {
  id: number
  name: string
  description: string
  price: number
  imageUrl: string
  category: string
  stock: number
  isActive: boolean
  productType: string
  slotPosition: number | null
  isSlotActive: boolean
}

// Horizontal Scrollable Gallery Carousel
function GalleryCarousel({ galleries }: { galleries: Gallery[] }) {
  const [scrollPosition, setScrollPosition] = useState(0)
  const containerRef = useState<HTMLDivElement | null>(null)[0]

  const scroll = (direction: 'left' | 'right') => {
    const container = document.getElementById('gallery-carousel')
    if (container) {
      const scrollAmount = 320 // Width of one gallery card + gap
      const newPosition = direction === 'left' 
        ? Math.max(0, scrollPosition - scrollAmount)
        : Math.min(container.scrollWidth - container.clientWidth, scrollPosition + scrollAmount)
      
      container.scrollTo({ left: newPosition, behavior: 'smooth' })
      setScrollPosition(newPosition)
    }
  }

  if (galleries.length === 0) return null

  return (
    <div className="relative mb-12">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <Package className="text-cyan-400" size={24} />
          <h2 className="text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-fuchsia-500">
            DIGITAL_GALLERIES
          </h2>
        </div>
        <Link href="/galleries">
          <Button className="bg-cyan-500 hover:bg-cyan-400 text-black font-bold text-sm">
            VIEW ALL GALLERIES
            <ExternalLink className="ml-2" size={14} />
          </Button>
        </Link>
      </div>

      <p className="text-slate-400 text-sm mb-6">
        Exclusive content galleries with interactive lore and premium AI-generated images.
      </p>

      {/* Carousel Container */}
      <div className="relative group">
        {/* Left Arrow */}
        {scrollPosition > 0 && (
          <button
            onClick={() => scroll('left')}
            className="absolute left-0 top-1/2 -translate-y-1/2 z-10 w-12 h-12 bg-black/80 backdrop-blur-sm rounded-full border border-cyan-500/30 flex items-center justify-center text-cyan-400 hover:bg-black/90 hover:border-cyan-400 transition-all"
          >
            <ChevronLeft size={24} />
          </button>
        )}

        {/* Right Arrow */}
        <button
          onClick={() => scroll('right')}
          className="absolute right-0 top-1/2 -translate-y-1/2 z-10 w-12 h-12 bg-black/80 backdrop-blur-sm rounded-full border border-cyan-500/30 flex items-center justify-center text-cyan-400 hover:bg-black/90 hover:border-cyan-400 transition-all opacity-0 group-hover:opacity-100 transition-opacity"
        >
          <ChevronRight size={24} />
        </button>

        {/* Scrollable Gallery Row */}
        <div 
          id="gallery-carousel"
          className="flex gap-4 overflow-x-auto scrollbar-hide scroll-smooth"
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
        >
          {galleries.map((gallery) => (
            <Link key={gallery.id} href={`/gallery/${gallery.id}`}>
              <div className="flex-shrink-0 w-[300px] group cursor-pointer">
                <div className="rounded-xl border border-cyan-500/20 bg-slate-900/50 overflow-hidden hover:border-cyan-400/50 transition-all duration-300 backdrop-blur-sm">
                  {/* Cover Image */}
                  <div className="relative aspect-[4/3] bg-slate-800 overflow-hidden">
                    <img 
                      src={gallery.coverImageUrl}
                      alt={gallery.title}
                      className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-transparent to-transparent opacity-60" />
                    
                    {/* Image Count Badge */}
                    <div className="absolute top-2 right-2 px-2 py-1 bg-black/60 backdrop-blur-sm rounded-md border border-cyan-500/30">
                      <span className="text-[10px] text-cyan-400 font-bold">{gallery.images.length} IMG</span>
                    </div>
                  </div>

                  {/* Info */}
                  <div className="p-3">
                    <h3 className="text-sm font-black text-white mb-1 group-hover:text-cyan-400 transition-colors line-clamp-1">
                      {gallery.title}
                    </h3>
                    <p className="text-xs text-slate-400 mb-2 line-clamp-2">
                      {gallery.description}
                    </p>

                    <div className="flex items-center justify-between">
                      {gallery.accessType === 'free' ? (
                        <span className="text-xs font-bold text-green-400 uppercase">Free</span>
                      ) : (
                        <span className="text-lg font-black text-cyan-400">${gallery.price}</span>
                      )}
                      <span className="text-[10px] text-slate-500 uppercase">View →</span>
                    </div>
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}

// Product Card Component
function ProductCard({ product }: { product: Product }) {
  return (
    <div className="border border-cyan-500/20 bg-slate-900/50 rounded-xl overflow-hidden hover:border-cyan-400/50 transition-all duration-300 backdrop-blur-sm group">
      <div className="relative aspect-square bg-slate-800 overflow-hidden">
        <img src={product.imageUrl} alt={product.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
        <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-transparent to-transparent opacity-60" />
        
        {/* Category Badge */}
        <div className="absolute top-3 right-3 px-2 py-1 bg-cyan-500/20 backdrop-blur-sm rounded-md border border-cyan-500/30">
          <span className="text-[10px] text-cyan-400 font-bold uppercase">{product.category}</span>
        </div>

        {/* Stock Warning */}
        {product.stock <= 5 && product.stock > 0 && (
          <div className="absolute bottom-3 left-3 px-2 py-1 bg-yellow-500/20 backdrop-blur-sm rounded-md border border-yellow-500/30">
            <span className="text-[10px] text-yellow-400 font-bold">ONLY {product.stock} LEFT</span>
          </div>
        )}

        {product.stock === 0 && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/60 backdrop-blur-sm">
            <span className="text-red-400 font-bold uppercase text-sm">SOLD OUT</span>
          </div>
        )}
      </div>

      <div className="p-4">
        <h3 className="text-lg font-bold text-white mb-2 group-hover:text-cyan-400 transition-colors">{product.name}</h3>
        <p className="text-sm text-slate-400 mb-4 line-clamp-2">{product.description}</p>
        
        <div className="flex items-center justify-between pt-2 border-t border-slate-800">
          <div className="flex items-baseline gap-1">
            <span className="text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-fuchsia-500">
              ${product.price}
            </span>
          </div>
          <Button 
            disabled={product.stock === 0}
            className="bg-cyan-500 hover:bg-cyan-400 text-black font-bold disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {product.stock === 0 ? 'SOLD OUT' : 'PURCHASE'}
          </Button>
        </div>
      </div>
    </div>
  )
}

export default function ShopPage() {
  const router = useRouter()
  const [galleries, setGalleries] = useState<Gallery[]>([])
  const [featuredRunes, setFeaturedRunes] = useState<Product[]>([])
  const [promptPacks, setPromptPacks] = useState<Product[]>([])
  const [regularProducts, setRegularProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    try {
      // Fetch galleries
      const galleriesRes = await fetch('/api/galleries')
      if (galleriesRes.ok) {
        const galleriesData = await galleriesRes.json()
        setGalleries(galleriesData.filter((g: Gallery) => g.isActive))
      }

      // Fetch products
      const productsRes = await fetch('/api/shop')
      if (productsRes.ok) {
        const productsData = await productsRes.json()
        const products = Array.isArray(productsData) ? productsData : []
        
        setFeaturedRunes(products.filter((p: Product) => p.productType === 'featured_rune' && p.isActive && p.isSlotActive))
        setPromptPacks(products.filter((p: Product) => p.productType === 'prompt_pack' && p.isActive && p.isSlotActive))
        setRegularProducts(products.filter((p: Product) => p.productType === 'regular' && p.isActive))
      }
    } catch (error) {
      console.error('Failed to fetch shop data:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#050810] flex items-center justify-center">
        <div className="text-cyan-400 font-mono">LOADING_SHOP...</div>
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
            DIGITAL MARKETPLACE
          </h1>
          <p className="text-slate-400 text-sm uppercase tracking-widest">
            Exclusive AI-generated content, commissions, and prompt packs
          </p>
        </div>

        {/* GALLERIES CAROUSEL - AT THE TOP */}
        <GalleryCarousel galleries={galleries} />

        {/* Featured Commission Slots */}
        {featuredRunes.length > 0 && (
          <div className="mb-12">
            <div className="flex items-center gap-3 mb-6">
              <Crown className="text-fuchsia-400" size={24} />
              <h2 className="text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-fuchsia-500">
                COMMISSION_SLOTS
              </h2>
            </div>
            <p className="text-slate-400 text-sm mb-6">
              Premium custom AI content generation. Reserve your slot for personalized creations.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {featuredRunes.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          </div>
        )}

        {/* Prompt Packs */}
        {promptPacks.length > 0 && (
          <div className="mb-12">
            <div className="flex items-center gap-3 mb-6">
              <Zap className="text-cyan-400" size={24} />
              <h2 className="text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-fuchsia-500">
                PROMPT_PACKS
              </h2>
            </div>
            <p className="text-slate-400 text-sm mb-6">
              Get 8 custom AI generations for just $8. Submit your prompts and references.
            </p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {promptPacks.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          </div>
        )}

        {/* Regular Products */}
        {regularProducts.length > 0 && (
          <div className="mb-12">
            <div className="flex items-center gap-3 mb-6">
              <Package className="text-cyan-400" size={24} />
              <h2 className="text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-fuchsia-500">
                OTHER_PRODUCTS
              </h2>
            </div>
            <p className="text-slate-400 text-sm mb-6">
              Additional digital goods and exclusive content packs.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {regularProducts.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          </div>
        )}

        {/* Empty State */}
        {galleries.length === 0 && featuredRunes.length === 0 && promptPacks.length === 0 && regularProducts.length === 0 && (
          <div className="text-center py-12">
            <Package className="w-16 h-16 text-slate-700 mx-auto mb-4" />
            <h3 className="text-xl font-bold text-slate-500 mb-2">Shop Coming Soon</h3>
            <p className="text-slate-600">Check back later for exclusive content and commissions!</p>
          </div>
        )}
      </div>
    </div>
  )
}
