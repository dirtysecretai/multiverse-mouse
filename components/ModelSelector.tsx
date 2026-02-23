"use client"

import { useState } from 'react'
import { AI_MODELS, CATEGORY_COLORS, getAvailableModels } from '@/config/ai-models.config'
import { Zap, Crown, Sparkles, ChevronDown, X } from 'lucide-react'

interface ModelSelectorProps {
  selectedModel: string
  onModelSelect: (modelId: string) => void
  userTickets: number
  // OLD maintenance (kept for backward compatibility)
  nanoBananaProMaintenance?: boolean
  nanoBananaMaintenance?: boolean
  seedreamMaintenance?: boolean
  // NEW per-scanner, per-model maintenance
  mainScanner_nanoBanana?: boolean
  mainScanner_nanoBananaPro?: boolean
  mainScanner_seedream?: boolean
  mainScanner_flux2?: boolean
  mainScanner_proScannerV3?: boolean
  mainScanner_flashScannerV25?: boolean
}

export function ModelSelector({
  selectedModel,
  onModelSelect,
  userTickets,
  nanoBananaProMaintenance,
  nanoBananaMaintenance,
  seedreamMaintenance,
  mainScanner_nanoBanana,
  mainScanner_nanoBananaPro,
  mainScanner_seedream,
  mainScanner_flux2,
  mainScanner_proScannerV3,
  mainScanner_flashScannerV25
}: ModelSelectorProps) {
  const [isOpen, setIsOpen] = useState(false)
  const availableModels = getAvailableModels()
  const currentModel = AI_MODELS.find(m => m.id === selectedModel) || availableModels[0]

  // Check if a model is in maintenance (NEW per-scanner system takes priority)
  const isInMaintenance = (modelId: string) => {
    // Check NEW per-scanner, per-model maintenance first
    if (modelId === 'nano-banana' && mainScanner_nanoBanana !== undefined) return mainScanner_nanoBanana
    if (modelId === 'nano-banana-pro' && mainScanner_nanoBananaPro !== undefined) return mainScanner_nanoBananaPro
    if (modelId === 'seedream-4.5' && mainScanner_seedream !== undefined) return mainScanner_seedream
    if (modelId === 'flux-2' && mainScanner_flux2 !== undefined) return mainScanner_flux2
    if (modelId === 'gemini-3-pro-image' && mainScanner_proScannerV3 !== undefined) return mainScanner_proScannerV3
    if (modelId === 'gemini-2.5-flash-image' && mainScanner_flashScannerV25 !== undefined) return mainScanner_flashScannerV25

    // Fallback to OLD maintenance fields
    if (modelId === 'nano-banana-pro') return nanoBananaProMaintenance || false
    if (modelId === 'nano-banana') return nanoBananaMaintenance || false
    if (modelId === 'seedream-4.5') return seedreamMaintenance || false
    return false
  }

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'standard': return <Zap size={16} />
      case 'premium': return <Crown size={16} />
      case 'ultra': return <Sparkles size={16} />
      default: return <Zap size={16} />
    }
  }

  const canAfford = (ticketCost: number) => userTickets >= ticketCost

  const currentModelInMaintenance = isInMaintenance(currentModel.id)

  return (
    <>
      {/* Selected Model Button */}
      <button
        onClick={() => setIsOpen(true)}
        className={`w-full p-4 rounded-xl border transition-all duration-200
                    ${currentModelInMaintenance
                      ? 'border-yellow-500/50 bg-yellow-500/10'
                      : 'border-slate-700 bg-slate-900/60 hover:border-slate-500 hover:bg-slate-800/60'
                    }
                    flex items-center justify-between`}
      >
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-lg ${currentModelInMaintenance ? 'bg-yellow-500/20' : 'bg-slate-800'}`}>
            <span className={currentModelInMaintenance ? 'text-yellow-400' : 'text-white'}>
              {getCategoryIcon(currentModel.category)}
            </span>
          </div>
          <div className="text-left">
            <div className={`font-bold text-sm ${currentModelInMaintenance ? 'text-yellow-500' : 'text-white'}`}>
              {currentModel.displayName}
              {currentModelInMaintenance && (
                <span className="ml-2 text-[10px] px-2 py-0.5 rounded-full bg-yellow-500 text-black font-bold">
                  MAINTENANCE
                </span>
              )}
            </div>
            <div className="text-xs text-slate-500">
              {currentModelInMaintenance
                ? 'Model temporarily offline'
                : `${currentModel.ticketCost} ticket${currentModel.ticketCost > 1 ? 's' : ''} per scan`
              }
            </div>
          </div>
        </div>
        <ChevronDown size={18} className="text-slate-500" />
      </button>

      {/* Modal Overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[9999] flex items-center justify-center p-4"
          onClick={() => setIsOpen(false)}
        >
          {/* Modal Content */}
          <div
            className="bg-slate-900 rounded-2xl border border-slate-700 p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold text-white">Select AI Model</h3>
              <button
                onClick={() => setIsOpen(false)}
                className="p-2 rounded-lg hover:bg-slate-800 transition-colors"
              >
                <X size={20} className="text-slate-400" />
              </button>
            </div>

            {/* Models Grid */}
            <div className="space-y-3 max-h-[50vh] overflow-y-auto pr-2
                           [&::-webkit-scrollbar]:w-2
                           [&::-webkit-scrollbar-track]:bg-slate-800
                           [&::-webkit-scrollbar-track]:rounded-full
                           [&::-webkit-scrollbar-thumb]:bg-slate-600
                           [&::-webkit-scrollbar-thumb]:rounded-full
                           [&::-webkit-scrollbar-thumb:hover]:bg-slate-500">
              {availableModels.map((model) => {
                const affordable = canAfford(model.ticketCost)
                const maintenance = isInMaintenance(model.id)

                const isBestQuality = model.id === 'gemini-3-pro-image' || model.id === 'nano-banana-pro'
                const isUnstable = model.id === 'nano-banana-pro'
                const hasLimitedUse = model.provider === 'gemini' && model.rateLimit.rpd > 0
                const isMultiImage = model.id === 'nano-banana'
                const isUncensored = model.id === 'seedream-4.5'
                const isFast = model.id === 'gemini-2.5-flash-image'
                const isRealism = model.id === 'flux-2'
                const isSelected = model.id === selectedModel

                return (
                  <button
                    key={model.id}
                    onClick={() => {
                      if (affordable && !maintenance) {
                        onModelSelect(model.id)
                        setIsOpen(false)
                      }
                    }}
                    disabled={!affordable || maintenance}
                    className={`w-full p-4 rounded-xl border
                              ${maintenance
                                ? 'border-yellow-500/50 bg-yellow-500/10'
                                : isSelected
                                  ? 'border-slate-500 bg-slate-800/60 ring-2 ring-white/10'
                                  : 'border-slate-800 bg-slate-900/40 hover:border-slate-600 hover:bg-slate-800/40'
                              }
                              ${affordable && !maintenance ? 'cursor-pointer' : 'opacity-40 cursor-not-allowed'}
                              transition-all duration-200 text-left`}
                  >
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={maintenance ? 'text-yellow-400' : 'text-white'}>
                          {getCategoryIcon(model.category)}
                        </span>
                        <span className={`font-bold text-base ${maintenance ? 'text-yellow-500' : 'text-white'}`}>
                          {model.displayName}
                        </span>
                        {isBestQuality && !maintenance && (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-white text-black font-bold">
                            BEST QUALITY
                          </span>
                        )}
                        {isMultiImage && !maintenance && (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-slate-700 border border-slate-600 text-slate-200 font-bold">
                            MULTIPLE IMAGES
                          </span>
                        )}
                        {isUncensored && !maintenance && (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-slate-700 border border-slate-600 text-slate-200 font-bold">
                            UNCENSORED
                          </span>
                        )}
                        {isFast && !maintenance && (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-slate-700 border border-slate-600 text-slate-200 font-bold">
                            FAST
                          </span>
                        )}
                        {isRealism && !maintenance && (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-slate-700 border border-slate-600 text-slate-200 font-bold">
                            REALISM
                          </span>
                        )}
                        {hasLimitedUse && !maintenance && (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-slate-800 border border-slate-600 text-slate-400 font-bold">
                            LIMITED USE
                          </span>
                        )}
                        {isUnstable && !maintenance && (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-yellow-500/10 border border-yellow-500/30 text-yellow-400 font-bold">
                            UNSTABLE
                          </span>
                        )}
                        {maintenance && (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-yellow-500 text-black font-bold">
                            MAINTENANCE
                          </span>
                        )}
                        {isSelected && !maintenance && (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-white text-black font-bold">
                            SELECTED
                          </span>
                        )}
                      </div>
                      <span className={`text-sm font-bold px-3 py-1 rounded-lg flex-shrink-0 ${
                        maintenance
                          ? 'bg-yellow-500/20 text-yellow-500'
                          : 'bg-slate-800 border border-slate-700 text-slate-300'
                      }`}>
                        {model.ticketCost} 🎫
                      </span>
                    </div>

                    <p className="text-sm text-slate-400 mb-3">{model.description}</p>

                    {isUnstable && !maintenance && (
                      <div className="mb-3 p-2 rounded-lg bg-slate-800/60 border border-slate-700">
                        <p className="text-xs text-slate-400">
                          ⚠️ <strong className="text-slate-300">Tip:</strong> Keep prompts SFW (safe for work) for best results. Sensitive content may trigger quality reduction.
                        </p>
                      </div>
                    )}

                    {hasLimitedUse && !maintenance && (
                      <div className="mb-3 p-2 rounded-lg bg-slate-800/60 border border-slate-700">
                        <p className="text-xs text-slate-400">
                          ⚠️ <strong className="text-slate-300">Daily Limit:</strong> {model.rateLimit.rpd} generations per day. Resets at midnight PST.
                        </p>
                      </div>
                    )}

                    <div className="flex items-center gap-6 text-xs text-slate-500">
                      <span>Quality: <span className="text-white font-semibold">{model.quality.toUpperCase()}</span></span>
                      <span>Daily Limit: <span className="text-white font-semibold">{model.rateLimit.rpd === 0 ? '∞' : model.rateLimit.rpd}</span></span>
                    </div>

                    {maintenance && (
                      <div className="mt-3 text-xs text-yellow-500 font-semibold">
                        ⚠️ Model temporarily offline for maintenance
                      </div>
                    )}
                    {!affordable && !maintenance && (
                      <div className="mt-3 text-xs text-red-400 font-semibold">
                        ⚠️ Need {model.ticketCost - userTickets} more ticket{model.ticketCost - userTickets > 1 ? 's' : ''}
                      </div>
                    )}
                  </button>
                )
              })}
            </div>

            {/* Footer Info */}
            <div className="mt-6 p-4 rounded-lg bg-slate-800/50 border border-slate-700">
              <p className="text-xs text-slate-400">
                💡 <strong className="text-white">Tip:</strong> Higher tier models provide better quality but cost more tickets.
                Standard models are great for everyday use, while Ultra models deliver maximum fidelity.
              </p>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
