"use client"

import { useState, useEffect, useCallback, useRef, useMemo, memo, useDeferredValue } from "react"
import {
  Database, Download, ChevronLeft, ChevronRight, Search,
  Loader2, ImageIcon, Star, BookMarked, CheckSquare, Square, X,
  ArrowLeft, RefreshCw, SlidersHorizontal, Sparkles, Tag, MessageSquare,
  Plus, Hash, ChevronDown, MousePointer2, Copy, ExternalLink,
  User, Calendar, Cpu, Layers, Clock, Fingerprint, Film, Video,
  FolderOpen, FolderPlus, Pencil, Trash2, MoreHorizontal,
  UploadCloud, FileImage, HardDrive, Ruler
} from "lucide-react"

const UPLOADS_BUCKET_NAME = '__uploads__'

// ─── Custom dropdowns ─────────────────────────────────────────────────────────

const FilterSelect = memo(function FilterSelect({ value, onChange, options }: {
  value: string
  onChange: (v: string) => void
  options: { value: string; label: string }[]
}) {
  const [open, setOpen] = useState(false)
  const ref             = useRef<HTMLDivElement>(null)
  const selected        = options.find(o => o.value === value) ?? options[0]

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
        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white/[0.05] border border-white/[0.08] text-xs text-slate-300 hover:text-white hover:border-white/20 transition-all whitespace-nowrap"
      >
        {selected.label}
        <ChevronDown size={10} className={`text-slate-600 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="absolute top-full left-0 mt-1 z-50 min-w-full rounded-xl bg-[#131320] border border-white/[0.1] shadow-2xl overflow-hidden py-1">
          {options.map(opt => (
            <button key={opt.value} onClick={() => { onChange(opt.value); setOpen(false) }}
              className={`w-full text-left px-3 py-1.5 text-xs transition-colors whitespace-nowrap
                ${opt.value === value ? "text-cyan-300 bg-cyan-500/10" : "text-slate-400 hover:text-white hover:bg-white/[0.06]"}`}>
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
})

// Multi-select dropdown — allows picking multiple options simultaneously
const MultiFilterSelect = memo(function MultiFilterSelect({ values, onChange, options, placeholder, searchable = false }: {
  values:       string[]
  onChange:     (v: string[]) => void
  options:      { value: string; label: string }[]
  placeholder:  string
  searchable?:  boolean
}) {
  const [open,   setOpen]   = useState(false)
  const [query,  setQuery]  = useState("")
  const ref                 = useRef<HTMLDivElement>(null)
  const searchRef           = useRef<HTMLInputElement>(null)

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) { setOpen(false); setQuery("") }
    }
    document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [])

  useEffect(() => {
    if (open && searchable) setTimeout(() => searchRef.current?.focus(), 50)
  }, [open, searchable])

  function toggle(v: string) {
    onChange(values.includes(v) ? values.filter(x => x !== v) : [...values, v])
  }

  const active   = values.length > 0
  const filtered = searchable && query
    ? options.filter(o => o.label.toLowerCase().includes(query.toLowerCase()))
    : options

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(v => !v)}
        className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs transition-all whitespace-nowrap
          ${active
            ? "bg-cyan-500/10 border-cyan-500/30 text-cyan-300"
            : "bg-white/[0.05] border-white/[0.08] text-slate-300 hover:text-white hover:border-white/20"}`}
      >
        {active ? `${placeholder.split(':')[0]}: ${values.length}` : placeholder}
        {active && (
          <span
            onClick={e => { e.stopPropagation(); onChange([]) }}
            className="ml-0.5 text-cyan-500 hover:text-white cursor-pointer"
            title="Clear"
          >
            <X size={9} />
          </span>
        )}
        <ChevronDown size={10} className={`text-slate-600 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="absolute top-full left-0 mt-1 z-50 min-w-[260px] rounded-xl bg-[#131320] border border-white/[0.1] shadow-2xl overflow-hidden">
          {searchable && (
            <div className="p-2 border-b border-white/[0.06]">
              <div className="relative">
                <Search size={11} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-600 pointer-events-none" />
                <input
                  ref={searchRef}
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                  placeholder="Search…"
                  className="w-full pl-7 pr-3 py-1.5 rounded-lg bg-white/[0.06] border border-white/[0.08] text-xs text-white placeholder:text-slate-600 focus:outline-none focus:border-cyan-500/40"
                />
                {query && (
                  <button onClick={() => setQuery("")} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-600 hover:text-slate-400">
                    <X size={9} />
                  </button>
                )}
              </div>
            </div>
          )}
          <div className="overflow-y-auto max-h-56 py-1">
            {filtered.length === 0 ? (
              <p className="px-3 py-3 text-[11px] text-slate-600 text-center">No results</p>
            ) : filtered.map(opt => {
              const checked = values.includes(opt.value)
              return (
                <button key={opt.value} onClick={() => toggle(opt.value)}
                  className={`w-full flex items-center gap-2.5 px-3 py-1.5 text-xs transition-colors text-left
                    ${checked ? "text-cyan-300 bg-cyan-500/10" : "text-slate-400 hover:text-white hover:bg-white/[0.06]"}`}>
                  <span className={`w-3.5 h-3.5 rounded flex items-center justify-center shrink-0 border transition-colors
                    ${checked ? "bg-cyan-500 border-cyan-500" : "border-white/20"}`}>
                    {checked && <span className="text-black text-[8px] font-bold leading-none">✓</span>}
                  </span>
                  <span className="truncate">{opt.label}</span>
                </button>
              )
            })}
          </div>
          {values.length > 0 && (
            <div className="border-t border-white/[0.06] p-1">
              <button onClick={() => onChange([])}
                className="w-full text-left px-3 py-1.5 text-[11px] text-slate-600 hover:text-slate-400 transition-colors rounded-lg hover:bg-white/[0.04]">
                Clear {values.length} selected
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
})

// ─── Types ────────────────────────────────────────────────────────────────────

interface ImageRecord {
  id: number
  prompt: string
  imageUrl: string
  referenceImageUrls: string[]
  model: string
  quality: string | null
  aspectRatio: string | null
  ticketCost: number
  markedForTraining: boolean
  adminTags: string[]
  adminCaption: string | null
  createdAt: string
  expiresAt: string | null
  falRequestId: string | null
  videoMetadata: any | null
  isDeleted: boolean
  user: { id: number; email: string; name: string | null }
  imageRating: {
    score: number
    wasAccurate: boolean | null
    tags: string[]
    feedbackText: string | null
    createdAt: string
  } | null
}

interface Bucket { id: number; name: string; description: string | null; color: string | null; count: number; createdAt: string }

interface Pagination { page: number; limit: number; total: number; totalPages: number }
interface Facets {
  models:    { value: string; count: number }[]
  aspects:   { value: string; count: number }[]
  qualities: { value: string | null; count: number }[]
  tags:      { value: string; count: number }[]
  users:     { id: number; email: string; name: string | null; count: number }[]
}

// ─── Auth helpers ─────────────────────────────────────────────────────────────

function getAdminPassword() {
  try { return sessionStorage.getItem("admin-password") || "" } catch { return "" }
}
function authHeaders(): Record<string, string> {
  const p = getAdminPassword()
  return p ? { "x-admin-password": p } : {}
}

// ─── Tag pill input ───────────────────────────────────────────────────────────

function TagInput({ tags, onChange, placeholder = "Add tag…", suggestions = [] }: {
  tags: string[]
  onChange: (tags: string[]) => void
  placeholder?: string
  suggestions?: string[]
}) {
  const [input, setInput]     = useState("")
  const [showSug, setShowSug] = useState(false)
  const inputRef              = useRef<HTMLInputElement>(null)

  const addTag = (tag: string) => {
    const clean = tag.trim().toLowerCase().replace(/[,\s]+/g, '-').replace(/[^a-z0-9-_]/g, '')
    if (clean && !tags.includes(clean)) onChange([...tags, clean])
    setInput(""); setShowSug(false)
  }
  const removeTag = (tag: string) => onChange(tags.filter(t => t !== tag))
  const filteredSug = suggestions.filter(s => !tags.includes(s) && s.includes(input.toLowerCase())).slice(0, 6)

  return (
    <div className="space-y-1.5">
      <div className="flex flex-wrap gap-1.5 min-h-[36px] p-1.5 rounded-lg bg-white/[0.05] border border-white/[0.08] cursor-text"
        onClick={() => inputRef.current?.focus()}>
        {tags.map(tag => (
          <span key={tag} className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-cyan-500/15 border border-cyan-500/20 text-cyan-300 text-[11px] leading-none">
            <Hash size={8} />{tag}
            <button onClick={() => removeTag(tag)} className="hover:text-white ml-0.5"><X size={9} /></button>
          </span>
        ))}
        <input ref={inputRef} value={input}
          onChange={e => { setInput(e.target.value); setShowSug(true) }}
          onKeyDown={e => {
            if ((e.key === 'Enter' || e.key === ',') && input.trim()) { e.preventDefault(); addTag(input) }
            if (e.key === 'Backspace' && !input && tags.length) removeTag(tags[tags.length - 1])
          }}
          onBlur={() => setTimeout(() => setShowSug(false), 150)}
          placeholder={tags.length === 0 ? placeholder : ""}
          className="flex-1 min-w-[80px] bg-transparent text-xs text-white placeholder:text-slate-600 outline-none"
        />
      </div>
      {showSug && filteredSug.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {filteredSug.map(s => (
            <button key={s} onClick={() => addTag(s)}
              className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-white/[0.06] border border-white/[0.08] text-slate-400 hover:text-white text-[11px] transition-colors">
              <Plus size={8} />{s}
            </button>
          ))}
        </div>
      )}
      <p className="text-[10px] text-slate-700">Enter or comma to add · tags are lowercased</p>
    </div>
  )
}

// ─── Upload modal ─────────────────────────────────────────────────────────────

interface UploadFileMeta {
  description: string
  tags:        string[]
  caption:     string
  marked:      boolean
}

const BATCH_SIZE = 10
const UPLOAD_ACCEPT = 'image/*,video/mp4,video/webm,video/quicktime,video/avi,video/x-matroska'

function fmt2(b: number) {
  if (b < 1024) return `${b} B`
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`
  return `${(b / 1024 / 1024).toFixed(1)} MB`
}

function emptyMeta(): UploadFileMeta {
  return { description: '', tags: [], caption: '', marked: false }
}

function UploadModal({ bucketId, suggestions, onClose, onUploaded }: {
  bucketId:   number
  suggestions: string[]
  onClose:    () => void
  onUploaded: () => void
}) {
  const [files,       setFiles]       = useState<File[]>([])
  const [previews,    setPreviews]    = useState<({ url: string; w: number; h: number } | null)[]>([])
  const [metas,       setMetas]       = useState<UploadFileMeta[]>([])
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null)

  // Bulk-apply fields
  const [bulkTags,    setBulkTags]    = useState<string[]>([])
  const [bulkCaption, setBulkCaption] = useState('')
  const [bulkDesc,    setBulkDesc]    = useState('')
  const [bulkMarked,  setBulkMarked]  = useState(false)

  const [uploading,   setUploading]   = useState(false)
  const [progress,    setProgress]    = useState({ done: 0, total: 0, msg: '' })
  const [dragging,    setDragging]    = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  function addFiles(incoming: FileList | File[]) {
    const arr = Array.from(incoming).filter(f =>
      f.type.startsWith('image/') || f.type.startsWith('video/')
    )
    if (!arr.length) return
    setFiles(prev => {
      const offset = prev.length
      arr.forEach((f, i) => {
        if (f.type.startsWith('image/')) {
          const url = URL.createObjectURL(f)
          const img = new window.Image()
          img.onload = () => {
            setPreviews(p => {
              const copy = [...p]
              copy[offset + i] = { url, w: img.naturalWidth, h: img.naturalHeight }
              return copy
            })
          }
          img.src = url
        }
      })
      return [...prev, ...arr]
    })
    setPreviews(p => [...p, ...arr.map(() => null)])
    setMetas(m => [...m, ...arr.map(emptyMeta)])
  }

  function removeFile(i: number) {
    setFiles(f => f.filter((_, j) => j !== i))
    setPreviews(p => p.filter((_, j) => j !== i))
    setMetas(m => m.filter((_, j) => j !== i))
    if (expandedIdx === i) setExpandedIdx(null)
    else if (expandedIdx !== null && expandedIdx > i) setExpandedIdx(expandedIdx - 1)
  }

  function updateMeta(i: number, patch: Partial<UploadFileMeta>) {
    setMetas(m => m.map((meta, j) => j === i ? { ...meta, ...patch } : meta))
  }

  function applyBulkToAll() {
    setMetas(m => m.map(meta => ({
      description: bulkDesc    || meta.description,
      tags:        bulkTags.length ? [...new Set([...meta.tags, ...bulkTags])] : meta.tags,
      caption:     bulkCaption || meta.caption,
      marked:      bulkMarked  || meta.marked,
    })))
  }

  function applyBulkToUnset() {
    setMetas(m => m.map(meta => ({
      description: meta.description || bulkDesc,
      tags:        meta.tags.length  ? meta.tags : [...bulkTags],
      caption:     meta.caption      || bulkCaption,
      marked:      meta.marked       || bulkMarked,
    })))
  }

  async function handleUpload() {
    if (!files.length || uploading) return
    setUploading(true)
    const total = files.length
    let done = 0
    const pw = sessionStorage.getItem('admin-password') || ''

    try {
      for (let start = 0; start < files.length; start += BATCH_SIZE) {
        const end          = Math.min(start + BATCH_SIZE, files.length)
        const batchFiles   = files.slice(start, end)
        const batchMetas   = metas.slice(start, end)
        const batchPreview = previews.slice(start, end)

        setProgress({ done, total, msg: `Uploading ${start + 1}–${end} of ${total}…` })

        const form = new FormData()
        batchFiles.forEach(f => form.append('files', f))
        form.append('metadataJson', JSON.stringify(batchMetas))
        form.append('bucketId',     String(bucketId))
        form.append('widths',       JSON.stringify(batchPreview.map(p => p?.w ?? 0)))
        form.append('heights',      JSON.stringify(batchPreview.map(p => p?.h ?? 0)))

        const res  = await fetch('/api/admin/dataset/upload', {
          method:  'POST',
          headers: { 'x-admin-password': pw },
          body:    form,
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || `Batch ${start + 1}–${end} failed`)
        done += data.count
      }

      setProgress({ done, total, msg: `✓ ${done} file${done !== 1 ? 's' : ''} uploaded` })
      setTimeout(() => { onUploaded(); onClose() }, 1000)
    } catch (err: any) {
      setProgress(p => ({ ...p, msg: `Error: ${err.message}` }))
      setUploading(false)
    }
  }

  const hasBulk = bulkDesc || bulkTags.length > 0 || bulkCaption || bulkMarked
  const metaSetCount = metas.filter(m => m.description || m.tags.length || m.caption || m.marked).length

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-3xl max-h-[94vh] rounded-2xl bg-[#0c0c18] border border-white/[0.1] shadow-2xl flex flex-col overflow-hidden"
        onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-white/[0.06] shrink-0">
          <div className="flex items-center gap-2">
            <UploadCloud size={14} className="text-violet-400" />
            <span className="text-xs font-semibold text-white">Upload Images &amp; Videos</span>
            {files.length > 0 && <span className="text-[10px] text-slate-500">{files.length} file{files.length !== 1 ? 's' : ''}</span>}
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/[0.06] text-slate-600 hover:text-slate-300 transition-colors">
            <X size={15} />
          </button>
        </div>

        <div className="overflow-y-auto flex-1 flex flex-col">

          {/* Drop zone */}
          <div className="p-4 shrink-0">
            <div
              onDragOver={e => { e.preventDefault(); setDragging(true) }}
              onDragLeave={() => setDragging(false)}
              onDrop={e => { e.preventDefault(); setDragging(false); addFiles(e.dataTransfer.files) }}
              onClick={() => inputRef.current?.click()}
              className={`border-2 border-dashed rounded-xl py-6 text-center cursor-pointer transition-all
                ${dragging ? 'border-violet-500/60 bg-violet-500/10' : 'border-white/[0.08] hover:border-white/20 hover:bg-white/[0.02]'}`}
            >
              <UploadCloud size={24} className="mx-auto text-slate-600 mb-1.5" />
              <p className="text-xs text-slate-400 font-medium">{files.length > 0 ? 'Drop more files or click to add' : 'Drop files here or click to browse'}</p>
              <p className="text-[10px] text-slate-600 mt-0.5">Images (JPEG, PNG, WebP, AVIF) · Videos (MP4, WebM, MOV)</p>
              <input ref={inputRef} type="file" multiple accept={UPLOAD_ACCEPT} className="hidden"
                onChange={e => e.target.files && addFiles(e.target.files)} />
            </div>
          </div>

          {files.length > 0 && (
            <div className="flex flex-col flex-1 min-h-0">

              {/* ── Bulk apply panel ── */}
              <div className="mx-4 mb-3 rounded-xl bg-white/[0.03] border border-white/[0.06] overflow-hidden shrink-0">
                <div className="px-4 py-2.5 border-b border-white/[0.05] flex items-center justify-between">
                  <p className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">Bulk Apply</p>
                  <div className="flex items-center gap-2">
                    <button onClick={applyBulkToUnset} disabled={!hasBulk}
                      className="text-[10px] px-2.5 py-1 rounded-lg bg-white/[0.05] border border-white/[0.08] text-slate-400 hover:text-white disabled:opacity-30 transition-all">
                      Apply to unset
                    </button>
                    <button onClick={applyBulkToAll} disabled={!hasBulk}
                      className="text-[10px] px-2.5 py-1 rounded-lg bg-violet-500/15 border border-violet-500/25 text-violet-400 hover:bg-violet-500/20 disabled:opacity-30 transition-all">
                      Apply to all
                    </button>
                  </div>
                </div>
                <div className="p-3 grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-[9px] text-slate-600 mb-1">Description</p>
                    <input value={bulkDesc} onChange={e => setBulkDesc(e.target.value)}
                      placeholder="Applied to all files…"
                      className="w-full rounded-lg bg-white/[0.04] border border-white/[0.07] px-2.5 py-1.5 text-[11px] text-white placeholder:text-slate-700 focus:outline-none focus:border-violet-500/30" />
                  </div>
                  <div>
                    <p className="text-[9px] text-slate-600 mb-1">Caption</p>
                    <input value={bulkCaption} onChange={e => setBulkCaption(e.target.value)}
                      placeholder="Training caption…"
                      className="w-full rounded-lg bg-white/[0.04] border border-white/[0.07] px-2.5 py-1.5 text-[11px] text-white placeholder:text-slate-700 focus:outline-none focus:border-violet-500/30" />
                  </div>
                  <div className="col-span-2">
                    <p className="text-[9px] text-slate-600 mb-1">Tags</p>
                    <TagInput tags={bulkTags} onChange={setBulkTags} suggestions={suggestions} />
                  </div>
                  <div className="col-span-2">
                    <button onClick={() => setBulkMarked(v => !v)}
                      className={`flex items-center gap-1.5 px-3 py-1 rounded-lg border text-[11px] transition-all
                        ${bulkMarked ? 'bg-emerald-500/10 border-emerald-500/25 text-emerald-400' : 'bg-white/[0.03] border-white/[0.06] text-slate-600 hover:text-white'}`}>
                      <BookMarked size={10} /> Mark all for training
                    </button>
                  </div>
                </div>
              </div>

              {/* ── File list ── */}
              <div className="px-4 pb-1 flex items-center justify-between shrink-0">
                <p className="text-[10px] text-slate-600 uppercase tracking-wider font-semibold">
                  {files.length} file{files.length !== 1 ? 's' : ''}
                  {metaSetCount > 0 && <span className="ml-2 normal-case font-normal text-violet-500">{metaSetCount} with individual metadata</span>}
                </p>
                <button onClick={() => { setFiles([]); setPreviews([]); setMetas([]); setExpandedIdx(null) }}
                  className="text-[10px] text-slate-700 hover:text-red-400 transition-colors">Remove all</button>
              </div>

              <div className="overflow-y-auto flex-1 px-4 pb-2 space-y-1">
                {files.map((f, i) => {
                  const isVideo   = f.type.startsWith('video/')
                  const preview   = previews[i]
                  const meta      = metas[i]
                  const hasIndiv  = !!(meta.description || meta.tags.length || meta.caption || meta.marked)
                  const isExpanded = expandedIdx === i

                  return (
                    <div key={i} className={`rounded-xl border transition-all ${isExpanded ? 'bg-white/[0.04] border-violet-500/20' : 'bg-white/[0.02] border-white/[0.05] hover:border-white/[0.09]'}`}>
                      {/* Row */}
                      <div className="flex items-center gap-2.5 p-2.5">
                        {/* Thumbnail */}
                        <div className="w-10 h-10 rounded-lg overflow-hidden shrink-0 bg-white/[0.05] flex items-center justify-center">
                          {isVideo ? (
                            <Film size={16} className="text-slate-500" />
                          ) : preview ? (
                            <img src={preview.url} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <FileImage size={16} className="text-slate-600" />
                          )}
                        </div>
                        {/* Info */}
                        <div className="flex-1 min-w-0">
                          <p className="text-[11px] text-white truncate font-medium">{f.name}</p>
                          <p className="text-[9px] text-slate-600">
                            {fmt2(f.size)}
                            {preview ? ` · ${preview.w}×${preview.h}` : ''}
                            {isVideo && ' · video'}
                          </p>
                          {hasIndiv && !isExpanded && (
                            <div className="flex flex-wrap gap-1 mt-1">
                              {meta.tags.map(t => <span key={t} className="text-[9px] px-1 py-0.5 rounded bg-violet-500/15 text-violet-400">{t}</span>)}
                              {meta.caption && <span className="text-[9px] text-slate-600 italic truncate max-w-[140px]">"{meta.caption}"</span>}
                              {meta.marked && <span className="text-[9px] px-1 py-0.5 rounded bg-emerald-500/15 text-emerald-500">training</span>}
                            </div>
                          )}
                        </div>
                        {/* Actions */}
                        <button
                          onClick={() => setExpandedIdx(isExpanded ? null : i)}
                          className={`text-[10px] px-2 py-1 rounded-lg border transition-all shrink-0
                            ${hasIndiv ? 'bg-violet-500/10 border-violet-500/20 text-violet-400' : 'bg-white/[0.04] border-white/[0.07] text-slate-500 hover:text-white'}`}>
                          {isExpanded ? 'Done' : 'Edit'}
                        </button>
                        <button onClick={() => removeFile(i)} className="text-slate-700 hover:text-red-400 transition-colors shrink-0 p-1">
                          <X size={12} />
                        </button>
                      </div>

                      {/* Expanded per-file editor */}
                      {isExpanded && (
                        <div className="px-3 pb-3 pt-1 space-y-2.5 border-t border-white/[0.05]">
                          <div className="grid grid-cols-2 gap-2.5">
                            <div>
                              <p className="text-[9px] text-slate-600 mb-1">Description</p>
                              <input value={meta.description} onChange={e => updateMeta(i, { description: e.target.value })}
                                placeholder="Describe this file…"
                                className="w-full rounded-lg bg-white/[0.05] border border-white/[0.08] px-2.5 py-1.5 text-[11px] text-white placeholder:text-slate-700 focus:outline-none focus:border-violet-500/40" />
                            </div>
                            <div>
                              <p className="text-[9px] text-slate-600 mb-1">Caption</p>
                              <input value={meta.caption} onChange={e => updateMeta(i, { caption: e.target.value })}
                                placeholder="Training caption…"
                                className="w-full rounded-lg bg-white/[0.05] border border-white/[0.08] px-2.5 py-1.5 text-[11px] text-white placeholder:text-slate-700 focus:outline-none focus:border-violet-500/40" />
                            </div>
                          </div>
                          <div>
                            <p className="text-[9px] text-slate-600 mb-1">Tags</p>
                            <TagInput tags={meta.tags} onChange={t => updateMeta(i, { tags: t })} suggestions={suggestions} />
                          </div>
                          <button onClick={() => updateMeta(i, { marked: !meta.marked })}
                            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-[10px] transition-all
                              ${meta.marked ? 'bg-emerald-500/10 border-emerald-500/25 text-emerald-400' : 'bg-white/[0.03] border-white/[0.06] text-slate-600 hover:text-white'}`}>
                            <BookMarked size={10} /> Mark for training
                          </button>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-white/[0.06] flex items-center gap-3 shrink-0">
          {progress.msg ? (
            <div className="flex-1 flex items-center gap-3">
              <p className={`text-xs ${progress.msg.startsWith('Error') ? 'text-red-400' : progress.msg.startsWith('✓') ? 'text-emerald-400' : 'text-slate-400'}`}>
                {progress.msg}
              </p>
              {uploading && progress.total > 0 && (
                <div className="flex-1 h-1 rounded-full bg-white/[0.06] overflow-hidden max-w-[120px]">
                  <div className="h-full bg-violet-500 transition-all" style={{ width: `${(progress.done / progress.total) * 100}%` }} />
                </div>
              )}
            </div>
          ) : <span className="flex-1" />}
          <button onClick={onClose} className="px-4 py-1.5 rounded-lg bg-white/[0.04] border border-white/[0.07] text-slate-500 hover:text-white text-xs transition-all">Cancel</button>
          <button onClick={handleUpload} disabled={uploading || files.length === 0}
            className="flex items-center gap-1.5 px-5 py-1.5 rounded-lg bg-violet-500/20 border border-violet-500/30 text-violet-300 text-xs font-medium hover:bg-violet-500/25 transition-all disabled:opacity-40 disabled:cursor-not-allowed">
            {uploading && <Loader2 size={11} className="animate-spin" />}
            {uploading ? `Uploading ${progress.done}/${progress.total}…` : `Upload ${files.length} file${files.length !== 1 ? 's' : ''}`}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Detail modal ─────────────────────────────────────────────────────────────

function DetailModal({ img, suggestions, onClose, onSave }: {
  img: ImageRecord
  suggestions: string[]
  onClose: () => void
  onSave: (id: number, tags: string[], caption: string | null, marked: boolean) => Promise<void>
}) {
  const [tags,    setTags]    = useState<string[]>(img.adminTags)
  const [caption, setCaption] = useState(img.adminCaption ?? "")
  const [marked,  setMarked]  = useState(img.markedForTraining)
  const [saving,  setSaving]  = useState(false)
  const [imgErr,  setImgErr]  = useState(false)
  const [copied,  setCopied]  = useState<string | null>(null)
  const isVideo = img.imageUrl?.match(/\.(mp4|webm|mov)$/i)

  const dirty = JSON.stringify(tags) !== JSON.stringify(img.adminTags)
    || (caption.trim() || null) !== img.adminCaption
    || marked !== img.markedForTraining

  async function handleSave() {
    setSaving(true)
    await onSave(img.id, tags, caption.trim() || null, marked)
    setSaving(false)
  }

  function copyText(text: string, key: string) {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(key)
      setTimeout(() => setCopied(null), 1500)
    })
  }

  function fmt(dateStr: string | null) {
    if (!dateStr) return "—"
    return new Date(dateStr).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })
  }

  const vm = img.videoMetadata as any
  const isUpload = img.model === '__upload__'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm" onClick={onClose}>
      <div
        className="w-full max-w-4xl max-h-[92vh] rounded-2xl bg-[#0c0c18] border border-white/[0.1] shadow-2xl flex flex-col overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Modal header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-white/[0.06] shrink-0">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-white">{isUpload ? 'Upload' : 'Generation'} #{img.id}</span>
            {isUpload && <span className="text-[10px] px-1.5 py-0.5 rounded-full leading-none bg-violet-500/15 text-violet-400">upload</span>}
            <span className={`text-[10px] px-1.5 py-0.5 rounded-full leading-none ${img.isDeleted ? "bg-red-500/15 text-red-400" : "bg-emerald-500/15 text-emerald-400"}`}>
              {img.isDeleted ? "deleted" : "active"}
            </span>
            {img.markedForTraining && (
              <span className="text-[10px] px-1.5 py-0.5 rounded-full leading-none bg-emerald-500/15 text-emerald-400">training</span>
            )}
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/[0.06] text-slate-600 hover:text-slate-300 transition-colors">
            <X size={15} />
          </button>
        </div>

        {/* Modal body — scroll */}
        <div className="flex flex-col md:flex-row overflow-hidden flex-1 min-h-0">

          {/* Left: image + refs */}
          <div className="md:w-72 shrink-0 flex flex-col bg-black/30 border-b md:border-b-0 md:border-r border-white/[0.06]">
            {/* Main image / video */}
            <div className="relative bg-black/40 aspect-square md:aspect-auto md:flex-1 min-h-0">
              {isVideo ? (
                <video
                  src={img.imageUrl}
                  controls
                  playsInline
                  poster={vm?.thumbnailUrl ?? undefined}
                  className="absolute inset-0 w-full h-full object-contain"
                />
              ) : imgErr ? (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-1">
                  <ImageIcon size={24} className="text-slate-700" />
                  <span className="text-[10px] text-slate-700">Failed to load</span>
                </div>
              ) : (
                <img src={img.imageUrl} alt="" className="w-full h-full object-contain" onError={() => setImgErr(true)} />
              )}

              {/* Open full */}
              {!isVideo && !imgErr && (
                <a href={img.imageUrl} target="_blank" rel="noreferrer"
                  className="absolute top-2 right-2 p-1.5 rounded-lg bg-black/60 text-white/60 hover:text-white transition-colors">
                  <ExternalLink size={11} />
                </a>
              )}
            </div>

            {/* Reference images */}
            {img.referenceImageUrls.length > 0 && (
              <div className="p-2 border-t border-white/[0.06]">
                <p className="text-[9px] text-slate-600 uppercase tracking-wider mb-1.5">
                  {img.referenceImageUrls.length} Reference image{img.referenceImageUrls.length > 1 ? "s" : ""}
                </p>
                <div className="grid grid-cols-4 gap-1">
                  {img.referenceImageUrls.map((url, i) => (
                    <a key={i} href={url} target="_blank" rel="noreferrer" className="aspect-square rounded-md overflow-hidden bg-white/[0.04] border border-white/[0.06] hover:border-white/20 transition-colors">
                      <img src={url} alt="" className="w-full h-full object-cover" onError={e => { (e.target as HTMLImageElement).style.display = 'none' }} />
                    </a>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Right: all metadata */}
          <div className="flex-1 overflow-y-auto p-5 space-y-5 min-w-0">

            {/* ── Prompt ── */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <p className="text-[10px] text-slate-600 uppercase tracking-wider font-semibold">Prompt</p>
                <button onClick={() => copyText(img.prompt, 'prompt')}
                  className="flex items-center gap-1 text-[10px] text-slate-600 hover:text-slate-300 transition-colors">
                  <Copy size={9} />
                  {copied === 'prompt' ? "Copied!" : "Copy"}
                </button>
              </div>
              <p className="text-xs text-slate-300 leading-relaxed whitespace-pre-wrap break-words bg-white/[0.03] rounded-lg px-3 py-2.5 border border-white/[0.05]">
                {img.prompt}
              </p>
            </div>

            {/* ── Generation info / Upload info ── */}
            {isUpload ? (
              <div>
                <p className="text-[10px] text-slate-600 uppercase tracking-wider font-semibold mb-2">Upload info</p>
                <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
                  {vm?.originalFilename && <InfoRow icon={<FileImage size={11} />} label="Filename"   value={vm.originalFilename} copyKey="filename" copied={copied} onCopy={copyText} mono truncate />}
                  {vm?.fileSize         && <InfoRow icon={<HardDrive size={11} />} label="File size"  value={vm.fileSize < 1024*1024 ? `${(vm.fileSize/1024).toFixed(1)} KB` : `${(vm.fileSize/1024/1024).toFixed(2)} MB`} />}
                  {vm?.mimeType         && <InfoRow icon={<FileImage size={11} />} label="Type"       value={vm.mimeType} mono />}
                  {vm?.width && vm?.height && <InfoRow icon={<Ruler size={11} />}  label="Dimensions" value={`${vm.width} × ${vm.height} px`} />}
                  {img.aspectRatio      && <InfoRow icon={<Layers size={11} />}    label="Aspect"     value={img.aspectRatio} />}
                  <InfoRow icon={<Calendar size={11} />} label="Uploaded"  value={vm?.uploadedAt ? fmt(vm.uploadedAt) : fmt(img.createdAt)} />
                  <InfoRow icon={<Calendar size={11} />} label="DB created" value={fmt(img.createdAt)} />
                  <InfoRow icon={<User size={11} />}     label="Image URL" value={img.imageUrl} copyKey="url" copied={copied} onCopy={copyText} mono truncate />
                </div>
              </div>
            ) : (
              <div>
                <p className="text-[10px] text-slate-600 uppercase tracking-wider font-semibold mb-2">Generation info</p>
                <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
                  <InfoRow icon={<Cpu size={11} />}        label="Model"       value={img.model} copyKey="model" copied={copied} onCopy={copyText} mono />
                  <InfoRow icon={<Layers size={11} />}     label="Aspect"      value={img.aspectRatio ?? "—"} />
                  <InfoRow icon={<Sparkles size={11} />}   label="Quality"     value={img.quality ?? "—"} />
                  <InfoRow icon={<Tag size={11} />}        label="Ticket cost" value={`${img.ticketCost} ticket${img.ticketCost !== 1 ? "s" : ""}`} />
                  <InfoRow icon={<Calendar size={11} />}   label="Created"     value={fmt(img.createdAt)} />
                  <InfoRow icon={<Clock size={11} />}      label="Expires"     value={fmt(img.expiresAt)} />
                  <InfoRow icon={<User size={11} />}       label="User"        value={img.user.name ? `${img.user.name} (${img.user.email})` : img.user.email} copyKey="email" copied={copied} onCopy={copyText} />
                  <InfoRow icon={<Hash size={11} />}       label="User ID"     value={`#${img.user.id}`} />
                  {img.falRequestId && (
                    <InfoRow icon={<Fingerprint size={11} />} label="FAL ID" value={img.falRequestId} copyKey="falId" copied={copied} onCopy={copyText} mono truncate />
                  )}
                </div>
              </div>
            )}

            {/* ── Video metadata ── */}
            {vm && !isUpload && (
              <div>
                <p className="text-[10px] text-slate-600 uppercase tracking-wider font-semibold mb-2">Video metadata</p>

                {/* Scalar fields */}
                <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs mb-3">
                  {vm.duration   && <InfoRow icon={<Film size={11} />}   label="Duration"   value={`${vm.duration}s`} />}
                  {vm.resolution && <InfoRow icon={<Layers size={11} />} label="Resolution" value={vm.resolution} />}
                  {vm.aspectRatio && vm.aspectRatio !== img.aspectRatio && <InfoRow icon={<Layers size={11} />} label="Aspect" value={vm.aspectRatio} />}
                  {vm.audioEnabled !== undefined && <InfoRow icon={<Film size={11} />} label="Audio" value={vm.audioEnabled ? 'Yes' : 'No'} />}
                  {vm.characterOrientation && <InfoRow icon={<Film size={11} />} label="Orientation" value={vm.characterOrientation} />}
                  {/* Any remaining unknown scalar fields */}
                  {Object.entries(vm)
                    .filter(([k, v]) => !['duration','resolution','aspectRatio','thumbnailUrl','isVideo','audioEnabled','startFrameUrl','endFrameUrl','motionVideoUrl','keepOriginalSound','characterOrientation'].includes(k) && typeof v !== 'object')
                    .map(([k, v]) => (
                      <InfoRow key={k} icon={<Film size={11} />} label={k} value={String(v)} />
                    ))
                  }
                </div>

                {/* Reference frames — show as image thumbnails */}
                {(vm.startFrameUrl || vm.endFrameUrl || vm.motionVideoUrl || vm.thumbnailUrl) && (
                  <div className="grid grid-cols-2 gap-2">
                    {vm.startFrameUrl && (
                      <a href={vm.startFrameUrl} target="_blank" rel="noreferrer" className="group relative rounded-lg overflow-hidden border border-white/[0.08] hover:border-white/20 transition-colors bg-black/30">
                        <img src={vm.startFrameUrl} alt="Start frame" className="w-full aspect-video object-cover" onError={e => { (e.target as HTMLImageElement).style.display='none' }} />
                        <div className="absolute bottom-0 inset-x-0 px-2 py-1 bg-black/60 text-[9px] text-slate-300 flex items-center gap-1">
                          <ExternalLink size={8} className="opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                          Start frame
                        </div>
                      </a>
                    )}
                    {vm.endFrameUrl && (
                      <a href={vm.endFrameUrl} target="_blank" rel="noreferrer" className="group relative rounded-lg overflow-hidden border border-white/[0.08] hover:border-white/20 transition-colors bg-black/30">
                        <img src={vm.endFrameUrl} alt="End frame" className="w-full aspect-video object-cover" onError={e => { (e.target as HTMLImageElement).style.display='none' }} />
                        <div className="absolute bottom-0 inset-x-0 px-2 py-1 bg-black/60 text-[9px] text-slate-300 flex items-center gap-1">
                          <ExternalLink size={8} className="opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                          End frame
                        </div>
                      </a>
                    )}
                    {vm.motionVideoUrl && (
                      <a href={vm.motionVideoUrl} target="_blank" rel="noreferrer" className="group relative rounded-lg overflow-hidden border border-white/[0.08] hover:border-white/20 transition-colors bg-black/30 col-span-2">
                        <video src={vm.motionVideoUrl} muted className="w-full aspect-video object-cover" />
                        <div className="absolute bottom-0 inset-x-0 px-2 py-1 bg-black/60 text-[9px] text-slate-300 flex items-center gap-1">
                          <ExternalLink size={8} className="opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                          Motion reference
                        </div>
                      </a>
                    )}
                    {vm.thumbnailUrl && !vm.startFrameUrl && !vm.endFrameUrl && (
                      <a href={vm.thumbnailUrl} target="_blank" rel="noreferrer" className="relative rounded-lg overflow-hidden border border-white/[0.08] bg-black/30">
                        <img src={vm.thumbnailUrl} alt="Thumbnail" className="w-full aspect-video object-cover" />
                        <div className="absolute bottom-0 inset-x-0 px-2 py-1 bg-black/60 text-[9px] text-slate-300">Thumbnail</div>
                      </a>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* ── User rating ── */}
            {!isUpload && img.imageRating ? (
              <div>
                <p className="text-[10px] text-slate-600 uppercase tracking-wider font-semibold mb-2">User rating</p>
                <div className="bg-white/[0.03] rounded-lg border border-white/[0.05] p-3 space-y-2">
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-0.5">
                      {[1,2,3,4,5].map(i => (
                        <Star key={i} size={13} className={i <= img.imageRating!.score ? "text-amber-400 fill-amber-400" : "text-slate-700"} />
                      ))}
                    </div>
                    <span className="text-xs font-semibold text-white">{img.imageRating.score}/5</span>
                    {img.imageRating.wasAccurate !== null && (
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${img.imageRating.wasAccurate ? "bg-emerald-500/15 text-emerald-400" : "bg-red-500/15 text-red-400"}`}>
                        {img.imageRating.wasAccurate ? "Accurate" : "Inaccurate"}
                      </span>
                    )}
                  </div>
                  {img.imageRating.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {img.imageRating.tags.map(t => (
                        <span key={t} className="text-[10px] px-1.5 py-0.5 rounded bg-white/[0.06] text-slate-400">{t}</span>
                      ))}
                    </div>
                  )}
                  {img.imageRating.feedbackText && (
                    <p className="text-[11px] text-slate-400 italic">"{img.imageRating.feedbackText}"</p>
                  )}
                  <p className="text-[9px] text-slate-700">Rated {fmt(img.imageRating.createdAt)}</p>
                </div>
              </div>
            ) : (!isUpload ? (
              <div>
                <p className="text-[10px] text-slate-600 uppercase tracking-wider font-semibold mb-1.5">User rating</p>
                <p className="text-xs text-slate-700 italic">Not rated yet</p>
              </div>
            ) : null)}

            {/* ── Admin metadata (editable) ── */}
            <div>
              <p className="text-[10px] text-slate-600 uppercase tracking-wider font-semibold mb-2">Admin metadata</p>
              <div className="space-y-3">
                <div>
                  <p className="text-[10px] text-slate-600 mb-1.5">Tags</p>
                  <TagInput tags={tags} onChange={setTags} suggestions={suggestions} />
                </div>
                <div>
                  <p className="text-[10px] text-slate-600 mb-1.5">Caption</p>
                  <textarea value={caption} onChange={e => setCaption(e.target.value)}
                    placeholder="Write a caption for training…"
                    rows={3}
                    className="w-full rounded-lg bg-white/[0.05] border border-white/[0.08] px-3 py-2 text-xs text-white placeholder:text-slate-600 focus:outline-none focus:border-cyan-500/40 resize-none"
                  />
                </div>
                <button onClick={() => setMarked(v => !v)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs transition-all
                    ${marked
                      ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
                      : "bg-white/[0.04] border-white/[0.07] text-slate-500 hover:text-white"}`}>
                  <BookMarked size={11} />
                  {marked ? "Marked for training" : "Mark for training"}
                </button>
              </div>
            </div>

            {/* Save */}
            <div className="flex items-center gap-2 pt-1">
              <button onClick={handleSave} disabled={saving || !dirty}
                className="flex items-center gap-1.5 px-5 py-2 rounded-lg bg-cyan-500/20 border border-cyan-500/30 text-cyan-300 text-xs font-medium hover:bg-cyan-500/25 transition-all disabled:opacity-40 disabled:cursor-not-allowed">
                {saving && <Loader2 size={11} className="animate-spin" />}
                {saving ? "Saving…" : dirty ? "Save changes" : "Saved"}
              </button>
              <button onClick={onClose} className="px-4 py-2 rounded-lg bg-white/[0.04] border border-white/[0.07] text-slate-500 hover:text-white text-xs transition-all">
                Close
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// Compact label+value row used inside the detail modal
function InfoRow({ icon, label, value, copyKey, copied, onCopy, mono, truncate }: {
  icon: React.ReactNode
  label: string
  value: string
  copyKey?: string
  copied?: string | null
  onCopy?: (v: string, k: string) => void
  mono?: boolean
  truncate?: boolean
}) {
  return (
    <div className="flex items-start gap-1.5 min-w-0">
      <span className="text-slate-600 mt-0.5 shrink-0">{icon}</span>
      <div className="min-w-0 flex-1">
        <p className="text-[9px] text-slate-600 uppercase tracking-wide leading-none mb-0.5">{label}</p>
        <div className="flex items-center gap-1 min-w-0">
          <span className={`text-[11px] text-slate-300 leading-snug ${mono ? "font-mono" : ""} ${truncate ? "truncate" : "break-all"}`}>
            {value}
          </span>
          {copyKey && onCopy && (
            <button onClick={() => onCopy(value, copyKey)} className="shrink-0 text-slate-700 hover:text-slate-400 transition-colors">
              {copied === copyKey ? <span className="text-[9px] text-emerald-500">✓</span> : <Copy size={9} />}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Bulk modals ──────────────────────────────────────────────────────────────

function BulkModal({ mode, count, suggestions, onClose, onApply }: {
  mode: "tags" | "caption"
  count: number
  suggestions: string[]
  onClose: () => void
  onApply: (data: { addTags?: string[]; caption?: string }) => Promise<void>
}) {
  const [tags,   setTags]   = useState<string[]>([])
  const [caption,setCaption]= useState("")
  const [saving, setSaving] = useState(false)

  async function handleApply() {
    if (mode === "tags" && tags.length === 0) return
    if (mode === "caption" && !caption.trim()) return
    setSaving(true)
    await onApply(mode === "tags" ? { addTags: tags } : { caption: caption.trim() })
    setSaving(false)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-sm rounded-2xl bg-[#0f0f1a] border border-white/[0.1] shadow-2xl p-5" onClick={e => e.stopPropagation()}>
        <div className="flex items-start justify-between mb-4">
          <div>
            <p className="text-sm font-semibold text-white">{mode === "tags" ? "Add tags" : "Set caption"}</p>
            <p className="text-[11px] text-slate-600 mt-0.5">
              {count} image{count !== 1 ? "s" : ""} · {mode === "tags" ? "merged with existing" : "replaces existing caption"}
            </p>
          </div>
          <button onClick={onClose} className="p-1 rounded hover:bg-white/[0.06] text-slate-600 hover:text-slate-300 transition-colors">
            <X size={14} />
          </button>
        </div>
        {mode === "tags"
          ? <TagInput tags={tags} onChange={setTags} suggestions={suggestions} />
          : <textarea value={caption} onChange={e => setCaption(e.target.value)}
              placeholder="Write a caption for these images…" rows={4} autoFocus
              className="w-full rounded-lg bg-white/[0.05] border border-white/[0.08] px-3 py-2 text-xs text-white placeholder:text-slate-600 focus:outline-none focus:border-cyan-500/40 resize-none"
            />
        }
        <div className="flex items-center gap-2 mt-4">
          <button onClick={handleApply}
            disabled={saving || (mode === "tags" ? tags.length === 0 : !caption.trim())}
            className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-cyan-500/20 border border-cyan-500/30 text-cyan-300 text-xs font-medium hover:bg-cyan-500/25 transition-all disabled:opacity-50">
            {saving && <Loader2 size={11} className="animate-spin" />}
            Apply
          </button>
          <button onClick={onClose} className="px-4 py-1.5 rounded-lg bg-white/[0.04] border border-white/[0.07] text-slate-500 hover:text-white text-xs transition-all">
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Auto-fill panel ──────────────────────────────────────────────────────────

type AutoFillMode  = 'caption' | 'tags'
type AutoFillModel = 'pro' | 'flash'

interface AutoFillEvent {
  type:       'start' | 'processing' | 'result' | 'skip' | 'error' | 'done'
  id?:        number
  current?:   number
  total?:     number
  value?:     string
  tags?:      string[]
  error?:     string
  reason?:    string
  processed?: number
  skipped?:   number
  failed?:    number
  modelId?:   string
}

interface FeedItem {
  id:        number
  value:     string
  tags?:     string[]
  imageUrl?: string
}

function cleanTagsClient(raw: string): string[] {
  return raw.split(',').map(t => t.trim().toLowerCase().replace(/[^a-z0-9-_]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '')).filter(t => t.length > 0 && t.length <= 40)
}

// ─── Persistence helpers (used by AutoFillPanel + DatasetPage) ────────────────

const PAGE_PREFS_KEY     = 'dataset-page-prefs'
const AUTOFILL_PREFS_KEY = 'dataset-autofill-prefs'

function loadPrefs(key: string): Record<string, any> {
  if (typeof window === 'undefined') return {}
  try { return JSON.parse(localStorage.getItem(key) || '{}') } catch { return {} }
}
function savePrefs(key: string, data: Record<string, any>) {
  try { localStorage.setItem(key, JSON.stringify(data)) } catch {}
}

function AutoFillPanel({ selected, imageUrlById, onClose, onItemSaved }: {
  selected:    Set<number>
  imageUrlById: Record<number, string>
  onClose:     () => void
  onItemSaved: (id: number, data: { caption?: string; tags?: string[] }) => void
}) {
  const count = selected.size

  // Config — lazy init from localStorage
  const [_ap] = useState(() => loadPrefs(AUTOFILL_PREFS_KEY))
  const [mode,        setMode]        = useState<AutoFillMode>(() => _ap.mode        ?? 'caption')
  const [model,       setModel]       = useState<AutoFillModel>(() => _ap.model       ?? 'flash')
  const [overwrite,   setOverwrite]   = useState<boolean>(() => _ap.overwrite   ?? false)
  const [advanced,    setAdvanced]    = useState<boolean>(() => _ap.advanced    ?? false)
  const [context,     setContext]     = useState<string>(() => _ap.context     ?? '')
  const [contextTags, setContextTags] = useState<string[]>(() => _ap.contextTags ?? [])
  const [tagInput,    setTagInput]    = useState('')

  // Persist config whenever it changes
  useEffect(() => {
    savePrefs(AUTOFILL_PREFS_KEY, { mode, model, overwrite, advanced, context, contextTags })
  }, [mode, model, overwrite, advanced, context, contextTags])

  // Run state
  const [phase,    setPhase]    = useState<'setup' | 'running' | 'done'>('setup')
  const [progress, setProgress] = useState(0)
  const [total,    setTotal]    = useState(0)
  const [summary,  setSummary]  = useState<{ processed: number; skipped: number; failed: number } | null>(null)
  const [currentId, setCurrentId] = useState<number | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  // Feed
  const [feedItems,  setFeedItems]  = useState<FeedItem[]>([])
  const [savingIds,  setSavingIds]  = useState<Set<number>>(new Set())
  const [editingId,  setEditingId]  = useState<number | null>(null)
  const [editValue,  setEditValue]  = useState('')
  const feedRef = useRef<HTMLDivElement>(null)

  async function run(ids: number[]) {
    setPhase('running')
    setProgress(0)
    setTotal(0)
    setSummary(null)
    setCurrentId(null)
    abortRef.current = new AbortController()

    try {
      const res = await fetch('/api/admin/auto-caption', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body:    JSON.stringify({
          ids, mode, model, overwrite, advanced,
          preview: true,
          context: context.trim() || undefined,
          contextTags: contextTags.length ? contextTags : undefined,
        }),
        signal: abortRef.current.signal,
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)

      const reader  = res.body!.getReader()
      const decoder = new TextDecoder()
      let   buffer  = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() ?? ''
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          try {
            const event = JSON.parse(line.slice(6)) as AutoFillEvent
            if (event.type === 'start')       setTotal(event.total ?? 0)
            if (event.current !== undefined)  setProgress(event.current)
            if (event.type === 'processing')  setCurrentId(event.id ?? null)
            if (event.type === 'result' && event.id) {
              const item: FeedItem = {
                id:       event.id,
                value:    event.value ?? '',
                tags:     event.tags,
                imageUrl: imageUrlById[event.id],
              }
              setFeedItems(prev => [item, ...prev])
              setCurrentId(null)
            }
            if (event.type === 'done') {
              setSummary({ processed: event.processed ?? 0, skipped: event.skipped ?? 0, failed: event.failed ?? 0 })
              setCurrentId(null)
              setPhase('done')
            }
          } catch {}
        }
      }
    } catch (err: any) {
      if (err.name !== 'AbortError') setSummary(s => s ?? { processed: 0, skipped: 0, failed: 1 })
      setPhase('done')
    }
  }

  async function saveItem(item: FeedItem, overrideValue?: string) {
    const finalValue = overrideValue ?? item.value
    const finalTags  = mode === 'tags' ? cleanTagsClient(finalValue) : undefined
    setSavingIds(prev => new Set(prev).add(item.id))
    try {
      const body = mode === 'caption'
        ? { ids: [item.id], caption: finalValue }
        : { ids: [item.id], tags: finalTags }
      await fetch('/api/admin/dataset', {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body:    JSON.stringify(body),
      })
      onItemSaved(item.id, mode === 'caption' ? { caption: finalValue } : { tags: finalTags })
      setFeedItems(prev => prev.filter(i => i.id !== item.id))
      if (editingId === item.id) setEditingId(null)
    } catch (e: any) {
      alert(`Save failed: ${e.message}`)
    } finally {
      setSavingIds(prev => { const n = new Set(prev); n.delete(item.id); return n })
    }
  }

  function skipItem(id: number) {
    setFeedItems(prev => prev.filter(i => i.id !== id))
    if (editingId === id) setEditingId(null)
  }

  function startEdit(item: FeedItem) {
    setEditingId(item.id)
    setEditValue(mode === 'tags' ? (item.tags ?? []).join(', ') : item.value)
  }

  const isLocked = phase === 'running'

  return (
    <div className="flex flex-col h-full">

      {/* Panel header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.06] shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-md bg-cyan-500/15 flex items-center justify-center">
            <Sparkles size={12} className="text-cyan-400" />
          </div>
          <div>
            <p className="text-xs font-semibold text-white leading-none">Auto Fill</p>
            <p className="text-[10px] text-slate-600 mt-0.5 leading-none">
              {count > 0 ? `${count} selected` : 'Select images on the right'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          {phase === 'running' && (
            <button onClick={() => abortRef.current?.abort()}
              className="px-2.5 py-1 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-[10px] hover:bg-red-500/15 transition-all">
              Stop
            </button>
          )}
          {phase !== 'setup' && (
            <button onClick={() => { abortRef.current?.abort(); setPhase('setup'); setFeedItems([]); setSummary(null); setProgress(0); setTotal(0) }}
              className="px-2.5 py-1 rounded-lg bg-white/[0.04] border border-white/[0.07] text-slate-500 hover:text-white text-[10px] transition-all">
              Reset
            </button>
          )}
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/[0.06] text-slate-600 hover:text-slate-300 transition-colors">
            <X size={14} />
          </button>
        </div>
      </div>

      {/* Config — always visible, locked during run */}
      <div className="shrink-0 px-4 pt-3 pb-2 space-y-3 border-b border-white/[0.05]">

        {/* Mode + Model row */}
        <div className="flex gap-2">
          {(['caption', 'tags'] as const).map(m => (
            <button key={m} onClick={() => !isLocked && setMode(m)}
              className={`flex-1 py-1.5 rounded-lg border text-[11px] font-medium transition-all
                ${mode === m
                  ? m === 'caption' ? 'bg-violet-500/15 border-violet-500/30 text-violet-300' : 'bg-cyan-500/15 border-cyan-500/30 text-cyan-300'
                  : 'bg-white/[0.03] border-white/[0.07] text-slate-500 hover:text-white'} ${isLocked ? 'opacity-50 cursor-not-allowed' : ''}`}>
              {m === 'caption' ? 'Caption' : 'Tags'}
            </button>
          ))}
        </div>

        <div className="flex gap-2">
          {([
            { key: 'flash', label: 'Flash Lite' },
            { key: 'pro',   label: 'Pro' },
          ] as const).map(m => (
            <button key={m.key} onClick={() => !isLocked && setModel(m.key)}
              className={`flex-1 py-1.5 rounded-lg border text-[11px] transition-all
                ${model === m.key ? 'bg-emerald-500/10 border-emerald-500/25 text-emerald-300' : 'bg-white/[0.03] border-white/[0.07] text-slate-500 hover:text-white'} ${isLocked ? 'opacity-50 cursor-not-allowed' : ''}`}>
              {m.label}
            </button>
          ))}
          {([
            { key: false, label: 'Basic' },
            { key: true,  label: 'Advanced' },
          ] as const).map(m => (
            <button key={String(m.key)} onClick={() => !isLocked && setAdvanced(m.key)}
              className={`flex-1 py-1.5 rounded-lg border text-[11px] transition-all
                ${advanced === m.key ? 'bg-violet-500/15 border-violet-500/30 text-violet-300' : 'bg-white/[0.03] border-white/[0.07] text-slate-500 hover:text-white'} ${isLocked ? 'opacity-50 cursor-not-allowed' : ''}`}>
              {m.label}
            </button>
          ))}
        </div>

        {/* Overwrite toggle + context (collapsed during run) */}
        {phase === 'setup' && (
          <>
            <div className="flex items-center justify-between">
              <p className="text-[11px] text-slate-500">Overwrite existing</p>
              <button onClick={() => setOverwrite(v => !v)}
                className={`w-8 h-4 rounded-full transition-colors relative ${overwrite ? 'bg-cyan-500' : 'bg-white/[0.1]'}`}>
                <span className={`absolute top-0.5 left-0.5 w-3 h-3 rounded-full bg-white transition-transform ${overwrite ? 'translate-x-4' : 'translate-x-0'}`} />
              </button>
            </div>

            {/* Context tags */}
            <div>
              <div className="flex flex-wrap gap-1 min-h-[24px] rounded-lg border border-white/[0.07] bg-white/[0.02] px-2 py-1.5">
                {contextTags.map(tag => (
                  <span key={tag} className="flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded-full bg-violet-500/10 border border-violet-500/20 text-violet-300">
                    {tag}
                    <button onClick={() => setContextTags(prev => prev.filter(t => t !== tag))} className="text-violet-500 hover:text-violet-300 ml-0.5">×</button>
                  </span>
                ))}
                <input
                  value={tagInput}
                  onChange={e => setTagInput(e.target.value)}
                  onKeyDown={e => {
                    if ((e.key === 'Enter' || e.key === ',') && tagInput.trim()) {
                      e.preventDefault()
                      const val = tagInput.trim().replace(/,$/, '')
                      if (val && !contextTags.includes(val)) setContextTags(prev => [...prev, val])
                      setTagInput('')
                    }
                    if (e.key === 'Backspace' && !tagInput && contextTags.length) setContextTags(prev => prev.slice(0, -1))
                  }}
                  placeholder={contextTags.length ? 'Add subject…' : 'Subject / context tags (Enter)'}
                  className="flex-1 min-w-[80px] bg-transparent text-[11px] text-white placeholder-slate-700 outline-none"
                />
              </div>
              {context || contextTags.length === 0 ? (
                <textarea value={context} onChange={e => setContext(e.target.value)}
                  placeholder="Optional: full context sentence…"
                  rows={1}
                  className="mt-1 w-full rounded-lg border border-white/[0.07] bg-white/[0.02] px-2 py-1.5 text-[11px] text-slate-300 placeholder-slate-700 outline-none resize-none"
                />
              ) : null}
            </div>
          </>
        )}

        {/* Start / progress */}
        {phase === 'setup' ? (
          <button
            onClick={() => { if (count > 0) run(Array.from(selected)) }}
            disabled={count === 0}
            className="w-full py-2 rounded-lg bg-gradient-to-r from-cyan-500/20 to-violet-500/20 border border-cyan-500/20 text-white text-xs font-semibold hover:from-cyan-500/30 hover:to-violet-500/30 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
          >
            {count === 0 ? 'Select images on the right →' : `Start Auto Fill (${count})`}
          </button>
        ) : (
          <div>
            <div className="flex items-center justify-between text-[10px] text-slate-600 mb-1">
              <span className="flex items-center gap-1.5">
                {phase === 'running' && <span className="w-1.5 h-1.5 rounded-full bg-cyan-500 animate-pulse" />}
                {phase === 'running'
                  ? currentId ? `Analyzing #${currentId}…` : 'Starting…'
                  : summary ? `Done · ${summary.processed} filled${summary.failed ? ` · ${summary.failed} failed` : ''}` : 'Complete'
                }
              </span>
              <span>{progress} / {total}</span>
            </div>
            <div className="h-1 rounded-full bg-white/[0.06] overflow-hidden">
              <div className={`h-full rounded-full transition-all duration-300 ${phase === 'done' ? 'bg-emerald-500' : 'bg-cyan-500'}`}
                style={{ width: total ? `${(progress / total) * 100}%` : '0%' }} />
            </div>
          </div>
        )}
      </div>

      {/* Feed */}
      {feedItems.length > 0 && (
        <div ref={feedRef} className="flex-1 overflow-y-auto p-3 space-y-2 min-h-0">
          <p className="text-[10px] text-slate-600 uppercase tracking-wider px-1 sticky top-0 bg-[#0a0a15] py-1">
            Review · {feedItems.length} pending
          </p>
          {feedItems.map(item => {
            const isSaving  = savingIds.has(item.id)
            const isEditing = editingId === item.id
            const isVideo   = item.imageUrl?.match(/\.(mp4|webm|mov)$/i)
            return (
              <div key={item.id} className="rounded-xl border border-white/[0.08] bg-white/[0.02] overflow-hidden">
                {/* Image + text */}
                <div className="flex gap-2.5 p-2.5">
                  <div className="w-16 h-16 shrink-0 rounded-lg overflow-hidden bg-white/[0.04] border border-white/[0.07]">
                    {item.imageUrl && !isVideo
                      ? <img src={item.imageUrl} alt="" className="w-full h-full object-cover" />
                      : <div className="w-full h-full flex items-center justify-center"><Video size={16} className="text-slate-600" /></div>
                    }
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[9px] text-slate-700 mb-1">#{item.id}</p>
                    {isEditing ? (
                      <textarea
                        value={editValue}
                        onChange={e => setEditValue(e.target.value)}
                        autoFocus
                        rows={3}
                        className="w-full bg-white/[0.05] border border-cyan-500/30 rounded-lg px-2 py-1.5 text-[11px] text-white outline-none resize-none"
                      />
                    ) : mode === 'tags' ? (
                      <div className="flex flex-wrap gap-0.5">
                        {(item.tags ?? []).map(t => (
                          <span key={t} className="text-[9px] px-1 py-0.5 rounded bg-cyan-500/10 text-cyan-400">{t}</span>
                        ))}
                      </div>
                    ) : (
                      <p className="text-[11px] text-slate-300 leading-relaxed line-clamp-3">{item.value}</p>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex border-t border-white/[0.05]">
                  {isEditing ? (
                    <>
                      <button onClick={() => saveItem(item, editValue)} disabled={isSaving}
                        className="flex-1 py-1.5 text-[10px] text-emerald-400 hover:bg-emerald-500/10 transition-colors disabled:opacity-50 font-medium">
                        {isSaving ? 'Saving…' : 'Save edit'}
                      </button>
                      <button onClick={() => setEditingId(null)}
                        className="flex-1 py-1.5 text-[10px] text-slate-500 hover:bg-white/[0.05] transition-colors border-l border-white/[0.05]">
                        Cancel
                      </button>
                    </>
                  ) : (
                    <>
                      <button onClick={() => saveItem(item)} disabled={isSaving}
                        className="flex-1 py-1.5 text-[10px] text-emerald-400 hover:bg-emerald-500/10 transition-colors disabled:opacity-50 font-medium">
                        {isSaving ? 'Saving…' : '✓ Save'}
                      </button>
                      <button onClick={() => startEdit(item)}
                        className="flex-1 py-1.5 text-[10px] text-slate-500 hover:bg-white/[0.05] hover:text-slate-300 transition-colors border-l border-white/[0.05]">
                        Edit
                      </button>
                      <button onClick={() => skipItem(item.id)}
                        className="flex-1 py-1.5 text-[10px] text-slate-600 hover:bg-red-500/10 hover:text-red-400 transition-colors border-l border-white/[0.05]">
                        Skip
                      </button>
                    </>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Empty feed state during/after run */}
      {phase !== 'setup' && feedItems.length === 0 && (
        <div className="flex-1 flex items-center justify-center text-center p-6">
          {phase === 'running'
            ? <p className="text-[11px] text-slate-600">Results will appear here as they complete…</p>
            : <p className="text-[11px] text-slate-600">All results reviewed.</p>
          }
        </div>
      )}
    </div>
  )
}

// ─── Add-to-bucket modal ──────────────────────────────────────────────────────

function AddToBucketModal({ count, buckets, onClose, onAdd, onCreateAndAdd }: {
  count:          number
  buckets:        Bucket[]
  onClose:        () => void
  onAdd:          (bucketId: number) => Promise<void>
  onCreateAndAdd: (name: string) => Promise<void>
}) {
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [newName,    setNewName]    = useState("")
  const [creating,   setCreating]   = useState(false)
  const [saving,     setSaving]     = useState(false)

  async function handleApply() {
    if (creating) {
      if (!newName.trim()) return
      setSaving(true)
      await onCreateAndAdd(newName.trim())
      setSaving(false)
      onClose()
    } else {
      if (selectedId === null) return
      setSaving(true)
      await onAdd(selectedId)
      setSaving(false)
      onClose()
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-sm rounded-2xl bg-[#0f0f1a] border border-white/[0.1] shadow-2xl p-5" onClick={e => e.stopPropagation()}>
        <div className="flex items-start justify-between mb-4">
          <div>
            <p className="text-sm font-semibold text-white">Add to Bucket</p>
            <p className="text-[11px] text-slate-600 mt-0.5">{count} image{count !== 1 ? "s" : ""}</p>
          </div>
          <button onClick={onClose} className="p-1 rounded hover:bg-white/[0.06] text-slate-600 hover:text-slate-300 transition-colors"><X size={14} /></button>
        </div>

        {/* Existing buckets */}
        {buckets.length > 0 && !creating && (
          <div className="space-y-1 max-h-52 overflow-y-auto mb-3">
            {buckets.map(b => (
              <button key={b.id} onClick={() => setSelectedId(b.id)}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg border text-left transition-all
                  ${selectedId === b.id
                    ? "bg-violet-500/15 border-violet-500/30 text-white"
                    : "bg-white/[0.03] border-white/[0.06] text-slate-400 hover:text-white hover:border-white/15"}`}>
                <div className="w-7 h-7 rounded-lg bg-violet-500/20 flex items-center justify-center shrink-0">
                  <FolderOpen size={13} className="text-violet-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium truncate">{b.name}</p>
                  <p className="text-[10px] text-slate-600">{b.count} image{b.count !== 1 ? "s" : ""}</p>
                </div>
                {selectedId === b.id && <CheckSquare size={13} className="text-violet-400 shrink-0" />}
              </button>
            ))}
          </div>
        )}

        {/* New bucket input */}
        {creating ? (
          <div className="space-y-2 mb-3">
            <input value={newName} onChange={e => setNewName(e.target.value)} placeholder="Bucket name…" autoFocus
              onKeyDown={e => e.key === 'Enter' && handleApply()}
              className="w-full px-3 py-2 rounded-lg bg-white/[0.05] border border-white/[0.08] text-xs text-white placeholder:text-slate-600 focus:outline-none focus:border-violet-500/40" />
            <button onClick={() => { setCreating(false); setNewName("") }} className="text-[11px] text-slate-600 hover:text-slate-400 transition-colors">
              ← Back to existing
            </button>
          </div>
        ) : (
          <button onClick={() => setCreating(true)}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg border border-dashed border-white/[0.1] text-slate-600 hover:text-slate-300 hover:border-white/25 text-xs transition-all mb-3">
            <FolderPlus size={12} /> Create new bucket
          </button>
        )}

        <div className="flex gap-2">
          <button onClick={handleApply}
            disabled={saving || (creating ? !newName.trim() : selectedId === null)}
            className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-violet-500/20 border border-violet-500/30 text-violet-300 text-xs font-medium hover:bg-violet-500/25 transition-all disabled:opacity-50">
            {saving && <Loader2 size={11} className="animate-spin" />}
            {creating ? "Create & Add" : "Add to Bucket"}
          </button>
          <button onClick={onClose} className="px-4 py-1.5 rounded-lg bg-white/[0.04] border border-white/[0.07] text-slate-500 hover:text-white text-xs transition-all">
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Image card ───────────────────────────────────────────────────────────────

const ImageCard = memo(function ImageCard({ img, selected, selectMode, onSelect, onOpen, onToggleMark, index }: {
  img: ImageRecord
  selected: boolean
  selectMode: boolean
  onSelect: (id: number) => void
  onOpen: (img: ImageRecord) => void
  onToggleMark: (id: number, current: boolean) => void
  index: number
}) {
  const [imgError, setImgError] = useState(false)
  const isVideo = img.imageUrl?.match(/\.(mp4|webm|mov)$/i)
  const priority = index < 6

  function handleClick() {
    if (selectMode) onSelect(img.id)
    else onOpen(img)
  }

  return (
    <div
      onClick={handleClick}
      className={`group relative rounded-xl overflow-hidden border transition-all cursor-pointer
        ${selected
          ? "border-cyan-500/60 ring-1 ring-cyan-500/30"
          : img.markedForTraining
            ? "border-emerald-500/40 hover:border-emerald-400/60"
            : "border-white/[0.07] hover:border-white/20"
        } bg-white/[0.03]`}
    >
      <div className="relative aspect-square bg-white/[0.03]">
        {isVideo ? (
          <>
            {img.videoMetadata?.thumbnailUrl ? (
              <img src={img.videoMetadata.thumbnailUrl} alt="" className="w-full h-full object-cover" loading={priority ? 'eager' : 'lazy'} decoding="async" fetchPriority={priority ? 'high' : 'low'} />
            ) : (
              <div className="absolute inset-0 flex items-center justify-center bg-violet-950/30">
                <Sparkles size={24} className="text-violet-400" />
              </div>
            )}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="w-8 h-8 rounded-full bg-black/60 flex items-center justify-center">
                <Video size={14} className="text-white ml-0.5" />
              </div>
            </div>
          </>
        ) : imgError ? (
          <div className="absolute inset-0 flex items-center justify-center">
            <ImageIcon size={20} className="text-slate-700" />
          </div>
        ) : (
          <img src={img.imageUrl} alt="" className="w-full h-full object-cover" onError={() => setImgError(true)} loading={priority ? 'eager' : 'lazy'} decoding="async" fetchPriority={priority ? 'high' : 'low'} />
        )}

        {/* Checkbox — always visible in select mode, hover-only otherwise */}
        {selectMode && (
          <div className="absolute top-1.5 left-1.5 z-10">
            {selected
              ? <CheckSquare size={16} className="text-cyan-400 drop-shadow-md" />
              : <Square      size={16} className="text-white/60 drop-shadow-md" />
            }
          </div>
        )}

        {/* Training mark (top-right) */}
        <button
          className={`absolute top-1.5 right-1.5 z-10 p-1 rounded-md transition-all
            ${img.markedForTraining ? "bg-emerald-500/80 opacity-100" : "bg-black/50 opacity-0 group-hover:opacity-100"}`}
          onClick={e => { e.stopPropagation(); onToggleMark(img.id, img.markedForTraining) }}
          title={img.markedForTraining ? "Remove from training set" : "Mark for training"}
        >
          <BookMarked size={11} className={img.markedForTraining ? "text-white" : "text-white/80"} />
        </button>

        {/* Ref count (bottom-left) */}
        {img.referenceImageUrls.length > 0 && (
          <div className="absolute bottom-1.5 left-1.5 px-1.5 py-0.5 rounded-md bg-black/60 text-[9px] text-slate-300 leading-none">
            {img.referenceImageUrls.length}ref
          </div>
        )}

        {/* Rating (bottom-right) */}
        {img.imageRating && (
          <div className="absolute bottom-1.5 right-1.5 flex items-center gap-0.5">
            {[1,2,3,4,5].map(i => (
              <Star key={i} size={8} className={i <= img.imageRating!.score ? "text-amber-400 fill-amber-400" : "text-slate-700"} />
            ))}
          </div>
        )}
      </div>

      {/* Metadata row */}
      <div className="px-2 py-1.5 space-y-1">
        <p className="text-[10px] text-slate-400 leading-snug line-clamp-2">{img.prompt}</p>

        {img.adminTags.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {img.adminTags.slice(0, 3).map(tag => (
              <span key={tag} className="flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-cyan-500/10 border border-cyan-500/15 text-cyan-400 text-[9px] leading-none">
                <Hash size={7} />{tag}
              </span>
            ))}
            {img.adminTags.length > 3 && <span className="text-[9px] text-slate-600">+{img.adminTags.length - 3}</span>}
          </div>
        )}

        {img.adminCaption && (
          <p className="text-[9px] text-slate-600 italic truncate">"{img.adminCaption}"</p>
        )}

        <div className="flex items-center gap-1.5 flex-wrap">
          {img.model === '__upload__' ? (
            <>
              <span className="text-[9px] px-1.5 py-0.5 rounded bg-violet-500/15 text-violet-400 leading-none">upload</span>
              {img.aspectRatio && <span className="text-[9px] text-slate-600">{img.aspectRatio}</span>}
              <span className="text-[9px] text-slate-700 ml-auto truncate max-w-[80px]">{((img.videoMetadata as any)?.originalFilename ?? '').slice(0, 20) || '—'}</span>
            </>
          ) : (
            <>
              <span className="text-[9px] px-1.5 py-0.5 rounded bg-white/[0.06] text-slate-500 leading-none">{img.model.replace('fal-ai/', '').slice(0, 16)}</span>
              {img.aspectRatio && <span className="text-[9px] text-slate-600">{img.aspectRatio}</span>}
              <span className="text-[9px] text-slate-700 ml-auto">{img.ticketCost}t</span>
            </>
          )}
        </div>
        <p className="text-[9px] text-slate-700 truncate">{img.user.email}</p>
      </div>
    </div>
  )
}, (prev, next) =>
  prev.selected      === next.selected      &&
  prev.selectMode    === next.selectMode    &&
  prev.img           === next.img           &&
  prev.index         === next.index         &&
  prev.onSelect      === next.onSelect      &&
  prev.onOpen        === next.onOpen        &&
  prev.onToggleMark  === next.onToggleMark
)

// ─── Main page ────────────────────────────────────────────────────────────────

export default function DatasetPage() {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [sessionChecked,  setSessionChecked]  = useState(false)

  // Load persisted prefs once on mount
  const [_p] = useState(() => loadPrefs(PAGE_PREFS_KEY))

  // Data
  const [images,     setImages]     = useState<ImageRecord[]>([])
  const [pagination, setPagination] = useState<Pagination | null>(null)
  const [facets,     setFacets]     = useState<Facets | null>(null)
  const [loading,    setLoading]    = useState(false)
  const [error,      setError]      = useState("")

  // Modes & modals
  const [selectMode, setSelectMode] = useState(false)
  const [selected,   setSelected]   = useState<Set<number>>(new Set())
  const [detailImg,  setDetailImg]  = useState<ImageRecord | null>(null)
  const [bulkMode,   setBulkMode]   = useState<"tags" | "caption" | null>(null)
  const [autoFillOpen,    setAutoFillOpen]    = useState<boolean>(() => _p.autoFillOpen ?? false)
  const [addToBucketOpen, setAddToBucketOpen] = useState(false)

  // Buckets
  const [buckets,          setBuckets]          = useState<Bucket[]>([])
  const [bucketFilter,     setBucketFilter]     = useState<string>(() => _p.bucketFilter ?? "")
  const [bucketMenuId,     setBucketMenuId]     = useState<number | null>(null)
  const [renamingId,       setRenamingId]       = useState<number | null>(null)
  const [uploadsBucketId,  setUploadsBucketId]  = useState<number | null>(null)
  const [uploadModalOpen,  setUploadModalOpen]  = useState(false)
  const [renameValue,   setRenameValue]   = useState("")

  // Filters
  const [search,       setSearch]       = useState<string>(() => _p.search       ?? "")
  const [models,       setModels]       = useState<string[]>(() => _p.models      ?? [])
  const [aspectRatios, setAspectRatios] = useState<string[]>(() => _p.aspectRatios ?? [])
  const [qualities,    setQualities]    = useState<string[]>(() => _p.qualities   ?? [])
  const [hasRefs,      setHasRefs]      = useState<string>(() => _p.hasRefs       ?? "")
  const [hasRating,    setHasRating]    = useState<string>(() => _p.hasRating     ?? "")
  const [hasCaption,   setHasCaption]   = useState<string>(() => _p.hasCaption    ?? "")
  const [hasTag,       setHasTag]       = useState<string>(() => _p.hasTag        ?? "")
  const [tagFilter,    setTagFilter]    = useState<string>(() => _p.tagFilter     ?? "")
  const [userFilters,  setUserFilters]  = useState<string[]>(() => _p.userFilters ?? [])
  const [mediaType,    setMediaType]    = useState<string>(() => _p.mediaType     ?? "")
  const [markedOnly,   setMarkedOnly]   = useState<boolean>(() => _p.markedOnly   ?? false)
  const [sort,         setSort]         = useState<string>(() => _p.sort          ?? "newest")
  const [pageSize,     setPageSize]     = useState<number>(() => _p.pageSize      ?? 20)
  const [page,         setPage]         = useState<number>(() => _p.page          ?? 1)
  const [filtersOpen,  setFiltersOpen]  = useState<boolean>(() => _p.filtersOpen  ?? false)

  const searchTimer    = useRef<ReturnType<typeof setTimeout> | null>(null)
  const isMountedRef   = useRef(false)
  const [debouncedSearch, setDebouncedSearch] = useState<string>(() => _p.search ?? "")

  const [bulkLoading,      setBulkLoading]      = useState(false)
  const [exporting,        setExporting]        = useState(false)
  const [selectAllLoading, setSelectAllLoading] = useState(false)

  // ── Auth ────────────────────────────────────────────────────────────────────
  useEffect(() => {
    setIsAuthenticated(localStorage.getItem("multiverse-admin-auth") === "true" && !!sessionStorage.getItem("admin-password"))
    setSessionChecked(true)
    // Mark as mounted so filter effects skip their first-run page reset
    isMountedRef.current = true
  }, [])

  // ── Close bucket menu on outside click ───────────────────────────────────────
  useEffect(() => {
    if (bucketMenuId === null) return
    function handler() { setBucketMenuId(null) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [bucketMenuId])

  // ── Load buckets ─────────────────────────────────────────────────────────────
  const loadBuckets = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/buckets', { headers: authHeaders() })
      if (!res.ok) return
      let list: Bucket[] = await res.json()

      // Ensure the permanent Uploads bucket exists
      let uploadsBucket = list.find(b => b.name === UPLOADS_BUCKET_NAME)
      if (!uploadsBucket) {
        const cr = await fetch('/api/admin/buckets', {
          method: 'POST',
          headers: { ...authHeaders(), 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: UPLOADS_BUCKET_NAME, description: 'Admin-uploaded training images', color: '#7c3aed' }),
        })
        if (cr.ok) {
          const created = await cr.json()
          uploadsBucket = { ...created, count: 0 }
          list = [uploadsBucket!, ...list]
        }
      }

      if (uploadsBucket) setUploadsBucketId(uploadsBucket.id)
      // Always show uploads bucket first
      setBuckets([
        ...(uploadsBucket ? [uploadsBucket] : []),
        ...list.filter(b => b.name !== UPLOADS_BUCKET_NAME),
      ])
    } catch {}
  }, [])

  useEffect(() => { if (isAuthenticated) loadBuckets() }, [isAuthenticated, loadBuckets])

  // ── Persist prefs to localStorage ───────────────────────────────────────────
  useEffect(() => {
    savePrefs(PAGE_PREFS_KEY, {
      search, models, aspectRatios, qualities, hasRefs, hasRating, hasCaption, hasTag,
      tagFilter, userFilters, mediaType, markedOnly, sort, pageSize, page,
      bucketFilter, filtersOpen, autoFillOpen,
    })
  }, [search, models, aspectRatios, qualities, hasRefs, hasRating, hasCaption, hasTag,
      tagFilter, userFilters, mediaType, markedOnly, sort, pageSize, page,
      bucketFilter, filtersOpen, autoFillOpen])

  // ── Search debounce ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (searchTimer.current) clearTimeout(searchTimer.current)
    searchTimer.current = setTimeout(() => {
      setDebouncedSearch(search)
      if (isMountedRef.current) setPage(1)
    }, 400)
    return () => { if (searchTimer.current) clearTimeout(searchTimer.current) }
  }, [search])

  // ── Reset page on filter change (skip on first mount) ────────────────────────
  const filterResetDeps = [models, aspectRatios, qualities, hasRefs, hasRating, hasCaption, hasTag, tagFilter, userFilters, mediaType, markedOnly, bucketFilter, sort, pageSize]
  useEffect(() => {
    if (isMountedRef.current) setPage(1)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, filterResetDeps)

  // ── Exit select mode when selection is cleared ───────────────────────────────
  useEffect(() => { if (selected.size === 0 && selectMode) { /* keep mode on intentionally */ } }, [selected])

  // ── Fetch ────────────────────────────────────────────────────────────────────
  const fetchData = useCallback(async () => {
    if (!isAuthenticated) return
    setLoading(true); setError(""); setSelected(new Set())
    try {
      const params = new URLSearchParams({ page: String(page), limit: String(pageSize), sort })
      models.forEach(m => params.append('model', m))
      aspectRatios.forEach(a => params.append('aspectRatio', a))
      qualities.forEach(q => params.append('quality', q))
      userFilters.forEach(u => params.append('userId', u))
      if (hasRefs)        params.set('hasRefs',   hasRefs)
      if (hasRating)      params.set('hasRating', hasRating)
      if (hasCaption)     params.set('hasCaption', hasCaption)
      if (hasTag)         params.set('hasTag',     hasTag)
      if (tagFilter)      params.set('tagFilter',  tagFilter)
      if (mediaType)      params.set('mediaType',  mediaType)
      if (bucketFilter)   params.set('bucketId',   bucketFilter)
      if (markedOnly)     params.set('markedOnly', 'true')
      if (debouncedSearch) params.set('search',    debouncedSearch)
      const res  = await fetch(`/api/admin/dataset?${params}`, { headers: authHeaders() })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      setImages(data.images); setPagination(data.pagination); setFacets(data.facets)
    } catch (e: any) { setError(e.message) }
    finally { setLoading(false) }
  }, [isAuthenticated, page, pageSize, sort, models, aspectRatios, qualities, userFilters, hasRefs, hasRating, hasCaption, hasTag, tagFilter, bucketFilter, markedOnly, debouncedSearch])

  useEffect(() => { fetchData() }, [fetchData])

  // ── Patch helper ─────────────────────────────────────────────────────────────
  async function patch(body: object) {
    const res = await fetch('/api/admin/dataset', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify(body),
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    return res.json()
  }

  // ── Toggle training mark ──────────────────────────────────────────────────────
  async function toggleMark(ids: number[], marked: boolean) {
    setBulkLoading(true)
    try {
      await patch({ ids, marked })
      setImages(prev => prev.map(img => ids.includes(img.id) ? { ...img, markedForTraining: marked } : img))
      setSelected(new Set())
    } catch (e: any) { alert(`Failed: ${e.message}`) }
    finally { setBulkLoading(false) }
  }

  // Stable ref for per-card mark toggle — avoids breaking ImageCard memo
  const handleCardToggleMark = useCallback((id: number, current: boolean) => {
    const doToggle = async () => {
      try {
        const marked = !current
        await fetch('/api/admin/dataset', {
          method:  'PATCH',
          headers: { 'Content-Type': 'application/json', ...authHeaders() },
          body:    JSON.stringify({ ids: [id], marked }),
        })
        setImages(prev => prev.map(img => img.id === id ? { ...img, markedForTraining: marked } : img))
      } catch {}
    }
    doToggle()
  }, [])

  // ── Save from detail modal ────────────────────────────────────────────────────
  async function saveDetail(id: number, tags: string[], caption: string | null, marked: boolean) {
    await patch({ ids: [id], tags, caption, marked })
    setImages(prev => prev.map(img =>
      img.id === id ? { ...img, adminTags: tags, adminCaption: caption, markedForTraining: marked } : img
    ))
    if (detailImg?.id === id) setDetailImg(prev => prev ? { ...prev, adminTags: tags, adminCaption: caption, markedForTraining: marked } : prev)
  }

  // ── Bulk tag / caption ────────────────────────────────────────────────────────
  async function applyBulk(data: { addTags?: string[]; caption?: string }) {
    const ids = Array.from(selected)
    setBulkLoading(true)
    try {
      await patch({ ids, ...data })
      setImages(prev => prev.map(img => {
        if (!ids.includes(img.id)) return img
        let next = { ...img }
        if (data.addTags)            next.adminTags    = [...new Set([...img.adminTags, ...data.addTags])]
        if (data.caption !== undefined) next.adminCaption = data.caption || null
        return next
      }))
      setSelected(new Set())
    } catch (e: any) { alert(`Failed: ${e.message}`) }
    finally { setBulkLoading(false) }
  }

  // ── Selection helpers ────────────────────────────────────────────────────────
  const toggleSelect = useCallback((id: number) => {
    setSelected(prev => {
      const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next
    })
  }, [])

  function selectAll() { setSelected(new Set(images.map(i => i.id))) }

  async function selectAllRecords() {
    setSelectAllLoading(true)
    try {
      const params = new URLSearchParams({ idsOnly: "true", sort })
      models.forEach(m => params.append('model', m))
      aspectRatios.forEach(a => params.append('aspectRatio', a))
      qualities.forEach(q => params.append('quality', q))
      userFilters.forEach(u => params.append('userId', u))
      if (hasRefs)        params.set('hasRefs',   hasRefs)
      if (hasRating)      params.set('hasRating', hasRating)
      if (hasCaption)     params.set('hasCaption', hasCaption)
      if (hasTag)         params.set('hasTag',     hasTag)
      if (tagFilter)      params.set('tagFilter',  tagFilter)
      if (mediaType)      params.set('mediaType',  mediaType)
      if (bucketFilter)   params.set('bucketId',   bucketFilter)
      if (markedOnly)     params.set('markedOnly', 'true')
      if (debouncedSearch) params.set('search',    debouncedSearch)
      const res  = await fetch(`/api/admin/dataset?${params}`, { headers: authHeaders() })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const { ids } = await res.json()
      setSelected(new Set(ids as number[]))
    } catch (e: any) { alert(`Failed: ${e.message}`) }
    finally { setSelectAllLoading(false) }
  }

  // ── Export ───────────────────────────────────────────────────────────────────
  async function handleExport() {
    setExporting(true)
    try {
      const params = new URLSearchParams({ export: "true", sort })
      models.forEach(m => params.append('model', m))
      aspectRatios.forEach(a => params.append('aspectRatio', a))
      qualities.forEach(q => params.append('quality', q))
      userFilters.forEach(u => params.append('userId', u))
      if (hasRefs)        params.set('hasRefs',   hasRefs)
      if (hasRating)      params.set('hasRating', hasRating)
      if (hasCaption)     params.set('hasCaption', hasCaption)
      if (hasTag)         params.set('hasTag',     hasTag)
      if (tagFilter)      params.set('tagFilter',  tagFilter)
      if (mediaType)      params.set('mediaType',  mediaType)
      if (bucketFilter)   params.set('bucketId',   bucketFilter)
      if (markedOnly)     params.set('markedOnly', 'true')
      if (debouncedSearch) params.set('search',    debouncedSearch)
      const res  = await fetch(`/api/admin/dataset?${params}`, { headers: authHeaders() })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const blob = await res.blob()
      const url  = URL.createObjectURL(blob)
      const a    = document.createElement('a')
      a.href = url; a.download = `dataset-${new Date().toISOString().slice(0, 10)}.json`; a.click()
      URL.revokeObjectURL(url)
    } catch (e: any) { alert(`Export failed: ${e.message}`) }
    finally { setExporting(false) }
  }

  // ── Bucket helpers ────────────────────────────────────────────────────────────
  async function addToBucket(bucketId: number) {
    const ids = Array.from(selected)
    const res = await fetch(`/api/admin/buckets/${bucketId}/images`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify({ imageIds: ids }),
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    await loadBuckets()
    setSelected(new Set())
  }

  async function createAndAddToBucket(name: string) {
    const createRes = await fetch('/api/admin/buckets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify({ name }),
    })
    if (!createRes.ok) throw new Error(`HTTP ${createRes.status}`)
    const bucket: Bucket = await createRes.json()
    await addToBucket(bucket.id)
    await loadBuckets()
  }

  async function deleteBucket(id: number) {
    if (!confirm('Delete this bucket? Images are not deleted.')) return
    await fetch(`/api/admin/buckets/${id}`, { method: 'DELETE', headers: authHeaders() })
    if (bucketFilter === String(id)) setBucketFilter("")
    await loadBuckets()
    setBucketMenuId(null)
  }

  async function renameBucket(id: number) {
    if (!renameValue.trim()) return
    await fetch(`/api/admin/buckets/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify({ name: renameValue.trim() }),
    })
    setRenamingId(null)
    setRenameValue("")
    await loadBuckets()
  }

  async function createBucket() {
    const name = prompt('Bucket name:')?.trim()
    if (!name) return
    const res = await fetch('/api/admin/buckets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify({ name }),
    })
    if (res.ok) await loadBuckets()
  }

  // ── Deferred image list — keeps UI responsive while grid re-renders ───────────
  const deferredImages = useDeferredValue(images)

  // ── Derived values (all useMemo MUST be before any early return) ─────────────
  const selectedArr      = useMemo(() => Array.from(selected), [selected])
  const imageMarkedById  = useMemo(() => {
    const m: Record<number, boolean> = {}
    images.forEach(i => { m[i.id] = i.markedForTraining })
    return m
  }, [images])
  const allPageMarked    = useMemo(
    () => selectedArr.length > 0 && selectedArr.every(id => imageMarkedById[id]),
    [selectedArr, imageMarkedById]
  )
  const tagSuggestions   = useMemo(() => facets?.tags.map(t => t.value) ?? [], [facets?.tags])
  const hasActiveFilters = useMemo(
    () => !!(models.length || aspectRatios.length || qualities.length || hasRefs || hasRating || hasCaption || hasTag || tagFilter || userFilters.length || mediaType || bucketFilter || markedOnly || search),
    [models, aspectRatios, qualities, hasRefs, hasRating, hasCaption, hasTag, tagFilter, userFilters, mediaType, bucketFilter, markedOnly, search]
  )
  const pageStats = useMemo(() => ({
    marked:    images.filter(i => i.markedForTraining).length,
    tagged:    images.filter(i => i.adminTags.length > 0).length,
    captioned: images.filter(i => i.adminCaption).length,
  }), [images])
  const modelOptions      = useMemo(() => (facets?.models    ?? []).map(m => ({ value: m.value,       label: `${m.value.replace('fal-ai/', '')} (${m.count})` })), [facets?.models])
  const aspectOptions     = useMemo(() => (facets?.aspects   ?? []).map(a => ({ value: a.value ?? '', label: `${a.value} (${a.count})` })),                          [facets?.aspects])
  const qualityOptions    = useMemo(() => (facets?.qualities ?? []).map(q => ({ value: q.value ?? '', label: `${q.value} (${q.count})` })),                          [facets?.qualities])
  const userOptions       = useMemo(() => (facets?.users     ?? []).map(u => ({ value: String(u.id), label: `${u.name ? `${u.name} · ` : ''}${u.email} (${u.count})` })), [facets?.users])
  const sortOptions       = useMemo(() => [{ value: "newest", label: "Newest first" }, { value: "oldest", label: "Oldest first" }, { value: "rating", label: "Highest rated" }, { value: "cost", label: "Highest cost" }], [])
  const mediaTypeOptions  = useMemo(() => [{ value: "", label: "Images & videos" }, { value: "image", label: "Images only" }, { value: "video", label: "Videos only" }], [])
  const hasRefsOptions    = useMemo(() => [{ value: "", label: "Refs: any" },    { value: "true", label: "Has refs" },    { value: "false", label: "No refs" }],    [])
  const hasRatingOptions  = useMemo(() => [{ value: "", label: "Rating: any" },  { value: "true", label: "Has rating" },  { value: "false", label: "Not rated" }],  [])
  const hasCaptionOptions = useMemo(() => [{ value: "", label: "Caption: any" }, { value: "true", label: "Has caption" }, { value: "false", label: "No caption" }], [])
  const hasTagOptions     = useMemo(() => [{ value: "", label: "Tags: any" },    { value: "true", label: "Has tags" },    { value: "false", label: "No tags" }],    [])
  const tagFilterOptions  = useMemo(() => [{ value: "", label: "Filter by tag…" }, ...(facets?.tags ?? []).map(t => ({ value: t.value, label: `#${t.value} (${t.count})` }))], [facets?.tags])
  const autoFillImageUrlById = useMemo(
    () => Object.fromEntries(images.map(img => [img.id, (img.videoMetadata as any)?.thumbnailUrl || img.imageUrl])),
    [images]
  )

  // ── Auth gate (after all hooks) ───────────────────────────────────────────────
  if (!sessionChecked) return (
    <div className="min-h-screen bg-[#09090f] flex items-center justify-center">
      <Loader2 size={20} className="text-slate-600 animate-spin" />
    </div>
  )
  if (!isAuthenticated) return (
    <div className="min-h-screen bg-[#09090f] flex items-center justify-center p-6">
      <div className="text-center">
        <p className="text-slate-400 mb-4">Admin access required.</p>
        <button onClick={() => window.location.href = '/admin'}
          className="px-4 py-2 rounded-xl bg-white/[0.06] border border-white/10 text-sm text-slate-300 hover:text-white transition-colors">
          Go to Admin
        </button>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-[#09090f] text-white flex">

      {/* ── Auto Fill side panel ── */}
      {autoFillOpen && (
        <aside className="w-[340px] shrink-0 h-screen sticky top-0 border-r border-white/[0.06] bg-[#0a0a15] flex flex-col">
          <AutoFillPanel
            selected={selected}
            imageUrlById={autoFillImageUrlById}
            onClose={() => setAutoFillOpen(false)}
            onItemSaved={(id, data) => {
              setImages(prev => prev.map(img => {
                if (img.id !== id) return img
                return {
                  ...img,
                  ...(data.caption !== undefined && { adminCaption: data.caption }),
                  ...(data.tags    !== undefined && { adminTags:    data.tags    }),
                }
              }))
            }}
          />
        </aside>
      )}

      {/* ── Main content column ── */}
      <div className={`flex flex-col min-w-0 flex-1 ${autoFillOpen ? 'h-screen overflow-y-auto' : 'min-h-screen'}`}>

      {/* Modals */}
      {uploadModalOpen && uploadsBucketId && (
        <UploadModal
          bucketId={uploadsBucketId}
          suggestions={tagSuggestions}
          onClose={() => setUploadModalOpen(false)}
          onUploaded={() => { loadBuckets(); fetchData() }}
        />
      )}
      {detailImg && (
        <DetailModal
          img={detailImg}
          suggestions={tagSuggestions}
          onClose={() => setDetailImg(null)}
          onSave={saveDetail}
        />
      )}
      {bulkMode && (
        <BulkModal
          mode={bulkMode}
          count={selected.size}
          suggestions={tagSuggestions}
          onClose={() => setBulkMode(null)}
          onApply={applyBulk}
        />
      )}
      {addToBucketOpen && (
        <AddToBucketModal
          count={selected.size}
          buckets={buckets}
          onClose={() => setAddToBucketOpen(false)}
          onAdd={addToBucket}
          onCreateAndAdd={createAndAddToBucket}
        />
      )}

      {/* ── Header ── */}
      <div className="sticky top-0 z-30 bg-[#09090f]/90 backdrop-blur border-b border-white/[0.06]">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center gap-3">
          <button onClick={() => window.location.href = '/admin'}
            className="p-1.5 rounded-lg hover:bg-white/[0.06] text-slate-500 hover:text-white transition-colors">
            <ArrowLeft size={16} />
          </button>

          <div className="flex items-center gap-2 flex-1">
            <div className="w-7 h-7 rounded-lg bg-cyan-500/15 flex items-center justify-center">
              <Database size={14} className="text-cyan-400" />
            </div>
            <div>
              <h1 className="text-sm font-bold text-white leading-none">Dataset</h1>
              <p className="text-[10px] text-slate-600 leading-none mt-0.5">
                {pagination ? `${pagination.total.toLocaleString()} records` : "Loading…"}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Page stats */}
            {pagination && (
              <div className="hidden sm:flex items-center gap-3 px-3 py-1.5 rounded-lg bg-white/[0.03] border border-white/[0.07] text-[11px]">
                <span className="text-emerald-400/80">{pageStats.marked} marked</span>
                <span className="text-cyan-400/70">{pageStats.tagged} tagged</span>
                <span className="text-violet-400/70">{pageStats.captioned} captioned</span>
              </div>
            )}

            {/* Page size */}
            <div className="flex items-center rounded-lg border border-white/[0.07] overflow-hidden">
              {[12, 20, 30].map(n => (
                <button key={n} onClick={() => setPageSize(n)}
                  className={`px-2.5 py-1.5 text-[11px] transition-colors ${pageSize === n ? 'bg-white/[0.08] text-white' : 'text-slate-500 hover:text-white'}`}>
                  {n}
                </button>
              ))}
            </div>

            {/* Select mode toggle */}
            <button
              onClick={() => { setSelectMode(v => !v); setSelected(new Set()) }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-[11px] transition-all
                ${selectMode
                  ? "bg-cyan-500/15 border-cyan-500/40 text-cyan-300"
                  : "bg-white/[0.03] border-white/[0.07] text-slate-400 hover:text-white"}`}
            >
              {selectMode
                ? <><CheckSquare size={12} /> Selecting</>
                : <><MousePointer2 size={12} /> Select</>
              }
            </button>

            <button onClick={() => setFiltersOpen(v => !v)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-[11px] transition-all
                ${filtersOpen || hasActiveFilters
                  ? "bg-cyan-500/10 border-cyan-500/30 text-cyan-300"
                  : "bg-white/[0.03] border-white/[0.07] text-slate-400 hover:text-white"}`}
            >
              <SlidersHorizontal size={12} />
              Filters{hasActiveFilters ? " •" : ""}
            </button>

            <button onClick={() => setAutoFillOpen(v => !v)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-[11px] transition-all
                ${autoFillOpen
                  ? 'bg-cyan-500/15 border-cyan-500/40 text-cyan-300'
                  : 'bg-white/[0.03] border-white/[0.07] text-slate-400 hover:text-white'}`}>
              <Sparkles size={12} /> Auto Fill
            </button>

            {uploadsBucketId && (
              <button onClick={() => { setUploadModalOpen(true); setBucketFilter(String(uploadsBucketId)) }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-violet-500/10 border border-violet-500/20 text-violet-400 text-[11px] hover:bg-violet-500/15 transition-all">
                <UploadCloud size={12} /> Upload
              </button>
            )}

            <button onClick={handleExport} disabled={exporting}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[11px] hover:bg-emerald-500/15 transition-all disabled:opacity-50">
              {exporting ? <Loader2 size={12} className="animate-spin" /> : <Download size={12} />}
              Export
            </button>

            <button onClick={fetchData} className="p-1.5 rounded-lg hover:bg-white/[0.06] text-slate-500 hover:text-white transition-colors">
              <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
            </button>
          </div>
        </div>

        {/* Filter bar */}
        {filtersOpen && (
          <div className="border-t border-white/[0.06] px-4 py-3 max-w-7xl mx-auto space-y-2.5">
            {/* Row 1 */}
            <div className="flex flex-wrap gap-2 items-center">
              <div className="relative">
                <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-600 pointer-events-none" />
                <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search prompts…"
                  className="pl-7 pr-3 py-1.5 rounded-lg bg-white/[0.05] border border-white/[0.08] text-xs text-white placeholder:text-slate-600 focus:outline-none focus:border-cyan-500/40 w-52" />
                {search && (
                  <button onClick={() => setSearch("")} className="absolute right-2 top-1/2 -translate-y-1/2">
                    <X size={10} className="text-slate-500" />
                  </button>
                )}
              </div>
              <MultiFilterSelect values={models}       onChange={setModels}       placeholder="Model: any"   options={modelOptions} />
              <MultiFilterSelect values={aspectRatios} onChange={setAspectRatios} placeholder="Aspect: any"  options={aspectOptions} />
              <MultiFilterSelect values={qualities}    onChange={setQualities}    placeholder="Quality: any" options={qualityOptions} />
              <FilterSelect value={sort}      onChange={setSort}      options={sortOptions} />
              <FilterSelect value={mediaType} onChange={setMediaType} options={mediaTypeOptions} />
            </div>
            {/* Row 2 */}
            <div className="flex flex-wrap gap-2 items-center">
              <FilterSelect value={hasRefs}    onChange={setHasRefs}    options={hasRefsOptions} />
              <FilterSelect value={hasRating}  onChange={setHasRating}  options={hasRatingOptions} />
              <FilterSelect value={hasCaption} onChange={setHasCaption} options={hasCaptionOptions} />
              <FilterSelect value={hasTag}     onChange={setHasTag}     options={hasTagOptions} />
              {(facets?.tags.length ?? 0) > 0 && (
                <FilterSelect value={tagFilter} onChange={setTagFilter} options={tagFilterOptions} />
              )}
              {userOptions.length > 0 && (
                <MultiFilterSelect values={userFilters} onChange={setUserFilters} placeholder="User: any" searchable options={userOptions} />
              )}
              <button onClick={() => setMarkedOnly(v => !v)}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs transition-all
                  ${markedOnly ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400" : "bg-white/[0.05] border-white/[0.08] text-slate-400 hover:text-white"}`}>
                <BookMarked size={11} /> Training only
              </button>
              {hasActiveFilters && (
                <button onClick={() => { setModels([]); setAspectRatios([]); setQualities([]); setHasRefs(""); setHasRating(""); setHasCaption(""); setHasTag(""); setTagFilter(""); setUserFilters([]); setMediaType(""); setBucketFilter(""); setMarkedOnly(false); setSearch("") }}
                  className="text-[11px] text-slate-600 hover:text-slate-400 transition-colors">
                  Clear all
                </button>
              )}
            </div>
          </div>
        )}

        {/* Bulk action bar — only in select mode */}
        {selectMode && selected.size > 0 && (
          <div className="border-t border-cyan-500/20 bg-cyan-500/[0.04] px-4 py-2 max-w-7xl mx-auto flex items-center gap-2">
            <span className="text-xs text-cyan-300 font-medium">{selected.size} selected</span>
            <div className="flex items-center gap-2 ml-auto flex-wrap">
              <button onClick={selectAll} className="text-[11px] text-slate-500 hover:text-slate-300 transition-colors">
                Select page
              </button>
              <button onClick={selectAllRecords} disabled={selectAllLoading}
                className="flex items-center gap-1 text-[11px] text-cyan-500/70 hover:text-cyan-300 transition-colors disabled:opacity-50">
                {selectAllLoading
                  ? <><Loader2 size={10} className="animate-spin" /> Selecting…</>
                  : <>Select all {pagination ? pagination.total.toLocaleString() : ""} records</>
                }
              </button>
              <button onClick={() => setAddToBucketOpen(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-violet-500/10 border border-violet-500/20 text-violet-400 text-[11px] hover:bg-violet-500/15 transition-all">
                <FolderOpen size={11} /> Add to Bucket
              </button>
              <button onClick={() => setAutoFillOpen(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gradient-to-r from-cyan-500/10 to-violet-500/10 border border-cyan-500/20 text-[11px] text-white/80 hover:text-white hover:from-cyan-500/15 hover:to-violet-500/15 transition-all">
                <Sparkles size={11} /> Auto Fill
              </button>
              <button onClick={() => setBulkMode("tags")} disabled={bulkLoading}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 text-[11px] hover:bg-cyan-500/15 transition-all disabled:opacity-50">
                <Tag size={11} /> Add tags
              </button>
              <button onClick={() => setBulkMode("caption")} disabled={bulkLoading}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-violet-500/10 border border-violet-500/20 text-violet-400 text-[11px] hover:bg-violet-500/15 transition-all disabled:opacity-50">
                <MessageSquare size={11} /> Set caption
              </button>
              <button onClick={() => toggleMark(selectedArr, !allPageMarked)} disabled={bulkLoading}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[11px] hover:bg-emerald-500/15 transition-all disabled:opacity-50">
                {bulkLoading ? <Loader2 size={11} className="animate-spin" /> : <BookMarked size={11} />}
                {allPageMarked ? "Unmark" : "Mark training"}
              </button>
              <button onClick={() => setSelected(new Set())}
                className="p-1 rounded hover:bg-white/[0.06] text-slate-600 hover:text-slate-400 transition-colors">
                <X size={13} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Body */}
      <div className="max-w-7xl mx-auto px-4 py-5">

        {/* ── Bucket bar ── */}
        {buckets.length > 0 && (
          <div className="mb-4 flex items-center gap-2 overflow-x-auto pb-1 scrollbar-hide">
            <button
              onClick={() => setBucketFilter("")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs whitespace-nowrap shrink-0 transition-all
                ${!bucketFilter
                  ? "bg-violet-500/15 border-violet-500/30 text-violet-300"
                  : "bg-white/[0.03] border-white/[0.07] text-slate-500 hover:text-white"}`}
            >
              <Database size={11} /> All buckets
            </button>

            {buckets.map(b => {
              const isUploadsBucket = b.name === UPLOADS_BUCKET_NAME
              return (
              <div key={b.id} className="relative shrink-0">
                {renamingId === b.id ? (
                  <div className="flex items-center gap-1">
                    <input
                      autoFocus
                      value={renameValue}
                      onChange={e => setRenameValue(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') renameBucket(b.id); if (e.key === 'Escape') { setRenamingId(null); setRenameValue("") } }}
                      className="px-2 py-1 rounded-lg bg-white/[0.08] border border-violet-500/40 text-xs text-white outline-none w-32"
                    />
                    <button onClick={() => renameBucket(b.id)} className="text-[10px] text-violet-400 hover:text-violet-300 px-1">✓</button>
                    <button onClick={() => { setRenamingId(null); setRenameValue("") }} className="text-[10px] text-slate-600 hover:text-slate-400 px-1">✕</button>
                  </div>
                ) : (
                  <div className="group flex items-center">
                    <button
                      onClick={() => setBucketFilter(v => v === String(b.id) ? "" : String(b.id))}
                      className={`flex items-center gap-1.5 pl-3 pr-1.5 py-1.5 rounded-lg border text-xs whitespace-nowrap transition-all
                        ${bucketFilter === String(b.id)
                          ? isUploadsBucket
                            ? "bg-violet-600/20 border-violet-500/40 text-violet-300"
                            : "bg-violet-500/15 border-violet-500/30 text-violet-300"
                          : isUploadsBucket
                            ? "bg-violet-500/8 border-violet-500/20 text-violet-400 hover:text-violet-300 hover:border-violet-500/40"
                            : "bg-white/[0.03] border-white/[0.07] text-slate-400 hover:text-white hover:border-white/15"}`}
                    >
                      {isUploadsBucket ? <UploadCloud size={11} /> : <FolderOpen size={11} />}
                      {isUploadsBucket ? 'Uploads' : b.name}
                      <span className="ml-1 text-[9px] opacity-60">{b.count}</span>
                    </button>
                    {/* Only show context menu for non-uploads buckets */}
                    {!isUploadsBucket && (
                      <button
                        onClick={e => { e.stopPropagation(); setBucketMenuId(v => v === b.id ? null : b.id) }}
                        className="ml-0.5 p-1 rounded-md text-slate-700 hover:text-slate-400 opacity-0 group-hover:opacity-100 transition-all"
                      >
                        <MoreHorizontal size={11} />
                      </button>
                    )}
                    {/* Upload button inline for uploads bucket */}
                    {isUploadsBucket && (
                      <button
                        onClick={e => { e.stopPropagation(); setUploadModalOpen(true); setBucketFilter(String(b.id)) }}
                        className="ml-0.5 p-1 rounded-md text-violet-700 hover:text-violet-400 opacity-0 group-hover:opacity-100 transition-all"
                        title="Upload images"
                      >
                        <Plus size={11} />
                      </button>
                    )}
                  </div>
                )}

                {/* Bucket context menu — regular buckets only */}
                {!isUploadsBucket && bucketMenuId === b.id && (
                  <div className="absolute top-full left-0 mt-1 z-50 rounded-xl bg-[#131320] border border-white/[0.1] shadow-2xl overflow-hidden py-1 min-w-[130px]">
                    <button
                      onClick={() => { setRenamingId(b.id); setRenameValue(b.name); setBucketMenuId(null) }}
                      className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-slate-400 hover:text-white hover:bg-white/[0.06] transition-colors"
                    >
                      <Pencil size={11} /> Rename
                    </button>
                    <button
                      onClick={() => deleteBucket(b.id)}
                      className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-red-400 hover:text-red-300 hover:bg-red-500/[0.06] transition-colors"
                    >
                      <Trash2 size={11} /> Delete bucket
                    </button>
                  </div>
                )}
              </div>
            )})}


            <button
              onClick={createBucket}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-dashed border-white/[0.08] text-slate-600 hover:text-slate-300 hover:border-white/20 text-xs whitespace-nowrap shrink-0 transition-all"
            >
              <FolderPlus size={11} /> New bucket
            </button>
          </div>
        )}

        {buckets.length === 0 && (
          <div className="mb-4 flex items-center gap-2">
            <button
              onClick={createBucket}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-dashed border-white/[0.08] text-slate-700 hover:text-slate-400 hover:border-white/20 text-xs transition-all"
            >
              <FolderPlus size={11} /> Create a bucket to organize generations
            </button>
          </div>
        )}

        {error && (
          <div className="mb-4 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-xs text-red-400">{error}</div>
        )}

        {/* Select mode hint */}
        {selectMode && selected.size === 0 && (
          <div className="mb-4 flex items-center gap-3 text-xs text-cyan-400/60">
            <span className="flex items-center gap-1.5"><CheckSquare size={12} /> Click images to select them, or</span>
            <button onClick={selectAllRecords} disabled={selectAllLoading}
              className="flex items-center gap-1 text-cyan-400 hover:text-cyan-300 font-medium transition-colors disabled:opacity-50">
              {selectAllLoading
                ? <><Loader2 size={10} className="animate-spin" /> Selecting…</>
                : <>select all {pagination ? pagination.total.toLocaleString() : ""} records</>
              }
            </button>
          </div>
        )}

        {loading && images.length === 0 ? (
          <div className="flex items-center justify-center py-24">
            <Loader2 size={20} className="animate-spin text-slate-600" />
          </div>
        ) : images.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-slate-600">
            <Database size={32} className="mb-3" />
            <p className="text-sm">No records match your filters</p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2.5">
              {deferredImages.map((img, i) => (
                <ImageCard
                  key={img.id}
                  img={img}
                  index={i}
                  selected={selected.has(img.id)}
                  selectMode={selectMode}
                  onSelect={toggleSelect}
                  onOpen={setDetailImg}
                  onToggleMark={handleCardToggleMark}
                />
              ))}
            </div>

            {pagination && pagination.totalPages > 1 && (
              <div className="mt-6 flex items-center justify-center gap-2">
                <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1 || loading}
                  className="p-2 rounded-lg bg-white/[0.04] border border-white/[0.07] text-slate-400 hover:text-white disabled:opacity-30 transition-all">
                  <ChevronLeft size={15} />
                </button>
                <div className="flex items-center gap-1">
                  {(() => {
                    const total = pagination.totalPages
                    const mid   = Math.min(Math.max(page, 4), total - 3)
                    const pages = total <= 7
                      ? Array.from({ length: total }, (_, i) => i + 1)
                      : [...new Set([1, 2, 3, mid - 1, mid, mid + 1, total].filter(v => v > 0 && v <= total))].sort((a, b) => a - b)
                    return pages.map(p => (
                      <button key={p} onClick={() => setPage(p)}
                        className={`w-8 h-8 rounded-lg text-xs font-medium transition-all
                          ${p === page ? "bg-cyan-500/20 border border-cyan-500/30 text-cyan-300" : "bg-white/[0.04] border border-white/[0.07] text-slate-500 hover:text-white"}`}>
                        {p}
                      </button>
                    ))
                  })()}
                </div>
                <button onClick={() => setPage(p => Math.min(pagination.totalPages, p + 1))} disabled={page >= pagination.totalPages || loading}
                  className="p-2 rounded-lg bg-white/[0.04] border border-white/[0.07] text-slate-400 hover:text-white disabled:opacity-30 transition-all">
                  <ChevronRight size={15} />
                </button>
              </div>
            )}
          </>
        )}
      </div>

      </div>{/* end main content column */}
    </div>
  )
}
