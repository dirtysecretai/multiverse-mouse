// COMPLETE ScannerCard with compact UI - V13
import React, { useState, useEffect } from 'react';
import { Upload, X, ChevronDown, Plus, Minus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { getModelConfig, getAllModels } from '../modelConfig';

type AspectRatio = '1:1' | '2:3' | '3:2' | '4:5' | '3:4' | '4:3' | '9:16' | '16:9';

interface ScannerCardProps {
  slotIndex: number;
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
  onUpdate: (field: string, value: any) => void;
  onGeneratePrompt: () => void;
  onGenerate: () => void;
  onTest: () => void;
  onReferenceUpload?: (files: File[]) => Promise<void>;
  generateDisabled?: boolean;
  promptCooldown?: number;
  promptModel?: 'gemini-3-flash' | 'gemini-2.0-flash-exp' | 'gemini-3-pro' | 'gemini-exp-1206';
  onPromptModelChange?: (model: 'gemini-3-flash' | 'gemini-2.0-flash-exp' | 'gemini-3-pro' | 'gemini-exp-1206') => void;
  isModelInMaintenance?: (modelId: string) => boolean;
}

// Models that don't support reference images
const NO_REFERENCE_MODELS = ['nano-banana-cluster'];

// Models that don't support quality selection (always use default)
const NO_QUALITY_MODELS = ['flash-scanner-v2.5', 'nano-banana-cluster', 'flux-2'];

export default function ScannerCard({
  slotIndex,
  scanner,
  onUpdate,
  onGeneratePrompt,
  onGenerate,
  onTest,
  onReferenceUpload,
  generateDisabled = false,
  promptCooldown = 0,
  promptModel = 'gemini-3-flash',
  onPromptModelChange,
  isModelInMaintenance
}: ScannerCardProps) {
  const [showModelSelector, setShowModelSelector] = useState(false);
  const [showAspectDropdown, setShowAspectDropdown] = useState(false);
  const [showPromptModelDropdown, setShowPromptModelDropdown] = useState(false);

  // Multiple name/enhancement inputs (up to 3)
  const [names, setNames] = useState<string[]>(['']);
  const [enhancements, setEnhancements] = useState<string[]>(['']);
  const [lastSyncedCelebrityName, setLastSyncedCelebrityName] = useState('');
  const [lastSyncedEnhancement, setLastSyncedEnhancement] = useState('');

  // Sync FROM parent TO local state (for rescan) - only when parent values change externally
  useEffect(() => {
    // If the parent's celebrityName changed externally (not from our own update)
    if (scanner.celebrityName !== lastSyncedCelebrityName) {
      const parentNames = scanner.celebrityName ? scanner.celebrityName.split(', ').filter(n => n.trim()) : [''];
      setNames(parentNames.length > 0 ? parentNames : ['']);
      setLastSyncedCelebrityName(scanner.celebrityName);
    }
  }, [scanner.celebrityName]);

  useEffect(() => {
    if (scanner.enhancement !== lastSyncedEnhancement) {
      const parentEnhancements = scanner.enhancement ? scanner.enhancement.split(', ').filter(e => e.trim()) : [''];
      setEnhancements(parentEnhancements.length > 0 ? parentEnhancements : ['']);
      setLastSyncedEnhancement(scanner.enhancement);
    }
  }, [scanner.enhancement]);


  const modelConfig = getModelConfig(scanner.model);
  const allModels = getAllModels();

  // Check if this model supports reference images and quality selection
  const supportsReferenceImages = !NO_REFERENCE_MODELS.includes(scanner.model);
  const supportsQuality = !NO_QUALITY_MODELS.includes(scanner.model);

  // Get supported aspect ratios for this model
  const getSupportedAspectRatios = (model: string): AspectRatio[] => {
    // Models with extended aspect ratio support
    const extendedModels = ['nano-banana-pro', 'seedream-4.5', 'pro-scanner-v3'];

    if (extendedModels.includes(model)) {
      return ['1:1', '2:3', '3:2', '4:5', '3:4', '4:3', '9:16', '16:9'];
    }

    // Default models
    return ['1:1', '4:5', '9:16', '16:9'];
  };

  const supportedAspectRatios = getSupportedAspectRatios(scanner.model);

  // Sync FROM local TO parent when user types
  useEffect(() => {
    const combinedNames = names.filter(n => n.trim()).join(', ');
    if (combinedNames !== scanner.celebrityName) {
      onUpdate('celebrityName', combinedNames);
      setLastSyncedCelebrityName(combinedNames);
    }
  }, [names]);

  useEffect(() => {
    const combinedEnhancements = enhancements.filter(e => e.trim()).join(', ');
    if (combinedEnhancements !== scanner.enhancement) {
      onUpdate('enhancement', combinedEnhancements);
      setLastSyncedEnhancement(combinedEnhancements);
    }
  }, [enhancements]);

  // Update name at specific index
  const updateName = (index: number, value: string) => {
    const newNames = [...names];
    newNames[index] = value;
    setNames(newNames);
  };

  // Update enhancement at specific index
  const updateEnhancement = (index: number, value: string) => {
    const newEnhancements = [...enhancements];
    newEnhancements[index] = value;
    setEnhancements(newEnhancements);
  };

  // Add new input row
  const addInputRow = () => {
    if (names.length < 3) {
      setNames([...names, '']);
      setEnhancements([...enhancements, '']);
    }
  };

  // Remove input row
  const removeInputRow = (index: number) => {
    if (names.length > 1) {
      setNames(names.filter((_, i) => i !== index));
      setEnhancements(enhancements.filter((_, i) => i !== index));
    }
  };

  // Button enable checks
  const hasNameOrEnhancement = names.some(n => n.trim().length > 0) ||
                                enhancements.some(e => e.trim().length > 0);
  const hasPrompt = scanner.prompt && scanner.prompt.trim().length > 0;

  // Calculate ticket cost
  const getTicketCost = () => {
    // NanoBanana Pro & Pro Scanner v3: 5 tickets for 2K, 10 tickets for 4K
    if (scanner.model === 'nano-banana-pro' || scanner.model === 'pro-scanner-v3') {
      return scanner.quality === '4k' ? 10 : 5;
    }
    // SeeDream 4.5: 1 ticket for 2K, 2 tickets for 4K
    if (scanner.model === 'seedream-4.5') {
      return scanner.quality === '4k' ? 2 : 1;
    }
    // NanoBanana Cluster: 2 tickets (generates 2 images)
    if (scanner.model === 'nano-banana-cluster') {
      return 2;
    }
    // Flash Scanner v2.5 & FLUX 2: 1 ticket
    return 1;
  };

  const ticketCost = getTicketCost();

  const handleReferenceUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    // Upload to shared reference panel
    if (onReferenceUpload) await onReferenceUpload(files);

    // Reset the input
    e.target.value = '';
  };


  const selectModel = (modelId: string) => {
    onUpdate('model', modelId);
    setShowModelSelector(false);
    // Clear reference images if switching to a model that doesn't support them
    if (NO_REFERENCE_MODELS.includes(modelId)) {
      onUpdate('referenceImages', []);
      onUpdate('referenceImageUrls', []); // Also clear URL-based references
    }
  };

  const toggleQuality = () => {
    onUpdate('quality', scanner.quality === '2k' ? '4k' : '2k');
  };

  // Removed: const aspectRatios = ['1:1', '4:5', '9:16', '16:9'] as const;
  // Now using supportedAspectRatios defined above

  return (
    <div className="h-full flex flex-col bg-slate-900/80 backdrop-blur-sm border-8 border-slate-700 rounded-lg p-8">
      {/* Name/Enhancement Rows (up to 3) - AT TOP */}
      <div className="mb-6 space-y-4 flex-shrink-0">
        {names.map((name, idx) => (
          <div key={idx} className="flex gap-4 items-center">
            <input
              type="text"
              value={name}
              onChange={(e) => updateName(idx, e.target.value)}
              placeholder={`Name ${names.length > 1 ? idx + 1 : ''}...`}
              className="flex-1 min-w-0 px-8 py-4 bg-slate-800 border-4 border-slate-600 rounded text-4xl text-white placeholder-slate-500 focus:border-cyan-500 focus:outline-none"
            />
            <input
              type="text"
              value={enhancements[idx] || ''}
              onChange={(e) => updateEnhancement(idx, e.target.value)}
              placeholder={`Enhancement ${names.length > 1 ? idx + 1 : ''}...`}
              className="flex-1 min-w-0 px-8 py-4 bg-slate-800 border-4 border-slate-600 rounded text-4xl text-white placeholder-slate-500 focus:border-cyan-500 focus:outline-none"
            />
            {names.length > 1 && idx < names.length - 1 && (
              <button
                onClick={() => removeInputRow(idx)}
                className="p-4 bg-red-600 hover:bg-red-500 rounded transition-colors flex-shrink-0"
              >
                <Minus size={40} className="text-white" />
              </button>
            )}
            {idx === names.length - 1 && (
              <button
                onClick={addInputRow}
                disabled={names.length >= 3}
                className="p-4 bg-green-600 hover:bg-green-500 disabled:opacity-30 disabled:cursor-not-allowed rounded transition-colors flex-shrink-0"
              >
                <Plus size={40} className="text-white" />
              </button>
            )}
          </div>
        ))}
      </div>

      {/* Prompt Textarea - FLEXIBLE HEIGHT */}
      <div className="mb-6 flex-1 min-h-0">
        <textarea
          value={scanner.prompt}
          onChange={(e) => onUpdate('prompt', e.target.value)}
          placeholder="Prompt..."
          className="w-full h-full min-h-[240px] px-8 py-4 bg-slate-800 border-4 border-slate-600 rounded text-4xl text-white placeholder-slate-500 focus:border-cyan-500 focus:outline-none resize-none"
        />
      </div>

      {/* OPTIONS ROW: Reference + Model + Quality + Aspect - ALL ON ONE LINE */}
      <div className="flex gap-4 mb-6 items-center flex-shrink-0 relative">
        {/* Reference Image Upload - Only show for models that support it */}
        {supportsReferenceImages && (
          <div className="relative flex-shrink-0" title="Upload reference images to shared panel">
            <label className="w-28 h-28 border-4 border-dashed rounded flex items-center justify-center transition-colors bg-slate-800 border-fuchsia-600 cursor-pointer hover:border-fuchsia-400">
              <input
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={handleReferenceUpload}
              />
              <Upload className="text-fuchsia-400" size={48} />
            </label>
          </div>
        )}

        {/* Model Selector */}
        <div className="relative flex-1 min-w-0">
          <button
            onClick={() => setShowModelSelector(!showModelSelector)}
            className={`w-full px-6 py-4 bg-slate-800 rounded text-left text-3xl text-white flex items-center justify-between gap-4 ${
              isModelInMaintenance?.(scanner.model)
                ? 'border-8 border-yellow-500 hover:border-yellow-400'
                : 'border-4 border-slate-600 hover:border-cyan-500'
            }`}
          >
            <span className="truncate flex items-center gap-4">
              {modelConfig.icon} {modelConfig.name}
              {isModelInMaintenance?.(scanner.model) && (
                <span className="text-2xl px-4 rounded-full bg-yellow-500 text-black font-bold">MAINT</span>
              )}
            </span>
            <ChevronDown size={40} className="flex-shrink-0" />
          </button>

          {showModelSelector && (
            <div
              className="absolute z-50 top-full mt-4 left-0 w-192 bg-slate-800 border-8 border-cyan-500 rounded-lg shadow-xl"
              onWheel={(e) => e.stopPropagation()}
            >
              {allModels.map(model => {
                const inMaintenance = isModelInMaintenance?.(model.id);
                return (
                  <button
                    key={model.id}
                    onClick={() => selectModel(model.id)}
                    className={`w-full px-8 py-6 text-left border-b-4 border-slate-700 last:border-b-0 hover:bg-slate-700 transition-colors ${
                      model.id === scanner.model ? 'bg-cyan-500/20 border-l-8 border-l-cyan-400' : ''
                    } ${inMaintenance ? 'bg-yellow-500/10' : ''}`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-4xl font-bold text-white truncate flex items-center gap-4">
                        {model.icon} {model.name}
                        {inMaintenance && (
                          <span className="text-2xl px-4 rounded-full bg-yellow-500 text-black font-bold">MAINT</span>
                        )}
                      </span>
                      {!inMaintenance && (
                        <span className={`${model.badgeColors[0]} text-white text-2xl px-4 rounded font-bold`}>
                          {model.badges[0]}
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Quality Toggle - Only show for models that support it */}
        {supportsQuality && (
          <button
            onClick={toggleQuality}
            className={`px-8 py-4 rounded font-bold text-3xl transition-colors flex-shrink-0 ${
              scanner.quality === '4k'
                ? 'bg-cyan-600 text-white'
                : 'bg-slate-800 text-cyan-400 border-4 border-cyan-600'
            }`}
          >
            {scanner.quality.toUpperCase()}
          </button>
        )}

        {/* Aspect Ratio Dropdown */}
        <div className="relative flex-shrink-0">
          <button
            onClick={() => setShowAspectDropdown(!showAspectDropdown)}
            className="px-8 py-4 bg-fuchsia-600 text-white rounded font-bold text-3xl flex items-center gap-4"
          >
            <span>{scanner.aspectRatio}</span>
            <ChevronDown size={40} />
          </button>

          {showAspectDropdown && (
            <div className="absolute z-40 top-full mt-4 right-0 w-64 bg-slate-800 border-4 border-fuchsia-500 rounded shadow-lg max-h-96 overflow-y-auto">
              {supportedAspectRatios.map((ratio) => (
                <button
                  key={ratio}
                  onClick={() => {
                    onUpdate('aspectRatio', ratio);
                    setShowAspectDropdown(false);
                  }}
                  className={`w-full px-8 py-4 text-left text-3xl font-bold hover:bg-slate-700 transition-colors ${
                    scanner.aspectRatio === ratio ? 'bg-fuchsia-600 text-white' : 'text-slate-300'
                  }`}
                >
                  {ratio}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Prompt Model Selector */}
        <div className="relative flex-shrink-0">
          <button
            onClick={() => setShowPromptModelDropdown(!showPromptModelDropdown)}
            className="px-8 py-4 bg-fuchsia-600 text-white rounded font-bold text-3xl flex items-center gap-4"
          >
            <span>{promptModel === 'gemini-3-flash' ? 'G3F' : promptModel === 'gemini-2.0-flash-exp' ? 'G2E' : promptModel === 'gemini-3-pro' ? 'G3P' : 'Exp'}</span>
            <ChevronDown size={40} />
          </button>

          {showPromptModelDropdown && (
            <div className="absolute z-40 top-full mt-4 right-0 w-64 bg-slate-800 border-4 border-fuchsia-500 rounded shadow-lg">
              <button
                onClick={() => {
                  onPromptModelChange?.('gemini-3-flash');
                  setShowPromptModelDropdown(false);
                }}
                className={`w-full px-8 py-4 text-left text-3xl font-bold hover:bg-slate-700 transition-colors ${
                  promptModel === 'gemini-3-flash' ? 'bg-fuchsia-600 text-white' : 'text-slate-300'
                }`}
              >
                G3F
              </button>
              <button
                onClick={() => {
                  onPromptModelChange?.('gemini-2.0-flash-exp');
                  setShowPromptModelDropdown(false);
                }}
                className={`w-full px-8 py-4 text-left text-3xl font-bold hover:bg-slate-700 transition-colors ${
                  promptModel === 'gemini-2.0-flash-exp' ? 'bg-fuchsia-600 text-white' : 'text-slate-300'
                }`}
              >
                G2E
              </button>
              <button
                onClick={() => {
                  onPromptModelChange?.('gemini-3-pro');
                  setShowPromptModelDropdown(false);
                }}
                className={`w-full px-8 py-4 text-left text-3xl font-bold hover:bg-slate-700 transition-colors ${
                  promptModel === 'gemini-3-pro' ? 'bg-fuchsia-600 text-white' : 'text-slate-300'
                }`}
              >
                G3P
              </button>
              <button
                onClick={() => {
                  onPromptModelChange?.('gemini-exp-1206');
                  setShowPromptModelDropdown(false);
                }}
                className={`w-full px-8 py-4 text-left text-3xl font-bold hover:bg-slate-700 transition-colors ${
                  promptModel === 'gemini-exp-1206' ? 'bg-fuchsia-600 text-white' : 'text-slate-300'
                }`}
              >
                Exp
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Action Buttons */}
      <div className="grid grid-cols-2 gap-4 flex-shrink-0">
        <Button
          onClick={onGeneratePrompt}
          disabled={!hasNameOrEnhancement || promptCooldown > 0}
          className="bg-purple-600 hover:bg-purple-500 disabled:opacity-50 disabled:cursor-not-allowed font-bold text-4xl h-28"
          title={promptCooldown > 0 ? `Cooldown: ${promptCooldown}s` : ''}
        >
          {promptCooldown > 0 ? `⏳ ${promptCooldown}s` : '✨ Prompt'}
        </Button>
        <Button
          onClick={onGenerate}
          disabled={!hasPrompt || generateDisabled}
          className="bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 disabled:cursor-not-allowed font-bold text-4xl h-28 flex items-center justify-center gap-4"
          title={generateDisabled ? 'Generation queue full (max 5)' : ''}
        >
          {generateDisabled ? '⏳ Queue Full' : `🔍 Scan (${ticketCost} 🎫${scanner.model === 'nano-banana-cluster' ? ' ×2' : ''})`}
        </Button>
      </div>
    </div>
  );
}
