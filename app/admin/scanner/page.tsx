"use client"

import { useState, useEffect, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Eye, Zap, Upload, X, Download, RefreshCw, ArrowLeft, Sparkles, Clock, Copy, Wand2, ChevronDown, Check, Film, Play, Image as ImageIcon } from "lucide-react"
import { useRouter } from "next/navigation"
import { ModelSelector } from "@/components/ModelSelector"

// Admin State interface for maintenance flags
interface AdminState {
  isMaintenanceMode: boolean
  adminScannerMaintenance: boolean
  // OLD maintenance fields (for backward compatibility)
  nanoBananaMaintenance: boolean
  nanoBananaProMaintenance: boolean
  seedreamMaintenance: boolean
  // NEW per-scanner, per-model maintenance
  adminScanner_nanoBanana?: boolean
  adminScanner_nanoBananaPro?: boolean
  adminScanner_seedream?: boolean
  adminScanner_flux2?: boolean
  adminScanner_proScannerV3?: boolean
  adminScanner_flashScannerV25?: boolean
}

// Price configuration for admin display
const MODEL_PRICES: Record<string, { '2k': string; '4k': string } | string> = {
  'nano-banana-pro': { '2k': '~15¢', '4k': '~30¢' },
  'gemini-2.0-pro-exp': { '2k': '~12¢', '4k': '~24¢' },
  'nano-banana': '~4¢',
  'seedream-4.5': '~4¢',
  'gemini-2.5-flash-image': '~4¢',
  'flux-2': '~5¢',
  'wan-2.5': 'Admin',
}

const getModelDisplayName = (model: string) => {
  const names: Record<string, string> = {
    'nano-banana-pro': 'NanoBanana Pro',
    'gemini-2.0-pro-exp': 'Pro Scanner v3',
    'nano-banana': 'NanoBanana Cluster',
    'seedream-4.5': 'SeeDream 4.5',
    'gemini-2.5-flash-image': 'Flash Scanner v2.5',
    'flux-2': 'FLUX 2',
    'wan-2.5': 'WAN 2.5',
  }
  return names[model] || model
}

const getPrice = (model: string, quality: string) => {
  const price = MODEL_PRICES[model]
  if (!price) return '~??¢'
  if (typeof price === 'string') return price
  return (price as Record<string, string>)[quality] || '~??¢'
}

interface SessionFeedItem {
  id: string
  url: string        // For images: image URL. For videos: thumbnail/input image URL
  prompt: string
  model: string
  quality: string    // For images: '2k' | '4k'. For videos: '480p' | '720p' | '1080p'
  aspectRatio: string
  timestamp: number
  type?: 'image' | 'video'
  videoUrl?: string  // Only for video type items
}

export default function AdminScannerPage() {
  const router = useRouter()
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [password, setPassword] = useState("")
  const [isLoading, setIsLoading] = useState(true)

  // Admin state for maintenance
  const [adminState, setAdminState] = useState<AdminState>({
    isMaintenanceMode: false,
    adminScannerMaintenance: false,
    nanoBananaMaintenance: false,
    nanoBananaProMaintenance: false,
    seedreamMaintenance: false,
    adminScanner_nanoBanana: false,
    adminScanner_nanoBananaPro: false,
    adminScanner_seedream: false,
    adminScanner_flux2: false,
    adminScanner_proScannerV3: false,
    adminScanner_flashScannerV25: false,
  })

  // Scanner state
  const MAX_CONCURRENT_GENERATIONS = 10
  const [coordinates, setCoordinates] = useState('')
  const [quality, setQuality] = useState<'2k' | '4k'>('2k')
  const [aspectRatio, setAspectRatio] = useState<'1:1' | '4:5' | '9:16' | '16:9'>('16:9')
  const [activeGenerations, setActiveGenerations] = useState<Set<string>>(new Set())
  const [generatedImage, setGeneratedImage] = useState<string | null>(null)
  const [generatedImages, setGeneratedImages] = useState<Array<{url: string, id: string}>>([])
  const [generationError, setGenerationError] = useState<string | null>(null)
  const [referenceImages, setReferenceImages] = useState<string[]>([])
  const [selectedModel, setSelectedModel] = useState('nano-banana-pro')
  const [showImageModal, setShowImageModal] = useState(false)
  const [selectedFeedItem, setSelectedFeedItem] = useState<SessionFeedItem | null>(null)

  // Session feed - images generated in current session (newest first)
  const [sessionFeed, setSessionFeed] = useState<SessionFeedItem[]>([])

  // Image browser modal
  const [showImageBrowser, setShowImageBrowser] = useState(false)
  const [availableImages, setAvailableImages] = useState<SessionFeedItem[]>([])
  const [selectedImages, setSelectedImages] = useState<Set<string>>(new Set())
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [isLoadingImages, setIsLoadingImages] = useState(false)

  // Scanner mode toggle
  const [scannerMode, setScannerMode] = useState<'image' | 'video'>('image')

  // Video scanner state
  const [videoPrompt, setVideoPrompt] = useState('')
  const [videoDuration, setVideoDuration] = useState<'5' | '10'>('5')
  const [videoResolution, setVideoResolution] = useState<'480p' | '720p' | '1080p'>('1080p')
  const [videoImageFile, setVideoImageFile] = useState<File | null>(null)
  const [videoImagePreviewUrl, setVideoImagePreviewUrl] = useState('')
  const [videoAudioFile, setVideoAudioFile] = useState<File | null>(null)
  const [videoAudioFileName, setVideoAudioFileName] = useState('')
  const [videoGenerationQueue, setVideoGenerationQueue] = useState(0)
  const [videoError, setVideoError] = useState<string | null>(null)

  // AI Prompt Generation Models
  const [promptModel, setPromptModel] = useState<'gemini-3-flash' | 'gemini-2.0-flash-exp' | 'gemini-3-pro' | 'gemini-exp-1206'>('gemini-3-flash')
  const [lastPromptGenTime, setLastPromptGenTime] = useState<Record<string, number>>({})
  const [promptCooldown, setPromptCooldown] = useState<number>(0)
  const [showPromptModelDropdown, setShowPromptModelDropdown] = useState(false)
  const [names, setNames] = useState<string[]>(['', '', '', '', ''])
  const [enhancements, setEnhancements] = useState<string[]>(['', '', '', '', ''])

  // Fetch admin config
  const fetchAdminConfig = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/config')
      if (res.ok) {
        const data = await res.json()
        setAdminState(data)
      }
    } catch (err) {
      console.error('Failed to fetch admin config:', err)
    }
  }, [])

  // Open image browser modal and load first page
  const openImageBrowser = async () => {
    setCurrentPage(1)
    setShowImageBrowser(true)
    await loadImagesPage(1)
  }

  // Load images for a specific page
  const loadImagesPage = async (page: number) => {
    setIsLoadingImages(true)
    try {
      const res = await fetch(`/api/my-images?limit=30&page=${page}`)
      if (res.ok) {
        const data = await res.json()
        if (data.success && data.images) {
          // Convert to session feed format
          const feedItems: SessionFeedItem[] = data.images.map((img: any) => ({
            id: img.id,
            url: img.imageUrl,
            prompt: img.prompt || '',
            model: img.model || 'unknown',
            quality: img.quality || '2k',
            aspectRatio: img.aspectRatio || '16:9',
            timestamp: new Date(img.createdAt).getTime()
          }))
          setAvailableImages(feedItems)
          if (data.pagination) {
            setTotalPages(data.pagination.totalPages)
          }
        }
      }
    } catch (err) {
      console.error('Failed to fetch images:', err)
    } finally {
      setIsLoadingImages(false)
    }
  }

  // Navigate to next/previous page
  const goToPage = async (page: number) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page)
      await loadImagesPage(page)
    }
  }

  // Add selected images to session feed
  const addImagesToSession = () => {
    const imagesToAdd = availableImages.filter(img => selectedImages.has(img.id))
    setSessionFeed(prev => {
      const combined = [...imagesToAdd, ...prev]
      // Remove duplicates based on id
      const unique = combined.filter((img, index, self) =>
        index === self.findIndex(i => i.id === img.id)
      )
      return unique.slice(0, 50)
    })
    setSelectedImages(new Set())
    setShowImageBrowser(false)
  }

  // Toggle image selection
  const toggleImageSelection = (imageId: string) => {
    setSelectedImages(prev => {
      const next = new Set(prev)
      if (next.has(imageId)) {
        next.delete(imageId)
      } else {
        next.add(imageId)
      }
      return next
    })
  }

  // Check authentication
  useEffect(() => {
    const authStatus = localStorage.getItem("multiverse-admin-auth")
    const savedPassword = sessionStorage.getItem("admin-password")

    if (authStatus === "true" && savedPassword) {
      setIsAuthenticated(true)

      // Fetch admin config
      fetchAdminConfig()

      // Check for rescan prompt
      const rescanPrompt = localStorage.getItem('admin_rescan_prompt')
      if (rescanPrompt) {
        setCoordinates(rescanPrompt)
        localStorage.removeItem('admin_rescan_prompt')
      }

      // Check for rescan reference images
      const rescanRefImages = localStorage.getItem('admin_rescan_reference_images')
      if (rescanRefImages) {
        try {
          const refUrls = JSON.parse(rescanRefImages)
          if (Array.isArray(refUrls) && refUrls.length > 0) {
            setReferenceImages(refUrls)
          }
        } catch (e) {
          console.error('Failed to parse rescan reference images:', e)
        }
        localStorage.removeItem('admin_rescan_reference_images')
      }
    }
    setIsLoading(false)
  }, [fetchAdminConfig])

  // Auto-clear reference images if model doesn't support them
  useEffect(() => {
    if (selectedModel === 'nano-banana' && referenceImages.length > 0) {
      setReferenceImages([])
    }
  }, [selectedModel, referenceImages.length])

  // Cooldown timer effect
  useEffect(() => {
    if (promptCooldown > 0) {
      const timer = setInterval(() => {
        setPromptCooldown(prev => Math.max(0, prev - 1));
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [promptCooldown])

  // Auto-save session
  useEffect(() => {
    if (!isAuthenticated) return;

    const saveTimer = setTimeout(() => {
      try {
        const sessionData = {
          coordinates,
          quality,
          aspectRatio,
          referenceImages,
          selectedModel,
          sessionFeed: sessionFeed.filter(item => item.type !== 'video' || !!item.videoUrl),
          names,
          enhancements,
          promptModel,
          scannerMode,
          videoPrompt,
          videoDuration,
          videoResolution,
          timestamp: Date.now(),
        };
        localStorage.setItem('admin-scanner-autosave', JSON.stringify(sessionData));
      } catch (err) {
        console.error('Failed to auto-save admin scanner session:', err);
      }
    }, 1000);

    return () => clearTimeout(saveTimer);
  }, [isAuthenticated, coordinates, quality, aspectRatio, referenceImages, selectedModel, sessionFeed, names, enhancements, promptModel, scannerMode, videoPrompt, videoDuration, videoResolution]);

  // Auto-restore session on mount
  useEffect(() => {
    if (!isAuthenticated) return;

    const restoreSession = async () => {
      try {
        const saved = localStorage.getItem('admin-scanner-autosave');
        if (saved) {
          const sessionData = JSON.parse(saved);
          const hoursSinceLastSave = (Date.now() - (sessionData.timestamp || 0)) / (1000 * 60 * 60);

          if (hoursSinceLastSave < 24) {
            // Restore all saved state
            if (sessionData.coordinates) setCoordinates(sessionData.coordinates);
            if (sessionData.quality) setQuality(sessionData.quality);
            if (sessionData.aspectRatio) setAspectRatio(sessionData.aspectRatio);
            if (sessionData.referenceImages) setReferenceImages(sessionData.referenceImages);
            if (sessionData.selectedModel) setSelectedModel(sessionData.selectedModel);
            if (sessionData.names) setNames(sessionData.names);
            if (sessionData.enhancements) setEnhancements(sessionData.enhancements);
            if (sessionData.promptModel) setPromptModel(sessionData.promptModel);
            if (sessionData.scannerMode) setScannerMode(sessionData.scannerMode);
            if (sessionData.videoPrompt !== undefined) setVideoPrompt(sessionData.videoPrompt);
            if (sessionData.videoDuration) setVideoDuration(sessionData.videoDuration);
            if (sessionData.videoResolution) setVideoResolution(sessionData.videoResolution);

            // Restore session feed and check for recently completed images
            const restoredImages = sessionData.sessionFeed || [];
            const existingImageIds = new Set(restoredImages.map((img: any) => img.id));

            // Fetch recent images to find any completed during refresh (last 5 minutes)
            const fiveMinutesAgo = Date.now() - (5 * 60 * 1000);
            const res = await fetch('/api/my-images?limit=20');
            if (res.ok) {
              const data = await res.json();
              if (data.success && data.images) {
                const recentNewImages = data.images
                  .filter((img: any) => {
                    const imgTime = new Date(img.createdAt).getTime();
                    return imgTime >= fiveMinutesAgo && !existingImageIds.has(img.id);
                  })
                  .map((img: any) => ({
                    id: img.id,
                    url: img.imageUrl,
                    prompt: img.prompt || '',
                    model: img.model || 'unknown',
                    quality: img.quality || '2k',
                    aspectRatio: img.aspectRatio || '16:9',
                    timestamp: new Date(img.createdAt).getTime()
                  }));

                // Combine new images with restored images (new first)
                const combinedImages = [...recentNewImages, ...restoredImages].slice(0, 50);
                setSessionFeed(combinedImages);
              } else {
                setSessionFeed(restoredImages);
              }
            } else {
              setSessionFeed(restoredImages);
            }
          }
        }
      } catch (err) {
        console.error('Failed to restore admin scanner session:', err);
      }
    };

    restoreSession();
  }, [isAuthenticated])

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

        // Fetch admin config
        fetchAdminConfig()

        // Check for rescan prompt after login
        const rescanPrompt = localStorage.getItem('admin_rescan_prompt')
        if (rescanPrompt) {
          setCoordinates(rescanPrompt)
          localStorage.removeItem('admin_rescan_prompt')
        }

        // Check for rescan reference images after login
        const rescanRefImages = localStorage.getItem('admin_rescan_reference_images')
        if (rescanRefImages) {
          try {
            const refUrls = JSON.parse(rescanRefImages)
            if (Array.isArray(refUrls) && refUrls.length > 0) {
              setReferenceImages(refUrls)
            }
          } catch (e) {
            console.error('Failed to parse rescan reference images:', e)
          }
          localStorage.removeItem('admin_rescan_reference_images')
        }
      } else {
        alert("Invalid password")
      }
    } catch (error) {
      console.error("Auth error:", error)
      alert("Authentication failed")
    }
  }

  // Helper function to check if a model is in maintenance
  const isModelInMaintenance = (modelId: string): boolean => {
    // Model ID mapping for admin scanner
    const modelMap: Record<string, keyof AdminState> = {
      'nano-banana': 'adminScanner_nanoBanana',
      'nano-banana-pro': 'adminScanner_nanoBananaPro',
      'seedream-4.5': 'adminScanner_seedream',
      'flux-2': 'adminScanner_flux2',
      'gemini-3-pro-image': 'adminScanner_proScannerV3',
      'pro-scanner-v3': 'adminScanner_proScannerV3',
      'gemini-2.5-flash-image': 'adminScanner_flashScannerV25',
      'flash-scanner-v2.5': 'adminScanner_flashScannerV25',
    }

    // Check NEW per-scanner maintenance field first
    const maintenanceField = modelMap[modelId]
    if (maintenanceField && adminState[maintenanceField]) {
      return true
    }

    // Fallback to OLD maintenance fields
    if (modelId === 'nano-banana-pro' && adminState.nanoBananaProMaintenance) return true
    if (modelId === 'nano-banana' && adminState.nanoBananaMaintenance) return true
    if (modelId === 'seedream-4.5' && adminState.seedreamMaintenance) return true

    return false
  }

  const handleGeneratePrompt = async () => {
    // Check cooldown for restricted models
    if (promptModel !== 'gemini-3-flash') {
      const lastUse = lastPromptGenTime[promptModel] || 0;
      const timeSince = (Date.now() - lastUse) / 1000;
      const cooldownSeconds = 10;

      if (timeSince < cooldownSeconds) {
        const remaining = Math.ceil(cooldownSeconds - timeSince);
        setPromptCooldown(remaining);
        return;
      }
    }

    // Combine names and enhancements
    const combinedNames = names.filter(n => n.trim()).join(', ');
    const combinedEnhancements = enhancements.filter(e => e.trim()).join(', ');
    const name = combinedNames || 'a person';
    const style = combinedEnhancements || 'photorealistic portrait';

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
      });

      const data = await res.json();
      if (data.success && data.prompt) {
        setCoordinates(data.prompt);

        // Update last use time for restricted models
        if (promptModel !== 'gemini-3-flash') {
          setLastPromptGenTime(prev => ({ ...prev, [promptModel]: Date.now() }));
        }
      } else {
        alert('Failed to generate prompt');
      }
    } catch (err) {
      console.error('Prompt generation error:', err);
      alert('Failed to generate prompt');
    }
  };

  // AI Generation handler - admin version (free generations for testing)
  const handleGenerate = async () => {
    if (!coordinates.trim()) {
      setGenerationError('Please enter universe coordinates')
      return
    }

    // Check if at concurrent generation limit
    if (activeGenerations.size >= MAX_CONCURRENT_GENERATIONS) {
      setGenerationError(`Maximum ${MAX_CONCURRENT_GENERATIONS} concurrent generations reached. Please wait for one to complete.`)
      return
    }

    // Check if model is in maintenance
    if (isModelInMaintenance(selectedModel)) {
      setGenerationError('This model is currently under maintenance. Please select a different model.')
      return
    }

    // Create unique ID for this generation
    const generationId = `gen-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`

    // Add to active generations
    setActiveGenerations(prev => new Set([...prev, generationId]))
    setGenerationError(null)

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
          adminMode: true, // Flag for admin mode - no ticket deduction
        }),
      })

      const data = await res.json()

      if (data.success) {
        // Check if multi-image response (NanoBanana Cluster returns 2 images)
        if (data.images && data.images.length > 1) {
          setGeneratedImages(data.images)
          setGeneratedImage(data.images[0].url)
          // Add all images to session feed (max 50)
          const feedItems = data.images.map((img: {url: string, id: string}) => ({
            id: img.id,
            url: img.url,
            prompt: coordinates,
            model: selectedModel,
            quality,
            aspectRatio,
            timestamp: Date.now()
          }))
          setSessionFeed(prev => [...feedItems, ...prev].slice(0, 50))
        } else {
          setGeneratedImage(data.imageUrl)
          setGeneratedImages([])
          // Add to session feed (max 50)
          setSessionFeed(prev => [{
            id: data.imageId || `img-${Date.now()}`,
            url: data.imageUrl,
            prompt: coordinates,
            model: selectedModel,
            quality,
            aspectRatio,
            timestamp: Date.now()
          }, ...prev].slice(0, 50))
        }
      } else {
        setGenerationError(data.error || 'Universe scan failed. Please try again.')
      }
    } catch (err: any) {
      console.error('Generation error:', err)
      setGenerationError('Network error. Please try again.')
    } finally {
      // Remove from active generations
      setActiveGenerations(prev => {
        const next = new Set(prev)
        next.delete(generationId)
        return next
      })
    }
  }

  const handleVideoImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setVideoImageFile(file)
    setVideoImagePreviewUrl(URL.createObjectURL(file))
  }

  const handleVideoAudioUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setVideoAudioFile(file)
    setVideoAudioFileName(file.name)
  }

  const handleGenerateVideo = async () => {
    if (!videoPrompt.trim()) {
      setVideoError('Please enter a motion prompt')
      return
    }
    if (!videoImageFile) {
      setVideoError('Please upload an image')
      return
    }

    const placeholderId = `vid-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    setVideoGenerationQueue(prev => prev + 1)
    setVideoError(null)

    const loadingItem: SessionFeedItem = {
      id: placeholderId,
      url: videoImagePreviewUrl,
      prompt: videoPrompt,
      model: 'wan-2.5',
      quality: videoResolution,
      aspectRatio: '16:9',
      timestamp: Date.now(),
      type: 'video',
      videoUrl: '',
    }
    setSessionFeed(prev => [loadingItem, ...prev].slice(0, 50))

    try {
      const imageFormData = new FormData()
      imageFormData.append('file', videoImageFile)
      const imageUploadRes = await fetch('/api/upload-reference', {
        method: 'POST',
        body: imageFormData,
      })
      const imageUploadData = await imageUploadRes.json()
      if (!imageUploadData.url) {
        throw new Error('Failed to upload image')
      }

      let audioUrl: string | undefined
      if (videoAudioFile) {
        const audioFormData = new FormData()
        audioFormData.append('file', videoAudioFile)
        const audioUploadRes = await fetch('/api/upload-audio', {
          method: 'POST',
          body: audioFormData,
        })
        const audioUploadData = await audioUploadRes.json()
        if (audioUploadData.url) audioUrl = audioUploadData.url
      }

      const res = await fetch('/api/video/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: videoPrompt,
          imageUrl: imageUploadData.url,
          duration: videoDuration,
          resolution: videoResolution,
          audioUrl,
          adminMode: true,
        }),
      })
      const data = await res.json()

      if (data.success && data.videoUrl) {
        setSessionFeed(prev =>
          prev.map(item =>
            item.id === placeholderId
              ? { ...item, videoUrl: data.videoUrl, url: imageUploadData.url }
              : item
          )
        )
      } else {
        setSessionFeed(prev => prev.filter(item => item.id !== placeholderId))
        setVideoError(data.error || 'Video generation failed')
      }
    } catch (err: any) {
      console.error('Video generation error:', err)
      setSessionFeed(prev => prev.filter(item => item.id !== placeholderId))
      setVideoError('Network error. Please try again.')
    } finally {
      setVideoGenerationQueue(prev => Math.max(0, prev - 1))
    }
  }

  // Login screen
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center">
        <div className="text-cyan-400 text-xl">Loading...</div>
      </div>
    )
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <div className="mb-8 text-center">
            <h1 className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-fuchsia-500 mb-2">
              ADMIN SCANNER
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
              ACCESS SCANNER
            </Button>
          </form>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-white p-6">
      {/* Background effects */}
      <div className="fixed inset-0 bg-[linear-gradient(rgba(0,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(0,255,255,0.02)_1px,transparent_1px)] bg-[size:40px_40px] pointer-events-none" />
      <div className="fixed top-20 left-20 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl animate-pulse pointer-events-none" />
      <div className="fixed bottom-20 right-20 w-96 h-96 bg-fuchsia-500/10 rounded-full blur-3xl animate-pulse pointer-events-none" />

      {/* Header */}
      <div className="max-w-4xl mx-auto mb-8 relative z-10">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-fuchsia-500 mb-2 flex items-center gap-3">
              <Sparkles size={32} /> ADMIN SCANNER
            </h1>
            <p className="text-slate-400 text-sm">
              Real API costs: <span className="text-cyan-400 font-mono">{getPrice(selectedModel, quality)}</span> per generation ({getModelDisplayName(selectedModel)})
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              onClick={() => router.push('/admin/images')}
              className="bg-fuchsia-500 hover:bg-fuchsia-400 text-white"
            >
              Admin Images
            </Button>
            <Button
              onClick={() => router.push('/admin')}
              className="bg-slate-800 hover:bg-slate-700 text-white"
            >
              <ArrowLeft size={16} className="mr-2" />
              Admin Panel
            </Button>
          </div>
        </div>
      </div>

      {/* Main Layout - Scanner + Session Feed */}
      <div className="max-w-7xl mx-auto relative z-10 flex gap-6">
        {/* Scanner Section */}
        <div className="flex-1 max-w-4xl">
          <div className="p-6 rounded-xl border-2 border-cyan-500/30 bg-slate-900/80 backdrop-blur-sm">
          <div className="text-center mb-4">
            <div className="flex items-center justify-center gap-3 mb-2">
              {scannerMode === 'image' ? (
                <Eye className="text-cyan-400" size={28} />
              ) : (
                <Film className="text-orange-400" size={28} />
              )}
              <h2 className="text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-fuchsia-500">
                ADMIN {scannerMode === 'image' ? 'MULTIVERSE' : 'VIDEO'} SCANNER
              </h2>
            </div>
            <p className="text-slate-400 text-xs">
              {scannerMode === 'image'
                ? <>Admin mode - No tickets required • API Cost: <span className="text-green-400 font-mono">{getPrice(selectedModel, quality)}</span></>
                : <>Admin mode - WAN 2.5 • No tickets required</>
              }
            </p>
            {/* Scanner Mode Toggle */}
            <div className="flex items-center justify-center gap-2 mt-3">
              <button
                onClick={() => setScannerMode('image')}
                className={`flex items-center gap-2 px-4 py-1.5 rounded-lg font-bold text-xs transition-all ${
                  scannerMode === 'image'
                    ? 'bg-cyan-500 text-black'
                    : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                }`}
              >
                <ImageIcon size={14} />
                Image Scanner
              </button>
              <button
                onClick={() => setScannerMode('video')}
                className={`flex items-center gap-2 px-4 py-1.5 rounded-lg font-bold text-xs transition-all ${
                  scannerMode === 'video'
                    ? 'bg-orange-500 text-black'
                    : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                }`}
              >
                <Film size={14} />
                Video Scanner
              </button>
            </div>
          </div>

          {/* Image Scanner Content */}
          {scannerMode === 'image' && (<>
          {/* Names & Enhancements - 5 each */}
          <div className="mb-4">
            <label className="text-xs text-slate-400 mb-2 block">Names (optional)</label>
            <div className="grid grid-cols-5 gap-2 mb-3">
              {names.map((name, idx) => (
                <input
                  key={`name-${idx}`}
                  value={name}
                  onChange={(e) => {
                    const newNames = [...names];
                    newNames[idx] = e.target.value;
                    setNames(newNames);
                  }}
                  placeholder={`Name ${idx + 1}...`}
                  className="w-full px-2 py-1.5 bg-slate-950 border border-slate-700 rounded text-white text-xs focus:border-cyan-500 focus:outline-none"
                />
              ))}
            </div>
            <label className="text-xs text-slate-400 mb-2 block">Enhancements (optional)</label>
            <div className="grid grid-cols-5 gap-2">
              {enhancements.map((enhancement, idx) => (
                <input
                  key={`enhancement-${idx}`}
                  value={enhancement}
                  onChange={(e) => {
                    const newEnhancements = [...enhancements];
                    newEnhancements[idx] = e.target.value;
                    setEnhancements(newEnhancements);
                  }}
                  placeholder={`Enhancement ${idx + 1}...`}
                  className="w-full px-2 py-1.5 bg-slate-950 border border-slate-700 rounded text-white text-xs focus:border-cyan-500 focus:outline-none"
                />
              ))}
            </div>
          </div>

          {/* Coordinates Input */}
          <div className="mb-4">
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-bold text-cyan-400 uppercase tracking-wider">
                Universe Coordinates
              </label>
              <div className="flex items-center gap-2">
                {/* Prompt Model Selector */}
                <div className="relative">
                  <button
                    onClick={() => setShowPromptModelDropdown(!showPromptModelDropdown)}
                    className="px-3 py-1 bg-purple-600 text-white rounded font-bold text-xs flex items-center gap-1 h-7"
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
                          setPromptModel('gemini-3-flash');
                          setShowPromptModelDropdown(false);
                        }}
                        className={`w-full px-3 py-2 text-left text-xs font-bold hover:bg-slate-700 transition-colors ${
                          promptModel === 'gemini-3-flash' ? 'bg-purple-600 text-white' : 'text-slate-300'
                        }`}
                      >
                        Gemini 3 Flash
                      </button>
                      <button
                        onClick={() => {
                          setPromptModel('gemini-2.0-flash-exp');
                          setShowPromptModelDropdown(false);
                        }}
                        className={`w-full px-3 py-2 text-left text-xs font-bold hover:bg-slate-700 transition-colors ${
                          promptModel === 'gemini-2.0-flash-exp' ? 'bg-purple-600 text-white' : 'text-slate-300'
                        }`}
                      >
                        Gemini 2 Exp
                      </button>
                      <button
                        onClick={() => {
                          setPromptModel('gemini-3-pro');
                          setShowPromptModelDropdown(false);
                        }}
                        className={`w-full px-3 py-2 text-left text-xs font-bold hover:bg-slate-700 transition-colors ${
                          promptModel === 'gemini-3-pro' ? 'bg-purple-600 text-white' : 'text-slate-300'
                        }`}
                      >
                        Gemini 3 Pro
                      </button>
                      <button
                        onClick={() => {
                          setPromptModel('gemini-exp-1206');
                          setShowPromptModelDropdown(false);
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
                  disabled={promptCooldown > 0}
                  size="sm"
                  className="bg-purple-600 hover:bg-purple-500 disabled:opacity-50 h-7 text-xs px-2"
                  title={promptCooldown > 0 ? `Cooldown: ${promptCooldown}s` : ''}
                >
                  <Wand2 size={12} className="mr-1" />
                  {promptCooldown > 0 ? `${promptCooldown}s` : 'Generate'}
                </Button>
              </div>
            </div>
            <textarea
              value={coordinates}
              onChange={(e) => setCoordinates(e.target.value)}
              placeholder="Describe the universe you want to scan..."
              className="w-full h-24 p-3 rounded-lg bg-slate-950 border-2 border-slate-700 focus:border-cyan-500 text-white placeholder:text-slate-600 focus:outline-none resize-none text-sm"
              disabled={false}
            />
          </div>

          {/* Reference Images Upload */}
          {selectedModel !== 'nano-banana' && (
            <div className="mb-4">
              <label className="block text-xs font-bold text-slate-400 mb-2 uppercase">
                Reference Images (Optional)
              </label>
              <div className="space-y-2">
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

                        const compressedBase64 = await new Promise<string>((resolve) => {
                          const reader = new FileReader()
                          reader.onload = (e) => {
                            const img = new Image()
                            img.onload = () => {
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

                              resolve(canvas.toDataURL('image/jpeg', 0.85))
                            }
                            img.src = e.target?.result as string
                          }
                          reader.readAsDataURL(file)
                        })
                        newImages.push(compressedBase64)
                      }
                      setReferenceImages([...referenceImages, ...newImages].slice(0, 3))
                    }}
                    className="hidden"
                    id="admin-reference-upload"
                    disabled={false}
                  />
                  <label
                    htmlFor="admin-reference-upload"
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
              </div>
            </div>
          )}

          {/* Model Selector */}
          <div className="mb-4">
            <label className="block text-xs font-bold text-slate-400 mb-2 uppercase">AI Model</label>
            <ModelSelector
              selectedModel={selectedModel}
              onModelSelect={setSelectedModel}
              userTickets={9999} // Admin has unlimited
              // OLD maintenance fields (for backward compatibility)
              nanoBananaMaintenance={adminState.nanoBananaMaintenance}
              nanoBananaProMaintenance={adminState.nanoBananaProMaintenance}
              seedreamMaintenance={adminState.seedreamMaintenance}
              // NEW per-scanner maintenance fields
              mainScanner_nanoBanana={adminState.adminScanner_nanoBanana}
              mainScanner_nanoBananaPro={adminState.adminScanner_nanoBananaPro}
              mainScanner_seedream={adminState.adminScanner_seedream}
              mainScanner_flux2={adminState.adminScanner_flux2}
              mainScanner_proScannerV3={adminState.adminScanner_proScannerV3}
              mainScanner_flashScannerV25={adminState.adminScanner_flashScannerV25}
            />
          </div>

          {/* Scan Parameters */}
          <div className={`grid gap-3 mb-4 ${(selectedModel === 'nano-banana' || selectedModel === 'gemini-2.5-flash-image' || selectedModel === 'flux-2') ? 'grid-cols-1' : 'grid-cols-2'}`}>
            {/* Quality - Hide for NanoBanana Cluster, Flash Scanner v2.5, and FLUX 2 */}
            {selectedModel !== 'nano-banana' && selectedModel !== 'gemini-2.5-flash-image' && selectedModel !== 'flux-2' && (
              <div>
                <label className="block text-xs font-bold text-slate-400 mb-2 uppercase">
                  Resolution
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {(['2k', '4k'] as const).map((q) => (
                    <button
                      key={q}
                      onClick={() => setQuality(q)}
                      disabled={false}
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
                    disabled={false}
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
            disabled={activeGenerations.size >= MAX_CONCURRENT_GENERATIONS || !coordinates.trim()}
            className="w-full h-12 text-sm font-black bg-gradient-to-r from-cyan-500 to-fuchsia-500 hover:from-cyan-400 hover:to-fuchsia-400 text-black disabled:opacity-50"
          >
            {activeGenerations.size > 0 ? (
              <>
                <Zap className="mr-2 animate-pulse" size={20} />
                SCANNING ({activeGenerations.size}/{MAX_CONCURRENT_GENERATIONS})
              </>
            ) : (
              <>
                <Eye className="mr-2" size={20} />
                SCAN UNIVERSE ({getPrice(selectedModel, quality)})
              </>
            )}
          </Button>

          {/* Loading State */}
          {activeGenerations.size > 0 && (
            <div className="mt-4 p-4 rounded-lg border border-cyan-500/30 bg-slate-950">
              <div className="relative aspect-video rounded-lg overflow-hidden bg-slate-900 mb-3 flex items-center justify-center">
                <div className="text-center">
                  <Zap className="w-12 h-12 text-cyan-400 mx-auto animate-pulse mb-3" />
                  <p className="text-slate-400 text-sm mb-2">Generating {activeGenerations.size} image{activeGenerations.size > 1 ? 's' : ''}...</p>
                  <div className="flex items-center justify-center gap-1">
                    <div className="w-2 h-2 bg-cyan-500 rounded-full animate-pulse"></div>
                    <div className="w-2 h-2 bg-cyan-500 rounded-full animate-pulse" style={{animationDelay: '0.2s'}}></div>
                    <div className="w-2 h-2 bg-cyan-500 rounded-full animate-pulse" style={{animationDelay: '0.4s'}}></div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Generated Image Display */}
          {generatedImage && activeGenerations.size === 0 && (
            <div className="mt-4 p-4 rounded-lg border border-cyan-500/30 bg-slate-950">
              <p className="text-xs font-bold text-cyan-400 mb-2 uppercase">Universe Scan Complete</p>

              {/* Multi-image display */}
              {generatedImages.length > 1 ? (
                <div className="grid grid-cols-2 gap-3 mb-3">
                  {generatedImages.map((img, idx) => (
                    <div key={img.id} className="space-y-2">
                      <div className="relative aspect-square rounded-lg overflow-hidden bg-slate-900">
                        <img src={img.url} alt={`Generated ${idx + 1}`} className="w-full h-full object-contain" />
                      </div>
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
                  <div className="relative aspect-video rounded-lg overflow-hidden bg-slate-900 mb-3">
                    <img src={generatedImage} alt="Generated" className="w-full h-full object-contain" />
                  </div>
                  <div className="flex gap-2">
                    <a href={generatedImage} download className="flex-1">
                      <Button className="w-full bg-slate-800 hover:bg-slate-700 text-xs h-8">
                        <Download className="w-4 h-4 mr-2" />
                        Download
                      </Button>
                    </a>
                    <Button
                      onClick={() => {
                        setGeneratedImage(null)
                        setGeneratedImages([])
                      }}
                      className="bg-fuchsia-500 hover:bg-fuchsia-400 text-white font-bold text-xs h-8 flex items-center gap-1"
                    >
                      <RefreshCw className="w-3 h-3" />
                      Rescan
                    </Button>
                  </div>
                </>
              )}

              {/* Rescan button for multi-image */}
              {generatedImages.length > 1 && (
                <Button
                  onClick={() => {
                    setGeneratedImage(null)
                    setGeneratedImages([])
                  }}
                  className="w-full bg-fuchsia-500 hover:bg-fuchsia-400 text-white font-bold text-xs h-8 flex items-center justify-center gap-1 mt-3"
                >
                  <RefreshCw className="w-3 h-3" />
                  Rescan
                </Button>
              )}
            </div>
          )}
          </>)}

          {/* Video Scanner Mode */}
          {scannerMode === 'video' && (<>
          {/* Input Image Upload */}
          <div className="mb-4">
            <label className="block text-xs font-bold text-slate-400 mb-2 uppercase">
              Input Image (First Frame)
            </label>
            {!videoImagePreviewUrl ? (
              <label className="flex flex-col items-center justify-center p-6 border-2 border-dashed border-orange-500/30 rounded-lg cursor-pointer hover:border-orange-400 hover:bg-orange-500/5 transition-all">
                <Upload className="text-orange-400 mb-2" size={32} />
                <span className="text-sm text-slate-400">Upload image (first frame)</span>
                <span className="text-xs text-slate-500 mt-1">JPEG, PNG, BMP, WEBP (max 10MB)</span>
                <input
                  type="file"
                  accept="image/jpeg,image/jpg,image/png,image/bmp,image/webp"
                  onChange={handleVideoImageUpload}
                  className="hidden"
                />
              </label>
            ) : (
              <div className="relative w-full max-h-48 flex items-center justify-center bg-slate-950 rounded-lg overflow-hidden">
                <img src={videoImagePreviewUrl} alt="Preview" className="max-h-48 max-w-full object-contain rounded-lg" />
                <button
                  onClick={() => { setVideoImageFile(null); setVideoImagePreviewUrl('') }}
                  className="absolute top-2 right-2 p-1 bg-red-500 hover:bg-red-400 rounded-full"
                  type="button"
                >
                  <X size={12} className="text-white" />
                </button>
              </div>
            )}
          </div>

          {/* Motion Prompt */}
          <div className="mb-4">
            <label className="text-xs font-bold text-orange-400 mb-2 block uppercase tracking-wider">
              Motion Prompt
            </label>
            <textarea
              value={videoPrompt}
              onChange={(e) => setVideoPrompt(e.target.value)}
              placeholder="Describe the desired motion... (e.g., 'The camera slowly zooms in while the subject smiles')"
              className="w-full h-24 p-3 rounded-lg bg-slate-950 border-2 border-slate-700 focus:border-orange-500 text-white placeholder:text-slate-600 focus:outline-none resize-none text-sm"
              maxLength={800}
            />
            <p className="text-xs text-slate-500 mt-1">{videoPrompt.length}/800 characters</p>
          </div>

          {/* Duration & Resolution */}
          <div className="grid grid-cols-2 gap-3 mb-4">
            <div>
              <label className="text-xs text-slate-400 mb-2 block uppercase">Duration</label>
              <div className="flex gap-2">
                <button
                  onClick={() => setVideoDuration('5')}
                  className={`flex-1 py-2 rounded-lg font-bold text-xs transition-all ${videoDuration === '5' ? 'bg-orange-600 text-white' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'}`}
                >5s</button>
                <button
                  onClick={() => setVideoDuration('10')}
                  className={`flex-1 py-2 rounded-lg font-bold text-xs transition-all ${videoDuration === '10' ? 'bg-orange-600 text-white' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'}`}
                >10s</button>
              </div>
            </div>
            <div>
              <label className="text-xs text-slate-400 mb-2 block uppercase">Resolution</label>
              <div className="flex gap-1">
                {(['480p', '720p', '1080p'] as const).map((res) => (
                  <button
                    key={res}
                    onClick={() => setVideoResolution(res)}
                    className={`flex-1 py-2 rounded-lg font-bold text-xs transition-all ${videoResolution === res ? 'bg-orange-600 text-white' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'}`}
                  >{res}</button>
                ))}
              </div>
            </div>
          </div>

          {/* Audio Upload (Optional) */}
          <div className="mb-4">
            <label className="text-xs text-slate-400 mb-2 block uppercase">Background Audio (Optional)</label>
            <div className="flex items-center gap-2">
              <label className="flex items-center gap-2 px-3 py-2 bg-slate-800 hover:bg-slate-700 rounded cursor-pointer text-xs text-slate-300">
                <Upload size={14} />
                {videoAudioFileName || 'Upload Audio'}
                <input
                  type="file"
                  accept="audio/wav,audio/mp3"
                  onChange={handleVideoAudioUpload}
                  className="hidden"
                />
              </label>
              {videoAudioFile && (
                <button
                  onClick={() => { setVideoAudioFile(null); setVideoAudioFileName('') }}
                  className="p-1.5 bg-red-500 hover:bg-red-400 rounded"
                  type="button"
                >
                  <X size={12} className="text-white" />
                </button>
              )}
            </div>
            <p className="text-xs text-slate-500 mt-1">WAV or MP3, max 15MB</p>
          </div>

          {videoError && (
            <div className="mb-4 p-3 rounded-lg border border-red-500/30 bg-red-500/10 text-red-400 text-xs">
              {videoError}
            </div>
          )}

          <Button
            onClick={handleGenerateVideo}
            disabled={videoGenerationQueue > 0 || !videoPrompt.trim() || !videoImageFile}
            className="w-full h-12 text-sm font-black bg-gradient-to-r from-orange-500 to-yellow-500 hover:from-orange-400 hover:to-yellow-400 text-black disabled:opacity-50"
          >
            {videoGenerationQueue > 0 ? (
              <>
                <Film className="mr-2 animate-pulse" size={20} />
                GENERATING VIDEO (WAN 2.5)...
              </>
            ) : (
              <>
                <Film className="mr-2" size={20} />
                GENERATE VIDEO (WAN 2.5) • Admin Free
              </>
            )}
          </Button>
          </>)}
        </div>
      </div>

        {/* SESSION FEED SIDEBAR */}
        <aside className="hidden xl:block w-[600px] sticky top-4 self-start">
          <div className="rounded-xl border border-slate-800/50 bg-slate-900/60 backdrop-blur-sm overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-800/50 bg-slate-900/80">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-xs font-mono text-cyan-400 uppercase tracking-wider flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-cyan-500 animate-pulse"></span>
                  Session Feed
                </h3>
                <Button
                  onClick={openImageBrowser}
                  size="sm"
                  className="bg-cyan-600 hover:bg-cyan-500 h-6 text-[10px] px-2"
                >
                  <Download size={10} className="mr-1" />
                  Add Images
                </Button>
              </div>
              <p className="text-[10px] text-slate-500 font-mono">
                {sessionFeed.length}/50 items
              </p>
            </div>

            {sessionFeed.length === 0 ? (
              <div className="p-6 text-center">
                <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-slate-800/50 flex items-center justify-center">
                  <Sparkles className="w-6 h-6 text-slate-600" />
                </div>
                <p className="text-xs text-slate-500">No images yet</p>
                <p className="text-[10px] text-slate-600 mt-1">Generated images will appear here</p>
              </div>
            ) : (
              <div className="p-2 grid grid-cols-2 gap-2 max-h-[calc(100vh-200px)] overflow-y-auto">
                {sessionFeed.map((item) => (
                  <div
                    key={item.id}
                    className={`group relative rounded-lg overflow-hidden border border-slate-800/50 hover:border-cyan-500/30 transition-all ${
                      item.type === 'video' && !item.videoUrl ? 'cursor-default' : 'cursor-pointer'
                    }`}
                    onClick={() => {
                      if (item.type === 'video' && !item.videoUrl) return
                      setSelectedFeedItem(item)
                      setShowImageModal(true)
                    }}
                  >
                    <div className="aspect-square bg-slate-950">
                      <img
                        src={item.url}
                        alt={item.prompt}
                        className="w-full h-full object-cover"
                        loading="lazy"
                      />
                    </div>
                    {/* Video indicator overlay */}
                    {item.type === 'video' && (
                      <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                        {item.videoUrl ? (
                          <div className="w-8 h-8 rounded-full bg-black/60 flex items-center justify-center">
                            <Play size={16} className="text-white ml-0.5" />
                          </div>
                        ) : (
                          <div className="text-center">
                            <Film size={18} className="text-orange-400 animate-pulse mx-auto" />
                            <p className="text-[9px] text-orange-400 mt-0.5">Generating...</p>
                          </div>
                        )}
                      </div>
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
                      <div className="absolute bottom-0 left-0 right-0 p-2">
                        <p className="text-[10px] text-white line-clamp-2">{item.prompt}</p>
                        <p className="text-[8px] text-cyan-400 mt-1">{getModelDisplayName(item.model)}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </aside>
      </div>

      {/* Full Screen Image Modal with Details */}
      {showImageModal && selectedFeedItem && (
        <div
          className="fixed inset-0 bg-black/90 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={() => {
            setShowImageModal(false)
            setSelectedFeedItem(null)
          }}
        >
          <div
            className="max-w-5xl w-full bg-slate-900 rounded-2xl border-2 border-cyan-500/30 overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close Button */}
            <button
              onClick={() => {
                setShowImageModal(false)
                setSelectedFeedItem(null)
              }}
              className="absolute top-4 right-4 text-white hover:text-cyan-400 transition-colors z-10"
            >
              <X size={32} />
            </button>

            {/* Image or Video */}
            <div className="max-h-[60vh] overflow-hidden bg-slate-950">
              {selectedFeedItem.type === 'video' && selectedFeedItem.videoUrl ? (
                <video
                  src={selectedFeedItem.videoUrl}
                  controls
                  autoPlay
                  loop
                  className="w-full max-h-[60vh] object-contain"
                />
              ) : (
                <img
                  src={selectedFeedItem.url}
                  alt={selectedFeedItem.prompt}
                  className="w-full h-full object-contain"
                />
              )}
            </div>

            {/* Details */}
            <div className="p-6">
              <div className="flex items-start gap-4 mb-4">
                <Sparkles className="text-cyan-400 flex-shrink-0" size={20} />
                <div className="flex-1">
                  <p className="text-white text-sm mb-3">{selectedFeedItem.prompt}</p>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs text-slate-400">
                    <div>
                      <span className="font-bold text-slate-300">Model:</span>
                      <span className="ml-2 px-2 py-1 rounded bg-cyan-500/20 text-cyan-400 font-mono">
                        {getModelDisplayName(selectedFeedItem.model)}
                      </span>
                    </div>
                    <div>
                      <span className="font-bold text-slate-300">{selectedFeedItem.type === 'video' ? 'Resolution:' : 'Quality:'}</span>
                      <span className="ml-2">{selectedFeedItem.quality}</span>
                    </div>
                    <div>
                      <span className="font-bold text-slate-300">Dimensions:</span>
                      <span className="ml-2">{selectedFeedItem.aspectRatio}</span>
                    </div>
                    <div>
                      <span className="font-bold text-slate-300">Cost:</span>
                      <span className="ml-2 text-green-400 font-mono">
                        {selectedFeedItem.type === 'video' ? 'Admin Free' : getPrice(selectedFeedItem.model, selectedFeedItem.quality)}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-slate-500 mt-3">
                    <Clock size={12} />
                    <span>Generated: {new Date(selectedFeedItem.timestamp).toLocaleString()}</span>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <a
                  href={selectedFeedItem.type === 'video' ? selectedFeedItem.videoUrl : selectedFeedItem.url}
                  download
                  className="bg-cyan-500 hover:bg-cyan-400 text-black font-bold py-3 px-4 rounded-lg flex items-center justify-center gap-2"
                >
                  <Download size={16} />
                  Download
                </a>
                <button
                  onClick={() => {
                    if (selectedFeedItem.type === 'video') {
                      setVideoPrompt(selectedFeedItem.prompt)
                      setVideoResolution(selectedFeedItem.quality as '480p' | '720p' | '1080p')
                      setScannerMode('video')
                    } else {
                      setCoordinates(selectedFeedItem.prompt)
                      setSelectedModel(selectedFeedItem.model)
                      setQuality(selectedFeedItem.quality as '2k' | '4k')
                      setAspectRatio(selectedFeedItem.aspectRatio as '1:1' | '4:5' | '9:16' | '16:9')
                    }
                    setShowImageModal(false)
                    setSelectedFeedItem(null)
                    window.scrollTo({ top: 0, behavior: 'smooth' })
                  }}
                  className="bg-fuchsia-600 hover:bg-fuchsia-500 text-white font-bold py-3 px-4 rounded-lg flex items-center justify-center gap-2"
                >
                  <RefreshCw size={16} />
                  Rescan
                </button>
                <button
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(selectedFeedItem.prompt)
                      alert('Prompt copied!')
                    } catch (err) {
                      try {
                        const textArea = document.createElement('textarea')
                        textArea.value = selectedFeedItem.prompt
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
                  className="bg-purple-600 hover:bg-purple-500 text-white font-bold py-3 px-4 rounded-lg flex items-center justify-center gap-2"
                >
                  <Copy size={16} />
                  Copy Prompt
                </button>
                <Button
                  onClick={() => {
                    setShowImageModal(false)
                    setSelectedFeedItem(null)
                  }}
                  className="bg-slate-800 hover:bg-slate-700 h-full"
                >
                  Close
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Image Browser Modal */}
      {showImageBrowser && (
        <div
          className="fixed inset-0 bg-black/90 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={() => {
            setShowImageBrowser(false)
            setSelectedImages(new Set())
          }}
        >
          <div
            className="max-w-6xl w-full h-[80vh] bg-slate-900 rounded-2xl border-2 border-cyan-500/30 overflow-hidden flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-white">Add Images to Session</h2>
                <p className="text-xs text-slate-400 mt-1">
                  Select up to {50 - sessionFeed.length} images ({selectedImages.size} selected)
                </p>
              </div>
              <button
                onClick={() => {
                  setShowImageBrowser(false)
                  setSelectedImages(new Set())
                }}
                className="text-white hover:text-cyan-400 transition-colors"
              >
                <X size={24} />
              </button>
            </div>

            {/* Image Grid */}
            <div className="flex-1 overflow-y-auto p-4">
              {isLoadingImages ? (
                <div className="flex items-center justify-center h-full">
                  <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-4 border-cyan-500 border-t-transparent mx-auto mb-4" />
                    <p className="text-slate-400">Loading images...</p>
                  </div>
                </div>
              ) : availableImages.length === 0 ? (
                <div className="flex items-center justify-center h-full">
                  <p className="text-slate-500">No images available</p>
                </div>
              ) : (
                <div className="grid grid-cols-4 gap-3">
                  {availableImages.map((item) => {
                    const isSelected = selectedImages.has(item.id)
                    const isInSession = sessionFeed.some(img => img.id === item.id)
                    const canSelect = !isInSession && (isSelected || sessionFeed.length + selectedImages.size < 50)

                    return (
                      <div
                        key={item.id}
                        className={`relative rounded-lg overflow-hidden border-2 transition-all cursor-pointer ${
                          isSelected
                            ? 'border-cyan-500 ring-2 ring-cyan-500/50'
                            : isInSession
                            ? 'border-green-500 opacity-50 cursor-not-allowed'
                            : canSelect
                            ? 'border-slate-700 hover:border-cyan-500/50'
                            : 'border-slate-800 opacity-30 cursor-not-allowed'
                        }`}
                        onClick={() => {
                          if (!isInSession && canSelect) {
                            toggleImageSelection(item.id)
                          }
                        }}
                      >
                        <div className="aspect-square bg-slate-950">
                          <img
                            src={item.url}
                            alt={item.prompt}
                            className="w-full h-full object-cover"
                            loading="lazy"
                          />
                        </div>
                        {isSelected && (
                          <div className="absolute top-2 right-2 w-6 h-6 bg-cyan-500 rounded-full flex items-center justify-center">
                            <Check size={16} className="text-white" />
                          </div>
                        )}
                        {isInSession && (
                          <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                            <span className="text-xs font-bold text-green-400">IN SESSION</span>
                          </div>
                        )}
                        <div className="absolute bottom-0 left-0 right-0 p-2 bg-gradient-to-t from-black/80 to-transparent">
                          <p className="text-[10px] text-white line-clamp-1">{item.prompt}</p>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Footer Actions */}
            <div className="px-6 py-4 border-t border-slate-800 flex items-center justify-between">
              <Button
                onClick={() => {
                  setShowImageBrowser(false)
                  setSelectedImages(new Set())
                }}
                className="bg-slate-800 hover:bg-slate-700"
              >
                Cancel
              </Button>

              {/* Pagination Controls */}
              <div className="flex items-center gap-2">
                <Button
                  onClick={() => goToPage(currentPage - 1)}
                  disabled={currentPage === 1 || isLoadingImages}
                  className="bg-slate-700 hover:bg-slate-600 disabled:opacity-50 px-3"
                  size="sm"
                >
                  Previous
                </Button>
                <span className="text-sm text-slate-400 px-2">
                  Page {currentPage} of {totalPages}
                </span>
                <Button
                  onClick={() => goToPage(currentPage + 1)}
                  disabled={currentPage === totalPages || isLoadingImages}
                  className="bg-slate-700 hover:bg-slate-600 disabled:opacity-50 px-3"
                  size="sm"
                >
                  Next
                </Button>
              </div>

              <Button
                onClick={addImagesToSession}
                disabled={selectedImages.size === 0}
                className="bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50"
              >
                Add {selectedImages.size} Image{selectedImages.size !== 1 ? 's' : ''} to Session
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
