// Floating Scanner Panel - Single independent draggable scanner (V12)
import React, { useState, useRef, useEffect } from 'react';
import { X, GripVertical } from 'lucide-react';
import ScannerCard from './components/ScannerCard';

interface FloatingScannerProps {
  scannerId: number;
  scanner: {
    model: string;
    celebrityName: string;
    enhancement: string;
    prompt: string;
    quality: '2k' | '4k';
    aspectRatio: '1:1' | '4:5' | '9:16' | '16:9';
    referenceImages: File[];
  };
  onUpdate: (field: string, value: any) => void;
  onGeneratePrompt: () => void;
  onGenerate: () => void;
  onTest: () => void;
  onClose: () => void;
  initialPosition?: { x: number; y: number };
}

export default function FloatingScanner({
  scannerId,
  scanner,
  onUpdate,
  onGeneratePrompt,
  onGenerate,
  onTest,
  onClose,
  initialPosition = { x: 100, y: 100 }
}: FloatingScannerProps) {
  const [position, setPosition] = useState(initialPosition);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const panelRef = useRef<HTMLDivElement>(null);

  const handleMouseMove = (e: MouseEvent) => {
    if (isDragging) {
      setPosition({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y
      });
    }
  };

  const handleTouchMove = (e: TouchEvent) => {
    if (isDragging && e.touches.length === 1) {
      const touch = e.touches[0];
      setPosition({
        x: touch.clientX - dragStart.x,
        y: touch.clientY - dragStart.y
      });
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      window.addEventListener('touchmove', handleTouchMove);
      window.addEventListener('touchend', handleMouseUp);
      return () => {
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
        window.removeEventListener('touchmove', handleTouchMove);
        window.removeEventListener('touchend', handleMouseUp);
      };
    }
  }, [isDragging, dragStart]);

  const handleMouseDown = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('.drag-handle')) {
      setIsDragging(true);
      setDragStart({
        x: e.clientX - position.x,
        y: e.clientY - position.y
      });
    }
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    if ((e.target as HTMLElement).closest('.drag-handle') && e.touches.length === 1) {
      setIsDragging(true);
      const touch = e.touches[0];
      setDragStart({
        x: touch.clientX - position.x,
        y: touch.clientY - position.y
      });
    }
  };

  return (
    <div
      ref={panelRef}
      className="fixed z-50 bg-slate-900/95 backdrop-blur-sm border-2 border-cyan-500/50 rounded-lg shadow-2xl"
      style={{
        left: `${position.x}px`,
        top: `${position.y}px`,
        width: '340px',
        maxWidth: '95vw'
      }}
      onMouseDown={handleMouseDown}
      onTouchStart={handleTouchStart}
    >
      {/* Header Bar */}
      <div className="drag-handle flex items-center justify-between px-3 py-2 bg-slate-800/50 border-b border-cyan-500/30 cursor-move touch-none">
        <div className="flex items-center gap-2">
          <GripVertical size={16} className="text-cyan-400" />
          <span className="text-sm font-bold text-cyan-400">SCANNER {scannerId}</span>
        </div>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onClose();
          }}
          className="p-1 hover:bg-red-500/20 rounded transition-colors"
        >
          <X size={14} className="text-red-400" />
        </button>
      </div>

      {/* Scanner Content */}
      <div className="p-2 h-[280px]">
        <ScannerCard
          slotIndex={scannerId - 1}
          scanner={scanner}
          onUpdate={onUpdate}
          onGeneratePrompt={onGeneratePrompt}
          onGenerate={onGenerate}
          onTest={onTest}
        />
      </div>
    </div>
  );
}
