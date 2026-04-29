"use client"

import { useState, useEffect, useRef, useCallback, memo } from "react"
import {
  Brain, Zap, Download, RefreshCw, Play, CheckCircle, XCircle,
  Clock, ArrowLeft, Image as ImageIcon, FolderOpen, BookMarked,
  Loader2, ChevronDown, Sparkles,
} from "lucide-react"
import Link from "next/link"

// ─── Types ────────────────────────────────────────────────────────────────────

interface TrainingImage {
  id: number
  imageUrl: string
  adminCaption: string | null
  adminTags: string[]
}

interface Bucket {
  id: number
  name: string
  description: string | null
  color: string | null
  count: number
}

interface LoraJob {
  id: number
  requestId: string | null
  name: string
  modelId: string
  status: string
  config: Record<string, unknown>
  imageCount: number
  loraUrl: string | null
  configUrl: string | null
  errorMsg: string | null
  createdAt: string
  updatedAt: string
}

interface ConfigField {
  key: string
  label: string
  type: 'number' | 'float' | 'text' | 'select'
  min?: number
  max?: number
  step?: number
  placeholder?: string
  options?: string[]
}

interface ModelDef {
  id: string
  name: string
  tag: string
  color: string
  description: string
  estimatedTime: string
  defaultConfig: Record<string, unknown>
  configFields: ConfigField[]
}

// ─── Model definitions ────────────────────────────────────────────────────────

const TRAINING_MODELS: ModelDef[] = [
  {
    id: 'fal-ai/flux-2-trainer',
    name: 'FLUX 2 Dev',
    tag: 'flux2',
    color: 'cyan',
    description: 'Highest quality FLUX 2 Dev LoRA',
    estimatedTime: '20-40 min',
    defaultConfig: {
      steps: 1000,
      learning_rate: 0.00005,
      default_caption: '',
      output_lora_format: 'fal',
    },
    configFields: [
      { key: 'steps',             label: 'Steps',           type: 'number', min: 100,      max: 4000,  step: 100 },
      { key: 'learning_rate',     label: 'Learning Rate',   type: 'float',  min: 0.000001, max: 0.001, step: 0.000001 },
      { key: 'default_caption',   label: 'Default Caption', type: 'text',   placeholder: 'Fallback caption for uncaptioned images' },
      { key: 'output_lora_format',label: 'Output Format',   type: 'select', options: ['fal', 'comfy'] },
    ],
  },
  {
    id: 'fal-ai/flux-lora-fast-training',
    name: 'FLUX 1 Fast',
    tag: 'flux1fast',
    color: 'violet',
    description: 'Faster FLUX 1 Dev LoRA with trigger word',
    estimatedTime: '10-20 min',
    defaultConfig: {
      steps: 1000,
      learning_rate: 0.00004,
      trigger_word: 'TOK',
    },
    configFields: [
      { key: 'steps',         label: 'Steps',         type: 'number', min: 100,      max: 4000,  step: 100 },
      { key: 'learning_rate', label: 'Learning Rate', type: 'float',  min: 0.000001, max: 0.001, step: 0.000001 },
      { key: 'trigger_word',  label: 'Trigger Word',  type: 'text',   placeholder: 'e.g. TOK, MYCHAR' },
    ],
  },
  {
    id: 'fal-ai/z-image-turbo-trainer-v2',
    name: 'Z-Image Turbo v2',
    tag: 'zturbo',
    color: 'amber',
    description: 'Fast turbo LoRA trainer with default caption support',
    estimatedTime: '5-15 min',
    defaultConfig: {
      steps: 2000,
      learning_rate: 0.0005,
      default_caption: '',
    },
    configFields: [
      { key: 'steps',           label: 'Steps',           type: 'number', min: 100,      max: 10000, step: 100 },
      { key: 'learning_rate',   label: 'Learning Rate',   type: 'float',  min: 0.000001, max: 0.01,  step: 0.0001 },
      { key: 'default_caption', label: 'Default Caption', type: 'text',   placeholder: 'Fallback caption for uncaptioned images' },
    ],
  },
]

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getAdminPassword(): string {
  try { return sessionStorage.getItem("admin-password") ?? "" } catch { return "" }
}
function authHeaders(): Record<string, string> {
  const p = getAdminPassword()
  return p ? { "x-admin-password": p } : {}
}

// ─── FilterSelect ─────────────────────────────────────────────────────────────

const FilterSelect = memo(function FilterSelect({
  value, onChange, options,
}: {
  value: string
  onChange: (v: string) => void
  options: { value: string; label: string }[]
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const selected = options.find(o => o.value === value) ?? options[0]

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [])

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(v => !v)}
        className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-white/[0.05] border border-white/[0.08] text-sm text-slate-300 hover:text-white hover:border-white/20 transition-all whitespace-nowrap w-full justify-between"
      >
        <span>{selected?.label ?? 'Select…'}</span>
        <ChevronDown size={12} className={`text-slate-600 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="absolute top-full left-0 mt-1 z-50 min-w-full rounded-xl bg-[#131320] border border-white/[0.1] shadow-2xl overflow-hidden py-1">
          {options.map(opt => (
            <button
              key={opt.value}
              onClick={() => { onChange(opt.value); setOpen(false) }}
              className={`w-full text-left px-3 py-2 text-sm transition-colors whitespace-nowrap
                ${opt.value === value ? "text-cyan-300 bg-cyan-500/10" : "text-slate-400 hover:text-white hover:bg-white/[0.06]"}`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
})

// ─── Status badge ─────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  if (status === 'preparing') {
    return (
      <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium bg-slate-500/10 text-slate-400 border border-slate-500/20">
        <Loader2 size={11} className="animate-spin" />
        Preparing
      </span>
    )
  }
  if (status === 'queued') {
    return (
      <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium bg-yellow-500/10 text-yellow-400 border border-yellow-500/20">
        <span className="w-1.5 h-1.5 rounded-full bg-yellow-400 animate-pulse" />
        Queued
      </span>
    )
  }
  if (status === 'in_progress') {
    return (
      <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
        <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
        Training
      </span>
    )
  }
  if (status === 'completed') {
    return (
      <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
        <CheckCircle size={11} />
        Completed
      </span>
    )
  }
  if (status === 'failed') {
    return (
      <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium bg-red-500/10 text-red-400 border border-red-500/20">
        <XCircle size={11} />
        Failed
      </span>
    )
  }
  return (
    <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium bg-white/[0.05] text-slate-500 border border-white/[0.06]">
      {status}
    </span>
  )
}

// ─── Config field renderer ────────────────────────────────────────────────────

function ConfigFieldInput({
  field, value, onChange,
}: {
  field: ConfigField
  value: unknown
  onChange: (key: string, val: unknown) => void
}) {
  if (field.type === 'select' && field.options) {
    return (
      <div>
        <label className="block text-xs text-slate-500 mb-1.5">{field.label}</label>
        <FilterSelect
          value={String(value ?? field.options[0])}
          onChange={v => onChange(field.key, v)}
          options={field.options.map(o => ({ value: o, label: o }))}
        />
      </div>
    )
  }

  if (field.type === 'number' || field.type === 'float') {
    return (
      <div>
        <label className="block text-xs text-slate-500 mb-1.5">{field.label}</label>
        <input
          type="number"
          value={String(value ?? '')}
          min={field.min}
          max={field.max}
          step={field.step}
          onChange={e => {
            const v = field.type === 'float' ? parseFloat(e.target.value) : parseInt(e.target.value, 10)
            onChange(field.key, isNaN(v) ? value : v)
          }}
          className="w-full px-3 py-2 rounded-lg bg-white/[0.05] border border-white/[0.08] text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-cyan-500/50 focus:bg-white/[0.07] transition-all"
        />
      </div>
    )
  }

  return (
    <div>
      <label className="block text-xs text-slate-500 mb-1.5">{field.label}</label>
      <input
        type="text"
        value={String(value ?? '')}
        placeholder={field.placeholder}
        onChange={e => onChange(field.key, e.target.value)}
        className="w-full px-3 py-2 rounded-lg bg-white/[0.05] border border-white/[0.08] text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-cyan-500/50 focus:bg-white/[0.07] transition-all"
      />
    </div>
  )
}

// ─── Model card ───────────────────────────────────────────────────────────────

const accentClasses: Record<string, { ring: string; bg: string; text: string; border: string }> = {
  cyan:   { ring: 'ring-cyan-500/40',   bg: 'bg-cyan-500/10',   text: 'text-cyan-400',   border: 'border-cyan-500/30' },
  violet: { ring: 'ring-violet-500/40', bg: 'bg-violet-500/10', text: 'text-violet-400', border: 'border-violet-500/30' },
  amber:  { ring: 'ring-amber-500/40',  bg: 'bg-amber-500/10',  text: 'text-amber-400',  border: 'border-amber-500/30' },
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function LoraTrainingPage() {
  const [authed, setAuthed]         = useState<boolean | null>(null)
  const [selectedModel, setSelected] = useState<ModelDef>(TRAINING_MODELS[0])
  const [config, setConfig]         = useState<Record<string, unknown>>({ ...TRAINING_MODELS[0].defaultConfig })
  const [jobName, setJobName]       = useState("")

  // Data source
  const [dataSource, setDataSource] = useState<'marked' | 'bucket'>('marked')
  const [buckets, setBuckets]       = useState<Bucket[]>([])
  const [selectedBucket, setSelectedBucket] = useState<string>("")

  // Images
  const [images, setImages]         = useState<TrainingImage[]>([])
  const [loadingImages, setLoadingImages] = useState(false)
  const [imageError, setImageError] = useState<string | null>(null)

  // Jobs
  const [jobs, setJobs]             = useState<LoraJob[]>([])
  const [loadingJobs, setLoadingJobs] = useState(false)

  // Training
  const [starting, setStarting]     = useState(false)
  const [startError, setStartError] = useState<string | null>(null)
  const [startSuccess, setStartSuccess] = useState<string | null>(null)

  // Polling
  const pollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // ── Auth check ──────────────────────────────────────────────────────────────
  useEffect(() => {
    const pw = getAdminPassword()
    if (!pw) { setAuthed(false); return }
    fetch('/api/admin/config', { headers: { 'x-admin-password': pw } })
      .then(r => { setAuthed(r.ok) })
      .catch(() => setAuthed(false))
  }, [])

  // ── Load buckets ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!authed) return
    fetch('/api/admin/buckets', { headers: authHeaders() })
      .then(r => r.json())
      .then((data: Bucket[]) => {
        setBuckets(data)
        if (data.length > 0 && !selectedBucket) setSelectedBucket(String(data[0].id))
      })
      .catch(console.error)
  }, [authed]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Load jobs ────────────────────────────────────────────────────────────────
  const loadJobs = useCallback(async () => {
    setLoadingJobs(true)
    try {
      const r = await fetch('/api/admin/lora-training/jobs', { headers: authHeaders() })
      const data = await r.json() as { jobs: LoraJob[] }
      setJobs(data.jobs ?? [])
    } catch (e) {
      console.error('[lora-training] load jobs error:', e)
    } finally {
      setLoadingJobs(false)
    }
  }, [])

  useEffect(() => {
    if (authed) loadJobs()
  }, [authed, loadJobs])

  // ── Auto-poll active jobs ─────────────────────────────────────────────────
  const pollActiveJobs = useCallback(async () => {
    const active = jobs.filter(j => ['preparing', 'queued', 'in_progress'].includes(j.status))
    if (active.length === 0) return

    await Promise.all(
      active.map(async job => {
        try {
          const r = await fetch(`/api/admin/lora-training/status?jobId=${job.id}`, {
            headers: authHeaders(),
          })
          const data = await r.json() as { job?: LoraJob }
          if (data.job) {
            setJobs(prev => prev.map(j => j.id === data.job!.id ? data.job! : j))
          }
        } catch {
          // silent
        }
      })
    )
  }, [jobs])

  useEffect(() => {
    const active = jobs.filter(j => ['preparing', 'queued', 'in_progress'].includes(j.status))
    if (active.length === 0) return

    pollTimerRef.current = setTimeout(async () => {
      await pollActiveJobs()
    }, 10_000)

    return () => {
      if (pollTimerRef.current) clearTimeout(pollTimerRef.current)
    }
  }, [jobs, pollActiveJobs])

  // ── Model switch ─────────────────────────────────────────────────────────────
  function switchModel(m: ModelDef) {
    setSelected(m)
    setConfig({ ...m.defaultConfig })
  }

  function updateConfig(key: string, val: unknown) {
    setConfig(prev => ({ ...prev, [key]: val }))
  }

  // ── Load images ───────────────────────────────────────────────────────────────
  async function loadImages() {
    setLoadingImages(true)
    setImageError(null)
    setImages([])

    try {
      let url = '/api/admin/dataset?all=true&'
      if (dataSource === 'marked') {
        url += 'markedOnly=true'
      } else {
        if (!selectedBucket) { setImageError('Select a bucket first'); setLoadingImages(false); return }
        url += `bucketId=${selectedBucket}`
      }

      const r = await fetch(url, { headers: authHeaders() })
      if (!r.ok) throw new Error(`HTTP ${r.status}`)
      const data = await r.json() as { images: TrainingImage[] }
      setImages(data.images ?? [])
    } catch (e) {
      setImageError(e instanceof Error ? e.message : 'Failed to load images')
    } finally {
      setLoadingImages(false)
    }
  }

  // ── Start training ────────────────────────────────────────────────────────────
  async function startTraining() {
    if (images.length === 0) return
    if (!jobName.trim()) { setStartError('Job name is required'); return }

    setStarting(true)
    setStartError(null)
    setStartSuccess(null)

    try {
      const r = await fetch('/api/admin/lora-training/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({
          imageIds: images.map(i => i.id),
          modelId: selectedModel.id,
          config,
          name: jobName.trim(),
        }),
      })

      const data = await r.json() as { jobId?: number; error?: string }

      if (!r.ok) throw new Error(data.error ?? `HTTP ${r.status}`)

      setStartSuccess(`Job #${data.jobId} is preparing — building zip & uploading to FAL in background`)
      setJobName("")
      // Reload jobs
      await loadJobs()
    } catch (e) {
      setStartError(e instanceof Error ? e.message : 'Failed to start training')
    } finally {
      setStarting(false)
    }
  }

  // ── Retry prepare for stuck jobs ──────────────────────────────────────────
  async function retryPrepare(jobId: number) {
    try {
      await fetch('/api/admin/lora-training/prepare', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ jobId }),
      })
      await loadJobs()
    } catch (e) {
      console.error('[lora-training] retry prepare error:', e)
    }
  }

  // ── Check single job status ────────────────────────────────────────────────
  async function checkJobStatus(jobId: number) {
    try {
      const r = await fetch(`/api/admin/lora-training/status?jobId=${jobId}`, {
        headers: authHeaders(),
      })
      const data = await r.json() as { job?: LoraJob; error?: string }
      if (data.job) {
        setJobs(prev => prev.map(j => j.id === data.job!.id ? data.job! : j))
      }
    } catch (e) {
      console.error('[lora-training] check status error:', e)
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  if (authed === null) {
    return (
      <div className="min-h-screen bg-[#09090f] flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-cyan-400 animate-spin" />
      </div>
    )
  }

  if (authed === false) {
    return (
      <div className="min-h-screen bg-[#09090f] flex flex-col items-center justify-center gap-4">
        <XCircle className="w-12 h-12 text-red-500" />
        <p className="text-white text-lg font-medium">Admin access required</p>
        <Link href="/admin" className="text-cyan-400 hover:text-cyan-300 text-sm underline">
          Go to admin login
        </Link>
      </div>
    )
  }

  const accent = accentClasses[selectedModel.color] ?? accentClasses.cyan
  const hasImages = images.length > 0
  const tooFewImages = images.length > 0 && images.length < 10

  return (
    <div className="min-h-screen bg-[#09090f] text-white">
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-40 border-b border-white/[0.06] bg-[#09090f]/90 backdrop-blur-xl">
        <div className="max-w-[1400px] mx-auto px-4 h-14 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link
              href="/admin"
              className="flex items-center gap-1.5 text-slate-500 hover:text-slate-300 transition-colors text-sm"
            >
              <ArrowLeft size={15} />
              <span>Back</span>
            </Link>
            <span className="text-white/10">|</span>
            <Brain size={18} className="text-cyan-400" />
            <h1 className="text-base font-semibold tracking-tight">LoRA Training</h1>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={loadJobs}
              disabled={loadingJobs}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-slate-400 hover:text-white bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.06] transition-all disabled:opacity-50"
            >
              <RefreshCw size={13} className={loadingJobs ? 'animate-spin' : ''} />
              Refresh
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-[1400px] mx-auto px-4 py-6 space-y-6">

        {/* ── Model Selector ─────────────────────────────────────────────── */}
        <div className="flex items-center gap-2 flex-wrap">
          {TRAINING_MODELS.map(m => {
            const ac = accentClasses[m.color] ?? accentClasses.cyan
            const active = selectedModel.id === m.id
            return (
              <button
                key={m.id}
                onClick={() => switchModel(m)}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium border transition-all
                  ${active
                    ? `${ac.bg} ${ac.text} ${ac.border} ring-1 ${ac.ring}`
                    : 'bg-white/[0.04] text-slate-400 border-white/[0.06] hover:bg-white/[0.07] hover:text-slate-300'}`}
              >
                <Sparkles size={14} />
                {m.name}
                <span className={`text-[10px] px-1.5 py-0.5 rounded-md ${active ? ac.bg : 'bg-white/[0.05]'} ${active ? ac.text : 'text-slate-600'}`}>
                  {m.estimatedTime}
                </span>
              </button>
            )
          })}
        </div>

        {/* ── Two-column layout ─────────────────────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-6">

          {/* ── LEFT: Data source ──────────────────────────────────────── */}
          <div className="space-y-5">
            <div className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-5 space-y-4">
              <div className="flex items-center gap-2">
                <ImageIcon size={16} className="text-slate-400" />
                <h2 className="text-sm font-semibold text-slate-200">Training Data</h2>
              </div>

              {/* Radio source selector */}
              <div className="flex items-center gap-3">
                <label className="flex items-center gap-2 cursor-pointer group">
                  <input
                    type="radio"
                    name="dataSource"
                    checked={dataSource === 'marked'}
                    onChange={() => { setDataSource('marked'); setImages([]); setImageError(null) }}
                    className="sr-only"
                  />
                  <span className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs border transition-all
                    ${dataSource === 'marked'
                      ? 'bg-cyan-500/10 text-cyan-300 border-cyan-500/30'
                      : 'bg-white/[0.04] text-slate-400 border-white/[0.06] group-hover:text-slate-300'}`}
                  >
                    <BookMarked size={12} />
                    Marked for Training
                  </span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer group">
                  <input
                    type="radio"
                    name="dataSource"
                    checked={dataSource === 'bucket'}
                    onChange={() => { setDataSource('bucket'); setImages([]); setImageError(null) }}
                    className="sr-only"
                  />
                  <span className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs border transition-all
                    ${dataSource === 'bucket'
                      ? 'bg-cyan-500/10 text-cyan-300 border-cyan-500/30'
                      : 'bg-white/[0.04] text-slate-400 border-white/[0.06] group-hover:text-slate-300'}`}
                  >
                    <FolderOpen size={12} />
                    From Bucket
                  </span>
                </label>
              </div>

              {/* Bucket picker */}
              {dataSource === 'bucket' && (
                <div className="space-y-1.5">
                  <label className="text-xs text-slate-500">Select Bucket</label>
                  {buckets.length === 0 ? (
                    <p className="text-xs text-slate-600 italic">No buckets found</p>
                  ) : (
                    <FilterSelect
                      value={selectedBucket}
                      onChange={v => { setSelectedBucket(v); setImages([]); setImageError(null) }}
                      options={buckets.map(b => ({ value: String(b.id), label: `${b.name} (${b.count})` }))}
                    />
                  )}
                </div>
              )}

              {/* Load button + count */}
              <div className="flex items-center gap-3">
                <button
                  onClick={loadImages}
                  disabled={loadingImages || (dataSource === 'bucket' && !selectedBucket)}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white/[0.06] hover:bg-white/[0.10] border border-white/[0.08] text-sm text-slate-300 hover:text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loadingImages ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
                  Load Images
                </button>

                {hasImages && (
                  <span className={`text-sm font-medium ${tooFewImages ? 'text-yellow-400' : 'text-emerald-400'}`}>
                    {images.length} images loaded
                  </span>
                )}
              </div>

              {/* Warnings */}
              {imageError && (
                <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
                  {imageError}
                </p>
              )}
              {tooFewImages && (
                <p className="text-xs text-yellow-400 bg-yellow-500/10 border border-yellow-500/20 rounded-lg px-3 py-2">
                  Warning: Training typically requires at least 10 images. You have {images.length}.
                </p>
              )}
              {hasImages && images.length < 5 && (
                <p className="text-xs text-orange-400 bg-orange-500/10 border border-orange-500/20 rounded-lg px-3 py-2">
                  Too few images ({images.length}). Please add at least 5 images before training.
                </p>
              )}

              {/* Preview grid */}
              {hasImages && (
                <div className="mt-2">
                  <p className="text-[11px] text-slate-600 mb-2">
                    Preview (first {Math.min(12, images.length)} of {images.length})
                  </p>
                  <div className="grid grid-cols-6 gap-1.5">
                    {images.slice(0, 12).map(img => (
                      <div
                        key={img.id}
                        className="aspect-square rounded-lg overflow-hidden bg-white/[0.04] border border-white/[0.06] relative group"
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={img.imageUrl}
                          alt={`img-${img.id}`}
                          className="w-full h-full object-cover"
                          onError={e => { (e.target as HTMLImageElement).style.display = 'none' }}
                        />
                        {img.adminCaption && (
                          <div className="absolute inset-0 bg-black/70 opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-1">
                            <p className="text-[9px] text-slate-300 line-clamp-3 leading-tight">{img.adminCaption}</p>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* ── RIGHT: Config panel ─────────────────────────────────────── */}
          <div className="space-y-4">
            <div className={`rounded-2xl border ${accent.border} bg-white/[0.02] p-5 space-y-4`}>
              {/* Model info */}
              <div className="flex items-start gap-3">
                <div className={`w-8 h-8 rounded-lg ${accent.bg} flex items-center justify-center shrink-0`}>
                  <Brain size={16} className={accent.text} />
                </div>
                <div>
                  <p className={`text-sm font-semibold ${accent.text}`}>{selectedModel.name}</p>
                  <p className="text-[11px] text-slate-500">{selectedModel.description}</p>
                </div>
              </div>

              <div className="border-t border-white/[0.05]" />

              {/* Job name */}
              <div>
                <label className="block text-xs text-slate-500 mb-1.5">Job Name *</label>
                <input
                  type="text"
                  value={jobName}
                  onChange={e => setJobName(e.target.value)}
                  placeholder="e.g. MyChar-v1-flux2"
                  className="w-full px-3 py-2 rounded-lg bg-white/[0.05] border border-white/[0.08] text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-cyan-500/50 focus:bg-white/[0.07] transition-all"
                />
              </div>

              {/* Config fields */}
              {selectedModel.configFields.map(field => (
                <ConfigFieldInput
                  key={field.key}
                  field={field}
                  value={config[field.key]}
                  onChange={updateConfig}
                />
              ))}

              <div className="border-t border-white/[0.05]" />

              {/* Image count + time estimate */}
              <div className="flex items-center justify-between text-xs text-slate-500">
                <div className="flex items-center gap-1.5">
                  <ImageIcon size={12} />
                  <span>{hasImages ? `${images.length} images` : 'No images loaded'}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Clock size={12} />
                  <span>~{selectedModel.estimatedTime}</span>
                </div>
              </div>

              {/* Start button */}
              <button
                onClick={startTraining}
                disabled={starting || !hasImages || images.length < 5 || !jobName.trim()}
                className={`w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all
                  ${(!hasImages || images.length < 5 || !jobName.trim())
                    ? 'bg-white/[0.05] text-slate-600 cursor-not-allowed border border-white/[0.06]'
                    : `${accent.bg} ${accent.text} ${accent.border} border hover:opacity-90 ring-1 ${accent.ring}`}`}
              >
                {starting ? <Loader2 size={15} className="animate-spin" /> : <Play size={15} />}
                {starting ? 'Starting…' : 'Start Training'}
              </button>

              {/* Feedback */}
              {startError && (
                <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
                  {startError}
                </p>
              )}
              {startSuccess && (
                <p className="text-xs text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded-lg px-3 py-2">
                  {startSuccess}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* ── Jobs history ─────────────────────────────────────────────── */}
        <div className="rounded-2xl border border-white/[0.07] bg-white/[0.02] overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3 border-b border-white/[0.06]">
            <div className="flex items-center gap-2">
              <Zap size={15} className="text-slate-400" />
              <h2 className="text-sm font-semibold text-slate-200">Training Jobs</h2>
              {jobs.length > 0 && (
                <span className="text-xs text-slate-600 bg-white/[0.05] px-2 py-0.5 rounded-full border border-white/[0.06]">
                  {jobs.length}
                </span>
              )}
            </div>
            <button
              onClick={loadJobs}
              disabled={loadingJobs}
              className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-300 transition-colors disabled:opacity-50"
            >
              <RefreshCw size={12} className={loadingJobs ? 'animate-spin' : ''} />
              Refresh
            </button>
          </div>

          {loadingJobs && jobs.length === 0 ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 text-slate-600 animate-spin" />
            </div>
          ) : jobs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 gap-3 text-slate-600">
              <Brain size={32} className="opacity-30" />
              <p className="text-sm">No training jobs yet</p>
            </div>
          ) : (
            <div className="divide-y divide-white/[0.04]">
              {jobs.map(job => {
                const model = TRAINING_MODELS.find(m => m.id === job.modelId)
                const ac = model ? (accentClasses[model.color] ?? accentClasses.cyan) : accentClasses.cyan
                const isActive = job.status === 'queued' || job.status === 'in_progress'
                const isPreparing = job.status === 'preparing'
                return (
                  <div key={job.id} className="px-5 py-3.5 hover:bg-white/[0.02] transition-colors">
                    <div className="flex items-start gap-4 flex-wrap">
                      {/* Left info */}
                      <div className="flex-1 min-w-0 space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-medium text-white truncate">{job.name}</span>
                          <span className={`text-[10px] px-2 py-0.5 rounded-full ${ac.bg} ${ac.text} border ${ac.border}`}>
                            {model?.name ?? job.modelId}
                          </span>
                        </div>
                        <div className="flex items-center gap-3 text-[11px] text-slate-500 flex-wrap">
                          <span className="flex items-center gap-1">
                            <ImageIcon size={10} />
                            {job.imageCount} images
                          </span>
                          <span className="flex items-center gap-1">
                            <Clock size={10} />
                            {new Date(job.createdAt).toLocaleString()}
                          </span>
                          {job.requestId && (
                            <span className="font-mono text-slate-600 truncate max-w-[180px]">
                              {job.requestId}
                            </span>
                          )}
                        </div>
                        {job.errorMsg && (
                          <p className="text-[11px] text-red-400">{job.errorMsg}</p>
                        )}
                      </div>

                      {/* Right: status + actions */}
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <StatusBadge status={job.status} />

                        {isPreparing && (
                          <button
                            onClick={() => retryPrepare(job.id)}
                            className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/20 text-[11px] text-amber-400 hover:text-amber-300 transition-all"
                          >
                            <Play size={11} />
                            Retry
                          </button>
                        )}

                        {isActive && (
                          <button
                            onClick={() => checkJobStatus(job.id)}
                            className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white/[0.05] hover:bg-white/[0.09] border border-white/[0.07] text-[11px] text-slate-400 hover:text-slate-200 transition-all"
                          >
                            <RefreshCw size={11} />
                            Check
                          </button>
                        )}

                        {job.loraUrl && (
                          <a
                            href={job.loraUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20 text-[11px] text-emerald-400 transition-all"
                          >
                            <Download size={11} />
                            LoRA
                          </a>
                        )}

                        {job.configUrl && (
                          <a
                            href={job.configUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white/[0.05] hover:bg-white/[0.09] border border-white/[0.07] text-[11px] text-slate-400 hover:text-slate-200 transition-all"
                          >
                            <Download size={11} />
                            Config
                          </a>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

      </div>
    </div>
  )
}
