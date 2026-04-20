"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import Link from "next/link"
import ChatWidget from "@/components/ChatWidget"
import { Image, Video, Type, ChevronDown, Ticket, User, BookMarked, ImagePlus, X, Plus, Check, Copy, Download, RotateCcw, ShoppingBag, SlidersHorizontal, Bell, AlertTriangle, CheckCircle, Info, Sparkles, Music, BookOpen, Star, Trash2 } from "lucide-react"

// --- TYPES ---
interface UserData {
  id: number
  email: string
  ticketBalance: number
}

interface ImageItem {
  id: number
  imageUrl: string
  prompt: string
  model: string
  createdAt?: string
  referenceImageUrls?: string[]
  failed?: boolean
  failError?: string
  aspectRatio?: string
  quality?: string
  videoMetadata?: Record<string, any>
}

type AspectRatio = "auto" | "1:1" | "2:3" | "3:2" | "4:5" | "5:4" | "3:4" | "4:3" | "9:16" | "16:9" | "21:9"
type Quality = "1k" | "2k" | "3k" | "4k"

// --- IMAGE MODEL CONFIG ---
interface ImageModelConfig {
  id: string       // internal ID used by our UI
  apiId: string    // ID sent to /api/generate
  name: string
  aspectRatios: AspectRatio[]
  supportsQuality: boolean
  qualityOptions?: Quality[]       // custom quality options (defaults to ["2k","4k"])
  maxReferenceImages: number
  requiresReferenceImage?: boolean // if true, at least 1 ref image required
  supportsOutputFormat?: boolean   // shows png/jpeg/webp picker
  isFal: boolean   // true = async FAL queue; false = sync Gemini
  maxImages?: number               // if > 1, shows image count picker
}

const IMAGE_MODEL_CONFIGS: ImageModelConfig[] = [
  { id: "nano-banana-pro",      apiId: "nano-banana-pro",          name: "NanoBanana Pro",      aspectRatios: ["1:1", "2:3", "3:2", "4:5", "3:4", "4:3", "9:16", "16:9"], supportsQuality: true,  maxReferenceImages: 8,  isFal: true,  maxImages: 4 },
  { id: "nano-banana-pro-2",    apiId: "nano-banana-pro-2",        name: "NanoBanana Pro 2",    aspectRatios: ["auto", "1:1", "16:9", "9:16", "4:3", "3:4", "3:2", "2:3", "4:5", "5:4", "21:9"], supportsQuality: true, supportsOutputFormat: true, maxReferenceImages: 14, isFal: false, maxImages: 4 },
  { id: "kling-v3-image",       apiId: "kling-v3-image",           name: "Kling V3",            aspectRatios: ["16:9", "9:16", "1:1", "4:3", "3:4", "3:2", "2:3", "21:9"], supportsQuality: true, qualityOptions: ["1k", "2k"], maxReferenceImages: 1, isFal: false, maxImages: 4 },
  { id: "kling-o3-image",       apiId: "kling-o3-image",           name: "Kling O3",            aspectRatios: ["auto", "16:9", "9:16", "1:1", "4:3", "3:4", "3:2", "2:3", "21:9"], supportsQuality: true, qualityOptions: ["1k", "2k", "4k"], maxReferenceImages: 10, isFal: false, maxImages: 4 },
  { id: "seedream-4.5",         apiId: "seedream-4.5",             name: "SeeDream 4.5",        aspectRatios: ["1:1", "2:3", "3:2", "4:5", "3:4", "4:3", "9:16", "16:9"], supportsQuality: true,  maxReferenceImages: 8,  isFal: true,  maxImages: 4 },
  { id: "seedream-5-lite",      apiId: "seedream-5-lite",          name: "SeeDream 5.0 Lite",   aspectRatios: ["1:1", "16:9", "9:16", "4:3", "3:4", "4:5"],                     supportsQuality: true,  qualityOptions: ["2k", "3k"], maxReferenceImages: 10, isFal: false, maxImages: 4 },
  { id: "wan-2.7-pro",          apiId: "wan-2.7-pro",              name: "Wan 2.7 Pro",         aspectRatios: ["1:1", "4:3", "16:9", "3:4", "9:16"],                     supportsQuality: false, maxReferenceImages: 4,  isFal: false, maxImages: 4 },
  { id: "flux-2",               apiId: "flux-2",                   name: "FLUX 2",              aspectRatios: ["1:1", "4:5", "9:16", "16:9"],                            supportsQuality: false, maxReferenceImages: 4,  isFal: true  },
  { id: "pro-scanner-v3",       apiId: "gemini-3-pro-image",       name: "Pro Scanner v3",      aspectRatios: ["1:1", "2:3", "3:2", "4:5", "3:4", "4:3", "9:16", "16:9"], supportsQuality: true,  maxReferenceImages: 8,  isFal: false },
  { id: "flash-scanner-v2.5",   apiId: "gemini-2.5-flash-image",   name: "Flash Scanner v2.5",  aspectRatios: ["1:1", "4:5", "9:16", "16:9"],                            supportsQuality: false, maxReferenceImages: 4,  isFal: false },
]

// --- HELPERS ---
function calcTicketCost(modelId: string, quality: Quality): number {
  if (modelId === "nano-banana-pro")     return quality === "4k" ? 12 : 6
  if (modelId === "nano-banana-pro-2")   return quality === "4k" ? 8 : 5
  if (modelId === "seedream-4.5")        return quality === "4k" ? 2 : 1
  if (modelId === "seedream-5-lite")     return quality === "3k" ? 2 : 1
  if (modelId === "flux-2")             return 1
  if (modelId === "kling-v3-image")     return 2
  if (modelId === "kling-o3-image")     return quality === "4k" ? 4 : 2
  if (modelId === "wan-2.7-pro")        return 4
  if (modelId === "pro-scanner-v3")     return quality === "4k" ? 10 : 5
  if (modelId === "flash-scanner-v2.5") return 1
  return 1
}

// SeeDream 5.0 Lite: combines quality + aspect ratio into image_size params.
// Returns fields to spread directly into the API request body.
function seedream5LiteImageSize(quality: Quality, aspectRatio: AspectRatio): Record<string, string | number> {
  const base = quality === "3k" ? 3072 : 2048
  if (aspectRatio === "1:1") {
    return { image_size: quality === "3k" ? "auto_3K" : "auto_2K" }
  }
  const [wStr, hStr] = aspectRatio.split(":")
  const wRatio = parseInt(wStr)
  const hRatio = parseInt(hStr)
  let width: number, height: number
  if (wRatio >= hRatio) { // landscape
    width = base
    height = Math.round((base * hRatio) / wRatio)
  } else { // portrait
    height = base
    width = Math.round((base * wRatio) / hRatio)
  }
  return { image_size: "custom", custom_width: width, custom_height: height }
}

function getModelDisplayName(apiId: string): string {
  return IMAGE_MODEL_CONFIGS.find((m) => m.apiId === apiId)?.name ?? apiId
}

function copyToClipboard(text: string): Promise<void> {
  if (navigator.clipboard?.writeText) {
    return navigator.clipboard.writeText(text)
  }
  // iOS Safari fallback
  return new Promise((resolve, reject) => {
    const ta = document.createElement("textarea")
    ta.value = text
    ta.style.cssText = "position:fixed;top:0;left:0;opacity:0"
    document.body.appendChild(ta)
    ta.focus()
    ta.select()
    try {
      document.execCommand("copy") ? resolve() : reject(new Error("execCommand failed"))
    } catch (e) { reject(e) }
    finally { document.body.removeChild(ta) }
  })
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

// Compress a File to a persistent data URL (survives page refresh, storable in localStorage)
async function compressFileToDataUrl(file: File, maxSize = 800, quality = 0.72): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (ev) => {
      const img = new window.Image()
      img.onload = () => {
        let w = img.width, h = img.height
        if (w > maxSize || h > maxSize) {
          if (w > h) { h = (h / w) * maxSize; w = maxSize } else { w = (w / h) * maxSize; h = maxSize }
        }
        const canvas = document.createElement("canvas")
        canvas.width = w; canvas.height = h
        const ctx = canvas.getContext("2d")
        if (!ctx) { reject(new Error("Canvas unavailable")); return }
        ctx.drawImage(img, 0, 0, w, h)
        const result = canvas.toDataURL("image/jpeg", quality)
        // Release image src and canvas to help mobile browsers free memory sooner
        img.src = ""
        canvas.width = 0; canvas.height = 0
        resolve(result)
      }
      img.onerror = () => reject(new Error("Failed to load image"))
      img.src = ev.target?.result as string
    }
    reader.onerror = () => reject(new Error("Failed to read file"))
    reader.readAsDataURL(file)
  })
}

async function compressBlobToDataUrl(blob: Blob, maxSize = 1920, quality = 0.85): Promise<string> {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = reject
    reader.readAsDataURL(blob)
  })
  return new Promise((resolve, reject) => {
    const img = new window.Image()
    img.onload = () => {
      let w = img.width, h = img.height
      if (w > maxSize || h > maxSize) {
        if (w > h) { h = (h / w) * maxSize; w = maxSize } else { w = (w / h) * maxSize; h = maxSize }
      }
      const canvas = document.createElement("canvas")
      canvas.width = w; canvas.height = h
      canvas.getContext("2d")?.drawImage(img, 0, 0, w, h)
      resolve(canvas.toDataURL("image/jpeg", quality))
    }
    img.onerror = () => reject(new Error("Failed to load image"))
    img.src = dataUrl
  })
}

async function refImageToBase64(img: RefImage): Promise<string> {
  if (img.file) return compressFileToDataUrl(img.file, 1920, 0.85)
  // Route through our proxy to avoid CORS issues on Safari when fetching cross-origin R2 URLs
  const proxyUrl = `/api/proxy-image?url=${encodeURIComponent(img.url)}`
  const res = await fetch(proxyUrl)
  const blob = await res.blob()
  return compressBlobToDataUrl(blob, 1920, 0.85)
}

// --- PENDING SLOT ---
interface PendingSlot {
  slotId: string
  status: "loading" | "failed"
  prompt: string
  error?: string
  queueId?: number       // FAL queue job ID — stored so polling can resume after a page refresh
  queueJobId?: number    // GenerationQueue DB ID — set when the job was queued (capacity exceeded)
  nb2RequestId?: string  // FAL queue request ID for any async image model (NB2, Kling V3/O3, etc.)
  nb2FalEndpoint?: string
  nb2OutputFormat?: string
  nb2AspectRatio?: string
  nb2StatusUrl?: string  // Which status route to poll — defaults to /api/admin/nb2-status
  nb2Quality?: string    // Quality value passed through to the status route (e.g. for Kling O3 ticket cost)
  nb2TicketCost?: number // Per-slot ticket cost, used to refund on failure
  // Config stored at creation time so failed tiles can show full details in the modal
  modelId?: string
  aspectRatio?: string
  quality?: string
  referenceImageUrls?: string[]
}

// --- VIDEO TYPES ---
interface VideoModelConfig {
  id: string
  name: string
  durations: string[]
  aspectRatios?: string[]          // Kling / SeeDance
  resolutions?: string[]           // Wan / SeeDance
  supportsEndFrame: boolean
  supportsMotionControl?: boolean  // Motion Control only
  characterOrientations?: string[] // Motion Control only
  audioType: "toggle" | "upload" | "none"
  textToVideo?: boolean            // image is optional (supports text-to-video)
  supportsReferenceVideo?: boolean // SeeDance 2.0 r2v — accepts image_urls[], video_urls[], audio_urls[]
  supportsSD20Modes?: boolean      // SeeDance 2.0 — shows T2V/I2V/Ref mode switcher inside panel
  supportsLipsync?: boolean        // Lipsync v3 — takes video + audio, no prompt
  startFrameLocksAspect?: boolean  // when a start frame is provided, aspect ratio is ignored by the model
}

interface VideoItem {
  id: string
  dbId?: number           // DB GeneratedImage id — set on completion from status route
  videoUrl: string
  prompt: string
  model: string
  duration: string
  resolution?: string
  aspectRatio?: string
  createdAt: string
  failed?: boolean
  failError?: string
  audioEnabled?: boolean
  startFrameUrl?: string
  endFrameUrl?: string
  motionVideoUrl?: string
  keepOriginalSound?: boolean
  characterOrientation?: "image" | "video"
}

interface VideoPendingSlot {
  slotId: string
  requestId: string
  falEndpoint: string
  prompt: string
  model: string
  duration: string
  resolution?: string
  ticketCost: number
  startedAt?: number
  aspectRatio?: string
  audioEnabled?: boolean
  startFrameUrl?: string
  endFrameUrl?: string
  motionVideoUrl?: string
  keepOriginalSound?: boolean
  characterOrientation?: "image" | "video"
  queueJobId?: number    // GenerationQueue DB ID — set when the job was queued (capacity exceeded)
}

interface VideoDetailData {
  id?: number             // DB GeneratedImage id for rating
  videoUrl: string
  prompt: string
  model: string
  duration?: string
  resolution?: string
  aspectRatio?: string
  createdAt?: string
  failed?: boolean
  failError?: string
  audioEnabled?: boolean
  startFrameUrl?: string
  endFrameUrl?: string
  motionVideoUrl?: string
  keepOriginalSound?: boolean
  characterOrientation?: "image" | "video"
}

const VIDEO_MODEL_CONFIGS: VideoModelConfig[] = [
  {
    id: "kling-v3",
    name: "Kling 3.0",
    durations: ["3","4","5","6","7","8","9","10","11","12","13","14","15"],
    aspectRatios: ["16:9", "9:16", "1:1"],
    supportsEndFrame: true,
    audioType: "toggle",
    startFrameLocksAspect: true,
  },
  {
    id: "wan-2.5",
    name: "Wan 2.5",
    durations: ["5", "10"],
    resolutions: ["480p", "720p", "1080p"],
    supportsEndFrame: false,
    audioType: "upload",
  },
  {
    id: "kling-v3-motion",
    name: "Kling V3 Motion",
    durations: [],
    supportsEndFrame: false,
    supportsMotionControl: true,
    characterOrientations: ["image", "video"],
    audioType: "none",
  },
  {
    id: "seedance-1.5",
    name: "SeeDance 1.5",
    durations: ["4","5","6","7","8","9","10","11","12"],
    resolutions: ["480p","720p","1080p"],
    aspectRatios: ["16:9","9:16","1:1","4:3","3:4","21:9","auto"],
    supportsEndFrame: true,
    audioType: "toggle",
    textToVideo: true,
  },
  {
    id: "seedance-2.0",
    name: "SeeDance 2.0",
    durations: ["auto","5","6","7","8","9","10"],
    resolutions: ["480p","720p","1080p"],
    aspectRatios: ["auto","21:9","16:9","4:3","1:1","3:4","9:16"],
    supportsEndFrame: true,
    audioType: "toggle",
    textToVideo: true,
  },
  {
    id: "seedance-2.0-fast",
    name: "SeeDance 2.0 Fast",
    durations: ["auto","4","5","6","7","8","9","10","11","12","13","14","15"],
    resolutions: ["480p","720p"],
    aspectRatios: ["auto","21:9","16:9","4:3","1:1","3:4","9:16"],
    supportsEndFrame: true,
    audioType: "toggle",
    textToVideo: true,
  },
  {
    id: "lipsync-v3",
    name: "Lipsync v3",
    durations: [],
    supportsEndFrame: false,
    audioType: "none",
    supportsLipsync: true,
  },
]
const VIDEO_MODELS = VIDEO_MODEL_CONFIGS.map(m => m.name)

// Cost tier indicators — $ cheap · $$ mid · $$$ expensive
const IMAGE_MODEL_COST: Record<string, "$" | "$$" | "$$$"> = {
  "flash-scanner-v2.5": "$",
  "seedream-4.5":        "$",
  "seedream-5-lite":     "$",
  "flux-2":              "$",
  "kling-v3-image":      "$",
  "kling-o3-image":      "$$",
  "wan-2.7-pro":         "$$",
  "nano-banana-pro-2":   "$$",
  "pro-scanner-v3":      "$$$",
  "nano-banana-pro":     "$$$",
}
const VIDEO_MODEL_COST: Record<string, "$" | "$$" | "$$$"> = {
  "lipsync-v3":         "$",
  "seedance-1.5":       "$$",
  "wan-2.5":            "$$",
  "kling-v3-motion":    "$$$",
  "seedance-2.0-fast":  "$$$",
  "seedance-2.0":       "$$$",
  "kling-v3":           "$$$",
}
function CostBadge({ tier }: { tier: "$" | "$$" | "$$$" }) {
  const color = tier === "$"   ? "text-green-400"
              : tier === "$$"  ? "text-amber-400"
              :                  "text-rose-400"
  return (
    <span className={`font-mono text-[10px] font-bold shrink-0 ${color}`}>{tier}</span>
  )
}
// Name-keyed versions for the taskbar (which works with model names, not IDs)
const IMAGE_MODEL_COST_BY_NAME: Record<string, "$" | "$$" | "$$$"> = Object.fromEntries(
  IMAGE_MODEL_CONFIGS.map(m => [m.name, IMAGE_MODEL_COST[m.id] ?? "$"])
)
const VIDEO_MODEL_COST_BY_NAME: Record<string, "$" | "$$" | "$$$"> = Object.fromEntries(
  VIDEO_MODEL_CONFIGS.map(m => [m.name, VIDEO_MODEL_COST[m.id] ?? "$$"])
)

const PROMPT_MODELS = [
  { id: "gemini-3-flash",       label: "Gemini 3 Flash" },
  { id: "gemini-2.0-flash-exp", label: "Gemini 2.0 Flash Exp" },
  { id: "gemini-3-pro",         label: "Gemini 3 Pro" },
  { id: "gemini-exp-1206",      label: "Gemini Exp 1206" },
]
const SAVED_PROMPTS_KEY = "pv2-saved-prompts"
const TEXT_STATE_KEY = "pv2-text-state"

// --- TASKBAR DROPDOWN ---
function TaskbarDropdown({
  label,
  icon: Icon,
  items,
  open,
  onToggle,
  onSelect,
  activeItem,
  itemCosts,
}: {
  label: string
  icon: React.ElementType
  items: string[]
  open: boolean
  onToggle: () => void
  onSelect?: (item: string) => void
  activeItem?: string
  itemCosts?: Record<string, "$" | "$$" | "$$$">
}) {
  const ref = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const [menuPos, setMenuPos] = useState({ top: 0, left: 0 })

  const activeCost = activeItem && itemCosts ? itemCosts[activeItem] : undefined

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        if (open) onToggle()
      }
    }
    document.addEventListener("mousedown", handleClick)
    return () => document.removeEventListener("mousedown", handleClick)
  }, [open, onToggle])

  useEffect(() => {
    if (open && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect()
      setMenuPos({ top: rect.bottom + 8, left: Math.min(rect.left, window.innerWidth - 216) })
    }
  }, [open])

  return (
    <div className="relative flex-none min-w-[90px] sm:flex-1" ref={ref}>
      <button
        ref={buttonRef}
        onClick={onToggle}
        className={`flex items-center justify-center gap-2 w-full py-2 rounded-lg text-sm font-medium transition-all ${
          open ? "bg-white/10 text-white" : "text-slate-400 hover:text-white hover:bg-white/5"
        }`}
      >
        <Icon size={15} />
        {label}
        {activeCost && <CostBadge tier={activeCost} />}
        <ChevronDown size={13} className={`transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="fixed w-52 rounded-xl border border-white/10 bg-slate-900/95 backdrop-blur-md shadow-2xl overflow-hidden z-[9999]" style={{ top: menuPos.top, left: menuPos.left }}>
          {items.length === 0 ? (
            <div className="px-4 py-3 text-sm text-slate-500 italic">Coming soon</div>
          ) : (
            items.map((item) => (
              <button
                key={item}
                onClick={() => { onSelect?.(item); onToggle() }}
                className={`w-full text-left px-4 py-2.5 text-sm transition-colors flex items-center justify-between gap-2 ${
                  activeItem === item
                    ? "text-white bg-white/8"
                    : "text-slate-300 hover:bg-white/5 hover:text-white"
                }`}
              >
                <span>{item}</span>
                {itemCosts?.[item] && <CostBadge tier={itemCosts[item]} />}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  )
}

// --- SELECT DROPDOWN ---
function SelectDropdown({
  open,
  onToggle,
  selectMode,
  onToggleSelectMode,
  selectedCount,
  onDownloadAll,
  onDeleteAll,
  downloading,
  deleting,
  downloadProgress,
  downloadError,
}: {
  open: boolean
  onToggle: () => void
  selectMode: boolean
  onToggleSelectMode: () => void
  selectedCount: number
  onDownloadAll: () => void
  onDeleteAll: () => void
  downloading: boolean
  deleting: boolean
  downloadProgress?: { done: number; total: number } | null
  downloadError?: string | null
}) {
  const ref = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const [menuPos, setMenuPos] = useState({ top: 0, left: 0 })
  const [confirmDelete, setConfirmDelete] = useState(false)

  // Reset confirmation when dropdown closes or selection changes
  useEffect(() => { if (!open) setConfirmDelete(false) }, [open])
  useEffect(() => { setConfirmDelete(false) }, [selectedCount])

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        if (open) onToggle()
      }
    }
    document.addEventListener("mousedown", handleClick)
    return () => document.removeEventListener("mousedown", handleClick)
  }, [open, onToggle])

  useEffect(() => {
    if (open && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect()
      setMenuPos({ top: rect.bottom + 8, left: Math.min(rect.left, window.innerWidth - 240) })
    }
  }, [open])

  return (
    <div className="relative flex-none min-w-[90px] sm:flex-1" ref={ref}>
      <button
        ref={buttonRef}
        onClick={onToggle}
        className={`flex items-center justify-center gap-2 w-full py-2 rounded-lg text-sm font-medium transition-all ${
          open || selectMode ? "bg-white/10 text-white" : "text-slate-400 hover:text-white hover:bg-white/5"
        }`}
      >
        <SlidersHorizontal size={15} />
        Select
        {selectMode && selectedCount > 0 && (
          <span className="text-[10px] font-mono bg-cyan-500/20 text-cyan-400 px-1.5 py-0.5 rounded-full leading-none">{selectedCount}</span>
        )}
        <ChevronDown size={13} className={`transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="fixed w-60 rounded-xl border border-white/10 bg-slate-900/95 backdrop-blur-md shadow-2xl z-[9999] p-3 space-y-2" style={{ top: menuPos.top, left: menuPos.left }}>
          {/* Toggle select mode */}
          <button
            onClick={() => { onToggleSelectMode(); onToggle() }}
            className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-all ${
              selectMode
                ? "bg-cyan-500/15 border border-cyan-500/30 text-cyan-300"
                : "bg-white/5 border border-white/10 text-slate-300 hover:bg-white/10 hover:text-white"
            }`}
          >
            <Check size={13} className={selectMode ? "text-cyan-400" : "text-slate-500"} />
            {selectMode ? "Exit Select Mode" : "Enter Select Mode"}
          </button>

          {/* Bulk actions — only shown in select mode */}
          {selectMode && (
            <>
              <div className="border-t border-white/8 pt-2 space-y-1.5">
                <p className="text-[10px] font-mono text-slate-600 px-1 uppercase tracking-wider">
                  {selectedCount === 0 ? "Select images to act" : `${selectedCount} selected`}
                </p>
                <button
                  onClick={() => { if (selectedCount > 0) onDownloadAll() }}
                  disabled={selectedCount === 0 || downloading}
                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm bg-white/5 border border-white/10 text-slate-300 hover:bg-white/10 hover:text-white transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  {downloading
                    ? <div className="w-3 h-3 rounded-full border-2 border-slate-500 border-t-slate-200 animate-spin shrink-0" />
                    : <Download size={13} className="shrink-0" />}
                  <span className="flex-1 text-left">
                    {downloading && downloadProgress
                      ? downloadProgress.total > 1
                        ? `Fetching ${downloadProgress.done} / ${downloadProgress.total}…`
                        : "Downloading…"
                      : downloading
                        ? "Starting…"
                        : "Download All"}
                  </span>
                  {downloading && downloadProgress && downloadProgress.total > 1 && (
                    <span className="text-[10px] font-mono text-slate-500 shrink-0">
                      {Math.round((downloadProgress.done / downloadProgress.total) * 100)}%
                    </span>
                  )}
                </button>
                {downloadError && (
                  <p className="text-[11px] text-red-400 px-1 leading-snug">{downloadError}</p>
                )}
                {confirmDelete ? (
                  <div className="rounded-lg border border-red-500/40 bg-red-500/8 p-2.5 space-y-2">
                    <p className="text-[11px] text-red-300 leading-snug">
                      Permanently delete {selectedCount} image{selectedCount !== 1 ? "s" : ""}? This cannot be undone.
                    </p>
                    <div className="flex gap-2">
                      <button
                        onClick={() => { onDeleteAll(); setConfirmDelete(false) }}
                        disabled={deleting}
                        className="flex-1 py-1.5 rounded-md bg-red-500 hover:bg-red-400 text-white text-[11px] font-semibold transition-colors disabled:opacity-50"
                      >
                        {deleting ? "Deleting…" : "Yes, Delete"}
                      </button>
                      <button
                        onClick={() => setConfirmDelete(false)}
                        className="flex-1 py-1.5 rounded-md border border-white/10 bg-white/5 hover:bg-white/10 text-slate-300 text-[11px] font-medium transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => { if (selectedCount > 0) setConfirmDelete(true) }}
                    disabled={selectedCount === 0 || deleting}
                    className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/15 hover:text-red-300 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                  >
                    <X size={13} />
                    Delete Selected
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}

const ADMIN_EMAILS = ["dirtysecretai@gmail.com", "promptandprotocol@gmail.com"]

// --- PROFILE BUBBLE ---
function ProfileBubble({ user, onSignOut }: { user: UserData | null; onSignOut: () => void }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const isAdmin = user !== null && ADMIN_EMAILS.includes(user.email)

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener("mousedown", handleClick)
    return () => document.removeEventListener("mousedown", handleClick)
  }, [])

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        className={`w-8 h-8 rounded-full border-2 flex items-center justify-center transition-all ${
          open
            ? "border-cyan-400 bg-cyan-500/20 text-cyan-400"
            : "border-slate-600 bg-slate-800 text-slate-400 hover:border-slate-400 hover:text-white"
        }`}
      >
        <User size={14} />
      </button>

      {open && (
        <div className="absolute top-full right-0 mt-2 w-64 rounded-xl border border-white/10 bg-slate-900/95 backdrop-blur-md shadow-2xl p-4 z-50">
          {user !== null ? (
            <div className="space-y-3">
              <div>
                <p className="text-[10px] font-mono text-slate-500 uppercase tracking-widest mb-1">Email</p>
                <p className="text-sm text-white break-all">{user.email}</p>
              </div>
              <div>
                <p className="text-[10px] font-mono text-slate-500 uppercase tracking-widest mb-1">User ID</p>
                <p className="text-sm text-white font-mono">#{user.id}</p>
              </div>
              <div className="pt-1 border-t border-white/10">
                <p className="text-[10px] font-mono text-slate-500 uppercase tracking-widest mb-1">Tickets</p>
                <div className="flex items-center gap-2">
                  <Ticket size={14} className="text-cyan-400" />
                  <p className="text-lg font-bold text-cyan-400">{user.ticketBalance.toLocaleString()}</p>
                </div>
              </div>
              {isAdmin && (
                <Link
                  href="/admin"
                  className="block w-full py-2 rounded-lg bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/20 hover:border-cyan-500/40 text-sm text-cyan-400 hover:text-cyan-300 text-center transition-colors"
                  onClick={() => setOpen(false)}
                >
                  Admin Portal →
                </Link>
              )}
              <button
                onClick={async () => {
                  await fetch("/api/auth/logout", { method: "POST" })
                  setOpen(false)
                  onSignOut()
                }}
                className="w-full py-2 rounded-lg bg-white/5 hover:bg-red-500/10 border border-white/10 hover:border-red-500/30 text-sm text-slate-400 hover:text-red-400 transition-colors"
              >
                Sign out
              </button>
            </div>
          ) : (
            <div className="text-center">
              <p className="text-sm text-slate-500 mb-3">Not signed in</p>
              <Link
                href="/login"
                className="block w-full py-2 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-sm text-white text-center transition-colors"
              >
                Sign in
              </Link>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// --- REF IMAGE DROPDOWN ---
function RefDropdown({
  open,
  onToggle,
  library,
  activeIds,
  modelMaxRefs,
  onUpload,
  onDelete,
  onDeleteMultiple,
  onClearAll,
  onActivate,
  onDeactivate,
  disabled = false,
  libraryLimit = 50,
}: {
  open: boolean
  onToggle: () => void
  library: RefImage[]
  activeIds: string[]
  modelMaxRefs: number
  onUpload: (items: RefImage[]) => void
  onDelete: (id: string) => void
  onDeleteMultiple: (ids: string[]) => void
  onClearAll: () => void
  onActivate: (id: string) => void
  onDeactivate: (id: string) => void
  disabled?: boolean
  libraryLimit?: number
}) {
  const ref = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [menuPos, setMenuPos] = useState({ top: 0, left: 0 })
  const [selectMode, setSelectMode] = useState(false)
  const [selectedForDelete, setSelectedForDelete] = useState<Set<string>>(new Set())
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const activeCount = disabled ? 0 : activeIds.filter((id) => library.some((img) => img.id === id)).length
  const atLimit = !disabled && modelMaxRefs > 0 && activeCount >= modelMaxRefs

  // Exit select mode + clear errors when dropdown closes
  useEffect(() => {
    if (!open) {
      setSelectMode(false)
      setSelectedForDelete(new Set())
      setUploadError(null)
    }
  }, [open])

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        if (open) onToggle()
      }
    }
    document.addEventListener("mousedown", handleClick)
    return () => document.removeEventListener("mousedown", handleClick)
  }, [open, onToggle])

  useEffect(() => {
    if (open && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect()
      setMenuPos({ top: rect.bottom + 8, left: Math.min(rect.left, window.innerWidth - 328) })
    }
  }, [open])

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    e.target.value = ""
    if (!files.length) return
    const slots = libraryLimit - library.length
    if (slots <= 0) {
      setUploadError(`Library is full (${libraryLimit}/${libraryLimit})`)
      return
    }
    const toProcess = files.slice(0, slots)
    setUploadError(null)
    setUploading(true)
    try {
      const items: RefImage[] = await Promise.all(
        toProcess.map(async (file) => ({
          id: `lib-${Date.now()}-${Math.random()}`,
          url: await compressFileToDataUrl(file),
        }))
      )
      onUpload(items)
    } catch (err) {
      console.error("Ref upload failed:", err)
      setUploadError("Upload failed — try again or use a smaller image")
    } finally {
      setUploading(false)
    }
  }

  const handleToggle = (img: RefImage) => {
    if (disabled) return
    if (activeIds.includes(img.id)) {
      onDeactivate(img.id)
    } else if (!atLimit) {
      onActivate(img.id)
    }
  }

  const toggleSelectForDelete = (id: string) => {
    setSelectedForDelete(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  const handleDeleteSelected = () => {
    onDeleteMultiple([...selectedForDelete])
    setSelectedForDelete(new Set())
    setSelectMode(false)
  }

  const handleClearAll = () => {
    onClearAll()
    setSelectMode(false)
    setSelectedForDelete(new Set())
  }

  return (
    <div className="relative flex-none min-w-[90px] sm:flex-1" ref={ref}>
      <button
        ref={buttonRef}
        onClick={onToggle}
        className={`flex items-center justify-center gap-2 w-full py-2 rounded-lg text-sm font-medium transition-all ${
          open ? "bg-white/10 text-white" : "text-slate-400 hover:text-white hover:bg-white/5"
        }`}
      >
        <ImagePlus size={15} />
        Refs
        {activeCount > 0 && (
          <span className="px-1.5 py-0.5 rounded-full bg-cyan-500/20 text-cyan-400 text-[10px] font-bold leading-none">
            {activeCount}
          </span>
        )}
        <ChevronDown size={13} className={`transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="fixed w-80 rounded-xl border border-white/10 bg-slate-900/95 backdrop-blur-md shadow-2xl overflow-hidden z-[9999]" style={{ top: menuPos.top, left: menuPos.left }}>
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-white/5">
            <span className="text-sm font-semibold text-white">Reference Images</span>
            <div className="flex items-center gap-2">
              {/* Stacked Total / Active pills */}
              <div className="flex flex-col gap-1">
                {/* Library slots pill */}
                <div className="flex items-center justify-between gap-2 px-2.5 py-1 rounded-md border border-white/10 bg-black/60" title="Total images saved in your library">
                  <span className="text-[10px] text-slate-500 uppercase tracking-wide font-medium">Total</span>
                  <span className={`text-xs font-mono font-bold ${library.length >= libraryLimit ? "text-amber-400" : "text-slate-300"}`}>
                    {library.length}/{libraryLimit}
                  </span>
                </div>
                {/* Active refs pill */}
                <div className={`flex items-center justify-between gap-2 px-2.5 py-1 rounded-md border ${
                  atLimit
                    ? "border-amber-500/30 bg-amber-500/10"
                    : activeCount > 0
                    ? "border-cyan-500/25 bg-black/60"
                    : "border-white/8 bg-black/40"
                }`} title={modelMaxRefs > 0 ? `Images currently sent with your generation — max ${modelMaxRefs} for this model` : "Images currently sent with your generation"}>
                  <span className="text-[10px] text-slate-500 uppercase tracking-wide font-medium">Active</span>
                  <span className={`text-xs font-mono font-bold ${atLimit ? "text-amber-400" : activeCount > 0 ? "text-cyan-400" : "text-slate-500"}`}>
                    {activeCount}{modelMaxRefs > 0 ? `/${modelMaxRefs}` : ""}
                  </span>
                </div>
              </div>
              {library.length > 0 && !selectMode && (
                <button
                  onClick={() => setSelectMode(true)}
                  className="text-[10px] font-bold text-slate-300 hover:text-white transition-all h-7 px-3 rounded-md border border-white/15 bg-white/6 hover:bg-white/10 hover:border-white/25 whitespace-nowrap flex items-center justify-center"
                >
                  Select
                </button>
              )}
              {library.length > 0 && !selectMode && (
                <button
                  onClick={handleClearAll}
                  className="text-[10px] font-bold text-rose-400 hover:text-rose-300 transition-all h-7 px-3 rounded-md border border-rose-500/30 bg-rose-500/10 hover:bg-rose-500/20 hover:border-rose-500/50 whitespace-nowrap flex items-center justify-center"
                >
                  Clear all
                </button>
              )}
              {selectMode && (
                <button
                  onClick={() => { setSelectMode(false); setSelectedForDelete(new Set()) }}
                  className="text-[10px] text-slate-400 hover:text-white transition-colors px-1.5 py-0.5 rounded border border-white/10 hover:border-white/20"
                >
                  Cancel
                </button>
              )}
            </div>
          </div>

          {/* Description */}
          {!selectMode && (
            <div className="px-4 py-2.5 border-b border-white/5 bg-white/2">
              <p className="text-[10px] text-slate-400 leading-relaxed">
                Upload images here to use as visual references. <span className="text-white">Tap an image to toggle it on/off</span> — only <span className="text-cyan-400">active</span> images are sent with your generation. Your library is saved between sessions.
              </p>
            </div>
          )}

          {/* Upload button — hidden in select mode */}
          {!selectMode && (
            <div className="px-3 py-2 border-b border-white/5">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={handleFileChange}
              />
              <button
                onClick={() => { if (!uploading && library.length < libraryLimit) { setUploadError(null); fileInputRef.current?.click() } }}
                disabled={library.length >= libraryLimit || uploading}
                className="w-full py-2 rounded-lg border border-dashed border-white/10 text-[11px] text-slate-400 hover:text-white hover:border-white/20 transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {uploading
                  ? <><div className="w-2.5 h-2.5 rounded-full border border-slate-500 border-t-slate-200 animate-spin" />Compressing…</>
                  : <><Plus size={11} />{library.length >= libraryLimit ? `Library full (${libraryLimit}/${libraryLimit})` : `Upload Images · ${libraryLimit - library.length} slots left`}</>
                }
              </button>
              {uploadError && (
                <p className="text-[10px] text-red-400 mt-1.5 px-1 leading-snug">{uploadError}</p>
              )}
            </div>
          )}

          {/* Select mode hint */}
          {selectMode && (
            <div className="px-4 py-2 border-b border-white/5 bg-rose-500/5">
              <p className="text-[10px] text-rose-400/80">Tap images to select them for deletion</p>
            </div>
          )}

          {/* Disabled notice for video mode */}
          {!selectMode && disabled && (
            <div className="px-4 py-2 border-b border-white/5 bg-slate-800/60">
              <p className="text-[10px] text-slate-400">Reference images are not used by video models. Upload start/end frames through the video configuration panel instead.</p>
            </div>
          )}

          {/* Model support notice */}
          {!selectMode && !disabled && modelMaxRefs === 0 && (
            <div className="px-4 py-2 border-b border-white/5 bg-amber-500/5">
              <p className="text-[10px] text-amber-400/70">Current model doesn't support reference images.</p>
            </div>
          )}

          {/* Thumbnail grid */}
          <div className="p-3 max-h-72 overflow-y-auto">
            {library.length === 0 ? (
              <p className="text-center text-slate-600 text-[11px] py-8">No images in library yet</p>
            ) : (
              <div className="grid grid-cols-5 gap-1.5">
                {library.map((img) => {
                  const isActive = !selectMode && activeIds.includes(img.id)
                  const isDisabled = !selectMode && !isActive && atLimit
                  const isSelectedForDelete = selectMode && selectedForDelete.has(img.id)
                  return (
                    <div key={img.id} className="relative group aspect-square">
                      <button
                        onClick={() => selectMode ? toggleSelectForDelete(img.id) : handleToggle(img)}
                        disabled={!selectMode && (isDisabled || disabled)}
                        title={
                          selectMode
                            ? isSelectedForDelete ? "Click to deselect" : "Click to select for deletion"
                            : disabled ? "Not available for video models"
                            : isDisabled ? `Limit reached (${modelMaxRefs})`
                            : isActive ? "Click to deactivate" : "Click to activate"
                        }
                        className={`w-full h-full rounded-md overflow-hidden border-2 transition-all ${
                          selectMode
                            ? isSelectedForDelete
                              ? "border-rose-400 ring-1 ring-rose-400/30"
                              : "border-transparent hover:border-white/30"
                            : disabled
                            ? "border-transparent opacity-30 cursor-not-allowed"
                            : isActive
                            ? "border-cyan-400 ring-1 ring-cyan-400/30"
                            : isDisabled
                            ? "border-transparent opacity-25 cursor-not-allowed"
                            : "border-transparent hover:border-white/30"
                        }`}
                      >
                        <img src={img.url} alt="" className={`w-full h-full object-cover transition-opacity ${isSelectedForDelete ? "opacity-60" : ""}`} />
                      </button>

                      {/* Active checkmark (normal mode) */}
                      {!selectMode && isActive && (
                        <div className="absolute bottom-0.5 right-0.5 w-4 h-4 rounded-full bg-cyan-400 flex items-center justify-center pointer-events-none">
                          <Check size={9} className="text-black" />
                        </div>
                      )}

                      {/* Selected-for-delete indicator (select mode) */}
                      {selectMode && (
                        <div className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full border-2 flex items-center justify-center pointer-events-none transition-all ${
                          isSelectedForDelete ? "bg-rose-500 border-rose-400" : "bg-black/50 border-white/40"
                        }`}>
                          {isSelectedForDelete && <Check size={8} className="text-white" />}
                        </div>
                      )}

                      {/* Delete on hover (normal mode only) */}
                      {!selectMode && (
                        <button
                          onClick={(e) => { e.stopPropagation(); onDelete(img.id) }}
                          className="absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-black/80 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity z-10"
                        >
                          <X size={8} className="text-white" />
                        </button>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Select mode action bar */}
          {selectMode && (
            <div className="px-3 py-2.5 border-t border-white/5 flex items-center justify-between gap-2">
              <span className="text-[11px] text-slate-400">
                {selectedForDelete.size > 0 ? `${selectedForDelete.size} selected` : "None selected"}
              </span>
              <button
                onClick={handleDeleteSelected}
                disabled={selectedForDelete.size === 0}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-500/15 border border-rose-500/30 text-rose-400 text-[11px] font-medium hover:bg-rose-500/25 hover:border-rose-500/50 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
              >
                <Trash2 size={11} />
                Delete ({selectedForDelete.size})
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// --- TEXT DROPDOWN ---
function TextDropdown({
  open,
  onToggle,
  hasDevAccess,
  imageModelName,
  onUsePrompt,
  signedIn,
}: {
  open: boolean
  onToggle: () => void
  hasDevAccess: boolean
  imageModelName: string
  onUsePrompt: (text: string) => void
  signedIn: boolean
}) {
  const ref = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const [menuPos, setMenuPos] = useState({ top: 0, left: 0 })

  // AI Prompting state
  const [promptModel, setPromptModel] = useState<string>(PROMPT_MODELS[0].id)
  const [names, setNames] = useState<string[]>([""])
  const [enhancements, setEnhancements] = useState<string[]>([""])
  const [generatedPrompt, setGeneratedPrompt] = useState<string>("")
  const [generating, setGenerating] = useState(false)
  const [cooldownEnd, setCooldownEnd] = useState<number | null>(null)
  const [cooldownLeft, setCooldownLeft] = useState(0)
  const [genError, setGenError] = useState<string | null>(null)
  const [copiedGen, setCopiedGen] = useState(false)

  // Saved prompts
  const [savedPrompts, setSavedPrompts] = useState<string[]>(Array(10).fill(""))
  const [copiedSavedIdx, setCopiedSavedIdx] = useState<number | null>(null)
  const savedPromptsInitialized = useRef(false)
  const savedPromptsSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Restore AI prompting state from localStorage after mount
  useEffect(() => {
    try {
      const s = JSON.parse(localStorage.getItem(TEXT_STATE_KEY) || "{}")
      if (s.promptModel && PROMPT_MODELS.some((m) => m.id === s.promptModel)) setPromptModel(s.promptModel)
      if (Array.isArray(s.names) && s.names.length > 0) setNames(s.names)
      if (Array.isArray(s.enhancements) && s.enhancements.length > 0) setEnhancements(s.enhancements)
      if (s.generatedPrompt) setGeneratedPrompt(s.generatedPrompt)
    } catch {}
  }, [])

  // Persist text state (AI prompting) to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(TEXT_STATE_KEY, JSON.stringify({ promptModel, names, enhancements, generatedPrompt }))
    } catch {}
  }, [promptModel, names, enhancements, generatedPrompt])

  // Single effect: first run = restore (localStorage + DB), subsequent runs = save.
  // Using the same pattern as model settings to prevent overwriting stored data with defaults.
  useEffect(() => {
    if (!savedPromptsInitialized.current) {
      savedPromptsInitialized.current = true
      // Always load from localStorage first (synchronous, instant)
      try {
        const arr = JSON.parse(localStorage.getItem(SAVED_PROMPTS_KEY) || "[]")
        if (Array.isArray(arr) && arr.length > 0) {
          setSavedPrompts([...arr.slice(0, 10), ...Array(Math.max(0, 10 - arr.length)).fill("")])
        }
      } catch {}
      // Then sync from DB in background (overwrites localStorage if DB has data)
      if (signedIn) {
        fetch('/api/user/preferences')
          .then(r => r.json())
          .then(({ preferences }) => {
            if (Array.isArray(preferences?.savedPrompts) && preferences.savedPrompts.some((p: string) => p)) {
              const arr = preferences.savedPrompts as string[]
              setSavedPrompts([...arr.slice(0, 10), ...Array(Math.max(0, 10 - arr.length)).fill("")])
            }
          })
          .catch(() => {})
      }
      return // Do not save on the restore run
    }
    // Subsequent runs: save to localStorage immediately, DB debounced
    try { localStorage.setItem(SAVED_PROMPTS_KEY, JSON.stringify(savedPrompts)) } catch {}
    if (signedIn) {
      if (savedPromptsSaveTimer.current) clearTimeout(savedPromptsSaveTimer.current)
      savedPromptsSaveTimer.current = setTimeout(() => {
        fetch('/api/user/preferences', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ savedPrompts }),
        }).catch(() => {})
      }, 1500)
    }
  }, [savedPrompts, signedIn])

  // Cooldown countdown
  useEffect(() => {
    if (!cooldownEnd) return
    const tick = setInterval(() => {
      const left = Math.max(0, Math.ceil((cooldownEnd - Date.now()) / 1000))
      setCooldownLeft(left)
      if (left === 0) { setCooldownEnd(null); clearInterval(tick) }
    }, 250)
    return () => clearInterval(tick)
  }, [cooldownEnd])

  // Outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        if (open) onToggle()
      }
    }
    document.addEventListener("mousedown", handleClick)
    return () => document.removeEventListener("mousedown", handleClick)
  }, [open, onToggle])

  useEffect(() => {
    if (open && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect()
      const panelW = Math.min(660, window.innerWidth - 8)
      setMenuPos({ top: rect.bottom + 8, left: Math.max(4, Math.min(rect.left, window.innerWidth - panelW - 4)) })
    }
  }, [open])

  const isFlash = promptModel === "gemini-3-flash" || promptModel === "gemini-2.0-flash-exp"
  const canGenerate = !generating && !cooldownEnd && hasDevAccess

  const handleGenerate = async () => {
    if (!canGenerate) return
    const celebrity = names.filter((n) => n.trim()).join(", ")
    const baseStyle = enhancements.filter((e) => e.trim()).join(", ")
    if (!celebrity && !baseStyle) { setGenError("Enter at least one name or enhancement."); return }
    setGenerating(true)
    setGenError(null)
    try {
      const res = await fetch("/api/prompting-studio/generate-single", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ celebrity, baseStyle, model: imageModelName, promptModel }),
      })
      const data = await res.json()
      if (!res.ok || data.error) {
        setGenError(data.error || "Generation failed.")
      } else {
        setGeneratedPrompt(data.prompt || data.result || "")
        if (!isFlash) { setCooldownEnd(Date.now() + 10000); setCooldownLeft(10) }
      }
    } catch (err: any) {
      setGenError(err.message || "Network error.")
    } finally {
      setGenerating(false)
    }
  }

  const handleUseGenerated = () => {
    if (!generatedPrompt) return
    onUsePrompt(generatedPrompt)
    onToggle()
  }

  const handleCopyGenerated = () => {
    copyToClipboard(generatedPrompt).then(() => {
      setCopiedGen(true)
      setTimeout(() => setCopiedGen(false), 2000)
    })
  }

  const handleCopySaved = (idx: number) => {
    if (!savedPrompts[idx]) return
    copyToClipboard(savedPrompts[idx]).then(() => {
      setCopiedSavedIdx(idx)
      setTimeout(() => setCopiedSavedIdx(null), 2000)
    })
  }

  return (
    <div className="relative flex-none min-w-[90px] sm:flex-1" ref={ref}>
      <button
        ref={buttonRef}
        onClick={onToggle}
        className={`flex items-center justify-center gap-2 w-full py-2 rounded-lg text-sm font-medium transition-all ${
          open ? "bg-white/10 text-white" : "text-slate-400 hover:text-white hover:bg-white/5"
        }`}
      >
        <Type size={15} />
        Text
        <ChevronDown size={13} className={`transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="fixed rounded-xl border border-white/10 bg-slate-900/95 backdrop-blur-md shadow-2xl z-[9999]" style={{ top: menuPos.top, left: menuPos.left, width: Math.min(660, window.innerWidth - 8) }}>
          <div className="grid grid-cols-2 divide-x divide-white/5">

            {/* LEFT: AI Prompting */}
            <div className="p-4 space-y-3 max-h-[520px] overflow-y-auto">
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">AI Prompting</p>

              {!hasDevAccess ? (
                <div className="py-8 text-center space-y-2">
                  <p className="text-sm text-slate-500">Dev tier required</p>
                  <a href="/prompting-studio/subscribe" className="text-[11px] text-cyan-400 hover:underline">Upgrade →</a>
                </div>
              ) : (
                <>
                  {/* AI Model */}
                  <div>
                    <label className="block text-[10px] text-slate-500 mb-1">AI Model</label>
                    <select
                      value={promptModel}
                      onChange={(e) => setPromptModel(e.target.value)}
                      className="w-full px-2 py-1.5 rounded-md bg-slate-800 border border-white/10 text-xs text-white focus:outline-none focus:border-white/20"
                    >
                      {PROMPT_MODELS.map((m) => (
                        <option key={m.id} value={m.id}>{m.label}</option>
                      ))}
                    </select>
                  </div>

                  {/* Names */}
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="text-[10px] text-slate-500">Names ({names.length}/5)</label>
                      {names.length < 5 && (
                        <button onClick={() => setNames((p) => [...p, ""])} className="text-[10px] text-cyan-400 hover:text-cyan-300">+ Add</button>
                      )}
                    </div>
                    <div className="space-y-1.5">
                      {names.map((name, i) => (
                        <div key={i} className="flex gap-1 items-center">
                          <input
                            value={name}
                            onChange={(e) => setNames((p) => p.map((n, idx) => idx === i ? e.target.value : n))}
                            placeholder={`Name ${i + 1}`}
                            className="flex-1 px-2 py-1 rounded-md bg-slate-800 border border-white/10 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-white/20"
                          />
                          {names.length > 1 && (
                            <button onClick={() => setNames((p) => p.filter((_, idx) => idx !== i))} className="text-slate-600 hover:text-red-400 transition-colors shrink-0">
                              <X size={11} />
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Enhancements */}
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="text-[10px] text-slate-500">Enhancements ({enhancements.length}/10)</label>
                      {enhancements.length < 10 && (
                        <button onClick={() => setEnhancements((p) => [...p, ""])} className="text-[10px] text-cyan-400 hover:text-cyan-300">+ Add</button>
                      )}
                    </div>
                    <div className="space-y-1.5 max-h-28 overflow-y-auto">
                      {enhancements.map((enh, i) => (
                        <div key={i} className="flex gap-1 items-center">
                          <input
                            value={enh}
                            onChange={(e) => setEnhancements((p) => p.map((en, idx) => idx === i ? e.target.value : en))}
                            placeholder={`Enhancement ${i + 1}`}
                            className="flex-1 px-2 py-1 rounded-md bg-slate-800 border border-white/10 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-white/20"
                          />
                          {enhancements.length > 1 && (
                            <button onClick={() => setEnhancements((p) => p.filter((_, idx) => idx !== i))} className="text-slate-600 hover:text-red-400 transition-colors shrink-0">
                              <X size={11} />
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Generate */}
                  {genError && <p className="text-[10px] text-red-400">{genError}</p>}
                  <button
                    onClick={handleGenerate}
                    disabled={!canGenerate}
                    className={`w-full py-1.5 rounded-md text-xs font-semibold transition-all ${
                      canGenerate
                        ? "bg-gradient-to-r from-cyan-500 to-fuchsia-500 text-black hover:opacity-90"
                        : "bg-white/5 text-slate-600 cursor-not-allowed"
                    }`}
                  >
                    {generating ? "Generating…" : cooldownEnd ? `Wait ${cooldownLeft}s` : "Generate Prompt"}
                  </button>

                  {/* Output */}
                  {generatedPrompt && (
                    <div className="space-y-1.5">
                      <textarea
                        value={generatedPrompt}
                        onChange={(e) => setGeneratedPrompt(e.target.value)}
                        rows={4}
                        className="w-full px-2 py-1.5 rounded-md bg-slate-800 border border-white/10 text-xs text-slate-200 focus:outline-none focus:border-white/20 resize-none leading-relaxed"
                      />
                      <div className="flex gap-2">
                        <button
                          onClick={handleCopyGenerated}
                          className="flex-1 py-1 rounded-md border border-white/10 bg-white/5 text-[11px] text-slate-300 hover:text-white hover:bg-white/10 transition-all"
                        >
                          {copiedGen ? "Copied!" : "Copy"}
                        </button>
                        <button
                          onClick={handleUseGenerated}
                          className="flex-1 py-1 rounded-md bg-white/10 hover:bg-white/15 text-[11px] text-white font-medium transition-all"
                        >
                          Use →
                        </button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>

            {/* RIGHT: Saved Prompts */}
            <div className="p-4 max-h-[520px] overflow-y-auto">
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-3">Saved Prompts</p>
              <div className="grid grid-cols-2 gap-2">
                {savedPrompts.map((p, i) => (
                  <div key={i} className="flex flex-col gap-1">
                    <textarea
                      value={p}
                      onChange={(e) => setSavedPrompts((prev) => prev.map((sp, idx) => idx === i ? e.target.value : sp))}
                      placeholder={`Prompt ${i + 1}`}
                      rows={4}
                      className="w-full px-2 py-1.5 rounded-md bg-slate-800 border border-white/10 text-[11px] text-slate-200 placeholder-slate-700 focus:outline-none focus:border-white/20 resize-none leading-relaxed"
                    />
                    <div className="flex gap-1">
                      <button
                        onClick={() => handleCopySaved(i)}
                        title="Copy"
                        className="flex-1 py-1 rounded-md border border-white/10 bg-white/5 text-[11px] text-slate-300 hover:text-white hover:bg-white/10 transition-all flex items-center justify-center gap-1"
                      >
                        {copiedSavedIdx === i ? <Check size={10} /> : <Copy size={9} />}
                        <span>{copiedSavedIdx === i ? "Copied!" : "Copy"}</span>
                      </button>
                      <button
                        onClick={() => { if (p) { onUsePrompt(p); onToggle() } }}
                        disabled={!p}
                        title="Load into prompt"
                        className="flex-1 py-1 rounded-md bg-white/10 hover:bg-white/15 text-[11px] text-white font-medium transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                      >
                        Use →
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

          </div>
        </div>
      )}
    </div>
  )
}

// --- QUEUE DISPLAY ---
function QueueDisplay({ active, max, label = "queue" }: { active: number; max: number; label?: string }) {
  const unlimited = max === Infinity
  const full = !unlimited && active >= max
  const busy = active > 0

  return (
    <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-[11px] font-mono transition-colors ${
      full
        ? "border-red-500/30 bg-red-500/10 text-red-400"
        : busy
        ? "border-amber-500/30 bg-amber-500/10 text-amber-400"
        : "border-white/10 bg-white/5 text-slate-500"
    }`}>
      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${
        full ? "bg-red-400 animate-pulse" : busy ? "bg-amber-400 animate-pulse" : "bg-slate-600"
      }`} />
      <span className="tabular-nums">{active}/{unlimited ? "∞" : max}</span>
      <span className="text-[10px] hidden sm:inline opacity-70">{label}</span>
    </div>
  )
}

// --- GRID IMAGE CELL ---
function GridImage({ src, alt, onClick, imageId, directUrl, selectMode, selected, onSelect }: {
  src: string; alt: string; onClick?: () => void; imageId?: number; directUrl?: string
  selectMode?: boolean; selected?: boolean; onSelect?: (id: number) => void
}) {
  const [loaded, setLoaded] = useState(false)
  // directUrl: skip the proxy and load directly (used for just-completed images where the
  // blob URL is already known — avoids the DB-auth → blob-fetch → sharp chain adding delay)
  const thumbSrc = directUrl || (imageId ? `/api/images/${imageId}?thumb=1` : src)
  const handleClick = () => {
    if (selectMode && imageId !== undefined) { onSelect?.(imageId); return }
    onClick?.()
  }
  return (
    <div
      className={`aspect-square bg-slate-800 overflow-hidden relative ${onClick || selectMode ? "cursor-pointer group" : ""} ${selected ? "ring-2 ring-cyan-400 ring-inset" : ""}`}
      onClick={handleClick}
    >
      {!loaded && (
        <div className="absolute inset-0 bg-gradient-to-r from-slate-800 via-slate-700 to-slate-800 animate-pulse" />
      )}
      <img
        src={thumbSrc}
        alt={alt}
        decoding="async"
        onLoad={() => setLoaded(true)}
        className={`w-full h-full object-cover transition-opacity duration-300 ${loaded ? "opacity-100" : "opacity-0"} ${(onClick && !selectMode) ? "group-hover:opacity-80 transition-opacity" : ""} ${selected ? "opacity-80" : ""}`}
      />
      {selectMode && (
        <div className={`absolute top-1.5 left-1.5 w-4 h-4 rounded-full border-2 flex items-center justify-center transition-all ${selected ? "bg-cyan-400 border-cyan-400" : "border-white/60 bg-black/40"}`}>
          {selected && <Check size={9} className="text-black" />}
        </div>
      )}
    </div>
  )
}

// --- FEED PLACEHOLDERS ---
function LoadingSlot({ onClick }: { onClick?: () => void }) {
  return (
    <button
      onClick={onClick}
      className="aspect-square w-full bg-slate-800 flex flex-col items-center justify-center gap-2 hover:bg-slate-700 transition-colors"
    >
      <div className="w-6 h-6 rounded-full border-2 border-slate-600 border-t-slate-300 animate-spin" />
    </button>
  )
}

function QueuedSlot({ onClick }: { onClick?: () => void }) {
  return (
    <button
      onClick={onClick}
      className="aspect-square w-full bg-slate-900 border border-amber-500/20 hover:border-amber-500/40 flex flex-col items-center justify-center gap-2 transition-colors"
    >
      <div className="w-5 h-5 rounded-full border-2 border-amber-500/50 border-t-amber-400 animate-spin" />
      <p className="text-[9px] text-amber-400/60 font-mono tracking-wide">QUEUED</p>
    </button>
  )
}

function FailedSlot({ prompt, error, onClick }: { prompt: string; error: string; onClick?: () => void }) {
  return (
    <button
      onClick={onClick}
      className="aspect-square w-full bg-slate-900 border border-red-500/20 hover:border-red-500/40 flex flex-col items-center justify-center p-3 gap-2 transition-colors cursor-pointer"
    >
      <div className="w-5 h-5 rounded-full border-2 border-red-500/60 flex items-center justify-center shrink-0">
        <X size={10} className="text-red-400" />
      </div>
      <p className="text-[9px] text-red-400/70 text-center leading-tight line-clamp-1">{error}</p>
      <p className="text-[9px] text-slate-600 text-center leading-tight line-clamp-2 italic">"{prompt}"</p>
    </button>
  )
}

// --- PENDING DETAIL MODAL ---
function PendingDetailModal({
  prompt,
  model,
  quality,
  aspectRatio,
  referenceImageUrls,
  isVideoSlot,
  startFrameUrl,
  endFrameUrl,
  isQueued,
  onClose,
  onUsePrompt,
}: {
  prompt: string
  model: string
  quality?: string
  aspectRatio?: string
  referenceImageUrls?: string[]
  isVideoSlot?: boolean
  startFrameUrl?: string
  endFrameUrl?: string
  isQueued?: boolean
  onClose: () => void
  onUsePrompt: (text: string) => void
}) {
  const [copied, setCopied] = useState(false)
  const modelName = getModelDisplayName(model)

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose() }
    window.addEventListener("keydown", handler)
    return () => window.removeEventListener("keydown", handler)
  }, [onClose])

  const handleCopy = () => {
    copyToClipboard(prompt).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4 bg-black/80 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="relative w-full h-full sm:h-auto sm:max-w-4xl sm:max-h-[90vh] sm:rounded-2xl border-0 sm:border border-white/10 bg-slate-950 sm:bg-slate-950/95 shadow-2xl overflow-hidden flex flex-col sm:flex-row"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close */}
        <button
          onClick={onClose}
          className="absolute top-3 right-3 z-10 w-7 h-7 rounded-full bg-black/60 flex items-center justify-center text-slate-500 hover:text-white transition-colors"
        >
          <X size={13} />
        </button>

        {/* Left: animated spinner */}
        <div className="flex-1 bg-black flex items-center justify-center overflow-hidden min-h-0">
          <div className="flex flex-col items-center gap-4">
            <div className={`w-16 h-16 rounded-full border-2 animate-spin ${isQueued ? "border-amber-500/30 border-t-amber-400" : "border-slate-600 border-t-slate-300"}`} />
            <p className="text-[11px] font-mono tracking-widest uppercase" style={{ color: isQueued ? "rgb(251 191 36 / 0.6)" : "rgb(100 116 139)" }}>
              {isQueued ? "Queued" : "Generating..."}
            </p>
          </div>
        </div>

        {/* Info panel */}
        <div className="sm:w-72 flex flex-col border-t border-white/8 sm:border-t-0 sm:border-l sm:border-white/8 shrink-0">
          {/* Desktop: full scrollable info */}
          <div className="hidden sm:block flex-1 overflow-y-auto p-4 space-y-4 min-h-0">
            <div>
              <p className="text-[10px] font-mono text-slate-600 uppercase tracking-widest mb-1.5">Prompt</p>
              <p className="text-[12px] text-slate-200 leading-relaxed">{prompt}</p>
            </div>
            <div>
              <p className="text-[10px] font-mono text-slate-600 uppercase tracking-widest mb-1.5">Model</p>
              <span className="inline-block px-2 py-0.5 rounded-md bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 text-[11px] font-mono">
                {modelName}
              </span>
            </div>
            {(aspectRatio || quality) && (
              <div>
                <p className="text-[10px] font-mono text-slate-600 uppercase tracking-widest mb-1.5">Settings</p>
                <div className="flex flex-wrap gap-1.5">
                  {aspectRatio && (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-violet-500/10 border border-violet-500/20 text-violet-300 text-[11px] font-mono">
                      {aspectRatio}
                    </span>
                  )}
                  {quality && (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-violet-500/10 border border-violet-500/20 text-violet-300 text-[11px] font-mono">
                      {quality.toUpperCase()}
                    </span>
                  )}
                </div>
              </div>
            )}
            {isVideoSlot ? (
              <div className="space-y-3">
                <div>
                  <p className="text-[10px] font-mono text-slate-600 uppercase tracking-widest mb-1.5">Start Frame</p>
                  {startFrameUrl ? (
                    <div className="w-14 h-14 rounded-lg overflow-hidden border border-white/10 bg-slate-800">
                      <img src={startFrameUrl} alt="Start frame" className="w-full h-full object-cover" />
                    </div>
                  ) : (
                    <p className="text-[11px] text-slate-600 italic">No reference</p>
                  )}
                </div>
                <div>
                  <p className="text-[10px] font-mono text-slate-600 uppercase tracking-widest mb-1.5">End Frame</p>
                  {endFrameUrl ? (
                    <div className="w-14 h-14 rounded-lg overflow-hidden border border-white/10 bg-slate-800">
                      <img src={endFrameUrl} alt="End frame" className="w-full h-full object-cover" />
                    </div>
                  ) : (
                    <p className="text-[11px] text-slate-600 italic">No reference</p>
                  )}
                </div>
              </div>
            ) : (referenceImageUrls && referenceImageUrls.length > 0 && (
              <div>
                <p className="text-[10px] font-mono text-slate-600 uppercase tracking-widest mb-1.5">
                  References ({referenceImageUrls.length})
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {referenceImageUrls.map((url, i) => (
                    <div key={i} className="w-11 h-11 rounded-lg overflow-hidden border border-white/10 bg-slate-800">
                      <img src={url} alt="" className="w-full h-full object-cover" />
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* Mobile: compact */}
          <div className="sm:hidden px-4 pt-3 pb-2">
            <p className="text-[11px] text-slate-300 leading-relaxed line-clamp-2">{prompt}</p>
            <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
              <span className="px-2 py-0.5 rounded-md bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 text-[10px] font-mono">{modelName}</span>
              {aspectRatio && <span className="px-2 py-0.5 rounded-md bg-violet-500/10 border border-violet-500/20 text-violet-300 text-[10px] font-mono">{aspectRatio}</span>}
              {quality && <span className="px-2 py-0.5 rounded-md bg-violet-500/10 border border-violet-500/20 text-violet-300 text-[10px] font-mono">{quality.toUpperCase()}</span>}
            </div>
          </div>

          {/* Actions */}
          <div className="p-3 sm:p-4 border-t border-white/8 space-y-2 shrink-0">
            <div className="flex gap-2">
              <button
                onClick={handleCopy}
                className="flex-1 py-1.5 rounded-lg border border-white/10 bg-white/5 hover:bg-white/8 text-[11px] text-slate-300 hover:text-white transition-all flex items-center justify-center gap-1.5"
              >
                {copied ? <Check size={11} /> : <Copy size={11} />}
                {copied ? "Copied" : "Copy Prompt"}
              </button>
              <button
                onClick={() => { onUsePrompt(prompt); onClose() }}
                className="flex-1 py-1.5 rounded-lg border border-white/10 bg-white/8 hover:bg-white/12 text-[11px] text-white font-medium transition-all flex items-center justify-center gap-1.5"
              >
                Use Prompt
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// --- STAR RATING WIDGET ---
function StarRatingWidget({ generationId }: { generationId: number }) {
  const storageKey = `rated-gen-${generationId}`
  const [rating, setRating] = useState<number | null>(() => {
    try { const v = localStorage.getItem(storageKey); return v ? parseInt(v) : null } catch { return null }
  })
  const [hover, setHover] = useState(0)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  const submit = async (score: number) => {
    if (rating !== null || saving) return
    setSaving(true)
    try {
      await fetch('/api/rating', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ generatedImageId: generationId, score }),
      })
      try { localStorage.setItem(storageKey, String(score)) } catch {}
      setRating(score)
      setSaved(true)
    } catch {}
    setSaving(false)
  }

  if (rating !== null) {
    return (
      <div>
        <p className="text-[10px] font-mono text-slate-600 uppercase tracking-widest mb-2">Your Rating</p>
        <div className="flex items-center gap-1">
          {[1, 2, 3, 4, 5].map(s => (
            <Star
              key={s}
              size={15}
              className={s <= rating ? "text-amber-400 fill-amber-400" : "text-slate-700 fill-slate-800"}
            />
          ))}
          {saved && <span className="ml-2 text-[10px] text-slate-500">Thanks!</span>}
        </div>
      </div>
    )
  }

  return (
    <div>
      <p className="text-[10px] font-mono text-slate-600 uppercase tracking-widest mb-1.5">How close is this to your vision?</p>
      <div className="flex items-center gap-0.5">
        {[1, 2, 3, 4, 5].map(s => (
          <button
            key={s}
            disabled={saving}
            onClick={() => submit(s)}
            onMouseEnter={() => setHover(s)}
            onMouseLeave={() => setHover(0)}
            className="p-1 rounded transition-transform hover:scale-110 disabled:opacity-40"
          >
            <Star
              size={16}
              className={s <= hover ? "text-amber-400 fill-amber-400" : "text-slate-600 fill-transparent"}
            />
          </button>
        ))}
      </div>
    </div>
  )
}

// --- IMAGE DETAIL MODAL ---
function ImageDetailModal({
  image,
  onClose,
  onRescan,
  onUsePrompt,
  onAddRef,
}: {
  image: ImageItem
  onClose: () => void
  onRescan: (image: ImageItem) => void
  onUsePrompt: (text: string) => void
  onAddRef: (url: string) => void
}) {
  const [copied, setCopied] = useState(false)
  const [addedRef, setAddedRef] = useState(false)

  const modelName = getModelDisplayName(image.model)
  const modelConfig = IMAGE_MODEL_CONFIGS.find(m => m.apiId === image.model)
  const showSettings = !!(image.aspectRatio || image.quality || modelConfig?.supportsQuality)
  const formattedDate = image.createdAt
    ? new Date(image.createdAt).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })
    : null

  const handleCopy = () => {
    copyToClipboard(image.prompt).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose() }
    window.addEventListener("keydown", handler)
    return () => window.removeEventListener("keydown", handler)
  }, [onClose])

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4 bg-black/80 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="relative w-full h-full sm:h-auto sm:max-w-4xl sm:max-h-[90vh] sm:rounded-2xl border-0 sm:border border-white/10 bg-slate-950 sm:bg-slate-950/95 shadow-2xl overflow-hidden flex flex-col sm:flex-row"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close */}
        <button
          onClick={onClose}
          className="absolute top-3 right-3 z-10 w-7 h-7 rounded-full bg-black/60 flex items-center justify-center text-slate-500 hover:text-white transition-colors"
        >
          <X size={13} />
        </button>

        {/* Image — or failed state */}
        <div className="flex-1 bg-black flex items-center justify-center overflow-hidden min-h-0">
          {image.failed ? (
            <div className="flex flex-col items-center gap-3 p-8 text-center">
              <div className="w-14 h-14 rounded-full border-2 border-red-500/50 flex items-center justify-center">
                <X size={22} className="text-red-400" />
              </div>
              <p className="text-sm text-red-400 font-semibold tracking-wide">Generation Failed</p>
              <p className="text-[12px] text-slate-400 max-w-xs leading-relaxed">{image.failError || "The generation did not complete."}</p>
            </div>
          ) : (
            <img
              src={image.imageUrl}
              alt={image.prompt}
              className="max-w-full max-h-full object-contain cursor-pointer hover:opacity-90 transition-opacity"
              title="Open full size"
              onClick={() => window.open(image.imageUrl, "_blank")}
            />
          )}
        </div>

        {/* Info panel */}
        <div className="sm:w-72 flex flex-col border-t border-white/8 sm:border-t-0 sm:border-l sm:border-white/8 shrink-0">

          {/* Desktop: full scrollable info */}
          <div className="hidden sm:block flex-1 overflow-y-auto p-4 space-y-4 min-h-0">
            <div>
              <p className="text-[10px] font-mono text-slate-600 uppercase tracking-widest mb-1.5">Prompt</p>
              <p className="text-[12px] text-slate-200 leading-relaxed">{image.prompt}</p>
            </div>
            <div>
              <p className="text-[10px] font-mono text-slate-600 uppercase tracking-widest mb-1.5">Model</p>
              <span className="inline-block px-2 py-0.5 rounded-md bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 text-[11px] font-mono">
                {modelName}
              </span>
            </div>
            {formattedDate && (
              <div>
                <p className="text-[10px] font-mono text-slate-600 uppercase tracking-widest mb-1.5">Generated</p>
                <p className="text-[11px] text-slate-400">{formattedDate}</p>
              </div>
            )}
            {showSettings && (
              <div>
                <p className="text-[10px] font-mono text-slate-600 uppercase tracking-widest mb-1.5">Settings</p>
                <div className="flex flex-wrap gap-1.5">
                  {image.aspectRatio && (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-violet-500/10 border border-violet-500/20 text-violet-300 text-[11px] font-mono">
                      {image.aspectRatio}
                    </span>
                  )}
                  {image.quality && (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-violet-500/10 border border-violet-500/20 text-violet-300 text-[11px] font-mono">
                      {image.quality.toUpperCase()}
                    </span>
                  )}
                  {!image.aspectRatio && !image.quality && (
                    <span className="text-[11px] text-slate-600 font-mono">Not recorded</span>
                  )}
                </div>
              </div>
            )}
            {image.referenceImageUrls && image.referenceImageUrls.length > 0 && (
              <div>
                <p className="text-[10px] font-mono text-slate-600 uppercase tracking-widest mb-1.5">
                  References ({image.referenceImageUrls.length})
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {image.referenceImageUrls.map((url, i) => (
                    <div key={i} className="w-11 h-11 rounded-lg overflow-hidden border border-white/10 bg-slate-800">
                      <img src={url} alt="" className="w-full h-full object-cover" />
                    </div>
                  ))}
                </div>
              </div>
            )}
            {!image.failed && image.id > 0 && (
              <div className="pt-1 border-t border-white/[0.06]">
                <StarRatingWidget generationId={image.id} />
              </div>
            )}
          </div>

          {/* Mobile: compact prompt + model only */}
          <div className="sm:hidden px-4 pt-3 pb-3">
            <p className="text-[11px] text-slate-300 leading-relaxed line-clamp-2">{image.prompt}</p>
            <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
              <span className="px-2 py-0.5 rounded-md bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 text-[10px] font-mono">{modelName}</span>
              {image.aspectRatio && <span className="px-2 py-0.5 rounded-md bg-violet-500/10 border border-violet-500/20 text-violet-300 text-[10px] font-mono">{image.aspectRatio}</span>}
              {image.quality && <span className="px-2 py-0.5 rounded-md bg-violet-500/10 border border-violet-500/20 text-violet-300 text-[10px] font-mono">{image.quality.toUpperCase()}</span>}
              {formattedDate && <span className="text-[10px] text-slate-600">{formattedDate}</span>}
            </div>
            {!image.failed && image.id > 0 && (
              <div className="mt-3 pt-3 border-t border-white/[0.06]">
                <StarRatingWidget generationId={image.id} />
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="p-3 sm:p-4 border-t border-white/8 space-y-2 shrink-0">
            <button
              onClick={() => { onRescan(image); onClose() }}
              className="w-full py-2 rounded-lg bg-fuchsia-600 hover:bg-fuchsia-500 text-white text-[12px] font-semibold transition-colors flex items-center justify-center gap-2"
            >
              <RotateCcw size={12} />
              {image.failed ? "Try Again" : "Rescan"}
            </button>
            <div className="flex gap-2">
              <button
                onClick={handleCopy}
                className="flex-1 py-1.5 rounded-lg border border-white/10 bg-white/5 hover:bg-white/8 text-[11px] text-slate-300 hover:text-white transition-all flex items-center justify-center gap-1.5"
              >
                {copied ? <Check size={11} /> : <Copy size={11} />}
                {copied ? "Copied" : "Copy Prompt"}
              </button>
              <button
                onClick={() => { onUsePrompt(image.prompt); onClose() }}
                className="flex-1 py-1.5 rounded-lg border border-white/10 bg-white/8 hover:bg-white/12 text-[11px] text-white font-medium transition-all flex items-center justify-center gap-1.5"
              >
                <span className="hidden sm:inline">Use Prompt</span>
                <span className="sm:hidden">Use</span>
              </button>
              {!image.failed && (
                <>
                  <button
                    onClick={() => {
                      onAddRef(image.imageUrl)
                      setAddedRef(true)
                      setTimeout(() => setAddedRef(false), 2000)
                    }}
                    className={`flex-1 py-1.5 rounded-lg border text-[11px] font-medium transition-all flex items-center justify-center gap-1.5 ${
                      addedRef
                        ? "border-cyan-500/40 bg-cyan-500/15 text-cyan-400"
                        : "border-white/10 bg-white/5 hover:bg-cyan-500/10 hover:border-cyan-500/30 hover:text-cyan-400 text-slate-300"
                    }`}
                  >
                    <ImagePlus size={11} />
                    {addedRef ? "Added!" : "Ref"}
                  </button>
                  <a
                    href={image.imageUrl}
                    download
                    className="flex-1 py-1.5 rounded-lg border border-white/10 bg-white/5 hover:bg-white/8 text-[11px] text-slate-300 hover:text-white transition-all flex items-center justify-center gap-1.5"
                  >
                    <Download size={11} />
                    Download
                  </a>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// --- VIDEO DETAIL MODAL ---
function VideoDetailModal({
  video,
  onClose,
  onRescan,
  onUsePrompt,
}: {
  video: VideoDetailData
  onClose: () => void
  onRescan: (video: VideoDetailData) => void
  onUsePrompt: (text: string) => void
}) {
  const [copied, setCopied] = useState(false)
  const [downloading, setDownloading] = useState(false)

  const modelName = getModelDisplayName(video.model)
  const formattedDate = video.createdAt
    ? new Date(video.createdAt).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })
    : null

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose() }
    window.addEventListener("keydown", handler)
    return () => window.removeEventListener("keydown", handler)
  }, [onClose])

  const handleCopy = () => {
    copyToClipboard(video.prompt).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  const handleDownload = async () => {
    setDownloading(true)
    try {
      const res = await fetch(video.videoUrl)
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `${video.prompt.substring(0, 40).replace(/[^a-z0-9]/gi, "_")}.mp4`
      document.body.appendChild(a)
      a.click()
      URL.revokeObjectURL(url)
      document.body.removeChild(a)
    } catch {}
    finally { setDownloading(false) }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4 bg-black/85 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="relative w-full h-full sm:h-auto sm:max-w-4xl sm:max-h-[90vh] sm:rounded-2xl border-0 sm:border border-white/10 bg-slate-950 sm:bg-slate-950/95 shadow-2xl overflow-hidden flex flex-col sm:flex-row"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close */}
        <button
          onClick={onClose}
          className="absolute top-3 right-3 z-10 w-7 h-7 rounded-full bg-black/60 flex items-center justify-center text-slate-500 hover:text-white transition-colors"
        >
          <X size={13} />
        </button>

        {/* Video player — or error state */}
        <div className="flex-1 bg-black flex items-center justify-center overflow-hidden min-h-0">
          {video.failed ? (
            <div className="flex flex-col items-center gap-3 p-8 text-center">
              <div className="w-12 h-12 rounded-full border-2 border-red-500/60 flex items-center justify-center">
                <X size={20} className="text-red-400" />
              </div>
              <p className="text-sm text-red-400 font-medium">Generation Failed</p>
              <p className="text-[12px] text-slate-500 max-w-xs leading-relaxed">{video.failError || "The video generation did not complete."}</p>
            </div>
          ) : (
            <video
              src={video.videoUrl}
              controls
              autoPlay
              loop
              playsInline
              className="max-w-full max-h-full object-contain"
            />
          )}
        </div>

        {/* Info + actions panel */}
        <div className="sm:w-72 flex flex-col border-t border-white/8 sm:border-t-0 sm:border-l sm:border-white/8 shrink-0">

          {/* Desktop: full info */}
          <div className="hidden sm:block flex-1 overflow-y-auto p-4 space-y-4 min-h-0">
            <div>
              <p className="text-[10px] font-mono text-slate-600 uppercase tracking-widest mb-1.5">Prompt</p>
              <p className="text-[12px] text-slate-200 leading-relaxed">{video.prompt}</p>
            </div>
            <div>
              <p className="text-[10px] font-mono text-slate-600 uppercase tracking-widest mb-1.5">Model</p>
              <span className="inline-block px-2 py-0.5 rounded-md bg-orange-500/10 border border-orange-500/20 text-orange-400 text-[11px] font-mono">
                {modelName}
              </span>
            </div>
            {(video.duration || video.resolution || video.aspectRatio) && (
              <div>
                <p className="text-[10px] font-mono text-slate-600 uppercase tracking-widest mb-1.5">Settings</p>
                <div className="flex flex-wrap gap-1.5">
                  {video.aspectRatio && (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-violet-500/10 border border-violet-500/20 text-violet-300 text-[11px] font-mono">
                      {video.aspectRatio}
                    </span>
                  )}
                  {video.resolution && (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-violet-500/10 border border-violet-500/20 text-violet-300 text-[11px] font-mono">
                      {video.resolution}
                    </span>
                  )}
                  {video.duration && (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-violet-500/10 border border-violet-500/20 text-violet-300 text-[11px] font-mono">
                      {video.duration}s
                    </span>
                  )}
                </div>
              </div>
            )}
            {(video.startFrameUrl || video.endFrameUrl) && (
              <div>
                <p className="text-[10px] font-mono text-slate-600 uppercase tracking-widest mb-1.5">
                  Frames
                </p>
                <div className="flex gap-2">
                  {video.startFrameUrl && (
                    <div className="flex flex-col gap-1">
                      <p className="text-[9px] text-slate-600 font-mono">START</p>
                      <div className="w-14 h-14 rounded-lg overflow-hidden border border-white/10 bg-slate-800">
                        <img src={video.startFrameUrl} alt="start frame" className="w-full h-full object-cover" />
                      </div>
                    </div>
                  )}
                  {video.endFrameUrl && (
                    <div className="flex flex-col gap-1">
                      <p className="text-[9px] text-slate-600 font-mono">END</p>
                      <div className="w-14 h-14 rounded-lg overflow-hidden border border-white/10 bg-slate-800">
                        <img src={video.endFrameUrl} alt="end frame" className="w-full h-full object-cover" />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
            {formattedDate && (
              <div>
                <p className="text-[10px] font-mono text-slate-600 uppercase tracking-widest mb-1.5">Generated</p>
                <p className="text-[11px] text-slate-400">{formattedDate}</p>
              </div>
            )}
            {!video.failed && video.id !== undefined && (
              <div className="pt-1 border-t border-white/[0.06]">
                <StarRatingWidget generationId={video.id} />
              </div>
            )}
          </div>

          {/* Mobile: compact info */}
          <div className="sm:hidden px-4 pt-3 pb-3">
            <p className="text-[11px] text-slate-300 leading-relaxed line-clamp-2">{video.prompt}</p>
            <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
              <span className="px-2 py-0.5 rounded-md bg-orange-500/10 border border-orange-500/20 text-orange-400 text-[10px] font-mono">{modelName}</span>
              {video.aspectRatio && <span className="px-2 py-0.5 rounded-md bg-violet-500/10 border border-violet-500/20 text-violet-300 text-[10px] font-mono">{video.aspectRatio}</span>}
              {video.resolution && <span className="px-2 py-0.5 rounded-md bg-violet-500/10 border border-violet-500/20 text-violet-300 text-[10px] font-mono">{video.resolution}</span>}
              {video.duration && <span className="px-2 py-0.5 rounded-md bg-violet-500/10 border border-violet-500/20 text-violet-300 text-[10px] font-mono">{video.duration}s</span>}
              {formattedDate && <span className="text-[10px] text-slate-600">{formattedDate}</span>}
            </div>
            {!video.failed && video.id !== undefined && (
              <div className="mt-3 pt-3 border-t border-white/[0.06]">
                <StarRatingWidget generationId={video.id} />
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="p-3 sm:p-4 border-t border-white/8 space-y-2 shrink-0">
            <button
              onClick={() => { onRescan(video); onClose() }}
              className="w-full py-2 rounded-lg bg-orange-600 hover:bg-orange-500 text-white text-[12px] font-semibold transition-colors flex items-center justify-center gap-2"
            >
              <RotateCcw size={12} />
              {video.failed ? "Try Again" : "Use This Prompt"}
            </button>
            {!video.failed && (
              <div className="flex gap-2">
                <button
                  onClick={handleCopy}
                  className="flex-1 py-1.5 rounded-lg border border-white/10 bg-white/5 hover:bg-white/8 text-[11px] text-slate-300 hover:text-white transition-all flex items-center justify-center gap-1.5"
                >
                  {copied ? <Check size={11} /> : <Copy size={11} />}
                  {copied ? "Copied" : "Copy"}
                </button>
                <button
                  onClick={() => { onUsePrompt(video.prompt); onClose() }}
                  className="flex-1 py-1.5 rounded-lg border border-white/10 bg-white/8 hover:bg-white/12 text-[11px] text-white font-medium transition-all flex items-center justify-center gap-1.5"
                >
                  <span className="hidden sm:inline">Use Prompt</span>
                  <span className="sm:hidden">Use</span>
                </button>
                <button
                  onClick={handleDownload}
                  disabled={downloading}
                  className="flex-1 py-1.5 rounded-lg border border-white/10 bg-white/5 hover:bg-white/8 text-[11px] text-slate-300 hover:text-white transition-all flex items-center justify-center gap-1.5 disabled:opacity-50"
                >
                  <Download size={11} />
                  {downloading ? "..." : "Download"}
                </button>
                <a
                  href={video.videoUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 py-1.5 rounded-lg border border-white/10 bg-white/5 hover:bg-white/8 text-[11px] text-slate-300 hover:text-white transition-all flex items-center justify-center gap-1.5"
                >
                  Open
                </a>
              </div>
            )}
            {video.failed && (
              <div className="flex gap-2">
                <button
                  onClick={handleCopy}
                  className="flex-1 py-1.5 rounded-lg border border-white/10 bg-white/5 hover:bg-white/8 text-[11px] text-slate-300 hover:text-white transition-all flex items-center justify-center gap-1.5"
                >
                  {copied ? <Check size={11} /> : <Copy size={11} />}
                  {copied ? "Copied Prompt" : "Copy Prompt"}
                </button>
                <button
                  onClick={() => { onUsePrompt(video.prompt); onClose() }}
                  className="flex-1 py-1.5 rounded-lg border border-white/10 bg-white/8 hover:bg-white/12 text-[11px] text-white font-medium transition-all flex items-center justify-center gap-1.5"
                >
                  <span className="hidden sm:inline">Use Prompt</span>
                  <span className="sm:hidden">Use</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// --- IMAGE GRID ---
function ImageGrid({
  signedIn,
  pendingSlots,
  freshImages,
  savedFails,
  onImageClick,
  onPendingClick,
  selectMode,
  selectedIds,
  onSelectToggle,
}: {
  signedIn: boolean
  pendingSlots: PendingSlot[]
  freshImages: ImageItem[]
  savedFails: ImageItem[]
  onImageClick: (img: ImageItem) => void
  onPendingClick?: (slot: PendingSlot) => void
  selectMode?: boolean
  selectedIds?: Set<number>
  onSelectToggle?: (id: number) => void
}) {
  const [images, setImages] = useState<ImageItem[]>([])
  const [loading, setLoading] = useState(false)
  const sentinelRef = useRef<HTMLDivElement>(null)
  const loadingRef = useRef(false)
  const pageRef = useRef(1)
  const hasMoreRef = useRef(true)
  const pageLimitRef = useRef(typeof window !== "undefined" && window.innerWidth < 640 ? 8 : 24)

  const loadNext = useCallback(async () => {
    if (loadingRef.current || !hasMoreRef.current) return
    loadingRef.current = true
    setLoading(true)
    try {
      const res = await fetch(`/api/my-images?page=${pageRef.current}&limit=${pageLimitRef.current}&type=image`)
      if (!res.ok) return
      const data = await res.json()
      if (!data.success) return
      setImages((prev) => {
        const existingIds = new Set(prev.map(i => i.id))
        const newItems = data.images
          .filter((img: any) => !existingIds.has(img.id))
          .map((img: any) => ({
            id: img.id,
            imageUrl: img.imageUrl,
            prompt: img.prompt,
            model: img.model,
            createdAt: img.createdAt,
            referenceImageUrls: img.referenceImageUrls ?? [],
            aspectRatio: img.aspectRatio ?? undefined,
            quality: img.quality ?? undefined,
            videoMetadata: img.videoMetadata ?? undefined,
          }))
        return [...prev, ...newItems]
      })
      hasMoreRef.current = pageRef.current < data.pagination.totalPages
      pageRef.current += 1
    } finally {
      loadingRef.current = false
      setLoading(false)
    }
  }, [])

  const checkSentinel = useCallback(() => {
    if (!sentinelRef.current || !hasMoreRef.current) return
    const rect = sentinelRef.current.getBoundingClientRect()
    if (rect.top < window.innerHeight + 1200) loadNext()
  }, [loadNext])

  useEffect(() => { if (signedIn) loadNext() }, [signedIn, loadNext])
  useEffect(() => { if (!loading) checkSentinel() }, [loading, checkSentinel])

  useEffect(() => {
    if (!signedIn) return
    const sentinel = sentinelRef.current
    if (!sentinel) return
    const observer = new IntersectionObserver(
      (entries) => { if (entries[0].isIntersecting) loadNext() },
      { rootMargin: "1200px" }
    )
    observer.observe(sentinel)
    return () => observer.disconnect()
  }, [signedIn, loadNext])

  if (!signedIn) {
    return (
      <div className="flex flex-col items-center justify-center py-24 px-4">
        <div className="w-full max-w-sm text-center">
          {/* Icon */}
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-cyan-500/20 to-fuchsia-500/20 border border-white/10 flex items-center justify-center mx-auto mb-5">
            <User size={28} className="text-slate-400" />
          </div>

          <h2 className="text-lg font-bold text-white mb-1">Sign in to get started</h2>
          <p className="text-sm text-slate-500 mb-6">Your generations and saved work will appear here.</p>

          <div className="flex flex-col gap-2">
            <Link href="/login" className="block">
              <button className="w-full py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-fuchsia-500 text-black text-sm font-bold hover:opacity-90 transition-opacity">
                Sign In
              </button>
            </Link>
            <Link href="/signup" className="block">
              <button className="w-full py-2.5 rounded-xl border border-white/10 bg-white/5 text-slate-300 text-sm font-medium hover:bg-white/10 hover:text-white transition-all">
                Create Account
              </button>
            </Link>
          </div>
        </div>
      </div>
    )
  }

  if (!loading && images.length === 0 && !hasMoreRef.current) {
    return (
      <div className="flex items-center justify-center py-32 text-slate-600 text-sm">
        No generations yet
      </div>
    )
  }

  return (
    <div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-0.5">
        {/* Pending: loading and failed slots appear at the top */}
        {pendingSlots.map((slot) =>
          slot.status === "loading"
            ? (slot.queueJobId && !slot.nb2RequestId
                ? <QueuedSlot key={slot.slotId} onClick={onPendingClick ? () => onPendingClick(slot) : undefined} />
                : <LoadingSlot key={slot.slotId} onClick={onPendingClick ? () => onPendingClick(slot) : undefined} />)
            : <FailedSlot key={slot.slotId} prompt={slot.prompt} error={slot.error || "Generation failed"} />
        )}
        {/* Fresh: just-completed images and failed tiles, in completion order */}
        {freshImages.map((img) =>
          img.failed
            ? <FailedSlot key={`fresh-${img.id}`} prompt={img.prompt} error={img.failError || "Generation failed"} onClick={selectMode ? undefined : () => onImageClick(img)} />
            : <GridImage key={`fresh-${img.id}`} src={img.imageUrl} alt={img.prompt} onClick={selectMode ? undefined : () => onImageClick(img)} imageId={img.id} directUrl={img.imageUrl} selectMode={selectMode} selected={selectedIds?.has(img.id)} onSelect={onSelectToggle} />
        )}
        {/* DB images merged with restored fails, sorted by createdAt so fails land in the right spot */}
        {(() => {
          const freshIds = new Set(freshImages.map(i => i.id))
          const liveFailIds = new Set(freshImages.filter(i => i.failed).map(i => i.id))
          const dbFiltered = images.filter(img => !freshIds.has(img.id))
          // Only include savedFails not already shown in the live freshImages section
          const failsToMerge = savedFails.filter(f => !liveFailIds.has(f.id))
          const merged = [...dbFiltered, ...failsToMerge].sort((a, b) => {
            const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0
            const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0
            return bTime - aTime
          })
          return merged.map(img =>
            img.failed
              ? <FailedSlot key={`sf-${img.id}`} prompt={img.prompt} error={img.failError || "Generation failed"} onClick={selectMode ? undefined : () => onImageClick(img)} />
              : <GridImage key={`db-${img.id}`} src={img.imageUrl} alt={img.prompt} onClick={selectMode ? undefined : () => onImageClick(img)} imageId={img.id} selectMode={selectMode} selected={selectedIds?.has(img.id)} onSelect={onSelectToggle} />
          )
        })()}
      </div>
      <div ref={sentinelRef} className="h-1" />
      {loading && (
        <div className="flex justify-center py-6">
          <div className="w-5 h-5 rounded-full border-2 border-slate-700 border-t-slate-400 animate-spin" />
        </div>
      )}
    </div>
  )
}

// --- TYPES ---
interface UserPreset {
  id: number
  name: string
  referenceImageUrls: string[]
  createdAt: string
}

interface RefImage {
  id: string
  url: string      // blob URL for uploads, permanent URL for preset-loaded
  file?: File      // undefined when loaded from a preset
}

// --- PRESETS PANEL ---
function PresetsPanel({
  open,
  onClose,
  onLoad,
}: {
  open: boolean
  onClose: () => void
  onLoad: (urls: string[]) => void
}) {
  const [presets, setPresets] = useState<UserPreset[]>([])
  const [loading, setLoading] = useState(false)
  const [deleting, setDeleting] = useState<number | null>(null)

  // Create form
  const [newName, setNewName] = useState("")
  const [newFiles, setNewFiles] = useState<File[]>([])
  const [newPreviews, setNewPreviews] = useState<string[]>([])
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)

  const ref = useRef<HTMLDivElement>(null)
  const createFileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!open) return
    setLoading(true)
    fetch("/api/user/models")
      .then((r) => r.json())
      .then((d) => setPresets(d.models || []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [open])

  useEffect(() => {
    if (!open) return
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    document.addEventListener("mousedown", handleClick)
    return () => document.removeEventListener("mousedown", handleClick)
  }, [open, onClose])

  if (!open) return null

  const handleLoad = (preset: UserPreset) => {
    onLoad(preset.referenceImageUrls)
    onClose()
  }

  const handleDelete = async (id: number) => {
    setDeleting(id)
    try {
      await fetch(`/api/user/models?id=${id}`, { method: "DELETE" })
      setPresets((prev) => prev.filter((p) => p.id !== id))
    } finally {
      setDeleting(null)
    }
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    if (!files.length) return
    const toAdd = files.slice(0, 8 - newFiles.length)
    setNewFiles((prev) => [...prev, ...toAdd])
    setNewPreviews((prev) => [...prev, ...toAdd.map((f) => URL.createObjectURL(f))])
    e.target.value = ""
  }

  const removeNewImage = (i: number) => {
    URL.revokeObjectURL(newPreviews[i])
    setNewFiles((prev) => prev.filter((_, idx) => idx !== i))
    setNewPreviews((prev) => prev.filter((_, idx) => idx !== i))
  }

  const compressImage = (file: File): Promise<Blob> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = (ev) => {
        const img = new window.Image()
        img.onload = () => {
          const MAX = 1920
          let w = img.width, h = img.height
          if (w > MAX || h > MAX) {
            if (w > h) { h = (h / w) * MAX; w = MAX } else { w = (w / h) * MAX; h = MAX }
          }
          const canvas = document.createElement("canvas")
          canvas.width = w; canvas.height = h
          canvas.getContext("2d")?.drawImage(img, 0, 0, w, h)
          canvas.toBlob(
            (blob) => (blob ? resolve(blob) : reject(new Error("Compression failed"))),
            "image/jpeg", 0.85
          )
        }
        img.onerror = () => reject(new Error("Failed to load image"))
        img.src = ev.target?.result as string
      }
      reader.onerror = () => reject(new Error("Failed to read file"))
      reader.readAsDataURL(file)
    })

  const handleCreate = async () => {
    if (!newName.trim()) { setCreateError("Enter a preset name."); return }
    if (newFiles.length === 0) { setCreateError("Upload at least one image."); return }
    setCreating(true)
    setCreateError(null)
    try {
      const urls: string[] = []
      for (const file of newFiles) {
        const blob = await compressImage(file)
        const form = new FormData()
        form.append("file", blob, "reference.jpg")
        const res = await fetch("/api/upload-reference", { method: "POST", body: form })
        if (!res.ok) throw new Error(`Upload failed (${res.status})`)
        const data = await res.json()
        if (!data.url) throw new Error("No URL returned")
        urls.push(data.url)
      }
      const res = await fetch("/api/user/models", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName.trim(), referenceImageUrls: urls }),
      })
      const data = await res.json()
      if (data.success) {
        setPresets((prev) => [data.model, ...prev])
        setNewName("")
        newPreviews.forEach((u) => URL.revokeObjectURL(u))
        setNewFiles([])
        setNewPreviews([])
      } else {
        setCreateError(data.error || "Failed to save preset.")
      }
    } catch (err: any) {
      setCreateError(err.message || "Something went wrong.")
    } finally {
      setCreating(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center pb-44 px-6 pointer-events-auto">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />

      <div
        ref={ref}
        className="relative w-full max-w-md rounded-2xl border border-white/10 bg-slate-900/95 backdrop-blur-md shadow-2xl overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/5">
          <span className="text-sm font-semibold text-white">Presets</span>
          <button onClick={onClose} className="text-slate-500 hover:text-white transition-colors">
            <X size={15} />
          </button>
        </div>

        <div className="max-h-[70vh] overflow-y-auto">
          {/* Saved presets list */}
          <div>
            {loading && (
              <div className="flex justify-center py-8">
                <div className="w-5 h-5 rounded-full border-2 border-slate-700 border-t-slate-400 animate-spin" />
              </div>
            )}
            {!loading && presets.length === 0 && (
              <div className="py-6 text-center text-sm text-slate-500">No presets yet</div>
            )}
            {!loading && presets.map((preset) => (
              <div
                key={preset.id}
                className="flex items-center gap-3 px-4 py-2.5 border-b border-white/5 last:border-0 hover:bg-white/3 transition-colors"
              >
                <div className="flex gap-0.5 shrink-0">
                  {preset.referenceImageUrls.slice(0, 3).map((url, i) => (
                    <div key={i} className="w-8 h-8 rounded overflow-hidden bg-slate-800">
                      <img src={url} alt="" className="w-full h-full object-cover" />
                    </div>
                  ))}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-white truncate">{preset.name}</p>
                  <p className="text-[11px] text-slate-500">{preset.referenceImageUrls.length} image{preset.referenceImageUrls.length !== 1 ? "s" : ""}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button onClick={() => handleLoad(preset)} className="text-[11px] text-slate-400 hover:text-white transition-colors">
                    Load
                  </button>
                  <button
                    onClick={() => handleDelete(preset.id)}
                    disabled={deleting === preset.id}
                    className="text-[11px] text-slate-600 hover:text-red-400 transition-colors"
                  >
                    {deleting === preset.id ? "…" : "Delete"}
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Create new preset */}
          <div className="px-4 py-4 border-t border-white/5 space-y-3">
            <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Create New Preset</p>

            {/* Image upload grid */}
            <div className="flex flex-wrap gap-2">
              {newFiles.length < 8 && (
                <>
                  <input ref={createFileInputRef} type="file" accept="image/*" multiple className="hidden" onChange={handleFileChange} />
                  <button
                    onClick={() => createFileInputRef.current?.click()}
                    className="w-16 h-16 rounded-lg border-2 border-dashed border-white/10 hover:border-white/25 bg-white/3 hover:bg-white/5 flex flex-col items-center justify-center gap-1 transition-all text-slate-500 hover:text-slate-300"
                  >
                    <Plus size={14} />
                    <span className="text-[9px]">Upload</span>
                  </button>
                </>
              )}
              {newPreviews.map((url, i) => (
                <div key={i} className="relative w-16 h-16 rounded-lg overflow-hidden border border-white/10 group">
                  <img src={url} alt="" className="w-full h-full object-cover" />
                  <button
                    onClick={() => removeNewImage(i)}
                    className="absolute top-0.5 right-0.5 w-4 h-4 rounded-full bg-black/70 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <X size={8} className="text-white" />
                  </button>
                </div>
              ))}
            </div>

            {/* Name + save */}
            <div className="flex gap-2">
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleCreate()}
                placeholder="Preset name"
                className="flex-1 bg-slate-800 border border-white/10 rounded-lg px-3 py-1.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-white/20 transition-colors"
              />
              <button
                onClick={handleCreate}
                disabled={creating || !newName.trim() || newFiles.length === 0}
                className="px-3 py-1.5 rounded-lg text-sm font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed bg-white/10 hover:bg-white/15 text-white shrink-0 flex items-center gap-1.5"
              >
                {creating && <div className="w-3 h-3 rounded-full border-2 border-white/30 border-t-white animate-spin" />}
                {creating ? "Saving…" : "Save"}
              </button>
            </div>

            {createError && <p className="text-[11px] text-red-400">{createError}</p>}
          </div>
        </div>
      </div>
    </div>
  )
}

// --- ASPECT RATIO PICKER ---
function AspectRatioPicker({
  ratios,
  value,
  onChange,
}: {
  ratios: AspectRatio[]
  value: AspectRatio
  onChange: (ar: AspectRatio) => void
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener("mousedown", handleClick)
    return () => document.removeEventListener("mousedown", handleClick)
  }, [open])

  return (
    <div className="relative shrink-0" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md border text-[11px] font-mono transition-all ${
          open
            ? "border-white/20 bg-white/10 text-white"
            : "border-white/10 bg-white/5 text-slate-300 hover:border-white/20 hover:text-white"
        }`}
      >
        {value}
        <ChevronDown size={10} className={`transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="absolute bottom-full left-0 mb-2 w-28 rounded-xl border border-white/10 bg-slate-900/95 backdrop-blur-md shadow-2xl overflow-hidden z-50">
          {ratios.map((ar) => (
            <button
              key={ar}
              onClick={() => { onChange(ar); setOpen(false) }}
              className={`w-full text-left px-3 py-2 text-[12px] font-mono transition-colors ${
                ar === value
                  ? "text-white bg-white/8"
                  : "text-slate-400 hover:text-white hover:bg-white/5"
              }`}
            >
              {ar}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// --- PROMPT BOX ---

function PromptBox({
  model,
  onModelChange,
  userId,
  onAddPending,
  onUpdatePending,
  onRemovePending,
  onPrependImage,
  onBalanceChange,
  activeRefImages,
  onDeactivateRef,
  onLoadPreset,
  onUploadRef,
  onStartPolling,
  onStartNb2Polling,
  onTicketsChanged,
  onDeductTickets,
  activeJobCount,
  maxConcurrent,
  promptOverride,
  configOverride,
}: {
  model: ImageModelConfig
  onModelChange: (m: ImageModelConfig) => void
  userId: number | null
  onAddPending: (slot: PendingSlot) => void
  onUpdatePending: (slotId: string, update: Partial<PendingSlot>) => void
  onRemovePending: (slotId: string) => void
  onPrependImage: (img: ImageItem) => void
  onBalanceChange: (balance: number) => void
  activeRefImages: RefImage[]
  onDeactivateRef: (id: string) => void
  onLoadPreset: (urls: string[]) => void
  onUploadRef: (items: RefImage[]) => void
  onStartPolling: (slotId: string, queueId: number, prompt: string) => void
  onStartNb2Polling: (requestId: string, falEndpoint: string, slotIds: string[], prompt: string, outputFormat: string, aspectRatio: string, statusUrl?: string, quality?: string, ticketCost?: number, referenceImageUrls?: string[]) => void
  onTicketsChanged?: (newBalance: number) => void
  onDeductTickets?: (amount: number) => void
  activeJobCount: number
  maxConcurrent: number
  promptOverride?: { text: string; version: number }
  configOverride?: { aspectRatio?: string; quality?: string; outputFormat?: string; imageCount?: number; version: number }
}) {
  const PROMPT_STORAGE_KEY = "pv2-prompt-state"
  const [prompt, setPrompt] = useState<string>("")
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>(model.aspectRatios[0])
  const [quality, setQuality] = useState<Quality>("2k")
  const [outputFormat, setOutputFormat] = useState<"png" | "jpeg" | "webp">("png")
  const [imageCount, setImageCount] = useState<number>(1)
  // Restore saved prompt state after mount to avoid SSR/client hydration mismatch
  useEffect(() => {
    try {
      const s = JSON.parse(sessionStorage.getItem(PROMPT_STORAGE_KEY) || "{}")
      if (s.prompt) setPrompt(s.prompt)
      if (s.aspectRatio) setAspectRatio(s.aspectRatio as AspectRatio)
      if (s.quality) setQuality(s.quality as Quality)
      if (s.outputFormat) setOutputFormat(s.outputFormat)
      if (s.imageCount) setImageCount(Math.min(Math.max(1, s.imageCount), model.maxImages ?? 1))
    } catch {}
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  const [showPresets, setShowPresets] = useState(false)
  const [generating, setGenerating] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    e.target.value = ""
    if (!files.length) return
    const items: RefImage[] = await Promise.all(
      files.map(async (file) => ({
        id: `upload-${Date.now()}-${Math.random()}`,
        url: await compressFileToDataUrl(file),
      }))
    )
    onUploadRef(items)
  }

  // Save prompt box settings whenever they change
  useEffect(() => {
    try {
      sessionStorage.setItem(PROMPT_STORAGE_KEY, JSON.stringify({ prompt, aspectRatio, quality, outputFormat, imageCount }))
    } catch {}
  }, [prompt, aspectRatio, quality, outputFormat, imageCount])

  // Reset imageCount to 1 when model changes (avoids stale count from a previous model inflating the price)
  const prevModelIdRef = useRef(model.id)
  useEffect(() => {
    if (prevModelIdRef.current !== model.id) {
      prevModelIdRef.current = model.id
      setImageCount(1)
    }
  }, [model.id])

  // Sync external prompt injection (from TextDropdown "Use →")
  useEffect(() => {
    if (promptOverride && promptOverride.text) {
      setPrompt(promptOverride.text)
      if (textareaRef.current) {
        textareaRef.current.style.height = "auto"
        textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 160) + "px"
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [promptOverride?.version])

  // Sync external config injection (from Rescan — restores aspect ratio, quality, count, format)
  useEffect(() => {
    if (!configOverride) return
    if (configOverride.aspectRatio && (model.aspectRatios as string[]).includes(configOverride.aspectRatio)) {
      setAspectRatio(configOverride.aspectRatio as AspectRatio)
    }
    if (configOverride.quality) setQuality(configOverride.quality as Quality)
    if (configOverride.outputFormat) setOutputFormat(configOverride.outputFormat as "png" | "jpeg" | "webp")
    if (configOverride.imageCount) {
      setImageCount(Math.min(Math.max(1, configOverride.imageCount), model.maxImages ?? 1))
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [configOverride?.version])

  const ticketCost = calcTicketCost(model.id, quality)
  const totalCost = ticketCost * (model.maxImages ? imageCount : 1)
  const needsRefImage = !!model.requiresReferenceImage && activeRefImages.length === 0
  const slotsNeeded = (model.isFal || model.id === "nano-banana-pro-2") ? imageCount : 1
  const queueFull = activeJobCount + slotsNeeded > maxConcurrent
  const canGenerate = !!userId && prompt.trim().length > 0 && !generating && !needsRefImage && !queueFull

  const handleGenerate = async () => {
    if (!canGenerate) return
    setGenerating(true)
    const currentPrompt = prompt.trim()
    const count = model.maxImages ? imageCount : 1
    // Create N slots upfront — one per image
    // Permanent (Vercel Blob) URLs for storing in DB — data URIs are ephemeral and excluded
    const permanentRefUrls = activeRefImages.map(r => r.url).filter(u => u.startsWith("https://"))
    const slotIds = Array.from({ length: count }, (_, i) => `slot-${Date.now()}-${i}`)
    slotIds.forEach(sid => onAddPending({ slotId: sid, status: "loading", prompt: currentPrompt, modelId: model.apiId, aspectRatio, quality, referenceImageUrls: permanentRefUrls }))
    const slotId = slotIds[0] // alias for single-image paths

    try {
      // Convert ref images to base64
      const referenceImages = await Promise.all(activeRefImages.map(refImageToBase64))

      // --- SeeDream 5.0 Lite: async FAL queue ---
      if (model.id === "seedream-5-lite") {
        const images_base64 = referenceImages.map((b) => b.split(",")[1] || b)
        const sizeParams = seedream5LiteImageSize(quality, aspectRatio)
        await Promise.all(slotIds.map(async (sid) => {
          try {
            const res = await fetch("/api/admin/seedream-5-lite-submit", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                prompt: currentPrompt,
                images_base64,
                ...sizeParams,
                enable_safety_checker: false,
                quality,
                aspectRatio,
                referenceImageUrls: permanentRefUrls,
              }),
            })
            const data = await res.json()
            if (!res.ok || !data.success) {
              onUpdatePending(sid, { status: "failed", error: data.error || "Generation failed" })
              return
            }
            if (data.newBalance !== undefined) onBalanceChange(data.newBalance)
            onUpdatePending(sid, { queueId: data.queueId })
            onStartPolling(sid, data.queueId, currentPrompt)
          } catch (err: any) {
            onUpdatePending(sid, { status: "failed", error: err.message || "Network error" })
          }
        }))
        return
      }

      // --- NanoBanana Pro 2: one FAL job per slot so each can succeed/fail independently ---
      if (model.id === "nano-banana-pro-2") {
        const resolution = quality === "4k" ? "4K" : "2K"
        await Promise.all(slotIds.map(async (sid) => {
          try {
            const res = await fetch("/api/admin/nano-banana-2-live", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                prompt: currentPrompt,
                aspect_ratio: aspectRatio,
                resolution,
                num_images: 1,
                output_format: outputFormat,
                safety_tolerance: "6",
                enable_web_search: true,
                image_urls: referenceImages.length > 0 ? referenceImages : undefined,
              }),
            })
            const submitData = await res.json()
            if (!res.ok || !submitData.success) {
              onUpdatePending(sid, { status: "failed", error: submitData.error || "Submission failed" })
              return
            }
            const nb2Cost = calcTicketCost("nano-banana-pro-2", quality)
            const nb2RefUrls = submitData.permanentReferenceUrls?.length ? submitData.permanentReferenceUrls : permanentRefUrls
            // Deduct tickets immediately — whether queued or submitted directly
            onDeductTickets?.(nb2Cost)
            // Queued (at capacity): store context so the outer component can resume after promotion
            if (submitData.queued) {
              onUpdatePending(sid, {
                queueJobId: submitData.queueId,
                nb2StatusUrl: "/api/admin/nb2-status",
                nb2AspectRatio: aspectRatio,
                nb2OutputFormat: outputFormat,
                nb2TicketCost: nb2Cost,
                referenceImageUrls: nb2RefUrls,
              })
              return
            }
            const { requestId, falEndpoint } = submitData
            onUpdatePending(sid, {
              nb2RequestId: requestId,
              nb2FalEndpoint: falEndpoint,
              nb2OutputFormat: outputFormat,
              nb2AspectRatio: aspectRatio,
              nb2Quality: quality,
              nb2TicketCost: nb2Cost,
              referenceImageUrls: nb2RefUrls,
            })
            onStartNb2Polling(requestId, falEndpoint, [sid], currentPrompt, outputFormat, aspectRatio, "/api/admin/nb2-status", quality, nb2Cost, nb2RefUrls)
          } catch (err: any) {
            onUpdatePending(sid, { status: "failed", error: err.message || "Network error" })
          }
        }))
        return
      }

      // --- Kling V3 Image: one FAL job per slot ---
      if (model.id === "kling-v3-image") {
        const resolution = quality === "2k" ? "2K" : "1K"
        const imageUrl = referenceImages.length > 0 ? referenceImages[0] : undefined
        await Promise.all(slotIds.map(async (sid) => {
          try {
            const res = await fetch("/api/admin/kling-image-submit", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                prompt: currentPrompt,
                image_url: imageUrl,
                num_images: 1,
                aspect_ratio: aspectRatio,
                output_format: outputFormat,
                resolution,
              }),
            })
            const submitData = await res.json()
            if (!res.ok || !submitData.success) {
              onUpdatePending(sid, { status: "failed", error: submitData.error || "Submission failed" })
              return
            }
            const klingV3Cost = calcTicketCost("kling-v3-image", quality)
            const klingV3RefUrls = submitData.permanentReferenceUrls?.length ? submitData.permanentReferenceUrls : permanentRefUrls
            onDeductTickets?.(klingV3Cost)
            if (submitData.queued) {
              onUpdatePending(sid, {
                queueJobId: submitData.queueId,
                nb2StatusUrl: "/api/admin/kling-image-status",
                nb2AspectRatio: aspectRatio,
                nb2OutputFormat: outputFormat,
                nb2TicketCost: klingV3Cost,
                referenceImageUrls: klingV3RefUrls,
              })
              return
            }
            const { requestId, falEndpoint } = submitData
            onUpdatePending(sid, {
              nb2RequestId: requestId,
              nb2FalEndpoint: falEndpoint,
              nb2OutputFormat: outputFormat,
              nb2AspectRatio: aspectRatio,
              nb2StatusUrl: "/api/admin/kling-image-status",
              nb2TicketCost: klingV3Cost,
              referenceImageUrls: klingV3RefUrls,
            })
            onStartNb2Polling(requestId, falEndpoint, [sid], currentPrompt, outputFormat, aspectRatio, "/api/admin/kling-image-status", undefined, klingV3Cost, klingV3RefUrls)
          } catch (err: any) {
            onUpdatePending(sid, { status: "failed", error: err.message || "Network error" })
          }
        }))
        return
      }

      // --- Kling O3 (Omni Image): one FAL job per slot ---
      if (model.id === "kling-o3-image") {
        const resolution = quality === "4k" ? "4K" : quality === "2k" ? "2K" : "1K"
        await Promise.all(slotIds.map(async (sid) => {
          try {
            const res = await fetch("/api/admin/kling-o3-submit", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                prompt: currentPrompt,
                image_urls: referenceImages.length > 0 ? referenceImages : undefined,
                num_images: 1,
                aspect_ratio: aspectRatio,
                output_format: outputFormat,
                resolution,
              }),
            })
            const submitData = await res.json()
            if (!res.ok || !submitData.success) {
              onUpdatePending(sid, { status: "failed", error: submitData.error || "Submission failed" })
              return
            }
            const klingO3Cost = calcTicketCost("kling-o3-image", quality)
            const klingO3RefUrls = submitData.permanentReferenceUrls?.length ? submitData.permanentReferenceUrls : permanentRefUrls
            onDeductTickets?.(klingO3Cost)
            if (submitData.queued) {
              onUpdatePending(sid, {
                queueJobId: submitData.queueId,
                nb2StatusUrl: "/api/admin/kling-o3-status",
                nb2AspectRatio: aspectRatio,
                nb2OutputFormat: outputFormat,
                nb2Quality: quality,
                nb2TicketCost: klingO3Cost,
                referenceImageUrls: klingO3RefUrls,
              })
              return
            }
            const { requestId, falEndpoint } = submitData
            onUpdatePending(sid, {
              nb2RequestId: requestId,
              nb2FalEndpoint: falEndpoint,
              nb2OutputFormat: outputFormat,
              nb2AspectRatio: aspectRatio,
              nb2StatusUrl: "/api/admin/kling-o3-status",
              nb2Quality: quality,
              nb2TicketCost: klingO3Cost,
              referenceImageUrls: klingO3RefUrls,
            })
            onStartNb2Polling(requestId, falEndpoint, [sid], currentPrompt, outputFormat, aspectRatio, "/api/admin/kling-o3-status", quality, klingO3Cost, klingO3RefUrls)
          } catch (err: any) {
            onUpdatePending(sid, { status: "failed", error: err.message || "Network error" })
          }
        }))
        return
      }

      // --- Wan 2.7 Pro: one FAL job per slot ---
      if (model.id === "wan-2.7-pro") {
        const imageUrls = referenceImages.length > 0 ? referenceImages : undefined
        await Promise.all(slotIds.map(async (sid) => {
          try {
            const res = await fetch("/api/admin/wan-27-pro-submit", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                prompt: currentPrompt,
                image_urls: imageUrls,
                aspect_ratio: aspectRatio,
                num_images: 1,
              }),
            })
            const submitData = await res.json()
            if (!res.ok || !submitData.success) {
              onUpdatePending(sid, { status: "failed", error: submitData.error || "Submission failed" })
              return
            }
            const wan27Cost = calcTicketCost("wan-2.7-pro", quality)
            const wan27RefUrls = submitData.permanentReferenceUrls?.length ? submitData.permanentReferenceUrls : permanentRefUrls
            onDeductTickets?.(wan27Cost)
            if (submitData.queued) {
              onUpdatePending(sid, {
                queueJobId: submitData.queueId,
                nb2StatusUrl: "/api/admin/wan-27-pro-status",
                nb2AspectRatio: aspectRatio,
                nb2TicketCost: wan27Cost,
                referenceImageUrls: wan27RefUrls,
              })
              return
            }
            const { requestId, falEndpoint } = submitData
            onUpdatePending(sid, {
              nb2RequestId: requestId,
              nb2FalEndpoint: falEndpoint,
              nb2AspectRatio: aspectRatio,
              nb2StatusUrl: "/api/admin/wan-27-pro-status",
              nb2TicketCost: wan27Cost,
              referenceImageUrls: wan27RefUrls,
            })
            onStartNb2Polling(requestId, falEndpoint, [sid], currentPrompt, outputFormat, aspectRatio, "/api/admin/wan-27-pro-status", undefined, wan27Cost, wan27RefUrls)
          } catch (err: any) {
            onUpdatePending(sid, { status: "failed", error: err.message || "Network error" })
          }
        }))
        return
      }

      // --- Gemini image models: async submit so the button unlocks immediately ---
      if (model.id === "pro-scanner-v3" || model.id === "flash-scanner-v2.5") {
        await Promise.all(slotIds.map(async (sid) => {
          try {
            const res = await fetch("/api/admin/gemini-submit", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                prompt: currentPrompt,
                model: model.apiId,
                quality,
                aspectRatio,
                referenceImages,
                referenceImageUrls: permanentRefUrls,
              }),
            })
            const data = await res.json()
            if (!res.ok || !data.success) {
              onUpdatePending(sid, { status: "failed", error: data.error || "Generation failed" })
              return
            }
            if (data.newBalance !== undefined) onBalanceChange(data.newBalance)
            onUpdatePending(sid, { queueId: data.queueId })
            onStartPolling(sid, data.queueId, currentPrompt)
          } catch (err: any) {
            onUpdatePending(sid, { status: "failed", error: err.message || "Network error" })
          }
        }))
        return
      }

      // --- FAL async (NB Pro, SeeDream 4.5, FLUX 2 multi-image) ---
      if (model.isFal && count > 1) {
        // Submit N separate jobs concurrently — each gets its own queue entry and slot
        await Promise.all(slotIds.map(async (sid) => {
          try {
            const res = await fetch("/api/generate", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ prompt: currentPrompt, model: model.apiId, quality, aspectRatio, referenceImages }),
            })
            const data = await res.json()
            if (!res.ok) { onUpdatePending(sid, { status: "failed", error: data.error || "Generation failed" }); return }
            if (data.newBalance !== undefined) onBalanceChange(data.newBalance)
            onUpdatePending(sid, { queueId: data.queueId })
            onStartPolling(sid, data.queueId, currentPrompt)
          } catch (err: any) {
            onUpdatePending(sid, { status: "failed", error: err.message || "Network error" })
          }
        }))
      } else {
        // Single FAL request (count=1)
        const res = await fetch("/api/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ prompt: currentPrompt, model: model.apiId, quality, aspectRatio, referenceImages }),
        })
        const data = await res.json()
        if (!res.ok) {
          onUpdatePending(slotId, { status: "failed", error: data.error || "Generation failed" })
          return
        }
        if (data.newBalance !== undefined) onBalanceChange(data.newBalance)
        onUpdatePending(slotId, { queueId: data.queueId })
        onStartPolling(slotId, data.queueId, currentPrompt)
      }
    } catch (err: any) {
      slotIds.forEach(sid => onUpdatePending(sid, { status: "failed", error: err.message || "Network error" }))
    } finally {
      setGenerating(false)
    }
  }

  const handleLoadPreset = (urls: string[]) => onLoadPreset(urls)

  // Reset aspect ratio, quality, and image count when model changes
  useEffect(() => {
    if (!model.aspectRatios.includes(aspectRatio)) {
      setAspectRatio(model.aspectRatios[0])
    }
    const availableQualities = model.qualityOptions ?? (["2k", "4k"] as Quality[])
    if (!availableQualities.includes(quality)) {
      setQuality(availableQualities[0])
    }
    if (imageCount > (model.maxImages ?? 1)) {
      setImageCount(1)
    }
  }, [model])

  const [showModelPicker, setShowModelPicker] = useState(false)
  const modelPickerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!showModelPicker) return
    function handleClick(e: MouseEvent) {
      if (modelPickerRef.current && !modelPickerRef.current.contains(e.target as Node)) {
        setShowModelPicker(false)
      }
    }
    document.addEventListener("mousedown", handleClick)
    return () => document.removeEventListener("mousedown", handleClick)
  }, [showModelPicker])

  return (
    <div className="fixed bottom-0 left-0 right-0 px-6 pb-6 pt-3 bg-gradient-to-t from-[#050810] via-[#050810]/80 to-transparent pointer-events-none">
      <div className="max-w-3xl mx-auto pointer-events-auto space-y-2">

        {/* Active reference image previews */}
        {activeRefImages.length > 0 && (
          <div className="flex items-center gap-2 px-1">
            {activeRefImages.map((img) => (
              <div key={img.id} className="relative shrink-0 w-14 h-14 rounded-lg overflow-hidden border border-cyan-500/30 group">
                <img src={img.url} alt="reference" className="w-full h-full object-cover" />
                <button
                  onClick={() => onDeactivateRef(img.id)}
                  title="Deactivate"
                  className="absolute top-0.5 right-0.5 w-4 h-4 rounded-full bg-black/70 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <X size={9} className="text-white" />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Prompt card */}
        <div className="rounded-2xl border border-white/10 bg-slate-900/80 backdrop-blur-md shadow-2xl">
          {/* Textarea */}
          <textarea
            ref={textareaRef}
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) handleGenerate() }}
            placeholder="Describe what you want to create..."
            rows={1}
            onInput={(e) => {
              const el = e.currentTarget
              el.style.height = "auto"
              el.style.height = Math.min(el.scrollHeight, 160) + "px"
            }}
            className="w-full resize-none bg-transparent px-5 pt-4 pb-3 text-sm text-white placeholder-slate-500 focus:outline-none leading-relaxed"
          />

          {/* Controls strip */}
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5 px-3 pb-3 pt-1 border-t border-white/5">
            {/* Model picker badge */}
            <div className="relative shrink-0" ref={modelPickerRef}>
              <button
                onClick={() => setShowModelPicker((v) => !v)}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md border text-[11px] font-medium transition-all ${
                  showModelPicker
                    ? "border-white/20 bg-white/10 text-white"
                    : "border-white/10 bg-white/5 text-slate-300 hover:border-white/20 hover:text-white"
                }`}
              >
                {model.name}
                <ChevronDown size={10} className={`transition-transform ${showModelPicker ? "rotate-180" : ""}`} />
              </button>

              {showModelPicker && (
                <div className="absolute bottom-full left-0 mb-2 w-52 rounded-xl border border-white/10 bg-slate-900/95 backdrop-blur-md shadow-2xl overflow-hidden z-50">
                  {IMAGE_MODEL_CONFIGS.map((m) => (
                    <button
                      key={m.id}
                      onClick={() => { onModelChange(m); setShowModelPicker(false) }}
                      className={`w-full text-left px-3 py-2 text-[12px] transition-colors flex items-center justify-between gap-2 ${
                        m.id === model.id
                          ? "text-white bg-white/8"
                          : "text-slate-400 hover:text-white hover:bg-white/5"
                      }`}
                    >
                      <span>{m.name}</span>
                      {IMAGE_MODEL_COST[m.id] && <CostBadge tier={IMAGE_MODEL_COST[m.id]} />}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="w-px h-3 bg-white/10 shrink-0 hidden sm:block" />

            {/* Aspect ratio picker badge */}
            <AspectRatioPicker
              ratios={model.aspectRatios}
              value={aspectRatio}
              onChange={setAspectRatio}
            />

            {/* Quality toggle */}
            {model.supportsQuality && (
              <>
                <div className="w-px h-3 bg-white/10 shrink-0 hidden sm:block" />
                <div className="flex items-center rounded-md overflow-hidden border border-white/10 shrink-0">
                  {(model.qualityOptions ?? (["2k", "4k"] as Quality[])).map((q) => (
                    <button
                      key={q}
                      onClick={() => setQuality(q)}
                      className={`px-2.5 py-1 text-[11px] font-mono uppercase transition-colors ${
                        quality === q ? "bg-white/15 text-white" : "text-slate-500 hover:text-slate-300"
                      }`}
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </>
            )}

            {/* Output format picker — NanoBanana Pro 2 only */}
            {model.supportsOutputFormat && (
              <>
                <div className="w-px h-3 bg-white/10 shrink-0 hidden sm:block" />
                <div className="flex items-center rounded-md overflow-hidden border border-white/10 shrink-0">
                  {(["png", "jpeg", "webp"] as const).map((fmt) => (
                    <button
                      key={fmt}
                      onClick={() => setOutputFormat(fmt)}
                      className={`px-2.5 py-1 text-[11px] font-mono transition-colors ${
                        outputFormat === fmt ? "bg-white/15 text-white" : "text-slate-500 hover:text-slate-300"
                      }`}
                    >
                      {fmt}
                    </button>
                  ))}
                </div>
              </>
            )}

            {/* Upload reference image from prompt box */}
            {model.maxReferenceImages > 0 && (
              <>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={handleUpload}
                />
                <div className="w-px h-3 bg-white/10 shrink-0 hidden sm:block" />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-md border border-white/10 bg-white/5 text-[11px] text-slate-300 hover:border-white/20 hover:text-white transition-all shrink-0"
                >
                  <ImagePlus size={11} />
                  {activeRefImages.length > 0 ? `${activeRefImages.length}/${model.maxReferenceImages}` : "Ref"}
                </button>
              </>
            )}

            {/* Presets */}
            <div className="w-px h-3 bg-white/10 shrink-0 hidden sm:block" />
            <button
              onClick={() => setShowPresets(true)}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-md border border-white/10 bg-white/5 text-[11px] text-slate-300 hover:border-white/20 hover:text-white transition-all shrink-0"
            >
              <BookMarked size={11} />
              Presets
            </button>

            {/* Image count picker — only for models that support multi-image */}
            {(model.maxImages ?? 1) > 1 && (
              <>
                <div className="w-px h-3 bg-white/10 shrink-0 hidden sm:block" />
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={() => setImageCount(c => Math.max(1, c - 1))}
                    disabled={imageCount <= 1}
                    className="w-5 h-5 flex items-center justify-center rounded text-slate-400 hover:text-white hover:bg-white/10 disabled:opacity-25 disabled:cursor-not-allowed transition-all text-sm leading-none font-bold"
                  >−</button>
                  <span className="text-[11px] font-mono text-slate-300 w-3.5 text-center tabular-nums select-none">{imageCount}</span>
                  <button
                    onClick={() => setImageCount(c => Math.min(model.maxImages ?? 1, c + 1))}
                    disabled={imageCount >= (model.maxImages ?? 1)}
                    className="w-5 h-5 flex items-center justify-center rounded text-slate-400 hover:text-white hover:bg-white/10 disabled:opacity-25 disabled:cursor-not-allowed transition-all text-sm leading-none font-bold"
                  >+</button>
                </div>
              </>
            )}

            {/* Generate button — own row on mobile, pushed right on desktop */}
            <div className="hidden sm:block sm:flex-1" />
            <div className="flex items-center gap-2 w-full sm:w-auto">
              {needsRefImage && !queueFull && (
                <span className="text-[10px] text-amber-400/80 shrink-0">Requires ≥1 ref image</span>
              )}
              {queueFull && (
                <span className="text-[10px] text-red-400/80 shrink-0">Queue full ({activeJobCount}/{maxConcurrent === Infinity ? "∞" : maxConcurrent})</span>
              )}
              <button
                onClick={handleGenerate}
                disabled={!canGenerate}
                className={`flex items-center justify-center gap-2 px-4 py-1.5 rounded-lg text-[12px] font-semibold transition-all flex-1 sm:flex-none ${
                  canGenerate
                    ? "bg-gradient-to-r from-cyan-500 to-fuchsia-500 text-black hover:opacity-90"
                    : "bg-white/5 text-slate-600 cursor-not-allowed border border-white/10"
                }`}
              >
                {generating ? (
                  <div className="w-3 h-3 rounded-full border-2 border-black/30 border-t-black animate-spin" />
                ) : (
                  <Ticket size={12} />
                )}
                {queueFull ? "Queue Full" : "Generate"}
                {!queueFull && <span className="opacity-70">{totalCost}</span>}
              </button>
            </div>
          </div>
        </div>
      </div>

      <PresetsPanel
        open={showPresets}
        onClose={() => setShowPresets(false)}
        onLoad={handleLoadPreset}
      />
    </div>
  )
}

// --- VIDEO COMPONENTS ---

function FrameUploadArea({
  preview, uploading, onSelect, onClear, label, optional, inputRef,
}: {
  preview: string | null
  uploading: boolean
  onSelect: (f: File) => void
  onClear: () => void
  label: string
  optional?: boolean
  inputRef: React.RefObject<HTMLInputElement>
}) {
  return (
    <div className="relative">
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={e => { const f = e.target.files?.[0]; if (f) { e.target.value = ""; onSelect(f) } }}
      />
      {preview ? (
        <div className="relative rounded-lg overflow-hidden bg-black" style={{ aspectRatio: "16/9" }}>
          <img src={preview} alt="frame" className="w-full h-full object-contain" />
          {uploading && (
            <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
              <div className="w-5 h-5 rounded-full border-2 border-orange-400/30 border-t-orange-400 animate-spin" />
            </div>
          )}
          <button
            onClick={onClear}
            className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/70 hover:bg-black flex items-center justify-center transition-all"
          >
            <X size={10} className="text-white" />
          </button>
        </div>
      ) : (
        <button
          onClick={() => inputRef.current?.click()}
          className="w-full rounded-lg border border-dashed border-orange-500/30 hover:border-orange-500/50 flex flex-col items-center justify-center gap-1.5 transition-all py-6"
        >
          <ImagePlus size={16} className="text-orange-400/60" />
          <span className="text-[10px] text-slate-500">{label}</span>
        </button>
      )}
    </div>
  )
}

// SeeDance 2.0 Reference-to-Video multi-asset panel
function SD20RefPanel({
  videoRefImagePreviews, onAddRefImage, onRemoveRefImage,
  videoRefVideoFilenames, videoRefVideoUrls, onAddRefVideo, onRemoveRefVideo,
  videoRefAudioFilenames, onAddRefAudio, onRemoveRefAudio,
}: {
  videoRefImagePreviews: string[]
  onAddRefImage: (f: File) => void
  onRemoveRefImage: (i: number) => void
  videoRefVideoFilenames: string[]
  videoRefVideoUrls: (string | null)[]
  onAddRefVideo: (f: File, duration: number) => void
  onRemoveRefVideo: (i: number, duration: number) => void
  videoRefAudioFilenames: string[]
  onAddRefAudio: (f: File) => void
  onRemoveRefAudio: (i: number) => void
}) {
  const imgInputRef  = useRef<HTMLInputElement>(null)
  const vidInputRef  = useRef<HTMLInputElement>(null)
  const audInputRef  = useRef<HTMLInputElement>(null)
  // Store per-video duration so we can subtract it on remove
  const videoDurations = useRef<number[]>([])

  function handleVideoFile(file: File) {
    const objUrl = URL.createObjectURL(file)
    const vid = document.createElement("video")
    vid.preload = "metadata"
    vid.onloadedmetadata = () => {
      URL.revokeObjectURL(objUrl)
      const dur = vid.duration
      videoDurations.current.push(dur)
      onAddRefVideo(file, dur)
    }
    vid.onerror = () => { URL.revokeObjectURL(objUrl); videoDurations.current.push(0); onAddRefVideo(file, 0) }
    vid.src = objUrl
  }

  return (
    <div className="space-y-4">
      {/* Reference Images */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">
            Reference Images <span className="text-slate-600 normal-case font-normal">(optional)</span>
          </p>
          {videoRefImagePreviews.length < 5 && (
            <button onClick={() => imgInputRef.current?.click()}
              className="text-[10px] text-orange-400/70 hover:text-orange-400 transition-colors flex items-center gap-0.5">
              <Plus size={10} />Add
            </button>
          )}
        </div>
        <input ref={imgInputRef} type="file" accept="image/*" className="hidden"
          onChange={e => { const f = e.target.files?.[0]; if (f) { e.target.value = ""; onAddRefImage(f) } }} />
        {videoRefImagePreviews.length > 0 ? (
          <div className="grid grid-cols-4 gap-1.5">
            {videoRefImagePreviews.map((preview, i) => (
              <div key={i} className="relative aspect-square rounded-md overflow-hidden bg-black border border-white/10 group">
                <img src={preview} alt="" className="w-full h-full object-cover" />
                <button onClick={() => onRemoveRefImage(i)}
                  className="absolute top-0.5 right-0.5 w-4 h-4 rounded-full bg-black/70 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                  <X size={8} className="text-white" />
                </button>
              </div>
            ))}
          </div>
        ) : (
          <button onClick={() => imgInputRef.current?.click()}
            className="w-full py-4 rounded-lg border border-dashed border-white/10 hover:border-white/20 text-[10px] text-slate-600 hover:text-slate-400 transition-all flex items-center justify-center gap-1.5">
            <ImagePlus size={12} />Upload reference images
          </button>
        )}
      </div>

      {/* Reference Videos */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">
            Reference Videos <span className="text-slate-600 normal-case font-normal">(optional)</span>
          </p>
          {videoRefVideoFilenames.length < 3 && (
            <button onClick={() => vidInputRef.current?.click()}
              className="text-[10px] text-orange-400/70 hover:text-orange-400 transition-colors flex items-center gap-0.5">
              <Plus size={10} />Add
            </button>
          )}
        </div>
        <input ref={vidInputRef} type="file" accept="video/*" className="hidden"
          onChange={e => { const f = e.target.files?.[0]; if (f) { e.target.value = ""; handleVideoFile(f) } }} />
        {videoRefVideoFilenames.length > 0 ? (
          <div className="space-y-1">
            {videoRefVideoFilenames.map((name, i) => (
              <div key={i} className={`flex items-center gap-2 px-2.5 py-2 rounded-lg border text-[11px] ${videoRefVideoUrls[i] ? "bg-white/5 border-white/10 text-slate-300" : "bg-slate-900/80 border-white/5 text-slate-500"}`}>
                {videoRefVideoUrls[i]
                  ? <Check size={11} className="text-green-400 shrink-0" />
                  : <div className="w-3 h-3 rounded-full border-2 border-orange-400/30 border-t-orange-400 animate-spin shrink-0" />}
                <span className="truncate flex-1">{name.length > 22 ? name.slice(0, 20) + "…" : name}</span>
                <button onClick={() => { const dur = videoDurations.current[i] || 0; onRemoveRefVideo(i, dur) }}
                  className="shrink-0 text-slate-600 hover:text-red-400 transition-colors"><X size={11} /></button>
              </div>
            ))}
          </div>
        ) : (
          <button onClick={() => vidInputRef.current?.click()}
            className="w-full py-4 rounded-lg border border-dashed border-white/10 hover:border-white/20 text-[10px] text-slate-600 hover:text-slate-400 transition-all flex items-center justify-center gap-1.5">
            <Video size={12} />Upload reference videos
          </button>
        )}
      </div>

      {/* Reference Audio */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">
            Reference Audio <span className="text-slate-600 normal-case font-normal">(optional)</span>
          </p>
          {videoRefAudioFilenames.length < 2 && (
            <button onClick={() => audInputRef.current?.click()}
              className="text-[10px] text-orange-400/70 hover:text-orange-400 transition-colors flex items-center gap-0.5">
              <Plus size={10} />Add
            </button>
          )}
        </div>
        <input ref={audInputRef} type="file" accept="audio/*" className="hidden"
          onChange={e => { const f = e.target.files?.[0]; if (f) { e.target.value = ""; onAddRefAudio(f) } }} />
        {videoRefAudioFilenames.length > 0 ? (
          <div className="space-y-1">
            {videoRefAudioFilenames.map((name, i) => (
              <div key={i} className="flex items-center gap-2 px-2.5 py-2 rounded-lg bg-white/5 border border-white/10 text-[11px] text-slate-300">
                <Check size={11} className="text-green-400 shrink-0" />
                <span className="truncate flex-1">{name.length > 22 ? name.slice(0, 20) + "…" : name}</span>
                <button onClick={() => onRemoveRefAudio(i)} className="shrink-0 text-slate-600 hover:text-red-400 transition-colors"><X size={11} /></button>
              </div>
            ))}
          </div>
        ) : (
          <button onClick={() => audInputRef.current?.click()}
            className="w-full py-4 rounded-lg border border-dashed border-white/10 hover:border-white/20 text-[10px] text-slate-600 hover:text-slate-400 transition-all flex items-center justify-center gap-1.5">
            <Plus size={12} />Upload reference audio
          </button>
        )}
      </div>
    </div>
  )
}

function VideoCustomizationPanel({
  model,
  duration, onDurationChange,
  aspectRatio, onAspectRatioChange,
  resolution, onResolutionChange,
  audioEnabled, onAudioToggle,
  audioFile, onAudioFileChange,
  startFramePreview, onStartFrameSelect, onClearStartFrame,
  endFramePreview, onEndFrameSelect, onClearEndFrame,
  startFrameUploading, endFrameUploading, audioUploading,
  motionVideoFilename, onMotionVideoSelect, onClearMotionVideo, motionVideoUploading,
  motionVideoDuration, onMotionVideoDurationChange,
  characterOrientation, onCharacterOrientationChange,
  keepOriginalSound, onKeepOriginalSoundToggle,
  videoRefImagePreviews = [], onAddRefImage, onRemoveRefImage,
  videoRefVideoFilenames = [], videoRefVideoUrls = [], onAddRefVideo, onRemoveRefVideo,
  videoRefAudioFilenames = [], onAddRefAudio, onRemoveRefAudio,
  videoRefVideoDuration = 0,
  sd20Mode = "t2v" as "t2v" | "i2v" | "r2v",
  onSD20ModeChange,
  lipsyncVideoFilename,
  lipsyncVideoUploading,
  lipsyncVideoDuration,
  onLipsyncVideoSelect,
  onClearLipsyncVideo,
  lipsyncAudioFilename,
  lipsyncAudioUploading,
  onLipsyncAudioSelect,
  onClearLipsyncAudio,
  lipsyncSyncMode = "cut_off",
  onLipsyncSyncModeChange,
}: {
  model: VideoModelConfig
  duration: string; onDurationChange: (d: string) => void
  aspectRatio: string; onAspectRatioChange: (r: string) => void
  resolution: string; onResolutionChange: (r: string) => void
  audioEnabled: boolean; onAudioToggle: (v: boolean) => void
  audioFile: File | null; onAudioFileChange: (f: File) => void
  startFramePreview: string | null; onStartFrameSelect: (f: File) => void; onClearStartFrame: () => void
  endFramePreview: string | null; onEndFrameSelect: (f: File) => void; onClearEndFrame: () => void
  startFrameUploading: boolean; endFrameUploading: boolean; audioUploading: boolean
  motionVideoFilename: string | null; onMotionVideoSelect: (f: File) => void; onClearMotionVideo: () => void; motionVideoUploading: boolean
  motionVideoDuration: number | null; onMotionVideoDurationChange: (d: number) => void
  characterOrientation: string; onCharacterOrientationChange: (o: string) => void
  keepOriginalSound: boolean; onKeepOriginalSoundToggle: (v: boolean) => void
  // SeeDance 2.0 r2v
  videoRefImagePreviews?: string[]
  onAddRefImage?: (f: File) => void
  onRemoveRefImage?: (i: number) => void
  videoRefVideoFilenames?: string[]
  videoRefVideoUrls?: (string | null)[]
  onAddRefVideo?: (f: File, duration: number) => void
  onRemoveRefVideo?: (i: number, duration: number) => void
  videoRefAudioFilenames?: string[]
  onAddRefAudio?: (f: File) => void
  onRemoveRefAudio?: (i: number) => void
  videoRefVideoDuration?: number
  // SeeDance 2.0 mode switcher
  sd20Mode?: "t2v" | "i2v" | "r2v"
  onSD20ModeChange?: (m: "t2v" | "i2v" | "r2v") => void
  // Lipsync v3
  lipsyncVideoFilename?: string | null
  lipsyncVideoUploading?: boolean
  lipsyncVideoDuration?: number
  onLipsyncVideoSelect?: (f: File, duration: number, aspectRatio?: string) => void
  onClearLipsyncVideo?: () => void
  lipsyncAudioFilename?: string | null
  lipsyncAudioUploading?: boolean
  onLipsyncAudioSelect?: (f: File) => void
  onClearLipsyncAudio?: () => void
  lipsyncSyncMode?: string
  onLipsyncSyncModeChange?: (m: string) => void
}) {
  const startRef      = useRef<HTMLInputElement>(null!)
  const endRef        = useRef<HTMLInputElement>(null!)
  const audioRef      = useRef<HTMLInputElement>(null)
  const lipsyncVidRef = useRef<HTMLInputElement>(null)
  const lipsyncAudRef = useRef<HTMLInputElement>(null)
  const [motionVideoError, setMotionVideoError] = useState<string | null>(null)
  const [lipsyncVideoError, setLipsyncVideoError] = useState<string | null>(null)

  function handleMotionVideoFile(file: File) {
    setMotionVideoError(null)
    const objectUrl = URL.createObjectURL(file)
    const vid = document.createElement("video")
    vid.preload = "metadata"
    vid.onloadedmetadata = () => {
      URL.revokeObjectURL(objectUrl)
      const dur = vid.duration
      if (dur < 3) {
        setMotionVideoError(`Video is too short (${dur.toFixed(1)}s) — minimum 3 seconds`)
      } else if (dur > 30) {
        setMotionVideoError(`Video is too long (${dur.toFixed(1)}s) — maximum 30 seconds`)
      } else {
        onMotionVideoDurationChange(dur)
        onMotionVideoSelect(file)
      }
    }
    vid.onerror = () => { URL.revokeObjectURL(objectUrl); setMotionVideoError("Could not read video file") }
    vid.src = objectUrl
  }

  function handleLipsyncVideoFile(file: File) {
    setLipsyncVideoError(null)
    const objectUrl = URL.createObjectURL(file)
    const vid = document.createElement("video")
    vid.preload = "metadata"
    vid.onloadedmetadata = () => {
      URL.revokeObjectURL(objectUrl)
      const w = vid.videoWidth
      const h = vid.videoHeight
      let detectedRatio: string | undefined
      if (w && h) {
        const r = w / h
        const standards: { label: string; ratio: number }[] = [
          { label: "1:1",  ratio: 1 },
          { label: "16:9", ratio: 16 / 9 },
          { label: "9:16", ratio: 9 / 16 },
          { label: "4:3",  ratio: 4 / 3 },
          { label: "3:4",  ratio: 3 / 4 },
          { label: "3:2",  ratio: 3 / 2 },
          { label: "2:3",  ratio: 2 / 3 },
          { label: "4:5",  ratio: 4 / 5 },
          { label: "5:4",  ratio: 5 / 4 },
          { label: "21:9", ratio: 21 / 9 },
        ]
        let closest = standards[0]
        let minDiff = Math.abs(r - closest.ratio)
        for (const s of standards) {
          const diff = Math.abs(r - s.ratio)
          if (diff < minDiff) { minDiff = diff; closest = s }
        }
        detectedRatio = closest.label
      }
      onLipsyncVideoSelect?.(file, vid.duration, detectedRatio)
    }
    vid.onerror = () => { URL.revokeObjectURL(objectUrl); setLipsyncVideoError("Could not read video file") }
    vid.src = objectUrl
  }

  const motionMaxSec = characterOrientation === "video" ? 30 : 10
  const sd20ResMultiplier = resolution === "1080p" ? 2.25 : resolution === "480p" ? 0.5 : 1.0
  const isSD20Family = model.id === "seedance-2.0" || model.id === "seedance-2.0-fast"
  const isLipsync = !!model.supportsLipsync
  const ticketCost = isLipsync
    ? Math.max(10, Math.ceil((lipsyncVideoDuration ?? 0) * 6))
    : model.id === "kling-v3-motion"
    ? Math.ceil(motionVideoDuration ?? motionMaxSec) * 6
    : model.id === "kling-v3"
    ? parseInt(duration) * (audioEnabled ? 8 : 6)
    : model.id === "seedance-1.5"
    ? Math.ceil(parseInt(duration) * 2.0 * (resolution === "1080p" ? 2.25 : resolution === "480p" ? 0.5 : 1.0) * (audioEnabled ? 1.0 : 0.5)) + 1
    : isSD20Family
    ? Math.ceil(parseInt(duration === "auto" ? "5" : duration) * (model.id === "seedance-2.0-fast" ? 12 : 15) * sd20ResMultiplier)
    : ({ "480p": { "5": 7, "10": 14 }, "720p": { "5": 13, "10": 26 }, "1080p": { "5": 20, "10": 40 } } as any)[resolution]?.[duration] ?? 20

  const btnBase   = "py-1.5 rounded text-[11px] font-mono transition-all border"
  const btnActive = "bg-orange-500/15 text-orange-400 border-orange-500/40"
  const btnIdle   = "bg-white/5 text-slate-400 border-white/8 hover:border-white/15"

  return (
    <div className="p-4 space-y-5">
      {/* Header */}
      <div className="flex items-center gap-2 pb-3 border-b border-white/5">
        <Video size={13} className="text-orange-400 shrink-0" />
        <span className="text-sm font-semibold text-white">{model.name}</span>
        <span className="ml-auto text-[10px] font-mono text-orange-400/70 flex items-center gap-0.5">
          <Ticket size={9} />{ticketCost}{(isSD20Family && duration === "auto") || (isLipsync && !lipsyncVideoDuration) ? "~" : ""}
        </span>
      </div>

      {/* ── Lipsync v3 panel ── */}
      {isLipsync && (
        <>
          {/* Hidden file inputs */}
          <input ref={lipsyncVidRef} type="file" accept="video/*" className="hidden"
            onChange={e => { const f = e.target.files?.[0]; if (f) { e.target.value = ""; handleLipsyncVideoFile(f) }}} />
          <input ref={lipsyncAudRef} type="file" accept="audio/*,audio/mpeg,audio/mp3,audio/wav,audio/aac,audio/ogg,audio/flac,audio/x-m4a,.mp3,.wav,.aac,.ogg,.flac,.m4a,.aiff,.aif" className="hidden"
            onChange={e => { const f = e.target.files?.[0]; if (f) { e.target.value = ""; onLipsyncAudioSelect?.(f) }}} />

          {/* Video upload */}
          <div className="space-y-1.5">
            <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">
              Source Video <span className="text-orange-400/70">*</span>
            </p>
            <p className="text-[10px] text-slate-600 leading-snug">The video whose lips will be synced to the audio</p>
            {lipsyncVideoFilename ? (
              <div className={`relative rounded-lg overflow-hidden flex items-center gap-3 px-3 py-3 border ${lipsyncVideoUploading ? "bg-slate-900/80 border-white/10" : "bg-white/5 border-white/10"}`}>
                <div className="w-8 h-8 rounded bg-orange-500/10 border border-orange-500/20 flex items-center justify-center shrink-0">
                  {lipsyncVideoUploading
                    ? <div className="w-3.5 h-3.5 rounded-full border-2 border-orange-400/30 border-t-orange-400 animate-spin" />
                    : <Check size={13} className="text-green-400" />
                  }
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] text-slate-200 truncate font-medium">{lipsyncVideoFilename}</p>
                  <p className="text-[10px] text-slate-500 mt-0.5">
                    {lipsyncVideoUploading ? "Uploading…" : lipsyncVideoDuration ? `${lipsyncVideoDuration.toFixed(1)}s · Ready` : "Ready"}
                  </p>
                </div>
                <button onClick={() => { onClearLipsyncVideo?.(); setLipsyncVideoError(null) }}
                  className="shrink-0 w-5 h-5 rounded flex items-center justify-center text-slate-500 hover:text-red-400 hover:bg-white/5 transition-all">
                  <X size={12} />
                </button>
              </div>
            ) : (
              <button onClick={() => lipsyncVidRef.current?.click()}
                className={`w-full rounded-lg border border-dashed flex flex-col items-center justify-center gap-1.5 transition-all py-6 ${
                  lipsyncVideoError ? "border-red-500/40 hover:border-red-500/60" : "border-orange-500/30 hover:border-orange-500/50"
                }`}>
                <Video size={16} className={lipsyncVideoError ? "text-red-400/60" : "text-orange-400/60"} />
                <span className="text-[10px] text-slate-500">Click to upload source video</span>
              </button>
            )}
            {lipsyncVideoError && (
              <p className="text-[10px] text-red-400 flex items-center gap-1"><X size={10} className="shrink-0" />{lipsyncVideoError}</p>
            )}
          </div>

          {/* Audio upload */}
          <div className="space-y-1.5">
            <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">
              Audio Track <span className="text-orange-400/70">*</span>
            </p>
            <p className="text-[10px] text-slate-600 leading-snug">The audio to sync the lips to (WAV, MP3, etc.)</p>
            {lipsyncAudioFilename ? (
              <div className={`relative rounded-lg overflow-hidden flex items-center gap-3 px-3 py-3 border ${lipsyncAudioUploading ? "bg-slate-900/80 border-white/10" : "bg-white/5 border-white/10"}`}>
                <div className="w-8 h-8 rounded bg-orange-500/10 border border-orange-500/20 flex items-center justify-center shrink-0">
                  {lipsyncAudioUploading
                    ? <div className="w-3.5 h-3.5 rounded-full border-2 border-orange-400/30 border-t-orange-400 animate-spin" />
                    : <Check size={13} className="text-green-400" />
                  }
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] text-slate-200 truncate font-medium">{lipsyncAudioFilename}</p>
                  <p className="text-[10px] text-slate-500 mt-0.5">{lipsyncAudioUploading ? "Uploading…" : "Ready"}</p>
                </div>
                <button onClick={() => onClearLipsyncAudio?.()}
                  className="shrink-0 w-5 h-5 rounded flex items-center justify-center text-slate-500 hover:text-red-400 hover:bg-white/5 transition-all">
                  <X size={12} />
                </button>
              </div>
            ) : (
              <button onClick={() => lipsyncAudRef.current?.click()}
                className="w-full rounded-lg border border-dashed border-orange-500/30 hover:border-orange-500/50 flex flex-col items-center justify-center gap-1.5 transition-all py-6">
                <Music size={16} className="text-orange-400/60" />
                <span className="text-[10px] text-slate-500">Click to upload audio track</span>
              </button>
            )}
          </div>

          {/* Sync mode */}
          <div className="space-y-1.5">
            <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">Sync Mode</p>
            <p className="text-[10px] text-slate-600 leading-snug">How to handle duration mismatch between video and audio</p>
            <div className="grid grid-cols-3 gap-1">
              {(["cut_off", "loop", "bounce", "silence", "remap"] as const).map(m => (
                <button key={m} onClick={() => onLipsyncSyncModeChange?.(m)}
                  className={`${btnBase} ${lipsyncSyncMode === m ? btnActive : btnIdle} text-[10px]`}>
                  {m === "cut_off" ? "Cut Off" : m === "loop" ? "Loop" : m === "bounce" ? "Bounce" : m === "silence" ? "Silence" : "Remap"}
                </button>
              ))}
            </div>
          </div>

          {/* Ticket estimate note */}
          {lipsyncVideoDuration ? (
            <p className="text-[10px] text-slate-600 leading-snug">
              Cost based on video duration: {lipsyncVideoDuration.toFixed(1)}s × 6 = <span className="text-orange-400/70 font-mono">{Math.max(10, Math.ceil(lipsyncVideoDuration * 6))} tickets</span>
            </p>
          ) : (
            <p className="text-[10px] text-slate-600 leading-snug">
              Min charge: <span className="text-orange-400/70 font-mono">10 tickets</span>. Final cost calculated after video upload.
            </p>
          )}
        </>
      )}

      {/* Reference Image / Start Frame — hidden for r2v models, hidden for lipsync */}
      {!isLipsync && !model.supportsReferenceVideo && (
        <div className="space-y-1.5">
          <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">
            {model.supportsMotionControl ? "Character Image" : model.textToVideo ? "Reference Image" : "Start Frame"}
            {!model.textToVideo && !model.supportsMotionControl && <span className="text-orange-400/70"> *</span>}
            {model.textToVideo && !model.supportsMotionControl && <span className="text-slate-600 normal-case font-normal"> (optional)</span>}
          </p>
          {model.supportsMotionControl && (
            <p className="text-[10px] text-slate-600 leading-snug">The character's appearance and background will be sourced from this image</p>
          )}
          {model.textToVideo && !model.supportsMotionControl && (
            <p className="text-[10px] text-slate-600 leading-snug">Provide a reference image to guide the video, or leave empty for text-only generation</p>
          )}
          <FrameUploadArea
            preview={startFramePreview}
            uploading={startFrameUploading}
            onSelect={onStartFrameSelect}
            onClear={onClearStartFrame}
            label={model.supportsMotionControl ? "Click to upload character image" : model.textToVideo ? "Click to upload reference image (optional)" : "Click to upload start frame"}
            optional={!!model.textToVideo}
            inputRef={startRef}
          />
        </div>
      )}

      {/* Motion Control / SD20 / standard UI — hidden for lipsync */}
      {!isLipsync && model.supportsMotionControl ? (
        <>
          {/* Motion reference video */}
          <div className="space-y-1.5">
            <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">
              Motion Reference Video <span className="text-orange-400/70">*</span>
            </p>
            <p className="text-[10px] text-slate-600 leading-snug">The character's movements in the output will follow this video</p>
            <input ref={endRef} type="file" accept="video/*" className="hidden"
              onChange={e => { const f = e.target.files?.[0]; if (f) { e.target.value = ""; setMotionVideoError(null); handleMotionVideoFile(f) }}} />
            {motionVideoFilename ? (
              <div className={`relative rounded-lg overflow-hidden flex items-center gap-3 px-3 py-3 border ${motionVideoUploading ? "bg-slate-900/80 border-white/10" : "bg-white/5 border-white/10"}`}>
                <div className="w-8 h-8 rounded bg-orange-500/10 border border-orange-500/20 flex items-center justify-center shrink-0">
                  {motionVideoUploading
                    ? <div className="w-3.5 h-3.5 rounded-full border-2 border-orange-400/30 border-t-orange-400 animate-spin" />
                    : <Check size={13} className="text-green-400" />
                  }
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] text-slate-200 truncate font-medium">{motionVideoFilename}</p>
                  <p className="text-[10px] text-slate-500 mt-0.5">{motionVideoUploading ? "Uploading…" : "Ready"}</p>
                </div>
                <button onClick={() => { onClearMotionVideo(); setMotionVideoError(null) }}
                  className="shrink-0 w-5 h-5 rounded flex items-center justify-center text-slate-500 hover:text-red-400 hover:bg-white/5 transition-all">
                  <X size={12} />
                </button>
              </div>
            ) : (
              <button onClick={() => endRef.current.click()}
                className={`w-full rounded-lg border border-dashed flex flex-col items-center justify-center gap-1.5 transition-all py-6 ${
                  motionVideoError ? "border-red-500/40 hover:border-red-500/60" : "border-orange-500/30 hover:border-orange-500/50"
                }`}>
                <Video size={16} className={motionVideoError ? "text-red-400/60" : "text-orange-400/60"} />
                <span className="text-[10px] text-slate-500">Click to upload motion reference video</span>
                <span className="text-[9px] text-slate-600">Must be between 3–30 seconds long</span>
              </button>
            )}
            {motionVideoError && (
              <p className="text-[10px] text-red-400 flex items-center gap-1">
                <X size={10} className="shrink-0" />{motionVideoError}
              </p>
            )}
          </div>

          {/* Background Control */}
          <div className="space-y-1.5">
            <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">Background Control</p>
            <p className="text-[10px] text-slate-600 leading-snug">Choose where you want the background of the video to come from</p>
            <div className="flex gap-1.5">
              <button onClick={() => onCharacterOrientationChange("image")}
                className={`flex-1 ${btnBase} ${characterOrientation === "image" ? btnActive : btnIdle}`}>
                Image
              </button>
              <button onClick={() => onCharacterOrientationChange("video")}
                className={`flex-1 ${btnBase} ${characterOrientation === "video" ? btnActive : btnIdle}`}>
                Video
              </button>
            </div>
            <p className="text-[10px] text-slate-600 leading-snug">
              {characterOrientation === "video"
                ? "Background follows the reference video (max 30s output)"
                : "Background follows the character image (max 10s output)"}
            </p>
          </div>

          {/* Keep Original Sound */}
          <div className="flex items-start justify-between gap-3 py-1">
            <div>
              <p className="text-[12px] text-slate-300 font-medium">Keep Original Sound</p>
              <p className="text-[10px] text-slate-500 mt-0.5 leading-snug">
                Preserve audio from the reference video
              </p>
            </div>
            <button
              onClick={() => onKeepOriginalSoundToggle(!keepOriginalSound)}
              className={`w-9 h-5 rounded-full transition-colors relative shrink-0 mt-0.5 ${keepOriginalSound ? "bg-orange-500" : "bg-slate-700"}`}
            >
              <span className={`block w-3.5 h-3.5 rounded-full bg-white absolute top-[3px] transition-all ${keepOriginalSound ? "right-[3px]" : "left-[3px]"}`} />
            </button>
          </div>
        </>
      ) : model.supportsReferenceVideo ? (
        /* ── SeeDance 2.0 Reference-to-Video ── */
        <SD20RefPanel
          videoRefImagePreviews={videoRefImagePreviews}
          onAddRefImage={onAddRefImage!}
          onRemoveRefImage={onRemoveRefImage!}
          videoRefVideoFilenames={videoRefVideoFilenames}
          videoRefVideoUrls={videoRefVideoUrls}
          onAddRefVideo={onAddRefVideo!}
          onRemoveRefVideo={onRemoveRefVideo!}
          videoRefAudioFilenames={videoRefAudioFilenames}
          onAddRefAudio={onAddRefAudio!}
          onRemoveRefAudio={onRemoveRefAudio!}
        />
      ) : (
        <>
          {/* End frame */}
          {model.supportsEndFrame && (
            <div className="space-y-1.5">
              <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">
                End Frame <span className="text-slate-600 normal-case font-normal">(optional)</span>
              </p>
              <FrameUploadArea
                preview={endFramePreview}
                uploading={endFrameUploading}
                onSelect={onEndFrameSelect}
                onClear={onClearEndFrame}
                label="Click to upload end frame"
                optional
                inputRef={endRef}
              />
            </div>
          )}

          {/* Duration */}
          {model.durations.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">Duration</p>
              {model.durations.length > 4 ? (
                <div className="grid grid-cols-5 gap-1">
                  {model.durations.map(d => (
                    <button key={d} onClick={() => onDurationChange(d)}
                      className={`${btnBase} ${duration === d ? btnActive : btnIdle}`}>{d === "auto" ? "auto" : `${d}s`}</button>
                  ))}
                </div>
              ) : (
                <div className="flex gap-1.5">
                  {model.durations.map(d => (
                    <button key={d} onClick={() => onDurationChange(d)}
                      className={`flex-1 ${btnBase} ${duration === d ? btnActive : btnIdle}`}>{d === "auto" ? "auto" : `${d}s`}</button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Aspect ratio — Kling 3.0 / SeeDance */}
          {model.aspectRatios && (
            <div className="space-y-1.5">
              <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">Aspect Ratio</p>
              {model.startFrameLocksAspect && startFramePreview ? (
                <div className="px-3 py-2 rounded-lg bg-white/4 border border-white/8 text-[11px] text-slate-400 italic">
                  Matches start frame
                </div>
              ) : model.aspectRatios.length > 4 ? (
                <div className="grid grid-cols-4 gap-1">
                  {model.aspectRatios.map(r => (
                    <button key={r} onClick={() => onAspectRatioChange(r)}
                      className={`${btnBase} ${aspectRatio === r ? btnActive : btnIdle}`}>{r}</button>
                  ))}
                </div>
              ) : (
                <div className="flex gap-1.5">
                  {model.aspectRatios.map(r => (
                    <button key={r} onClick={() => onAspectRatioChange(r)}
                      className={`flex-1 ${btnBase} ${aspectRatio === r ? btnActive : btnIdle}`}>{r}</button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Resolution — Wan 2.5 only */}
          {model.resolutions && (
            <div className="space-y-1.5">
              <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">Resolution</p>
              <div className="flex gap-1.5">
                {model.resolutions.map(r => (
                  <button key={r} onClick={() => onResolutionChange(r)}
                    className={`flex-1 ${btnBase} ${resolution === r ? btnActive : btnIdle}`}>{r}</button>
                ))}
              </div>
            </div>
          )}

          {/* Audio toggle — Kling 3.0 / SeeDance */}
          {model.audioType === "toggle" && (
            <div className="flex items-start justify-between gap-3 py-1">
              <div>
                <p className="text-[12px] text-slate-300 font-medium">Generate Audio</p>
                <p className="text-[10px] text-slate-500 mt-0.5 leading-snug">
                  AI-generated ambient audio based on video context
                </p>
              </div>
              <button
                onClick={() => onAudioToggle(!audioEnabled)}
                className={`w-9 h-5 rounded-full transition-colors relative shrink-0 mt-0.5 ${audioEnabled ? "bg-orange-500" : "bg-slate-700"}`}
              >
                <span className={`block w-3.5 h-3.5 rounded-full bg-white absolute top-[3px] transition-all ${audioEnabled ? "right-[3px]" : "left-[3px]"}`} />
              </button>
            </div>
          )}

          {/* Audio upload — Wan 2.5 */}
          {model.audioType === "upload" && (
            <div className="space-y-1.5">
              <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">
                Background Audio <span className="text-slate-600 normal-case font-normal">(optional)</span>
              </p>
              <input
                ref={audioRef}
                type="file"
                accept="audio/wav,audio/mp3,audio/mpeg"
                className="hidden"
                onChange={e => { const f = e.target.files?.[0]; if (f) { e.target.value = ""; onAudioFileChange(f) } }}
              />
              <button
                onClick={() => audioRef.current?.click()}
                className="w-full py-2.5 rounded-lg border border-dashed border-white/10 hover:border-white/20 text-[11px] text-slate-500 hover:text-slate-300 flex items-center justify-center gap-2 transition-all"
              >
                {audioUploading ? (
                  <><div className="w-3 h-3 rounded-full border-2 border-orange-400/30 border-t-orange-400 animate-spin" />Uploading...</>
                ) : audioFile ? (
                  <><Check size={11} className="text-green-400" />{audioFile.name.length > 24 ? audioFile.name.slice(0, 22) + "…" : audioFile.name}</>
                ) : (
                  <>+ Upload WAV / MP3 (3–30s)</>
                )}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  )
}

function VideoFeed({
  pendingSlots,
  items,
  savedFails,
  onVideoClick,
  onPendingClick,
  selectMode,
  selectedIds,
  onSelectToggle,
}: {
  pendingSlots: VideoPendingSlot[]
  items: VideoItem[]
  savedFails: VideoItem[]
  onVideoClick: (data: VideoDetailData) => void
  onPendingClick?: (slot: VideoPendingSlot) => void
  selectMode?: boolean
  selectedIds?: Set<number>
  onSelectToggle?: (id: number) => void
}) {
  // Pull the same historical feed as the image scanner — with infinite scroll
  const [dbImages, setDbImages] = useState<ImageItem[]>([])
  const [dbLoading, setDbLoading] = useState(false)
  const videoSentinelRef = useRef<HTMLDivElement>(null)
  const videoLoadingRef = useRef(false)
  const videoPageRef = useRef(1)
  const videoHasMoreRef = useRef(true)
  const videoPagLimitRef = useRef(typeof window !== "undefined" && window.innerWidth < 640 ? 8 : 24)

  const loadNextVideos = useCallback(async () => {
    if (videoLoadingRef.current || !videoHasMoreRef.current) return
    videoLoadingRef.current = true
    setDbLoading(true)
    try {
      const res = await fetch(`/api/my-images?page=${videoPageRef.current}&limit=${videoPagLimitRef.current}&type=video`)
      if (!res.ok) return
      const data = await res.json()
      if (!data.images) return
      setDbImages(prev => {
        const existingIds = new Set(prev.map(i => i.id))
        const newItems = (data.images as any[]).filter(img => !existingIds.has(img.id))
        return [...prev, ...newItems]
      })
      videoHasMoreRef.current = videoPageRef.current < (data.pagination?.totalPages ?? 1)
      videoPageRef.current += 1
    } finally {
      videoLoadingRef.current = false
      setDbLoading(false)
    }
  }, [])

  useEffect(() => { loadNextVideos() }, [loadNextVideos])
  useEffect(() => { if (!dbLoading) {
    if (!videoSentinelRef.current || !videoHasMoreRef.current) return
    const rect = videoSentinelRef.current.getBoundingClientRect()
    if (rect.top < window.innerHeight + 1200) loadNextVideos()
  } }, [dbLoading, loadNextVideos])

  useEffect(() => {
    const sentinel = videoSentinelRef.current
    if (!sentinel) return
    const observer = new IntersectionObserver(
      (entries) => { if (entries[0].isIntersecting) loadNextVideos() },
      { rootMargin: "1200px" }
    )
    observer.observe(sentinel)
    return () => observer.disconnect()
  }, [loadNextVideos])

  // IDs already shown as session items — skip them in the DB section.
  // Session VideoItem.id is a FAL request ID string, which never matches a numeric
  // DB id. Use dbId (set when the video completes) for correct dedup.
  const sessionDbIds = new Set(items.map(i => i.dbId).filter((id): id is number => id !== undefined))

  const isVideoUrl = (url: string) =>
    /\.(mp4|webm|mov|m4v)(\?|$)/i.test(url) ||
    url.includes("video") ||
    url.includes("fal.media/files/video")

  // Convert "16:9" → "16/9" for CSS aspect-ratio; falls back to "16/9"
  const toAspectRatioCss = (ar?: string) => {
    if (!ar || ar === "auto") return "16/9"
    return ar.replace(":", "/")
  }

  // Append #t=0.001 so iOS Safari decodes the first frame instead of showing black
  const iosSrc = (url: string) => (url.includes("#") ? url : `${url}#t=0.001`)

  const hasContent = pendingSlots.length > 0 || items.length > 0 || dbImages.length > 0 || savedFails.length > 0 || dbLoading || videoHasMoreRef.current

  if (!hasContent) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3 text-slate-700">
        <Video size={28} strokeWidth={1.5} />
        <p className="text-sm">Generated videos will appear here</p>
      </div>
    )
  }

  return (
    <div className="p-3 grid grid-cols-2 sm:grid-cols-3 gap-2 auto-rows-max">
      {/* Loading / queued slots */}
      {pendingSlots.map(slot => (
        <button
          key={slot.slotId}
          onClick={onPendingClick ? () => onPendingClick(slot) : undefined}
          className={`rounded-lg border flex flex-col items-center justify-center gap-2 p-4 w-full transition-colors ${slot.queueJobId && !slot.requestId ? "bg-slate-900 border-amber-500/20 hover:border-amber-500/40" : "bg-slate-900 border-white/5 hover:border-white/10"}`}
          style={{ aspectRatio: "16/9" }}
        >
          <div className={`w-5 h-5 rounded-full border-2 animate-spin ${slot.queueJobId && !slot.requestId ? "border-amber-500/30 border-t-amber-400" : "border-orange-400/30 border-t-orange-400"}`} />
          {slot.queueJobId && !slot.requestId && <p className="text-[9px] text-amber-400/60 font-mono tracking-wide">QUEUED</p>}
          <p className="text-[10px] text-slate-500 text-center line-clamp-2 italic">"{slot.prompt}"</p>
          <p className="text-[9px] text-orange-400/50 font-mono">{slot.model}</p>
        </button>
      ))}

      {/* Session items (new this session) */}
      {items.map(item =>
        item.failed ? (
          <div
            key={item.id}
            className="rounded-lg bg-slate-900 border border-red-500/20 flex flex-col items-center justify-center gap-2 p-4 cursor-pointer hover:border-red-500/40 transition-colors"
            style={{ aspectRatio: "16/9" }}
            onClick={() => onVideoClick({ videoUrl: "", prompt: item.prompt, model: item.model, duration: item.duration, createdAt: item.createdAt, failed: true, failError: item.failError })}
          >
            <div className="w-5 h-5 rounded-full border-2 border-red-500/60 flex items-center justify-center shrink-0">
              <X size={10} className="text-red-400" />
            </div>
            <p className="text-[10px] text-red-400/80 text-center line-clamp-2">{item.failError}</p>
            <p className="text-[9px] text-slate-600 italic line-clamp-1">"{item.prompt}"</p>
          </div>
        ) : (
          <div
            key={item.id}
            className={`rounded-lg bg-black overflow-hidden relative group cursor-pointer transition-colors ${
              selectMode && selectedIds?.has(parseInt(item.id))
                ? "border-2 border-cyan-400 ring-2 ring-cyan-400 ring-inset"
                : "border border-white/5 hover:border-orange-500/30"
            }`}
            style={{ aspectRatio: "16/9" }}
            onClick={() => selectMode ? onSelectToggle?.(parseInt(item.id)) : onVideoClick({ id: item.dbId, videoUrl: item.videoUrl, prompt: item.prompt, model: item.model, duration: item.duration, resolution: item.resolution, aspectRatio: item.aspectRatio, audioEnabled: item.audioEnabled, startFrameUrl: item.startFrameUrl, endFrameUrl: item.endFrameUrl, motionVideoUrl: item.motionVideoUrl, keepOriginalSound: item.keepOriginalSound, characterOrientation: item.characterOrientation, createdAt: item.createdAt })}
          >
            <video src={iosSrc(item.videoUrl)} className={`w-full h-full pointer-events-none ${item.aspectRatio === "16:9" ? "object-cover" : "object-contain"}`} playsInline preload="metadata" muted />
            {/* Select mode checkmark */}
            {selectMode && (
              <div className={`absolute top-1.5 left-1.5 w-4 h-4 rounded-full border-2 flex items-center justify-center z-10 transition-all ${
                selectedIds?.has(parseInt(item.id)) ? "bg-cyan-400 border-cyan-400" : "border-white/60 bg-black/40"
              }`}>
                {selectedIds?.has(parseInt(item.id)) && <Check size={9} className="text-black" />}
              </div>
            )}
            {/* Play overlay (hidden in select mode) */}
            {!selectMode && (
              <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/20">
                <div className="w-10 h-10 rounded-full bg-black/60 flex items-center justify-center border border-white/20">
                  <svg className="w-4 h-4 text-white ml-0.5" fill="currentColor" viewBox="0 0 24 24"><polygon points="5 3 19 12 5 21 5 3" /></svg>
                </div>
              </div>
            )}
            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent px-2 py-1.5 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
              <p className="text-[10px] text-white/80 line-clamp-1">"{item.prompt}"</p>
              <p className="text-[9px] text-orange-400/70 font-mono mt-0.5">{item.model} · {item.duration}s</p>
            </div>
          </div>
        )
      )}

      {/* Historical feed from DB — same as image scanner */}
      {dbImages
        .filter(img => !sessionDbIds.has(img.id))
        .map(img => (
          isVideoUrl(img.imageUrl) ? (
            <div
              key={img.id}
              className={`rounded-lg bg-black overflow-hidden relative group cursor-pointer transition-colors ${
                selectMode && selectedIds?.has(img.id)
                  ? "border-2 border-cyan-400 ring-2 ring-cyan-400 ring-inset"
                  : "border border-white/5 hover:border-orange-500/30"
              }`}
              style={{ aspectRatio: "16/9" }}
              onClick={() => {
                if (selectMode) { onSelectToggle?.(img.id); return }
                const vm = img.videoMetadata || {}
                onVideoClick({ id: img.id, videoUrl: img.imageUrl, prompt: img.prompt, model: img.model, duration: vm.duration, resolution: vm.resolution || img.quality || undefined, aspectRatio: vm.aspectRatio || img.aspectRatio, audioEnabled: vm.audioEnabled, startFrameUrl: vm.startFrameUrl || undefined, endFrameUrl: vm.endFrameUrl || undefined, motionVideoUrl: vm.motionVideoUrl || undefined, keepOriginalSound: vm.keepOriginalSound, characterOrientation: vm.characterOrientation || undefined, createdAt: img.createdAt })
              }}
            >
              <video src={iosSrc(img.imageUrl)} className={`w-full h-full pointer-events-none ${(img.videoMetadata?.aspectRatio || img.aspectRatio) === "16:9" ? "object-cover" : "object-contain"}`} playsInline preload="metadata" muted />
              {selectMode && (
                <div className={`absolute top-1.5 left-1.5 w-4 h-4 rounded-full border-2 flex items-center justify-center z-10 transition-all ${
                  selectedIds?.has(img.id) ? "bg-cyan-400 border-cyan-400" : "border-white/60 bg-black/40"
                }`}>
                  {selectedIds?.has(img.id) && <Check size={9} className="text-black" />}
                </div>
              )}
              {!selectMode && (
                <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/20">
                  <div className="w-10 h-10 rounded-full bg-black/60 flex items-center justify-center border border-white/20">
                    <svg className="w-4 h-4 text-white ml-0.5" fill="currentColor" viewBox="0 0 24 24"><polygon points="5 3 19 12 5 21 5 3" /></svg>
                  </div>
                </div>
              )}
              <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent px-2 py-1.5 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                <p className="text-[10px] text-white/80 line-clamp-1">"{img.prompt}"</p>
                <p className="text-[9px] text-orange-400/70 font-mono mt-0.5">{img.model}</p>
              </div>
            </div>
          ) : (
            <div
              key={img.id}
              className="rounded-lg bg-black border border-white/5 overflow-hidden relative group cursor-pointer hover:border-white/15 transition-colors"
              style={{ aspectRatio: "16/9" }}
              onClick={() => { const vm = img.videoMetadata || {}; onVideoClick({ videoUrl: img.imageUrl, prompt: img.prompt, model: img.model, duration: vm.duration, resolution: vm.resolution || img.quality || undefined, aspectRatio: vm.aspectRatio || img.aspectRatio, audioEnabled: vm.audioEnabled, startFrameUrl: vm.startFrameUrl || undefined, endFrameUrl: vm.endFrameUrl || undefined, motionVideoUrl: vm.motionVideoUrl || undefined, keepOriginalSound: vm.keepOriginalSound, characterOrientation: vm.characterOrientation || undefined, createdAt: img.createdAt }) }}
            >
              <img src={img.imageUrl} alt={img.prompt} className="w-full h-full object-cover" />
              <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent px-2 py-1.5 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                <p className="text-[10px] text-white/80 line-clamp-1">"{img.prompt}"</p>
                <p className="text-[9px] text-slate-400/70 font-mono mt-0.5">{img.model}</p>
              </div>
            </div>
          )
        ))
      }

      {/* Persisted failed tiles from previous sessions — deduped against live session items */}
      {(() => {
        const liveFailIds = new Set(items.filter(i => i.failed).map(i => i.id))
        return savedFails
          .filter(f => !liveFailIds.has(f.id))
          .map(item => (
            <div
              key={`sf-${item.id}`}
              className="rounded-lg bg-slate-900 border border-red-500/20 flex flex-col items-center justify-center gap-2 p-4 cursor-pointer hover:border-red-500/40 transition-colors"
              style={{ aspectRatio: "16/9" }}
              onClick={() => onVideoClick({ videoUrl: "", prompt: item.prompt, model: item.model, duration: item.duration, createdAt: item.createdAt, failed: true, failError: item.failError })}
            >
              <div className="w-5 h-5 rounded-full border-2 border-red-500/60 flex items-center justify-center shrink-0">
                <X size={10} className="text-red-400" />
              </div>
              <p className="text-[10px] text-red-400/80 text-center line-clamp-2">{item.failError}</p>
              <p className="text-[9px] text-slate-600 italic line-clamp-1">"{item.prompt}"</p>
            </div>
          ))
      })()}

      {/* Infinite scroll sentinel — triggers next page load when scrolled into view */}
      <div ref={videoSentinelRef} className="col-span-full h-1" />
      {dbLoading && (
        <div className="col-span-full flex justify-center py-4">
          <div className="w-5 h-5 rounded-full border-2 border-orange-400/30 border-t-orange-400 animate-spin" />
        </div>
      )}
    </div>
  )
}

function VideoPromptBar({
  model, onGenerate, generating, canGenerate, queueFull, duration, resolution, aspectRatio, audioEnabled,
  onModelChange, promptOverride, characterOrientation, motionVideoDuration, onConfigOpen,
  startFramePreview, startFrameUploading, onStartFrameSelect,
  motionVideoFilename, motionVideoUploading, onMotionVideoSelect, onMotionVideoDurationChange,
  motionPromptText, lipsyncVideoDuration,
}: {
  model: VideoModelConfig
  onGenerate: (prompt: string) => void
  generating: boolean
  canGenerate: boolean
  queueFull: boolean
  duration: string
  resolution: string
  aspectRatio: string
  audioEnabled: boolean
  onModelChange: (m: VideoModelConfig) => void
  promptOverride?: { text: string; version: number }
  characterOrientation: string
  motionVideoDuration: number | null
  onConfigOpen: () => void
  // Motion Control upload slots (mobile only)
  startFramePreview: string | null
  startFrameUploading: boolean
  onStartFrameSelect: (f: File) => void
  motionVideoFilename: string | null
  motionVideoUploading: boolean
  onMotionVideoSelect: (f: File) => void
  onMotionVideoDurationChange: (d: number) => void
  motionPromptText: string
  lipsyncVideoDuration?: number
}) {
  const [prompt, setPrompt] = useState("")
  const [modelOpen, setModelOpen] = useState(false)
  const startFrameInputRef = useRef<HTMLInputElement>(null)
  const motionVideoInputRef = useRef<HTMLInputElement>(null)

  const modelRef = useRef<HTMLDivElement>(null)
  const overrideVersion = promptOverride?.version ?? 0
  useEffect(() => {
    if (overrideVersion > 0 && promptOverride?.text) setPrompt(promptOverride.text)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [overrideVersion])

  useEffect(() => {
    if (!modelOpen) return
    const handler = (e: MouseEvent) => {
      if (modelRef.current && !modelRef.current.contains(e.target as Node)) setModelOpen(false)
    }
    document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [modelOpen])

  const motionMaxSec = characterOrientation === "video" ? 30 : 10
  const isSD20FamilyBar = model.id === "seedance-2.0" || model.id === "seedance-2.0-fast"
  const isLipsyncModel = !!model.supportsLipsync
  const ticketCost = isLipsyncModel
    ? Math.max(10, Math.ceil((lipsyncVideoDuration ?? 0) * 6))
    : model.id === "kling-v3-motion"
    ? Math.ceil(motionVideoDuration ?? motionMaxSec) * 6
    : model.id === "kling-v3"
    ? parseInt(duration) * (audioEnabled ? 8 : 6)
    : model.id === "seedance-1.5"
    ? Math.ceil(parseInt(duration) * 2.0 * (resolution === "1080p" ? 2.25 : resolution === "480p" ? 0.5 : 1.0) * (audioEnabled ? 1.0 : 0.5)) + 1
    : isSD20FamilyBar
    ? Math.ceil(parseInt(duration === "auto" ? "5" : duration) * (model.id === "seedance-2.0-fast" ? 12 : 15) * (resolution === "1080p" ? 2.25 : resolution === "480p" ? 0.5 : 1.0))
    : ({ "480p": { "5": 7, "10": 14 }, "720p": { "5": 13, "10": 26 }, "1080p": { "5": 20, "10": 40 } } as any)[resolution]?.[duration] ?? 20

  const metaLine = isLipsyncModel
    ? lipsyncVideoDuration ? `${lipsyncVideoDuration.toFixed(1)}s · 6/sec` : "upload video + audio"
    : model.id === "kling-v3-motion"
    ? motionVideoDuration ? `${motionVideoDuration.toFixed(1)}s · 6/sec` : `≤${motionMaxSec}s · 6/sec`
    : model.id === "kling-v3"
    ? `${duration}s${startFramePreview ? "" : ` · ${aspectRatio}`}${audioEnabled ? " · audio" : ""}`
    : model.id === "seedance-1.5"
    ? `${resolution} · ${duration}s · ${aspectRatio}${audioEnabled ? " · audio" : ""}`
    : isSD20FamilyBar
    ? `${resolution} · ${duration === "auto" ? "auto" : duration + "s"}${audioEnabled ? " · audio" : ""}`
    : `${resolution} · ${duration}s`

  const ready = (model.id === "kling-v3-motion" || isLipsyncModel) ? canGenerate : canGenerate && !!prompt.trim()
  const promptPlaceholder = model.id === "kling-v3-motion"
    ? "Describe additional details (optional)..."
    : isLipsyncModel
    ? "No prompt needed — just upload video and audio above"
    : model.textToVideo
    ? "Describe the scene (required)..."
    : "Describe the motion..."

  return (
    <div className="fixed bottom-0 left-0 sm:left-72 right-0 z-30 border-t border-white/5 bg-[#050810]/95 backdrop-blur-md">

      {/* ── Mobile layout (< sm) ───────────────────────────────────────────── */}
      <div className="flex flex-col gap-2 px-3 py-2.5 sm:hidden">

        {model.id === "kling-v3-motion" ? (
          /* ── Motion Control: upload slots replace the prompt row ── */
          <>
            {/* Hidden file inputs */}
            <input
              ref={startFrameInputRef}
              type="file" accept="image/*" className="hidden"
              onChange={e => { const f = e.target.files?.[0]; if (f) { e.target.value = ""; onStartFrameSelect(f) } }}
            />
            <input
              ref={motionVideoInputRef}
              type="file" accept="video/*" className="hidden"
              onChange={e => {
                const f = e.target.files?.[0]
                if (!f) return
                e.target.value = ""
                // Read actual duration before uploading so ticket cost is correct
                const objUrl = URL.createObjectURL(f)
                const vid = document.createElement("video")
                vid.preload = "metadata"
                vid.onloadedmetadata = () => {
                  URL.revokeObjectURL(objUrl)
                  onMotionVideoDurationChange(vid.duration)
                  onMotionVideoSelect(f)
                }
                vid.onerror = () => { URL.revokeObjectURL(objUrl); onMotionVideoSelect(f) }
                vid.src = objUrl
              }}
            />

            {/* Row 1: Side-by-side upload slots */}
            <div className="flex gap-2">
              {/* Reference image slot */}
              <button
                onClick={() => startFrameInputRef.current?.click()}
                className={`flex-1 flex items-center gap-2 px-3 py-2.5 rounded-xl border transition-all text-xs font-medium ${
                  startFramePreview
                    ? "border-green-500/40 bg-green-500/8 text-green-400"
                    : "border-dashed border-white/15 bg-white/3 text-slate-500 hover:border-white/30 hover:text-slate-300"
                }`}
              >
                {startFrameUploading ? (
                  <><div className="w-3 h-3 rounded-full border-2 border-orange-400/30 border-t-orange-400 animate-spin shrink-0" /><span className="truncate">Uploading…</span></>
                ) : startFramePreview ? (
                  <><Check size={12} className="shrink-0" /><span className="truncate">Image ready</span></>
                ) : (
                  <><Image size={12} className="shrink-0" /><span className="truncate">Reference Image</span></>
                )}
              </button>

              {/* Motion video slot */}
              <button
                onClick={() => motionVideoInputRef.current?.click()}
                className={`flex-1 flex items-center gap-2 px-3 py-2.5 rounded-xl border transition-all text-xs font-medium ${
                  motionVideoFilename
                    ? "border-orange-500/40 bg-orange-500/8 text-orange-400"
                    : "border-dashed border-white/15 bg-white/3 text-slate-500 hover:border-white/30 hover:text-slate-300"
                }`}
              >
                {motionVideoUploading ? (
                  <><div className="w-3 h-3 rounded-full border-2 border-orange-400/30 border-t-orange-400 animate-spin shrink-0" /><span className="truncate">Uploading…</span></>
                ) : motionVideoFilename ? (
                  <><Check size={12} className="shrink-0" /><span className="truncate">Video ready</span></>
                ) : (
                  <><Video size={12} className="shrink-0" /><span className="truncate">Motion Video</span></>
                )}
              </button>
            </div>

            {/* Row 2: Config (with prompt inside) + meta + Generate */}
            <div className="flex items-center gap-2">
              <button
                onClick={onConfigOpen}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-semibold shrink-0 transition-all ${
                  motionPromptText
                    ? "border-orange-500/30 bg-orange-500/10 text-orange-300"
                    : "border-white/10 bg-white/5 text-slate-300 hover:bg-white/8"
                }`}
              >
                <SlidersHorizontal size={13} className="text-orange-400" />
                {motionPromptText ? "Config ✦" : "Config"}
              </button>
              <span className="flex-1 text-[10px] text-center font-mono truncate">
                {queueFull
                  ? <span className="text-red-400/80">Queue full</span>
                  : <span className="text-slate-500">{metaLine}</span>
                }
              </span>
              <button
                onClick={() => ready && onGenerate(motionPromptText)}
                disabled={!ready}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold shrink-0 transition-all ${
                  ready
                    ? "bg-gradient-to-r from-orange-500 to-rose-500 text-white hover:opacity-90"
                    : "bg-white/5 text-slate-600 cursor-not-allowed border border-white/10"
                }`}
              >
                {generating
                  ? <div className="w-3 h-3 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                  : <><Ticket size={11} />{ticketCost}</>
                }
                Generate
              </button>
            </div>
          </>
        ) : (
          /* ── All other models: standard prompt row ── */
          <>
            {/* Row 1: Prompt — full width */}
            <textarea
              value={prompt}
              onChange={e => setPrompt(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey && ready) { e.preventDefault(); onGenerate(prompt) } }}
              placeholder={promptPlaceholder}
              rows={2}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white placeholder-slate-600 resize-none focus:outline-none focus:border-orange-500/40 transition-all"
            />
            {/* Row 2: Configure + meta + Generate */}
            <div className="flex items-center gap-2">
              <button
                onClick={onConfigOpen}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/5 border border-white/10 hover:bg-white/8 text-slate-300 text-xs font-semibold shrink-0 transition-all"
              >
                <SlidersHorizontal size={13} className="text-orange-400" />
                Config
              </button>
              <span className="flex-1 text-[10px] text-center font-mono truncate">
                {queueFull
                  ? <span className="text-red-400/80">Queue full</span>
                  : <span className="text-slate-500">{metaLine}</span>
                }
              </span>
              <button
                onClick={() => ready && onGenerate(prompt)}
                disabled={!ready}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold shrink-0 transition-all ${
                  ready
                    ? "bg-gradient-to-r from-orange-500 to-rose-500 text-white hover:opacity-90"
                    : "bg-white/5 text-slate-600 cursor-not-allowed border border-white/10"
                }`}
              >
                {generating
                  ? <div className="w-3 h-3 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                  : <><Ticket size={11} />{ticketCost}</>
                }
                Generate
              </button>
            </div>
          </>
        )}
      </div>

      {/* ── Desktop layout (≥ sm) ─────────────────────────────────────────── */}
      <div className="hidden sm:flex gap-2 items-end px-4 py-3">

        {/* Model switcher */}
        <div className="relative shrink-0" ref={modelRef}>
          <button
            onClick={() => setModelOpen(v => !v)}
            className="flex items-center gap-1.5 h-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 hover:border-white/20 transition-all text-[11px] text-slate-300 font-medium whitespace-nowrap"
          >
            <Video size={11} className="text-orange-400 shrink-0" />
            {model.name}
            <ChevronDown size={10} className={`text-slate-500 transition-transform ${modelOpen ? "rotate-180" : ""}`} />
          </button>
          {modelOpen && (
            <div className="absolute bottom-full mb-1.5 left-0 bg-slate-900 border border-white/10 rounded-xl shadow-xl overflow-hidden min-w-[180px]">
              {VIDEO_MODEL_CONFIGS.map(m => (
                <button
                  key={m.id}
                  onClick={() => { onModelChange(m); setModelOpen(false) }}
                  className={`w-full text-left px-3 py-2 text-[12px] flex items-center gap-2 transition-colors ${
                    m.id === model.id
                      ? "bg-orange-500/15 text-orange-400"
                      : "text-slate-300 hover:bg-white/5"
                  }`}
                >
                  {m.id === model.id && <span className="w-1 h-1 rounded-full bg-orange-400 shrink-0" />}
                  <span className="flex-1">{m.name}</span>
                  {VIDEO_MODEL_COST[m.id] && <CostBadge tier={VIDEO_MODEL_COST[m.id]} />}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Prompt textarea */}
        <textarea
          value={prompt}
          onChange={e => setPrompt(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey && ready) { e.preventDefault(); onGenerate(prompt) } }}
          placeholder={promptPlaceholder}
          rows={2}
          className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-600 resize-none focus:outline-none focus:border-orange-500/30 transition-all"
        />

        {/* Generate button + meta */}
        <div className="flex flex-col items-end gap-1.5 shrink-0">
          {queueFull
            ? <span className="text-[10px] text-red-400/80 font-mono">Queue full</span>
            : <span className="text-[10px] text-slate-500 font-mono">{metaLine}</span>
          }
          <button
            onClick={() => ready && onGenerate(prompt)}
            disabled={!ready}
            className={`flex items-center gap-2 px-5 py-2 rounded-lg text-[12px] font-semibold transition-all ${
              ready
                ? "bg-gradient-to-r from-orange-500 to-rose-500 text-white hover:opacity-90"
                : "bg-white/5 text-slate-600 cursor-not-allowed border border-white/10"
            }`}
          >
            {generating
              ? <div className="w-3 h-3 rounded-full border-2 border-white/30 border-t-white animate-spin" />
              : <><Ticket size={11} />{ticketCost}</>
            }
            Generate
          </button>
        </div>
      </div>
    </div>
  )
}

// --- NEWS DROPDOWN ---
const NEWS_TYPE_CONFIG = {
  info:     { text: "text-cyan-400",    dot: "bg-cyan-400",    bg: "bg-cyan-500/10",    border: "border-cyan-500/30",    icon: Info         },
  warning:  { text: "text-amber-400",   dot: "bg-amber-400",   bg: "bg-amber-500/10",   border: "border-amber-500/30",   icon: AlertTriangle },
  success:  { text: "text-emerald-400", dot: "bg-emerald-400", bg: "bg-emerald-500/10", border: "border-emerald-500/30", icon: CheckCircle   },
  update:   { text: "text-fuchsia-400", dot: "bg-fuchsia-400", bg: "bg-fuchsia-500/10", border: "border-fuchsia-500/30", icon: Sparkles      },
  tutorial: { text: "text-violet-400",  dot: "bg-violet-400",  bg: "bg-violet-500/10",  border: "border-violet-500/30",  icon: BookOpen      },
} as const

interface PortalNotification {
  id: number
  message: string
  type: string
  locked: boolean
  createdAt: string
}

interface NewsArticlePreview {
  id: number
  title: string
  slug: string
  type: string
  summary: string
  previewImage: string | null
  createdAt: string
  publishedAt: string | null
}

// Parses [link text](url) syntax into clickable links
function parseNotifMessage(message: string) {
  const parts = message.split(/(\[[^\]]+\]\([^)]+\))/g)
  return parts.map((part, i) => {
    const match = part.match(/^\[([^\]]+)\]\(([^)]+)\)$/)
    if (match) {
      return (
        <a key={i} href={match[2]} target="_blank" rel="noopener noreferrer"
          className="underline font-bold hover:opacity-80 transition-opacity">
          {match[1]}
        </a>
      )
    }
    return <span key={i}>{part}</span>
  })
}

function NewsDropdown({ open, onToggle }: { open: boolean; onToggle: () => void }) {
  const ref = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const [menuPos, setMenuPos] = useState({ top: 0, left: 0 })
  const [notifications, setNotifications] = useState<PortalNotification[]>([])
  const [articles, setArticles] = useState<NewsArticlePreview[]>([])
  const [dismissed, setDismissed] = useState<number[]>([])
  const [dismissedArticles, setDismissedArticles] = useState<number[]>([])

  // Load dismissed IDs from localStorage
  useEffect(() => {
    const stored = JSON.parse(localStorage.getItem("dismissed-portal-news") || "[]")
    setDismissed(stored)
    const storedArticles = JSON.parse(localStorage.getItem("dismissed-portal-articles") || "[]")
    setDismissedArticles(storedArticles)
  }, [])

  // Fetch portal notifications
  const fetchNews = useCallback(async () => {
    try {
      const [notifRes, articleRes] = await Promise.all([
        fetch("/api/notifications?target=portal"),
        fetch("/api/news"),
      ])
      if (notifRes.ok) setNotifications(await notifRes.json())
      if (articleRes.ok) setArticles(await articleRes.json())
    } catch {}
  }, [])

  useEffect(() => {
    fetchNews()
    const interval = setInterval(fetchNews, 60000)
    return () => clearInterval(interval)
  }, [fetchNews])

  // Close on outside click
  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onToggle()
    }
    document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [open, onToggle])

  // Position the dropdown below the button
  useEffect(() => {
    if (open && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect()
      setMenuPos({ top: rect.bottom + 8, left: Math.min(rect.left, window.innerWidth - 320) })
    }
  }, [open])

  const handleDismiss = (id: number) => {
    const next = [...dismissed, id]
    setDismissed(next)
    localStorage.setItem("dismissed-portal-news", JSON.stringify(next))
  }

  const handleDismissArticle = (id: number) => {
    const next = [...dismissedArticles, id]
    setDismissedArticles(next)
    localStorage.setItem("dismissed-portal-articles", JSON.stringify(next))
  }

  const handleDismissAll = () => {
    const dismissibleIds = visibleNotifs.filter(n => !n.locked).map(n => n.id)
    const nextNotifs = [...dismissed, ...dismissibleIds]
    setDismissed(nextNotifs)
    localStorage.setItem("dismissed-portal-news", JSON.stringify(nextNotifs))

    const nextArticles = [...dismissedArticles, ...visibleArticles.map(a => a.id)]
    setDismissedArticles(nextArticles)
    localStorage.setItem("dismissed-portal-articles", JSON.stringify(nextArticles))
  }

  const visibleNotifs = notifications.filter(n => !dismissed.includes(n.id))
  const visibleArticles = articles.filter(a => !dismissedArticles.includes(a.id))
  const unreadCount = visibleNotifs.length + visibleArticles.length

  function relativeTime(dateStr: string) {
    const diff = Date.now() - new Date(dateStr).getTime()
    const mins = Math.floor(diff / 60000)
    const hours = Math.floor(diff / 3600000)
    const days = Math.floor(diff / 86400000)
    if (mins < 1) return "just now"
    if (mins < 60) return `${mins}m ago`
    if (hours < 24) return `${hours}h ago`
    return `${days}d ago`
  }

  return (
    <div className="relative flex-none min-w-[90px] sm:flex-1" ref={ref}>
      <button
        ref={buttonRef}
        onClick={onToggle}
        className={`relative flex items-center justify-center gap-2 w-full py-2 rounded-lg text-sm font-medium transition-all ${
          open ? "bg-white/10 text-white" : "text-slate-400 hover:text-white hover:bg-white/5"
        }`}
      >
        <Bell size={15} />
        News
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-fuchsia-500 ring-1 ring-black" />
        )}
        <ChevronDown size={13} className={`transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div
          className="fixed w-80 rounded-xl border border-white/10 bg-slate-900/98 backdrop-blur-md shadow-2xl overflow-hidden z-[9999]"
          style={{ top: menuPos.top, left: menuPos.left }}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-white/8">
            <div className="flex items-center gap-2">
              <Bell size={13} className="text-slate-500" />
              <span className="text-[12px] font-semibold text-slate-300 tracking-wide">News & Updates</span>
              {unreadCount > 0 && (
                <span className="px-1.5 py-0.5 rounded-full bg-fuchsia-500/20 border border-fuchsia-500/30 text-fuchsia-300 text-[10px] font-mono">
                  {unreadCount}
                </span>
              )}
            </div>
            {unreadCount > 0 && (
              <button
                onClick={handleDismissAll}
                className="text-[10px] text-slate-500 hover:text-slate-300 transition-colors"
              >
                Dismiss all
              </button>
            )}
          </div>

          {/* Content */}
          <div className="max-h-[28rem] overflow-y-auto">
            {unreadCount === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 gap-2 text-slate-600">
                <Bell size={20} strokeWidth={1.5} />
                <p className="text-[12px]">All caught up</p>
              </div>
            ) : (
              <>
                {/* News Article Previews */}
                {visibleArticles.length > 0 && (
                  <div>
                    {visibleArticles.length > 0 && visibleNotifs.length > 0 && (
                      <p className="px-4 pt-2.5 pb-1 text-[10px] font-semibold text-slate-600 uppercase tracking-widest">Articles</p>
                    )}
                    {visibleArticles.map(a => {
                      const cfg = NEWS_TYPE_CONFIG[a.type as keyof typeof NEWS_TYPE_CONFIG] ?? NEWS_TYPE_CONFIG.update
                      const Icon = cfg.icon
                      return (
                        <div
                          key={`article-${a.id}`}
                          className="group px-3 py-2.5 border-b border-white/5 last:border-0 hover:bg-white/[0.04] transition-colors cursor-pointer"
                          onClick={() => { window.location.href = `/news/${a.slug}`; onToggle() }}
                        >
                          <div className="flex items-start gap-2.5">
                            {a.previewImage ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={a.previewImage}
                                alt=""
                                className="w-10 h-10 rounded-lg object-cover shrink-0 border border-white/10"
                              />
                            ) : (
                              <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${cfg.bg} border ${cfg.border}`}>
                                <Icon size={16} className={cfg.text} />
                              </div>
                            )}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-1.5 mb-0.5">
                                <span className={`text-[10px] font-semibold ${cfg.text}`}>{a.type === 'success' ? 'Update' : a.type === 'update' ? 'Patch' : a.type === 'tutorial' ? 'Tutorial' : a.type.charAt(0).toUpperCase() + a.type.slice(1)}</span>
                                <span className="text-slate-700 text-[10px]">·</span>
                                <span className="text-[10px] text-slate-600">{relativeTime(a.publishedAt || a.createdAt)}</span>
                              </div>
                              <p className="text-[12px] text-slate-200 font-medium leading-snug truncate">{a.title}</p>
                              <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed line-clamp-2">{a.summary}</p>
                            </div>
                            <button
                              onClick={e => { e.stopPropagation(); handleDismissArticle(a.id) }}
                              className="shrink-0 w-5 h-5 flex items-center justify-center rounded-full text-slate-600 hover:text-slate-300 hover:bg-white/8 transition-all opacity-0 group-hover:opacity-100 mt-0.5"
                            >
                              <X size={10} />
                            </button>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}

                {/* Notifications */}
                {visibleNotifs.length > 0 && (
                  <div>
                    {visibleArticles.length > 0 && (
                      <p className="px-4 pt-2.5 pb-1 text-[10px] font-semibold text-slate-600 uppercase tracking-widest">Updates</p>
                    )}
                    {visibleNotifs.map((n) => {
                      const cfg = NEWS_TYPE_CONFIG[n.type as keyof typeof NEWS_TYPE_CONFIG] ?? NEWS_TYPE_CONFIG.info
                      const Icon = cfg.icon
                      return (
                        <div key={n.id} className="group px-4 py-3 border-b border-white/5 last:border-0 hover:bg-white/[0.03] transition-colors">
                          <div className="flex items-start gap-3">
                            <div className={`mt-0.5 shrink-0 w-5 h-5 rounded-full flex items-center justify-center ${cfg.dot}/15`}>
                              <Icon size={11} className={cfg.text} />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-[12px] text-slate-200 leading-relaxed">{parseNotifMessage(n.message)}</p>
                              <p className="text-[10px] text-slate-600 mt-1">{relativeTime(n.createdAt)}</p>
                            </div>
                            {n.locked ? (
                              <div className="shrink-0 w-5 h-5 flex items-center justify-center text-amber-500/50" title="Pinned">
                                <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><path d="M16 12V4h1V2H7v2h1v8l-2 2v2h5.2v6h1.6v-6H18v-2l-2-2z"/></svg>
                              </div>
                            ) : (
                              <button
                                onClick={() => handleDismiss(n.id)}
                                className="shrink-0 w-5 h-5 flex items-center justify-center rounded-full text-slate-600 hover:text-slate-300 hover:bg-white/8 transition-all opacity-0 group-hover:opacity-100"
                              >
                                <X size={10} />
                              </button>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// --- SHOP DROPDOWN ---
function ShopDropdown({
  open, onToggle, user,
}: {
  open: boolean
  onToggle: () => void
  user: UserData | null
}) {
  const ref = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const [menuPos, setMenuPos] = useState({ top: 0, left: 0 })
  const [loginPrompt, setLoginPrompt] = useState(false)

  useEffect(() => {
    if (!open) { setLoginPrompt(false); return }
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onToggle()
    }
    document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [open, onToggle])

  useEffect(() => {
    if (open && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect()
      setMenuPos({ top: rect.bottom + 8, left: Math.min(rect.left, window.innerWidth - 328) })
    }
  }, [open])

  function handleNav(path: string) {
    if (!user) { setLoginPrompt(true); return }
    window.location.href = path
    onToggle()
  }

  return (
    <div className="relative flex-none min-w-[90px] sm:flex-1" ref={ref}>
      <button
        ref={buttonRef}
        onClick={onToggle}
        className={`flex items-center justify-center gap-2 w-full py-2 rounded-lg text-sm font-medium transition-all ${
          open ? "bg-white/10 text-white" : "text-slate-400 hover:text-white hover:bg-white/5"
        }`}
      >
        <ShoppingBag size={15} />
        Shop
        <ChevronDown size={13} className={`transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="fixed w-80 rounded-2xl border border-white/10 bg-[#0a0f1e] backdrop-blur-xl shadow-2xl shadow-black/70 z-[9999] overflow-hidden" style={{ top: menuPos.top, left: menuPos.left }}>

          {/* ── Tickets card ── */}
          <div className="p-3">
            <button
              onClick={() => handleNav("/buy-tickets")}
              className="w-full rounded-xl border border-white/10 bg-slate-800/60 hover:bg-slate-700/50 hover:border-white/20 transition-all group overflow-hidden"
            >
              <div className="px-4 py-3.5 text-left">
                <div className="flex items-center justify-between mb-2.5">
                  <div className="flex items-center gap-2.5">
                    <div className="w-7 h-7 rounded-lg bg-slate-700 border border-white/10 flex items-center justify-center shrink-0">
                      <Ticket size={14} className="text-slate-200" />
                    </div>
                    <span className="text-[13px] font-bold text-white">Ticket Dispenser</span>
                  </div>
                  <span className="text-[10px] font-mono text-slate-500 group-hover:text-slate-300 transition-colors">Buy →</span>
                </div>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  Tickets power every generation. Each image or video costs tickets — the amount depends on the model. Packs are one-time purchases and never expire.
                </p>
              </div>
              <div className="px-4 py-2 border-t border-white/8 bg-slate-800/80 flex items-center justify-between">
                <span className="text-[10px] text-slate-500 font-medium">Packs from 25 → 1,000 tickets</span>
                <span className="text-[10px] font-bold text-slate-400 group-hover:text-white transition-colors">Shop now →</span>
              </div>
            </button>
          </div>

          <div className="mx-3 border-t border-white/6" />

          {/* ── Dev Tier card ── */}
          <div className="p-3">
            <button
              onClick={() => handleNav("/prompting-studio/subscribe")}
              className="w-full rounded-xl border border-white/10 bg-slate-800/60 hover:bg-slate-700/50 hover:border-white/20 transition-all group overflow-hidden"
            >
              <div className="px-4 py-3.5 text-left">
                <div className="flex items-center justify-between mb-2.5">
                  <div className="flex items-center gap-2.5">
                    <div className="w-7 h-7 rounded-lg bg-slate-700 border border-white/10 flex items-center justify-center shrink-0">
                      <Sparkles size={13} className="text-slate-200" />
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[13px] font-bold text-white">Dev Tier</span>
                      <span className="text-[9px] font-black uppercase tracking-wider text-slate-400 bg-slate-700 border border-white/10 px-1.5 py-0.5 rounded-full">Subscription</span>
                    </div>
                  </div>
                  <span className="text-[10px] font-mono text-slate-500 group-hover:text-slate-300 transition-colors">View →</span>
                </div>
                <p className="text-[11px] text-slate-400 leading-relaxed mb-3">
                  Unlock the full studio with a recurring plan — tickets auto-delivered every cycle, discounts on purchases, and more slots.
                </p>
                <div className="grid grid-cols-2 gap-x-3 gap-y-2">
                  {[
                    { label: "30% off all ticket purchases", bright: true },
                    { label: "250–500 tickets per cycle", bright: true },
                    { label: "8 concurrent generations", bright: true },
                    { label: "100 Refs slots (2× free tier)", bright: true },
                    { label: "AI prompt generation", bright: false },
                    { label: "Early feature access", bright: false },
                  ].map(({ label, bright }) => (
                    <div key={label} className="flex items-start gap-1.5">
                      <Check size={9} className={`shrink-0 mt-0.5 ${bright ? "text-slate-300" : "text-slate-600"}`} />
                      <span className={`text-[10px] leading-snug ${bright ? "text-slate-200" : "text-slate-500"}`}>{label}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="px-4 py-2 border-t border-white/8 bg-slate-800/80 flex items-center justify-between">
                <span className="text-[10px] text-slate-500 font-medium">Biweekly · Monthly · Yearly</span>
                <span className="text-[10px] font-bold text-slate-400 group-hover:text-white transition-colors">See plans →</span>
              </div>
            </button>
          </div>

          {loginPrompt && (
            <div className="mx-3 mb-3 px-3.5 py-3 rounded-xl border border-white/10 bg-slate-800/60 space-y-1">
              <p className="text-[11px] text-slate-200 font-semibold">Sign in required</p>
              <p className="text-[10px] text-slate-500">You need to be logged in to visit the shop.</p>
              <a href="/dashboard" className="text-[11px] text-slate-400 hover:text-white hover:underline transition-colors">
                Go to login →
              </a>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// --- MAIN PAGE ---
export default function PortalV2Page() {
  const [user, setUser] = useState<UserData | null>(null)
  const [openDropdown, setOpenDropdown] = useState<string | null>(null)
  const [selectedModel, setSelectedModel] = useState<ImageModelConfig>(
    () => IMAGE_MODEL_CONFIGS.find(m => m.id === "nano-banana-pro-2")!
  )
  const [pendingSlots, setPendingSlots] = useState<PendingSlot[]>(() => {
    if (typeof window === "undefined") return []
    try {
      const stored = sessionStorage.getItem("pv2-pending-slots")
      if (stored) return JSON.parse(stored) as PendingSlot[]
    } catch {}
    return []
  })
  const [freshImages, setFreshImages] = useState<ImageItem[]>([])
  // Restored failures from a previous session — kept separate so they can be
  // interleaved with DB images by timestamp instead of crowding the top of the feed.
  const [savedFails, setSavedFails] = useState<ImageItem[]>(() => {
    if (typeof window === "undefined") return []
    try {
      const stored = sessionStorage.getItem("pv2-failed-images")
      if (stored) return JSON.parse(stored) as ImageItem[]
    } catch {}
    return []
  })
  const [refLibrary, setRefLibrary] = useState<RefImage[]>(() => {
    if (typeof window === "undefined") return []
    try {
      const stored = localStorage.getItem("pv2-ref-library")
      if (stored) {
        const { library } = JSON.parse(stored)
        if (Array.isArray(library)) return library
      }
    } catch {}
    return []
  })
  const [activeRefIds, setActiveRefIds] = useState<string[]>(() => {
    if (typeof window === "undefined") return []
    try {
      const stored = localStorage.getItem("pv2-ref-library")
      if (stored) {
        const { activeIds } = JSON.parse(stored)
        if (Array.isArray(activeIds)) return activeIds
      }
    } catch {}
    return []
  })
  const [hasPromptStudioDev, setHasPromptStudioDev] = useState(false)
  const [promptOverride, setPromptOverride] = useState<{ text: string; version: number }>({ text: "", version: 0 })
  const [videoPromptOverride, setVideoPromptOverride] = useState<{ text: string; version: number }>({ text: "", version: 0 })
  const [configOverride, setConfigOverride] = useState<{ aspectRatio?: string; quality?: string; outputFormat?: string; imageCount?: number; version: number }>({ version: 0 })
  const [selectedImage, setSelectedImage] = useState<ImageItem | null>(null)
  const [selectedVideo, setSelectedVideo] = useState<VideoDetailData | null>(null)
  const [pendingDetail, setPendingDetail] = useState<PendingSlot | null>(null)
  const [videoPendingDetail, setVideoPendingDetail] = useState<VideoPendingSlot | null>(null)

  // --- Select mode ---
  const [selectMode, setSelectMode] = useState(false)
  const [selectedImageIds, setSelectedImageIds] = useState<Set<number>>(new Set())
  const [bulkDownloading, setBulkDownloading] = useState(false)
  const [bulkDeleting, setBulkDeleting] = useState(false)
  const [downloadProgress, setDownloadProgress] = useState<{ done: number; total: number } | null>(null)
  const [downloadError, setDownloadError] = useState<string | null>(null)

  const handleSelectToggle = (id: number) => {
    setSelectedImageIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  const handleToggleSelectMode = () => {
    setSelectMode(v => !v)
    setSelectedImageIds(new Set())
  }

  const handleBulkDownload = async () => {
    if (selectedImageIds.size === 0) return
    const ids = Array.from(selectedImageIds)
    setBulkDownloading(true)
    setDownloadError(null)
    setDownloadProgress({ done: 0, total: ids.length })

    // Delay URL revocation — revoking immediately after a.click() causes silent
    // failures on iOS Safari before the browser has had a chance to initiate the
    // download fetch.
    const triggerDownload = (blob: Blob, filename: string) => {
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = filename
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      setTimeout(() => URL.revokeObjectURL(url), 10000)
    }

    try {
      if (ids.length === 1) {
        // Single file — direct proxy download
        const res = await fetch(`/api/images/${ids[0]}?download=1`)
        if (!res.ok) throw new Error(`Server error ${res.status}`)
        const blob = await res.blob()
        const ext = blob.type.includes("mp4") || blob.type.includes("video") ? "mp4"
                  : blob.type.includes("webm") ? "webm"
                  : blob.type.includes("jpeg") ? "jpg"
                  : blob.type.includes("webp") ? "webp"
                  : "png"
        triggerDownload(blob, `file-${ids[0]}.${ext}`)
        setDownloadProgress({ done: 1, total: 1 })
      } else {
        // Multiple files — server builds the zip so the client never has to
        // hold every raw image blob in JS heap simultaneously (avoids the
        // iPad Safari memory crash that occurred with the old client-side
        // JSZip approach for large selections).
        const url = `/api/images/zip?ids=${ids.join(",")}`
        const res = await fetch(url)
        if (!res.ok) throw new Error("Zip generation failed")

        // Stream the response body so we can report download progress
        const contentLength = parseInt(res.headers.get("Content-Length") ?? "0")
        const reader = res.body!.getReader()
        const chunks: BlobPart[] = []
        let received = 0

        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          if (value) {
            chunks.push(value)
            received += value.length
            if (contentLength > 0) {
              setDownloadProgress({
                done: Math.min(Math.round((received / contentLength) * ids.length), ids.length - 1),
                total: ids.length,
              })
            }
          }
        }

        const zipBlob = new Blob(chunks, { type: "application/zip" })
        setDownloadProgress({ done: ids.length, total: ids.length })
        triggerDownload(zipBlob, `selections-${Date.now()}.zip`)
      }
    } catch (err) {
      console.error("Bulk download failed:", err)
      const msg = err instanceof Error ? err.message : "Download failed"
      setDownloadError(msg.includes("storage") || msg.includes("quota") || msg.includes("QuotaExceededError")
        ? "Not enough storage space"
        : msg.includes("Network") || msg.includes("fetch")
          ? "Network error — check your connection"
          : "Download failed")
    } finally {
      setBulkDownloading(false)
      setTimeout(() => setDownloadProgress(null), 600)
    }
  }

  const handleBulkDelete = async () => {
    if (selectedImageIds.size === 0) return
    setBulkDeleting(true)
    try {
      const res = await fetch('/api/my-images', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: Array.from(selectedImageIds) }),
      })
      if (res.ok) {
        setSelectedImageIds(new Set())
        setSelectMode(false)
        // Force image grid to reload by bumping a key
        setImageGridKey(k => k + 1)
      }
    } catch {}
    finally { setBulkDeleting(false) }
  }

  const [imageGridKey, setImageGridKey] = useState(0)

  // --- Video scanner state ---
  const [scannerMode, setScannerMode] = useState<"image" | "video">("image")
  const [selectedVideoModel, setSelectedVideoModel] = useState<VideoModelConfig>(() => VIDEO_MODEL_CONFIGS[0])
  const [videoDuration, setVideoDuration] = useState("5")
  const [videoAspectRatio, setVideoAspectRatio] = useState("16:9")
  const [videoResolution, setVideoResolution] = useState("1080p")
  const [videoAudioEnabled, setVideoAudioEnabled] = useState(false)
  const [videoAudioFile, setVideoAudioFile] = useState<File | null>(null)
  const [videoAudioUrl, setVideoAudioUrl] = useState<string | null>(null)
  const [videoStartFramePreview, setVideoStartFramePreview] = useState<string | null>(null)
  const [videoStartFrameUrl, setVideoStartFrameUrl] = useState<string | null>(null)
  const [videoEndFramePreview, setVideoEndFramePreview] = useState<string | null>(null)
  const [videoEndFrameUrl, setVideoEndFrameUrl] = useState<string | null>(null)
  const [videoItems, setVideoItems] = useState<VideoItem[]>([])
  const [videoPendingSlots, setVideoPendingSlots] = useState<VideoPendingSlot[]>(() => {
    if (typeof window === "undefined") return []
    try {
      const stored = sessionStorage.getItem("pv2-video-pending-slots")
      if (stored) {
        const slots = JSON.parse(stored) as VideoPendingSlot[]
        // Keep slots up to 90 min old — startVideoPolling will immediately fail ones
        // that are past the poll timeout (20 min) so they show a failed tile instead
        // of being silently dropped.
        const cutoff = Date.now() - 90 * 60 * 1000
        return slots.filter(s => !s.startedAt || s.startedAt > cutoff)
      }
    } catch {}
    return []
  })
  const [savedVideoFails, setSavedVideoFails] = useState<VideoItem[]>(() => {
    if (typeof window === "undefined") return []
    try {
      const stored = sessionStorage.getItem("pv2-video-failed-items")
      if (stored) return JSON.parse(stored) as VideoItem[]
    } catch {}
    return []
  })
  const [videoGenerating, setVideoGenerating] = useState(false)
  const videoPollingIntervals = useRef<Record<string, ReturnType<typeof setInterval>>>({})
  const [videoConfigOpen, setVideoConfigOpen] = useState(false)
  // Motion Control state
  const [videoMotionPromptText, setVideoMotionPromptText] = useState("")
  const [videoMotionVideoPreview, setVideoMotionVideoPreview] = useState<string | null>(null)
  const [videoMotionVideoUrl, setVideoMotionVideoUrl] = useState<string | null>(null)
  const [videoMotionVideoDuration, setVideoMotionVideoDuration] = useState<number | null>(null)
  const [videoCharacterOrientation, setVideoCharacterOrientation] = useState<"image" | "video">("image")
  const [videoKeepOriginalSound, setVideoKeepOriginalSound] = useState(true)
  const [videoSD20Mode, setVideoSD20Mode] = useState<"t2v" | "i2v" | "r2v">("t2v")
  // SeeDance 2.0 reference-to-video state
  const [videoRefImagePreviews, setVideoRefImagePreviews] = useState<string[]>([])
  const [videoRefImageUrls, setVideoRefImageUrls] = useState<(string | null)[]>([])
  const [videoRefVideoFilenames, setVideoRefVideoFilenames] = useState<string[]>([])
  const [videoRefVideoUrls, setVideoRefVideoUrls] = useState<(string | null)[]>([])
  const [videoRefAudioFilenames, setVideoRefAudioFilenames] = useState<string[]>([])
  const [videoRefAudioUrls, setVideoRefAudioUrls] = useState<(string | null)[]>([])
  const [videoRefVideoDuration, setVideoRefVideoDuration] = useState<number>(0)
  // Lipsync v3 state
  const [videoLipsyncVideoFilename, setVideoLipsyncVideoFilename] = useState<string | null>(null)
  const [videoLipsyncVideoUrl, setVideoLipsyncVideoUrl] = useState<string | null>(null)
  const [videoLipsyncVideoDuration, setVideoLipsyncVideoDuration] = useState<number>(0)
  const [videoLipsyncAspectRatio, setVideoLipsyncAspectRatio] = useState<string | undefined>(undefined)
  const [videoLipsyncAudioFilename, setVideoLipsyncAudioFilename] = useState<string | null>(null)
  const [videoLipsyncAudioUrl, setVideoLipsyncAudioUrl] = useState<string | null>(null)
  const [videoLipsyncSyncMode, setVideoLipsyncSyncMode] = useState<string>("cut_off")

  const handleAddPending    = useCallback((slot: PendingSlot) => setPendingSlots(p => [slot, ...p]), [])
  const handleUpdatePending = useCallback((slotId: string, update: Partial<PendingSlot>) => {
    if (update.status === "failed") {
      // Compute the ID outside the updater — React Strict Mode double-invokes updaters,
      // so creating it inside would produce two different timestamps and two duplicate tiles.
      const failId = -Date.now()
      const failedAt = new Date().toISOString()
      setPendingSlots(prev => {
        const slot = prev.find(s => s.slotId === slotId)
        if (slot) {
          const failedItem: ImageItem = {
            id: failId,
            imageUrl: '',
            prompt: slot.prompt,
            model: slot.modelId || '',
            failed: true,
            failError: update.error,
            createdAt: failedAt,
            aspectRatio: slot.nb2AspectRatio || slot.aspectRatio,
            quality: slot.nb2Quality || slot.quality,
            referenceImageUrls: slot.referenceImageUrls || [],
          }
          // Defer to avoid calling a setter inside another setter's updater
          setTimeout(() => {
            setFreshImages(fi => fi.some(i => i.id === failedItem.id) ? fi : [failedItem, ...fi])
            setSavedFails(sf => sf.some(i => i.id === failedItem.id) ? sf : [failedItem, ...sf])
          }, 0)
        }
        return prev.filter(s => s.slotId !== slotId)
      })
    } else {
      setPendingSlots(p => p.map(s => s.slotId === slotId ? { ...s, ...update } : s))
    }
  }, [])
  const handleRemovePending = useCallback((slotId: string) =>
    setPendingSlots(p => p.filter(s => s.slotId !== slotId)), [])
  // Deduplicate by ID and imageUrl — prevents same image appearing twice when
  // multiple polling intervals complete and each fetches /api/my-images
  const handlePrependImage = useCallback((img: ImageItem) =>
    setFreshImages(p => p.some(i => i.id === img.id || i.imageUrl === img.imageUrl) ? p : [img, ...p]), [])
  const handleBalanceChange = useCallback((balance: number) =>
    setUser(u => u ? { ...u, ticketBalance: balance } : u), [])

  // --- Video handlers ---
  const uploadVideoFrame = useCallback(async (file: File): Promise<string | null> => {
    try {
      let dataUrl: string
      let mimeType = file.type
      // Compress images to stay under FAL's 10MB file size limit
      if (file.type.startsWith("image/")) {
        dataUrl = await compressFileToDataUrl(file, 1920, 0.85)
        mimeType = "image/jpeg"
      } else {
        dataUrl = await fileToBase64(file)
      }
      const base64 = dataUrl.split(",")[1]
      const res = await fetch("/api/admin/upload-frame", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ base64, mimeType, filename: file.name }),
      })
      const data = await res.json()
      return data.url ?? null
    } catch { return null }
  }, [])

  const handleVideoStartFrameSelect = useCallback(async (file: File) => {
    setVideoStartFramePreview(URL.createObjectURL(file))
    setVideoStartFrameUrl(null)
    const url = await uploadVideoFrame(file)
    setVideoStartFrameUrl(url)
  }, [uploadVideoFrame])

  const handleVideoEndFrameSelect = useCallback(async (file: File) => {
    setVideoEndFramePreview(URL.createObjectURL(file))
    setVideoEndFrameUrl(null)
    const url = await uploadVideoFrame(file)
    setVideoEndFrameUrl(url)
  }, [uploadVideoFrame])

  const handleVideoAudioSelect = useCallback(async (file: File) => {
    setVideoAudioFile(file)
    setVideoAudioUrl(null)
    const url = await uploadVideoFrame(file)
    setVideoAudioUrl(url)
  }, [uploadVideoFrame])

  const handleVideoMotionVideoSelect = useCallback(async (file: File) => {
    setVideoMotionVideoPreview(file.name)
    setVideoMotionVideoUrl(null)
    const url = await uploadVideoFrame(file)
    setVideoMotionVideoUrl(url)
  }, [uploadVideoFrame])

  // SeeDance 2.0 reference-to-video handlers
  const handleAddRefImage = useCallback(async (file: File) => {
    const preview = URL.createObjectURL(file)
    setVideoRefImagePreviews(p => [...p, preview])
    setVideoRefImageUrls(u => [...u, null])
    const idx = videoRefImagePreviews.length
    const url = await uploadVideoFrame(file)
    setVideoRefImageUrls(u => u.map((v, i) => i === idx ? url : v))
  }, [uploadVideoFrame, videoRefImagePreviews.length])

  const handleRemoveRefImage = useCallback((i: number) => {
    setVideoRefImagePreviews(p => p.filter((_, j) => j !== i))
    setVideoRefImageUrls(u => u.filter((_, j) => j !== i))
  }, [])

  const handleAddRefVideo = useCallback(async (file: File, duration: number) => {
    setVideoRefVideoFilenames(f => [...f, file.name])
    setVideoRefVideoUrls(u => [...u, null])
    setVideoRefVideoDuration(d => d + duration)
    const idx = videoRefVideoFilenames.length
    const url = await uploadVideoFrame(file)
    setVideoRefVideoUrls(u => u.map((v, i) => i === idx ? url : v))
  }, [uploadVideoFrame, videoRefVideoFilenames.length])

  const handleRemoveRefVideo = useCallback((i: number, duration: number) => {
    setVideoRefVideoFilenames(f => f.filter((_, j) => j !== i))
    setVideoRefVideoUrls(u => u.filter((_, j) => j !== i))
    setVideoRefVideoDuration(d => Math.max(0, d - duration))
  }, [])

  const handleAddRefAudio = useCallback(async (file: File) => {
    setVideoRefAudioFilenames(f => [...f, file.name])
    setVideoRefAudioUrls(u => [...u, null])
    const idx = videoRefAudioFilenames.length
    const url = await uploadVideoFrame(file)
    setVideoRefAudioUrls(u => u.map((v, i) => i === idx ? url : v))
  }, [uploadVideoFrame, videoRefAudioFilenames.length])

  const handleRemoveRefAudio = useCallback((i: number) => {
    setVideoRefAudioFilenames(f => f.filter((_, j) => j !== i))
    setVideoRefAudioUrls(u => u.filter((_, j) => j !== i))
  }, [])

  const handleLipsyncVideoSelect = useCallback(async (file: File, duration: number, aspectRatio?: string) => {
    setVideoLipsyncVideoFilename(file.name)
    setVideoLipsyncVideoUrl(null)
    setVideoLipsyncVideoDuration(duration)
    setVideoLipsyncAspectRatio(aspectRatio)
    const url = await uploadVideoFrame(file)
    setVideoLipsyncVideoUrl(url)
  }, [uploadVideoFrame])

  const handleLipsyncAudioSelect = useCallback(async (file: File) => {
    setVideoLipsyncAudioFilename(file.name)
    setVideoLipsyncAudioUrl(null)
    const url = await uploadVideoFrame(file)
    setVideoLipsyncAudioUrl(url)
  }, [uploadVideoFrame])

  const startVideoPolling = useCallback((slot: VideoPendingSlot) => {
    // Skip slots that haven't been promoted from queue yet (no FAL requestId)
    if (!slot.requestId) return
    if (videoPollingIntervals.current[slot.slotId]) return

    // If the slot is already past its poll timeout (e.g. page was refreshed after it
    // expired), fail it immediately so a failed tile appears instead of silent disappearance.
    const POLL_TIMEOUT_MS = 80 * 15 * 1000 // 80 polls × 15s = 20 min (SeeDance 2.0 can be slow)
    if (slot.startedAt && Date.now() - slot.startedAt > POLL_TIMEOUT_MS) {
      setVideoPendingSlots(prev => prev.filter(s => s.slotId !== slot.slotId))
      const timedOutItem: VideoItem = {
        id: slot.requestId,
        videoUrl: "",
        prompt: slot.prompt,
        model: slot.model,
        duration: slot.duration,
        failed: true,
        failError: "Generation timed out",
        createdAt: new Date().toISOString(),
      }
      // Dedup guard — prevents duplicate tiles if this path is triggered more than once
      setVideoItems(prev => prev.some(i => i.id === timedOutItem.id) ? prev : [timedOutItem, ...prev])
      setSavedVideoFails(prev => prev.some(f => f.id === timedOutItem.id) ? prev : [timedOutItem, ...prev])
      if (slot.ticketCost > 0) {
        setUser(prev => prev ? { ...prev, ticketBalance: prev.ticketBalance + slot.ticketCost } : prev)
        fetch("/api/admin/use-tickets", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "refund", amount: slot.ticketCost }) }).catch(() => {})
      }
      return
    }

    let pollCount = 0
    let pollInFlight = false
    const interval = setInterval(async () => {
      // Guard: skip this tick if the previous fetch is still in-flight.
      // Without this, a device waking from sleep can queue multiple ticks simultaneously,
      // causing concurrent video-status calls that each save a duplicate DB row.
      if (pollInFlight) return
      pollInFlight = true
      pollCount++
      // Auto-fail after 80 polls (80 × 15s = 20 min)
      if (pollCount > 80) {
        clearInterval(interval)
        delete videoPollingIntervals.current[slot.slotId]
        setVideoPendingSlots(prev => prev.filter(s => s.slotId !== slot.slotId))
        const timedOutItem: VideoItem = {
          id: slot.requestId,
          videoUrl: "",
          prompt: slot.prompt,
          model: slot.model,
          duration: slot.duration,
          failed: true,
          failError: "Generation timed out",
          createdAt: new Date().toISOString(),
        }
        // Dedup guard — prevents duplicate tiles if two ticks slipped the pollInFlight guard
        setVideoItems(prev => prev.some(i => i.id === timedOutItem.id) ? prev : [timedOutItem, ...prev])
        setSavedVideoFails(prev => prev.some(f => f.id === timedOutItem.id) ? prev : [timedOutItem, ...prev])
        if (slot.ticketCost > 0) {
          setUser(prev => prev ? { ...prev, ticketBalance: prev.ticketBalance + slot.ticketCost } : prev)
          fetch("/api/admin/use-tickets", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "refund", amount: slot.ticketCost }) }).catch(() => {})
        }
        pollInFlight = false
        return
      }
      try {
        const res = await fetch("/api/admin/video-status", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            requestId:            slot.requestId,
            falEndpoint:          slot.falEndpoint,
            prompt:               slot.prompt,
            model:                slot.model,
            duration:             slot.duration,
            resolution:           slot.resolution,
            ticketCost:           slot.ticketCost,
            aspectRatio:          slot.aspectRatio,
            audioEnabled:         slot.audioEnabled,
            startFrameUrl:        slot.startFrameUrl,
            endFrameUrl:          slot.endFrameUrl,
            motionVideoUrl:       slot.motionVideoUrl,
            keepOriginalSound:    slot.keepOriginalSound,
            characterOrientation: slot.characterOrientation,
          }),
        })
        const data = await res.json()
        if (data.status === "completed") {
          clearInterval(interval)
          delete videoPollingIntervals.current[slot.slotId]
          // Clear from sessionStorage immediately — don't wait for the React effect.
          // If the user refreshes before the effect fires, the slot would be restored
          // from sessionStorage and trigger a second poll that duplicates the DB row.
          try {
            const stored = sessionStorage.getItem("pv2-video-pending-slots")
            if (stored) {
              const slots = JSON.parse(stored)
              sessionStorage.setItem("pv2-video-pending-slots", JSON.stringify(slots.filter((s: any) => s.slotId !== slot.slotId)))
            }
          } catch {}
          setVideoPendingSlots(prev => prev.filter(s => s.slotId !== slot.slotId))
          // Dedup by requestId — prevents a double-add if two ticks slipped through
          setVideoItems(prev => prev.some(i => i.id === slot.requestId) ? prev : [{
            id:                   slot.requestId,
            dbId:                 data.videoId ?? undefined,
            videoUrl:             data.videoUrl,
            prompt:               slot.prompt,
            model:                slot.model,
            duration:             slot.duration,
            resolution:           slot.resolution,
            aspectRatio:          slot.aspectRatio,
            audioEnabled:         slot.audioEnabled,
            startFrameUrl:        slot.startFrameUrl,
            endFrameUrl:          slot.endFrameUrl,
            motionVideoUrl:       slot.motionVideoUrl,
            keepOriginalSound:    slot.keepOriginalSound,
            characterOrientation: slot.characterOrientation,
            createdAt:            new Date().toISOString(),
          }, ...prev])
        } else if (data.status === "failed") {
          clearInterval(interval)
          delete videoPollingIntervals.current[slot.slotId]
          setVideoPendingSlots(prev => prev.filter(s => s.slotId !== slot.slotId))
          const failedItem: VideoItem = {
            id: slot.requestId,
            videoUrl: "",
            prompt: slot.prompt,
            model: slot.model,
            duration: slot.duration,
            failed: true,
            failError: data.error || "Generation failed",
            createdAt: new Date().toISOString(),
          }
          setVideoItems(prev => [failedItem, ...prev])
          setSavedVideoFails(prev => prev.some(f => f.id === failedItem.id) ? prev : [failedItem, ...prev])
          if (slot.ticketCost > 0) {
            setUser(prev => prev ? { ...prev, ticketBalance: prev.ticketBalance + slot.ticketCost } : prev)
            fetch("/api/admin/use-tickets", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "refund", amount: slot.ticketCost }) }).catch(() => {})
          }
        }
      } catch { /* keep polling on transient error */ } finally { pollInFlight = false }
    }, 15000)
    videoPollingIntervals.current[slot.slotId] = interval
  }, [])

  const handleVideoGenerate = useCallback(async (promptText: string) => {
    const isMotion = selectedVideoModel.id === "kling-v3-motion"
    const isLipsync = !!selectedVideoModel.supportsLipsync
    const isSD20 = !!selectedVideoModel.supportsSD20Modes
    const sd20NeedsImage = isSD20 && videoSD20Mode === "i2v"
    const isTextToVideo = !!selectedVideoModel.textToVideo && !sd20NeedsImage
    if (!videoStartFrameUrl && !isTextToVideo && !isLipsync) return
    if (isMotion && !videoMotionVideoUrl) return
    if (isLipsync && (!videoLipsyncVideoUrl || !videoLipsyncAudioUrl)) return
    if (!isMotion && !isLipsync && !promptText.trim()) return
    if (isMotion && videoCharacterOrientation === "image" && videoMotionVideoDuration !== null && videoMotionVideoDuration > 10) {
      alert(`Reference video is ${Math.round(videoMotionVideoDuration)}s. For "Image" character orientation, FAL requires the video to be 10 seconds or shorter. Please upload a shorter clip or switch orientation to "Video".`)
      return
    }
    setVideoGenerating(true)
    try {
      const res = await fetch("/api/video/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt:               promptText,
          imageUrl:             videoStartFrameUrl,
          endImageUrl:          videoEndFrameUrl || undefined,
          duration:             videoDuration,
          resolution:           videoResolution,
          klingAspectRatio:     videoAspectRatio,
          model:                selectedVideoModel.id,
          sd20Mode:             isSD20 ? videoSD20Mode : undefined,
          generateAudio:        videoAudioEnabled,
          audioUrl:             videoAudioUrl || undefined,
          adminMode:            userRef.current !== null && ADMIN_EMAILS.includes(userRef.current.email),
          userId:               (userRef.current !== null && !ADMIN_EMAILS.includes(userRef.current.email)) ? userRef.current.id : undefined,
          // Motion Control
          motionVideoUrl:          videoMotionVideoUrl || undefined,
          motionVideoDurationSec:  videoMotionVideoDuration ?? undefined,
          characterOrientation:    videoCharacterOrientation,
          keepOriginalSound:       videoKeepOriginalSound,
          // SeeDance 2.0 reference-to-video
          ...(isSD20 && videoSD20Mode === "r2v" && {
            referenceImageUrls:    videoRefImageUrls.filter(Boolean) as string[],
            referenceVideoUrls:    videoRefVideoUrls.filter(Boolean) as string[],
            referenceAudioUrls:    videoRefAudioUrls.filter(Boolean) as string[],
            referenceVideoDurationSec: videoRefVideoDuration,
          }),
          // Lipsync v3
          ...(isLipsync && {
            lipsyncVideoUrl:        videoLipsyncVideoUrl,
            lipsyncAudioUrl:        videoLipsyncAudioUrl,
            lipsyncSyncMode:        videoLipsyncSyncMode,
            lipsyncVideoDurationSec: videoLipsyncVideoDuration,
          }),
        }),
      })
      const data = await res.json()
      if (!data.success) throw new Error(data.error || "Generation failed")
      const slotBase = {
        slotId:               `video-${Date.now()}`,
        prompt:               promptText,
        model:                selectedVideoModel.id,
        duration:             data.duration || videoDuration,
        resolution:           videoResolution,
        ticketCost:           data.ticketCost,
        startedAt:            Date.now(),
        aspectRatio:          isLipsync ? videoLipsyncAspectRatio : (videoAspectRatio || undefined),
        audioEnabled:         videoAudioEnabled,
        startFrameUrl:        videoStartFrameUrl || undefined,
        endFrameUrl:          videoEndFrameUrl || undefined,
        motionVideoUrl:       videoMotionVideoUrl || undefined,
        keepOriginalSound:    videoKeepOriginalSound,
        characterOrientation: videoCharacterOrientation,
      }
      // Update UI balance immediately.
      // For admin users the generate route skips deduction, so we also persist via use-tickets.
      // For regular users the generate route already deducted server-side — UI update only.
      if (data.ticketCost > 0) {
        setUser(prev => prev ? { ...prev, ticketBalance: Math.max(0, prev.ticketBalance - data.ticketCost) } : prev)
        const currentUser = userRef.current
        const isAdminUser = currentUser !== null && ADMIN_EMAILS.includes(currentUser.email)
        if (isAdminUser) {
          fetch("/api/admin/use-tickets", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: "deduct", amount: data.ticketCost }),
          }).catch(() => {})
        }
      }
      if (data.queued) {
        // At capacity — job is queued; slot has no FAL requestId yet
        const slot: VideoPendingSlot = {
          ...slotBase,
          requestId:   '',
          falEndpoint: data.falEndpoint || '',
          queueJobId:  data.queueId,
        }
        setVideoPendingSlots(prev => [slot, ...prev])
      } else {
        const slot: VideoPendingSlot = {
          ...slotBase,
          requestId:   data.requestId,
          falEndpoint: data.falEndpoint,
        }
        setVideoPendingSlots(prev => [slot, ...prev])
      }
    } catch (err: any) {
      console.error("Video generate error:", err)
      alert(err.message || "Video generation failed")
    } finally {
      setVideoGenerating(false)
    }
  }, [videoStartFrameUrl, videoEndFrameUrl, videoDuration, videoResolution, videoAspectRatio, videoAudioEnabled, videoAudioUrl, selectedVideoModel, videoMotionVideoUrl, videoCharacterOrientation, videoKeepOriginalSound, videoMotionVideoDuration, videoSD20Mode, videoRefImageUrls, videoRefVideoUrls, videoRefAudioUrls, videoRefVideoDuration, videoLipsyncVideoUrl, videoLipsyncAudioUrl, videoLipsyncSyncMode, videoLipsyncVideoDuration])

  const applyVideoModel = useCallback((model: VideoModelConfig) => {
    setSelectedVideoModel(model)
    setScannerMode("video")
    setVideoDuration(model.durations[0] ?? "5")
    setVideoAspectRatio(model.aspectRatios?.[0] ?? "16:9")
    setVideoResolution(model.resolutions?.[1] ?? "1080p")
    setVideoAudioEnabled(false)
    setVideoAudioFile(null)
    setVideoAudioUrl(null)
    setVideoStartFramePreview(null)
    setVideoStartFrameUrl(null)
    setVideoEndFramePreview(null)
    setVideoEndFrameUrl(null)
    setVideoMotionVideoPreview(null)
    setVideoMotionVideoUrl(null)
    setVideoCharacterOrientation("image")
    setVideoKeepOriginalSound(true)
    setVideoSD20Mode("t2v")
    setVideoRefImagePreviews([])
    setVideoRefImageUrls([])
    setVideoRefVideoFilenames([])
    setVideoRefVideoUrls([])
    setVideoRefAudioFilenames([])
    setVideoRefAudioUrls([])
    setVideoRefVideoDuration(0)
    setVideoLipsyncVideoFilename(null)
    setVideoLipsyncVideoUrl(null)
    setVideoLipsyncVideoDuration(0)
    setVideoLipsyncAudioFilename(null)
    setVideoLipsyncAudioUrl(null)
    setVideoLipsyncSyncMode("cut_off")
  }, [])

  const handleSelectVideoModel = useCallback((name: string) => {
    const model = VIDEO_MODEL_CONFIGS.find(m => m.name === name)
    if (!model) return
    applyVideoModel(model)
  }, [applyVideoModel])

  // Always-current reference to user so startPolling can read userId without stale closure
  const userRef = useRef<UserData | null>(null)
  useEffect(() => { userRef.current = user }, [user])

  // Polling is keyed by queueId so the same DB job can never be double-polled
  const pollingIntervals = useRef<Record<number, ReturnType<typeof setInterval>>>({})
  const completedQueueIds = useRef<Set<number>>(new Set())
  useEffect(() => () => { Object.values(pollingIntervals.current).forEach(clearInterval) }, [])
  // NB2 polling keyed by requestId (not DB-backed) — same pattern as videoPollingIntervals
  const nb2PollingIntervals = useRef<Record<string, ReturnType<typeof setInterval>>>({})
  useEffect(() => () => {
    Object.entries(nb2PollingIntervals.current).forEach(([id, interval]) => {
      clearInterval(interval)
      delete nb2PollingIntervals.current[id]
    })
  }, [])

  const startNb2SlotPolling = useCallback((
    requestId: string,
    falEndpoint: string,
    slotIds: string[],
    prompt: string,
    outputFormat: string,
    aspectRatio: string,
    statusUrl: string = "/api/admin/nb2-status",
    quality?: string,
    ticketCost: number = 0,
    referenceImageUrls: string[] = [],
  ) => {
    if (nb2PollingIntervals.current[requestId]) return
    let pollCount = 0
    let pollInFlight = false
    const interval = setInterval(async () => {
      if (pollInFlight) return
      pollInFlight = true
      pollCount++
      if (pollCount > 48) {
        clearInterval(interval)
        delete nb2PollingIntervals.current[requestId]
        if (ticketCost > 0) {
          setUser(prev => prev ? { ...prev, ticketBalance: prev.ticketBalance + ticketCost } : prev)
          fetch("/api/admin/use-tickets", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "refund", amount: ticketCost }) }).catch(() => {})
        }
        slotIds.forEach(sid => handleUpdatePending(sid, { status: "failed", error: "Generation timed out" }))
        // Clear from sessionStorage so they don't come back on refresh
        try {
          const stored = sessionStorage.getItem("pv2-pending-slots")
          if (stored) {
            const slots = JSON.parse(stored) as PendingSlot[]
            sessionStorage.setItem("pv2-pending-slots", JSON.stringify(slots.filter(s => !slotIds.includes(s.slotId))))
          }
        } catch {}
        pollInFlight = false
        return
      }
      try {
        const statusRes = await fetch(statusUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ requestId, falEndpoint, prompt, outputFormat, aspectRatio, quality, referenceImageUrls, ticketCost }),
        })
        const statusData = await statusRes.json()
        if (statusData.status === "completed") {
          clearInterval(interval)
          delete nb2PollingIntervals.current[requestId]
          // Mark as processed so future page loads don't re-poll and duplicate DB records
          try {
            const done = JSON.parse(sessionStorage.getItem("pv2-nb2-done") || "[]") as string[]
            if (!done.includes(requestId)) {
              sessionStorage.setItem("pv2-nb2-done", JSON.stringify([...done.slice(-20), requestId]))
            }
          } catch {}
          // Remove slots from sessionStorage immediately before any async/unmount risk
          try {
            const stored = sessionStorage.getItem("pv2-pending-slots")
            if (stored) {
              const slots = JSON.parse(stored) as PendingSlot[]
              sessionStorage.setItem("pv2-pending-slots", JSON.stringify(slots.filter(s => !slotIds.includes(s.slotId))))
            }
          } catch {}
          // Use dbId returned by the status route directly — avoids race condition
          // where two concurrent pollers re-fetch /api/my-images and get the same record
          const completedImgs: { url: string; dbId?: number | null }[] = statusData.images || []
          const modelId = statusUrl.includes("kling-o3") ? "kling-o3-image"
            : statusUrl.includes("kling-image") ? "kling-v3-image"
            : statusUrl.includes("wan-27-pro") ? "wan-2.7-pro"
            : "nano-banana-pro-2"
          completedImgs.forEach((img, i) =>
            handlePrependImage({
              id: img.dbId ?? (Date.now() + i),
              imageUrl: img.url,
              prompt,
              model: modelId,
              createdAt: new Date().toISOString(),
              aspectRatio,
              quality,
              referenceImageUrls: referenceImageUrls.length > 0 ? referenceImageUrls : undefined,
            })
          )
          slotIds.forEach(sid => handleRemovePending(sid))
        } else if (statusData.status === "failed") {
          clearInterval(interval)
          delete nb2PollingIntervals.current[requestId]
          if (ticketCost > 0) {
            setUser(prev => prev ? { ...prev, ticketBalance: prev.ticketBalance + ticketCost } : prev)
            fetch("/api/admin/use-tickets", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "refund", amount: ticketCost }) }).catch(() => {})
          }
          try {
            const stored = sessionStorage.getItem("pv2-pending-slots")
            if (stored) {
              const slots = JSON.parse(stored) as PendingSlot[]
              sessionStorage.setItem("pv2-pending-slots", JSON.stringify(slots.filter(s => !slotIds.includes(s.slotId))))
            }
          } catch {}
          slotIds.forEach(sid => handleUpdatePending(sid, { status: "failed", error: statusData.error || "Generation failed" }))
        }
      } catch { /* keep polling on transient error */ } finally { pollInFlight = false }
    }, 5000)
    nb2PollingIntervals.current[requestId] = interval
  }, [handleUpdatePending, handlePrependImage, handleRemovePending, setUser])
  useEffect(() => () => {
    Object.entries(videoPollingIntervals.current).forEach(([id, interval]) => {
      clearInterval(interval)
      delete videoPollingIntervals.current[id]
    })
  }, [])

  // --- QUEUE JOB POLLING (capacity-queued image slots) ---
  // When global FAL limit is reached, submit routes return { queued: true, queueId }.
  // The outer component watches for PendingSlots with queueJobId but no nb2RequestId
  // and polls /api/admin/queue-job-status until the job is promoted and gets a falRequestId.
  const queuePollingIntervals = useRef<Record<number, ReturnType<typeof setInterval>>>({})
  const startedQueuePolls = useRef<Set<number>>(new Set())
  useEffect(() => () => {
    Object.values(queuePollingIntervals.current).forEach(clearInterval)
  }, [])

  const startQueuePollingForSlot = useCallback((slot: PendingSlot) => {
    const queueJobId = slot.queueJobId!
    if (queuePollingIntervals.current[queueJobId]) return
    let pollCount = 0
    const interval = setInterval(async () => {
      pollCount++
      // Timeout after 120 polls × 5s = 10 minutes (catches jobs stuck with no falRequestId)
      if (pollCount > 120) {
        clearInterval(interval)
        delete queuePollingIntervals.current[queueJobId]
        handleUpdatePending(slot.slotId, { status: 'failed', error: 'Queued job timed out waiting for promotion' })
        return
      }
      try {
        const res = await fetch(`/api/admin/queue-job-status?id=${queueJobId}`)
        const data = await res.json()
        if (data.status === 'processing' && data.falRequestId && data.falEndpoint) {
          clearInterval(interval)
          delete queuePollingIntervals.current[queueJobId]
          // Promote: update slot with FAL request info so future restores work
          handleUpdatePending(slot.slotId, {
            nb2RequestId:  data.falRequestId,
            nb2FalEndpoint: data.falEndpoint,
          })
          startNb2SlotPolling(
            data.falRequestId,
            data.falEndpoint,
            [slot.slotId],
            slot.prompt,
            slot.nb2OutputFormat || 'png',
            slot.nb2AspectRatio || slot.aspectRatio || 'auto',
            slot.nb2StatusUrl,
            slot.nb2Quality || slot.quality,
            slot.nb2TicketCost || 0,
            slot.referenceImageUrls || [],
          )
        } else if (data.status === 'failed') {
          clearInterval(interval)
          delete queuePollingIntervals.current[queueJobId]
          handleUpdatePending(slot.slotId, { status: 'failed', error: data.errorMessage || 'Queued job failed' })
        }
      } catch { /* keep polling on transient error */ }
    }, 5000)
    queuePollingIntervals.current[queueJobId] = interval
  }, [startNb2SlotPolling, handleUpdatePending])

  // Watch for new image slots with queueJobId but no nb2RequestId
  useEffect(() => {
    pendingSlots.forEach(slot => {
      if (slot.status !== 'loading' || !slot.queueJobId || slot.nb2RequestId) return
      if (startedQueuePolls.current.has(slot.queueJobId)) return
      startedQueuePolls.current.add(slot.queueJobId)
      startQueuePollingForSlot(slot)
    })
  }, [pendingSlots, startQueuePollingForSlot])

  // --- QUEUE JOB POLLING (capacity-queued video slots) ---
  const videoQueuePollingIntervals = useRef<Record<number, ReturnType<typeof setInterval>>>({})
  const startedVideoQueuePolls = useRef<Set<number>>(new Set())
  useEffect(() => () => {
    Object.values(videoQueuePollingIntervals.current).forEach(clearInterval)
  }, [])

  const startQueuePollingForVideoSlot = useCallback((slot: VideoPendingSlot) => {
    const queueJobId = slot.queueJobId!
    if (videoQueuePollingIntervals.current[queueJobId]) return
    let pollCount = 0
    const interval = setInterval(async () => {
      pollCount++
      // Timeout after 120 polls × 5s = 10 minutes (catches jobs stuck with no falRequestId)
      if (pollCount > 120) {
        clearInterval(interval)
        delete videoQueuePollingIntervals.current[queueJobId]
        setVideoPendingSlots(prev => prev.filter(s => s.slotId !== slot.slotId))
        if (slot.ticketCost > 0) {
          setUser(prev => prev ? { ...prev, ticketBalance: prev.ticketBalance + slot.ticketCost } : prev)
          fetch("/api/admin/use-tickets", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "refund", amount: slot.ticketCost }) }).catch(() => {})
        }
        const timedOutItem: VideoItem = {
          id: slot.slotId,
          videoUrl: '',
          prompt: slot.prompt,
          model: slot.model,
          duration: slot.duration,
          failed: true,
          failError: 'Queued job timed out waiting for promotion',
          createdAt: new Date().toISOString(),
        }
        setVideoItems(prev => [timedOutItem, ...prev])
        setSavedVideoFails(prev => prev.some(f => f.id === timedOutItem.id) ? prev : [timedOutItem, ...prev])
        return
      }
      try {
        const res = await fetch(`/api/admin/queue-job-status?id=${queueJobId}`)
        const data = await res.json()
        if (data.status === 'processing' && data.falRequestId && data.falEndpoint) {
          clearInterval(interval)
          delete videoQueuePollingIntervals.current[queueJobId]
          // Update slot with real requestId/falEndpoint so startVideoPolling can work
          const promotedSlot: VideoPendingSlot = {
            ...slot,
            requestId: data.falRequestId,
            falEndpoint: data.falEndpoint,
            startedAt: Date.now(),
          }
          setVideoPendingSlots(prev => prev.map(s => s.slotId === slot.slotId ? promotedSlot : s))
          startVideoPolling(promotedSlot)
        } else if (data.status === 'failed') {
          clearInterval(interval)
          delete videoQueuePollingIntervals.current[queueJobId]
          setVideoPendingSlots(prev => prev.filter(s => s.slotId !== slot.slotId))
          if (slot.ticketCost > 0) {
            setUser(prev => prev ? { ...prev, ticketBalance: prev.ticketBalance + slot.ticketCost } : prev)
            fetch("/api/admin/use-tickets", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "refund", amount: slot.ticketCost }) }).catch(() => {})
          }
          const failedItem: VideoItem = {
            id: slot.slotId,
            videoUrl: '',
            prompt: slot.prompt,
            model: slot.model,
            duration: slot.duration,
            failed: true,
            failError: data.errorMessage || 'Queued job failed',
            createdAt: new Date().toISOString(),
          }
          setVideoItems(prev => [failedItem, ...prev])
          setSavedVideoFails(prev => prev.some(f => f.id === failedItem.id) ? prev : [failedItem, ...prev])
        }
      } catch { /* keep polling on transient error */ }
    }, 5000)
    videoQueuePollingIntervals.current[queueJobId] = interval
  }, [startVideoPolling, setVideoPendingSlots, setVideoItems, setSavedVideoFails, setUser])

  // Watch for new video slots with queueJobId but no requestId
  useEffect(() => {
    videoPendingSlots.forEach(slot => {
      if (!slot.queueJobId || slot.requestId) return
      if (startedVideoQueuePolls.current.has(slot.queueJobId)) return
      startedVideoQueuePolls.current.add(slot.queueJobId)
      startQueuePollingForVideoSlot(slot)
    })
  }, [videoPendingSlots, startQueuePollingForVideoSlot])

  const startPolling = useCallback((slotId: string, queueId: number, prompt: string) => {
    if (pollingIntervals.current[queueId]) return // already watching this job
    const interval = setInterval(async () => {
      try {
        const res = await fetch("/api/prompting-studio/jobs?source=main-scanner")
        const data = await res.json()
        const job = data.jobs?.find((j: any) => j.id === queueId)
        if (!job) return
        if (job.status === "completed") {
          clearInterval(interval)
          delete pollingIntervals.current[queueId]
          if (completedQueueIds.current.has(queueId)) return
          completedQueueIds.current.add(queueId)
          const imgRes = await fetch("/api/my-images?page=1&limit=1&type=image")
          const imgData = await imgRes.json()
          if (imgData.success && imgData.images?.[0]) handlePrependImage(imgData.images[0])
          handleRemovePending(slotId)
          const uid = userRef.current?.id
          if (uid) {
            const ticketRes = await fetch(`/api/user/tickets?userId=${uid}`)
            const ticketData = await ticketRes.json()
            if (ticketData.success) handleBalanceChange(ticketData.balance)
          }
        } else if (job.status === "failed") {
          clearInterval(interval)
          delete pollingIntervals.current[queueId]
          handleUpdatePending(slotId, { status: "failed", error: job.errorMessage || "Generation failed" })
          const uid = userRef.current?.id
          if (uid) {
            const ticketRes = await fetch(`/api/user/tickets?userId=${uid}`)
            const ticketData = await ticketRes.json()
            if (ticketData.success) handleBalanceChange(ticketData.balance)
          }
        }
      } catch { /* ignore transient polling errors */ }
    }, 3000)
    pollingIntervals.current[queueId] = interval
  }, [handlePrependImage, handleRemovePending, handleUpdatePending, handleBalanceChange])

  // Persist loading pending slots so they survive a refresh (failed slots live in freshImages now).
  useEffect(() => {
    try {
      sessionStorage.setItem("pv2-pending-slots", JSON.stringify(pendingSlots.filter(s => s.status !== "failed")))
    } catch {}
  }, [pendingSlots])

  // Persist video pending slots so they survive a refresh.
  useEffect(() => {
    try {
      sessionStorage.setItem("pv2-video-pending-slots", JSON.stringify(videoPendingSlots))
    } catch {}
  }, [videoPendingSlots])

  // Start/resume polling whenever pending slots change (handles new generations + page refresh restore).
  // Skip queued slots (no requestId yet) — startQueuePollingForVideoSlot handles those.
  useEffect(() => {
    videoPendingSlots.forEach(slot => { if (slot.requestId) startVideoPolling(slot) })
  }, [videoPendingSlots, startVideoPolling])

  // Persist failed feed tiles for the next refresh (interleaved with DB images by timestamp).
  useEffect(() => {
    try {
      sessionStorage.setItem("pv2-failed-images", JSON.stringify(savedFails))
    } catch {}
  }, [savedFails])

  // Persist failed video tiles so they survive a refresh.
  useEffect(() => {
    try {
      sessionStorage.setItem("pv2-video-failed-items", JSON.stringify(savedVideoFails))
    } catch {}
  }, [savedVideoFails])

  // Queue limits — owner accounts: unlimited, dev tier: 6 image / 2 video, free: 2 image / 1 video
  const isOwner = user?.email === "dirtysecretai@gmail.com" || user?.email === "promptandprotocol@gmail.com"
  const maxConcurrent = isOwner ? Infinity : hasPromptStudioDev ? 6 : 2
  const activeJobCount = pendingSlots.filter((s) => s.status === "loading").length
  const videoMaxConcurrent = isOwner ? Infinity : hasPromptStudioDev ? 2 : 1
  const videoActiveJobCount = videoPendingSlots.length

  // Computed: active ref images limited to the current model's cap
  const activeRefImages = refLibrary
    .filter((img) => activeRefIds.includes(img.id))
    .slice(0, selectedModel.maxReferenceImages)

  const handleLibraryUpload = useCallback((items: RefImage[]) => {
    setRefLibrary((prev) => [...prev, ...items].slice(0, 50))
  }, [])

  // Upload from prompt box: add to library + auto-activate up to model limit
  const handleUploadRef = useCallback((items: RefImage[]) => {
    setRefLibrary((prev) => [...prev, ...items].slice(0, 50))
    setActiveRefIds((prev) => {
      const slots = Math.max(0, selectedModel.maxReferenceImages - prev.length)
      const toActivate = items.slice(0, slots).map((i) => i.id)
      return [...prev, ...toActivate]
    })
  }, [selectedModel.maxReferenceImages])

  const handleLibraryDelete = useCallback((id: string) => {
    setRefLibrary((prev) => prev.filter((i) => i.id !== id))
    setActiveRefIds((prev) => prev.filter((rid) => rid !== id))
  }, [])

  const handleLibraryDeleteMultiple = useCallback((ids: string[]) => {
    const idSet = new Set(ids)
    setRefLibrary((prev) => prev.filter((i) => !idSet.has(i.id)))
    setActiveRefIds((prev) => prev.filter((rid) => !idSet.has(rid)))
  }, [])

  const handleLibraryClearAll = useCallback(() => {
    setRefLibrary([])
    setActiveRefIds([])
  }, [])

  const handleActivateRef   = useCallback((id: string) => setActiveRefIds((prev) => [...prev, id]), [])
  const handleDeactivateRef = useCallback((id: string) => setActiveRefIds((prev) => prev.filter((rid) => rid !== id)), [])

  const handleLoadPreset = useCallback((urls: string[]) => {
    const newItems: RefImage[] = urls.map((url) => ({
      id: `preset-${Date.now()}-${Math.random()}`,
      url,
    }))
    setRefLibrary((prev) => [...prev, ...newItems].slice(0, 50))
    setActiveRefIds((prev) => {
      const slots = Math.max(0, selectedModel.maxReferenceImages - prev.length)
      const toActivate = newItems.slice(0, slots).map((i) => i.id)
      return [...prev, ...toActivate]
    })
  }, [selectedModel.maxReferenceImages])

  // Storage keys
  const REF_STORAGE_KEY = "pv2-ref-library"
  const SETTINGS_STORAGE_KEY = "pv2-settings"

  // Persist ref library + active IDs whenever they change
  useEffect(() => {
    try {
      localStorage.setItem(REF_STORAGE_KEY, JSON.stringify({ library: refLibrary, activeIds: activeRefIds }))
    } catch { /* QuotaExceededError — silently skip */ }
  }, [refLibrary, activeRefIds])

  // Single effect: first run = restore from localStorage, subsequent runs = save.
  // This prevents the "save default over stored value" race that separate restore/save effects cause.
  const settingsInitialized = useRef(false)
  useEffect(() => {
    if (!settingsInitialized.current) {
      settingsInitialized.current = true
      try {
        const stored = localStorage.getItem(SETTINGS_STORAGE_KEY)
        if (stored) {
          const { modelId, scannerMode: savedMode, videoModelId } = JSON.parse(stored)
          const found = IMAGE_MODEL_CONFIGS.find((m) => m.id === modelId)
          if (found) setSelectedModel(found)
          if (savedMode === "video") {
            setScannerMode("video")
            const vFound = VIDEO_MODEL_CONFIGS.find(m => m.id === videoModelId)
            if (vFound) setSelectedVideoModel(vFound)
          }
        }
      } catch {}
      return // Do not save on the restore run
    }
    try {
      localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify({
        modelId: selectedModel.id,
        scannerMode,
        videoModelId: selectedVideoModel.id,
      }))
    } catch {}
  }, [selectedModel, scannerMode, selectedVideoModel])

  // Deactivate all ref images when switching to video mode — refs don't apply to video models
  useEffect(() => {
    if (scannerMode === "video") setActiveRefIds([])
  }, [scannerMode])

  // ?clearNB2=1 — clears stuck NB2 pending slots (useful when sessionStorage got stale on another device)
  useEffect(() => {
    if (typeof window !== "undefined" && new URLSearchParams(window.location.search).get("clearNB2") === "1") {
      sessionStorage.removeItem("pv2-pending-slots")
      sessionStorage.removeItem("pv2-nb2-done")
      // Remove the query param so it doesn't keep clearing on every navigation
      const url = new URL(window.location.href)
      url.searchParams.delete("clearNB2")
      window.history.replaceState({}, "", url.toString())
    }
  }, [])

  useEffect(() => {
    async function fetchUser() {
      try {
        const res = await fetch("/api/auth/session", { cache: "no-store" })
        const data = await res.json()
        if (data.authenticated) {
          const [ticketRes, subRes, jobsRes] = await Promise.all([
            fetch(`/api/user/tickets?userId=${data.user.id}`),
            fetch("/api/user/subscription"),
            fetch("/api/prompting-studio/jobs?source=main-scanner"),
          ])
          const ticketData = await ticketRes.json()
          const subData = await subRes.json()
          setUser({ id: data.user.id, email: data.user.email, ticketBalance: ticketData.success ? ticketData.balance : 0 })
          if (subData.hasPromptStudioDev) setHasPromptStudioDev(true)

          // Reconcile in-flight DB jobs with locally-persisted pending slots.
          // The DB is the authoritative source — this keeps the queue accurate
          // across page refreshes and across different devices.
          if (jobsRes.ok) {
            const jobsData = await jobsRes.json()
            const inFlight: any[] = (jobsData.jobs || []).filter(
              (j: any) => j.status === "processing" || j.status === "queued"
            )
            const inFlightIds = new Set(inFlight.map((j: any) => j.id as number))

            // Compute slot assignments BEFORE calling setPendingSlots so we use
            // the same slotId in both setPendingSlots and startPolling.
            // Prefer the original slotId (e.g. "slot-1234567890") if we already
            // have a persisted slot for this queueId — otherwise assign "restored-N".
            const currentSlots: PendingSlot[] = (() => {
              try {
                const stored = sessionStorage.getItem("pv2-pending-slots")
                return stored ? JSON.parse(stored) as PendingSlot[] : []
              } catch { return [] }
            })()
            const byQueueId = new Map(currentSlots.filter(s => s.queueId).map(s => [s.queueId, s]))

            const slotAssignments = inFlight.map((j: any) => ({
              slotId: byQueueId.get(j.id)?.slotId ?? `restored-${j.id}`,
              queueId: j.id as number,
              prompt: j.prompt as string,
            }))

            // Detect loading slots whose jobs are no longer in-flight (completed while page was away)
            const completedQueueSlotIds = new Set(
              currentSlots
                .filter(s => s.status === "loading" && s.queueId != null && !inFlightIds.has(s.queueId))
                .map(s => s.slotId)
            )
            const completedCount = completedQueueSlotIds.size

            // Fetch images that completed while away and prepend them
            if (completedCount > 0) {
              try {
                const recentRes = await fetch(`/api/my-images?page=1&limit=${completedCount}&type=image`)
                const recentData = await recentRes.json()
                if (recentData.success && recentData.images?.length > 0) {
                  recentData.images.forEach((img: any) =>
                    handlePrependImage({ id: img.id, imageUrl: img.imageUrl, prompt: img.prompt, model: img.model })
                  )
                }
              } catch {}
            }

            // Filter out already-completed NB2/Kling slots (requestId in pv2-nb2-done) — these
            // must NOT be re-added to pendingSlots or they get permanently stuck as loading tiles.
            const doneNb2Ids = new Set(JSON.parse(sessionStorage.getItem("pv2-nb2-done") || "[]") as string[])

            // Preserve NB2/Kling slots (have nb2RequestId, not already done) and still-queued image slots
            const nb2Slots = currentSlots.filter(s => s.nb2RequestId && !doneNb2Ids.has(s.nb2RequestId))
            // Also exclude queue-based slots that completed while away (their images were just prepended above)
            const queuedImageSlots = currentSlots.filter(s => s.queueJobId && !s.nb2RequestId && !completedQueueSlotIds.has(s.slotId))

            // Rebuild pending slots: DB in-flight slots + surviving NB2/Kling slots + queued image slots
            setPendingSlots(() => [
              ...slotAssignments.map(sa => ({
                slotId: sa.slotId,
                status: "loading" as const,
                prompt: sa.prompt,
                queueId: sa.queueId,
              })),
              ...nb2Slots,
              ...queuedImageSlots,
            ])

            // Start DB polling — guard in startPolling blocks double-polling by queueId
            for (const sa of slotAssignments) {
              startPolling(sa.slotId, sa.queueId, sa.prompt)
            }

            // Resume NB2/Kling polling — group slots by requestId (one FAL job = N images)
            const nb2Groups = new Map<string, PendingSlot[]>()
            nb2Slots.forEach(s => {
              const group = nb2Groups.get(s.nb2RequestId!) || []
              group.push(s)
              nb2Groups.set(s.nb2RequestId!, group)
            })
            nb2Groups.forEach((slots, requestId) => {
              // nb2Slots was already filtered to exclude done requestIds, so every slot here needs polling
              const first = slots[0]
              startNb2SlotPolling(requestId, first.nb2FalEndpoint!, slots.map(s => s.slotId), first.prompt, first.nb2OutputFormat || 'png', first.nb2AspectRatio || 'auto', first.nb2StatusUrl, first.nb2Quality, first.nb2TicketCost ?? 0, first.referenceImageUrls || [])
            })

            // Resume queue polling for still-queued image slots (the useEffect will pick these up
            // automatically when setPendingSlots fires, via startedQueuePolls deduplication)
          }
        }
      } catch { /* silent */ }
    }
    fetchUser()
  }, [])

  const handleUsePrompt = useCallback((text: string) => {
    if (scannerMode === "video") {
      setVideoPromptOverride((prev) => ({ text, version: prev.version + 1 }))
    } else {
      setPromptOverride((prev) => ({ text, version: prev.version + 1 }))
    }
  }, [scannerMode])

  const handleRescan = useCallback((img: ImageItem) => {
    // Restore model — 'nano-banana-2' is the legacy DB value for NanoBanana Pro 2
    const resolvedModelId = img.model === 'nano-banana-2' ? 'nano-banana-pro-2' : img.model
    const modelConfig = IMAGE_MODEL_CONFIGS.find((m) => m.apiId === resolvedModelId)
    if (modelConfig) setSelectedModel(modelConfig)
    // Switch to image mode
    setScannerMode("image")
    // Inject prompt
    setPromptOverride((prev) => ({ text: img.prompt, version: prev.version + 1 }))
    // Restore aspect ratio, quality, and other config
    setConfigOverride((prev) => ({
      aspectRatio: img.aspectRatio,
      quality: img.quality,
      version: prev.version + 1,
    }))
    // Always clear active refs first — rescan is a clean slate regardless of what's currently loaded
    setActiveRefIds([])
    // Load reference images from the generation and activate them
    if (img.referenceImageUrls && img.referenceImageUrls.length > 0) {
      const newItems: RefImage[] = img.referenceImageUrls.map((url) => ({
        id: `rescan-${Date.now()}-${Math.random()}`,
        url,
      }))
      const limit = modelConfig?.maxReferenceImages ?? 8
      setRefLibrary((prev) => [...prev, ...newItems].slice(0, 50))
      setActiveRefIds(newItems.slice(0, limit).map((i) => i.id))
    }
  }, [])

  const handleSelectImageModel = (name: string) => {
    const config = IMAGE_MODEL_CONFIGS.find((m) => m.name === name)
    if (config) { setSelectedModel(config); setScannerMode("image") }
  }

  const toggle = (key: string) => setOpenDropdown((prev) => (prev === key ? null : key))

  return (
    <div className="bg-[#050810] text-white min-h-screen">
      {/* Taskbar */}
      <div className="sticky top-0 z-40 bg-slate-950/90 backdrop-blur-md border-b border-white/5">

        {/* Mobile-only top row: branding + queue + tickets + profile + dashboard */}
        <div className="flex sm:hidden items-center justify-between px-3 h-9 border-b border-white/5">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center shrink-0">
              <Sparkles size={11} className="text-white/50" />
            </div>
            <div className="w-px h-3 bg-white/10" />
            <QueueDisplay active={activeJobCount} max={maxConcurrent} label="img" />
            <QueueDisplay active={videoActiveJobCount} max={videoMaxConcurrent} label="vid" />
          </div>
          <div className="flex items-center gap-1.5">
            <div className="flex items-center gap-1 px-2 py-1 rounded-md border border-cyan-500/20 bg-black font-mono text-[10px]" style={{ boxShadow: "0 0 8px rgba(0,255,255,0.06), inset 0 0 12px rgba(0,0,0,0.6)" }}>
              <Ticket size={10} className="text-cyan-500/70" />
              <span className="text-cyan-400 tabular-nums">{user ? user.ticketBalance.toLocaleString() : "---"}</span>
            </div>
            <ProfileBubble user={user} onSignOut={() => setUser(null)} />
            <Link
              href="/dashboard"
              className="flex items-center px-2 py-1 rounded-md border border-white/10 bg-white/5 text-[10px] text-slate-400 hover:border-white/20 hover:text-white transition-all"
            >
              Dashboard
            </Link>
          </div>
        </div>

        {/* Dropdown row + desktop-only right group */}
        <div className="flex items-center justify-between px-4 h-12">
          {/* Wordmark — desktop only */}
          <div className="hidden sm:flex items-center gap-2 shrink-0 mr-3">
            <div className="flex items-center gap-1.5">
              <div className="w-6 h-6 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center">
                <Sparkles size={12} className="text-white/50" />
              </div>
              <div className="flex flex-col leading-none">
                <span className="text-[11px] font-black tracking-tight text-white/90">AI Design Studio</span>
                <span className="text-[8px] font-mono text-white/20 tracking-widest uppercase">Prompt Protocol</span>
              </div>
            </div>
            <div className="w-px h-4 bg-white/8" />
          </div>
          <div className="flex items-center flex-1 min-w-0 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden mr-1">
            <TaskbarDropdown
              label="Image"
              icon={Image}
              items={IMAGE_MODEL_CONFIGS.map((m) => m.name)}
              open={openDropdown === "image"}
              onToggle={() => toggle("image")}
              onSelect={handleSelectImageModel}
              activeItem={selectedModel.name}
              itemCosts={IMAGE_MODEL_COST_BY_NAME}
            />
            <TaskbarDropdown
              label="Video"
              icon={Video}
              items={VIDEO_MODELS}
              open={openDropdown === "video"}
              onToggle={() => toggle("video")}
              onSelect={handleSelectVideoModel}
              activeItem={selectedVideoModel.name}
              itemCosts={VIDEO_MODEL_COST_BY_NAME}
            />
            <TextDropdown
              open={openDropdown === "text"}
              onToggle={() => toggle("text")}
              hasDevAccess={hasPromptStudioDev}
              imageModelName={selectedModel.name}
              onUsePrompt={handleUsePrompt}
              signedIn={user !== null}
            />
            <RefDropdown
              open={openDropdown === "refs"}
              onToggle={() => toggle("refs")}
              library={refLibrary}
              activeIds={activeRefIds}
              modelMaxRefs={selectedModel.maxReferenceImages}
              onUpload={handleLibraryUpload}
              onDelete={handleLibraryDelete}
              onDeleteMultiple={handleLibraryDeleteMultiple}
              onClearAll={handleLibraryClearAll}
              onActivate={handleActivateRef}
              onDeactivate={handleDeactivateRef}
              disabled={scannerMode === "video"}
              libraryLimit={hasPromptStudioDev ? 100 : 50}
            />
            <ShopDropdown
              open={openDropdown === "shop"}
              onToggle={() => toggle("shop")}
              user={user}
            />
            <SelectDropdown
              open={openDropdown === "select"}
              onToggle={() => toggle("select")}
              selectMode={selectMode}
              onToggleSelectMode={handleToggleSelectMode}
              selectedCount={selectedImageIds.size}
              onDownloadAll={handleBulkDownload}
              onDeleteAll={handleBulkDelete}
              downloading={bulkDownloading}
              deleting={bulkDeleting}
              downloadProgress={downloadProgress}
              downloadError={downloadError}
            />
            <NewsDropdown
              open={openDropdown === "news"}
              onToggle={() => toggle("news")}
            />
          </div>
          {/* Desktop-only right group */}
          <div className="hidden sm:flex items-center gap-2 shrink-0">
            <QueueDisplay active={activeJobCount} max={maxConcurrent} label="img" />
            <QueueDisplay active={videoActiveJobCount} max={videoMaxConcurrent} label="vid" />
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-md border border-cyan-500/20 bg-black font-mono text-xs" style={{ boxShadow: "0 0 8px rgba(0,255,255,0.06), inset 0 0 12px rgba(0,0,0,0.6)" }}>
              <Ticket size={11} className="text-cyan-500/70" />
              <span className="text-cyan-400 tabular-nums tracking-wider">
                {user ? user.ticketBalance.toLocaleString() : "---"}
              </span>
            </div>
            <ProfileBubble user={user} onSignOut={() => setUser(null)} />
            <Link
              href="/dashboard"
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-md border border-white/10 bg-white/5 text-[11px] text-slate-400 hover:border-white/20 hover:text-white transition-all"
            >
              Dashboard
            </Link>
          </div>
        </div>

      </div>

      {scannerMode === "image" ? (
        <>
          {/* Image grid */}
          <div className="pb-36">
            <ImageGrid
              key={imageGridKey}
              signedIn={user !== null}
              pendingSlots={pendingSlots}
              freshImages={freshImages}
              savedFails={savedFails}
              onImageClick={setSelectedImage}
              onPendingClick={setPendingDetail}
              selectMode={selectMode}
              selectedIds={selectedImageIds}
              onSelectToggle={handleSelectToggle}
            />
          </div>
          {/* Image prompt box */}
          <PromptBox
            model={selectedModel}
            onModelChange={setSelectedModel}
            userId={user?.id ?? null}
            onAddPending={handleAddPending}
            onUpdatePending={handleUpdatePending}
            onRemovePending={handleRemovePending}
            onPrependImage={handlePrependImage}
            onBalanceChange={handleBalanceChange}
            activeRefImages={activeRefImages}
            onDeactivateRef={handleDeactivateRef}
            onLoadPreset={handleLoadPreset}
            onUploadRef={handleUploadRef}
            onStartPolling={startPolling}
            onStartNb2Polling={startNb2SlotPolling}
            onDeductTickets={(amount) => {
              setUser(prev => prev ? { ...prev, ticketBalance: Math.max(0, prev.ticketBalance - amount) } : prev)
              fetch("/api/admin/use-tickets", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "deduct", amount }) }).catch(() => {})
            }}
            activeJobCount={activeJobCount}
            maxConcurrent={maxConcurrent}
            promptOverride={promptOverride}
            configOverride={configOverride}
          />
        </>
      ) : !user ? (
        /* Video — not signed in */
        <div className="flex flex-col items-center justify-center py-24 px-4">
          <div className="w-full max-w-sm text-center">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-cyan-500/20 to-fuchsia-500/20 border border-white/10 flex items-center justify-center mx-auto mb-5">
              <User size={28} className="text-slate-400" />
            </div>
            <h2 className="text-lg font-bold text-white mb-1">Sign in to get started</h2>
            <p className="text-sm text-slate-500 mb-6">Your generations and saved work will appear here.</p>
            <div className="flex flex-col gap-2">
              <Link href="/login" className="block">
                <button className="w-full py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-fuchsia-500 text-black text-sm font-bold hover:opacity-90 transition-opacity">
                  Sign In
                </button>
              </Link>
              <Link href="/signup" className="block">
                <button className="w-full py-2.5 rounded-xl border border-white/10 bg-white/5 text-slate-300 text-sm font-medium hover:bg-white/10 hover:text-white transition-all">
                  Create Account
                </button>
              </Link>
            </div>
          </div>
        </div>
      ) : (
        /* Video scanner — sidebar on desktop, drawer on mobile */
        <div style={{ height: "calc(100vh - 48px)" }} className="flex overflow-hidden relative">
          {/* Left: customization panel — desktop only */}
          <div className="hidden sm:block w-72 shrink-0 border-r border-white/5 overflow-y-auto pb-24">
            <VideoCustomizationPanel
              model={selectedVideoModel}
              duration={videoDuration}
              onDurationChange={setVideoDuration}
              aspectRatio={videoAspectRatio}
              onAspectRatioChange={setVideoAspectRatio}
              resolution={videoResolution}
              onResolutionChange={setVideoResolution}
              audioEnabled={videoAudioEnabled}
              onAudioToggle={setVideoAudioEnabled}
              audioFile={videoAudioFile}
              onAudioFileChange={handleVideoAudioSelect}
              startFramePreview={videoStartFramePreview}
              onStartFrameSelect={handleVideoStartFrameSelect}
              onClearStartFrame={() => { setVideoStartFramePreview(null); setVideoStartFrameUrl(null) }}
              endFramePreview={videoEndFramePreview}
              onEndFrameSelect={handleVideoEndFrameSelect}
              onClearEndFrame={() => { setVideoEndFramePreview(null); setVideoEndFrameUrl(null) }}
              startFrameUploading={videoStartFramePreview !== null && videoStartFrameUrl === null}
              endFrameUploading={videoEndFramePreview !== null && videoEndFrameUrl === null}
              audioUploading={videoAudioFile !== null && videoAudioUrl === null}
              motionVideoFilename={videoMotionVideoPreview}
              onMotionVideoSelect={handleVideoMotionVideoSelect}
              onClearMotionVideo={() => { setVideoMotionVideoPreview(null); setVideoMotionVideoUrl(null); setVideoMotionVideoDuration(null) }}
              motionVideoUploading={videoMotionVideoPreview !== null && videoMotionVideoUrl === null}
              motionVideoDuration={videoMotionVideoDuration}
              onMotionVideoDurationChange={setVideoMotionVideoDuration}
              characterOrientation={videoCharacterOrientation}
              onCharacterOrientationChange={v => setVideoCharacterOrientation(v as "image" | "video")}
              keepOriginalSound={videoKeepOriginalSound}
              onKeepOriginalSoundToggle={setVideoKeepOriginalSound}
              videoRefImagePreviews={videoRefImagePreviews}
              onAddRefImage={handleAddRefImage}
              onRemoveRefImage={handleRemoveRefImage}
              videoRefVideoFilenames={videoRefVideoFilenames}
              videoRefVideoUrls={videoRefVideoUrls}
              onAddRefVideo={handleAddRefVideo}
              onRemoveRefVideo={handleRemoveRefVideo}
              videoRefAudioFilenames={videoRefAudioFilenames}
              onAddRefAudio={handleAddRefAudio}
              onRemoveRefAudio={handleRemoveRefAudio}
              videoRefVideoDuration={videoRefVideoDuration}
              sd20Mode={videoSD20Mode}
              onSD20ModeChange={setVideoSD20Mode}
              lipsyncVideoFilename={videoLipsyncVideoFilename}
              lipsyncVideoUploading={videoLipsyncVideoFilename !== null && videoLipsyncVideoUrl === null}
              lipsyncVideoDuration={videoLipsyncVideoDuration}
              onLipsyncVideoSelect={handleLipsyncVideoSelect}
              onClearLipsyncVideo={() => { setVideoLipsyncVideoFilename(null); setVideoLipsyncVideoUrl(null); setVideoLipsyncVideoDuration(0); setVideoLipsyncAspectRatio(undefined) }}
              lipsyncAudioFilename={videoLipsyncAudioFilename}
              lipsyncAudioUploading={videoLipsyncAudioFilename !== null && videoLipsyncAudioUrl === null}
              onLipsyncAudioSelect={handleLipsyncAudioSelect}
              onClearLipsyncAudio={() => { setVideoLipsyncAudioFilename(null); setVideoLipsyncAudioUrl(null) }}
              lipsyncSyncMode={videoLipsyncSyncMode}
              onLipsyncSyncModeChange={setVideoLipsyncSyncMode}
            />
          </div>

          {/* Feed — full width on mobile, flex-1 on desktop */}
          <div className="flex-1 overflow-y-auto pb-24">
            <VideoFeed
              pendingSlots={videoPendingSlots}
              items={videoItems}
              savedFails={savedVideoFails}
              onVideoClick={setSelectedVideo}
              onPendingClick={setVideoPendingDetail}
              selectMode={selectMode}
              selectedIds={selectedImageIds}
              onSelectToggle={handleSelectToggle}
            />
          </div>

          {/* Video prompt bar — fixed at bottom */}
          <VideoPromptBar
            model={selectedVideoModel}
            onGenerate={handleVideoGenerate}
            generating={videoGenerating}
            canGenerate={!videoGenerating && (selectedVideoModel.supportsLipsync ? (!!videoLipsyncVideoUrl && !!videoLipsyncAudioUrl) : (selectedVideoModel.textToVideo || !!videoStartFrameUrl)) && (selectedVideoModel.id !== "kling-v3-motion" || !!videoMotionVideoUrl) && videoActiveJobCount < videoMaxConcurrent}
            queueFull={videoActiveJobCount >= videoMaxConcurrent && videoMaxConcurrent !== Infinity}
            duration={videoDuration}
            resolution={videoResolution}
            aspectRatio={videoAspectRatio}
            audioEnabled={videoAudioEnabled}
            onModelChange={applyVideoModel}
            promptOverride={videoPromptOverride}
            characterOrientation={videoCharacterOrientation}
            motionVideoDuration={videoMotionVideoDuration}
            onConfigOpen={() => setVideoConfigOpen(true)}
            startFramePreview={videoStartFramePreview}
            startFrameUploading={videoStartFramePreview !== null && videoStartFrameUrl === null}
            onStartFrameSelect={handleVideoStartFrameSelect}
            motionVideoFilename={videoMotionVideoPreview}
            motionVideoUploading={videoMotionVideoPreview !== null && videoMotionVideoUrl === null}
            onMotionVideoSelect={handleVideoMotionVideoSelect}
            onMotionVideoDurationChange={setVideoMotionVideoDuration}
            motionPromptText={videoMotionPromptText}
            lipsyncVideoDuration={videoLipsyncVideoDuration}
          />

          {/* Mobile: Config bottom drawer */}
          {videoConfigOpen && (
            <div className="sm:hidden fixed inset-0 z-[9990] flex flex-col justify-end">
              {/* Backdrop */}
              <div className="flex-1 bg-black/60 backdrop-blur-sm" onClick={() => setVideoConfigOpen(false)} />
              {/* Drawer */}
              <div className="bg-[#050810] border-t border-white/10 rounded-t-2xl max-h-[85vh] overflow-y-auto">
                {/* Drag handle + header */}
                <div className="sticky top-0 z-10 bg-[#050810] border-b border-white/5 px-4 py-3 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <SlidersHorizontal size={14} className="text-orange-400" />
                    <span className="text-sm font-bold text-white">Video Configuration</span>
                  </div>
                  <button
                    onClick={() => setVideoConfigOpen(false)}
                    className="w-7 h-7 flex items-center justify-center rounded-lg bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition-all"
                  >
                    <X size={14} />
                  </button>
                </div>
                {/* Motion Control: optional prompt at top of drawer */}
                {selectedVideoModel.id === "kling-v3-motion" && (
                  <div className="px-4 pt-4 pb-3 border-b border-white/5">
                    <p className="text-[10px] font-mono text-slate-500 uppercase tracking-widest mb-2">
                      Prompt <span className="normal-case text-slate-700 font-normal">(optional)</span>
                    </p>
                    <textarea
                      value={videoMotionPromptText}
                      onChange={e => setVideoMotionPromptText(e.target.value)}
                      placeholder="Describe additional motion details..."
                      rows={2}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white placeholder-slate-600 resize-none focus:outline-none focus:border-orange-500/40 transition-all"
                    />
                  </div>
                )}
                {/* Config panel */}
                <VideoCustomizationPanel
                  model={selectedVideoModel}
                  duration={videoDuration}
                  onDurationChange={setVideoDuration}
                  aspectRatio={videoAspectRatio}
                  onAspectRatioChange={setVideoAspectRatio}
                  resolution={videoResolution}
                  onResolutionChange={setVideoResolution}
                  audioEnabled={videoAudioEnabled}
                  onAudioToggle={setVideoAudioEnabled}
                  audioFile={videoAudioFile}
                  onAudioFileChange={handleVideoAudioSelect}
                  startFramePreview={videoStartFramePreview}
                  onStartFrameSelect={handleVideoStartFrameSelect}
                  onClearStartFrame={() => { setVideoStartFramePreview(null); setVideoStartFrameUrl(null) }}
                  endFramePreview={videoEndFramePreview}
                  onEndFrameSelect={handleVideoEndFrameSelect}
                  onClearEndFrame={() => { setVideoEndFramePreview(null); setVideoEndFrameUrl(null) }}
                  startFrameUploading={videoStartFramePreview !== null && videoStartFrameUrl === null}
                  endFrameUploading={videoEndFramePreview !== null && videoEndFrameUrl === null}
                  audioUploading={videoAudioFile !== null && videoAudioUrl === null}
                  motionVideoFilename={videoMotionVideoPreview}
                  onMotionVideoSelect={handleVideoMotionVideoSelect}
                  onClearMotionVideo={() => { setVideoMotionVideoPreview(null); setVideoMotionVideoUrl(null); setVideoMotionVideoDuration(null) }}
                  motionVideoUploading={videoMotionVideoPreview !== null && videoMotionVideoUrl === null}
                  motionVideoDuration={videoMotionVideoDuration}
                  onMotionVideoDurationChange={setVideoMotionVideoDuration}
                  characterOrientation={videoCharacterOrientation}
                  onCharacterOrientationChange={v => setVideoCharacterOrientation(v as "image" | "video")}
                  keepOriginalSound={videoKeepOriginalSound}
                  onKeepOriginalSoundToggle={setVideoKeepOriginalSound}
                  videoRefImagePreviews={videoRefImagePreviews}
                  onAddRefImage={handleAddRefImage}
                  onRemoveRefImage={handleRemoveRefImage}
                  videoRefVideoFilenames={videoRefVideoFilenames}
                  videoRefVideoUrls={videoRefVideoUrls}
                  onAddRefVideo={handleAddRefVideo}
                  onRemoveRefVideo={handleRemoveRefVideo}
                  videoRefAudioFilenames={videoRefAudioFilenames}
                  onAddRefAudio={handleAddRefAudio}
                  onRemoveRefAudio={handleRemoveRefAudio}
                  videoRefVideoDuration={videoRefVideoDuration}
                  sd20Mode={videoSD20Mode}
                  onSD20ModeChange={setVideoSD20Mode}
                  lipsyncVideoFilename={videoLipsyncVideoFilename}
                  lipsyncVideoUploading={videoLipsyncVideoFilename !== null && videoLipsyncVideoUrl === null}
                  lipsyncVideoDuration={videoLipsyncVideoDuration}
                  onLipsyncVideoSelect={handleLipsyncVideoSelect}
                  onClearLipsyncVideo={() => { setVideoLipsyncVideoFilename(null); setVideoLipsyncVideoUrl(null); setVideoLipsyncVideoDuration(0); setVideoLipsyncAspectRatio(undefined) }}
                  lipsyncAudioFilename={videoLipsyncAudioFilename}
                  lipsyncAudioUploading={videoLipsyncAudioFilename !== null && videoLipsyncAudioUrl === null}
                  onLipsyncAudioSelect={handleLipsyncAudioSelect}
                  onClearLipsyncAudio={() => { setVideoLipsyncAudioFilename(null); setVideoLipsyncAudioUrl(null) }}
                  lipsyncSyncMode={videoLipsyncSyncMode}
                  onLipsyncSyncModeChange={setVideoLipsyncSyncMode}
                />
                {/* Extra bottom padding for safe area */}
                <div className="h-6" />
              </div>
            </div>
          )}
        </div>
      )}

      {/* Image detail modal */}
      {selectedImage && (
        <ImageDetailModal
          image={selectedImage}
          onClose={() => setSelectedImage(null)}
          onRescan={handleRescan}
          onUsePrompt={(text) => { handleUsePrompt(text); setSelectedImage(null) }}
          onAddRef={(url) => {
            const item: RefImage = { id: `ref-${Date.now()}-${Math.random()}`, url }
            handleUploadRef([item])
          }}
        />
      )}

      {/* Video detail modal */}
      {selectedVideo && (
        <VideoDetailModal
          video={selectedVideo}
          onClose={() => setSelectedVideo(null)}
          onRescan={(vid) => {
            setScannerMode("video")
            setVideoPromptOverride(prev => ({ text: vid.prompt, version: prev.version + 1 }))
            // Restore video model
            const vModel = VIDEO_MODEL_CONFIGS.find(m => m.id === vid.model)
            if (vModel) setSelectedVideoModel(vModel)
            // Restore video config
            if (vid.duration) setVideoDuration(vid.duration)
            if (vid.resolution) setVideoResolution(vid.resolution)
            if (vid.aspectRatio) setVideoAspectRatio(vid.aspectRatio)
            if (vid.audioEnabled !== undefined) setVideoAudioEnabled(vid.audioEnabled)
            if (vid.keepOriginalSound !== undefined) setVideoKeepOriginalSound(vid.keepOriginalSound)
            if (vid.characterOrientation) setVideoCharacterOrientation(vid.characterOrientation)
            // Restore reference frames (set preview + URL so the UI shows them loaded)
            if (vid.startFrameUrl) { setVideoStartFramePreview(vid.startFrameUrl); setVideoStartFrameUrl(vid.startFrameUrl) }
            if (vid.endFrameUrl) { setVideoEndFramePreview(vid.endFrameUrl); setVideoEndFrameUrl(vid.endFrameUrl) }
            if (vid.motionVideoUrl) { setVideoMotionVideoPreview(vid.motionVideoUrl); setVideoMotionVideoUrl(vid.motionVideoUrl) }
          }}
          onUsePrompt={(text) => { handleUsePrompt(text); setSelectedVideo(null) }}
        />
      )}

      {/* Pending image detail modal */}
      {pendingDetail && (
        <PendingDetailModal
          prompt={pendingDetail.prompt}
          model={pendingDetail.modelId || ""}
          quality={pendingDetail.quality}
          aspectRatio={pendingDetail.aspectRatio}
          referenceImageUrls={pendingDetail.referenceImageUrls}
          isQueued={!!(pendingDetail.queueJobId && !pendingDetail.nb2RequestId)}
          onClose={() => setPendingDetail(null)}
          onUsePrompt={(text) => { handleUsePrompt(text); setPendingDetail(null) }}
        />
      )}

      {/* Pending video detail modal */}
      {videoPendingDetail && (
        <PendingDetailModal
          prompt={videoPendingDetail.prompt}
          model={videoPendingDetail.model}
          aspectRatio={videoPendingDetail.aspectRatio}
          isVideoSlot={true}
          startFrameUrl={videoPendingDetail.startFrameUrl}
          endFrameUrl={videoPendingDetail.endFrameUrl}
          isQueued={!!(videoPendingDetail.queueJobId && !videoPendingDetail.requestId)}
          onClose={() => setVideoPendingDetail(null)}
          onUsePrompt={(text) => { handleUsePrompt(text); setVideoPendingDetail(null) }}
        />
      )}
      <ChatWidget sideTabOnly={scannerMode === "video"} />
    </div>
  )
}
