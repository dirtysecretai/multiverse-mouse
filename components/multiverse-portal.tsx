"use client"

import { useState, useEffect, useCallback } from "react"
import { Switch } from "@/components/ui/switch"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { AlertTriangle, ChevronUp, ChevronDown, ExternalLink, Terminal, Store, Crown, ImagePlus, X, Wrench, Package, Lock, Sparkles, Eye, Settings2, Zap, Ticket, Upload, Download } from "lucide-react"
import Link from "next/link"
import { RuneSlot } from "@/components/rune-slot"
import { PromptPackSlot } from "@/components/prompt-pack-slot"
import { PromptPackModal } from "@/components/prompt-pack-modal"
import { useRouter } from "next/navigation"
import { ModelSelector } from "@/components/ModelSelector"
import { getTicketCost } from "@/config/ai-models.config"

// --- ICONS ---
const PatreonIcon = () => (
  <svg viewBox="0 0 24 24" className="w-8 h-8" fill="currentColor">
    <path d="M15.386.524c-4.764 0-8.64 3.876-8.64 8.64 0 4.75 3.876 8.613 8.64 8.613 4.75 0 8.614-3.864 8.614-8.613C24 4.4 20.136.524 15.386.524M.003 23.537h4.22V.524H.003" />
  </svg>
)

const InstagramIcon = () => (
  <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
    <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
    <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
  </svg>
)

interface AdminState { 
  isShopOpen: boolean
  isMaintenanceMode: boolean
  runesMaintenance: boolean
  echoChamberMaintenance: boolean
  galleriesMaintenance: boolean
  promptPacksMaintenance: boolean
  aiGenerationMaintenance: boolean
}

interface UserData {
  id: number
  email: string
  ticketBalance: number
}

interface CarouselImage { id: string; url: string; alt: string }

interface Product {
  id: number
  name: string
  description: string
  price: number
  imageUrl: string
  category: string
  stock: number
  productType: string
  slotPosition: number | null
  isSlotActive: boolean
}

interface Gallery {
  id: number
  title: string
  description: string
  coverImageUrl: string
  coverImagePosition?: string
  price: number
  accessType: string
  isFeatured: boolean
  images: { id: number }[]
}

// --- MAINTENANCE INDICATOR ---
function MaintenanceIndicator({ label }: { label: string }) {
  return (
    <div className="p-6 rounded-xl border border-yellow-500/30 bg-yellow-500/5 backdrop-blur-sm">
      <div className="flex items-center justify-center gap-3 text-yellow-500">
        <Wrench size={20} className="animate-pulse" />
        <span className="text-sm font-mono uppercase tracking-widest">{label}_OFFLINE</span>
      </div>
    </div>
  )
}

// --- SHOP OFFLINE INDICATOR ---
function ShopOfflineIndicator() {
  return (
    <div className="w-full mb-4 p-6 rounded-xl border border-slate-700/50 bg-slate-900/30 backdrop-blur-sm">
      <div className="flex items-center justify-center gap-3 text-slate-500">
        <Lock size={20} />
        <div className="text-center">
          <p className="text-sm font-mono uppercase tracking-widest mb-1">SHOP_OFFLINE</p>
          <p className="text-xs text-slate-600">Check back soon for exclusive content</p>
        </div>
      </div>
    </div>
  )
}

// --- GALLERIES EMPTY PLACEHOLDER ---
function GalleriesEmptyPlaceholder() {
  return (
    <div className="w-full grid grid-cols-4 gap-2">
      {[1, 2, 3, 4].map((i) => (
        <div key={i} className="relative aspect-square rounded-lg border border-slate-800/50 bg-slate-900/20 overflow-hidden">
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-slate-700">
            <Sparkles size={16} className="animate-pulse" />
            <span className="text-[8px] uppercase tracking-widest">Coming Soon</span>
          </div>
          {/* Animated scanlines */}
          <div className="absolute inset-0 pointer-events-none bg-[repeating-linear-gradient(0deg,transparent,transparent_2px,rgba(0,255,255,0.02)_2px,rgba(0,255,255,0.02)_4px)] animate-pulse" />
        </div>
      ))}
    </div>
  )
}

// --- SMALL LINK BADGE ---
function SmallLinkBadge({ icon, label, href }: { icon: any, label: string, href: string }) {
  return (
    <a 
      href={href} 
      target="_blank" 
      rel="noopener noreferrer" 
      className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-slate-700/50 bg-slate-900/30 hover:border-cyan-500/30 hover:bg-cyan-500/5 transition-all text-xs group"
    >
      <span className="text-slate-500 group-hover:text-cyan-400 transition-colors">{icon}</span>
      <span className="text-slate-400 group-hover:text-cyan-300 transition-colors">{label}</span>
      <ExternalLink className="w-3 h-3 text-slate-600 group-hover:text-cyan-400 transition-colors" />
    </a>
  )
}

// --- MINI GALLERY CARD ---
function MiniGalleryCard({ gallery }: { gallery: Gallery }) {
  return (
    <Link href={`/gallery/${gallery.id}`}>
      <div className="relative group cursor-pointer">
        <div className="aspect-square rounded-lg overflow-hidden border border-cyan-500/20 bg-slate-900/50 hover:border-cyan-400/50 transition-all">
          <img 
            src={gallery.coverImageUrl} 
            alt={gallery.title} 
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            style={{ objectPosition: gallery.coverImagePosition || 'center' }}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-transparent to-transparent opacity-60" />
          <div className="absolute bottom-0 left-0 right-0 p-2 bg-slate-950/80 backdrop-blur-sm">
            <p className="text-[10px] text-cyan-400 font-bold truncate">{gallery.title}</p>
            <div className="flex items-center justify-between">
              {gallery.accessType === 'free' ? (
                <span className="text-[8px] text-green-400 uppercase font-bold">Free</span>
              ) : (
                <span className="text-xs text-slate-400">${gallery.price}</span>
              )}
              <span className="text-[8px] text-slate-500">{gallery.images.length} img</span>
            </div>
          </div>
        </div>
      </div>
    </Link>
  )
}

// --- VERTICAL CAROUSEL ---
function VerticalCarousel({ images, side }: { images: CarouselImage[]; side: string }) {
  const [index, setIndex] = useState(0)
  
  // ALWAYS call all hooks first (Rules of Hooks)
  const goUp = () => {
    if (images && images.length > 0) {
      setIndex((p) => (p - 1 + images.length) % images.length)
    }
  }
  
  const goDown = () => {
    if (images && images.length > 0) {
      setIndex((p) => (p + 1) % images.length)
    }
  }

  useEffect(() => {
    if (images && images.length > 0) {
      const int = setInterval(goDown, 5000)
      return () => clearInterval(int)
    }
  }, [images?.length])

  // NOW check for empty state (after all hooks)
  if (!images || images.length === 0) {
    return (
      <div className="h-full flex flex-col border border-cyan-500/20 bg-slate-950/50 rounded-xl overflow-hidden shadow-[0_0_20px_rgba(0,0,0,0.5)]">
        <div className="px-3 py-2 border-b border-cyan-500/20 bg-slate-900/80 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-slate-500" />
            <span className="text-[10px] font-mono text-slate-500 uppercase tracking-wider">No Images</span>
          </div>
        </div>
        <div className="flex-1 flex items-center justify-center p-8">
          <p className="text-slate-600 text-sm text-center">Upload images in admin panel</p>
        </div>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col border border-cyan-500/20 bg-slate-950/50 rounded-xl overflow-hidden shadow-[0_0_20px_rgba(0,0,0,0.5)]">
      <div className="px-3 py-2 border-b border-cyan-500/20 bg-slate-900/80 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
          <span className="text-[10px] text-slate-500 font-mono uppercase tracking-widest">{side}_scan</span>
        </div>
        <span className="text-[8px] text-slate-600 font-mono">{(index + 1).toString().padStart(2, '0')}/{images.length.toString().padStart(2, '0')}</span>
      </div>
      <div className="flex-1 relative">
        {images.map((img, i) => (
          <img
            key={img.id}
            src={img.url}
            alt={img.alt}
            className={`absolute inset-0 w-full h-full object-cover transition-all duration-700 ease-in-out ${
              i === index
                ? "opacity-100 scale-100"
                : i < index
                ? "opacity-0 scale-95 -translate-y-4"
                : "opacity-0 scale-95 translate-y-4"
            }`}
          />
        ))}
        <div className="absolute top-2 right-2 p-1.5 rounded-md bg-slate-950/60 backdrop-blur-sm border border-cyan-500/20">
          <button onClick={goUp} className="block text-cyan-400 hover:text-cyan-300 transition-colors p-0.5">
            <ChevronUp size={12} />
          </button>
          <button onClick={goDown} className="block text-cyan-400 hover:text-cyan-300 transition-colors p-0.5">
            <ChevronDown size={12} />
          </button>
        </div>
      </div>
      <div className="px-3 py-2 border-t border-cyan-500/20 bg-slate-900/80">
        <p className="text-[9px] text-slate-500 line-clamp-1">{images[index]?.alt || `Scan ${index + 1}`}</p>
      </div>
    </div>
  )
}

// --- MAIN COMPONENT ---
export default function MultiversePortal() {
  const router = useRouter()
  const [adminState, setAdminState] = useState<AdminState>({
    isShopOpen: false,
    isMaintenanceMode: false,
    runesMaintenance: false,
    echoChamberMaintenance: false,
    galleriesMaintenance: false,
    promptPacksMaintenance: false,
    aiGenerationMaintenance: false,
  })

  // User session state
  const [user, setUser] = useState<UserData | null>(null)
  const [sessionLoading, setSessionLoading] = useState(true)

  // AI Scanner state
  const [coordinates, setCoordinates] = useState('')
  const [quality, setQuality] = useState<'2k' | '4k'>('2k')
  const [aspectRatio, setAspectRatio] = useState<'1:1' | '4:5' | '9:16' | '16:9'>('16:9')
  const [isGenerating, setIsGenerating] = useState(false)
  const [generatedImage, setGeneratedImage] = useState<string | null>(null)
  const [showImageModal, setShowImageModal] = useState(false)
  const [generationError, setGenerationError] = useState<string | null>(null)
  const [referenceImages, setReferenceImages] = useState<string[]>([])
  const [selectedModel, setSelectedModel] = useState('gemini-3-pro-image')

  // Other state
  const [echoMessage, setEchoMessage] = useState("")
  const [userName, setUserName] = useState("")
  const [visibleName, setVisibleName] = useState(false)
  const [isTransmitting, setIsTransmitting] = useState(false)
  const [submitSuccess, setSubmitSuccess] = useState(false)
  const [uploadedImages, setUploadedImages] = useState<File[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [galleries, setGalleries] = useState<Gallery[]>([])
  const [selectedPromptPack, setSelectedPromptPack] = useState<Product | null>(null)
  const [leftCarouselImages, setLeftCarouselImages] = useState<CarouselImage[]>([])
  const [rightCarouselImages, setRightCarouselImages] = useState<CarouselImage[]>([])

  // Fetch carousel images from API
  useEffect(() => {
    const fetchCarousels = async () => {
      try {
        const res = await fetch('/api/carousels')
        const data = await res.json()
        
        // Convert API format to CarouselImage format
        const leftImages = (data.left || []).map((img: any) => ({
          id: img.id.toString(),
          url: img.imageUrl,
          alt: `Scan ${img.position}`
        }))
        
        const rightImages = (data.right || []).map((img: any) => ({
          id: img.id.toString(),
          url: img.imageUrl,
          alt: `Scan ${img.position}`
        }))
        
        setLeftCarouselImages(leftImages)
        setRightCarouselImages(rightImages)
      } catch (error) {
        console.error('Failed to fetch carousels:', error)
        // Fallback to empty arrays if fetch fails
        setLeftCarouselImages([])
        setRightCarouselImages([])
      }
    }
    fetchCarousels()
  }, [])

  // Handle rescan from dashboard
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const rescanPrompt = localStorage.getItem('rescan_prompt')
      if (rescanPrompt) {
        setCoordinates(rescanPrompt)
        localStorage.removeItem('rescan_prompt')
        
        // Scroll to scanner section after a brief delay
        setTimeout(() => {
          const scannerSection = document.getElementById('scanner-section')
          if (scannerSection) {
            scannerSection.scrollIntoView({ behavior: 'smooth', block: 'center' })
          }
        }, 300)
      }
    }
  }, [])

  const leftImages = leftCarouselImages
  const rightImages = rightCarouselImages

  // Check user session
  const checkSession = useCallback(async () => {
    try {
      const res = await fetch('/api/auth/session')
      const data = await res.json()
      if (data.authenticated) {
        setUser(data.user)
      }
    } catch (err) {
      console.error('Session check failed:', err)
    } finally {
      setSessionLoading(false)
    }
  }, [])

  // Fetch admin config
  const fetchAdminConfig = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/config')
      if (res.ok) {
        const data = await res.json()
        setAdminState({
          isShopOpen: !!data.isShopOpen,
          isMaintenanceMode: !!data.isMaintenanceMode,
          runesMaintenance: !!data.runesMaintenance,
          echoChamberMaintenance: !!data.echoChamberMaintenance,
          galleriesMaintenance: !!data.galleriesMaintenance,
          promptPacksMaintenance: !!data.promptPacksMaintenance,
          aiGenerationMaintenance: !!data.aiGenerationMaintenance || false,
        })
      }
    } catch (err) {
      console.error("Config fetch failed:", err)
    }
  }, [])

  // Fetch products
  const fetchProducts = useCallback(async () => {
    try {
      const res = await fetch('/api/shop')
      if (res.ok) {
        const data = await res.json()
        setProducts(Array.isArray(data) ? data : [])
      }
    } catch (err) {
      console.error("Products fetch failed:", err)
    }
  }, [])

  // Fetch galleries
  const fetchGalleries = useCallback(async () => {
    try {
      const res = await fetch('/api/galleries')
      if (res.ok) {
        const data = await res.json()
        setGalleries(Array.isArray(data) ? data : [])
      }
    } catch (err) {
      console.error("Galleries fetch failed:", err)
    }
  }, [])

  useEffect(() => {
    checkSession()
    fetchAdminConfig()
    fetchProducts()
    fetchGalleries()
  }, [checkSession, fetchAdminConfig, fetchProducts, fetchGalleries])

  // AI Generation handler
  const handleGenerate = async () => {
    if (!user) {
      router.push('/login')
      return
    }

    if (!coordinates.trim()) {
      setGenerationError('Please enter universe coordinates')
      return
    }

    // Get ticket cost for selected model
    const ticketCost = getTicketCost(selectedModel)
    
    if (user.ticketBalance < ticketCost) {
      setGenerationError(`Insufficient tickets. Need ${ticketCost} ticket(s) for this model. Purchase more to continue scanning.`)
      return
    }

    setIsGenerating(true)
    setGenerationError(null)
    setGeneratedImage(null)

    try {
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: coordinates,
          quality,
          aspectRatio,
          referenceImages,
          model: selectedModel,
        }),
      })

      const data = await res.json()

      if (data.success) {
        setGeneratedImage(data.imageUrl)
        // Update user ticket balance
        if (user) {
          setUser({ ...user, ticketBalance: data.newBalance })
        }
      } else {
        setGenerationError(data.error || 'Universe scan failed. Please try again.')
      }
    } catch (err: any) {
      console.error('Generation error:', err)
      setGenerationError('Network error. Please try again.')
    } finally {
      setIsGenerating(false)
    }
  }

  const handleSubmit = async () => {
    if (!echoMessage.trim()) return
    setIsTransmitting(true)
    setSubmitSuccess(false)

    try {
      const formData = new FormData()
      formData.append('message', echoMessage)
      formData.append('visibleName', String(visibleName))
      if (visibleName && userName) formData.append('name', userName)
      uploadedImages.forEach((img) => formData.append('images', img))

      await fetch('/api/echo', { method: 'POST', body: formData })
      setEchoMessage("")
      setUserName("")
      setUploadedImages([])
      setSubmitSuccess(true)
      setTimeout(() => setSubmitSuccess(false), 2000)
    } catch (err) {
      console.error("Submit failed:", err)
    } finally {
      setIsTransmitting(false)
    }
  }

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    if (uploadedImages.length + files.length > 5) {
      alert("Max 5 images")
      return
    }
    setUploadedImages([...uploadedImages, ...files])
  }

  const removeImage = (idx: number) => {
    setUploadedImages(uploadedImages.filter((_, i) => i !== idx))
  }

  const handlePromptPackClick = (product: Product) => {
    setSelectedPromptPack(product)
  }

  const runeSlots = [1, 2, 3].map(slotNum => {
    const rune = products.find(p => p.productType === 'rune' && p.slotPosition === slotNum)
    return rune ? { ...rune, isSlotActive: rune.isSlotActive } : { name: `Slot ${slotNum}`, imageUrl: '', isSlotActive: false, id: 0 }
  })

  const promptPackSlots = [1, 2, 3, 4].map(slotNum => {
    const pack = products.find(p => p.productType === 'promptPack' && p.slotPosition === slotNum)
    return pack ? { ...pack, isSlotActive: pack.isSlotActive } : { name: `Slot ${slotNum}`, imageUrl: '', isSlotActive: false, id: 0 }
  })

  // Check if current user is admin
  const isAdmin = user?.email === "dirtysecretai@gmail.com"

  // Show maintenance page to non-admins only
  if (adminState.isMaintenanceMode && !isAdmin) {
    return (
      <div className="min-h-screen bg-[#050810] flex items-center justify-center p-6">
        <div className="text-center p-12 rounded-2xl border-2 border-yellow-500/30 bg-yellow-500/5 backdrop-blur-sm max-w-md">
          <AlertTriangle className="mx-auto text-yellow-500 mb-4 animate-pulse" size={64} />
          <h1 className="text-2xl font-black text-yellow-400 mb-3">MAINTENANCE MODE</h1>
          <p className="text-slate-400 text-sm">The portal is temporarily offline. We'll be back soon!</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#050810] text-white relative overflow-hidden">
      {selectedPromptPack && (
        <PromptPackModal
          isOpen={true}
          packInfo={{
            id: selectedPromptPack.id,
            name: selectedPromptPack.name,
            price: selectedPromptPack.price
          }}
          onClose={() => setSelectedPromptPack(null)}
        />
      )}

      {/* BACKGROUND GRID */}
      <div className="fixed inset-0 bg-[linear-gradient(rgba(0,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(0,255,255,0.02)_1px,transparent_1px)] bg-[size:40px_40px] pointer-events-none" />
      
      {/* GLOW EFFECTS */}
      <div className="fixed top-20 left-20 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl animate-pulse" />
      <div className="fixed bottom-20 right-20 w-96 h-96 bg-fuchsia-500/10 rounded-full blur-3xl animate-pulse" />

      {/* MAIN LAYOUT */}
      <main className="relative z-10 flex items-start justify-center gap-4 p-4 min-h-screen">
        {/* LEFT CAROUSEL */}
        <aside className="hidden lg:block w-64 h-screen sticky top-0">
          <VerticalCarousel images={leftImages} side="left" />
        </aside>

        {/* CENTER CONTENT */}
        <div className="flex-1 max-w-2xl space-y-4">
          {/* HEADER */}
          <div className="text-center mb-6">
            <h1 className="text-5xl font-black mb-2 text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-fuchsia-500 tracking-tight">
              MULTIVERSE MOUSE
            </h1>
            <p className="text-slate-500 text-xs uppercase tracking-widest">Portal Access • Granted</p>
            
            {/* Auth buttons */}
            <div className="mt-4 flex items-center justify-center gap-3">
              {user ? (
                <>
                  <Link href="/dashboard">
                  {/* User email display */}
                  <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-900/50 border border-slate-800">
                    <svg className="w-4 h-4 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                    <span className="text-xs text-slate-300 font-medium max-w-[180px] truncate">{user.email}</span>
                  </div>

                    <Button className="bg-cyan-500 hover:bg-cyan-400 text-black font-bold text-xs px-4 h-7">
                      Dashboard
                    </Button>
                  </Link>
                  <Link href="/buy-tickets">
                    <Button className="bg-gradient-to-r from-fuchsia-500 to-pink-500 hover:from-fuchsia-400 hover:to-pink-400 text-white font-bold text-xs px-4 h-7">
                      Buy Tickets
                    </Button>
                  </Link>
                  <Button
                    onClick={async () => {
                      await fetch('/api/auth/logout', { method: 'POST' })
                      setUser(null)
                      router.push('/login')
                    }}
                    variant="outline"
                    className="border-slate-700 text-slate-300 hover:border-red-500 hover:text-red-400 text-xs px-4 h-7"
                  >
                    Logout
                  </Button>
                  <div className="text-xs text-slate-400">
                    <Ticket className="inline mr-1" size={12} />
                    {user.ticketBalance} tickets
                  </div>
                </>
              ) : (
                <>
                  <Link href="/login">
                    <Button variant="outline" className="border-slate-700 text-slate-300 hover:border-cyan-500 hover:text-cyan-400 text-xs px-4 h-7">
                      Login
                    </Button>
                  </Link>
                  <Link href="/signup">
                    <Button className="bg-gradient-to-r from-cyan-500 to-fuchsia-500 hover:from-cyan-400 hover:to-fuchsia-400 text-black font-bold text-xs px-4 h-7">
                      Sign Up
                    </Button>
                  </Link>
                </>
              )}
            </div>
          </div>

          {/* PATREON */}
          <div className="w-full mb-4">
            <a 
              href="https://www.patreon.com/DirtySecretAi" 
              target="_blank" 
              rel="noopener noreferrer"
              className="block relative group"
            >
              <div className="absolute -inset-0.5 bg-gradient-to-r from-cyan-500 to-fuchsia-500 rounded-xl blur-lg opacity-40 group-hover:opacity-60 transition-opacity" />
              <div className="relative p-4 rounded-xl border-2 border-cyan-400 bg-gradient-to-br from-cyan-500/10 to-fuchsia-500/10 backdrop-blur-sm">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-cyan-500 text-black">
                    <PatreonIcon />
                  </div>
                  <div className="flex-1">
                    <h2 className="text-lg font-black text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-fuchsia-500">JOIN PATREON</h2>
                    <p className="text-[10px] text-slate-400 uppercase">Exclusive • Early Access • Custom</p>
                  </div>
                  <ExternalLink className="w-5 h-5 text-cyan-400" />
                </div>
              </div>
            </a>
          </div>

          {/* MULTIVERSE SCANNER - NEW! */}
          {adminState.aiGenerationMaintenance ? (
            <MaintenanceIndicator label="MULTIVERSE_SCANNER" />
          ) : (
            <div id="scanner-section" className="w-full mb-4 p-6 rounded-xl border-2 border-cyan-500/30 bg-slate-900/80 backdrop-blur-sm">
              <div className="text-center mb-4">
                <div className="flex items-center justify-center gap-3 mb-2">
                  <Eye className="text-cyan-400" size={28} />
                  <h2 className="text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-fuchsia-500">
                    MULTIVERSE SCANNER
                  </h2>
                </div>
                <p className="text-slate-400 text-xs">Peek into infinite realities • One frame at a time</p>
              </div>

              {/* Coordinates Input */}
              <div className="mb-4">
                <label className="block text-xs font-bold text-cyan-400 mb-2 uppercase tracking-wider">
                  <Settings2 className="inline mr-1" size={12} />
                  Universe Coordinates
                </label>
                <textarea
                  value={coordinates}
                  onChange={(e) => setCoordinates(e.target.value)}
                  placeholder="Describe the universe you want to scan..."
                  className="w-full h-24 p-3 rounded-lg bg-slate-950 border-2 border-slate-700 focus:border-cyan-500 text-white placeholder:text-slate-600 focus:outline-none resize-none text-sm"
                  disabled={isGenerating}
                />
              </div>

              {/* Reference Images Upload - NEW! */}
              <div className="mb-4">
                <label className="block text-xs font-bold text-slate-400 mb-2 uppercase">
                  Reference Images (Optional)
                </label>
                <div className="space-y-2">
                  {/* Upload Button */}
                  <div className="flex gap-2">
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      onChange={async (e) => {
                        const files = e.target.files
                        if (!files) return
                        
                        const newImages: string[] = []
                        for (let i = 0; i < Math.min(files.length, 3); i++) {
                          const file = files[i]
                          const base64 = await new Promise<string>((resolve) => {
                            const reader = new FileReader()
                            reader.onload = () => resolve(reader.result as string)
                            reader.readAsDataURL(file)
                          })
                          newImages.push(base64)
                        }
                        setReferenceImages([...referenceImages, ...newImages].slice(0, 3))
                      }}
                      className="hidden"
                      id="reference-upload"
                      disabled={isGenerating}
                    />
                    <label
                      htmlFor="reference-upload"
                      className={`flex-1 p-3 border-2 border-dashed rounded-lg text-center cursor-pointer transition-all ${
                        referenceImages.length >= 3
                          ? 'border-slate-800 bg-slate-900/30 text-slate-600 cursor-not-allowed'
                          : 'border-slate-700 hover:border-cyan-500 bg-slate-900/50 text-slate-400 hover:text-cyan-400'
                      }`}
                    >
                      <Upload className="inline mr-2" size={16} />
                      {referenceImages.length >= 3 ? 'Max 3 images' : 'Upload Reference Images'}
                    </label>
                  </div>

                  {/* Preview Uploaded Images */}
                  {referenceImages.length > 0 && (
                    <div className="grid grid-cols-3 gap-2">
                      {referenceImages.map((img, idx) => (
                        <div key={idx} className="relative aspect-square rounded-lg overflow-hidden border border-slate-700">
                          <img src={img} alt={`Reference ${idx + 1}`} className="w-full h-full object-cover" />
                          <button
                            onClick={() => setReferenceImages(referenceImages.filter((_, i) => i !== idx))}
                            className="absolute top-1 right-1 bg-red-500 hover:bg-red-400 text-white rounded-full p-1"
                            type="button"
                          >
                            <X size={12} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                  
                  <p className="text-xs text-slate-600">
                    Upload up to 3 reference images to guide the generation
                  </p>
                </div>
              </div>

              {/* Model Selector */}
              <div className="mb-4">
                <label className="block text-xs font-bold text-slate-400 mb-2 uppercase">AI Model</label>
                <ModelSelector 
                  selectedModel={selectedModel}
                  onModelSelect={setSelectedModel}
                  userTickets={user?.ticketBalance || 0}
                />
              </div>

              {/* Scan Parameters */}
              <div className="grid grid-cols-2 gap-3 mb-4">
                {/* Quality */}
                <div>
                  <label className="block text-xs font-bold text-slate-400 mb-2 uppercase">Resolution</label>
                  <div className="grid grid-cols-2 gap-2">
                    {(['2k', '4k'] as const).map((q) => (
                      <button
                        key={q}
                        onClick={() => setQuality(q)}
                        disabled={isGenerating}
                        className={`p-2 rounded-lg font-bold uppercase text-xs transition-all ${
                          quality === q
                            ? 'bg-cyan-500 text-black'
                            : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                        }`}
                      >
                        {q}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Aspect Ratio */}
                <div>
                  <label className="block text-xs font-bold text-slate-400 mb-2 uppercase">Dimensions</label>
                  <div className="grid grid-cols-4 gap-1">
                    {(['1:1', '4:5', '9:16', '16:9'] as const).map((ratio) => (
                      <button
                        key={ratio}
                        onClick={() => setAspectRatio(ratio)}
                        disabled={isGenerating}
                        className={`p-2 rounded-lg font-bold text-xs transition-all ${
                          aspectRatio === ratio
                            ? 'bg-fuchsia-500 text-black'
                            : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                        }`}
                      >
                        {ratio === '1:1' ? 'Square' : ratio}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Error Message */}
              {generationError && (
                <div className="mb-4 p-3 rounded-lg border border-red-500/30 bg-red-500/10 text-red-400 text-xs">
                  {generationError}
                </div>
              )}

              {/* Scan Button */}
              <Button
                onClick={handleGenerate}
                disabled={isGenerating || !coordinates.trim()}
                className="w-full h-12 text-sm font-black bg-gradient-to-r from-cyan-500 to-fuchsia-500 hover:from-cyan-400 hover:to-fuchsia-400 text-black disabled:opacity-50"
              >
                {isGenerating ? (
                  <>
                    <Zap className="mr-2 animate-pulse" size={20} />
                    SCANNING UNIVERSE...
                  </>
                ) : (
                  <>
                    <Eye className="mr-2" size={20} />
                    SCAN UNIVERSE ({getTicketCost(selectedModel)} ticket{getTicketCost(selectedModel) > 1 ? 's' : ''})
                  </>
                )}
              </Button>

              {!user && (
                <p className="text-center text-xs text-slate-500 mt-3">
                  <Link href="/signup" className="text-cyan-400 hover:underline">Sign up</Link>
                  {' '}or{' '}
                  <Link href="/login" className="text-cyan-400 hover:underline">login</Link>
                  {' '}to start scanning
                </p>
              )}

              {user && user.ticketBalance === 0 && (
                <p className="text-center text-xs text-slate-500 mt-3">
                  No tickets remaining.{' '}
                  <Link href="/buy-tickets" className="text-cyan-400 hover:underline">Purchase more</Link>
                </p>
              )}

              {/* Generated Image Display */}
              {generatedImage && (
                <div className="mt-4 p-4 rounded-lg border border-cyan-500/30 bg-slate-950">
                  <p className="text-xs font-bold text-cyan-400 mb-2 uppercase">Universe Scan Complete</p>
                  <div 
                    className="relative aspect-video rounded-lg overflow-hidden bg-slate-900 mb-3 cursor-pointer hover:opacity-90 transition-opacity"
                    onClick={() => setShowImageModal(true)}
                  >
                    <img src={generatedImage} alt="Generated" className="w-full h-full object-contain" />
                  </div>
                  <div className="flex gap-2">
                    <a href={generatedImage} download className="flex-1">
                      <Button className="w-full bg-slate-800 hover:bg-slate-700 text-xs h-8">
                        Download
                      </Button>
                    </a>
                    <Button
                      onClick={() => {
                        localStorage.setItem('rescan_prompt', coordinates)
                        setGeneratedImage(null)
                        window.scrollTo({ 
                          top: document.getElementById('scanner-section')?.offsetTop || 0, 
                          behavior: 'smooth' 
                        })
                      }}
                      className="bg-fuchsia-500 hover:bg-fuchsia-400 text-white font-bold text-xs h-8 flex items-center gap-1"
                    >
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                      Rescan
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ECHO CHAMBER */}
          {adminState.echoChamberMaintenance ? (
            <MaintenanceIndicator label="ECHO_CHAMBER" />
          ) : (
            <div className="w-full bg-slate-900/30 p-4 rounded-xl border border-slate-800/50 backdrop-blur-sm mb-4">
              <div className="flex items-center gap-2 mb-3 text-cyan-400 font-mono text-xs"><Terminal size={12} /> echo_chamber.exe</div>
              {visibleName && (
                <Input value={userName} onChange={(e) => setUserName(e.target.value)} placeholder="Alias..." className="bg-slate-950 border-slate-800 mb-2 text-white placeholder-slate-600 h-8 text-sm" />
              )}
              <Textarea 
                value={echoMessage} 
                onChange={(e) => setEchoMessage(e.target.value)} 
                placeholder="Submit Request..." 
                className="bg-slate-950 border-slate-800 mb-2 resize-none min-h-[80px] text-white placeholder-slate-600 text-sm" 
              />
              
              <div className="mb-2">
                <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-500 hover:text-cyan-400 transition-colors">
                  <ImagePlus size={14} />
                  <span>Add reference images (max 5)</span>
                  <input 
                    type="file" 
                    multiple 
                    accept="image/*" 
                    onChange={handleImageUpload}
                    className="hidden"
                  />
                </label>
                {uploadedImages.length > 0 && (
                  <div className="flex gap-2 mt-2 flex-wrap">
                    {uploadedImages.map((img, idx) => (
                      <div key={idx} className="relative w-12 h-12 rounded border border-cyan-500/30 overflow-hidden group">
                        <img src={URL.createObjectURL(img)} alt={`upload-${idx}`} className="w-full h-full object-cover" />
                        <button 
                          onClick={() => removeImage(idx)}
                          className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
                        >
                          <X size={16} className="text-white" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2 text-[9px] text-slate-500 uppercase tracking-widest"><Switch checked={visibleName} onCheckedChange={setVisibleName} className="data-[state=checked]:bg-cyan-500 scale-75" /> NAME</div>
                <Button onClick={handleSubmit} disabled={isTransmitting || !echoMessage.trim()} className="bg-cyan-500 hover:bg-cyan-400 text-black font-bold px-6 h-8 text-xs">
                  {isTransmitting ? "..." : "SEND"}
                </Button>
              </div>
              {submitSuccess && <p className="mt-2 text-cyan-400 text-center text-[9px]">✓ RECEIVED</p>}
            </div>
          )}

          {/* SHOP SECTION - WITH OFFLINE INDICATOR */}
          {!adminState.isShopOpen ? (
            <ShopOfflineIndicator />
          ) : (
            <>
              {/* GALLERIES - ALWAYS VISIBLE WITH PLACEHOLDER */}
              {adminState.galleriesMaintenance ? (
                <MaintenanceIndicator label="GALLERIES" />
              ) : (
                <div className="w-full mb-4">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-sm font-black text-cyan-400">GALLERIES</h3>
                    <Link href="/galleries">
                      <Button className="bg-cyan-500 hover:bg-cyan-400 text-black font-bold text-[10px] px-3 h-6">
                        <Package className="mr-1" size={10} />VIEW ALL
                      </Button>
                    </Link>
                  </div>
                  
                  {/* Show galleries OR placeholder */}
                  {galleries.length > 0 ? (
                    <div className="grid grid-cols-4 gap-2">
                      {galleries.slice(0, 4).map(gallery => (
                        <MiniGalleryCard key={gallery.id} gallery={gallery} />
                      ))}
                    </div>
                  ) : (
                    <GalleriesEmptyPlaceholder />
                  )}
                </div>
              )}

              {/* PROMPT PACKS */}
              {adminState.promptPacksMaintenance ? (
                <MaintenanceIndicator label="PROMPT_PACKS" />
              ) : (
                <div className="w-full mb-4">
                  <p className="text-[9px] text-cyan-400 font-bold tracking-widest text-center mb-2">$8 PROMPT PACKS</p>
                  <div className="grid grid-cols-4 gap-2">
                    {promptPackSlots.map((slot: any, idx: number) => {
                      const product = products.find(p => p.id === slot.id)
                      return (
                        <div key={idx} onClick={() => product && slot.isSlotActive && handlePromptPackClick(product)}>
                          <PromptPackSlot slot={slot} isActive={slot.isSlotActive} />
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* COMMISSION RUNES */}
              {adminState.runesMaintenance ? (
                <MaintenanceIndicator label="COMMISSION_SLOTS" />
              ) : (
                <div className="w-full mb-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Crown className="text-fuchsia-400" size={16} />
                    <h3 className="text-sm font-black text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-fuchsia-500">
                      COMMISSION_SLOTS
                    </h3>
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    {runeSlots.map((slot: any, idx: number) => (
                      <RuneSlot key={idx} slot={slot} isActive={slot.isSlotActive} />
                    ))}
                  </div>
                </div>
              )}
            </>
          )}

          {/* INSTAGRAM */}
          <div className="w-full mb-4">
            <p className="text-[9px] text-slate-600 uppercase tracking-widest text-center mb-2">Follow</p>
            <div className="flex flex-wrap gap-2 justify-center">
              <SmallLinkBadge icon={<InstagramIcon />} label="@MOUSE" href="https://www.instagram.com/multiuniverseai" />
              <SmallLinkBadge icon={<InstagramIcon />} label="@SECRET" href="https://www.instagram.com/dsecretai" />
              <SmallLinkBadge icon={<InstagramIcon />} label="@ARCADIA" href="https://www.instagram.com/syntheticarcadia" />
            </div>
          </div>
        </div>

        {/* RIGHT CAROUSEL */}
        <aside className="hidden lg:block w-64 h-screen sticky top-0">
          <VerticalCarousel images={rightImages} side="right" />
        </aside>
      </main>

      {/* Image Preview Modal */}
      {showImageModal && generatedImage && (
        <div 
          className="fixed inset-0 bg-black/90 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={() => setShowImageModal(false)}
        >
          <div className="relative max-w-5xl w-full" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={() => setShowImageModal(false)}
              className="absolute -top-12 right-0 text-white hover:text-cyan-400 transition-colors"
            >
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
            
            <div className="bg-slate-900 rounded-2xl overflow-hidden border-2 border-cyan-500/30 max-h-[85vh] flex flex-col">
              {/* Image container with scroll */}
              <div className="overflow-y-auto max-h-[65vh]">
                <img 
                  src={generatedImage} 
                  alt="Generated" 
                  className="w-full h-auto object-contain"
                />
              </div>
              {/* Buttons always visible at bottom */}
              <div className="p-6 border-t border-slate-800">
                <p className="text-sm text-slate-300 mb-4">{coordinates}</p>
                <div className="flex gap-3">
                  <a
                    href={generatedImage}
                    download
                    className="flex-1 bg-cyan-500 hover:bg-cyan-400 text-black font-bold py-3 px-4 rounded-lg flex items-center justify-center gap-2"
                  >
                    <Download size={16} />
                    Download Full Size
                  </a>
                  <button
                    onClick={() => {
                      localStorage.setItem('rescan_prompt', coordinates)
                      setGeneratedImage(null)
                      setShowImageModal(false)
                      window.scrollTo({ 
                        top: document.getElementById('scanner-section')?.offsetTop || 0, 
                        behavior: 'smooth' 
                      })
                    }}
                    className="bg-fuchsia-500 hover:bg-fuchsia-400 text-white font-bold py-3 px-4 rounded-lg flex items-center justify-center gap-2"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    Rescan
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}



















































































