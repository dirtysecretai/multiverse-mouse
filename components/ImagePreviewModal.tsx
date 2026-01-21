"use client"

import { useState } from 'react'
import { X, Download, RotateCcw, ZoomIn } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface ImagePreviewModalProps {
  imageUrl: string
  prompt?: string
  onClose: () => void
  onRescan?: () => void
}

export function ImagePreviewModal({ imageUrl, prompt, onClose, onRescan }: ImagePreviewModalProps) {
  const [isZoomed, setIsZoomed] = useState(false)

  return (
    <div 
      className="fixed inset-0 bg-black/90 z-[9999] flex items-center justify-center p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose()
        }
      }}
    >
      <div className="relative max-w-5xl w-full max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-white font-bold text-lg">Universe Scan Result</h3>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-white/10 transition-colors"
          >
            <X size={24} className="text-white" />
          </button>
        </div>

        {/* Image Container */}
        <div 
          className={`relative rounded-xl overflow-hidden bg-slate-900 ${
            isZoomed ? 'cursor-zoom-out' : 'cursor-zoom-in'
          }`}
          onClick={() => setIsZoomed(!isZoomed)}
        >
          <img 
            src={imageUrl} 
            alt="Generated universe" 
            className={`w-full transition-all duration-300 ${
              isZoomed 
                ? 'max-h-none object-contain' 
                : 'max-h-[60vh] object-contain'
            }`}
          />
          
          {/* Zoom Indicator */}
          {!isZoomed && (
            <div className="absolute top-4 right-4 bg-black/70 text-white px-3 py-1 rounded-full text-xs flex items-center gap-1">
              <ZoomIn size={14} />
              Click to zoom
            </div>
          )}
        </div>

        {/* Prompt Display */}
        {prompt && (
          <div className="mt-4 p-3 rounded-lg bg-slate-800/50 border border-slate-700">
            <p className="text-xs text-slate-400 mb-1">Coordinates:</p>
            <p className="text-sm text-white">{prompt}</p>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex gap-3 mt-4">
          <a 
            href={imageUrl} 
            download 
            className="flex-1"
            onClick={(e) => e.stopPropagation()}
          >
            <Button className="w-full bg-cyan-500 hover:bg-cyan-400 text-black font-bold">
              <Download size={18} className="mr-2" />
              Download
            </Button>
          </a>
          
          {onRescan && (
            <Button
              onClick={(e) => {
                e.stopPropagation()
                onRescan()
              }}
              className="flex-1 bg-fuchsia-500 hover:bg-fuchsia-400 text-white font-bold"
            >
              <RotateCcw size={18} className="mr-2" />
              Rescan
            </Button>
          )}
        </div>

        {/* Instructions */}
        <p className="text-center text-xs text-slate-500 mt-3">
          Click image to {isZoomed ? 'zoom out' : 'view full size'} • Click outside to close
        </p>
      </div>
    </div>
  )
}
