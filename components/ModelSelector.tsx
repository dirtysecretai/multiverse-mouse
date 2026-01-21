"use client"

import { useState } from 'react'
import { AI_MODELS, CATEGORY_COLORS, getAvailableModels } from '@/config/ai-models.config'
import { Zap, Crown, Sparkles, ChevronDown, X } from 'lucide-react'

interface ModelSelectorProps {
  selectedModel: string
  onModelSelect: (modelId: string) => void
  userTickets: number
  geminiProMaintenance?: boolean
  geminiFlashMaintenance?: boolean
}

export function ModelSelector({ selectedModel, onModelSelect, userTickets, geminiProMaintenance, geminiFlashMaintenance }: ModelSelectorProps) {
  const [isOpen, setIsOpen] = useState(false)
  const availableModels = getAvailableModels()
  const currentModel = AI_MODELS.find(m => m.id === selectedModel) || availableModels[0]

  // Check if a model is in maintenance
  const isInMaintenance = (modelId: string) => {
    if (modelId === 'gemini-3-pro-image-preview') return geminiProMaintenance
    if (modelId === 'gemini-2.5-flash-image') return geminiFlashMaintenance
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
        className={`w-full p-4 rounded-xl border-2 
                    ${currentModelInMaintenance 
                      ? 'border-yellow-500/50 bg-yellow-500/10 hover:shadow-yellow-500/20' 
                      : `${CATEGORY_COLORS[currentModel.category].border} ${CATEGORY_COLORS[currentModel.category].bg} ${CATEGORY_COLORS[currentModel.category].glow}`
                    }
                    hover:shadow-lg transition-all duration-300
                    flex items-center justify-between`}
      >
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-lg ${currentModelInMaintenance ? 'bg-yellow-500/20' : CATEGORY_COLORS[currentModel.category].bg}`}>
            {getCategoryIcon(currentModel.category)}
          </div>
          <div className="text-left">
            <div className={`font-bold text-sm ${currentModelInMaintenance ? 'text-yellow-500' : CATEGORY_COLORS[currentModel.category].text}`}>
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

            {/* Models Grid */}
            <div className="space-y-3">
              {availableModels.map((model) => {
                const affordable = canAfford(model.ticketCost)
                const maintenance = isInMaintenance(model.id)
                const colors = CATEGORY_COLORS[model.category]
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
                                : `${colors.border} ${colors.bg}`
                              }
                              ${affordable && !maintenance ? 'hover:shadow-lg hover:scale-[1.02] cursor-pointer' : 'opacity-40 cursor-not-allowed'}
                              ${isSelected ? 'ring-4 ring-white/50' : ''}
                              transition-all duration-300 text-left`}
                  >
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-3">
                        {getCategoryIcon(model.category)}
                        <span className={`font-bold text-base ${maintenance ? 'text-yellow-500' : colors.text}`}>
                          {model.displayName}
                        </span>
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
                      <span className={`text-sm font-bold px-3 py-1 rounded-lg ${maintenance ? 'bg-yellow-500/20 text-yellow-500' : `${colors.bg} ${colors.text}`}`}>
                        {model.ticketCost} 🎫
                      </span>
                    </div>

                    <p className="text-sm text-slate-300 mb-3">{model.description}</p>

                    <div className="flex items-center gap-6 text-xs text-slate-400">
                      <span>Quality: <span className="text-white font-semibold">{model.quality.toUpperCase()}</span></span>
                      <span>Daily Limit: <span className="text-white font-semibold">{model.rateLimit.rpd}</span></span>
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
