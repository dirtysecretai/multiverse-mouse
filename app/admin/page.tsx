"use client"

import { useState, useEffect, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { 
  Terminal, RefreshCw, Clock, Store, AlertTriangle, MessageSquare, Activity, Package, Plus, Trash2, Edit, Crown, Zap, Power, PowerOff, Wrench, Upload, Image as ImageIcon, X, Sparkles, Ticket, Tag
} from "lucide-react"
import { ImageCropper } from "@/components/image-cropper"

interface AdminState {
  isShopOpen: boolean
  isMaintenanceMode: boolean
  runesMaintenance: boolean
  echoChamberMaintenance: boolean
  galleriesMaintenance: boolean
  promptPacksMaintenance: boolean
  aiGenerationMaintenance: boolean
}

interface EchoMessage {
  id: number
  message: string
  visibleName: boolean
  name?: string
  createdAt: string
}

interface Product {
  id?: number
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

interface Gallery {
  id?: number
  title: string
  description: string
  coverImageUrl: string
  price: number
  isActive: boolean
  isFeatured: boolean
  loreIntro: string | null
  loreOutro: string | null
  accessType: string
  images: GalleryImage[]
}

interface GalleryImage {
  id?: number
  imageUrl: string
  caption: string | null
  sortOrder: number
}

export default function AdminPage() {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [password, setPassword] = useState("")
  const [isLoading, setIsLoading] = useState(true)
  const [adminState, setAdminState] = useState<AdminState>({
    isShopOpen: false,
    isMaintenanceMode: false,
    runesMaintenance: false,
    echoChamberMaintenance: false,
    galleriesMaintenance: false,
    promptPacksMaintenance: false,
    aiGenerationMaintenance: false,
  })
  const [echoMessages, setEchoMessages] = useState<EchoMessage[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [galleries, setGalleries] = useState<Gallery[]>([])
  
  // Gallery form state
  const [showGalleryForm, setShowGalleryForm] = useState(false)
  const [editingGallery, setEditingGallery] = useState<Gallery | null>(null)
  const [galleryForm, setGalleryForm] = useState<Gallery>({
    title: "",
    description: "",
    coverImageUrl: "",
    price: 0,
    isActive: true,
    isFeatured: false,
    loreIntro: "",
    loreOutro: "",
    accessType: "purchase",
    images: []
  })
  
  // Image cropper state (only for cover image)
  const [showCropper, setShowCropper] = useState(false)
  const [imageToCrop, setImageToCrop] = useState<string | null>(null)
  const [uploadingCover, setUploadingCover] = useState(false)
  const [uploadingImage, setUploadingImage] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [carousels, setCarousels] = useState<any[]>([])
  const [uploadingCarousel, setUploadingCarousel] = useState(false)
  const [carouselSide, setCarouselSide] = useState<string>("")
  const [discounts, setDiscounts] = useState<any[]>([])
  const [showDiscountForm, setShowDiscountForm] = useState(false)
  const [discountForm, setDiscountForm] = useState({
    code: '',
    type: 'percentage',
    value: '',
    usageLimit: '',
    expiresAt: ''
  })

  const [adminPassword, setAdminPassword] = useState("") // Store verified password in memory

  const fetchCloudData = useCallback(async () => {
    setIsLoading(true)
    try {
      const msgRes = await fetch('/api/echo')
      if (msgRes.ok) {
        const msgData = await msgRes.json()
        setEchoMessages(Array.isArray(msgData) ? msgData : [])
      }

      const configRes = await fetch('/api/admin/config')
      if (configRes.ok) {
        const configData = await configRes.json()
        setAdminState({
          isShopOpen: !!configData.isShopOpen,
          isMaintenanceMode: !!configData.isMaintenanceMode,
          runesMaintenance: !!configData.runesMaintenance,
          echoChamberMaintenance: !!configData.echoChamberMaintenance,
          galleriesMaintenance: !!configData.galleriesMaintenance,
          promptPacksMaintenance: !!configData.promptPacksMaintenance,
          aiGenerationMaintenance: !!configData.aiGenerationMaintenance,
        })
      }

      const productsRes = await fetch('/api/shop')
      if (productsRes.ok) {
        const productsData = await productsRes.json()
        setProducts(Array.isArray(productsData) ? productsData : [])
      }

      const galleriesRes = await fetch('/api/galleries')
      if (galleriesRes.ok) {
        const galleriesData = await galleriesRes.json()
        setGalleries(Array.isArray(galleriesData) ? galleriesData : [])
      }
    } catch (err) {
      console.error("Sync failed:", err)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    const authStatus = localStorage.getItem("multiverse-admin-auth")
    const savedPassword = sessionStorage.getItem("admin-password")
    
    if (authStatus === "true" && savedPassword) {
      setAdminPassword(savedPassword)
      setIsAuthenticated(true)
      fetchCloudData()
      // Pass password directly to avoid race condition with state
      fetchCarousels(savedPassword)
      fetchDiscounts(savedPassword)
      const interval = setInterval(fetchCloudData, 10000)
      return () => clearInterval(interval)
    } else {
      // Clear auth if password not in session
      localStorage.removeItem("multiverse-admin-auth")
    }
  }, [fetchCloudData])
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    
    try {
      const response = await fetch('/api/admin/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password })
      })
      
      if (response.ok) {
        setAdminPassword(password) // Store password in state for API calls
        sessionStorage.setItem("admin-password", password) // Store in session (clears on browser close)
        setIsAuthenticated(true)
        localStorage.setItem("multiverse-admin-auth", "true")
        fetchCloudData()
        // Pass password directly to fetch on login
        fetchCarousels(password)
        fetchDiscounts(password)
      } else {
        alert("❌ Invalid password")
      }
    } catch (error) {
      console.error("Auth error:", error)
      alert("❌ Authentication failed")
    }
  }
  }

  const fetchCarousels = async (pwd?: string) => {
    const passToUse = pwd || adminPassword
    if (!passToUse) return
    
    try {
      const res = await fetch(`/api/admin/carousels?password=${passToUse}`)
      if (res.ok) {
        const data = await res.json()
        setCarousels(data)
      }
    } catch (error) {
      console.error('Failed to fetch carousels:', error)
    }
  }

  const fetchDiscounts = async (pwd?: string) => {
    const passToUse = pwd || adminPassword
    if (!passToUse) return
    
    try {
      const res = await fetch(`/api/admin/discounts?password=${passToUse}`)
      if (res.ok) {
        const data = await res.json()
        setDiscounts(data)
      }
    } catch (error) {
      console.error('Failed to fetch discounts:', error)
    }
  }

  const updateAdminState = async (updates: Partial<AdminState>) => {
    const newState = { ...adminState, ...updates }
    setAdminState(newState)

    try {
      await fetch('/api/admin/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newState),
      })
    } catch (err) {
      console.error("Cloud sync failed:", err)
    }
  }

  const toggleSlotActivation = async (productId: number, currentState: boolean) => {
    try {
      const product = products.find(p => p.id === productId)
      if (!product) return

      const res = await fetch('/api/shop', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...product,
          isSlotActive: !currentState
        }),
      })

      if (res.ok) {
        fetchCloudData()
      }
    } catch (err) {
      console.error("Toggle failed:", err)
    }
  }

  const handleDeleteMessage = async (messageId: number) => {
    try {
      await fetch('/api/echo', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messageId }),
      })
      fetchCloudData()
    } catch (err) {
      console.error("Delete failed:", err)
    }
  }

  // COVER IMAGE UPLOAD WITH CROPPER
  const handleCoverUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Show cropper
    const reader = new FileReader()
    reader.onload = (event) => {
      setImageToCrop(event.target?.result as string)
      setShowCropper(true)
    }
    reader.readAsDataURL(file)
  }

  const handleCoverCropComplete = async (croppedImageUrl: string) => {
    setUploadingCover(true)
    setUploadError(null)
    setShowCropper(false)

    try {
      // Convert base64/URL to Blob
      const response = await fetch(croppedImageUrl)
      const blob = await response.blob()
      
      const formData = new FormData()
      formData.append('file', blob, 'cover.png')

      const res = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      })

      const data = await res.json()

      if (data.success) {
        setGalleryForm({...galleryForm, coverImageUrl: data.url})
      } else {
        setUploadError(data.error || 'Upload failed')
      }
    } catch (error) {
      console.error('Upload error:', error)
      setUploadError('Network error')
    } finally {
      setUploadingCover(false)
      setImageToCrop(null)
    }
  }

  // GALLERY IMAGE UPLOAD (DIRECT, NO CROPPER, MULTIPLE FILES)
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || files.length === 0) return

    setUploadingImage(true)
    setUploadError(null)

    try {
      const uploadPromises = Array.from(files).map(async (file) => {
        const formData = new FormData()
        formData.append('file', file)

        const res = await fetch('/api/upload', {
          method: 'POST',
          body: formData,
        })

        const data = await res.json()
        
        if (data.success) {
          return data.url
        } else {
          throw new Error(data.error || 'Upload failed')
        }
      })

      const uploadedUrls = await Promise.all(uploadPromises)

      const newImages = uploadedUrls.map((url, index) => ({
        imageUrl: url,
        caption: null,
        sortOrder: galleryForm.images.length + index
      }))

      setGalleryForm({
        ...galleryForm,
        images: [...galleryForm.images, ...newImages]
      })

    } catch (error: any) {
      console.error('Upload error:', error)
      setUploadError(error.message || 'Network error')
    } finally {
      setUploadingImage(false)
    }
  }

  const removeImage = (index: number) => {
    const newImages = galleryForm.images.filter((_, i) => i !== index)
    setGalleryForm({...galleryForm, images: newImages})
  }

  const handleGallerySubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    try {
      const method = editingGallery ? 'PUT' : 'POST'
      const res = await fetch('/api/galleries', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(galleryForm),
      })

      if (res.ok) {
        setShowGalleryForm(false)
        setEditingGallery(null)
        setGalleryForm({
          title: "",
          description: "",
          coverImageUrl: "",
          price: 0,
          isActive: true,
          isFeatured: false,
          loreIntro: "",
          loreOutro: "",
          accessType: "purchase",
          images: []
        })
        fetchCloudData()
      }
    } catch (err) {
      console.error("Gallery save failed:", err)
    }
  }

  const handleGalleryEdit = (gallery: Gallery) => {
    setEditingGallery(gallery)
    setGalleryForm(gallery)
    setShowGalleryForm(true)
  }

  const handleGalleryDelete = async (galleryId: number) => {
    if (!confirm("Delete this gallery?")) return

    try {
      await fetch('/api/galleries', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: galleryId }),
      })
      fetchCloudData()
    } catch (err) {
      console.error("Delete failed:", err)
    }
  }

  const featuredRunes = products.filter(p => p.productType === 'rune' && p.slotPosition)
  const promptPacks = products.filter(p => p.productType === 'promptPack' && p.slotPosition)

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-[#050810] flex items-center justify-center p-6">
        <div className="w-full max-w-md p-8 rounded-2xl border-2 border-cyan-500/30 bg-slate-900/80 backdrop-blur-sm">
          <div className="text-center mb-8">
            <Terminal className="mx-auto text-cyan-400 mb-4" size={48} />
            <h1 className="text-2xl font-black text-cyan-400">ADMIN_ACCESS</h1>
            <p className="text-sm text-slate-500 mt-2">Authorized personnel only</p>
          </div>
          <form onSubmit={handleLogin}>
            <Input
              type="password"
              placeholder="Enter password..."
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="bg-slate-950 border-slate-700 text-white mb-4"
            />
            <Button type="submit" className="w-full bg-cyan-500 hover:bg-cyan-400 text-black font-bold">
              AUTHENTICATE
            </Button>
          </form>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#050810] relative overflow-hidden">
      <div className="fixed inset-0 bg-[linear-gradient(rgba(0,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(0,255,255,0.02)_1px,transparent_1px)] bg-[size:40px_40px] pointer-events-none" />
      <div className="fixed top-20 left-20 w-96 h-96 bg-cyan-500/5 rounded-full blur-3xl" />
      <div className="fixed bottom-20 right-20 w-96 h-96 bg-fuchsia-500/5 rounded-full blur-3xl" />

      <div className="relative z-10 p-6 max-w-7xl mx-auto">
        {/* Image Cropper Modal */}
        {showCropper && imageToCrop && (
          <ImageCropper
            imageUrl={imageToCrop}
            onCropComplete={handleCoverCropComplete}
            onCancel={() => {
              setShowCropper(false)
              setImageToCrop(null)
            }}
          />
        )}

        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-fuchsia-500 flex items-center gap-3">
              <Terminal size={32} /> ADMIN_TERMINAL
            </h1>
            <p className="text-slate-500 text-sm mt-1">System control panel</p>
          </div>
          <Button onClick={fetchCloudData} disabled={isLoading} className="bg-cyan-500 hover:bg-cyan-400 text-black">
            <RefreshCw className={isLoading ? 'animate-spin' : ''} size={16} />
          </Button>
        </div>

        {/* Master Controls */}
        <div className="mb-8 grid grid-cols-2 gap-4">
          <div className={`p-6 rounded-xl border-2 ${adminState.isShopOpen ? 'border-green-500/50 bg-green-500/10' : 'border-slate-800 bg-slate-900/40'}`}>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Store size={24} className={adminState.isShopOpen ? 'text-green-400' : 'text-slate-600'} />
                <span className="font-bold text-white">SHOP_STATUS</span>
              </div>
              <Switch checked={adminState.isShopOpen} onCheckedChange={(checked) => updateAdminState({ isShopOpen: checked })} />
            </div>
            <p className="text-sm text-slate-400">{adminState.isShopOpen ? 'Shop is open' : 'Shop is closed'}</p>
          </div>

          <div className={`p-6 rounded-xl border-2 ${adminState.isMaintenanceMode ? 'border-yellow-500/50 bg-yellow-500/10' : 'border-slate-800 bg-slate-900/40'}`}>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <AlertTriangle size={24} className={adminState.isMaintenanceMode ? 'text-yellow-400' : 'text-slate-600'} />
                <span className="font-bold text-white">MAINTENANCE_MODE</span>
              </div>
              <Switch checked={adminState.isMaintenanceMode} onCheckedChange={(checked) => updateAdminState({ isMaintenanceMode: checked })} />
            </div>
            <p className="text-sm text-slate-400">{adminState.isMaintenanceMode ? 'Site locked' : 'All systems operational'}</p>
          </div>
        </div>

        {/* Maintenance Modes */}
        <div className="mb-8">
          <h2 className="text-xl font-bold text-cyan-400 mb-4 font-mono flex items-center gap-2">
            <Wrench size={20} /> MAINTENANCE_MODES
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* Runes */}
            <div className="p-4 rounded-xl bg-slate-900/60 backdrop-blur-sm border border-slate-800">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Crown className="text-cyan-400" size={20} />
                  <span className="font-mono text-sm text-slate-300">RUNES</span>
                </div>
                <button
                  onClick={() => updateAdminState({ runesMaintenance: !adminState.runesMaintenance })}
                  className={`relative w-12 h-6 rounded-full transition-all ${
                    adminState.runesMaintenance ? 'bg-red-500' : 'bg-green-500'
                  }`}
                >
                  <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${
                    adminState.runesMaintenance ? 'left-7' : 'left-1'
                  }`} />
                </button>
              </div>
              <div className="text-xs font-mono">
                <span className={adminState.runesMaintenance ? 'text-red-400' : 'text-green-400'}>
                  {adminState.runesMaintenance ? 'OFFLINE' : 'ONLINE'}
                </span>
              </div>
            </div>

            {/* Echo Chamber */}
            <div className="p-4 rounded-xl bg-slate-900/60 backdrop-blur-sm border border-slate-800">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <MessageSquare className="text-cyan-400" size={20} />
                  <span className="font-mono text-sm text-slate-300">ECHO_CHAMBER</span>
                </div>
                <button
                  onClick={() => updateAdminState({ echoChamberMaintenance: !adminState.echoChamberMaintenance })}
                  className={`relative w-12 h-6 rounded-full transition-all ${
                    adminState.echoChamberMaintenance ? 'bg-red-500' : 'bg-green-500'
                  }`}
                >
                  <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${
                    adminState.echoChamberMaintenance ? 'left-7' : 'left-1'
                  }`} />
                </button>
              </div>
              <div className="text-xs font-mono">
                <span className={adminState.echoChamberMaintenance ? 'text-red-400' : 'text-green-400'}>
                  {adminState.echoChamberMaintenance ? 'OFFLINE' : 'ONLINE'}
                </span>
              </div>
            </div>

            {/* Galleries */}
            <div className="p-4 rounded-xl bg-slate-900/60 backdrop-blur-sm border border-slate-800">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <ImageIcon className="text-cyan-400" size={20} />
                  <span className="font-mono text-sm text-slate-300">GALLERIES</span>
                </div>
                <button
                  onClick={() => updateAdminState({ galleriesMaintenance: !adminState.galleriesMaintenance })}
                  className={`relative w-12 h-6 rounded-full transition-all ${
                    adminState.galleriesMaintenance ? 'bg-red-500' : 'bg-green-500'
                  }`}
                >
                  <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${
                    adminState.galleriesMaintenance ? 'left-7' : 'left-1'
                  }`} />
                </button>
              </div>
              <div className="text-xs font-mono">
                <span className={adminState.galleriesMaintenance ? 'text-red-400' : 'text-green-400'}>
                  {adminState.galleriesMaintenance ? 'OFFLINE' : 'ONLINE'}
                </span>
              </div>
            </div>

            {/* Prompt Packs */}
            <div className="p-4 rounded-xl bg-slate-900/60 backdrop-blur-sm border border-slate-800">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Zap className="text-cyan-400" size={20} />
                  <span className="font-mono text-sm text-slate-300">PROMPT_PACKS</span>
                </div>
                <button
                  onClick={() => updateAdminState({ promptPacksMaintenance: !adminState.promptPacksMaintenance })}
                  className={`relative w-12 h-6 rounded-full transition-all ${
                    adminState.promptPacksMaintenance ? 'bg-red-500' : 'bg-green-500'
                  }`}
                >
                  <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${
                    adminState.promptPacksMaintenance ? 'left-7' : 'left-1'
                  }`} />
                </button>
              </div>
              <div className="text-xs font-mono">
                <span className={adminState.promptPacksMaintenance ? 'text-red-400' : 'text-green-400'}>
                  {adminState.promptPacksMaintenance ? 'OFFLINE' : 'ONLINE'}
                </span>
              </div>
            </div>

            {/* AI Generation Scanner - NEW! */}
            <div className="p-4 rounded-xl bg-slate-900/60 backdrop-blur-sm border border-slate-800">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Sparkles className="text-cyan-400" size={20} />
                  <span className="font-mono text-sm text-slate-300">AI_GENERATION</span>
                </div>
                <button
                  onClick={() => updateAdminState({ aiGenerationMaintenance: !adminState.aiGenerationMaintenance })}
                  className={`relative w-12 h-6 rounded-full transition-all ${
                    adminState.aiGenerationMaintenance ? 'bg-red-500' : 'bg-green-500'
                  }`}
                >
                  <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${
                    adminState.aiGenerationMaintenance ? 'left-7' : 'left-1'
                  }`} />
                </button>
              </div>
              <div className="text-xs font-mono">
                <span className={adminState.aiGenerationMaintenance ? 'text-red-400' : 'text-green-400'}>
                  {adminState.aiGenerationMaintenance ? 'OFFLINE' : 'ONLINE'}
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-1">
                Multiverse Scanner (homepage)
              </p>
            </div>
          </div>
        </div>



        {/* DISCOUNT CODE MANAGER - PROMOTIONS */}
        <div className="mb-12">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-cyan-400 flex items-center gap-2">
              <Tag size={20} /> PROMOTIONS_MANAGER
            </h2>
            <Button
              onClick={() => setShowDiscountForm(!showDiscountForm)}
              className="bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-400 hover:to-emerald-400 text-black font-bold"
            >
              {showDiscountForm ? 'Cancel' : '+ Create Discount Code'}
            </Button>
          </div>

          {/* Create Discount Form */}
          {showDiscountForm && (
            <div className="mb-6 p-6 rounded-xl border border-green-500/30 bg-slate-900/80 backdrop-blur-sm">
              <h3 className="text-lg font-bold text-green-400 mb-4">Create New Discount Code</h3>
              <form onSubmit={async (e) => {
                e.preventDefault()
                
                try {
                  const res = await fetch('/api/admin/discounts', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      password: adminPassword,
                      ...discountForm
                    })
                  })
                  
                  if (res.ok) {
                    alert('✅ Discount code created!')
                    setDiscountForm({
                      code: '',
                      type: 'percentage',
                      value: '',
                      usageLimit: '',
                      expiresAt: ''
                    })
                    setShowDiscountForm(false)
                    fetchDiscounts()
                  } else {
                    const error = await res.json()
                    alert('❌ Failed: ' + error.error)
                  }
                } catch (error) {
                  alert('❌ Failed to create discount code')
                }
              }} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  {/* Code Input */}
                  <div>
                    <label className="block text-xs font-bold text-green-400 mb-2">CODE</label>
                    <Input
                      value={discountForm.code}
                      onChange={(e) => setDiscountForm({...discountForm, code: e.target.value.toUpperCase()})}
                      placeholder="LAUNCH20"
                      required
                      className="bg-slate-950 border-slate-700 text-white uppercase"
                    />
                  </div>
                  
                  {/* Type Select */}
                  <div>
                    <label className="block text-xs font-bold text-green-400 mb-2">TYPE</label>
                    <Select 
                      value={discountForm.type}
                      onValueChange={(val) => setDiscountForm({...discountForm, type: val})}
                    >
                      <SelectTrigger className="bg-slate-950 border-slate-700 text-white">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="percentage">Percentage Off (%)</SelectItem>
                        <SelectItem value="fixed">Fixed Amount ($)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  {/* Value Input */}
                  <div>
                    <label className="block text-xs font-bold text-green-400 mb-2">
                      VALUE ({discountForm.type === 'percentage' ? '%' : '$'})
                    </label>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      value={discountForm.value}
                      onChange={(e) => setDiscountForm({...discountForm, value: e.target.value})}
                      placeholder={discountForm.type === 'percentage' ? '20' : '5.00'}
                      required
                      className="bg-slate-950 border-slate-700 text-white"
                    />
                  </div>
                  
                  {/* Usage Limit */}
                  <div>
                    <label className="block text-xs font-bold text-green-400 mb-2">
                      USAGE LIMIT (optional)
                    </label>
                    <Input
                      type="number"
                      min="1"
                      value={discountForm.usageLimit}
                      onChange={(e) => setDiscountForm({...discountForm, usageLimit: e.target.value})}
                      placeholder="Unlimited"
                      className="bg-slate-950 border-slate-700 text-white"
                    />
                  </div>
                  
                  {/* Expiration Date */}
                  <div className="col-span-2">
                    <label className="block text-xs font-bold text-green-400 mb-2">
                      EXPIRES AT (optional)
                    </label>
                    <Input
                      type="datetime-local"
                      value={discountForm.expiresAt}
                      onChange={(e) => setDiscountForm({...discountForm, expiresAt: e.target.value})}
                      className="bg-slate-950 border-slate-700 text-white"
                    />
                  </div>
                </div>
                
                <Button type="submit" className="w-full bg-green-500 hover:bg-green-400 text-black font-bold">
                  Create Discount Code
                </Button>
              </form>
            </div>
          )}

          {/* Discount Codes List */}
          <div className="space-y-3">
            {discounts.map((discount) => (
              <div key={discount.id} className="p-4 rounded-lg border border-slate-800 bg-slate-900/50 flex items-center justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-1">
                    <code className="text-lg font-bold text-green-400 bg-slate-950 px-3 py-1 rounded">
                      {discount.code}
                    </code>
                    {!discount.isActive && (
                      <span className="text-xs bg-red-500/20 text-red-400 px-2 py-1 rounded font-bold">
                        INACTIVE
                      </span>
                    )}
                    {discount.expiresAt && new Date(discount.expiresAt) < new Date() && (
                      <span className="text-xs bg-yellow-500/20 text-yellow-400 px-2 py-1 rounded font-bold">
                        EXPIRED
                      </span>
                    )}
                  </div>
                  <div className="text-sm text-slate-400 flex items-center gap-4 flex-wrap">
                    <span className="font-medium">
                      {discount.type === 'percentage' 
                        ? `${discount.value}% off` 
                        : `$${discount.value.toFixed(2)} off`}
                    </span>
                    <span>
                      Used: <span className="text-cyan-400 font-bold">{discount._count?.usedBy || 0}</span>
                      {discount.usageLimit && ` / ${discount.usageLimit}`}
                    </span>
                    {discount.expiresAt && (
                      <span>
                        Expires: {new Date(discount.expiresAt).toLocaleDateString()}
                      </span>
                    )}
                    <span className="text-xs text-slate-600">
                      Created: {new Date(discount.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                </div>
                <div className="flex gap-2 ml-4">
                  <Button
                    onClick={async () => {
                      await fetch('/api/admin/discounts', {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                          password: adminPassword,
                          id: discount.id,
                          isActive: !discount.isActive
                        })
                      })
                      fetchDiscounts()
                    }}
                    size="sm"
                    className={discount.isActive 
                      ? "bg-yellow-500 hover:bg-yellow-400 text-black font-bold"
                      : "bg-green-500 hover:bg-green-400 text-black font-bold"
                    }
                  >
                    {discount.isActive ? 'Deactivate' : 'Activate'}
                  </Button>
                  <Button
                    onClick={async () => {
                      if (confirm(`Delete discount code "${discount.code}"?`)) {
                        await fetch(`/api/admin/discounts?password=${adminPassword}&id=${discount.id}`, {
                          method: 'DELETE'
                        })
                        fetchDiscounts()
                      }
                    }}
                    size="sm"
                    className="bg-red-500 hover:bg-red-400 text-white font-bold"
                  >
                    Delete
                  </Button>
                </div>
              </div>
            ))}
            
            {discounts.length === 0 && (
              <div className="text-center py-12 text-slate-500 border border-slate-800 rounded-lg bg-slate-900/30">
                <Tag size={48} className="mx-auto mb-3 text-slate-700" />
                <p className="text-lg font-bold mb-1">No discount codes yet</p>
                <p className="text-sm">Create your first discount code to get started!</p>
              </div>
            )}
          </div>
        </div>

        {/* FREE TICKETS MANAGER - NEW! */}
        <div className="mb-12">
          <h2 className="text-xl font-bold text-fuchsia-400 mb-4 font-mono flex items-center gap-2">
            <Ticket size={20} /> FREE_TICKETS_MANAGER
          </h2>
          
          <div className="p-6 rounded-xl border border-fuchsia-500/30 bg-slate-900/80 backdrop-blur-sm">
            <form onSubmit={async (e) => {
              e.preventDefault()
              const formData = new FormData(e.currentTarget)
              const userEmail = formData.get('userEmail') as string
              const ticketsToAdd = parseInt(formData.get('ticketsToAdd') as string)
              const password = formData.get('adminPassword') as string
              
              if (!userEmail || !ticketsToAdd || ticketsToAdd < 1) {
                alert('Please fill in all fields')
                return
              }
              
              try {
                const res = await fetch('/api/admin/give-tickets', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ password, userEmail, ticketsToAdd }),
                })
                
                const data = await res.json()
                
                if (data.success) {
                  alert(`Success! Added ${ticketsToAdd} tickets to ${userEmail}. New balance: ${data.newBalance}`)
                  e.currentTarget.reset()
                } else {
                  alert('Error: ' + data.error)
                }
              } catch (error) {
                alert('Request failed')
              }
            }}>
              <div className="grid grid-cols-3 gap-4 mb-4">
                <div>
                  <label className="block text-xs font-bold text-cyan-400 mb-2">USER_EMAIL</label>
                  <Input
                    name="userEmail"
                    type="email"
                    placeholder="user@example.com"
                    className="bg-slate-950 border-slate-700 text-white"
                    required
                  />
                </div>
                
                <div>
                  <label className="block text-xs font-bold text-cyan-400 mb-2">TICKETS_TO_ADD</label>
                  <Input
                    name="ticketsToAdd"
                    type="number"
                    min="1"
                    placeholder="10"
                    className="bg-slate-950 border-slate-700 text-white"
                    required
                  />
                </div>
                
                <div>
                  <label className="block text-xs font-bold text-cyan-400 mb-2">ADMIN_PASSWORD</label>
                  <Input
                    name="adminPassword"
                    type="password"
                    placeholder="Enter admin password"
                    className="bg-slate-950 border-slate-700 text-white"
                    required
                  />
                </div>
              </div>
              
              <Button type="submit" className="w-full bg-gradient-to-r from-fuchsia-500 to-pink-500 hover:from-fuchsia-400 hover:to-pink-400 text-white font-bold">
                GRANT FREE TICKETS
              </Button>
            </form>
            
            <div className="mt-4 p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/30">
              <p className="text-xs text-yellow-400">
                ⚠️ This will add tickets to the user's account for free (no charge). Use for testing or promotions.
              </p>
            </div>
          </div>
        </div>

        {/* CAROUSEL MANAGEMENT - NEW! */}
        <div className="mb-12">
          <h2 className="text-xl font-bold text-cyan-400 mb-4 font-mono flex items-center gap-2">
            <ImageIcon size={20} /> CAROUSEL_MANAGER
          </h2>
          
          <div className="p-6 rounded-xl border border-cyan-500/30 bg-slate-900/80 backdrop-blur-sm">
            {/* Upload Form */}
            <form onSubmit={async (e) => {
              e.preventDefault()
              
              if (!carouselSide) {
                alert('Please select a carousel side')
                return
              }
              
              setUploadingCarousel(true)
              
              const formData = new FormData(e.currentTarget)
              formData.append('password', adminPassword)
              formData.set('side', carouselSide) // Use state value for Select
              
              try {
                const res = await fetch('/api/admin/carousels', {
                  method: 'POST',
                  body: formData
                })
                
                if (res.ok) {
                  alert('Carousel image uploaded!')
                  e.currentTarget.reset()
                  setCarouselSide("") // Reset select
                  fetchCarousels()
                } else {
                  const error = await res.json()
                  alert('Upload failed: ' + (error.error || 'Unknown error'))
                }
              } catch (error: any) {
                console.error('Upload error:', error)
                alert('Upload failed: ' + (error?.message || 'Unknown error'))
              } finally {
                setUploadingCarousel(false)
              }
            }} className="mb-6">
              <div className="grid grid-cols-3 gap-4 mb-4">
                <div>
                  <label className="block text-xs font-bold text-cyan-400 mb-2">IMAGE_FILE</label>
                  <Input
                    type="file"
                    name="image"
                    accept="image/*"
                    required
                    className="bg-slate-950 border-slate-700 text-white"
                  />
                </div>
                
                <div>
                  <label className="block text-xs font-bold text-cyan-400 mb-2">CAROUSEL_SIDE</label>
                  <Select value={carouselSide} onValueChange={setCarouselSide} required>
                    <SelectTrigger className="bg-slate-950 border-slate-700 text-white">
                      <SelectValue placeholder="Select side" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="left">Left Carousel</SelectItem>
                      <SelectItem value="right">Right Carousel</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div>
                  <label className="block text-xs font-bold text-cyan-400 mb-2">POSITION</label>
                  <Input
                    type="number"
                    name="position"
                    min="0"
                    defaultValue="0"
                    required
                    className="bg-slate-950 border-slate-700 text-white"
                  />
                </div>
              </div>
              
              <Button 
                type="submit" 
                disabled={uploadingCarousel}
                className="w-full bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-400 hover:to-blue-400 text-black font-bold"
              >
                {uploadingCarousel ? 'UPLOADING...' : 'UPLOAD CAROUSEL IMAGE'}
              </Button>
            </form>

            {/* Carousel List */}
            <div className="space-y-4">
              <h3 className="text-sm font-bold text-slate-400 uppercase">Current Carousel Images</h3>
              
              {/* Left Carousel */}
              <div>
                <p className="text-xs text-cyan-400 font-bold mb-2">LEFT CAROUSEL:</p>
                <div className="grid grid-cols-4 gap-2">
                  {carousels
                    .filter(c => c.side === 'left')
                    .sort((a, b) => a.position - b.position)
                    .map((carousel) => (
                      <div key={carousel.id} className="relative group">
                        <img 
                          src={carousel.imageUrl} 
                          alt={`Left ${carousel.position}`}
                          className="w-full aspect-square object-cover rounded-lg border border-slate-700"
                        />
                        <div className="absolute inset-0 bg-black/80 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg flex flex-col items-center justify-center gap-2 p-2">
                          <span className="text-xs text-cyan-400 font-bold">Position: {carousel.position}</span>
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              onClick={async () => {
                                const newPos = prompt('New position:', carousel.position)
                                if (newPos !== null) {
                                  await fetch('/api/admin/carousels', {
                                    method: 'PUT',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({
                                      password: adminPassword,
                                      id: carousel.id,
                                      position: parseInt(newPos)
                                    })
                                  })
                                  fetchCarousels()
                                }
                              }}
                              className="bg-yellow-500 hover:bg-yellow-400 text-black text-xs"
                            >
                              Edit
                            </Button>
                            <Button
                              size="sm"
                              onClick={async () => {
                                if (confirm('Delete this image?')) {
                                  await fetch(`/api/admin/carousels?password=${adminPassword}&id=${carousel.id}`, {
                                    method: 'DELETE'
                                  })
                                  fetchCarousels()
                                }
                              }}
                              className="bg-red-500 hover:bg-red-400 text-white text-xs"
                            >
                              Delete
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
                </div>
              </div>

              {/* Right Carousel */}
              <div>
                <p className="text-xs text-fuchsia-400 font-bold mb-2">RIGHT CAROUSEL:</p>
                <div className="grid grid-cols-4 gap-2">
                  {carousels
                    .filter(c => c.side === 'right')
                    .sort((a, b) => a.position - b.position)
                    .map((carousel) => (
                      <div key={carousel.id} className="relative group">
                        <img 
                          src={carousel.imageUrl} 
                          alt={`Right ${carousel.position}`}
                          className="w-full aspect-square object-cover rounded-lg border border-slate-700"
                        />
                        <div className="absolute inset-0 bg-black/80 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg flex flex-col items-center justify-center gap-2 p-2">
                          <span className="text-xs text-fuchsia-400 font-bold">Position: {carousel.position}</span>
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              onClick={async () => {
                                const newPos = prompt('New position:', carousel.position)
                                if (newPos !== null) {
                                  await fetch('/api/admin/carousels', {
                                    method: 'PUT',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({
                                      password: adminPassword,
                                      id: carousel.id,
                                      position: parseInt(newPos)
                                    })
                                  })
                                  fetchCarousels()
                                }
                              }}
                              className="bg-yellow-500 hover:bg-yellow-400 text-black text-xs"
                            >
                              Edit
                            </Button>
                            <Button
                              size="sm"
                              onClick={async () => {
                                if (confirm('Delete this image?')) {
                                  await fetch(`/api/admin/carousels?password=${adminPassword}&id=${carousel.id}`, {
                                    method: 'DELETE'
                                  })
                                  fetchCarousels()
                                }
                              }}
                              className="bg-red-500 hover:bg-red-400 text-white text-xs"
                            >
                              Delete
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            </div>

            <div className="mt-4 p-3 rounded-lg bg-blue-500/10 border border-blue-500/30">
              <p className="text-xs text-blue-400">
                💡 Upload images for the left and right carousels on the homepage. Position determines the order (0 = first).
              </p>
            </div>
          </div>
        </div>
        {/* Galleries Management */}
        <div className="mb-12">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-cyan-400 flex items-center gap-2">
              <ImageIcon size={20} /> GALLERIES_MANAGEMENT
            </h2>
            <Button 
              onClick={() => {
                setShowGalleryForm(true)
                setEditingGallery(null)
                setGalleryForm({
                  title: "",
                  description: "",
                  coverImageUrl: "",
                  price: 0,
                  isActive: true,
                  isFeatured: false,
                  loreIntro: "",
                  loreOutro: "",
                  accessType: "purchase",
                  images: []
                })
              }}
              className="bg-cyan-500 hover:bg-cyan-400 text-black font-bold"
            >
              <Plus size={16} className="mr-2" /> NEW GALLERY
            </Button>
          </div>

          {/* Gallery Form */}
          {showGalleryForm && (
            <form onSubmit={handleGallerySubmit} className="mb-6 p-6 rounded-xl border border-cyan-500/30 bg-slate-900/80">
              <h3 className="text-lg font-bold text-cyan-400 mb-4">
                {editingGallery ? "EDIT GALLERY" : "CREATE NEW GALLERY"}
              </h3>

              {/* Cover Image Upload */}
              <div className="mb-4">
                <label className="block text-xs font-bold text-cyan-400 mb-2">COVER_IMAGE (with cropper)</label>
                {galleryForm.coverImageUrl ? (
                  <div className="relative w-32 h-32">
                    <img src={galleryForm.coverImageUrl} alt="Cover" className="w-full h-full object-cover rounded-lg" />
                    <button
                      type="button"
                      onClick={() => setGalleryForm({...galleryForm, coverImageUrl: ""})}
                      className="absolute -top-2 -right-2 bg-red-500 rounded-full p-1"
                    >
                      <X size={12} />
                    </button>
                  </div>
                ) : (
                  <div>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleCoverUpload}
                      className="hidden"
                      id="cover-upload"
                      disabled={uploadingCover}
                    />
                    <label
                      htmlFor="cover-upload"
                      className="inline-flex items-center gap-2 px-4 py-2 bg-cyan-500 hover:bg-cyan-400 text-black font-bold rounded-lg cursor-pointer"
                    >
                      <Upload size={16} />
                      {uploadingCover ? 'UPLOADING...' : 'UPLOAD COVER'}
                    </label>
                  </div>
                )}
                {uploadError && <p className="text-xs text-red-400 mt-2">{uploadError}</p>}
              </div>

              {/* Gallery Images Upload */}
              <div className="mb-4">
                <label className="block text-xs font-bold text-cyan-400 mb-2">GALLERY_IMAGES (direct upload, multiple)</label>
                <div className="mb-3">
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={handleImageUpload}
                    className="hidden"
                    id="gallery-images-upload"
                    disabled={uploadingImage}
                  />
                  <label
                    htmlFor="gallery-images-upload"
                    className="inline-flex items-center gap-2 px-4 py-2 bg-fuchsia-500 hover:bg-fuchsia-400 text-black font-bold rounded-lg cursor-pointer"
                  >
                    <Upload size={16} />
                    {uploadingImage ? 'UPLOADING...' : 'UPLOAD MULTIPLE IMAGES'}
                  </label>
                </div>

                {/* Image Preview Grid */}
                {galleryForm.images.length > 0 && (
                  <div className="grid grid-cols-4 gap-2">
                    {galleryForm.images.map((img, index) => (
                      <div key={index} className="relative group">
                        <img src={img.imageUrl} alt="" className="w-full h-24 object-cover rounded-lg" />
                        <button
                          type="button"
                          onClick={() => removeImage(index)}
                          className="absolute -top-2 -right-2 bg-red-500 rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <X size={12} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Basic Info */}
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-xs font-bold text-cyan-400 mb-2">TITLE</label>
                  <Input
                    value={galleryForm.title}
                    onChange={(e) => setGalleryForm({...galleryForm, title: e.target.value})}
                    className="bg-slate-950 border-slate-700 text-white"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-cyan-400 mb-2">PRICE ($)</label>
                  <Input
                    type="number"
                    step="0.01"
                    value={galleryForm.price}
                    onChange={(e) => setGalleryForm({...galleryForm, price: parseFloat(e.target.value)})}
                    className="bg-slate-950 border-slate-700 text-white"
                  />
                </div>
              </div>

              {/* Description */}
              <div className="mb-4">
                <label className="block text-xs font-bold text-cyan-400 mb-2">DESCRIPTION</label>
                <Textarea
                  value={galleryForm.description}
                  onChange={(e) => setGalleryForm({...galleryForm, description: e.target.value})}
                  className="bg-slate-950 border-slate-700 text-white resize-none"
                  rows={3}
                  required
                />
              </div>

              {/* Lore */}
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-xs font-bold text-cyan-400 mb-2">LORE_INTRO (optional)</label>
                  <Textarea
                    placeholder="Story introduction..."
                    value={galleryForm.loreIntro || ""}
                    onChange={(e) => setGalleryForm({...galleryForm, loreIntro: e.target.value})}
                    className="bg-slate-950 border-slate-700 text-white resize-none text-sm"
                    rows={4}
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-cyan-400 mb-2">LORE_OUTRO (optional)</label>
                  <Textarea
                    placeholder="Story conclusion..."
                    value={galleryForm.loreOutro || ""}
                    onChange={(e) => setGalleryForm({...galleryForm, loreOutro: e.target.value})}
                    className="bg-slate-950 border-slate-700 text-white resize-none text-sm"
                    rows={4}
                  />
                </div>
              </div>

              {/* Settings */}
              <div className="grid grid-cols-3 gap-4">
                <Select value={galleryForm.accessType} onValueChange={(value) => setGalleryForm({...galleryForm, accessType: value})}>
                  <SelectTrigger className="bg-slate-950 border-slate-700 text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="free">Free Access</SelectItem>
                    <SelectItem value="purchase">Individual Purchase</SelectItem>
                    <SelectItem value="subscription">All-Access Tier</SelectItem>
                    <SelectItem value="patreon">Patreon Only</SelectItem>
                  </SelectContent>
                </Select>

                <div className="flex items-center gap-2 p-3 border border-slate-700 rounded-md bg-slate-950">
                  <Switch 
                    checked={galleryForm.isActive} 
                    onCheckedChange={(checked) => setGalleryForm({...galleryForm, isActive: checked})} 
                  />
                  <span className="text-xs text-white">ACTIVE</span>
                </div>

                <div className="flex items-center gap-2 p-3 border border-slate-700 rounded-md bg-slate-950">
                  <Switch 
                    checked={galleryForm.isFeatured} 
                    onCheckedChange={(checked) => setGalleryForm({...galleryForm, isFeatured: checked})} 
                  />
                  <span className="text-xs text-white">FEATURED</span>
                </div>
              </div>

              {/* Submit */}
              <div className="flex gap-2 justify-end mt-4">
                <Button type="button" onClick={() => setShowGalleryForm(false)} className="bg-slate-700 hover:bg-slate-600">
                  CANCEL
                </Button>
                <Button type="submit" className="bg-cyan-500 hover:bg-cyan-400 text-black">
                  {editingGallery ? "UPDATE" : "CREATE"}
                </Button>
              </div>
            </form>
          )}

          {/* Gallery List */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {galleries.map((gallery) => (
              <div key={gallery.id} className="p-4 rounded-xl border border-slate-800 bg-slate-900/60">
                <div className="aspect-video bg-slate-800 rounded-lg mb-3 overflow-hidden">
                  <img 
                    src={gallery.coverImageUrl} 
                    alt={gallery.title} 
                    className="w-full h-full object-cover"
                  />
                </div>
                <h3 className="font-bold text-sm mb-1 text-white">{gallery.title}</h3>
                <p className="text-xs text-slate-400 mb-2 line-clamp-2">{gallery.description}</p>
                <div className="flex items-center justify-between text-xs mb-3">
                  <span className="text-cyan-400 font-bold">${gallery.price}</span>
                  <span className="text-slate-500">{gallery.images?.length || 0} images</span>
                  <span className={gallery.isActive ? "text-green-500" : "text-red-500"}>
                    {gallery.isActive ? "ACTIVE" : "INACTIVE"}
                  </span>
                </div>
                {gallery.isFeatured && (
                  <div className="mb-3 px-2 py-1 bg-fuchsia-500/20 rounded text-[10px] text-fuchsia-400 text-center">
                    ⭐ FEATURED
                  </div>
                )}
                <div className="flex gap-2">
                  <Button 
                    onClick={() => handleGalleryEdit(gallery)}
                    className="flex-1 bg-slate-700 hover:bg-slate-600 text-xs h-8"
                  >
                    <Edit size={12} className="mr-1" /> EDIT
                  </Button>
                  <Button 
                    onClick={() => gallery.id && handleGalleryDelete(gallery.id)}
                    className="flex-1 bg-red-900/50 hover:bg-red-900/70 text-xs h-8"
                  >
                    <Trash2 size={12} className="mr-1" /> DELETE
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Slot Controls */}
        <div className="mb-12">
          <h2 className="text-lg font-bold flex items-center gap-2 text-fuchsia-400 mb-6">
            <Power size={20} /> SLOT_ACTIVATION_CONTROLS
          </h2>

          <div className="mb-8">
            <h3 className="text-sm font-bold text-cyan-400 mb-3 flex items-center gap-2">
              <Crown size={16} /> RUNE_SLOTS
            </h3>
            <div className="grid grid-cols-3 gap-4">
              {[1, 2, 3].map(slotNum => {
                const rune = featuredRunes.find(r => r.slotPosition === slotNum)
                return (
                  <div key={slotNum} className={`p-4 rounded-xl border ${rune?.isSlotActive ? 'border-cyan-400 bg-cyan-500/10' : 'border-slate-800 bg-slate-900/40'}`}>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-bold">{rune ? rune.name : `Slot ${slotNum}`}</span>
                      {rune?.isSlotActive ? <Power size={14} className="text-cyan-400" /> : <PowerOff size={14} className="text-slate-600" />}
                    </div>
                    {rune ? (
                      <Button
                        onClick={() => rune.id && toggleSlotActivation(rune.id, rune.isSlotActive)}
                        className={`w-full h-8 text-xs font-bold ${
                          rune.isSlotActive
                            ? 'bg-yellow-500/20 text-yellow-400'
                            : 'bg-cyan-500/20 text-cyan-400'
                        }`}
                      >
                        {rune.isSlotActive ? 'DEACTIVATE' : 'ACTIVATE'}
                      </Button>
                    ) : (
                      <p className="text-xs text-slate-600 text-center">Empty</p>
                    )}
                  </div>
                )
              })}
            </div>
          </div>

          <div>
            <h3 className="text-sm font-bold text-cyan-400 mb-3 flex items-center gap-2">
              <Zap size={16} /> PROMPT_PACKS
            </h3>
            <div className="grid grid-cols-4 gap-4">
              {[1, 2, 3, 4].map(slotNum => {
                const pack = promptPacks.find(p => p.slotPosition === slotNum)
                return (
                  <div key={slotNum} className={`p-4 rounded-xl border ${pack?.isSlotActive ? 'border-cyan-400 bg-cyan-500/10' : 'border-slate-800 bg-slate-900/40'}`}>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-bold">Slot {slotNum}</span>
                      {pack?.isSlotActive ? <Power size={12} className="text-cyan-400" /> : <PowerOff size={12} className="text-slate-600" />}
                    </div>
                    {pack ? (
                      <Button
                        onClick={() => pack.id && toggleSlotActivation(pack.id, pack.isSlotActive)}
                        className={`w-full h-7 text-[10px] font-bold ${
                          pack.isSlotActive
                            ? 'bg-yellow-500/20 text-yellow-400'
                            : 'bg-cyan-500/20 text-cyan-400'
                        }`}
                      >
                        {pack.isSlotActive ? 'OFF' : 'ON'}
                      </Button>
                    ) : (
                      <p className="text-[10px] text-slate-600 text-center">Empty</p>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        {/* Echo Messages */}
        <h2 className="text-lg font-bold mb-6 flex items-center gap-2 text-cyan-400">
          <Activity size={20} /> LIVE_ECHO_STREAM
        </h2>
        <div className="space-y-4">
          {echoMessages.slice(0, 10).map((msg) => (
            <div key={msg.id} className="p-4 rounded-xl border border-slate-800 bg-slate-900/60">
              <div className="flex justify-between text-xs mb-2">
                <span className="text-cyan-400 font-bold">{msg.name || "ANONYMOUS"}</span>
                <span className="text-slate-600 flex items-center gap-1"><Clock size={10} /> {new Date(msg.createdAt).toLocaleString()}</span>
              </div>
              <p className="text-sm text-slate-300">{msg.message}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}















































