'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Upload, X, Plus, Trash2, Package, Loader2, Image as ImageIcon, CheckCircle } from 'lucide-react'

interface UserModel {
  id: number
  name: string
  referenceImageUrls: string[]
  createdAt: string
}

export default function MyModelsPage() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  // Models list
  const [models, setModels] = useState<UserModel[]>([])
  const [modelsLoading, setModelsLoading] = useState(false)

  // Create form
  const [newModelName, setNewModelName] = useState('')
  const [newModelImages, setNewModelImages] = useState<File[]>([])
  const [newModelPreviewUrls, setNewModelPreviewUrls] = useState<string[]>([])
  const [isCreating, setIsCreating] = useState(false)
  const [createSuccess, setCreateSuccess] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)

  // Delete state
  const [deletingId, setDeletingId] = useState<number | null>(null)

  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const res = await fetch('/api/auth/session')
        const data = await res.json()
        if (!data.authenticated) {
          router.push('/login')
          return
        }
        setUser(data.user)
        await fetchModels()
      } catch {
        router.push('/login')
      } finally {
        setLoading(false)
      }
    }
    checkAuth()
  }, [router])

  const fetchModels = async () => {
    setModelsLoading(true)
    try {
      const res = await fetch('/api/user/models')
      const data = await res.json()
      if (data.success) setModels(data.models)
    } catch (err) {
      console.error('Failed to fetch models:', err)
    } finally {
      setModelsLoading(false)
    }
  }

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    if (files.length === 0) return

    const remaining = 8 - newModelImages.length
    if (remaining <= 0) return

    const toAdd = files.slice(0, remaining)
    const previews = toAdd.map(f => URL.createObjectURL(f))
    setNewModelImages(prev => [...prev, ...toAdd])
    setNewModelPreviewUrls(prev => [...prev, ...previews])

    // Reset input so the same file can be re-selected
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const removeImage = (index: number) => {
    URL.revokeObjectURL(newModelPreviewUrls[index])
    setNewModelImages(prev => prev.filter((_, i) => i !== index))
    setNewModelPreviewUrls(prev => prev.filter((_, i) => i !== index))
  }

  const handleCreate = async () => {
    if (!newModelName.trim()) { setCreateError('Please enter a model name.'); return }
    if (newModelImages.length === 0) { setCreateError('Please upload at least one reference image.'); return }

    setIsCreating(true)
    setCreateError(null)

    try {
      // Upload images to Vercel Blob
      const referenceImageUrls: string[] = []
      for (const file of newModelImages) {
        const formData = new FormData()
        formData.append('file', file)
        const res = await fetch('/api/upload-reference', { method: 'POST', body: formData })
        const data = await res.json()
        if (data.url) referenceImageUrls.push(data.url)
      }

      // Save model record
      const res = await fetch('/api/user/models', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newModelName.trim(), referenceImageUrls })
      })
      const data = await res.json()

      if (data.success) {
        setCreateSuccess(true)
        setNewModelName('')
        setNewModelImages([])
        setNewModelPreviewUrls([])
        await fetchModels()
        setTimeout(() => setCreateSuccess(false), 3000)
      } else {
        setCreateError(data.error || 'Failed to create model.')
      }
    } catch {
      setCreateError('Something went wrong. Please try again.')
    } finally {
      setIsCreating(false)
    }
  }

  const handleDelete = async (modelId: number) => {
    if (!confirm('Delete this model? This cannot be undone.')) return
    setDeletingId(modelId)
    try {
      const res = await fetch(`/api/user/models?id=${modelId}`, { method: 'DELETE' })
      const data = await res.json()
      if (data.success) {
        setModels(prev => prev.filter(m => m.id !== modelId))
      } else {
        alert(data.error || 'Failed to delete model.')
      }
    } catch {
      alert('Failed to delete model.')
    } finally {
      setDeletingId(null)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <Loader2 className="text-fuchsia-400 animate-spin" size={32} />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      {/* Header */}
      <div className="border-b border-slate-800 bg-slate-900/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center gap-4">
          <Link
            href="/dashboard"
            className="flex items-center gap-1.5 text-slate-400 hover:text-white transition-colors text-sm"
          >
            <ArrowLeft size={16} />
            Dashboard
          </Link>
          <div className="w-px h-4 bg-slate-700" />
          <div className="flex items-center gap-2">
            <Package size={18} className="text-fuchsia-400" />
            <h1 className="text-base font-bold text-white">My Custom Models</h1>
          </div>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-8 space-y-8">

        {/* Create New Model */}
        <section>
          <div className="flex items-center gap-2 mb-4">
            <Plus size={16} className="text-fuchsia-400" />
            <h2 className="text-sm font-bold text-fuchsia-400 uppercase tracking-wider">Create New Model</h2>
          </div>

          <div className="rounded-xl border border-fuchsia-500/20 bg-fuchsia-500/5 p-5 space-y-4">
            {/* Model Name */}
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">Model Name</label>
              <input
                type="text"
                value={newModelName}
                onChange={e => setNewModelName(e.target.value)}
                placeholder="e.g. My Portrait Style"
                maxLength={60}
                className="w-full px-3 py-2.5 rounded-lg bg-slate-900 border border-slate-700 text-white placeholder-slate-500 text-sm focus:border-fuchsia-500 focus:outline-none focus:ring-1 focus:ring-fuchsia-500/40 transition-colors"
              />
            </div>

            {/* Reference Images */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-medium text-slate-400">
                  Reference Images ({newModelImages.length}/8)
                </label>
                {newModelImages.length > 0 && (
                  <button
                    onClick={() => {
                      newModelPreviewUrls.forEach(url => URL.revokeObjectURL(url))
                      setNewModelImages([])
                      setNewModelPreviewUrls([])
                    }}
                    className="text-[10px] text-slate-500 hover:text-red-400 transition-colors"
                  >
                    Clear all
                  </button>
                )}
              </div>

              <div className="flex flex-wrap gap-2">
                {/* Upload slot */}
                {newModelImages.length < 8 && (
                  <label className="w-20 h-20 rounded-lg border-2 border-dashed border-slate-700 hover:border-fuchsia-500/60 bg-slate-900/50 hover:bg-fuchsia-500/5 flex flex-col items-center justify-center cursor-pointer transition-all group">
                    <Upload size={18} className="text-slate-500 group-hover:text-fuchsia-400 mb-1 transition-colors" />
                    <span className="text-[10px] text-slate-500 group-hover:text-fuchsia-400 transition-colors">Upload</span>
                    <input
                      ref={fileInputRef}
                      type="file"
                      multiple
                      accept="image/*"
                      onChange={handleImageUpload}
                      className="hidden"
                    />
                  </label>
                )}

                {/* Image previews */}
                {newModelPreviewUrls.map((url, idx) => (
                  <div key={idx} className="relative w-20 h-20 rounded-lg overflow-hidden border border-slate-700 group">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={url} alt={`ref-${idx}`} className="w-full h-full object-cover" />
                    <button
                      onClick={() => removeImage(idx)}
                      className="absolute top-1 right-1 bg-red-500 hover:bg-red-400 rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <X size={12} className="text-white" />
                    </button>
                  </div>
                ))}
              </div>
              <p className="text-[11px] text-slate-600 mt-2">
                Upload 1–8 photos that represent your model's style or subject. These are used as reference images when generating.
              </p>
            </div>

            {/* Error */}
            {createError && (
              <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
                {createError}
              </p>
            )}

            {/* Success */}
            {createSuccess && (
              <div className="flex items-center gap-2 text-xs text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded-lg px-3 py-2">
                <CheckCircle size={14} />
                Model created successfully!
              </div>
            )}

            {/* Submit */}
            <button
              onClick={handleCreate}
              disabled={isCreating || !newModelName.trim() || newModelImages.length === 0}
              className="w-full py-2.5 rounded-lg bg-fuchsia-600 hover:bg-fuchsia-500 disabled:bg-slate-800 disabled:text-slate-600 disabled:cursor-not-allowed text-white font-semibold text-sm transition-colors flex items-center justify-center gap-2"
            >
              {isCreating ? (
                <>
                  <Loader2 size={15} className="animate-spin" />
                  Uploading & saving...
                </>
              ) : (
                <>
                  <Plus size={15} />
                  Create Model
                </>
              )}
            </button>
          </div>
        </section>

        {/* Saved Models */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Package size={16} className="text-slate-400" />
              <h2 className="text-sm font-bold text-slate-400 uppercase tracking-wider">
                Your Models {models.length > 0 && <span className="text-slate-500 font-normal">({models.length})</span>}
              </h2>
            </div>
            {modelsLoading && <Loader2 size={14} className="text-slate-500 animate-spin" />}
          </div>

          {!modelsLoading && models.length === 0 && (
            <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-10 text-center">
              <Package size={32} className="text-slate-700 mx-auto mb-3" />
              <p className="text-slate-500 text-sm mb-1">No models yet</p>
              <p className="text-slate-600 text-xs">Create your first model above to get started.</p>
            </div>
          )}

          <div className="space-y-3">
            {models.map(model => (
              <div
                key={model.id}
                className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 flex items-center gap-4"
              >
                {/* Thumbnail strip */}
                <div className="flex-shrink-0 flex gap-1">
                  {model.referenceImageUrls.slice(0, 4).map((url, i) => (
                    <div
                      key={i}
                      className={`rounded overflow-hidden border border-slate-700 bg-slate-800 ${
                        model.referenceImageUrls.length === 1 ? 'w-16 h-16' : 'w-10 h-10'
                      }`}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={url} alt="" className="w-full h-full object-cover" />
                    </div>
                  ))}
                  {model.referenceImageUrls.length > 4 && (
                    <div className="w-10 h-10 rounded bg-slate-800 border border-slate-700 flex items-center justify-center">
                      <span className="text-[10px] text-slate-400 font-bold">+{model.referenceImageUrls.length - 4}</span>
                    </div>
                  )}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-white truncate">{model.name}</p>
                  <p className="text-xs text-slate-500">
                    {model.referenceImageUrls.length} image{model.referenceImageUrls.length !== 1 ? 's' : ''} · saved {new Date(model.createdAt).toLocaleDateString()}
                  </p>
                </div>

                {/* Delete */}
                <button
                  onClick={() => handleDelete(model.id)}
                  disabled={deletingId === model.id}
                  className="flex-shrink-0 p-2 rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-500/10 border border-transparent hover:border-red-500/20 transition-all disabled:opacity-50"
                  title="Delete model"
                >
                  {deletingId === model.id ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : (
                    <Trash2 size={16} />
                  )}
                </button>
              </div>
            ))}
          </div>
        </section>

        {/* Info callout */}
        <div className="rounded-xl border border-slate-800 bg-slate-900/30 p-4 flex gap-3">
          <ImageIcon size={16} className="text-slate-500 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-slate-500 leading-relaxed">
            Custom models are saved to your account and can be loaded from any scanner using the <span className="text-fuchsia-400 font-medium">Custom Models</span> button in the reference images section. Deleting a model does not delete the generated images.
          </p>
        </div>

      </div>
    </div>
  )
}
