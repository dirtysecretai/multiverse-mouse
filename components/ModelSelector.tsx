"use client"

import { useState } from 'react'
import { AI_MODELS, CATEGORY_COLORS, getAvailableModels } from '@/config/ai-models.config'
import { Zap, Crown, Sparkles, ChevronDown, X } from 'lucide-react'

interface ModelSelectorProps {
  selectedModel: string
  onModelSelect: (modelId: string) => void
  userTickets: number
  nanoBananaProMaintenance?: boolean
  nanoBananaMaintenance?: boolean
  seedreamMaintenance?: boolean
}

export function ModelSelector({ selectedModel, onModelSelect, userTickets, nanoBananaProMaintenance, nanoBananaMaintenance, seedreamMaintenance }: ModelSelectorProps) {
  const [isOpen, setIsOpen] = useState(false)
  const availableModels = getAvailableModels()
  const currentModel = AI_MODELS.find(m => m.id === selectedModel) || availableModels[0]

  // Check if a model is in maintenance
  const isInMaintenance = (modelId: string) => {
    if (modelId === 'nano-banana-pro') return nanoBananaProMaintenance
    if (modelId === 'nano-banana') return nanoBananaMaintenance
    if (modelId === 'seedream-4.5') return seedreamMaintenance
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
  
  // Color distinction for selected button
  const isCurrentGemini = currentModel.provider === 'gemini'
  const currentBorderColor = isCurrentGemini ? 'border-cyan-500' : 'border-fuchsia-500'
  const currentBgColor = isCurrentGemini ? 'bg-cyan-500/10' : 'bg-fuchsia-500/10'
  const currentTextColor = isCurrentGemini ? 'text-cyan-400' : 'text-fuchsia-400'
  const currentGlow = isCurrentGemini ? 'hover:shadow-cyan-500/50' : 'hover:shadow-fuchsia-500/50'

  return (
    <>
      {/* Selected Model Button */}
      <button
        onClick={() => setIsOpen(true)}
        className={`w-full p-4 rounded-xl border-2 
                    ${currentModelInMaintenance 
                      ? 'border-yellow-500/50 bg-yellow-500/10 hover:shadow-yellow-500/20' 
                      : `${currentBorderColor} ${currentBgColor} ${currentGlow}`
                    }
                    hover:shadow-lg transition-all duration-300
                    flex items-center justify-between`}
      >
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-lg ${currentModelInMaintenance ? 'bg-yellow-500/20' : currentBgColor}`}>
            {getCategoryIcon(currentModel.category)}
          </div>
          <div className="text-left">
            <div className={`font-bold text-sm ${currentModelInMaintenance ? 'text-yellow-500' : currentTextColor}`}>
              {currentModel.displayName}
              {currentModelInMaintenance && (
                <span className="ml-2 text-[10px] px-2 py-0.5 rounded-full bg-yellow-500 text-black font-bold">
                  MAINTENANCE
                </span>
              )}
            </div>
            <div className="text-xs text-slate-400">
              {currentModelInMaintenance 
                ? 'Model temporarily offline'
                : `${currentModel.ticketCost} ticket${currentModel.ticketCost > 1 ? 's' : ''} per scan`
              }
            </div>
          </div>
        </div>
        <ChevronDown size={18} className="text-slate-400" />
      </button>

      {/* Modal Overlay */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[9999] flex items-center justify-center p-4"
          onClick={() => setIsOpen(false)}
        >
          {/* Modal Content */}
          <div 
            className="bg-slate-900 rounded-2xl border-2 border-slate-700 p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto"
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

            {/* Models Grid - Scrollable with custom scrollbar */}
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
                
                // Color distinction: Gemini API = Blue (cyan), FAL.ai = Purple (fuchsia)
                const isGeminiModel = model.provider === 'gemini'
                const borderColor = isGeminiModel ? 'border-cyan-500' : 'border-fuchsia-500'
                const bgColor = isGeminiModel ? 'bg-cyan-500/10' : 'bg-fuchsia-500/10'
                const textColor = isGeminiModel ? 'text-cyan-400' : 'text-fuchsia-400'
                const hoverGlow = isGeminiModel ? 'hover:shadow-cyan-500/50' : 'hover:shadow-fuchsia-500/50'
                
                // Best quality badges for Pro Scanner v3 and NanoBanana Pro
                const isBestQuality = model.id === 'gemini-3-pro-image' || model.id === 'nano-banana-pro'
                
                // Unstable warning for NanoBanana Pro (FAL.ai filtering issues)
                const isUnstable = model.id === 'nano-banana-pro'
                
                // Limited use warning for Gemini models (have daily quotas)
                const hasLimitedUse = model.provider === 'gemini' && model.rateLimit.rpd > 0
                
                // Model-specific feature badges
                const isMultiImage = model.id === 'nano-banana'
                const isUncensored = model.id === 'seedream-4.5'
                const isFast = model.id === 'gemini-2.5-flash-image'
                
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
                    className={`w-full p-4 rounded-xl border-2 
                              ${maintenance 
                                ? 'border-yellow-500/50 bg-yellow-500/10' 
                                : `${borderColor} ${bgColor}`
                              }
                              ${affordable && !maintenance ? `hover:shadow-lg ${hoverGlow} hover:scale-[1.02] cursor-pointer` : 'opacity-40 cursor-not-allowed'}
                              ${isSelected ? 'ring-4 ring-white/50' : ''}
                              transition-all duration-300 text-left`}
                  >
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2 flex-wrap">
                        {getCategoryIcon(model.category)}
                        <span className={`font-bold text-base ${maintenance ? 'text-yellow-500' : textColor}`}>
                          {model.displayName}
                        </span>
                        {isBestQuality && !maintenance && (
                          <span className="text-xs px-2 py-1 rounded-full bg-gradient-to-r from-yellow-500 to-orange-500 text-black font-bold">
                            BEST QUALITY
                          </span>
                        )}
                        {isMultiImage && !maintenance && (
                          <span className="text-xs px-2 py-1 rounded-full bg-purple-500 text-white font-bold">
                            MULTIPLE IMAGES
                          </span>
                        )}
                        {isUncensored && !maintenance && (
                          <span className="text-xs px-2 py-1 rounded-full bg-green-500 text-white font-bold">
                            UNCENSORED
                          </span>
                        )}
                        {isFast && !maintenance && (
                          <span className="text-xs px-2 py-1 rounded-full bg-cyan-500 text-black font-bold">
                            FAST
                          </span>
                        )}
                        {hasLimitedUse && !maintenance && (
                          <span className="text-xs px-2 py-1 rounded-full bg-blue-500/80 text-white font-bold">
                            LIMITED USE
                          </span>
                        )}
                        {isUnstable && !maintenance && (
                          <span className="text-xs px-2 py-1 rounded-full bg-orange-500/80 text-white font-bold">
                            UNSTABLE
                          </span>
                        )}
                        {maintenance && (
                          <span className="text-xs px-2 py-1 rounded-full bg-yellow-500 text-black font-bold">
                            MAINTENANCE
                          </span>
                        )}
                        {isSelected && !maintenance && (
                          <span className="text-xs px-2 py-1 rounded-full bg-white text-black font-bold">
                            SELECTED
                          </span>
                        )}
                      </div>
                      <span className={`text-sm font-bold px-3 py-1 rounded-lg ${maintenance ? 'bg-yellow-500/20 text-yellow-500' : `${bgColor} ${textColor}`}`}>
                        {model.ticketCost} 🎫
                      </span>
                    </div>

                    <p className="text-sm text-slate-300 mb-3">{model.description}</p>
                    
                    {isUnstable && !maintenance && (
                      <div className="mb-3 p-2 rounded-lg bg-orange-500/10 border border-orange-500/30">
                        <p className="text-xs text-orange-300">
                          ⚠️ <strong>Tip:</strong> Keep prompts SFW (safe for work) for best results. Sensitive content may trigger quality reduction.
                        </p>
                      </div>
                    )}
                    
                    {hasLimitedUse && !maintenance && (
                      <div className="mb-3 p-2 rounded-lg bg-blue-500/10 border border-blue-500/30">
                        <p className="text-xs text-blue-300">
                          ⚠️ <strong>Daily Limit:</strong> {model.rateLimit.rpd} generations per day. Resets at midnight PST.
                        </p>
                      </div>
                    )}

                    <div className="flex items-center gap-6 text-xs text-slate-400">
                      <span>Quality: <span className="text-white font-semibold">{model.quality.toUpperCase()}</span></span>
                      <span className={hasLimitedUse ? 'text-blue-400 font-bold' : ''}>
                        Daily Limit: <span className={`font-semibold ${hasLimitedUse ? 'text-blue-300' : 'text-white'}`}>
                          {model.rateLimit.rpd === 0 ? '∞' : model.rateLimit.rpd}
                        </span>
                      </span>
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
