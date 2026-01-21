"use client"

import { useState } from 'react'
import { AI_MODELS, CATEGORY_COLORS, getAvailableModels } from '@/config/ai-models.config'
import { Zap, Crown, Sparkles, ChevronDown, X } from 'lucide-react'

interface ModelSelectorProps {
  selectedModel: string
  onModelSelect: (modelId: string) => void
  userTickets: number
}

export function ModelSelector({ selectedModel, onModelSelect, userTickets }: ModelSelectorProps) {
  const [isOpen, setIsOpen] = useState(false)
  const availableModels = getAvailableModels()
  const currentModel = AI_MODELS.find(m => m.id === selectedModel) || availableModels[0]

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'standard': return <Zap size={16} />
      case 'premium': return <Crown size={16} />
      case 'ultra': return <Sparkles size={16} />
      default: return <Zap size={16} />
    }
  }

  const canAfford = (ticketCost: number) => userTickets >= ticketCost

  return (
    <>
      {/* Selected Model Button */}
      <button
        onClick={() => setIsOpen(true)}
        className={`w-full p-4 rounded-xl border-2 ${CATEGORY_COLORS[currentModel.category].border} ${CATEGORY_COLORS[currentModel.category].bg} 
                    hover:shadow-lg ${CATEGORY_COLORS[currentModel.category].glow} transition-all duration-300
                    flex items-center justify-between`}
      >
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-lg ${CATEGORY_COLORS[currentModel.category].bg}`}>
            {getCategoryIcon(currentModel.category)}
          </div>
          <div className="text-left">
            <div className={`font-bold text-sm ${CATEGORY_COLORS[currentModel.category].text}`}>
              {currentModel.displayName}
            </div>
            <div className="text-xs text-slate-400">
              {currentModel.ticketCost} ticket{currentModel.ticketCost > 1 ? 's' : ''} per scan
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
                const colors = CATEGORY_COLORS[model.category]
                const isSelected = model.id === selectedModel

                return (
                  <button
                    key={model.id}
                    onClick={() => {
                      if (affordable) {
                        onModelSelect(model.id)
                        setIsOpen(false)
                      }
                    }}
                    disabled={!affordable}
                    className={`w-full p-4 rounded-xl border-2 ${colors.border} ${colors.bg}
                              ${affordable ? 'hover:shadow-lg hover:scale-[1.02] cursor-pointer' : 'opacity-40 cursor-not-allowed'}
                              ${isSelected ? 'ring-4 ring-white/50' : ''}
                              transition-all duration-300 text-left`}
                  >
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-3">
                        {getCategoryIcon(model.category)}
                        <span className={`font-bold text-base ${colors.text}`}>
                          {model.displayName}
                        </span>
                        {isSelected && (
                          <span className="text-xs px-2 py-1 rounded-full bg-white text-black font-bold">
                            SELECTED
                          </span>
                        )}
                      </div>
                      <span className={`text-sm font-bold px-3 py-1 rounded-lg ${colors.bg} ${colors.text}`}>
                        {model.ticketCost} 🎫
                      </span>
                    </div>

                    <p className="text-sm text-slate-300 mb-3">{model.description}</p>

                    <div className="flex items-center gap-6 text-xs text-slate-400">
                      <span>Quality: <span className="text-white font-semibold">{model.quality.toUpperCase()}</span></span>
                      <span>Daily Limit: <span className="text-white font-semibold">{model.rateLimit.rpd}</span></span>
                    </div>

                    {!affordable && (
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
