import { Lock, Sparkles } from "lucide-react"
import { Button } from "@/components/ui/button"

interface RuneSlotProps {
  slot: {
    id?: number
    name: string
    description: string
    price: number
    imageUrl?: string
    isSlotActive: boolean
    slotPosition: number
  }
  isActive: boolean
}

export function RuneSlot({ slot, isActive }: RuneSlotProps) {
  const slotNumber = slot.slotPosition

  return (
    <div className="relative group w-full">
      {/* Rune Container - SMALLER */}
      <div 
        className={`
          relative rounded-lg border-2 transition-all duration-500
          ${isActive 
            ? 'border-cyan-400 bg-gradient-to-br from-cyan-500/10 to-fuchsia-500/10 shadow-[0_0_20px_rgba(6,182,212,0.3)]' 
            : 'border-slate-700/50 bg-slate-900/50'
          }
        `}
      >
        {/* Slot Number Badge - SMALLER */}
        <div className={`
          absolute -top-2 -left-2 w-6 h-6 rounded-full border-2 flex items-center justify-center text-[10px] font-black
          ${isActive ? 'border-cyan-400 bg-cyan-500 text-black' : 'border-slate-700 bg-slate-800 text-slate-500'}
        `}>
          {slotNumber}
        </div>

        {/* Glow Effect (only when active) */}
        {isActive && (
          <>
            <div className="absolute inset-0 rounded-lg bg-gradient-to-br from-cyan-500/20 to-fuchsia-500/20 animate-pulse" />
            <div className="absolute -inset-0.5 rounded-lg bg-gradient-to-r from-cyan-500/20 via-fuchsia-500/20 to-cyan-500/20 blur-lg" />
          </>
        )}

        {/* Content - COMPACT */}
        <div className="relative p-3">
          {/* Image or Placeholder - SMALLER */}
          <div className={`
            relative aspect-square rounded-lg mb-2 overflow-hidden
            ${isActive ? 'border border-cyan-400/30' : 'border border-slate-700/30'}
          `}>
            {isActive && slot.imageUrl ? (
              <>
                <img 
                  src={slot.imageUrl} 
                  alt={slot.name}
                  className="w-full h-full object-cover"
                />
                {/* Scanline overlay */}
                <div className="absolute inset-0 pointer-events-none bg-[repeating-linear-gradient(0deg,transparent,transparent_1px,rgba(0,255,255,0.03)_1px,rgba(0,255,255,0.03)_2px)]" />
              </>
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-slate-800/50">
                <Lock className={`w-8 h-8 ${isActive ? 'text-cyan-400/50' : 'text-slate-600'}`} />
              </div>
            )}
          </div>

          {/* Rune Symbol Effect - SMALLER */}
          <div className={`
            absolute top-4 right-4 transition-opacity duration-500
            ${isActive ? 'opacity-100' : 'opacity-0'}
          `}>
            <Sparkles className="w-4 h-4 text-cyan-400 animate-pulse" />
          </div>

          {/* Text Content - COMPACT */}
          <div className="space-y-1">
            <h3 className={`
              text-xs font-black uppercase tracking-tight
              ${isActive ? 'text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-fuchsia-500' : 'text-slate-600'}
            `}>
              {isActive ? slot.name : `SLOT ${slotNumber}`}
            </h3>
            
            <p className={`text-[10px] ${isActive ? 'text-slate-400' : 'text-slate-600'} line-clamp-1`}>
              {isActive ? slot.description : 'Available'}
            </p>

            <div className={`
              pt-2 flex items-center justify-between
              ${isActive ? 'border-t border-cyan-500/20' : 'border-t border-slate-700/20'}
            `}>
              <div className={`text-lg font-black ${isActive ? 'text-cyan-400' : 'text-slate-600'}`}>
                ${isActive ? slot.price : '?'}
              </div>
              
              <Button 
                disabled={!isActive}
                className={`
                  font-bold text-[10px] px-3 py-1 h-auto transition-all
                  ${isActive 
                    ? 'bg-cyan-500 hover:bg-cyan-400 text-black hover:shadow-[0_0_15px_rgba(6,182,212,0.5)]' 
                    : 'bg-slate-800 text-slate-600 cursor-not-allowed'
                  }
                `}
              >
                {isActive ? 'CLAIM' : 'LOCK'}
              </Button>
            </div>
          </div>
        </div>

        {/* Corner accents (only when active) - SMALLER */}
        {isActive && (
          <>
            <div className="absolute top-0 left-0 w-3 h-3 border-t border-l border-cyan-400" />
            <div className="absolute top-0 right-0 w-3 h-3 border-t border-r border-cyan-400" />
            <div className="absolute bottom-0 left-0 w-3 h-3 border-b border-l border-cyan-400" />
            <div className="absolute bottom-0 right-0 w-3 h-3 border-b border-r border-cyan-400" />
          </>
        )}
      </div>

      {/* Status indicator - SMALLER */}
      <div className={`
        mt-1 text-center text-[8px] font-mono tracking-widest
        ${isActive ? 'text-cyan-400' : 'text-slate-600'}
      `}>
        {isActive ? '● ACTIVE' : '○ OFF'}
      </div>
    </div>
  )
}