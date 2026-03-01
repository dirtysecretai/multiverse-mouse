"use client"

import { useState, useEffect, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { AlertTriangle, ExternalLink, X, Wrench, Sparkles, Eye, Settings2, Zap, Ticket, Upload, Download, ChevronDown, Wand2, Lock } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { ModelSelector } from "@/components/ModelSelector"
import { MiniEchoChamber } from "@/components/MiniEchoChamber"
import { NotificationBanner } from "@/components/NotificationBanner"
import { SavedModelPicker } from "@/components/SavedModelPicker"
import { getTicketCost } from "@/config/ai-models.config"

// --- ICONS ---
const InstagramIcon = () => (
  <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
    <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
    <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
  </svg>
)

interface AdminState {
  isMaintenanceMode: boolean
  mainScannerMaintenance: boolean

  // OLD maintenance (kept for backward compatibility)
  nanoBananaMaintenance: boolean
  nanoBananaProMaintenance: boolean
  seedreamMaintenance: boolean

  // NEW per-scanner, per-model maintenance
  mainScanner_nanoBanana?: boolean
  mainScanner_nanoBananaPro?: boolean
  mainScanner_seedream?: boolean
  mainScanner_flux2?: boolean
  mainScanner_proScannerV3?: boolean
  mainScanner_flashScannerV25?: boolean
}

interface UserData {
  id: number
  email: string
  ticketBalance: number
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
}// --- HELPER FUNCTIONS ---
const getModelDisplayName = (model: string) => {
  const names: Record<string, string> = {
    'nano-banana-pro': 'NanoBanana Pro',
    'gemini-2.0-pro-exp': 'Pro Scanner v3',
    'nano-banana': 'NanoBanana Cluster',
    'seedream-4.5': 'SeeDream 4.5',
    'gemini-2.5-flash-image': 'Flash Scanner v2.5',
    'gemini-3-pro-image': 'Pro Scanner v3',
  }
  return names[model] || model
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


// --- MAIN COMPONENT ---
export default function MultiversePortalLegacy() {
  const router = useRouter()
  const [adminState, setAdminState] = useState<AdminState>({
    isMaintenanceMode: false,
    mainScannerMaintenance: false,
    nanoBananaMaintenance: false,
    nanoBananaProMaintenance: false,
    seedreamMaintenance: false,
    mainScanner_nanoBanana: false,
    mainScanner_nanoBananaPro: false,
    mainScanner_seedream: false,
    mainScanner_flux2: false,
    mainScanner_proScannerV3: false,
    mainScanner_flashScannerV25: false,
  })

  // User session state
  const [user, setUser] = useState<UserData | null>(null)
  const [sessionLoading, setSessionLoading] = useState(true)
  const [hasPromptStudioDev, setHasPromptStudioDev] = useState(false)

  // AI Scanner state
  const [coordinates, setCoordinates] = useState('')
  const [quality, setQuality] = useState<'2k' | '4k'>('2k')
  const [aspectRatio, setAspectRatio] = useState<'1:1' | '4:5' | '9:16' | '16:9'>('16:9')
  const [isGenerating, setIsGenerating] = useState(false)
  const [generationQueue, setGenerationQueue] = useState(0) // Track concurrent generations (max 3)
  const [generatedImage, setGeneratedImage] = useState<string | null>(null)
  const [generatedImages, setGeneratedImages] = useState<Array<{url: string, id: string}>>([])
  const [showImageModal, setShowImageModal] = useState(false)
  const [generationError, setGenerationError] = useState<string | null>(null)
  const [referenceImages, setReferenceImages] = useState<string[]>([])
  const [greyedOutImages, setGreyedOutImages] = useState<string[]>([])
  const [isLoadingModel, setIsLoadingModel] = useState(false)
  const [selectedModel, setSelectedModel] = useState('gemini-3-pro-image')

  // AI Prompt Generation (Dev Tier Only)
  const [names, setNames] = useState<string[]>(['', '', ''])
  const [enhancements, setEnhancements] = useState<string[]>(['', '', ''])
  const [promptModel, setPromptModel] = useState<'gemini-3-flash' | 'gemini-2.0-flash-exp' | 'gemini-3-pro' | 'gemini-exp-1206'>('gemini-3-flash')
  const [lastPromptGenTime, setLastPromptGenTime] = useState<Record<string, number>>({})
  const [promptCooldown, setPromptCooldown] = useState<number>(0)
  const [showPromptModelDropdown, setShowPromptModelDropdown] = useState(false)

  // Dynamic queue size based on subscription tier
  const MAX_QUEUE_SIZE = hasPromptStudioDev ? 3 : 1
  const MAX_FEED_SIZE = 50

  // Session feed - images generated in current session (newest first)
  interface SessionFeedItem {
    id: string
    url: string        // For images: image URL. For videos: thumbnail URL
    prompt: string
    model: string
    quality: '2k' | '4k'
    aspectRatio: string
    timestamp: number
    referenceImages: string[]  // Store reference images used for this generation
    loading?: boolean  // For loading placeholders
    isVideo?: boolean  // True for video items
    videoUrl?: string  // Actual video URL for video items
  }
  const [sessionFeed, setSessionFeed] = useState<SessionFeedItem[]>([])
  const [selectedFeedItem, setSelectedFeedItem] = useState<SessionFeedItem | null>(null)


  // Handle rescan from dashboard/my-images
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const rescanPrompt = localStorage.getItem('rescan_prompt')
      if (rescanPrompt) {
        setCoordinates(rescanPrompt)
        localStorage.removeItem('rescan_prompt')

        // Also load reference images if they exist
        const rescanRefImages = localStorage.getItem('rescan_reference_images')
        if (rescanRefImages) {
          try {
            const refUrls = JSON.parse(rescanRefImages)
            if (Array.isArray(refUrls) && refUrls.length > 0) {
              setReferenceImages(refUrls)
            }
          } catch (e) {
            console.error('Failed to parse rescan reference images:', e)
          }
          localStorage.removeItem('rescan_reference_images')
        }

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

  // Check user session
  const checkSession = useCallback(async () => {
    try {
      const res = await fetch('/api/auth/session', { cache: 'no-store' })
      const data = await res.json()
      if (data.authenticated) {
        setUser(data.user)

        // Fetch fresh ticket balance (session response may be browser-cached)
        const ticketRes = await fetch(`/api/user/tickets?userId=${data.user.id}`)
        const ticketData = await ticketRes.json()
        if (ticketData.success) {
          setUser(prev => prev ? { ...prev, ticketBalance: ticketData.balance } : prev)
        }

        // Fetch subscription status
        const subRes = await fetch('/api/user/subscription')
        const subData = await subRes.json()
        if (subData.success) {
          setHasPromptStudioDev(subData.hasPromptStudioDev)
        }

        // Fetch user's 50 most recent generated images
        const imagesRes = await fetch('/api/my-images?limit=50')
        const imagesData = await imagesRes.json()
        if (imagesData.success && imagesData.images) {
          // Convert database format to SessionFeedItem format
          const recentImages: SessionFeedItem[] = imagesData.images.map((img: any) => {
            const isVideo = img.model === 'wan-2.5' || !!(img.videoMetadata?.isVideo)
            return {
              id: img.id.toString(),
              // For videos, use the thumbnail (input image). For images, use the image URL.
              url: isVideo ? (img.videoMetadata?.thumbnailUrl || '') : img.imageUrl,
              prompt: img.prompt,
              model: img.model,
              quality: '2k' as '2k' | '4k',
              aspectRatio: '16:9',
              timestamp: new Date(img.createdAt).getTime(),
              referenceImages: img.referenceImageUrls || [],
              loading: false,
              isVideo,
              videoUrl: isVideo ? img.imageUrl : undefined,
            }
          })
          setSessionFeed(recentImages)
        }
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
          isMaintenanceMode: !!data.isMaintenanceMode,
          mainScannerMaintenance: !!data.mainScannerMaintenance || false,
          nanoBananaMaintenance: !!data.nanoBananaMaintenance || false,
          nanoBananaProMaintenance: !!data.nanoBananaProMaintenance || false,
          seedreamMaintenance: !!data.seedreamMaintenance || false,
          mainScanner_nanoBanana: !!data.mainScanner_nanoBanana || false,
          mainScanner_nanoBananaPro: !!data.mainScanner_nanoBananaPro || false,
          mainScanner_seedream: !!data.mainScanner_seedream || false,
          mainScanner_flux2: !!data.mainScanner_flux2 || false,
          mainScanner_proScannerV3: !!data.mainScanner_proScannerV3 || false,
          mainScanner_flashScannerV25: !!data.mainScanner_flashScannerV25 || false,
        })
      }
    } catch (err) {
      console.error("Config fetch failed:", err)
    }
  }, [])

  useEffect(() => {
    checkSession()
    fetchAdminConfig()
  }, [checkSession, fetchAdminConfig])

  // Refresh ticket balance when tab becomes visible, and poll every 15s for async webhook deductions
  useEffect(() => {
    if (!user?.id) return
    const refreshBalance = async () => {
      try {
        const res = await fetch(`/api/user/tickets?userId=${user.id}`)
        const data = await res.json()
        if (data.success) {
          setUser(prev => prev ? { ...prev, ticketBalance: data.balance } : prev)
        }
      } catch {}
    }
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') refreshBalance()
    }
    document.addEventListener('visibilitychange', handleVisibility)
    const interval = setInterval(refreshBalance, 15000)
    return () => {
      document.removeEventListener('visibilitychange', handleVisibility)
      clearInterval(interval)
    }
  }, [user?.id])

  // Auto-clear reference images if model doesn't support them (only Cluster)
  useEffect(() => {
    if (selectedModel === 'nano-banana' && referenceImages.length > 0) {
      setReferenceImages([])
    }
  }, [selectedModel, referenceImages.length])

  // Cooldown timer effect
  useEffect(() => {
    if (promptCooldown > 0) {
      const timer = setInterval(() => {
        setPromptCooldown(prev => Math.max(0, prev - 1))
      }, 1000)
      return () => clearInterval(timer)
    }
  }, [promptCooldown])

  // Auto-save session
  useEffect(() => {
    if (!user) return

    const saveTimer = setTimeout(() => {
      try {
        const sessionData = {
          coordinates,
          quality,
          aspectRatio,
          // referenceImages excluded — base64 strings are too large for localStorage
          selectedModel,
          sessionFeed: sessionFeed.filter(item => !item.loading), // Don't save loading placeholders
          names,
          enhancements,
          promptModel,
          timestamp: Date.now(),
        }
        localStorage.setItem('main-scanner-autosave', JSON.stringify(sessionData))
      } catch (err) {
        console.error('Failed to auto-save main scanner session:', err)
      }
    }, 1000)

    return () => clearTimeout(saveTimer)
  }, [user, coordinates, quality, aspectRatio, selectedModel, sessionFeed, names, enhancements, promptModel])

  // Auto-restore session on mount
  useEffect(() => {
    if (!user) return

    const restoreSession = async () => {
      try {
        const saved = localStorage.getItem('main-scanner-autosave')
        if (saved) {
          const sessionData = JSON.parse(saved)
          const hoursSinceLastSave = (Date.now() - (sessionData.timestamp || 0)) / (1000 * 60 * 60)

          if (hoursSinceLastSave < 24) {
            // Restore all saved state
            if (sessionData.coordinates !== undefined) setCoordinates(sessionData.coordinates)
            if (sessionData.quality) setQuality(sessionData.quality)
            if (sessionData.aspectRatio) setAspectRatio(sessionData.aspectRatio)
            // referenceImages not restored — base64 strings are too large for localStorage
            if (sessionData.selectedModel) setSelectedModel(sessionData.selectedModel)
            if (sessionData.names) setNames(sessionData.names)
            if (sessionData.enhancements) setEnhancements(sessionData.enhancements)
            if (sessionData.promptModel) setPromptModel(sessionData.promptModel)

            // Restore session feed and check for recently completed images
            const restoredImages = sessionData.sessionFeed || []
            const existingImageIds = new Set(restoredImages.map((img: any) => img.id))

            // Fetch recent images to find any completed during refresh (last 5 minutes)
            const fiveMinutesAgo = Date.now() - (5 * 60 * 1000)
            const res = await fetch('/api/my-images?limit=20')
            if (res.ok) {
              const data = await res.json()
              if (data.success && data.images) {
                const recentNewImages = data.images
                  .filter((img: any) => {
                    const imgTime = new Date(img.createdAt).getTime()
                    return imgTime >= fiveMinutesAgo && !existingImageIds.has(img.id.toString())
                  })
                  .map((img: any) => {
                    const isVideo = img.model === 'wan-2.5' || !!(img.videoMetadata?.isVideo)
                    return {
                      id: img.id.toString(),
                      url: isVideo ? (img.videoMetadata?.thumbnailUrl || '') : img.imageUrl,
                      prompt: img.prompt,
                      model: img.model,
                      quality: '2k' as '2k' | '4k',
                      aspectRatio: '16:9',
                      timestamp: new Date(img.createdAt).getTime(),
                      referenceImages: img.referenceImageUrls || [],
                      loading: false,
                      isVideo,
                      videoUrl: isVideo ? img.imageUrl : undefined,
                    }
                  })

                // Combine new images with restored images (new first)
                const combinedImages = [...recentNewImages, ...restoredImages].slice(0, MAX_FEED_SIZE)
                setSessionFeed(combinedImages)
              } else {
                setSessionFeed(restoredImages)
              }
            } else {
              setSessionFeed(restoredImages)
            }
          }
        }
      } catch (err) {
        console.error('Failed to restore main scanner session:', err)
      }
    }

    restoreSession()
  }, [user])

  // AI Prompt Generation (Dev Tier Only)
  const handleGeneratePrompt = async () => {
    // Check cooldown for restricted models
    if (promptModel !== 'gemini-3-flash') {
      const lastUse = lastPromptGenTime[promptModel] || 0
      const timeSince = (Date.now() - lastUse) / 1000
      const cooldownSeconds = 10

      if (timeSince < cooldownSeconds) {
        const remaining = Math.ceil(cooldownSeconds - timeSince)
        setPromptCooldown(remaining)
        return
      }
    }

    const combinedNames = names.filter(n => n.trim()).join(', ')
    const combinedEnhancements = enhancements.filter(e => e.trim()).join(', ')
    const name = combinedNames || 'a person'
    const style = combinedEnhancements || 'photorealistic portrait'

    try {
      const res = await fetch('/api/prompting-studio/generate-single', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          celebrity: name,
          baseStyle: style,
          model: selectedModel,
          promptModel: promptModel,
        })
      })

      const data = await res.json()
      if (data.success && data.prompt) {
        setCoordinates(data.prompt)

        // Update last use time for restricted models
        if (promptModel !== 'gemini-3-flash') {
          setLastPromptGenTime(prev => ({ ...prev, [promptModel]: Date.now() }))
        }
      } else {
        alert('Failed to generate prompt')
      }
    } catch (err) {
      console.error('Prompt generation error:', err)
      alert('Failed to generate prompt')
    }
  }

  // Load a saved custom model's reference images into the scanner (appends to existing)
  const handleLoadSavedModel = async (model: { referenceImageUrls: string[] }) => {
    setIsLoadingModel(true)
    try {
      const base64Images = await Promise.all(
        model.referenceImageUrls.map(url =>
          fetch(url)
            .then(r => r.blob())
            .then(blob => new Promise<string>((resolve, reject) => {
              const reader = new FileReader()
              reader.onload = () => resolve(reader.result as string)
              reader.onerror = reject
              reader.readAsDataURL(blob)
            }))
        )
      )
      const combined = [...referenceImages, ...base64Images]
      setReferenceImages(combined.slice(0, 8))
      setGreyedOutImages(combined.slice(8))
    } catch (err) {
      console.error('Failed to load model images:', err)
    } finally {
      setIsLoadingModel(false)
    }
  }

  // AI Generation handler
  const handleGenerate = async () => {
    if (!user) {
      router.push('/login')
      return
    }

    // Check if selected model is in maintenance
    const modelInMaintenance = (() => {
      // Check NEW per-scanner, per-model maintenance first
      if (selectedModel === 'nano-banana' && adminState.mainScanner_nanoBanana) return true
      if (selectedModel === 'nano-banana-pro' && adminState.mainScanner_nanoBananaPro) return true
      if (selectedModel === 'seedream-4.5' && adminState.mainScanner_seedream) return true
      if (selectedModel === 'flux-2' && adminState.mainScanner_flux2) return true
      if (selectedModel === 'gemini-3-pro-image' && adminState.mainScanner_proScannerV3) return true
      if (selectedModel === 'gemini-2.5-flash-image' && adminState.mainScanner_flashScannerV25) return true

      // Fallback to OLD maintenance fields
      if (selectedModel === 'nano-banana-pro' && adminState.nanoBananaProMaintenance) return true
      if (selectedModel === 'nano-banana' && adminState.nanoBananaMaintenance) return true
      if (selectedModel === 'seedream-4.5' && adminState.seedreamMaintenance) return true

      return false
    })()

    if (modelInMaintenance) {
      setGenerationError('This model is currently under maintenance. Please select a different model.')
      return
    }

    if (!coordinates.trim()) {
      setGenerationError('Please enter universe coordinates')
      return
    }

    // Check queue limit
    if (generationQueue >= MAX_QUEUE_SIZE) {
      setGenerationError(`Generation queue full (max ${MAX_QUEUE_SIZE}). Please wait for current scans to complete.`)
      return
    }

    // Get ticket cost for selected model (quality-aware for NanoBanana Pro)
    const ticketCost = getTicketCost(selectedModel, quality)

    if (user.ticketBalance < ticketCost) {
      setGenerationError(`Insufficient tickets. Need ${ticketCost} ticket(s) for this model. Purchase more to continue scanning.`)
      return
    }

    setIsGenerating(true)
    setGenerationQueue(prev => prev + 1) // Add to queue
    setGenerationError(null)
    setGeneratedImage(null)
    setGeneratedImages([])

    // Create loading placeholder ID
    const loadingId = `loading-${Date.now()}`
    // Flag set to true when a FAL async job is submitted — prevents the finally
    // block from resetting state immediately (the polling loop owns cleanup instead).
    let isQueuedAsync = false

    // Add loading placeholder to session feed
    setSessionFeed(prev => [{
      id: loadingId,
      url: '',
      prompt: coordinates,
      model: selectedModel,
      quality,
      aspectRatio,
      timestamp: Date.now(),
      referenceImages: [...referenceImages],
      loading: true
    }, ...prev].slice(0, MAX_FEED_SIZE))

    try {
      // Prepare request body
      const requestBody: any = {
        prompt: coordinates,
        quality,
        aspectRatio,
        referenceImages,
        model: selectedModel,
      }

      // Add names and enhancements if dev tier and provided
      if (hasPromptStudioDev) {
        const combinedNames = names.filter(n => n.trim()).join(', ')
        const combinedEnhancements = enhancements.filter(e => e.trim()).join(', ')

        if (combinedNames) {
          requestBody.celebrityName = combinedNames
        }
        if (combinedEnhancements) {
          requestBody.enhancement = combinedEnhancements
        }
      }

      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      })

      const data = await res.json()

      if (data.success) {
        if (data.queued && data.queueId) {
          // ── FAL async job submitted ──────────────────────────────────────
          // The image will arrive via webhook in ~15-30s. Update the balance
          // immediately (reservation already made) then poll the jobs endpoint
          // every 3s until the webhook settles the job.
          isQueuedAsync = true
          if (user) setUser(prev => prev ? { ...prev, ticketBalance: data.newBalance } : prev)

          let pollAttempts = 0
          const pollInterval = setInterval(async () => {
            pollAttempts++
            // 40 attempts × 3s = 2 min max — after that, give up gracefully
            if (pollAttempts > 40) {
              clearInterval(pollInterval)
              setSessionFeed(prev => prev.filter(item => item.id !== loadingId))
              setGenerationError('Generation timed out. Please try again.')
              setIsGenerating(false)
              setGenerationQueue(prev => Math.max(0, prev - 1))
              return
            }
            try {
              const jobRes = await fetch('/api/prompting-studio/jobs')
              const jobData = await jobRes.json()
              const job = jobData.jobs?.find((j: any) => j.id === data.queueId)
              if (job?.status === 'completed' && job.resultUrl) {
                clearInterval(pollInterval)
                setGeneratedImage(job.resultUrl)
                setSessionFeed(prev => [{
                  id: `${Date.now()}`,
                  url: job.resultUrl,
                  prompt: coordinates,
                  model: selectedModel,
                  quality,
                  aspectRatio,
                  timestamp: Date.now(),
                  referenceImages: [...referenceImages]
                }, ...prev.filter(item => item.id !== loadingId)].slice(0, MAX_FEED_SIZE))
                // Refresh balance — webhook just deducted the tickets
                const ticketRes = await fetch(`/api/user/tickets?userId=${user!.id}`)
                const ticketData = await ticketRes.json()
                if (ticketData.success) setUser(prev => prev ? { ...prev, ticketBalance: ticketData.balance } : prev)
                setIsGenerating(false)
                setGenerationQueue(prev => Math.max(0, prev - 1))
              } else if (job?.status === 'failed') {
                clearInterval(pollInterval)
                setSessionFeed(prev => prev.filter(item => item.id !== loadingId))
                setGenerationError(job.errorMessage || 'Universe scan failed. Please try again.')
                setIsGenerating(false)
                setGenerationQueue(prev => Math.max(0, prev - 1))
              }
            } catch { /* ignore transient poll errors */ }
          }, 3000)

        // Check if multi-image response (NanoBanana Cluster returns 2 images)
        } else if (data.images && data.images.length > 1) {
          setGeneratedImages(data.images)
          setGeneratedImage(data.images[0].url) // Set first image for modal

          // Replace loading placeholder with actual images
          const newFeedItems = data.images.map((img: {url: string, id: string}, idx: number) => ({
            id: `${Date.now()}-${idx}`,
            url: img.url,
            prompt: coordinates,
            model: selectedModel,
            quality,
            aspectRatio,
            timestamp: Date.now(),
            referenceImages: [...referenceImages]
          }))
          setSessionFeed(prev => [...newFeedItems, ...prev.filter(item => item.id !== loadingId)].slice(0, MAX_FEED_SIZE))
        } else {
          setGeneratedImage(data.imageUrl)
          setGeneratedImages([]) // Clear multi-image array

          // Replace loading placeholder with actual image
          setSessionFeed(prev => [{
            id: `${Date.now()}`,
            url: data.imageUrl,
            prompt: coordinates,
            model: selectedModel,
            quality,
            aspectRatio,
            timestamp: Date.now(),
            referenceImages: [...referenceImages]
          }, ...prev.filter(item => item.id !== loadingId)].slice(0, MAX_FEED_SIZE))
        }

        // Update user ticket balance
        if (user) {
          setUser({ ...user, ticketBalance: data.newBalance })
        }
      } else {
        // Remove loading placeholder on error
        setSessionFeed(prev => prev.filter(item => item.id !== loadingId))
        setGenerationError(data.error || 'Universe scan failed. Please try again.')
      }
    } catch (err: any) {
      console.error('Generation error:', err)
      // Remove loading placeholder on error
      setSessionFeed(prev => prev.filter(item => item.id !== loadingId))
      setGenerationError('Network error. Please try again.')
    } finally {
      // Skip if an async FAL job is polling — that interval owns state cleanup
      if (!isQueuedAsync) {
        setIsGenerating(false)
        setGenerationQueue(prev => Math.max(0, prev - 1)) // Remove from queue
      }
    }
  }

  // Check if current user is admin
  const isAdmin = user?.email === "dirtysecretai@gmail.com"

  // Show maintenance page to non-admins if global maintenance OR scanner-specific maintenance is enabled
  if ((adminState.isMaintenanceMode || adminState.mainScannerMaintenance) && !isAdmin) {
    return (
      <div className="min-h-screen bg-[#050810] flex items-center justify-center p-6">
        <div className="text-center p-12 rounded-2xl border-2 border-yellow-500/30 bg-yellow-500/5 backdrop-blur-sm max-w-md">
          <AlertTriangle className="mx-auto text-yellow-500 mb-4 animate-pulse" size={64} />
          <h1 className="text-2xl font-black text-yellow-400 mb-3">MAINTENANCE MODE</h1>
          <p className="text-slate-400 text-sm">
            {adminState.isMaintenanceMode
              ? 'AI Design Studio is temporarily offline for maintenance. We\'ll be back soon!'
              : 'The Reality Scanner is temporarily offline for maintenance. Please try another scanner.'}
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#050810] text-white relative overflow-hidden">
      {/* BACKGROUND GRID */}
      <div className="fixed inset-0 bg-[linear-gradient(rgba(0,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(0,255,255,0.02)_1px,transparent_1px)] bg-[size:40px_40px] pointer-events-none" />
      
      {/* GLOW EFFECTS */}
      <div className="fixed top-20 left-20 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl animate-pulse" />
      <div className="fixed bottom-20 right-20 w-96 h-96 bg-fuchsia-500/10 rounded-full blur-3xl animate-pulse" />

      {/* MAIN LAYOUT - 3 Column */}
      <main className="relative z-10 flex items-start justify-center gap-4 p-4 min-h-screen">
        {/* LEFT SIDEBAR - Notifications & Prompt Studio */}
        <aside className="hidden xl:block w-72 2xl:w-80 sticky top-4 space-y-4">
          {/* Notifications */}
          <NotificationBanner />

          {/* Prompt Studio Section */}
          {!hasPromptStudioDev ? (
            // FREE TIER - Sales Pitch
            <div className="rounded-xl border-2 border-purple-500/40 bg-gradient-to-br from-purple-500/10 to-cyan-500/10 backdrop-blur-sm overflow-hidden shadow-[0_0_30px_rgba(168,85,247,0.15)]">
              <div className="p-5">
                {/* Header */}
                <div className="text-center mb-4">
                  <div className="inline-flex p-3 rounded-xl bg-gradient-to-br from-purple-500 to-cyan-500 mb-3 shadow-lg shadow-purple-500/30">
                    <svg className="w-8 h-8 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M10 2v7.527a2 2 0 0 1-.211.896L4.72 20.55a1 1 0 0 0 .9 1.45h12.76a1 1 0 0 0 .9-1.45l-5.069-10.127A2 2 0 0 1 14 9.527V2"></path>
                      <path d="M8.5 2h7"></path>
                      <path d="M7 16h10"></path>
                    </svg>
                  </div>
                  <h3 className="text-lg font-black text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-cyan-400 mb-1">
                    DEV TIER
                  </h3>
                  <p className="text-xs text-purple-400 font-bold">Save up to 37% on every generation</p>
                </div>

                {/* Stat Blocks */}
                <div className="grid grid-cols-3 gap-2 mb-4">
                  <div className="text-center p-2 rounded-lg bg-purple-500/10 border border-purple-500/20">
                    <p className="text-sm font-black text-purple-400">37%</p>
                    <p className="text-[9px] text-slate-500 leading-tight">off tickets</p>
                  </div>
                  <div className="text-center p-2 rounded-lg bg-cyan-500/10 border border-cyan-500/20">
                    <p className="text-sm font-black text-cyan-400">6×</p>
                    <p className="text-[9px] text-slate-500 leading-tight">concurrent</p>
                  </div>
                  <div className="text-center p-2 rounded-lg bg-fuchsia-500/10 border border-fuchsia-500/20">
                    <p className="text-sm font-black text-fuchsia-400">500</p>
                    <p className="text-[9px] text-slate-500 leading-tight">tickets/mo</p>
                  </div>
                </div>

                {/* Benefits */}
                <div className="space-y-2.5 mb-5">
                  <div className="flex items-start gap-3">
                    <div className="w-5 h-5 rounded-full bg-gradient-to-br from-purple-500 to-cyan-500 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <Zap size={10} className="text-white" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-slate-300">Discounted Ticket Prices</p>
                      <p className="text-[10px] text-slate-500">Pay 30–37% fewer tickets per generation</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="w-5 h-5 rounded-full bg-gradient-to-br from-cyan-500 to-purple-500 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <Sparkles size={10} className="text-white" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-slate-300">6 Concurrent Generations</p>
                      <p className="text-[10px] text-slate-500">3× more than the free tier (2 concurrent)</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="w-5 h-5 rounded-full bg-gradient-to-br from-fuchsia-500 to-cyan-500 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <svg className="w-3 h-3 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                        <rect x="3" y="3" width="18" height="18" rx="2" />
                      </svg>
                    </div>
                    <div>
                      <p className="text-xs font-bold text-slate-300">Monthly Tickets Auto-Delivered</p>
                      <p className="text-[10px] text-slate-500">Up to 500 tickets every month</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="w-5 h-5 rounded-full bg-gradient-to-br from-purple-500 to-fuchsia-500 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <svg className="w-3 h-3 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                        <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
                      </svg>
                    </div>
                    <div>
                      <p className="text-xs font-bold text-slate-300">AI Design Studio Access</p>
                      <p className="text-[10px] text-slate-500">Canvas, composition tools & more</p>
                    </div>
                  </div>
                </div>

                {/* CTA Button - Bigger */}
                <Link href="/prompting-studio/upgrade">
                  <Button className="w-full bg-gradient-to-r from-purple-600 to-cyan-600 hover:from-purple-500 hover:to-cyan-500 text-white font-black text-sm h-12 shadow-lg shadow-purple-500/30 hover:shadow-purple-500/50 transition-all">
                    <Sparkles size={18} className="mr-2" />
                    Upgrade to Dev Tier
                  </Button>
                </Link>

                {/* Secondary CTA */}
                <Link href="/prompting-studio">
                  <button className="w-full mt-3 py-2 px-4 rounded-lg border border-slate-700 hover:border-purple-500/50 text-xs text-slate-400 hover:text-purple-400 transition-colors font-medium">
                    Explore Free Features →
                  </button>
                </Link>
              </div>
            </div>
          ) : (
            // DEV TIER - Clean Badge with Tips
            <div className="rounded-xl border-2 border-purple-500/50 bg-gradient-to-br from-purple-500/10 to-cyan-500/10 backdrop-blur-sm overflow-hidden">
              <div className="p-4">
                {/* Dev Tier Badge */}
                <div className="text-center mb-4">
                  <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r from-purple-600 to-cyan-600 mb-2 shadow-lg shadow-purple-500/30">
                    <svg className="w-4 h-4 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M10 2v7.527a2 2 0 0 1-.211.896L4.72 20.55a1 1 0 0 0 .9 1.45h12.76a1 1 0 0 0 .9-1.45l-5.069-10.127A2 2 0 0 1 14 9.527V2"></path>
                      <path d="M8.5 2h7"></path>
                      <path d="M7 16h10"></path>
                    </svg>
                    <span className="text-xs font-black text-white">DEV TIER</span>
                  </div>
                  <p className="text-[10px] text-slate-500">All perks active</p>
                </div>

                {/* Active Perks */}
                <div className="space-y-2 mb-3">
                  <p className="text-[10px] text-purple-400 font-bold uppercase tracking-wider">Your Benefits:</p>
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2 text-[10px] text-slate-400">
                      <Zap size={12} className="text-purple-400 flex-shrink-0" />
                      <span>30–37% off every ticket</span>
                    </div>
                    <div className="flex items-center gap-2 text-[10px] text-slate-400">
                      <Sparkles size={12} className="text-cyan-400 flex-shrink-0" />
                      <span>6 concurrent generations</span>
                    </div>
                    <div className="flex items-center gap-2 text-[10px] text-slate-400">
                      <svg className="w-3 h-3 text-fuchsia-400 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <rect x="3" y="3" width="18" height="18" rx="2" />
                      </svg>
                      <span>Up to 500 tickets/month delivered</span>
                    </div>
                    <div className="flex items-center gap-2 text-[10px] text-slate-400">
                      <svg className="w-3 h-3 text-purple-400 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
                      </svg>
                      <span>AI Design Studio access</span>
                    </div>
                  </div>
                </div>

                {/* Access Link */}
                <Link href="/prompting-studio">
                  <Button className="w-full bg-gradient-to-r from-purple-600/20 to-cyan-600/20 hover:from-purple-600/30 hover:to-cyan-600/30 border border-purple-500/30 text-purple-300 font-bold text-xs h-9">
                    Open AI Design Studio
                  </Button>
                </Link>
              </div>
            </div>
          )}

          {/* Legacy Scanner Promo */}
          <Link href="/prompting-studio/legacy">
            <div className="rounded-xl border-2 border-cyan-500/30 bg-gradient-to-br from-cyan-500/5 to-slate-900/50 backdrop-blur-sm overflow-hidden hover:border-cyan-500/50 hover:shadow-lg hover:shadow-cyan-500/10 transition-all cursor-pointer group">
              <div className="p-4">
                {/* Badge */}
                <div className="flex items-center justify-between mb-3">
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-gradient-to-r from-green-500 to-emerald-500 text-white text-[10px] font-black uppercase tracking-wider shadow-lg shadow-green-500/30">
                    <Sparkles size={10} />
                    Free
                  </span>
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-cyan-500/20 border border-cyan-500/30 text-cyan-400 text-[9px] font-bold uppercase tracking-wider">
                    New
                  </span>
                </div>

                {/* Content */}
                <div className="mb-3">
                  <h3 className="text-sm font-black text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-emerald-400 mb-1">
                    Legacy Scanner
                  </h3>
                  <p className="text-[11px] text-slate-400 leading-relaxed">
                    Try our streamlined scanner with a simpler interface and faster workflow
                  </p>
                </div>

                {/* CTA */}
                <div className="flex items-center justify-between text-xs">
                  <span className="text-cyan-400 font-medium group-hover:text-cyan-300 transition-colors">
                    Check it out →
                  </span>
                  <div className="flex items-center gap-1 text-[10px] text-slate-500">
                    <Zap size={10} />
                    <span>Quick & Simple</span>
                  </div>
                </div>
              </div>
            </div>
          </Link>

          {/* Scanner Canvas Promo */}
          <Link href="/prompting-studio/canvas">
            <div className="rounded-xl border-2 border-fuchsia-500/30 bg-gradient-to-br from-fuchsia-500/5 to-slate-900/50 backdrop-blur-sm overflow-hidden hover:border-fuchsia-500/50 hover:shadow-lg hover:shadow-fuchsia-500/10 transition-all cursor-pointer group">
              <div className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-gradient-to-r from-fuchsia-500 to-purple-500 text-white text-[10px] font-black uppercase tracking-wider shadow-lg shadow-fuchsia-500/30">
                    <Sparkles size={10} />
                    Dev
                  </span>
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-fuchsia-500/20 border border-fuchsia-500/30 text-fuchsia-400 text-[9px] font-bold uppercase tracking-wider">
                    3 Modes
                  </span>
                </div>
                <div className="mb-3">
                  <h3 className="text-sm font-black text-transparent bg-clip-text bg-gradient-to-r from-fuchsia-400 to-purple-400 mb-1">
                    Scanner Canvas
                  </h3>
                  <p className="text-[11px] text-slate-400 leading-relaxed">
                    Canvas, Fullscreen &amp; Studio modes with 6 scanners and reference panel
                  </p>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-fuchsia-400 font-medium group-hover:text-fuchsia-300 transition-colors">
                    Open Canvas →
                  </span>
                  <div className="flex items-center gap-1 text-[10px] text-slate-500">
                    <Zap size={10} />
                    <span>6 Scanners</span>
                  </div>
                </div>
              </div>
            </div>
          </Link>

          {/* Video Scanner Promo */}
          <Link href="/video-scanner">
            <div className="rounded-xl border-2 border-orange-500/30 bg-gradient-to-br from-orange-500/5 to-slate-900/50 backdrop-blur-sm overflow-hidden hover:border-orange-500/50 hover:shadow-lg hover:shadow-orange-500/10 transition-all cursor-pointer group">
              <div className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-gradient-to-r from-orange-500 to-amber-500 text-white text-[10px] font-black uppercase tracking-wider shadow-lg shadow-orange-500/30">
                    <Sparkles size={10} />
                    Dev
                  </span>
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-orange-500/20 border border-orange-500/30 text-orange-400 text-[9px] font-bold uppercase tracking-wider">
                    Video AI
                  </span>
                </div>
                <div className="mb-3">
                  <h3 className="text-sm font-black text-transparent bg-clip-text bg-gradient-to-r from-orange-400 to-amber-400 mb-1">
                    Video Scanner
                  </h3>
                  <p className="text-[11px] text-slate-400 leading-relaxed">
                    Transform images into 5-10s videos with AI motion generation
                  </p>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-orange-400 font-medium group-hover:text-orange-300 transition-colors">
                    Generate Video →
                  </span>
                  <div className="flex items-center gap-1 text-[10px] text-slate-500">
                    <Zap size={10} />
                    <span>Image-to-Video</span>
                  </div>
                </div>
              </div>
            </div>
          </Link>

          {/* Composition Canvas Promo */}
          <Link href="/composition-canvas">
            <div className="rounded-xl border-2 border-purple-500/30 bg-gradient-to-br from-purple-500/5 to-slate-900/50 backdrop-blur-sm overflow-hidden hover:border-purple-500/50 hover:shadow-lg hover:shadow-purple-500/10 transition-all cursor-pointer group">
              <div className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-gradient-to-r from-purple-500 to-pink-500 text-white text-[10px] font-black uppercase tracking-wider shadow-lg shadow-purple-500/30">
                    <Sparkles size={10} />
                    Dev
                  </span>
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-purple-500/20 border border-purple-500/30 text-purple-400 text-[9px] font-bold uppercase tracking-wider">
                    Layers
                  </span>
                </div>
                <div className="mb-3">
                  <h3 className="text-sm font-black text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-400 mb-1">
                    Composition Canvas
                  </h3>
                  <p className="text-[11px] text-slate-400 leading-relaxed">
                    Layer-based composition with grid regeneration and session saving
                  </p>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-purple-400 font-medium group-hover:text-purple-300 transition-colors">
                    Open Canvas →
                  </span>
                  <div className="flex items-center gap-1 text-[10px] text-slate-500">
                    <Zap size={10} />
                    <span>AI Composition</span>
                  </div>
                </div>
              </div>
            </div>
          </Link>
        </aside>

        {/* CENTER CONTENT */}
        <div className="flex-1 max-w-2xl space-y-4">
          {/* HEADER */}
          <div className="text-center mb-6 relative">
            {/* Mystical glow effect behind title */}
            <div className="absolute inset-0 flex items-center justify-center -z-10">
              <div className="w-64 h-64 bg-gradient-to-r from-cyan-500/20 via-purple-500/20 to-fuchsia-500/20 rounded-full blur-3xl animate-pulse" />
            </div>

            {/* Main Title */}
            <div className="relative inline-block">
              {/* Sci-fi corner brackets */}
              <div className="absolute -top-2 -left-2 w-6 h-6 border-l-2 border-t-2 border-cyan-400/50" />
              <div className="absolute -top-2 -right-2 w-6 h-6 border-r-2 border-t-2 border-cyan-400/50" />
              <div className="absolute -bottom-2 -left-2 w-6 h-6 border-l-2 border-b-2 border-fuchsia-400/50" />
              <div className="absolute -bottom-2 -right-2 w-6 h-6 border-r-2 border-b-2 border-fuchsia-400/50" />

              <h1 className="text-5xl font-black mb-2 text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-purple-400 to-fuchsia-500 tracking-tight px-8 py-2">
                AI DESIGN STUDIO
              </h1>
            </div>

            {/* Status indicator with mystical touch */}
            <div className="flex items-center justify-center gap-2 mt-3">
              <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse shadow-lg shadow-green-400/50" />
              <p className="text-slate-400 text-xs uppercase tracking-widest font-mono">
                <span className="text-green-400">Online</span> • Dimensional Gateway Active
              </p>
              <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse shadow-lg shadow-green-400/50" />
            </div>
            
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
                    className="bg-slate-800/80 border border-slate-600 text-slate-300 hover:bg-red-500/10 hover:border-red-500/50 hover:text-red-400 text-xs px-4 h-7"
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
                    <Button className="bg-slate-800/80 border border-slate-600 text-slate-300 hover:bg-cyan-500/10 hover:border-cyan-500/50 hover:text-cyan-400 text-xs px-4 h-7">
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

          {/* REALITY SCANNER */}
          {adminState.mainScannerMaintenance ? (
            <MaintenanceIndicator label="REALITY_SCANNER" />
          ) : (
            <div id="scanner-section" className="w-full mb-4 p-6 rounded-xl border-2 border-cyan-500/30 bg-gradient-to-b from-slate-900/90 to-slate-950/90 backdrop-blur-sm shadow-2xl shadow-cyan-500/10 relative overflow-hidden">
              {/* Mystical background particles */}
              <div className="absolute inset-0 opacity-30 pointer-events-none">
                <div className="absolute top-1/4 left-1/4 w-1 h-1 bg-cyan-400 rounded-full animate-pulse" />
                <div className="absolute top-1/2 right-1/3 w-1 h-1 bg-purple-400 rounded-full animate-pulse delay-100" />
                <div className="absolute bottom-1/4 left-1/2 w-1 h-1 bg-fuchsia-400 rounded-full animate-pulse delay-200" />
              </div>

              <div className="text-center mb-4 relative">
                <div className="flex items-center justify-center gap-3 mb-2">
                  {/* Rotating portal ring effect */}
                  <div className="relative">
                    <div className="absolute inset-0 animate-spin-slow">
                      <div className="w-8 h-8 border-2 border-cyan-400/30 border-t-cyan-400 rounded-full" />
                    </div>
                    <Eye className="text-cyan-400 relative z-10" size={28} />
                  </div>

                  <h2 className="text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-purple-400 to-fuchsia-500">
                    REALITY SCANNER
                  </h2>

                  <div className="relative">
                    <div className="absolute inset-0 animate-spin-slow-reverse">
                      <div className="w-8 h-8 border-2 border-fuchsia-400/30 border-b-fuchsia-400 rounded-full" />
                    </div>
                    <Sparkles className="text-fuchsia-400 relative z-10" size={28} />
                  </div>
                </div>
                <p className="text-slate-400 text-xs">Scan across infinite dimensions • Manifest your vision</p>
              </div>

              {/* Names & Enhancements - Always visible */}
              {/* Names Row */}
              <div className="mb-3">
                <label className="block text-xs font-bold text-purple-400 mb-2 uppercase tracking-wider">
                  <Wand2 className="inline mr-1" size={12} />
                  Names (Optional)
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {names.map((name, idx) => (
                    <input
                      key={`name-${idx}`}
                      type="text"
                      value={name}
                      onChange={(e) => {
                        const newNames = [...names]
                        newNames[idx] = e.target.value
                        setNames(newNames)
                      }}
                      placeholder={`Name ${idx + 1}...`}
                      className="px-3 py-2 bg-slate-950 border-2 border-slate-700 focus:border-purple-500 rounded-lg text-sm text-white placeholder:text-slate-600 focus:outline-none"
                      disabled={isGenerating}
                    />
                  ))}
                </div>
              </div>

              {/* Enhancements Row */}
              <div className="mb-3">
                <label className="block text-xs font-bold text-purple-400 mb-2 uppercase tracking-wider">
                  <Sparkles className="inline mr-1" size={12} />
                  Enhancements (Optional)
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {enhancements.map((enhancement, idx) => (
                    <input
                      key={`enhancement-${idx}`}
                      type="text"
                      value={enhancement}
                      onChange={(e) => {
                        const newEnhancements = [...enhancements]
                        newEnhancements[idx] = e.target.value
                        setEnhancements(newEnhancements)
                      }}
                      placeholder={`Enhancement ${idx + 1}...`}
                      className="px-3 py-2 bg-slate-950 border-2 border-slate-700 focus:border-purple-500 rounded-lg text-sm text-white placeholder:text-slate-600 focus:outline-none"
                      disabled={isGenerating}
                    />
                  ))}
                </div>
              </div>

              {/* Coordinates Input */}
              <div className="mb-4">
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-xs font-bold text-cyan-400 uppercase tracking-wider">
                    <Settings2 className="inline mr-1" size={12} />
                    Universe Coordinates
                  </label>
                  {/* AI Generate Prompt Button */}
                  <div className="flex items-center gap-2">
                    {hasPromptStudioDev ? (
                      <>
                        {/* Prompt Model Selector - Dev Tier */}
                        <div className="relative">
                          <button
                            onClick={() => setShowPromptModelDropdown(!showPromptModelDropdown)}
                            className="px-3 py-1 bg-purple-600 text-white rounded font-bold text-xs flex items-center gap-1 h-7"
                            disabled={isGenerating}
                          >
                            <span>
                              {promptModel === 'gemini-3-flash' ? 'Gemini 3 Flash' :
                               promptModel === 'gemini-2.0-flash-exp' ? 'Gemini 2 Exp' :
                               promptModel === 'gemini-3-pro' ? 'Gemini 3 Pro' :
                               'Gemini Exp 1206'}
                            </span>
                            <ChevronDown size={10} />
                          </button>
                          {showPromptModelDropdown && (
                            <div className="absolute z-50 top-full mt-1 right-0 w-40 bg-slate-800 border border-purple-500 rounded shadow-lg">
                              <button
                                onClick={() => {
                                  setPromptModel('gemini-3-flash')
                                  setShowPromptModelDropdown(false)
                                }}
                                className={`w-full px-3 py-2 text-left text-xs font-bold hover:bg-slate-700 transition-colors ${
                                  promptModel === 'gemini-3-flash' ? 'bg-purple-600 text-white' : 'text-slate-300'
                                }`}
                              >
                                Gemini 3 Flash
                              </button>
                              <button
                                onClick={() => {
                                  setPromptModel('gemini-2.0-flash-exp')
                                  setShowPromptModelDropdown(false)
                                }}
                                className={`w-full px-3 py-2 text-left text-xs font-bold hover:bg-slate-700 transition-colors ${
                                  promptModel === 'gemini-2.0-flash-exp' ? 'bg-purple-600 text-white' : 'text-slate-300'
                                }`}
                              >
                                Gemini 2 Exp
                              </button>
                              <button
                                onClick={() => {
                                  setPromptModel('gemini-3-pro')
                                  setShowPromptModelDropdown(false)
                                }}
                                className={`w-full px-3 py-2 text-left text-xs font-bold hover:bg-slate-700 transition-colors ${
                                  promptModel === 'gemini-3-pro' ? 'bg-purple-600 text-white' : 'text-slate-300'
                                }`}
                              >
                                Gemini 3 Pro
                              </button>
                              <button
                                onClick={() => {
                                  setPromptModel('gemini-exp-1206')
                                  setShowPromptModelDropdown(false)
                                }}
                                className={`w-full px-3 py-2 text-left text-xs font-bold hover:bg-slate-700 transition-colors ${
                                  promptModel === 'gemini-exp-1206' ? 'bg-purple-600 text-white' : 'text-slate-300'
                                }`}
                              >
                                Gemini Exp 1206
                              </button>
                            </div>
                          )}
                        </div>
                        <Button
                          onClick={handleGeneratePrompt}
                          disabled={promptCooldown > 0 || isGenerating}
                          size="sm"
                          className="bg-purple-600 hover:bg-purple-500 disabled:opacity-50 h-7 text-xs px-3"
                          title={promptCooldown > 0 ? `Cooldown: ${promptCooldown}s` : ''}
                        >
                          <Wand2 size={12} className="mr-1" />
                          {promptCooldown > 0 ? `${promptCooldown}s` : 'Generate'}
                        </Button>
                      </>
                    ) : (
                      /* Free Tier - Locked AI Generation */
                      <Link href="/prompting-studio/subscribe" className="no-underline">
                        <Button
                          size="sm"
                          className="bg-slate-700 hover:bg-slate-600 h-7 text-xs px-3 cursor-pointer"
                          disabled
                        >
                          <Lock size={12} className="mr-1" />
                          AI Prompting (Upgrade)
                        </Button>
                      </Link>
                    )}
                  </div>
                </div>
                <textarea
                  value={coordinates}
                  onChange={(e) => setCoordinates(e.target.value)}
                  placeholder="Describe the universe you want to scan..."
                  className="w-full h-24 p-3 rounded-lg bg-slate-950 border-2 border-slate-700 focus:border-cyan-500 text-white placeholder:text-slate-600 focus:outline-none resize-none text-sm"
                  disabled={isGenerating}
                />
              </div>


              {/* Reference Images Upload - Only for models that support it */}
              {/* Only NanoBanana Cluster doesn't support reference images */}
              {selectedModel !== 'nano-banana' && (
                <div className="mb-4">
                  <label className="block text-xs font-bold text-slate-400 uppercase mb-2">
                    Reference Images (Optional)
                  </label>

                  {/* Saved Preset Picker — prominent dedicated row */}
                  <div className="mb-3 p-2.5 rounded-lg border border-fuchsia-500/20 bg-fuchsia-500/5">
                    <p className="text-[10px] text-fuchsia-400/70 font-medium mb-1.5 uppercase tracking-wide">Load a saved preset</p>
                    <SavedModelPicker onSelect={handleLoadSavedModel} disabled={isLoadingModel || isGenerating} />
                    {isLoadingModel && (
                      <div className="flex items-center gap-2 text-xs text-fuchsia-400 mt-2">
                        <div className="w-3 h-3 border border-fuchsia-500/30 border-t-fuchsia-500 rounded-full animate-spin" />
                        Loading model images...
                      </div>
                    )}
                  </div>

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
                          const remaining = 8 - referenceImages.length
                          if (remaining <= 0) return

                          const newImages: string[] = []
                          for (let i = 0; i < Math.min(files.length, remaining); i++) {
                            const file = files[i]

                            // Compress image before converting to base64 (prevents network errors)
                            const compressedBase64 = await new Promise<string>((resolve) => {
                              const reader = new FileReader()
                              reader.onload = (e) => {
                                const img = new Image()
                                img.onload = () => {
                                  // Max dimensions: 1920x1920 (reduces file size significantly)
                                  const MAX_SIZE = 1920
                                  let width = img.width
                                  let height = img.height

                                  if (width > MAX_SIZE || height > MAX_SIZE) {
                                    if (width > height) {
                                      height = (height / width) * MAX_SIZE
                                      width = MAX_SIZE
                                    } else {
                                      width = (width / height) * MAX_SIZE
                                      height = MAX_SIZE
                                    }
                                  }

                                  const canvas = document.createElement('canvas')
                                  canvas.width = width
                                  canvas.height = height
                                  const ctx = canvas.getContext('2d')
                                  ctx?.drawImage(img, 0, 0, width, height)

                                  // Convert to JPEG with 85% quality (much smaller than PNG)
                                  resolve(canvas.toDataURL('image/jpeg', 0.85))
                                }
                                img.src = e.target?.result as string
                              }
                              reader.readAsDataURL(file)
                            })
                            newImages.push(compressedBase64)
                          }
                          setReferenceImages([...referenceImages, ...newImages].slice(0, 8))
                        }}
                        className="hidden"
                        id="reference-upload"
                        disabled={isGenerating || referenceImages.length >= 8}
                      />
                      <label
                        htmlFor="reference-upload"
                        className={`flex-1 p-3 border-2 border-dashed rounded-lg text-center transition-all ${
                          referenceImages.length >= 8
                            ? 'border-slate-800 bg-slate-900/30 text-slate-600 cursor-not-allowed'
                            : 'border-slate-700 hover:border-cyan-500 bg-slate-900/50 text-slate-400 hover:text-cyan-400 cursor-pointer'
                        }`}
                      >
                        <Upload className="inline mr-2" size={16} />
                        {referenceImages.length >= 8 ? 'Max 8 images' : `Upload Images (${referenceImages.length}/8)`}
                      </label>
                    </div>

                    {/* Active reference images */}
                    {referenceImages.length > 0 && (
                      <div className="grid grid-cols-4 gap-2">
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

                    {/* Greyed-out images that exceed the 8-image limit */}
                    {greyedOutImages.length > 0 && (
                      <div>
                        <p className="text-[10px] text-slate-500 mb-1">Not used — exceeds 8 image limit:</p>
                        <div className="grid grid-cols-4 gap-2">
                          {greyedOutImages.map((img, idx) => (
                            <div key={idx} className="relative aspect-square rounded-lg overflow-hidden border border-slate-700 opacity-40">
                              <img src={img} alt={`Inactive ${idx + 1}`} className="w-full h-full object-cover" />
                              <div className="absolute inset-0 bg-slate-900/50 flex items-end justify-center pb-1">
                                <span className="text-[8px] text-slate-300 font-bold uppercase tracking-wide">Inactive</span>
                              </div>
                              <button
                                onClick={() => setGreyedOutImages(greyedOutImages.filter((_, i) => i !== idx))}
                                className="absolute top-1 right-1 bg-slate-600 hover:bg-slate-500 text-white rounded-full p-1"
                                type="button"
                              >
                                <X size={12} />
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    <p className="text-xs text-slate-600">
                      Up to 8 reference images guide the generation
                    </p>
                  </div>
                </div>
              )}

              {/* Model Selector */}
              <div className="mb-4">
                <label className="block text-xs font-bold text-slate-400 mb-2 uppercase">AI Model</label>
                <ModelSelector
                  selectedModel={selectedModel}
                  onModelSelect={setSelectedModel}
                  userTickets={user?.ticketBalance || 0}
                  nanoBananaMaintenance={adminState.nanoBananaMaintenance}
                  nanoBananaProMaintenance={adminState.nanoBananaProMaintenance}
                  seedreamMaintenance={adminState.seedreamMaintenance}
                  mainScanner_nanoBanana={adminState.mainScanner_nanoBanana}
                  mainScanner_nanoBananaPro={adminState.mainScanner_nanoBananaPro}
                  mainScanner_seedream={adminState.mainScanner_seedream}
                  mainScanner_flux2={adminState.mainScanner_flux2}
                  mainScanner_proScannerV3={adminState.mainScanner_proScannerV3}
                  mainScanner_flashScannerV25={adminState.mainScanner_flashScannerV25}
                />
              </div>

              {/* Scan Parameters */}
              <div className={`grid gap-3 mb-4 ${(selectedModel === 'nano-banana' || selectedModel === 'gemini-2.5-flash-image' || selectedModel === 'flux-2') ? 'grid-cols-1' : 'grid-cols-2'}`}>
                {/* Quality - Hide for NanoBanana Cluster, Flash Scanner, and FLUX 2 */}
                {selectedModel !== 'nano-banana' && selectedModel !== 'gemini-2.5-flash-image' && selectedModel !== 'flux-2' && (
                  <div>
                    <label className="block text-xs font-bold text-slate-400 mb-2 uppercase">
                      Resolution{getTicketCost(selectedModel, '2k') !== getTicketCost(selectedModel, '4k') && (
                        <span className="text-yellow-400 normal-case font-semibold"> (2K = {getTicketCost(selectedModel, '2k')} 🎫 / 4K = {getTicketCost(selectedModel, '4k')} 🎫)</span>
                      )}
                    </label>
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
                )}

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
                disabled={isGenerating || !coordinates.trim() || generationQueue >= MAX_QUEUE_SIZE}
                className="w-full h-12 text-sm font-black bg-gradient-to-r from-cyan-500 to-fuchsia-500 hover:from-cyan-400 hover:to-fuchsia-400 text-black disabled:opacity-50"
              >
                {generationQueue >= MAX_QUEUE_SIZE ? (
                  <>
                    <Zap className="mr-2" size={20} />
                    QUEUE FULL ({generationQueue}/{MAX_QUEUE_SIZE})
                  </>
                ) : isGenerating ? (
                  <>
                    <Zap className="mr-2 animate-pulse" size={20} />
                    SCANNING... ({generationQueue}/{MAX_QUEUE_SIZE})
                  </>
                ) : (
                  <>
                    <Eye className="mr-2" size={20} />
                    SCAN UNIVERSE ({getTicketCost(selectedModel, quality)} ticket{getTicketCost(selectedModel, quality) > 1 ? 's' : ''})
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
              {isGenerating && (
                <div className="mt-4 p-4 rounded-lg border border-cyan-500/30 bg-slate-950">
                  <p className="text-xs font-bold text-cyan-400 mb-2 uppercase">Image Loading</p>
                  <div className="relative aspect-video rounded-lg overflow-hidden bg-slate-900 mb-3 flex items-center justify-center">
                    <div className="text-center">
                      <Zap className="w-12 h-12 text-cyan-400 mx-auto animate-pulse mb-3" />
                      <p className="text-slate-400 text-sm mb-2">Generating image...</p>
                      <div className="flex items-center justify-center gap-1">
                        <div className="w-2 h-2 bg-cyan-500 rounded-full animate-pulse"></div>
                        <div className="w-2 h-2 bg-cyan-500 rounded-full animate-pulse" style={{animationDelay: '0.2s'}}></div>
                        <div className="w-2 h-2 bg-cyan-500 rounded-full animate-pulse" style={{animationDelay: '0.4s'}}></div>
                      </div>
                    </div>
                  </div>
                  <div className="bg-yellow-500/10 border border-yellow-500/50 rounded p-2">
                    <p className="text-yellow-400 text-xs font-bold flex items-center gap-2">
                      <AlertTriangle size={14} />
                      DO NOT REFRESH - Image loading
                    </p>
                  </div>
                </div>
              )}

              {generatedImage && !isGenerating && (
                <div className="mt-4 p-4 rounded-lg border border-cyan-500/30 bg-slate-950">
                  <p className="text-xs font-bold text-cyan-400 mb-2 uppercase">Universe Scan Complete</p>
                  
                  {/* Multi-image display for NanoBanana Cluster (2 images) */}
                  {generatedImages.length > 1 ? (
                    <div className="grid grid-cols-2 gap-3 mb-3">
                      {generatedImages.map((img, idx) => (
                        <div key={img.id} className="space-y-2">
                          <div 
                            className="relative aspect-square rounded-lg overflow-hidden bg-slate-900 cursor-pointer hover:opacity-90 transition-opacity"
                            onClick={() => {
                              setGeneratedImage(img.url)
                              setShowImageModal(true)
                            }}
                          >
                            <img src={img.url} alt={`Generated ${idx + 1}`} className="w-full h-full object-contain" />
                          </div>
                          <p className="text-xs text-slate-400 text-center">Image {idx + 1}/{generatedImages.length}</p>
                          <a href={img.url} download className="block">
                            <Button className="w-full bg-slate-800 hover:bg-slate-700 text-xs h-8">
                              <Download className="w-3 h-3 mr-1" />
                              Download {idx + 1}
                            </Button>
                          </a>
                        </div>
                      ))}
                    </div>
                  ) : (
                    /* Single image display */
                    <>
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
                            // Keep current prompt and reference images, just clear the generated result
                            setGeneratedImage(null)
                            setGeneratedImages([])
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
                    </>
                  )}
                  
                  {/* Rescan button for multi-image */}
                  {generatedImages.length > 1 && (
                    <Button
                      onClick={() => {
                        // Keep current prompt and reference images, just clear the generated result
                        setGeneratedImage(null)
                        setGeneratedImages([])
                        window.scrollTo({
                          top: document.getElementById('scanner-section')?.offsetTop || 0,
                          behavior: 'smooth'
                        })
                      }}
                      className="w-full bg-fuchsia-500 hover:bg-fuchsia-400 text-white font-bold text-xs h-8 flex items-center justify-center gap-1"
                    >
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                      Rescan
                    </Button>
                  )}
                </div>
              )}
            </div>
          )}


          {/* MOBILE ONLY - Session Feed Preview */}
          {sessionFeed.length > 0 && (
            <div className="xl:hidden w-full mb-4">
              <div className="rounded-xl border border-slate-800/50 bg-slate-900/60 backdrop-blur-sm overflow-hidden">
                <div className="px-4 py-3 border-b border-slate-800/50 bg-slate-900/80 flex items-center justify-between">
                  <h3 className="text-xs font-mono text-cyan-400 uppercase tracking-wider">Session Feed</h3>
                  <span className="text-[10px] text-slate-500 font-mono">{sessionFeed.length} images</span>
                </div>
                <div className="p-2 grid grid-cols-3 gap-2">
                  {sessionFeed.slice(0, 6).map((item) => (
                    <div
                      key={item.id}
                      className={`aspect-square rounded-lg overflow-hidden border border-slate-800/50 transition-all ${item.loading ? 'cursor-default' : 'cursor-pointer hover:border-cyan-500/30'}`}
                      onClick={() => {
                        if (!item.loading) {
                          setSelectedFeedItem(item)
                          setShowImageModal(true)
                        }
                      }}
                    >
                      {item.loading ? (
                        <div className="w-full h-full bg-slate-900 flex items-center justify-center">
                          <div className="text-center">
                            <Zap className="w-6 h-6 text-cyan-400 mx-auto animate-pulse" />
                            <div className="flex items-center justify-center gap-1 mt-1">
                              <div className="w-1 h-1 bg-cyan-500 rounded-full animate-pulse"></div>
                              <div className="w-1 h-1 bg-cyan-500 rounded-full animate-pulse" style={{animationDelay: '0.2s'}}></div>
                              <div className="w-1 h-1 bg-cyan-500 rounded-full animate-pulse" style={{animationDelay: '0.4s'}}></div>
                            </div>
                          </div>
                        </div>
                      ) : item.url ? (
                        <div className="relative w-full h-full">
                          <img src={item.url} alt={item.prompt} className="w-full h-full object-cover" />
                          {item.isVideo && (
                            <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                              <div className="w-6 h-6 rounded-full bg-black/60 flex items-center justify-center">
                                <svg viewBox="0 0 24 24" fill="white" className="w-3 h-3 ml-0.5"><path d="M8 5v14l11-7z"/></svg>
                              </div>
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="w-full h-full bg-slate-800 flex items-center justify-center">
                          <span className="text-slate-600 text-[8px]">No preview</span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* MOBILE ONLY - Notifications, Feedback & Prompt Studio */}
          <div className="xl:hidden w-full space-y-4 mb-4">
            {/* Mobile Notifications */}
            <NotificationBanner />

            <MiniEchoChamber />

            {/* Legacy Scanner Promo - Mobile */}
            <Link href="/prompting-studio/legacy">
              <div className="rounded-xl border-2 border-cyan-500/30 bg-gradient-to-br from-cyan-500/5 to-slate-900/50 backdrop-blur-sm overflow-hidden hover:border-cyan-500/50 transition-all">
                <div className="p-4">
                  {/* Badge */}
                  <div className="flex items-center justify-between mb-3">
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-gradient-to-r from-green-500 to-emerald-500 text-white text-[10px] font-black uppercase tracking-wider shadow-lg shadow-green-500/30">
                      <Sparkles size={10} />
                      Free
                    </span>
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-cyan-500/20 border border-cyan-500/30 text-cyan-400 text-[9px] font-bold uppercase tracking-wider">
                      New
                    </span>
                  </div>

                  {/* Content */}
                  <div className="flex items-center gap-3">
                    <div className="flex-1">
                      <h3 className="text-sm font-black text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-emerald-400 mb-1">
                        Legacy Scanner
                      </h3>
                      <p className="text-[11px] text-slate-400 leading-relaxed mb-2">
                        Streamlined interface • Faster workflow
                      </p>
                      <span className="text-xs text-cyan-400 font-medium">
                        Check it out →
                      </span>
                    </div>
                    <Zap size={20} className="text-cyan-400/30" />
                  </div>
                </div>
              </div>
            </Link>

            {/* Prompt Studio CTA */}
            {!hasPromptStudioDev ? (
              // FREE TIER - Mobile Sales Pitch
              <Link href="/prompting-studio/upgrade">
                <div className="p-4 rounded-xl border-2 border-purple-500/40 bg-gradient-to-r from-purple-500/10 to-cyan-500/10 backdrop-blur-sm shadow-[0_0_20px_rgba(168,85,247,0.15)]">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="p-2.5 rounded-lg bg-gradient-to-br from-purple-500 to-cyan-500 shadow-lg shadow-purple-500/30">
                      <Sparkles size={18} className="text-white" />
                    </div>
                    <div className="flex-1">
                      <h3 className="text-sm font-black text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-cyan-400">
                        Dev Tier
                      </h3>
                      <p className="text-[10px] text-purple-400 font-bold">Save up to 37% on tickets</p>
                    </div>
                    <svg className="w-4 h-4 text-purple-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <polyline points="9 18 15 12 9 6"></polyline>
                    </svg>
                  </div>
                  <p className="text-xs text-slate-400 mb-2">37% off tickets • 6 concurrent gens • 500 tickets/month</p>
                  <div className="text-xs text-cyan-400 font-bold">Tap to upgrade →</div>
                </div>
              </Link>
            ) : (
              // DEV TIER - Mobile Badge
              <Link href="/prompting-studio">
                <div className="p-3 rounded-xl border-2 border-purple-500/50 bg-gradient-to-r from-purple-500/10 to-cyan-500/10 backdrop-blur-sm">
                  <div className="flex items-center gap-3">
                    <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-gradient-to-r from-purple-600 to-cyan-600 shadow-lg shadow-purple-500/30">
                      <svg className="w-3 h-3 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M10 2v7.527a2 2 0 0 1-.211.896L4.72 20.55a1 1 0 0 0 .9 1.45h12.76a1 1 0 0 0 .9-1.45l-5.069-10.127A2 2 0 0 1 14 9.527V2"></path>
                        <path d="M8.5 2h7"></path>
                        <path d="M7 16h10"></path>
                      </svg>
                      <span className="text-xs font-black text-white">DEV</span>
                    </div>
                    <div className="flex-1">
                      <h3 className="text-xs font-bold text-purple-300">
                        Dev Tier
                      </h3>
                      <p className="text-[10px] text-slate-500">37% off + 500 tickets/month</p>
                    </div>
                    <svg className="w-4 h-4 text-purple-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <polyline points="9 18 15 12 9 6"></polyline>
                    </svg>
                  </div>
                </div>
              </Link>
            )}
          </div>

          {/* Send Feedback or Request */}
          <MiniEchoChamber />
        </div>

        {/* RIGHT SIDEBAR - Session Feed */}
        <aside className="hidden xl:block w-72 2xl:w-80 sticky top-4">
          <div className="rounded-xl border border-slate-800/50 bg-slate-900/60 backdrop-blur-sm overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-800/50 bg-slate-900/80 flex items-center justify-between">
              <h3 className="text-xs font-mono text-cyan-400 uppercase tracking-wider">Session Feed</h3>
              <span className="text-[10px] text-slate-500 font-mono">{sessionFeed.length} images</span>
            </div>

            {sessionFeed.length === 0 ? (
              <div className="p-6 text-center">
                <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-slate-800/50 flex items-center justify-center">
                  <Eye size={20} className="text-slate-600" />
                </div>
                <p className="text-xs text-slate-500 mb-1">No scans yet</p>
                <p className="text-[10px] text-slate-600">Generated images will appear here</p>
              </div>
            ) : (
              <div className="max-h-[calc(100vh-120px)] overflow-y-auto p-2 space-y-2">
                {sessionFeed.map((item) => (
                  <div
                    key={item.id}
                    className={`group rounded-lg border border-slate-800/50 bg-slate-950/50 overflow-hidden transition-all ${item.loading ? 'cursor-default' : 'cursor-pointer hover:border-cyan-500/30'}`}
                    onClick={() => {
                      if (!item.loading) {
                        setSelectedFeedItem(item)
                        setShowImageModal(true)
                      }
                    }}
                  >
                    <div className="aspect-square relative overflow-hidden">
                      {item.loading ? (
                        /* Loading State */
                        <div className="w-full h-full bg-slate-900 flex items-center justify-center">
                          <div className="text-center">
                            <Zap className="w-8 h-8 text-cyan-400 mx-auto animate-pulse mb-2" />
                            <p className="text-slate-400 text-[10px] mb-1">Generating...</p>
                            <div className="flex items-center justify-center gap-1">
                              <div className="w-1.5 h-1.5 bg-cyan-500 rounded-full animate-pulse"></div>
                              <div className="w-1.5 h-1.5 bg-cyan-500 rounded-full animate-pulse" style={{animationDelay: '0.2s'}}></div>
                              <div className="w-1.5 h-1.5 bg-cyan-500 rounded-full animate-pulse" style={{animationDelay: '0.4s'}}></div>
                            </div>
                          </div>
                        </div>
                      ) : (
                        /* Normal Image/Video Display */
                        <>
                          {item.url ? (
                            <img
                              src={item.url}
                              alt={item.prompt}
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                            />
                          ) : (
                            <div className="w-full h-full bg-slate-800 flex items-center justify-center">
                              <span className="text-slate-600 text-[10px]">No preview</span>
                            </div>
                          )}
                          <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-transparent to-transparent opacity-60" />

                          {/* Video play indicator */}
                          {item.isVideo && (
                            <div className="absolute inset-0 flex items-center justify-center">
                              <div className="w-8 h-8 rounded-full bg-black/60 flex items-center justify-center">
                                <svg viewBox="0 0 24 24" fill="white" className="w-4 h-4 ml-0.5"><path d="M8 5v14l11-7z"/></svg>
                              </div>
                            </div>
                          )}

                          {/* Model badge */}
                          <div className="absolute top-2 right-2">
                            <span className="px-1.5 py-0.5 rounded bg-black/70 text-[8px] text-cyan-400 font-mono">
                              {getModelDisplayName(item.model)}
                            </span>
                          </div>

                          {/* Reference images indicator */}
                          {item.referenceImages && item.referenceImages.length > 0 && (
                            <div className="absolute top-2 left-2">
                              <span className="px-1.5 py-0.5 rounded bg-purple-500/80 text-[8px] text-white font-bold">
                                +{item.referenceImages.length} ref
                              </span>
                            </div>
                          )}

                          {/* Hover overlay */}
                          <div className="absolute inset-0 bg-cyan-500/10 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                            <span className="text-[10px] text-cyan-400 font-bold bg-slate-900/80 px-2 py-1 rounded">View Details</span>
                          </div>
                        </>
                      )}
                    </div>

                    <div className="p-2">
                      <p className="text-[10px] text-slate-400 line-clamp-2">{item.prompt}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </aside>
      </main>

      {/* Image Preview Modal with Full Details */}
      {showImageModal && (selectedFeedItem || generatedImage) && (
        <div
          className="fixed inset-0 bg-black/95 z-50 flex flex-col"
          onClick={() => {
            setShowImageModal(false)
            setSelectedFeedItem(null)
          }}
        >
          {/* Close Button - Fixed position */}
          <button
            onClick={() => {
              setShowImageModal(false)
              setSelectedFeedItem(null)
            }}
            className="absolute top-4 right-4 text-white hover:text-cyan-400 transition-colors z-50 bg-black/50 rounded-full p-2"
          >
            <X size={28} />
          </button>

          {/* Image/Video Area - Takes remaining space */}
          <div className="flex-1 flex items-center justify-center p-4 min-h-0">
            {selectedFeedItem?.isVideo && selectedFeedItem?.videoUrl ? (
              <video
                src={selectedFeedItem.videoUrl}
                controls
                autoPlay
                loop
                className="max-w-full max-h-full rounded-lg"
                onClick={(e) => e.stopPropagation()}
              />
            ) : (
              <img
                src={selectedFeedItem?.url || generatedImage || ''}
                alt={selectedFeedItem?.prompt || coordinates}
                className="max-w-full max-h-full object-contain rounded-lg cursor-pointer hover:opacity-90 transition-opacity"
                title="Click to open full size in new tab"
                onClick={(e) => {
                  e.stopPropagation()
                  window.open(selectedFeedItem?.url || generatedImage || '', '_blank')
                }}
              />
            )}
          </div>

          {/* Details Panel - Fixed at bottom */}
          <div
            className="flex-shrink-0 w-full bg-slate-900/95 border-t border-cyan-500/30 px-4 py-3"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="max-w-4xl mx-auto">
              {/* Prompt - Single line with truncation */}
              <div className="flex items-center gap-2 mb-2">
                <Sparkles className="text-cyan-400 flex-shrink-0" size={14} />
                <p className="text-white text-xs flex-1 truncate">{selectedFeedItem?.prompt || coordinates}</p>
                {/* Reference images indicator */}
                {selectedFeedItem?.referenceImages && selectedFeedItem.referenceImages.length > 0 && (
                  <span className="px-2 py-0.5 rounded bg-purple-500/30 text-purple-400 text-[10px] font-bold flex-shrink-0">
                    +{selectedFeedItem.referenceImages.length} ref
                  </span>
                )}
              </div>

              {/* Info row + Action Buttons - All in one row */}
              <div className="flex items-center gap-3 flex-wrap">
                {/* Info badges */}
                {selectedFeedItem && (
                  <div className="flex items-center gap-2 text-[10px] text-slate-400 flex-shrink-0">
                    <span className="px-1.5 py-0.5 rounded bg-cyan-500/20 text-cyan-400 font-mono">
                      {getModelDisplayName(selectedFeedItem.model)}
                    </span>
                    <span>{selectedFeedItem.quality}</span>
                    <span>{selectedFeedItem.aspectRatio}</span>
                  </div>
                )}

                {/* Spacer */}
                <div className="flex-1" />

                {/* Action Buttons */}
                <div className="flex items-center gap-2">
                  <a
                    href={(selectedFeedItem?.isVideo ? selectedFeedItem?.videoUrl : selectedFeedItem?.url) || generatedImage || ''}
                    download
                    onClick={(e) => e.stopPropagation()}
                    className="bg-cyan-500 hover:bg-cyan-400 text-black font-bold py-1.5 px-3 rounded-lg flex items-center gap-1.5 text-xs"
                  >
                    <Download size={12} />
                    Download
                  </a>
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      const prompt = selectedFeedItem?.prompt || coordinates
                      const model = selectedFeedItem?.model || selectedModel
                      const qual = selectedFeedItem?.quality || quality
                      const ratio = selectedFeedItem?.aspectRatio || aspectRatio
                      const refImages = selectedFeedItem?.referenceImages || referenceImages

                      setCoordinates(prompt)
                      setSelectedModel(model)
                      setQuality(qual)
                      setAspectRatio(ratio as '1:1' | '4:5' | '9:16' | '16:9')
                      setReferenceImages(refImages)
                      setShowImageModal(false)
                      setSelectedFeedItem(null)
                      setGeneratedImage(null)
                      setGeneratedImages([])
                      window.scrollTo({
                        top: document.getElementById('scanner-section')?.offsetTop || 0,
                        behavior: 'smooth'
                      })
                    }}
                    className="bg-fuchsia-600 hover:bg-fuchsia-500 text-white font-bold py-1.5 px-3 rounded-lg flex items-center gap-1.5 text-xs"
                  >
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    Rescan
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      navigator.clipboard.writeText(selectedFeedItem?.prompt || coordinates)
                    }}
                    className="bg-purple-600 hover:bg-purple-500 text-white font-bold py-1.5 px-3 rounded-lg flex items-center gap-1.5 text-xs"
                    title="Copy prompt"
                  >
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                    Copy
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



















































































