import { Zap, Lock } from "lucide-react"

interface PromptPackSlotProps {
  slot: {
    id?: number
    slotPosition: number
    isSlotActive: boolean
    name?: string
  }
  isActive: boolean
}

export function PromptPackSlot({ slot, isActive }: PromptPackSlotProps) {
  return (
    <button
      disabled={!isActive}
      className={`
        relative w-full aspect-square rounded-lg border-2 transition-all duration-300
        ${isActive 
          ? 'border-cyan-400 bg-gradient-to-br from-cyan-500/20 to-fuchsia-500/20 hover:shadow-[0_0_30px_rgba(6,182,212,0.4)] cursor-pointer' 
          : 'border-slate-700/30 bg-slate-900/30 cursor-not-allowed'
        }
      `}
    >
      {/* Glow effect when active */}
      {isActive && (
        <>
          <div className="absolute inset-0 rounded-lg bg-cyan-400/10 animate-pulse" />
          <div className="absolute -inset-1 rounded-lg bg-gradient-to-r from-cyan-500/30 to-fuchsia-500/30 blur-lg" />
        </>
      )}

      {/* Content */}
      <div className="relative flex flex-col items-center justify-center h-full gap-1 p-2">
        {isActive ? (
          <>
            <Zap className="w-6 h-6 text-cyan-400" fill="currentColor" />
            <span className="text-[10px] font-bold text-cyan-400 tracking-tighter text-center leading-tight">
              $8<br/>PACK
            </span>
          </>
        ) : (
          <>
            <Lock className="w-5 h-5 text-slate-600" />
            <span className="text-[8px] font-mono text-slate-600 tracking-tighter">
              SLOT {slot.slotPosition}
            </span>
          </>
        )}
      </div>

      {/* Corner indicators (only when active) */}
      {isActive && (
        <>
          <div className="absolute top-0 left-0 w-2 h-2 border-t border-l border-cyan-400" />
          <div className="absolute top-0 right-0 w-2 h-2 border-t border-r border-cyan-400" />
          <div className="absolute bottom-0 left-0 w-2 h-2 border-b border-l border-cyan-400" />
          <div className="absolute bottom-0 right-0 w-2 h-2 border-b border-r border-cyan-400" />
        </>
      )}

      {/* Scanline overlay */}
      {isActive && (
        <div className="absolute inset-0 pointer-events-none rounded-lg overflow-hidden">
          <div className="w-full h-full bg-[repeating-linear-gradient(0deg,transparent,transparent_1px,rgba(0,255,255,0.03)_1px,rgba(0,255,255,0.03)_2px)]" />
        </div>
      )}
    </button>
  )
}