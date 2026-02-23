// Canvas Scanner - Scanner that lives on the infinite canvas (V14 - with scaling)
import React, { useState, useRef } from 'react';
import { X, GripVertical, Move, ZoomIn, ZoomOut } from 'lucide-react';
import ScannerCard from './components/ScannerCard';

type AspectRatio = '1:1' | '2:3' | '3:2' | '4:5' | '3:4' | '4:3' | '9:16' | '16:9';

interface CanvasScannerProps {
  scannerId: number;
  scanner: {
    model: string;
    celebrityName: string;
    enhancement: string;
    prompt: string;
    quality: '2k' | '4k';
    aspectRatio: AspectRatio;
    referenceImages: File[];
    referenceImageUrls?: string[]; // URLs for loaded reference images (from rescan)
  };
  position: { x: number; y: number };
  canvasScale: number;
  scannerScale: number;
  onUpdate: (field: string, value: any) => void;
  onPositionChange: (newPosition: { x: number; y: number }) => void;
  onScaleChange: (newScale: number) => void;
  onGeneratePrompt: () => void;
  onGenerate: () => void;
  onTest: () => void;
  onClose: () => void;
  onReferenceUpload: (files: File[]) => Promise<void>;
  isGenerating?: boolean;
  generationQueueFull?: boolean;
  promptCooldown?: number;
  promptModel?: 'gemini-3-flash' | 'gemini-2.0-flash-exp' | 'gemini-3-pro' | 'gemini-exp-1206';
  onPromptModelChange?: (model: 'gemini-3-flash' | 'gemini-2.0-flash-exp' | 'gemini-3-pro' | 'gemini-exp-1206') => void;
  isModelInMaintenance?: (modelId: string) => boolean;
}

export default function CanvasScanner({
  scannerId,
  scanner,
  position,
  canvasScale,
  scannerScale,
  onUpdate,
  onPositionChange,
  onScaleChange,
  onGeneratePrompt,
  onGenerate,
  onTest,
  onClose,
  onReferenceUpload,
  isGenerating = false,
  generationQueueFull = false,
  promptCooldown = 0,
  promptModel = 'gemini-3-flash',
  onPromptModelChange,
  isModelInMaintenance
}: CanvasScannerProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [startPosition, setStartPosition] = useState({ x: 0, y: 0 });
  const panelRef = useRef<HTMLDivElement>(null);

  // Document-level mouse handlers for smooth dragging
  React.useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      e.preventDefault();
      const deltaX = (e.clientX - dragStart.x) / canvasScale;
      const deltaY = (e.clientY - dragStart.y) / canvasScale;
      onPositionChange({
        x: startPosition.x + deltaX,
        y: startPosition.y + deltaY
      });
    };

    const handleMouseUp = (e: MouseEvent) => {
      e.preventDefault();
      setIsDragging(false);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, dragStart, canvasScale, startPosition, onPositionChange]);

  const handleMouseDown = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('.drag-handle')) {
      e.stopPropagation();
      e.preventDefault();
      setIsDragging(true);
      setDragStart({ x: e.clientX, y: e.clientY });
      setStartPosition({ x: position.x, y: position.y });
    }
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    if ((e.target as HTMLElement).closest('.drag-handle') && e.touches.length === 1) {
      e.stopPropagation();
      setIsDragging(true);
      const touch = e.touches[0];
      setDragStart({ x: touch.clientX, y: touch.clientY });
      setStartPosition({ x: position.x, y: position.y });
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (isDragging && e.touches.length === 1) {
      e.stopPropagation();
      const touch = e.touches[0];
      const deltaX = (touch.clientX - dragStart.x) / canvasScale;
      const deltaY = (touch.clientY - dragStart.y) / canvasScale;
      onPositionChange({
        x: startPosition.x + deltaX,
        y: startPosition.y + deltaY
      });
    }
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (isDragging) {
      e.stopPropagation();
      setIsDragging(false);
    }
  };

  // Prevent canvas interactions when interacting with scanner
  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
  };

  // Scanner has fixed size in canvas - scales naturally with canvas zoom
  const displayScale = scannerScale;

  return (
    <div
      ref={panelRef}
      data-scanner-panel
      className={`absolute bg-slate-900/95 backdrop-blur-sm border-8 rounded-xl shadow-2xl transition-shadow ${
        isDragging ? 'border-cyan-400 shadow-cyan-500/30' : 'border-cyan-500/50'
      } ${isGenerating ? 'ring-8 ring-yellow-500 ring-opacity-50 animate-pulse' : ''}`}
      style={{
        left: `calc(50% + ${position.x}px)`,
        top: `calc(50% + ${position.y}px)`,
        transform: `translate(-50%, -50%) scale(${displayScale})`,
        transformOrigin: 'center center',
        width: '1440px',
        zIndex: isDragging ? 100 : 30,
      }}
      onClick={handleClick}
      onMouseDown={handleMouseDown}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Header Bar */}
      <div className="drag-handle flex items-center justify-between px-12 py-8 bg-gradient-to-r from-slate-800/80 to-slate-900/80 border-b-4 border-cyan-500/30 cursor-move touch-none rounded-t-xl">
        <div className="flex items-center gap-6">
          <Move size={56} className="text-cyan-400" />
          <span className="text-5xl font-bold text-cyan-400">SCANNER {scannerId}</span>
          {isGenerating && (
            <span className="text-4xl text-yellow-400 animate-pulse">Generating...</span>
          )}
          {generationQueueFull && !isGenerating && (
            <span className="text-4xl text-orange-400">Queue Full</span>
          )}
        </div>
        <div className="flex items-center gap-4">
          {/* Scale controls */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              onScaleChange(scannerScale - 0.25);
            }}
            className="p-4 hover:bg-slate-700 rounded transition-colors"
            title="Decrease scanner size"
          >
            <ZoomOut size={48} className="text-slate-400" />
          </button>
          <span className="text-2xl text-slate-500 w-32 text-center">{scannerScale.toFixed(1)}x</span>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onScaleChange(scannerScale + 0.25);
            }}
            className="p-4 hover:bg-slate-700 rounded transition-colors"
            title="Increase scanner size"
          >
            <ZoomIn size={48} className="text-slate-400" />
          </button>
          <div className="w-1 h-16 bg-slate-600 mx-4" />
          <button
            onClick={(e) => {
              e.stopPropagation();
              onClose();
            }}
            className="p-6 hover:bg-red-500/20 rounded-lg transition-colors"
          >
            <X size={56} className="text-red-400" />
          </button>
        </div>
      </div>

      {/* Scanner Content */}
      <div className="p-12">
        <ScannerCard
          slotIndex={scannerId - 1}
          scanner={scanner}
          onUpdate={onUpdate}
          onGeneratePrompt={onGeneratePrompt}
          onGenerate={onGenerate}
          onTest={onTest}
          onReferenceUpload={onReferenceUpload}
          generateDisabled={generationQueueFull}
          promptCooldown={promptCooldown}
          promptModel={promptModel}
          onPromptModelChange={onPromptModelChange}
          isModelInMaintenance={isModelInMaintenance}
        />
      </div>
    </div>
  );
}
