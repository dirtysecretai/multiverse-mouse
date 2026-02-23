"use client"

import { useState, useEffect, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { AlertTriangle, ExternalLink, X, Wrench, Sparkles, Eye, Settings2, Zap, Ticket, Upload, Download, ChevronDown, Wand2, Lock, Film } from "lucide-react"
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
export default function MultiversePortal() {
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
  const [generationStatus, setGenerationStatus] = useState<string>('') // e.g. "Processing...", "Position #2..."
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
  const MAX_QUEUE_SIZE = user?.email === 'dirtysecretai@gmail.com' ? 20 : hasPromptStudioDev ? 8 : 3
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
      const res = await fetch('/api/auth/session')
      const data = await res.json()
      if (data.authenticated) {
        setUser(data.user)

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

  // Sync active generation jobs from DB so loading placeholders survive page refreshes
  useEffect(() => {
    if (!user) return
    const syncedJobIds = new Set<number>()

    const syncJobs = async () => {
      try {
        const res = await fetch('/api/prompting-studio/jobs')
        if (!res.ok) return
        const { jobs } = await res.json() as { jobs: any[] }

        for (const job of jobs) {
          const jobFeedId = `job-${job.id}`

          if ((job.status === 'processing' || job.status === 'queued') && !syncedJobIds.has(job.id)) {
            // Restore loading placeholder for an in-flight job
            syncedJobIds.add(job.id)
            setSessionFeed(prev => {
              if (prev.some(item => item.id === jobFeedId)) return prev
              return [{
                id: jobFeedId,
                url: '',
                prompt: job.prompt,
                model: (job.parameters as any)?.model || job.modelId || '',
                quality: (job.parameters as any)?.quality || '2k',
                aspectRatio: (job.parameters as any)?.aspectRatio || '16:9',
                timestamp: new Date(job.startedAt || job.createdAt).getTime(),
                referenceImages: [],
                loading: true,
              }, ...prev].slice(0, MAX_FEED_SIZE)
            })
            setGenerationQueue(prev => prev + 1)
            setIsGenerating(true)
          } else if (job.status === 'completed' && job.resultUrl && syncedJobIds.has(job.id)) {
            // Job finished — swap loading item for the real image
            syncedJobIds.delete(job.id)
            setSessionFeed(prev => {
              if (!prev.some(item => item.id === jobFeedId)) return prev
              return prev.map(item =>
                item.id === jobFeedId
                  ? { ...item, url: job.resultUrl, loading: false }
                  : item
              )
            })
            setGenerationQueue(prev => Math.max(0, prev - 1))
            if (syncedJobIds.size === 0) setIsGenerating(false)
          } else if (job.status === 'failed' && syncedJobIds.has(job.id)) {
            // Job failed — remove loading item
            syncedJobIds.delete(job.id)
            setSessionFeed(prev => prev.filter(item => item.id !== jobFeedId))
            setGenerationQueue(prev => Math.max(0, prev - 1))
            if (syncedJobIds.size === 0) setIsGenerating(false)
          }
        }
      } catch (err) {
        console.error('Job sync error:', err)
      }
    }

    syncJobs()
    const interval = setInterval(syncJobs, 4000)
    return () => clearInterval(interval)
  }, [user, MAX_FEED_SIZE])

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

  // Helper: show a completed image result in the feed
  const showImageResult = useCallback((
    imageUrl: string,
    imageId: string | number | undefined,
    allImages: Array<{url: string, id: string | number | undefined}> | undefined,
    loadingId: string,
    currentCoordinates: string,
    currentModel: string,
    currentQuality: '2k' | '4k',
    currentAspectRatio: string,
    currentReferenceImages: string[],
    newBalance: number | undefined,
  ) => {
    if (allImages && allImages.length > 1) {
      // Multi-image (NanoBanana Cluster)
      const imgs = allImages.map(img => ({ url: img.url, id: String(img.id ?? '') }))
      setGeneratedImages(imgs)
      setGeneratedImage(imgs[0].url)
      const newFeedItems = imgs.map((img, idx) => ({
        id: `${Date.now()}-${idx}`,
        url: img.url,
        prompt: currentCoordinates,
        model: currentModel,
        quality: currentQuality,
        aspectRatio: currentAspectRatio,
        timestamp: Date.now(),
        referenceImages: [...currentReferenceImages],
      }))
      setSessionFeed(prev => [...newFeedItems, ...prev.filter(item => item.id !== loadingId)].slice(0, MAX_FEED_SIZE))
    } else {
      setGeneratedImage(imageUrl)
      setGeneratedImages([])
      setSessionFeed(prev => [{
        id: `${Date.now()}`,
        url: imageUrl,
        prompt: currentCoordinates,
        model: currentModel,
        quality: currentQuality,
        aspectRatio: currentAspectRatio,
        timestamp: Date.now(),
        referenceImages: [...currentReferenceImages],
      }, ...prev.filter(item => item.id !== loadingId)].slice(0, MAX_FEED_SIZE))
    }
    if (newBalance !== undefined) {
      setUser(prev => prev ? { ...prev, ticketBalance: newBalance } : prev)
    }
  }, [MAX_FEED_SIZE])

  // Poll /api/queue/status/:id until completed or failed (FAL.ai async path)
  const pollQueueStatus = useCallback((
    queueId: number,
    loadingId: string,
    capturedCoordinates: string,
    capturedModel: string,
    capturedQuality: '2k' | '4k',
    capturedAspectRatio: string,
    capturedReferenceImages: string[],
  ) => {
    const POLL_INTERVAL = 3000   // 3 seconds
    const MAX_WAIT_MS = 5 * 60 * 1000 // 5 minute timeout
    const startedAt = Date.now()

    const intervalId = setInterval(async () => {
      try {
        // Timeout safeguard
        if (Date.now() - startedAt > MAX_WAIT_MS) {
          clearInterval(intervalId)
          setSessionFeed(prev => prev.filter(item => item.id !== loadingId))
          setGenerationError('Generation timed out. Please try again.')
          setIsGenerating(false)
          setGenerationQueue(prev => Math.max(0, prev - 1))
          setGenerationStatus('')
          return
        }

        const res = await fetch(`/api/queue/status/${queueId}`)
        if (!res.ok) return // transient error, keep polling

        const data = await res.json()

        if (data.status === 'queued') {
          setGenerationStatus(`Position #${data.position} in queue...`)
        } else if (data.status === 'processing') {
          setGenerationStatus('Processing...')
        } else if (data.status === 'completed') {
          clearInterval(intervalId)
          setGenerationStatus('')
          showImageResult(
            data.resultUrl,
            data.imageId,
            data.allImages,
            loadingId,
            capturedCoordinates,
            capturedModel,
            capturedQuality,
            capturedAspectRatio,
            capturedReferenceImages,
            undefined, // balance was already updated when queued
          )
          setIsGenerating(false)
          setGenerationQueue(prev => Math.max(0, prev - 1))
        } else if (data.status === 'failed' || data.status === 'cancelled') {
          clearInterval(intervalId)
          setGenerationStatus('')
          setSessionFeed(prev => prev.filter(item => item.id !== loadingId))
          setGenerationError(data.errorMessage || 'Generation failed. Tickets have been refunded.')
          // Refund the balance optimistically shown
          setUser(prev => prev ? { ...prev, ticketBalance: prev.ticketBalance + (data.ticketCost || 0) } : prev)
          setIsGenerating(false)
          setGenerationQueue(prev => Math.max(0, prev - 1))
        }
      } catch (err) {
        console.error('Poll error:', err)
        // Keep polling on transient network errors
      }
    }, POLL_INTERVAL)
  }, [showImageResult, MAX_FEED_SIZE])

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
      if (selectedModel === 'nano-banana' && adminState.mainScanner_nanoBanana) return true
      if (selectedModel === 'nano-banana-pro' && adminState.mainScanner_nanoBananaPro) return true
      if (selectedModel === 'seedream-4.5' && adminState.mainScanner_seedream) return true
      if (selectedModel === 'flux-2' && adminState.mainScanner_flux2) return true
      if (selectedModel === 'gemini-3-pro-image' && adminState.mainScanner_proScannerV3) return true
      if (selectedModel === 'gemini-2.5-flash-image' && adminState.mainScanner_flashScannerV25) return true
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

    if (generationQueue >= MAX_QUEUE_SIZE) {
      setGenerationError(`Generation queue full (max ${MAX_QUEUE_SIZE}). Please wait for current scans to complete.`)
      return
    }

    const ticketCost = getTicketCost(selectedModel, quality)

    if (user.ticketBalance < ticketCost) {
      setGenerationError(`Insufficient tickets. Need ${ticketCost} ticket(s) for this model. Purchase more to continue scanning.`)
      return
    }

    setIsGenerating(true)
    setGenerationQueue(prev => prev + 1)
    setGenerationError(null)
    setGenerationStatus('Submitting...')

    // Capture current values so closures in poll/callbacks use the right ones
    const capturedCoordinates = coordinates
    const capturedModel = selectedModel
    const capturedQuality = quality
    const capturedAspectRatio = aspectRatio
    const capturedReferenceImages = [...referenceImages]

    const loadingId = `loading-${Date.now()}`
    setSessionFeed(prev => [{
      id: loadingId,
      url: '',
      prompt: capturedCoordinates,
      model: capturedModel,
      quality: capturedQuality,
      aspectRatio: capturedAspectRatio,
      timestamp: Date.now(),
      referenceImages: capturedReferenceImages,
      loading: true
    }, ...prev].slice(0, MAX_FEED_SIZE))

    try {
      const requestBody: any = {
        prompt: capturedCoordinates,
        quality: capturedQuality,
        aspectRatio: capturedAspectRatio,
        referenceImages: capturedReferenceImages,
        model: capturedModel,
      }

      if (hasPromptStudioDev) {
        const combinedNames = names.filter(n => n.trim()).join(', ')
        const combinedEnhancements = enhancements.filter(e => e.trim()).join(', ')
        if (combinedNames) requestBody.celebrityName = combinedNames
        if (combinedEnhancements) requestBody.enhancement = combinedEnhancements
      }

      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      })

      const data = await res.json()

      if (!res.ok || data.error) {
        setSessionFeed(prev => prev.filter(item => item.id !== loadingId))
        setGenerationError(data.error || 'Universe scan failed. Please try again.')
        setIsGenerating(false)
        setGenerationQueue(prev => Math.max(0, prev - 1))
        setGenerationStatus('')
        return
      }

      // ── FAL.AI ASYNC PATH: server returned a queueId ──────────────
      if (data.queueId) {
        // Optimistically update balance (tickets were reserved server-side)
        if (data.newBalance !== undefined) {
          setUser(prev => prev ? { ...prev, ticketBalance: data.newBalance } : prev)
        }
        setGenerationStatus('Queued for processing...')
        pollQueueStatus(
          data.queueId,
          loadingId,
          capturedCoordinates,
          capturedModel,
          capturedQuality,
          capturedAspectRatio,
          capturedReferenceImages,
        )
        // Note: isGenerating stays true until poll completes
        return
      }

      // ── GEMINI SYNC PATH: server returned imageUrl directly ────────
      if (data.success) {
        if (data.images && data.images.length > 1) {
          showImageResult(data.images[0].url, data.images[0].id, data.images, loadingId,
            capturedCoordinates, capturedModel, capturedQuality, capturedAspectRatio, capturedReferenceImages, data.newBalance)
        } else {
          showImageResult(data.imageUrl, data.imageId, undefined, loadingId,
            capturedCoordinates, capturedModel, capturedQuality, capturedAspectRatio, capturedReferenceImages, data.newBalance)
        }
      } else {
        setSessionFeed(prev => prev.filter(item => item.id !== loadingId))
        setGenerationError(data.error || 'Universe scan failed. Please try again.')
      }
      // Gemini sync path — reset loading state here
      setIsGenerating(false)
      setGenerationQueue(prev => Math.max(0, prev - 1))
      setGenerationStatus('')
    } catch (err: any) {
      console.error('Generation error:', err)
      setSessionFeed(prev => prev.filter(item => item.id !== loadingId))
      setGenerationError('Network error. Please try again.')
      setIsGenerating(false)
      setGenerationQueue(prev => Math.max(0, prev - 1))
      setGenerationStatus('')
    }
  }

  // Check if current user is admin
  const isAdmin = user?.email === "dirtysecretai@gmail.com"

  // Show maintenance page to non-admins if global maintenance OR scanner-specific maintenance is enabled
  if ((adminState.isMaintenanceMode || adminState.mainScannerMaintenance) && !isAdmin) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center p-6">
        <div className="text-center p-12 rounded-2xl border-2 border-yellow-500/30 bg-yellow-500/5 backdrop-blur-sm max-w-md">
          <AlertTriangle className="mx-auto text-yellow-500 mb-4 animate-pulse" size={64} />
          <h1 className="text-2xl font-black text-yellow-400 mb-3">MAINTENANCE MODE</h1>
          <p className="text-slate-400 text-sm">
            {adminState.isMaintenanceMode
              ? 'Multiverse Portal is temporarily offline for maintenance. We\'ll be back soon!'
              : 'The Reality Scanner is temporarily offline for maintenance. Please try another scanner.'}
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white relative overflow-hidden">
      {/* BACKGROUND GRID */}
      <div className="fixed inset-0 bg-[linear-gradient(rgba(255,255,255,0.018)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.018)_1px,transparent_1px)] bg-[size:48px_48px] pointer-events-none" />

      {/* MAIN LAYOUT - 3 Column */}
      <main className="relative z-10 flex items-start justify-center gap-4 p-4 min-h-screen">
        {/* LEFT SIDEBAR - Notifications & Prompt Studio */}
        <aside className="hidden xl:block w-72 2xl:w-80 sticky top-4 space-y-4">
          {/* Notifications */}
          <NotificationBanner />

          {/* Prompt Studio Section */}
          {!hasPromptStudioDev ? (
            // FREE TIER - Sales Pitch
            <div className="rounded-xl border border-slate-800 bg-slate-900/60 backdrop-blur-sm overflow-hidden">
              <div className="p-5">
                {/* Header */}
                <div className="text-center mb-4">
                  <div className="inline-flex p-3 rounded-xl bg-slate-800 mb-3">
                    <svg className="w-8 h-8 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M10 2v7.527a2 2 0 0 1-.211.896L4.72 20.55a1 1 0 0 0 .9 1.45h12.76a1 1 0 0 0 .9-1.45l-5.069-10.127A2 2 0 0 1 14 9.527V2"></path>
                      <path d="M8.5 2h7"></path>
                      <path d="M7 16h10"></path>
                    </svg>
                  </div>
                  <h3 className="text-lg font-bold text-white mb-1">
                    PROMPT STUDIO
                  </h3>
                  <p className="text-xs text-slate-500">Unlock Professional AI Creation Tools</p>
                </div>

                {/* Benefits */}
                <div className="space-y-2.5 mb-5">
                  <div className="flex items-start gap-3">
                    <div className="w-5 h-5 rounded-full bg-slate-700 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <Sparkles size={10} className="text-white" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-slate-300">AI-Powered Prompt Generation</p>
                      <p className="text-[10px] text-slate-500">Let AI craft perfect prompts from simple ideas</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="w-5 h-5 rounded-full bg-slate-700 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <svg className="w-3 h-3 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                        <rect x="3" y="3" width="18" height="18" rx="2" />
                      </svg>
                    </div>
                    <div>
                      <p className="text-xs font-bold text-slate-300">Infinite Canvas Studio</p>
                      <p className="text-[10px] text-slate-500">25-image canvas with 3 viewing modes</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="w-5 h-5 rounded-full bg-slate-700 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <Zap size={10} className="text-white" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-slate-300">6 Multi-Scanners</p>
                      <p className="text-[10px] text-slate-500">Run 6 different scanners simultaneously</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="w-5 h-5 rounded-full bg-slate-700 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <svg className="w-3 h-3 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                        <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
                      </svg>
                    </div>
                    <div>
                      <p className="text-xs font-bold text-slate-300">Session Save & Load</p>
                      <p className="text-[10px] text-slate-500">Save your work and continue anytime</p>
                    </div>
                  </div>
                </div>

                {/* CTA Button - Bigger */}
                <Link href="/prompting-studio/upgrade">
                  <Button className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold text-sm h-12 transition-all">
                    <Sparkles size={18} className="mr-2" />
                    Upgrade to Dev Tier
                  </Button>
                </Link>

                {/* Secondary CTA */}
                <Link href="/prompting-studio">
                  <button className="w-full mt-3 py-2 px-4 rounded-lg border border-slate-800 hover:border-slate-600 text-xs text-slate-500 hover:text-slate-300 transition-colors font-medium">
                    Explore Free Features →
                  </button>
                </Link>
              </div>
            </div>
          ) : (
            // DEV TIER - Clean Badge with Tips
            <div className="rounded-xl border border-slate-800 bg-slate-900/60 backdrop-blur-sm overflow-hidden">
              <div className="p-4">
                {/* Dev Tier Badge */}
                <div className="text-center mb-4">
                  <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-slate-800 border border-slate-700 mb-2">
                    <svg className="w-4 h-4 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M10 2v7.527a2 2 0 0 1-.211.896L4.72 20.55a1 1 0 0 0 .9 1.45h12.76a1 1 0 0 0 .9-1.45l-5.069-10.127A2 2 0 0 1 14 9.527V2"></path>
                      <path d="M8.5 2h7"></path>
                      <path d="M7 16h10"></path>
                    </svg>
                    <span className="text-xs font-black text-white">PROMPT STUDIO DEV</span>
                  </div>
                  <p className="text-[10px] text-slate-500">Professional Features Unlocked</p>
                </div>

                {/* Quick Tips */}
                <div className="space-y-2 mb-3">
                  <p className="text-[10px] text-slate-600 font-medium uppercase tracking-wider">Quick Tips:</p>
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2 text-[10px] text-slate-500">
                      <Wand2 size={12} className="text-slate-600 flex-shrink-0" />
                      <span>Use AI prompting in all scanners</span>
                    </div>
                    <div className="flex items-center gap-2 text-[10px] text-slate-500">
                      <svg className="w-3 h-3 text-slate-600 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <rect x="3" y="3" width="18" height="18" rx="2" />
                      </svg>
                      <span>Access Canvas mode via Dashboard</span>
                    </div>
                    <div className="flex items-center gap-2 text-[10px] text-slate-500">
                      <Sparkles size={12} className="text-slate-600 flex-shrink-0" />
                      <span>Fill Names + Enhancements above</span>
                    </div>
                    <div className="flex items-center gap-2 text-[10px] text-slate-500">
                      <svg className="w-3 h-3 text-slate-600 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
                      </svg>
                      <span>Save sessions in Canvas Studio</span>
                    </div>
                  </div>
                </div>

                {/* Access Link */}
                <Link href="/prompting-studio">
                  <Button className="w-full bg-slate-800/60 hover:bg-slate-800 border border-slate-700 text-slate-300 font-medium text-xs h-9">
                    Open Prompt Studio
                  </Button>
                </Link>
              </div>
            </div>
          )}

          {/* Mini Echo Chamber */}
          <MiniEchoChamber />

          {/* Legacy Scanner */}
          <Link href="/prompting-studio/legacy">
            <div className="rounded-xl border border-slate-800 bg-slate-900/60 backdrop-blur-sm overflow-hidden hover:border-slate-700 hover:bg-slate-900/80 transition-all cursor-pointer group">
              <div className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-slate-800 flex items-center justify-center flex-shrink-0">
                      <Wand2 size={15} className="text-white" />
                    </div>
                    <div>
                      <p className="text-xs font-black text-white">Legacy Scanner</p>
                      <p className="text-[10px] text-slate-600">Quick & Simple</p>
                    </div>
                  </div>
                  <span className="text-[9px] px-2 py-0.5 rounded-full bg-white/90 text-black font-black uppercase tracking-wider flex-shrink-0">Free</span>
                </div>
                <p className="text-[11px] text-slate-500 leading-relaxed mb-3">
                  Streamlined scanner with a simpler interface and faster workflow
                </p>
                <span className="text-xs text-slate-500 group-hover:text-slate-300 transition-colors font-medium">
                  Check it out →
                </span>
              </div>
            </div>
          </Link>

          {/* Scanner Canvas */}
          <Link href="/prompting-studio/canvas">
            <div className="rounded-xl border border-slate-800 bg-slate-900/60 backdrop-blur-sm overflow-hidden hover:border-slate-700 hover:bg-slate-900/80 transition-all cursor-pointer group">
              <div className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-slate-800 flex items-center justify-center flex-shrink-0">
                      <Settings2 size={15} className="text-white" />
                    </div>
                    <div>
                      <p className="text-xs font-black text-white">Scanner Canvas</p>
                      <p className="text-[10px] text-slate-600">3 Modes</p>
                    </div>
                  </div>
                  <span className="text-[9px] px-2 py-0.5 rounded-full bg-slate-700 border border-slate-600 text-slate-300 font-black uppercase tracking-wider flex-shrink-0">Dev</span>
                </div>
                <p className="text-[11px] text-slate-500 leading-relaxed mb-3">
                  Canvas, Fullscreen &amp; Studio modes with 6 scanners and reference panel
                </p>
                <span className="text-xs text-slate-500 group-hover:text-slate-300 transition-colors font-medium">
                  Open Canvas →
                </span>
              </div>
            </div>
          </Link>

          {/* Video Scanner */}
          <Link href="/video-scanner">
            <div className="rounded-xl border border-slate-800 bg-slate-900/60 backdrop-blur-sm overflow-hidden hover:border-slate-700 hover:bg-slate-900/80 transition-all cursor-pointer group">
              <div className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-slate-800 flex items-center justify-center flex-shrink-0">
                      <Film size={15} className="text-white" />
                    </div>
                    <div>
                      <p className="text-xs font-black text-white">Video Scanner</p>
                      <p className="text-[10px] text-slate-600">Image-to-Video</p>
                    </div>
                  </div>
                  <span className="text-[9px] px-2 py-0.5 rounded-full bg-slate-700 border border-slate-600 text-slate-300 font-black uppercase tracking-wider flex-shrink-0">Dev</span>
                </div>
                <p className="text-[11px] text-slate-500 leading-relaxed mb-3">
                  Transform images into 5–10s videos with AI motion generation
                </p>
                <span className="text-xs text-slate-500 group-hover:text-slate-300 transition-colors font-medium">
                  Generate Video →
                </span>
              </div>
            </div>
          </Link>

          {/* Composition Canvas */}
          <Link href="/composition-canvas">
            <div className="rounded-xl border border-slate-800 bg-slate-900/60 backdrop-blur-sm overflow-hidden hover:border-slate-700 hover:bg-slate-900/80 transition-all cursor-pointer group">
              <div className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-slate-800 flex items-center justify-center flex-shrink-0">
                      <Eye size={15} className="text-white" />
                    </div>
                    <div>
                      <p className="text-xs font-black text-white">Composition Canvas</p>
                      <p className="text-[10px] text-slate-600">Layers</p>
                    </div>
                  </div>
                  <span className="text-[9px] px-2 py-0.5 rounded-full bg-slate-700 border border-slate-600 text-slate-300 font-black uppercase tracking-wider flex-shrink-0">Dev</span>
                </div>
                <p className="text-[11px] text-slate-500 leading-relaxed mb-3">
                  Layer-based composition with grid regeneration and session saving
                </p>
                <span className="text-xs text-slate-500 group-hover:text-slate-300 transition-colors font-medium">
                  Open Canvas →
                </span>
              </div>
            </div>
          </Link>
        </aside>

        {/* CENTER CONTENT */}
        <div className="flex-1 max-w-2xl space-y-4">
          {/* HEADER */}
          <div className="text-center mb-6 relative">
            {/* Main Title */}
            <div className="relative inline-block">
              {/* Corner brackets */}
              <div className="absolute -top-2 -left-2 w-5 h-5 border-l-2 border-t-2 border-slate-600/60" />
              <div className="absolute -top-2 -right-2 w-5 h-5 border-r-2 border-t-2 border-slate-600/60" />
              <div className="absolute -bottom-2 -left-2 w-5 h-5 border-l-2 border-b-2 border-slate-600/60" />
              <div className="absolute -bottom-2 -right-2 w-5 h-5 border-r-2 border-b-2 border-slate-600/60" />

              <h1 className="text-5xl font-black mb-2 text-white tracking-tight px-8 py-2">
                AI DESIGN STUDIO
              </h1>
            </div>

            {/* Status indicator */}
            <div className="flex items-center justify-center gap-2 mt-3">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <p className="text-slate-500 text-xs uppercase tracking-widest font-mono">
                <span className="text-emerald-500">Online</span> • Creative Engine Active
              </p>
            </div>
            
            {/* Auth buttons */}
            <div className="mt-4 flex items-center justify-center gap-3">
              {user ? (
                <>
                  <Link href="/dashboard">
                  {/* User email display */}
                  <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-900/50 border border-slate-800">
                    <svg className="w-4 h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                    <span className="text-xs text-slate-300 font-medium max-w-[180px] truncate">{user.email}</span>
                  </div>

                    <Button className="bg-slate-800 hover:bg-slate-700 border border-slate-700 text-white font-bold text-xs px-4 h-7">
                      Dashboard
                    </Button>
                  </Link>
                  <Link href="/buy-tickets">
                    <Button className="bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs px-4 h-7">
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
                    <Button className="bg-slate-800/80 border border-slate-700 text-slate-400 hover:bg-slate-800 hover:border-slate-600 hover:text-slate-200 text-xs px-4 h-7">
                      Login
                    </Button>
                  </Link>
                  <Link href="/signup">
                    <Button className="bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs px-4 h-7">
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
            <div id="scanner-section" className="w-full mb-4 p-6 rounded-xl border border-slate-800 bg-slate-900/60 backdrop-blur-sm shadow-2xl shadow-black/40 relative overflow-hidden">
              <div className="text-center mb-4 relative">
                <div className="flex items-center justify-center gap-3 mb-2">
                  <Eye className="text-slate-400" size={22} />
                  <h2 className="text-xl font-bold text-white tracking-wide">
                    REALITY SCANNER
                  </h2>
                  <Sparkles className="text-slate-500" size={18} />
                </div>
                <p className="text-slate-600 text-xs">Generate across infinite possibilities</p>
              </div>

              {/* Names & Enhancements - Always visible */}
              {/* Names Row */}
              <div className="mb-3">
                <label className="block text-xs font-medium text-slate-500 mb-2 uppercase tracking-wider">
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
                      className="px-3 py-2 bg-black/50 border border-slate-800 focus:border-slate-600 rounded-lg text-sm text-white placeholder:text-slate-700 focus:outline-none"
                      disabled={isGenerating}
                    />
                  ))}
                </div>
              </div>

              {/* Enhancements Row */}
              <div className="mb-3">
                <label className="block text-xs font-medium text-slate-500 mb-2 uppercase tracking-wider">
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
                      className="px-3 py-2 bg-black/50 border border-slate-800 focus:border-slate-600 rounded-lg text-sm text-white placeholder:text-slate-700 focus:outline-none"
                      disabled={isGenerating}
                    />
                  ))}
                </div>
              </div>

              {/* Coordinates Input */}
              <div className="mb-4">
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-xs font-medium text-slate-500 uppercase tracking-wider">
                    <Settings2 className="inline mr-1" size={12} />
                    Prompt
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
                  className="w-full h-24 p-3 rounded-lg bg-black/50 border border-slate-800 focus:border-slate-600 text-white placeholder:text-slate-700 focus:outline-none resize-none text-sm"
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
                  <div className="mb-3 p-2.5 rounded-lg border border-slate-700/50 bg-slate-900/40">
                    <p className="text-[10px] text-slate-500 font-medium mb-1.5 uppercase tracking-wide">Load a saved preset</p>
                    <SavedModelPicker onSelect={handleLoadSavedModel} disabled={isLoadingModel || isGenerating} />
                    {isLoadingModel && (
                      <div className="flex items-center gap-2 text-xs text-slate-400 mt-2">
                        <div className="w-3 h-3 border border-slate-700 border-t-slate-400 rounded-full animate-spin" />
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
                            ? 'border-slate-800 bg-slate-900/20 text-slate-700 cursor-not-allowed'
                            : 'border-slate-800 hover:border-slate-600 bg-slate-900/50 text-slate-500 hover:text-slate-300 cursor-pointer'
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
                      Resolution{(selectedModel === 'nano-banana-pro' || selectedModel === 'gemini-3-pro-image') && <span className="text-yellow-400"> (4K = 2 tickets)</span>}
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      {(['2k', '4k'] as const).map((q) => (
                        <button
                          key={q}
                          onClick={() => setQuality(q)}
                          disabled={isGenerating}
                          className={`p-2 rounded-lg font-bold uppercase text-xs transition-all ${
                            quality === q
                              ? 'bg-slate-200 text-black'
                              : 'bg-slate-900 border border-slate-800 text-slate-400 hover:bg-slate-800 hover:text-white'
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
                            ? 'bg-slate-200 text-black'
                            : 'bg-slate-900 border border-slate-800 text-slate-400 hover:bg-slate-800 hover:text-white'
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
                disabled={!coordinates.trim() || generationQueue >= MAX_QUEUE_SIZE}
                className="w-full h-12 text-sm font-bold bg-blue-600 hover:bg-blue-500 text-white disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {generationQueue >= MAX_QUEUE_SIZE ? (
                  <>
                    <Zap className="mr-2" size={20} />
                    QUEUE FULL ({generationQueue}/{MAX_QUEUE_SIZE})
                  </>
                ) : generationQueue > 0 ? (
                  <>
                    <Eye className="mr-2" size={20} />
                    SCAN AGAIN ({generationQueue} active · {getTicketCost(selectedModel, quality)} ticket{getTicketCost(selectedModel, quality) > 1 ? 's' : ''})
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
                  <Link href="/signup" className="text-slate-400 hover:text-white">Sign up</Link>
                  {' '}or{' '}
                  <Link href="/login" className="text-slate-400 hover:text-white">login</Link>
                  {' '}to start scanning
                </p>
              )}

              {user && user.ticketBalance === 0 && (
                <p className="text-center text-xs text-slate-500 mt-3">
                  No tickets remaining.{' '}
                  <Link href="/buy-tickets" className="text-slate-400 hover:text-white">Purchase more</Link>
                </p>
              )}

              {/* Generated Image Display */}
              {isGenerating && (
                <div className="mt-4 p-4 rounded-lg border border-slate-800 bg-black/40">
                  <p className="text-xs font-medium text-slate-500 mb-2 uppercase tracking-wider">Generating</p>
                  <div className="relative aspect-video rounded-lg overflow-hidden bg-slate-900 mb-3 flex items-center justify-center">
                    <div className="text-center">
                      <Zap className="w-12 h-12 text-slate-500 mx-auto animate-pulse mb-3" />
                      <p className="text-slate-400 text-sm mb-2">
                        {generationStatus || 'Generating image...'}
                      </p>
                      <div className="flex items-center justify-center gap-1">
                        <div className="w-2 h-2 bg-slate-600 rounded-full animate-pulse"></div>
                        <div className="w-2 h-2 bg-slate-600 rounded-full animate-pulse" style={{animationDelay: '0.2s'}}></div>
                        <div className="w-2 h-2 bg-slate-600 rounded-full animate-pulse" style={{animationDelay: '0.4s'}}></div>
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
                <div className="mt-4 p-4 rounded-lg border border-slate-800 bg-black/40">
                  <p className="text-xs font-medium text-slate-500 mb-2 uppercase tracking-wider">Complete</p>
                  
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
                          className="bg-slate-800 hover:bg-slate-700 border border-slate-700 text-white font-bold text-xs h-8 flex items-center gap-1"
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
                      className="w-full bg-slate-800 hover:bg-slate-700 border border-slate-700 text-white font-bold text-xs h-8 flex items-center justify-center gap-1"
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
                  <h3 className="text-xs font-mono text-slate-400 uppercase tracking-wider">Session Feed</h3>
                  <span className="text-[10px] text-slate-600 font-mono">{sessionFeed.length} images</span>
                </div>
                <div className="p-2 grid grid-cols-3 gap-2">
                  {sessionFeed.slice(0, 6).map((item) => (
                    <div
                      key={item.id}
                      className={`aspect-square rounded-lg overflow-hidden border border-slate-800 transition-all ${item.loading ? 'cursor-default' : 'cursor-pointer hover:border-slate-600'}`}
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
                            <Zap className="w-6 h-6 text-slate-500 mx-auto animate-pulse" />
                            <div className="flex items-center justify-center gap-1 mt-1">
                              <div className="w-1 h-1 bg-slate-600 rounded-full animate-pulse"></div>
                              <div className="w-1 h-1 bg-slate-600 rounded-full animate-pulse" style={{animationDelay: '0.2s'}}></div>
                              <div className="w-1 h-1 bg-slate-600 rounded-full animate-pulse" style={{animationDelay: '0.4s'}}></div>
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
                <div className="p-4 rounded-xl border border-slate-800 bg-slate-900/60 backdrop-blur-sm">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="p-2.5 rounded-lg bg-slate-800">
                      <Sparkles size={18} className="text-slate-400" />
                    </div>
                    <div className="flex-1">
                      <h3 className="text-sm font-bold text-white">
                        Prompt Studio Dev
                      </h3>
                      <p className="text-[10px] text-slate-500">Unlock Pro AI Tools</p>
                    </div>
                    <svg className="w-4 h-4 text-slate-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <polyline points="9 18 15 12 9 6"></polyline>
                    </svg>
                  </div>
                  <p className="text-xs text-slate-500 mb-2">AI prompting • Canvas studio • 6 scanners • Session saves</p>
                  <div className="text-xs text-blue-400 font-medium">Tap to upgrade →</div>
                </div>
              </Link>
            ) : (
              // DEV TIER - Mobile Badge
              <Link href="/prompting-studio">
                <div className="p-3 rounded-xl border border-slate-800 bg-slate-900/60 backdrop-blur-sm">
                  <div className="flex items-center gap-3">
                    <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-800 border border-slate-700">
                      <svg className="w-3 h-3 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M10 2v7.527a2 2 0 0 1-.211.896L4.72 20.55a1 1 0 0 0 .9 1.45h12.76a1 1 0 0 0 .9-1.45l-5.069-10.127A2 2 0 0 1 14 9.527V2"></path>
                        <path d="M8.5 2h7"></path>
                        <path d="M7 16h10"></path>
                      </svg>
                      <span className="text-xs font-black text-white">DEV</span>
                    </div>
                    <div className="flex-1">
                      <h3 className="text-xs font-bold text-slate-300">
                        Prompt Studio
                      </h3>
                      <p className="text-[10px] text-slate-600">All features unlocked</p>
                    </div>
                    <svg className="w-4 h-4 text-slate-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <polyline points="9 18 15 12 9 6"></polyline>
                    </svg>
                  </div>
                </div>
              </Link>
            )}
          </div>

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

        {/* RIGHT SIDEBAR - Session Feed */}
        <aside className="hidden xl:flex xl:flex-col w-72 2xl:w-80 sticky top-4 h-[calc(100vh-2rem)]">
          <div className="rounded-xl border border-slate-800 bg-slate-900/50 backdrop-blur-sm overflow-hidden flex flex-col flex-1 min-h-0">
            <div className="px-4 py-3 border-b border-slate-800 bg-slate-900/80 flex items-center justify-between flex-shrink-0">
              <h3 className="text-xs font-mono text-slate-400 uppercase tracking-wider">Session Feed</h3>
              <span className="text-[10px] text-slate-600 font-mono">{sessionFeed.length} images</span>
            </div>

            {sessionFeed.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
                <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-slate-800/50 flex items-center justify-center">
                  <Eye size={20} className="text-slate-700" />
                </div>
                <p className="text-xs text-slate-600 mb-1">No generations yet</p>
                <p className="text-[10px] text-slate-700">Generated images will appear here</p>
              </div>
            ) : (
              <div className="flex-1 overflow-y-auto p-2 space-y-2 min-h-0">
                {sessionFeed.map((item) => (
                  <div
                    key={item.id}
                    className={`group rounded-lg border border-slate-800 bg-black/30 overflow-hidden transition-all ${item.loading ? 'cursor-default' : 'cursor-pointer hover:border-slate-600'}`}
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
                            <Zap className="w-8 h-8 text-slate-500 mx-auto animate-pulse mb-2" />
                            <p className="text-slate-400 text-[10px] mb-1">Generating...</p>
                            <div className="flex items-center justify-center gap-1">
                              <div className="w-1.5 h-1.5 bg-slate-600 rounded-full animate-pulse"></div>
                              <div className="w-1.5 h-1.5 bg-slate-600 rounded-full animate-pulse" style={{animationDelay: '0.2s'}}></div>
                              <div className="w-1.5 h-1.5 bg-slate-600 rounded-full animate-pulse" style={{animationDelay: '0.4s'}}></div>
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
                            <span className="px-1.5 py-0.5 rounded bg-black/70 text-[8px] text-slate-400 font-mono">
                              {getModelDisplayName(item.model)}
                            </span>
                          </div>

                          {/* Reference images indicator */}
                          {item.referenceImages && item.referenceImages.length > 0 && (
                            <div className="absolute top-2 left-2">
                              <span className="px-1.5 py-0.5 rounded bg-slate-700 text-[8px] text-slate-300 font-mono">
                                +{item.referenceImages.length} ref
                              </span>
                            </div>
                          )}

                          {/* Hover overlay */}
                          <div className="absolute inset-0 bg-white/5 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                            <span className="text-[10px] text-slate-300 font-medium bg-black/80 px-2 py-1 rounded">View</span>
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
            className="absolute top-4 right-4 text-slate-400 hover:text-white transition-colors z-50 bg-black/60 rounded-full p-2"
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
            className="flex-shrink-0 w-full bg-slate-900/95 border-t border-slate-800 px-4 py-3"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="max-w-4xl mx-auto">
              {/* Prompt - Single line with truncation */}
              <div className="flex items-center gap-2 mb-2">
                <Sparkles className="text-slate-500 flex-shrink-0" size={14} />
                <p className="text-white text-xs flex-1 truncate">{selectedFeedItem?.prompt || coordinates}</p>
                {/* Reference images indicator */}
                {selectedFeedItem?.referenceImages && selectedFeedItem.referenceImages.length > 0 && (
                  <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-400 text-[10px] font-mono flex-shrink-0">
                    +{selectedFeedItem.referenceImages.length} ref
                  </span>
                )}
              </div>

              {/* Info row + Action Buttons - All in one row */}
              <div className="flex items-center gap-3 flex-wrap">
                {/* Info badges */}
                {selectedFeedItem && (
                  <div className="flex items-center gap-2 text-[10px] text-slate-400 flex-shrink-0">
                    <span className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 font-mono">
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
                    className="bg-blue-600 hover:bg-blue-500 text-white font-bold py-1.5 px-3 rounded-lg flex items-center gap-1.5 text-xs"
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
                    className="bg-slate-800 hover:bg-slate-700 border border-slate-700 text-white font-bold py-1.5 px-3 rounded-lg flex items-center gap-1.5 text-xs"
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
                    className="bg-slate-800 hover:bg-slate-700 border border-slate-700 text-white font-bold py-1.5 px-3 rounded-lg flex items-center gap-1.5 text-xs"
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



















































































