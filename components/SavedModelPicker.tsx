'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'

interface UserModel {
  id: number
  name: string
  referenceImageUrls: string[]
  createdAt: string
}

interface SavedModelPickerProps {
  onSelect: (model: UserModel) => void
  disabled?: boolean
  /** Renders a full-width large button to match the canvas reference panel scale */
  large?: boolean
}

export function SavedModelPicker({ onSelect, disabled, large }: SavedModelPickerProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [models, setModels] = useState<UserModel[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  // Close dropdown on outside click
  useEffect(() => {
    if (!isOpen) return
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [isOpen])

  const fetchModels = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/user/models')
      if (!res.ok) throw new Error('Failed to load models')
      const data = await res.json()
      setModels(data.models || [])
    } catch {
      setError('Failed to load models')
    } finally {
      setLoading(false)
    }
  }

  const handleToggle = () => {
    if (disabled) return
    if (!isOpen) {
      fetchModels()
      setIsOpen(true)
    } else {
      setIsOpen(false)
    }
  }

  const handleSelect = (model: UserModel) => {
    onSelect(model)
    setIsOpen(false)
  }

  return (
    <div ref={containerRef} className="relative">
      {/* Trigger button */}
      {large ? (
        <button
          onClick={handleToggle}
          disabled={disabled}
          className={`flex items-center justify-center gap-8 w-full px-12 py-6 rounded-lg transition-colors ${
            disabled
              ? 'bg-slate-800 text-slate-500 cursor-not-allowed opacity-50'
              : isOpen
              ? 'bg-fuchsia-700 text-white'
              : 'bg-fuchsia-900/60 hover:bg-fuchsia-800/80 text-fuchsia-200 border-2 border-fuchsia-500/40 hover:border-fuchsia-500/70'
          }`}
          title="Load a saved preset as reference images"
        >
          <svg className="w-14 h-14 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path>
            <polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline>
            <line x1="12" y1="22.08" x2="12" y2="12"></line>
          </svg>
          <span className="text-5xl font-bold">Saved Presets</span>
          <svg className={`w-10 h-10 flex-shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <polyline points="6 9 12 15 18 9"></polyline>
          </svg>
        </button>
      ) : (
        <button
          onClick={handleToggle}
          disabled={disabled}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition-all ${
            disabled
              ? 'border-slate-800 bg-slate-950 text-slate-600 cursor-not-allowed'
              : isOpen
              ? 'border-fuchsia-500/60 bg-fuchsia-500/10 text-fuchsia-300'
              : 'border-slate-700 bg-slate-900/80 text-slate-300 hover:border-fuchsia-500/40 hover:text-fuchsia-300 hover:bg-fuchsia-500/5'
          }`}
          title="Load a saved preset as reference images"
        >
          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path>
            <polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline>
            <line x1="12" y1="22.08" x2="12" y2="12"></line>
          </svg>
          Saved Presets
          <svg className={`w-3 h-3 transition-transform ${isOpen ? 'rotate-180' : ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <polyline points="6 9 12 15 18 9"></polyline>
          </svg>
        </button>
      )}

      {/* Dropdown */}
      {isOpen && (
        <div className={`absolute left-0 top-full z-50 rounded-xl border border-slate-700 bg-slate-900 shadow-2xl shadow-black/50 overflow-hidden ${large ? 'w-full mt-6 border-4 rounded-2xl' : 'w-72 mt-1.5'}`}>
          {/* Header */}
          <div className={`border-b border-slate-800 flex items-center justify-between ${large ? 'px-12 py-8 border-b-4' : 'px-3 py-2'}`}>
            <span className={`font-bold text-slate-400 uppercase tracking-wider ${large ? 'text-4xl' : 'text-[10px]'}`}>Saved Presets</span>
            <button onClick={() => setIsOpen(false)} className="text-slate-500 hover:text-slate-300">
              <svg className={large ? 'w-14 h-14' : 'w-3.5 h-3.5'} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>
          </div>

          {/* Content */}
          <div className={`overflow-y-auto ${large ? 'max-h-[900px]' : 'max-h-72'}`}>
            {loading && (
              <div className={`flex items-center justify-center ${large ? 'py-24' : 'py-8'}`}>
                <div className={`border-fuchsia-500/30 border-t-fuchsia-500 rounded-full animate-spin ${large ? 'w-20 h-20 border-[6px]' : 'w-5 h-5 border-2'}`} />
              </div>
            )}

            {error && !loading && (
              <div className={`text-center ${large ? 'p-16' : 'p-3'}`}>
                <p className={`text-red-400 mb-6 ${large ? 'text-4xl' : 'text-xs'}`}>{error}</p>
                <button onClick={fetchModels} className={`text-slate-400 hover:text-white underline ${large ? 'text-3xl' : 'text-xs'}`}>
                  Retry
                </button>
              </div>
            )}

            {!loading && !error && models.length === 0 && (
              <div className={`text-center ${large ? 'p-16' : 'p-4'}`}>
                <div className={`mx-auto mb-6 rounded-full bg-slate-800 flex items-center justify-center ${large ? 'w-32 h-32' : 'w-10 h-10'}`}>
                  <svg className={`text-slate-500 ${large ? 'w-16 h-16' : 'w-5 h-5'}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path>
                  </svg>
                </div>
                <p className={`text-slate-400 mb-8 ${large ? 'text-4xl' : 'text-xs'}`}>No saved presets yet.</p>
                <Link
                  href="/my-models"
                  onClick={() => setIsOpen(false)}
                  className={`inline-flex items-center gap-4 rounded-xl bg-fuchsia-600 hover:bg-fuchsia-500 text-white font-bold transition-colors ${large ? 'px-12 py-6 text-4xl' : 'px-3 py-1.5 text-xs'}`}
                >
                  Create a Preset
                  <svg className={large ? 'w-10 h-10' : 'w-3 h-3'} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <line x1="5" y1="12" x2="19" y2="12"></line>
                    <polyline points="12 5 19 12 12 19"></polyline>
                  </svg>
                </Link>
              </div>
            )}

            {!loading && !error && models.map(model => (
              <button
                key={model.id}
                onClick={() => handleSelect(model)}
                className={`w-full flex items-center hover:bg-fuchsia-500/10 transition-colors text-left border-b border-slate-800/60 last:border-0 ${large ? 'gap-8 px-12 py-8 border-b-2' : 'gap-3 px-3 py-2.5'}`}
              >
                {/* Thumbnail grid (first 3 images) */}
                <div className={`flex-shrink-0 grid grid-cols-3 gap-1 rounded-lg overflow-hidden border border-slate-700 ${large ? 'w-52 h-36 border-2' : 'w-16 h-10'}`}>
                  {model.referenceImageUrls.slice(0, 3).map((url, i) => (
                    <div key={i} className={`bg-slate-800 overflow-hidden ${model.referenceImageUrls.length === 1 ? 'col-span-3' : model.referenceImageUrls.length === 2 && i === 0 ? 'col-span-2' : ''}`}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={url} alt="" className="w-full h-full object-cover" />
                    </div>
                  ))}
                </div>

                {/* Model info */}
                <div className="flex-1 min-w-0">
                  <p className={`font-bold text-white truncate ${large ? 'text-4xl mb-2' : 'text-sm'}`}>{model.name}</p>
                  <p className={`text-slate-500 ${large ? 'text-2xl' : 'text-[10px]'}`}>
                    {model.referenceImageUrls.length} image{model.referenceImageUrls.length !== 1 ? 's' : ''}
                  </p>
                </div>

                {/* Load arrow */}
                <svg className={`text-slate-400 flex-shrink-0 ${large ? 'w-12 h-12' : 'w-3.5 h-3.5'}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <line x1="5" y1="12" x2="19" y2="12"></line>
                  <polyline points="12 5 19 12 12 19"></polyline>
                </svg>
              </button>
            ))}
          </div>

          {/* Footer */}
          {!loading && models.length > 0 && (
            <div className={`border-t border-slate-800 bg-slate-950/50 ${large ? 'px-12 py-7 border-t-4' : 'px-3 py-2'}`}>
              <Link
                href="/my-models"
                onClick={() => setIsOpen(false)}
                className={`flex items-center gap-3 text-slate-500 hover:text-fuchsia-400 transition-colors ${large ? 'text-3xl' : 'text-[10px]'}`}
              >
                <svg className={large ? 'w-8 h-8' : 'w-3 h-3'} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="12" y1="5" x2="12" y2="19"></line>
                  <line x1="5" y1="12" x2="19" y2="12"></line>
                </svg>
                Create or manage presets
              </Link>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
