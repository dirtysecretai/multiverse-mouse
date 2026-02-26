'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { FlaskRound, Sparkles, Lock, CheckCircle, XCircle, Plus, Trash2, Wand2, Clock, ImageIcon, X, ChevronLeft, ChevronRight, ChevronDown, Copy, Maximize2, Download, Upload, ToggleLeft, ToggleRight, Image, Move, FileText, AlertTriangle, Zap } from 'lucide-react';
import { getModelConfig } from '../modelConfig';
import CanvasScanner from '../CanvasScanner';
import { SavedModelPicker } from '@/components/SavedModelPicker';

type AspectRatio = '1:1' | '2:3' | '3:2' | '4:5' | '3:4' | '4:3' | '9:16' | '16:9';

interface SessionImage {
  id: string;
  slotId: string;
  celebrityName: string;
  enhancement: string;
  prompt: string;
  model: string;
  quality: string;
  aspectRatio: string;
  imageUrl: string;
  referenceImageUrls?: string[];
  timestamp: number;
  isDiluted?: boolean;
  isGem?: boolean;
  position: { x: number; y: number };
}

interface LoadingPlaceholder {
  id: string;
  slotId: string;
  position: { x: number; y: number };
  failed?: boolean; // Red placeholder when generation fails
}

// Shared reference image that can be toggled on/off
interface SharedReferenceImage {
  id: string;
  url: string;
  enabled: boolean;
  filename: string;
}

// Canvas configuration - single layer (5x5 grid = 25 images)
const CANVAS_CONFIG = {
  maxImages: 25,
  gridSize: 720, // 720px spacing for 5x5 grid to fit in blue boundary
  canvasSize: 4000,
};

interface AdminState {
  isMaintenanceMode: boolean;
  canvasScannerMaintenance: boolean;
  // OLD maintenance (kept for backward compatibility)
  nanoBananaMaintenance: boolean;
  nanoBananaProMaintenance: boolean;
  seedreamMaintenance: boolean;
  // NEW per-scanner, per-model maintenance
  canvasScanner_nanoBanana?: boolean;
  canvasScanner_nanoBananaPro?: boolean;
  canvasScanner_seedream?: boolean;
  canvasScanner_flux2?: boolean;
  canvasScanner_proScannerV3?: boolean;
  canvasScanner_flashScannerV25?: boolean;
}

function MaintenanceIndicator({ label }: { label: string }) {
  return (
    <div className="p-6 rounded-xl border border-yellow-500/30 bg-yellow-500/5 backdrop-blur-sm">
      <div className="flex items-center gap-3 mb-2">
        <AlertTriangle className="text-yellow-400" size={24} />
        <span className="text-yellow-400 font-bold text-lg">MAINTENANCE MODE</span>
      </div>
      <p className="text-slate-400 text-sm mb-3">
        {label} is currently undergoing maintenance. Please check back later.
      </p>
    </div>
  );
}

export default function PromptingStudio() {
  const router = useRouter();
  const canvasRef = useRef<HTMLDivElement>(null);
  const refImageInputRef = useRef<HTMLInputElement>(null);
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [ticketBalance, setTicketBalance] = useState<number | null>(null);
  const [hasPromptStudioDev, setHasPromptStudioDev] = useState(false);
  const [adminState, setAdminState] = useState<AdminState>({
    isMaintenanceMode: false,
    canvasScannerMaintenance: false,
    nanoBananaMaintenance: false,
    nanoBananaProMaintenance: false,
    seedreamMaintenance: false,
    canvasScanner_nanoBanana: false,
    canvasScanner_nanoBananaPro: false,
    canvasScanner_seedream: false,
    canvasScanner_flux2: false,
    canvasScanner_proScannerV3: false,
    canvasScanner_flashScannerV25: false,
  });

  // Session storage
  const [sessionImages, setSessionImages] = useState<SessionImage[]>([]);
  const [loadingPlaceholders, setLoadingPlaceholders] = useState<LoadingPlaceholder[]>([]);

  // Job tracking refs — keep sets of job IDs we've seen / resolved so that
  // polling never creates duplicate placeholders or adds duplicate images.
  const knownJobIdsRef = useRef<Set<number>>(new Set());
  const resolvedJobIdsRef = useRef<Set<number>>(new Set());

  // URLs of images the user explicitly deleted — persisted in localStorage so
  // syncJobs doesn't re-add them after a page refresh.
  const deletedImageUrlsRef = useRef<Set<string>>(new Set());

  // Positions claimed by in-flight generations but not yet committed to state.
  // Prevents rapid concurrent calls to getNextPosition() from getting the same
  // grid slot before React has processed the previous setLoadingPlaceholders call.
  const pendingPositionsRef = useRef<Set<string>>(new Set());

  // Canvas state (pan/zoom)
  const [canvasOffset, setCanvasOffset] = useState({ x: 0, y: 0 });
  const [canvasScale, setCanvasScale] = useState(1);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  // Mobile touch state
  const [touchStart, setTouchStart] = useState<{ x: number; y: number } | null>(null);
  const [lastTouchDistance, setLastTouchDistance] = useState<number | null>(null);

  // Session saving (up to 50 saved sessions)
  const [savedSessions, setSavedSessions] = useState<any[]>([]);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [showLoadModal, setShowLoadModal] = useState(false);
  const [sessionSaveName, setSessionSaveName] = useState('');
  const [renamingSessionId, setRenamingSessionId] = useState<number | null>(null);
  const [renameSessionName, setRenameSessionName] = useState('');

  // Carousel state
  const [carouselOpen, setCarouselOpen] = useState(false);
  const [carouselIndex, setCarouselIndex] = useState(0);
  const [showRescanModal, setShowRescanModal] = useState(false);

  // Shared reference images for all scanners
  const [sharedReferenceImages, setSharedReferenceImages] = useState<SharedReferenceImage[]>([]);
  const [isUploadingReference, setIsUploadingReference] = useState(false);
  const [previewReferenceImage, setPreviewReferenceImage] = useState<SharedReferenceImage | null>(null);

  // Reference panel position and drag state (positioned outside the blue boundary, to the left)
  const [refPanelPosition, setRefPanelPosition] = useState({ x: -2600, y: 0 });
  const [isRefPanelDragging, setIsRefPanelDragging] = useState(false);
  const [refPanelDragStart, setRefPanelDragStart] = useState({ x: 0, y: 0 });
  const [refPanelStartPosition, setRefPanelStartPosition] = useState({ x: 0, y: 0 });

  // Page mode toggle
  const [canvasMode, setCanvasMode] = useState<'canvas' | 'fullscreen' | 'studio' | 'hybrid' | 'expanded'>('studio');

  // Fullscreen mode: track which image is being viewed
  const [fullscreenImageIndex, setFullscreenImageIndex] = useState(0);

  // Multi-select mode for deleting images
  const [isSelectMode, setIsSelectMode] = useState(false);
  const [selectedImageIds, setSelectedImageIds] = useState<Set<string>>(new Set());

  // Logout confirmation dialog
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  // Prompt boxes panel (50 saved prompts for expanded mode, 25 for other modes)
  const [savedPrompts, setSavedPrompts] = useState<string[]>(Array(50).fill(''));
  const [promptPanelPosition, setPromptPanelPosition] = useState({ x: 2600, y: 0 });
  const [isPromptPanelDragging, setIsPromptPanelDragging] = useState(false);
  const [promptPanelDragStart, setPromptPanelDragStart] = useState({ x: 0, y: 0 });
  const [promptPanelStartPosition, setPromptPanelStartPosition] = useState({ x: 0, y: 0 });

  // Studio scanner panel position and drag state (positioned at bottom center)
  const [studioPanelPosition, setStudioPanelPosition] = useState({ x: 0, y: 1500 });
  const [isStudioPanelDragging, setIsStudioPanelDragging] = useState(false);
  const [studioPanelDragStart, setStudioPanelDragStart] = useState({ x: 0, y: 0 });
  const [studioPanelStartPosition, setStudioPanelStartPosition] = useState({ x: 0, y: 0 });

  // Scanner Panels - up to 4
  interface ScannerPanel {
    id: number;
    position: { x: number; y: number };
    scale: number;
    scanner: {
      model: string;
      celebrityName: string;
      enhancement: string;
      prompt: string;
      quality: '2k' | '4k';
      aspectRatio: AspectRatio;
      referenceImages: File[];
      referenceImageUrls?: string[];
    };
  }

  const MAX_SCANNERS = 2;

  const [scannerPanels, setScannerPanels] = useState<ScannerPanel[]>([]);
  const [nextScannerId, setNextScannerId] = useState(1);
  const [generatingPanels, setGeneratingPanels] = useState<Set<number>>(new Set());

  // Studio Scanner state
  const [studioScanner, setStudioScanner] = useState({
    model: 'nano-banana-pro',
    names: ['', '', ''],
    enhancements: ['', '', ''],
    prompt: '',
    quality: '2k' as '2k' | '4k',
    aspectRatio: '1:1' as AspectRatio,
  });
  const [showStudioAspectDropdown, setShowStudioAspectDropdown] = useState(false);
  const [showStudioPromptModelDropdown, setShowStudioPromptModelDropdown] = useState(false);
  const [isStudioGenerating, setIsStudioGenerating] = useState(false);

  // AI Prompt Generation Models
  const [promptModel, setPromptModel] = useState<'gemini-3-flash' | 'gemini-2.0-flash-exp' | 'gemini-3-pro' | 'gemini-exp-1206'>('gemini-3-flash');
  const [lastPromptGenTime, setLastPromptGenTime] = useState<Record<string, number>>({});
  const [promptCooldown, setPromptCooldown] = useState<number>(0);

  // Cooldown timer effect
  useEffect(() => {
    if (promptCooldown > 0) {
      const timer = setInterval(() => {
        setPromptCooldown(prev => Math.max(0, prev - 1));
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [promptCooldown]);

  // Auto-save session to localStorage
  useEffect(() => {
    const saveTimer = setTimeout(() => {
      try {
        const sessionData = {
          sessionImages,
          loadingPlaceholders, // Save loading placeholders too
          scannerPanels,
          sharedReferenceImages,
          savedPrompts,
          canvasMode,
          canvasScale,
          canvasOffset,
          refPanelPosition,
          promptPanelPosition,
          studioPanelPosition,
          studioScanner,
          timestamp: Date.now(),
        };
        localStorage.setItem('canvas-scanner-autosave', JSON.stringify(sessionData));
      } catch (err) {
        console.error('Failed to auto-save session:', err);
      }
    }, 1000); // Debounce: save 1 second after last change

    return () => clearTimeout(saveTimer);
  }, [sessionImages, loadingPlaceholders, scannerPanels, sharedReferenceImages, savedPrompts, canvasMode, canvasScale, canvasOffset, refPanelPosition, promptPanelPosition, studioPanelPosition, studioScanner]);

  // Restore session from localStorage on mount
  useEffect(() => {
    const restoreSession = () => {
      try {
        const saved = localStorage.getItem('canvas-scanner-autosave');
        if (saved) {
          const sessionData = JSON.parse(saved);
          // Only restore if session is less than 24 hours old
          const hoursSinceLastSave = (Date.now() - (sessionData.timestamp || 0)) / (1000 * 60 * 60);
          if (hoursSinceLastSave < 24) {
            const restoredImages = sessionData.sessionImages || [];

            // Restore the set of URLs the user explicitly deleted so syncJobs
            // doesn't re-add them after the refresh.
            if (Array.isArray(sessionData.deletedImageUrls)) {
              deletedImageUrlsRef.current = new Set(sessionData.deletedImageUrls as string[]);
            }

            // Restore completed session images from localStorage.
            // In-flight jobs (loading placeholders) are NOT restored from localStorage —
            // syncJobs polls the DB after auth and restores them with correct `job-{id}` IDs,
            // avoiding stale placeholder IDs that would never be removed.
            setSessionImages(restoredImages);
            if (sessionData.scannerPanels) {
              setScannerPanels(sessionData.scannerPanels);
              const maxId = Math.max(0, ...sessionData.scannerPanels.map((p: any) => p.id));
              setNextScannerId(maxId + 1);
            }
            if (sessionData.sharedReferenceImages) setSharedReferenceImages(sessionData.sharedReferenceImages);
            if (sessionData.savedPrompts) setSavedPrompts(sessionData.savedPrompts);
            if (sessionData.canvasMode) setCanvasMode(sessionData.canvasMode);
            if (sessionData.canvasScale) setCanvasScale(sessionData.canvasScale);
            if (sessionData.canvasOffset) setCanvasOffset(sessionData.canvasOffset);
            if (sessionData.refPanelPosition) setRefPanelPosition(sessionData.refPanelPosition);
            if (sessionData.promptPanelPosition) setPromptPanelPosition(sessionData.promptPanelPosition);
            if (sessionData.studioPanelPosition) setStudioPanelPosition(sessionData.studioPanelPosition);
            if (sessionData.studioScanner) setStudioScanner(sessionData.studioScanner);
          }
        }
      } catch (err) {
        console.error('Failed to restore session:', err);
      }
    };

    restoreSession();
  }, []); // Only run on mount

  // ---------------------------------------------------------------------------
  // Per-account generation job sync
  // ---------------------------------------------------------------------------
  // Fetches the current user's in-flight GenerationQueue records from the server
  // so that loading placeholders persist across page refreshes and concurrent
  // generations from other tabs/devices are counted correctly.

  const syncJobs = useCallback(async () => {
    if (!user) return;
    try {
      const res = await fetch('/api/prompting-studio/jobs');
      if (!res.ok) return;
      const { jobs } = await res.json() as { jobs: any[] };

      for (const job of jobs) {
        const params = job.parameters as any;
        const jobPlaceholderId = `job-${job.id}`;

        if ((job.status === 'processing' || job.status === 'queued') && !knownJobIdsRef.current.has(job.id)) {
          // Unknown in-flight job — could be from a refresh OR from the current session
          // (syncJobs fires every 3s and may see the DB job before handleGenerate's API
          // call returns with the jobId).  Re-ID any existing placeholder at the same
          // canvas position rather than adding a second one, so the count stays correct.
          // This is safe because loadingPlaceholders are never restored from localStorage —
          // any placeholder-{ts} at this position belongs to the current session only.
          knownJobIdsRef.current.add(job.id);
          const jobPosition = params?.position || { x: 0, y: 0 };
          setLoadingPlaceholders(prev => {
            if (prev.some(p => p.id === jobPlaceholderId)) return prev;
            // If handleGenerate already added a placeholder-{ts} at this position,
            // rename it to the canonical job-{id} so both code paths share one placeholder.
            const matchIdx = prev.findIndex(
              p => !p.failed && p.position.x === jobPosition.x && p.position.y === jobPosition.y
            );
            if (matchIdx >= 0) {
              const updated = [...prev];
              updated[matchIdx] = { ...updated[matchIdx], id: jobPlaceholderId };
              return updated;
            }
            return [...prev, {
              id: jobPlaceholderId,
              slotId: params?.slotId || 'studio-scanner',
              position: jobPosition,
            }];
          });

        } else if (job.status === 'completed' && job.resultUrl && !resolvedJobIdsRef.current.has(job.id)) {
          // Job completed — remove the placeholder and add the session image.
          // Use BOTH id AND imageUrl for deduplication: restoreSession may have already
          // added this image with a different id (e.g. the GeneratedImage DB id), causing
          // a duplicate at position {x:0,y:0} that stacks "over the middle".
          resolvedJobIdsRef.current.add(job.id);
          // Skip if the user explicitly deleted this image from the canvas.
          if (deletedImageUrlsRef.current.has(job.resultUrl)) continue;
          setLoadingPlaceholders(prev =>
            prev.filter(p => p.id !== jobPlaceholderId)
          );
          setSessionImages(prev => {
            const imgId = `img-job-${job.id}`;
            // Skip if already present by id OR by URL (restoreSession may have added it)
            if (prev.some(img => img.id === imgId || img.imageUrl === job.resultUrl)) return prev;
            return [...prev, {
              id: imgId,
              slotId: params?.slotId || 'studio-scanner',
              celebrityName: params?.celebrityName || '',
              enhancement: params?.enhancement || '',
              prompt: job.prompt,
              model: params?.model || '',
              quality: params?.quality || '2k',
              aspectRatio: params?.aspectRatio || '1:1',
              imageUrl: job.resultUrl,
              referenceImageUrls: params?.referenceImageUrls || [],
              timestamp: job.completedAt ? new Date(job.completedAt).getTime() : Date.now(),
              isDiluted: false,
              isGem: false,
              position: params?.position || { x: 0, y: 0 },
            }];
          });

        } else if (job.status === 'failed' && !resolvedJobIdsRef.current.has(job.id)) {
          // Job failed — mark the placeholder red.
          resolvedJobIdsRef.current.add(job.id);
          setLoadingPlaceholders(prev =>
            prev.map(p => p.id === jobPlaceholderId ? { ...p, failed: true } : p)
          );
        }
      }
    } catch (e) {
      console.error('Job sync error:', e);
    }
  }, [user]);

  // Sync once when user session is first available
  const hasSyncedInitialJobsRef = useRef(false);
  useEffect(() => {
    if (!user || hasSyncedInitialJobsRef.current) return;
    hasSyncedInitialJobsRef.current = true;
    syncJobs();
  }, [user, syncJobs]);

  // Poll every 3 seconds while the page is open so placeholders resolve in real time
  useEffect(() => {
    if (!user) return;
    const interval = setInterval(syncJobs, 3000);
    return () => clearInterval(interval);
  }, [user, syncJobs]);

  // Helper to check if a model is in maintenance
  const isModelInMaintenance = (modelId: string): boolean => {
    const modelMap: Record<string, keyof AdminState> = {
      'nano-banana': 'canvasScanner_nanoBanana',
      'nano-banana-cluster': 'canvasScanner_nanoBanana', // Canvas scanner also uses 'nano-banana-cluster'
      'nano-banana-pro': 'canvasScanner_nanoBananaPro',
      'seedream-4.5': 'canvasScanner_seedream',
      'flux-2': 'canvasScanner_flux2',
      'gemini-3-pro-image': 'canvasScanner_proScannerV3',
      'pro-scanner-v3': 'canvasScanner_proScannerV3',
      'gemini-2.5-flash-image': 'canvasScanner_flashScannerV25',
      'flash-scanner-v2.5': 'canvasScanner_flashScannerV25',
    };

    const maintenanceField = modelMap[modelId];
    if (maintenanceField && adminState[maintenanceField]) return true;

    // Fallback to OLD maintenance fields
    if (modelId === 'nano-banana-pro' && adminState.nanoBananaProMaintenance) return true;
    if (modelId === 'nano-banana' && adminState.nanoBananaMaintenance) return true;
    if (modelId === 'nano-banana-cluster' && adminState.nanoBananaMaintenance) return true;
    if (modelId === 'seedream-4.5' && adminState.seedreamMaintenance) return true;

    return false;
  };

  // Helper to get supported aspect ratios for a model
  const getSupportedAspectRatios = (model: string): AspectRatio[] => {
    // Models with extended aspect ratio support
    const extendedModels = ['nano-banana-pro', 'seedream-4.5', 'pro-scanner-v3'];

    if (extendedModels.includes(model)) {
      return ['1:1', '2:3', '3:2', '4:5', '3:4', '4:3', '9:16', '16:9'];
    }

    // Default models
    return ['1:1', '4:5', '9:16', '16:9'];
  };

  // Helper to create a new scanner panel
  const createScannerPanel = () => {
    if (scannerPanels.length >= MAX_SCANNERS) {
      alert(`Maximum ${MAX_SCANNERS} scanners allowed. Remove one first.`);
      return;
    }

    const offset = scannerPanels.length * 400;
    const newPanel: ScannerPanel = {
      id: nextScannerId,
      position: { x: -500 + offset, y: -200 },
      scale: 1.0,
      scanner: {
        model: 'nano-banana-pro',
        celebrityName: '',
        enhancement: '',
        prompt: '',
        quality: '2k',
        aspectRatio: '1:1',
        referenceImages: [],
        referenceImageUrls: [],
      }
    };

    setScannerPanels(prev => [...prev, newPanel]);
    setNextScannerId(prev => prev + 1);
  };

  const removeScannerPanel = (panelId: number) => {
    setScannerPanels(prev => prev.filter(p => p.id !== panelId));
  };

  const updateScannerPanel = (panelId: number, field: string, value: any) => {
    setScannerPanels(prev => prev.map(p =>
      p.id === panelId
        ? { ...p, scanner: { ...p.scanner, [field]: value } }
        : p
    ));

    // Disable all reference images if switching to nano-banana-cluster
    if (field === 'model' && value === 'nano-banana-cluster') {
      setSharedReferenceImages(prev => prev.map(ref => ({ ...ref, enabled: false })));
    }
  };

  const updateScannerPosition = (panelId: number, newPosition: { x: number; y: number }) => {
    setScannerPanels(prev => prev.map(p =>
      p.id === panelId
        ? { ...p, position: newPosition }
        : p
    ));
  };

  const updateScannerScale = (panelId: number, newScale: number) => {
    const clampedScale = Math.max(0.5, Math.min(3.0, newScale));
    setScannerPanels(prev => prev.map(p =>
      p.id === panelId
        ? { ...p, scale: clampedScale }
        : p
    ));
  };

  // Shared reference image functions
  // Dynamic max reference images based on mode (50 for expanded, 25 for other modes)
  const MAX_REFERENCE_IMAGES = canvasMode === 'expanded' ? 50 : 25;

  // Dynamic max active references based on models in use
  const MAX_ACTIVE_REFERENCES = (() => {
    // Models that support 8 active reference images
    const extendedReferenceModels = ['nano-banana-pro', 'seedream-4.5', 'pro-scanner-v3'];

    // Check if any scanner panel is using an extended model
    const hasExtendedModel = scannerPanels.some(panel =>
      extendedReferenceModels.includes(panel.scanner.model)
    );

    // Check if studio scanner is using an extended model
    const studioHasExtended = extendedReferenceModels.includes(studioScanner.model);

    // Return 8 if any scanner uses extended models, otherwise 4
    return (hasExtendedModel || studioHasExtended) ? 8 : 4;
  })();

  const handleReferenceImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    const remaining = MAX_REFERENCE_IMAGES - sharedReferenceImages.length;
    if (remaining <= 0) return;

    const filesToUpload = files.slice(0, remaining);

    setIsUploadingReference(true);

    for (const file of filesToUpload) {
      try {
        const formData = new FormData();
        formData.append('file', file);
        const res = await fetch('/api/upload-reference', {
          method: 'POST',
          body: formData
        });
        const data = await res.json();
        if (data.url) {
          setSharedReferenceImages(prev => {
            if (prev.length >= MAX_REFERENCE_IMAGES) return prev;
            const enabledCount = prev.filter(r => r.enabled).length;
            const newRef: SharedReferenceImage = {
              id: `ref-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
              url: data.url,
              enabled: enabledCount < MAX_ACTIVE_REFERENCES,
              filename: file.name,
            };
            return [...prev, newRef];
          });
        }
      } catch (err) {
        console.error('Failed to upload reference:', err);
      }
    }

    setIsUploadingReference(false);
    // Reset the input
    e.target.value = '';
  };

  const toggleReferenceImage = (refId: string) => {
    setSharedReferenceImages(prev => {
      const target = prev.find(r => r.id === refId);
      if (!target) return prev;
      // If turning on, check we haven't hit the active limit
      if (!target.enabled) {
        const enabledCount = prev.filter(r => r.enabled).length;
        if (enabledCount >= MAX_ACTIVE_REFERENCES) return prev; // Can't enable more
      }
      return prev.map(ref =>
        ref.id === refId ? { ...ref, enabled: !ref.enabled } : ref
      );
    });
  };

  const removeReferenceImage = (refId: string) => {
    setSharedReferenceImages(prev => prev.filter(ref => ref.id !== refId));
  };

  const handleLoadSavedModel = (model: { name: string; referenceImageUrls: string[] }) => {
    const newRefs: SharedReferenceImage[] = model.referenceImageUrls.map((url, i) => ({
      id: `model-${Date.now()}-${i}`,
      url,
      enabled: i < MAX_ACTIVE_REFERENCES,
      filename: `${model.name} (${i + 1})`,
    }));
    setSharedReferenceImages(newRefs);
  };

  // Get enabled reference image URLs
  const getEnabledReferenceUrls = () => {
    return sharedReferenceImages.filter(ref => ref.enabled).map(ref => ref.url);
  };

  // Add reference images from scanner to shared panel
  const handleScannerReferenceUpload = async (files: File[]) => {
    if (files.length === 0) return;

    const remaining = MAX_REFERENCE_IMAGES - sharedReferenceImages.length;
    if (remaining <= 0) {
      alert(`Maximum ${MAX_REFERENCE_IMAGES} reference images. Remove some first.`);
      return;
    }

    const filesToUpload = files.slice(0, remaining);

    for (const file of filesToUpload) {
      try {
        const formData = new FormData();
        formData.append('file', file);
        const res = await fetch('/api/upload-reference', {
          method: 'POST',
          body: formData
        });
        const data = await res.json();
        if (data.url) {
          setSharedReferenceImages(prev => {
            if (prev.length >= MAX_REFERENCE_IMAGES) return prev;
            const enabledCount = prev.filter(r => r.enabled).length;
            const newRef: SharedReferenceImage = {
              id: `ref-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
              url: data.url,
              enabled: enabledCount < MAX_ACTIVE_REFERENCES,
              filename: file.name,
            };
            return [...prev, newRef];
          });
        }
      } catch (err) {
        console.error('Failed to upload reference:', err);
      }
    }
  };

  // Reference panel drag handlers
  const handleRefPanelMouseDown = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('.ref-panel-drag-handle')) {
      e.stopPropagation();
      e.preventDefault();
      setIsRefPanelDragging(true);
      setRefPanelDragStart({ x: e.clientX, y: e.clientY });
      setRefPanelStartPosition({ x: refPanelPosition.x, y: refPanelPosition.y });
    }
  };

  // Document-level mouse handlers for smooth reference panel dragging
  useEffect(() => {
    if (!isRefPanelDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      e.preventDefault();
      const deltaX = (e.clientX - refPanelDragStart.x) / canvasScale;
      const deltaY = (e.clientY - refPanelDragStart.y) / canvasScale;
      setRefPanelPosition({
        x: refPanelStartPosition.x + deltaX,
        y: refPanelStartPosition.y + deltaY
      });
    };

    const handleMouseUp = (e: MouseEvent) => {
      e.preventDefault();
      setIsRefPanelDragging(false);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isRefPanelDragging, refPanelDragStart, canvasScale, refPanelStartPosition]);

  // Reference panel touch handlers
  const handleRefPanelTouchStart = (e: React.TouchEvent) => {
    if ((e.target as HTMLElement).closest('.ref-panel-drag-handle') && e.touches.length === 1) {
      e.stopPropagation();
      setIsRefPanelDragging(true);
      const touch = e.touches[0];
      setRefPanelDragStart({ x: touch.clientX, y: touch.clientY });
      setRefPanelStartPosition({ x: refPanelPosition.x, y: refPanelPosition.y });
    }
  };

  const handleRefPanelTouchMove = (e: React.TouchEvent) => {
    if (isRefPanelDragging && e.touches.length === 1) {
      e.stopPropagation();
      const touch = e.touches[0];
      const deltaX = (touch.clientX - refPanelDragStart.x) / canvasScale;
      const deltaY = (touch.clientY - refPanelDragStart.y) / canvasScale;
      setRefPanelPosition({
        x: refPanelStartPosition.x + deltaX,
        y: refPanelStartPosition.y + deltaY
      });
    }
  };

  const handleRefPanelTouchEnd = (e: React.TouchEvent) => {
    if (isRefPanelDragging) {
      e.stopPropagation();
      setIsRefPanelDragging(false);
    }
  };

  // Prompt panel functions
  const updateSavedPrompt = (index: number, value: string) => {
    setSavedPrompts(prev => {
      const newPrompts = [...prev];
      newPrompts[index] = value;
      return newPrompts;
    });
  };

  const copyPromptFromBox = async (index: number) => {
    const prompt = savedPrompts[index];
    if (prompt.trim()) {
      try {
        await navigator.clipboard.writeText(prompt);
        alert(`Prompt ${index + 1} copied!`);
      } catch (err) {
        // Mobile fallback
        try {
          const textArea = document.createElement('textarea');
          textArea.value = prompt;
          textArea.style.position = 'fixed';
          textArea.style.left = '-999999px';
          document.body.appendChild(textArea);
          textArea.focus();
          textArea.select();
          const successful = document.execCommand('copy');
          document.body.removeChild(textArea);
          if (successful) {
            alert(`Prompt ${index + 1} copied!`);
          } else {
            alert('Copy failed. Please try again or copy manually.');
          }
        } catch (fallbackErr) {
          alert('Copy failed. Please try again or copy manually.');
        }
      }
    }
  };

  // Prompt panel drag handlers
  const handlePromptPanelMouseDown = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('.prompt-panel-drag-handle')) {
      e.stopPropagation();
      e.preventDefault();
      setIsPromptPanelDragging(true);
      setPromptPanelDragStart({ x: e.clientX, y: e.clientY });
      setPromptPanelStartPosition({ x: promptPanelPosition.x, y: promptPanelPosition.y });
    }
  };

  // Document-level mouse handlers for smooth prompt panel dragging
  useEffect(() => {
    if (!isPromptPanelDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      e.preventDefault();
      const deltaX = (e.clientX - promptPanelDragStart.x) / canvasScale;
      const deltaY = (e.clientY - promptPanelDragStart.y) / canvasScale;
      setPromptPanelPosition({
        x: promptPanelStartPosition.x + deltaX,
        y: promptPanelStartPosition.y + deltaY
      });
    };

    const handleMouseUp = (e: MouseEvent) => {
      e.preventDefault();
      setIsPromptPanelDragging(false);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isPromptPanelDragging, promptPanelDragStart, canvasScale, promptPanelStartPosition]);

  // Prompt panel touch handlers
  const handlePromptPanelTouchStart = (e: React.TouchEvent) => {
    if ((e.target as HTMLElement).closest('.prompt-panel-drag-handle') && e.touches.length === 1) {
      e.stopPropagation();
      setIsPromptPanelDragging(true);
      const touch = e.touches[0];
      setPromptPanelDragStart({ x: touch.clientX, y: touch.clientY });
      setPromptPanelStartPosition({ x: promptPanelPosition.x, y: promptPanelPosition.y });
    }
  };

  const handlePromptPanelTouchMove = (e: React.TouchEvent) => {
    if (isPromptPanelDragging && e.touches.length === 1) {
      e.stopPropagation();
      const touch = e.touches[0];
      const deltaX = (touch.clientX - promptPanelDragStart.x) / canvasScale;
      const deltaY = (touch.clientY - promptPanelDragStart.y) / canvasScale;
      setPromptPanelPosition({
        x: promptPanelStartPosition.x + deltaX,
        y: promptPanelStartPosition.y + deltaY
      });
    }
  };

  const handlePromptPanelTouchEnd = (e: React.TouchEvent) => {
    if (isPromptPanelDragging) {
      e.stopPropagation();
      setIsPromptPanelDragging(false);
    }
  };

  // Studio panel drag handlers
  const handleStudioPanelMouseDown = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('.studio-panel-drag-handle')) {
      e.stopPropagation();
      setIsStudioPanelDragging(true);
      setStudioPanelDragStart({ x: e.clientX, y: e.clientY });
      setStudioPanelStartPosition({ x: studioPanelPosition.x, y: studioPanelPosition.y });
    }
  };

  const handleStudioPanelMouseMove = (e: React.MouseEvent) => {
    if (isStudioPanelDragging) {
      e.stopPropagation();
      const deltaX = (e.clientX - studioPanelDragStart.x) / canvasScale;
      const deltaY = (e.clientY - studioPanelDragStart.y) / canvasScale;
      setStudioPanelPosition({
        x: studioPanelStartPosition.x + deltaX,
        y: studioPanelStartPosition.y + deltaY
      });
    }
  };

  const handleStudioPanelMouseUp = (e: React.MouseEvent) => {
    if (isStudioPanelDragging) {
      e.stopPropagation();
      setIsStudioPanelDragging(false);
    }
  };

  const handleStudioPanelTouchStart = (e: React.TouchEvent) => {
    if ((e.target as HTMLElement).closest('.studio-panel-drag-handle') && e.touches.length === 1) {
      e.stopPropagation();
      setIsStudioPanelDragging(true);
      const touch = e.touches[0];
      setStudioPanelDragStart({ x: touch.clientX, y: touch.clientY });
      setStudioPanelStartPosition({ x: studioPanelPosition.x, y: studioPanelPosition.y });
    }
  };

  const handleStudioPanelTouchMove = (e: React.TouchEvent) => {
    if (isStudioPanelDragging && e.touches.length === 1) {
      e.stopPropagation();
      const touch = e.touches[0];
      const deltaX = (touch.clientX - studioPanelDragStart.x) / canvasScale;
      const deltaY = (touch.clientY - studioPanelDragStart.y) / canvasScale;
      setStudioPanelPosition({
        x: studioPanelStartPosition.x + deltaX,
        y: studioPanelStartPosition.y + deltaY
      });
    }
  };

  const handleStudioPanelTouchEnd = (e: React.TouchEvent) => {
    if (isStudioPanelDragging) {
      e.stopPropagation();
      setIsStudioPanelDragging(false);
    }
  };

  // Image interaction (click to preview only, no dragging)

  // Check auth and load sessions
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const res = await fetch('/api/auth/session');
        const data = await res.json();

        if (!data.authenticated) {
          router.push('/');
          return;
        }

        setUser(data.user);

        // Load subscription status — Canvas Scanner is Dev Tier only
        const subRes = await fetch('/api/user/subscription');
        const subData = await subRes.json();
        if (subData.success) {
          setHasPromptStudioDev(subData.hasPromptStudioDev);

          // Redirect free users — Canvas Scanner requires Dev Tier
          if (!subData.hasPromptStudioDev && data.user?.email !== 'dirtysecretai@gmail.com') {
            router.push('/prompting-studio/upgrade');
            return;
          }
        }

        // Load ticket balance
        const ticketRes = await fetch(`/api/user/tickets?userId=${data.user.id}`);
        const ticketData = await ticketRes.json();
        if (ticketData.success) {
          setTicketBalance(ticketData.balance);
        }

        // Load saved sessions
        const sessionsRes = await fetch(`/api/prompting-studio/sessions?userId=${data.user.id}`);
        const sessionsData = await sessionsRes.json();
        if (sessionsData.success) {
          setSavedSessions(sessionsData.sessions);
        }

        // Fetch admin config for maintenance status
        const adminRes = await fetch('/api/admin/config');
        const adminData = await adminRes.json();
        if (adminRes.ok) {
          setAdminState({
            isMaintenanceMode: !!adminData.isMaintenanceMode,
            canvasScannerMaintenance: !!adminData.canvasScannerMaintenance || false,
            nanoBananaMaintenance: !!adminData.nanoBananaMaintenance || false,
            nanoBananaProMaintenance: !!adminData.nanoBananaProMaintenance || false,
            seedreamMaintenance: !!adminData.seedreamMaintenance || false,
            canvasScanner_nanoBanana: !!adminData.canvasScanner_nanoBanana || false,
            canvasScanner_nanoBananaPro: !!adminData.canvasScanner_nanoBananaPro || false,
            canvasScanner_seedream: !!adminData.canvasScanner_seedream || false,
            canvasScanner_flux2: !!adminData.canvasScanner_flux2 || false,
            canvasScanner_proScannerV3: !!adminData.canvasScanner_proScannerV3 || false,
            canvasScanner_flashScannerV25: !!adminData.canvasScanner_flashScannerV25 || false,
          });
        }
      } catch (err) {
        router.push('/');
      } finally {
        setLoading(false);
      }
    };
    checkAuth();
  }, [router]);

  // Center canvas on initial load (two scrolls in from minimum zoom)
  useEffect(() => {
    const centerOnLoad = () => {
      if (canvasRef.current && !loading) {
        const rect = canvasRef.current.getBoundingClientRect();
        setCanvasOffset({ x: rect.width / 2, y: rect.height / 2 });
        setCanvasScale(0.24); // Quarter scroll back from 0.25
      }
    };

    const timer = setTimeout(centerOnLoad, 100);
    return () => clearTimeout(timer);
  }, [loading]);

  // Prevent body scroll on mobile
  useEffect(() => {
    const originalBodyOverflow = document.body.style.overflow;
    const originalBodyPosition = document.body.style.position;
    const originalHtmlOverscroll = document.documentElement.style.overscrollBehavior;

    document.body.style.overflow = 'hidden';
    document.body.style.position = 'fixed';
    document.body.style.width = '100%';
    document.body.style.height = '100%';
    document.documentElement.style.overscrollBehavior = 'none';

    return () => {
      document.body.style.overflow = originalBodyOverflow;
      document.body.style.position = originalBodyPosition;
      document.documentElement.style.overscrollBehavior = originalHtmlOverscroll;
    };
  }, []);

  // Keyboard navigation for fullscreen mode
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (canvasMode === 'fullscreen' && sessionImages.length > 1) {
        if (e.key === 'ArrowLeft') {
          e.preventDefault();
          setFullscreenImageIndex((prev) => (prev - 1 + sessionImages.length) % sessionImages.length);
        } else if (e.key === 'ArrowRight') {
          e.preventDefault();
          setFullscreenImageIndex((prev) => (prev + 1) % sessionImages.length);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [canvasMode, sessionImages.length, fullscreenImageIndex]);

  // Reset fullscreen index when switching to fullscreen mode or when index is out of bounds
  useEffect(() => {
    if (canvasMode === 'fullscreen') {
      // If current index is out of bounds, reset to 0
      if (fullscreenImageIndex >= sessionImages.length) {
        setFullscreenImageIndex(Math.max(0, sessionImages.length - 1));
      }
    }
  }, [canvasMode, sessionImages.length, fullscreenImageIndex]);

  // Recalculate image positions when mode changes (canvas vs studio vs hybrid vs expanded)
  useEffect(() => {
    if (canvasMode === 'canvas' || canvasMode === 'studio' || canvasMode === 'hybrid' || canvasMode === 'expanded') {
      setSessionImages(prev => prev.map((img, idx) => ({
        ...img,
        position: generatePositionByIndex(idx)
      })));
    }
  }, [canvasMode]);

  // Exit select mode when canvas mode changes or when all images are deleted
  useEffect(() => {
    if (sessionImages.length === 0) {
      setIsSelectMode(false);
      setSelectedImageIds(new Set());
    }
  }, [sessionImages.length]);

  // Generate position based on index and mode
  const generatePositionByIndex = (index: number) => {
    const gridSize = CANVAS_CONFIG.gridSize;

    if (canvasMode === 'studio') {
      // Zigzag pattern: bottom-left to right, then up and right to left, repeat
      const row = Math.floor(index / 5);
      const posInRow = index % 5;

      let col;
      if (row % 2 === 0) {
        // Even rows: left to right
        col = posInRow;
      } else {
        // Odd rows: right to left
        col = 4 - posInRow;
      }

      const gridX = col - 2; // Convert to -2, -1, 0, 1, 2
      const gridY = 2 - row; // Row 0 -> y=2 (bottom), Row 4 -> y=-2 (top)

      // Shift upward by 1200px to position above the scanner with spacing
      return {
        x: gridX * gridSize,
        y: (gridY * gridSize) - 1200
      };
    } else {
      // Spiral pattern from center for canvas mode
      if (index === 0) return { x: 0, y: 0 }; // Start at center

      let x = 0, y = 0;
      let direction = 0; // 0: right, 1: down, 2: left, 3: up
      let steps = 1;
      let stepsInCurrentDirection = 0;
      let stepsTaken = 0;

      for (let i = 0; i < index; i++) {
        if (direction === 0) x += 1;      // Move right
        else if (direction === 1) y += 1; // Move down
        else if (direction === 2) x -= 1; // Move left
        else if (direction === 3) y -= 1; // Move up

        stepsInCurrentDirection++;

        if (stepsInCurrentDirection === steps) {
          stepsInCurrentDirection = 0;
          direction = (direction + 1) % 4;
          stepsTaken++;

          // Increase steps after moving in 2 directions
          if (stepsTaken % 2 === 0) {
            steps++;
          }
        }
      }

      return { x: x * gridSize, y: y * gridSize };
    }
  };

  // Calculate next position for new image
  const getNextPosition = () => {
    const occupiedPositions = new Set<string>();

    sessionImages.forEach(img => {
      if (img.position) {
        occupiedPositions.add(`${img.position.x},${img.position.y}`);
      }
    });

    // Only count non-failed placeholders as occupied (failed ones can be replaced)
    loadingPlaceholders.forEach(placeholder => {
      if (!placeholder.failed) {
        occupiedPositions.add(`${placeholder.position.x},${placeholder.position.y}`);
      }
    });

    // Also include positions claimed by concurrent in-flight requests that haven't
    // committed to state yet — prevents multiple rapid fires getting the same slot.
    pendingPositionsRef.current.forEach(pos => occupiedPositions.add(pos));

    // Try positions in order
    for (let index = 0; index < 25; index++) {
      const position = generatePositionByIndex(index);
      const posKey = `${position.x},${position.y}`;

      if (!occupiedPositions.has(posKey)) {
        // Reserve this slot immediately so the next concurrent call skips it
        pendingPositionsRef.current.add(posKey);
        return position;
      }
    }

    // If all positions are occupied, return center position (fallback)
    return { x: 0, y: 0 };
  };

  // Dynamic concurrent generation limit: admin=10, dev tier=6, free=3
  const MAX_CONCURRENT_GENERATIONS = user?.email === 'dirtysecretai@gmail.com' ? 10 : hasPromptStudioDev ? 6 : 3;

  const handleGenerate = async (panelId: number) => {
    const panel = scannerPanels.find(p => p.id === panelId);
    if (!panel) return;
    const scanner = panel.scanner;

    // Fullscreen: Single image preview mode
    if (canvasMode === 'fullscreen') {
      // Count only active (non-failed) loading placeholders
      const activeLoadingCount = loadingPlaceholders.filter(p => !p.failed).length;
      if (activeLoadingCount >= 1) {
        alert('Wait for current generation to complete.');
        return;
      }
      // Clear existing images in Fullscreen (single image mode)
      setSessionImages([]);
      setFullscreenImageIndex(0);
    } else {
      // Canvas: Multi-image mode
      // Count only active (non-failed) loading placeholders
      const activeLoadingCount = loadingPlaceholders.filter(p => !p.failed).length;
      if (activeLoadingCount >= MAX_CONCURRENT_GENERATIONS) {
        alert(`Maximum ${MAX_CONCURRENT_GENERATIONS} images can be generated at once. Please wait for current generations to complete.`);
        return;
      }

      // Count total placeholders (including failed ones) for canvas limit
      if (sessionImages.length + loadingPlaceholders.length >= CANVAS_CONFIG.maxImages) {
        alert(`Canvas is full (${CANVAS_CONFIG.maxImages} images max). Start a new session.`);
        return;
      }
    }

    if (!scanner.prompt.trim()) {
      alert('Please enter a prompt');
      return;
    }

    // Check if model is in maintenance
    if (isModelInMaintenance(scanner.model)) {
      alert('This model is currently under maintenance. Please select a different model.');
      return;
    }

    setGeneratingPanels(prev => new Set(prev).add(panelId));

    // Declare outside try so the catch/finally blocks can reference them
    const isClusterPanel = scanner.model === 'nano-banana-cluster' && canvasMode !== 'fullscreen';
    const position = canvasMode === 'fullscreen' ? { x: 0, y: 0 } : getNextPosition();
    const position2 = isClusterPanel ? getNextPosition() : null;
    const placeholderId = `placeholder-${Date.now()}-${panelId}`;
    const placeholderId2 = isClusterPanel ? `placeholder-${Date.now()}-${panelId}-2` : null;

    try {
      // Use shared reference images (only enabled ones)
      const referenceUrls = getEnabledReferenceUrls();

      // Add placeholder(s). For nano-banana-cluster add 2. Release pending positions inside updater.
      setLoadingPlaceholders(prev => {
        pendingPositionsRef.current.delete(`${position.x},${position.y}`);
        if (position2) pendingPositionsRef.current.delete(`${position2.x},${position2.y}`);
        const filtered = prev.filter(p => {
          if (p.slotId === `panel-${panelId}` && p.failed) return false;
          if (p.failed && p.position.x === position.x && p.position.y === position.y) return false;
          if (position2 && p.failed && p.position.x === position2.x && p.position.y === position2.y) return false;
          return true;
        });
        const newPlaceholders: LoadingPlaceholder[] = [
          { id: placeholderId, slotId: `panel-${panelId}`, position },
          ...(isClusterPanel && position2 && placeholderId2
            ? [{ id: placeholderId2, slotId: `panel-${panelId}`, position: position2 }]
            : []),
        ];
        return [...filtered, ...newPlaceholders];
      });

      const requestBody: any = {
        userId: user.id,
        prompt: scanner.prompt,
        model: scanner.model,
        quality: scanner.quality,
        aspectRatio: scanner.aspectRatio,
        referenceImages: referenceUrls,
        // Store position/slotId so the DB can restore the placeholder correctly on refresh
        position,
        slotId: `panel-${panelId}`,
      };

      if (scanner.celebrityName && scanner.celebrityName.trim()) {
        requestBody.celebrityName = scanner.celebrityName;
      }
      if (scanner.enhancement && scanner.enhancement.trim()) {
        requestBody.enhancement = scanner.enhancement;
      }

      const res = await fetch('/api/prompting-studio/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
      });

      // Safely parse JSON response
      let data;
      try {
        data = await res.json();
      } catch (jsonError) {
        console.error('JSON parse error:', jsonError);
        // Mark placeholder as failed (turns red)
        setLoadingPlaceholders(prev => prev.map(p =>
          p.id === placeholderId ? { ...p, failed: true } : p
        ));
        alert('Generation failed - invalid response from server');
        return;
      }

      if (data.success && data.imageUrl) {
        if (data.jobId) {
          knownJobIdsRef.current.add(data.jobId);
          resolvedJobIdsRef.current.add(data.jobId);
        }

        const baseProps = {
          slotId: `panel-${panelId}`,
          celebrityName: scanner.celebrityName || '',
          enhancement: scanner.enhancement || '',
          prompt: scanner.prompt,
          model: scanner.model,
          quality: scanner.quality,
          aspectRatio: scanner.aspectRatio,
          referenceImageUrls: referenceUrls,
          timestamp: Date.now(),
          isDiluted: false,
          isGem: false,
        };

        const newImages: SessionImage[] = [
          { ...baseProps, id: `img-${Date.now()}-p${panelId}`, imageUrl: data.imageUrl, position },
        ];

        // Second image for nano-banana-cluster
        if (isClusterPanel && data.images?.length > 1 && position2) {
          newImages.push({ ...baseProps, id: `img-${Date.now()}-p${panelId}-2`, imageUrl: data.images[1].url, position: position2 });
        }

        // Remove placeholders: primary + job-id alias. Second placeholder removed only if image arrived.
        setLoadingPlaceholders(prev => {
          let updated = prev.filter(p => p.id !== placeholderId && p.id !== `job-${data.jobId}`);
          if (isClusterPanel && data.images?.length > 1 && placeholderId2) {
            updated = updated.filter(p => p.id !== placeholderId2);
          } else if (isClusterPanel && placeholderId2) {
            // Second image didn't arrive — mark its placeholder red
            updated = updated.map(p => p.id === placeholderId2 ? { ...p, failed: true } : p);
          }
          return updated;
        });

        setSessionImages(prev => [...prev, ...newImages]);

        const ticketRes = await fetch(`/api/user/tickets?userId=${user.id}`);
        const ticketData = await ticketRes.json();
        if (ticketData.success) setTicketBalance(ticketData.balance);
      } else {
        if (data.jobId) {
          knownJobIdsRef.current.add(data.jobId);
          resolvedJobIdsRef.current.add(data.jobId);
        }

        setLoadingPlaceholders(prev => prev.map(p => {
          if (p.id === placeholderId || p.id === `job-${data.jobId}`) return { ...p, failed: true };
          if (isClusterPanel && p.id === placeholderId2) return { ...p, failed: true };
          return p;
        }));

        if (data.isSensitiveContent) {
          alert('Sensitive Content Detected\n\nYour request was blocked by content filters. Your tickets have been refunded.');
        } else {
          alert(data.error || 'Generation failed');
        }
      }
    } catch (err) {
      console.error('Generation error:', err);
      pendingPositionsRef.current.delete(`${position.x},${position.y}`);
      if (position2) pendingPositionsRef.current.delete(`${position2.x},${position2.y}`);
      setLoadingPlaceholders(prev => prev.map(p => {
        if (p.id === placeholderId) return { ...p, failed: true };
        if (isClusterPanel && p.id === placeholderId2) return { ...p, failed: true };
        return p;
      }));
    } finally {
      setGeneratingPanels(prev => {
        const next = new Set(prev);
        next.delete(panelId);
        return next;
      });
    }
  };

  const handleTest = async (panelId: number) => {
    const panel = scannerPanels.find(p => p.id === panelId);
    if (!panel) return;
    const scanner = panel.scanner;

    if (!scanner.prompt.trim()) {
      alert('Please enter a prompt');
      return;
    }

    try {
      // Use shared reference images (only enabled ones)
      const referenceUrls = getEnabledReferenceUrls();

      const res = await fetch('/api/prompting-studio/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          celebrityName: scanner.celebrityName || '',
          enhancement: scanner.enhancement || '',
          prompt: scanner.prompt,
          model: scanner.model,
          quality: scanner.quality,
          aspectRatio: scanner.aspectRatio,
          referenceImages: referenceUrls,
        })
      });

      const data = await res.json();

      if (data.success && data.imageUrl) {
        window.open(data.imageUrl, '_blank');
      } else {
        alert(data.error || 'Test generation failed');
      }
    } catch (err) {
      console.error('Test error:', err);
      alert('Failed to test generation');
    }
  };

  const handleGeneratePrompt = async (panelId: number) => {
    // Check cooldown for restricted models
    if (promptModel !== 'gemini-3-flash') {
      const lastUse = lastPromptGenTime[promptModel] || 0;
      const timeSince = (Date.now() - lastUse) / 1000;
      const cooldownSeconds = 10;

      if (timeSince < cooldownSeconds) {
        const remaining = Math.ceil(cooldownSeconds - timeSince);
        setPromptCooldown(remaining);
        alert(`Please wait ${remaining} seconds before using ${promptModel} again.`);
        return;
      }
    }

    const panel = scannerPanels.find(p => p.id === panelId);
    if (!panel) return;
    const scanner = panel.scanner;

    const celebrityName = scanner.celebrityName.trim() || 'a person';
    const enhancement = scanner.enhancement.trim() || 'photorealistic portrait';

    try {
      const res = await fetch('/api/prompting-studio/generate-single', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          celebrity: celebrityName,
          baseStyle: enhancement,
          model: scanner.model,
          promptModel: promptModel,
        })
      });

      const data = await res.json();

      if (data.success && data.prompt) {
        setScannerPanels(prev => prev.map(p =>
          p.id === panelId ? { ...p, scanner: { ...p.scanner, prompt: data.prompt } } : p
        ));

        // Update last use time for restricted models
        if (promptModel !== 'gemini-3-flash') {
          setLastPromptGenTime(prev => ({ ...prev, [promptModel]: Date.now() }));
        }
      } else {
        alert('Failed to generate prompt');
      }
    } catch (err) {
      console.error('Prompt generation error:', err);
      alert('Failed to generate prompt');
    }
  };

  // Studio Scanner handlers
  const handleStudioGeneratePrompt = async () => {
    // Check cooldown for restricted models
    if (promptModel !== 'gemini-3-flash') {
      const lastUse = lastPromptGenTime[promptModel] || 0;
      const timeSince = (Date.now() - lastUse) / 1000;
      const cooldownSeconds = 10;

      if (timeSince < cooldownSeconds) {
        const remaining = Math.ceil(cooldownSeconds - timeSince);
        setPromptCooldown(remaining);
        alert(`Please wait ${remaining} seconds before using ${promptModel} again.`);
        return;
      }
    }

    const combinedNames = studioScanner.names.filter(n => n.trim()).join(', ') || 'a person';
    const combinedEnhancements = studioScanner.enhancements.filter(e => e.trim()).join(', ') || 'photorealistic portrait';

    try {
      const res = await fetch('/api/prompting-studio/generate-single', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          celebrity: combinedNames,
          baseStyle: combinedEnhancements,
          model: studioScanner.model,
          promptModel: promptModel,
        })
      });

      const data = await res.json();

      if (data.success && data.prompt) {
        setStudioScanner(prev => ({ ...prev, prompt: data.prompt }));

        // Update last use time for restricted models
        if (promptModel !== 'gemini-3-flash') {
          setLastPromptGenTime(prev => ({ ...prev, [promptModel]: Date.now() }));
        }
      } else {
        alert('Failed to generate prompt');
      }
    } catch (err) {
      console.error('Prompt generation error:', err);
      alert('Failed to generate prompt');
    }
  };

  const handleStudioGenerate = async () => {
    // Count only active (non-failed) loading placeholders
    const activeLoadingCount = loadingPlaceholders.filter(p => !p.failed).length;
    if (activeLoadingCount >= MAX_CONCURRENT_GENERATIONS) {
      alert(`Maximum ${MAX_CONCURRENT_GENERATIONS} images can be generated at once. Please wait for current generations to complete.`);
      return;
    }

    if (sessionImages.length + loadingPlaceholders.length >= CANVAS_CONFIG.maxImages) {
      alert(`Canvas is full (${CANVAS_CONFIG.maxImages} images max). Start a new session.`);
      return;
    }

    if (!studioScanner.prompt.trim()) {
      alert('Please enter a prompt');
      return;
    }

    // Check if model is in maintenance
    if (isModelInMaintenance(studioScanner.model)) {
      alert('This model is currently under maintenance. Please select a different model.');
      return;
    }

    setIsStudioGenerating(true);

    // Declare outside try so the catch/finally blocks can reference them
    const isClusterStudio = studioScanner.model === 'nano-banana-cluster';
    const position = getNextPosition();
    const position2 = isClusterStudio ? getNextPosition() : null;
    const placeholderId = `placeholder-${Date.now()}-studio`;
    const placeholderId2 = isClusterStudio ? `placeholder-${Date.now()}-studio-2` : null;

    try {
      const referenceUrls = getEnabledReferenceUrls();

      // Add placeholder(s). For nano-banana-cluster add 2. Release pending positions inside updater.
      setLoadingPlaceholders(prev => {
        pendingPositionsRef.current.delete(`${position.x},${position.y}`);
        if (position2) pendingPositionsRef.current.delete(`${position2.x},${position2.y}`);
        const filtered = prev.filter(p => {
          if (p.failed && p.position.x === position.x && p.position.y === position.y) return false;
          if (position2 && p.failed && p.position.x === position2.x && p.position.y === position2.y) return false;
          return true;
        });
        const newPlaceholders: LoadingPlaceholder[] = [
          { id: placeholderId, slotId: 'studio-scanner', position },
          ...(isClusterStudio && position2 && placeholderId2
            ? [{ id: placeholderId2, slotId: 'studio-scanner', position: position2 }]
            : []),
        ];
        return [...filtered, ...newPlaceholders];
      });

      const combinedNames = studioScanner.names.filter(n => n.trim()).join(', ');
      const combinedEnhancements = studioScanner.enhancements.filter(e => e.trim()).join(', ');

      const requestBody: any = {
        userId: user.id,
        prompt: studioScanner.prompt,
        model: studioScanner.model,
        quality: studioScanner.quality,
        aspectRatio: studioScanner.aspectRatio,
        referenceImages: referenceUrls,
        // Sent so the server can record them in the GenerationQueue for refresh restore
        position,
        slotId: 'studio-scanner',
      };

      if (combinedNames) {
        requestBody.celebrityName = combinedNames;
      }
      if (combinedEnhancements) {
        requestBody.enhancement = combinedEnhancements;
      }

      const res = await fetch('/api/prompting-studio/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
      });

      // Safely parse JSON response
      let data;
      try {
        data = await res.json();
      } catch (jsonError) {
        console.error('JSON parse error:', jsonError);
        // Mark placeholder as failed (turns red)
        setLoadingPlaceholders(prev => prev.map(p =>
          p.id === placeholderId ? { ...p, failed: true } : p
        ));
        alert('Generation failed - invalid response from server');
        return;
      }

      if (data.success && data.imageUrl) {
        if (data.jobId) {
          knownJobIdsRef.current.add(data.jobId);
          resolvedJobIdsRef.current.add(data.jobId);
        }

        const baseProps = {
          slotId: 'studio-scanner',
          celebrityName: combinedNames || '',
          enhancement: combinedEnhancements || '',
          prompt: studioScanner.prompt,
          model: studioScanner.model,
          quality: studioScanner.quality,
          aspectRatio: studioScanner.aspectRatio,
          referenceImageUrls: referenceUrls,
          timestamp: Date.now(),
          isDiluted: false,
          isGem: false,
        };

        const newImages: SessionImage[] = [
          { ...baseProps, id: `img-${Date.now()}-studio`, imageUrl: data.imageUrl, position },
        ];

        // Second image for nano-banana-cluster
        if (isClusterStudio && data.images?.length > 1 && position2) {
          newImages.push({ ...baseProps, id: `img-${Date.now()}-studio-2`, imageUrl: data.images[1].url, position: position2 });
        }

        // Remove placeholders: primary + job-id alias. Second placeholder removed only if image arrived.
        setLoadingPlaceholders(prev => {
          let updated = prev.filter(p => p.id !== placeholderId && p.id !== `job-${data.jobId}`);
          if (isClusterStudio && data.images?.length > 1 && placeholderId2) {
            updated = updated.filter(p => p.id !== placeholderId2);
          } else if (isClusterStudio && placeholderId2) {
            updated = updated.map(p => p.id === placeholderId2 ? { ...p, failed: true } : p);
          }
          return updated;
        });

        setSessionImages(prev => [...prev, ...newImages]);

        const ticketRes = await fetch(`/api/user/tickets?userId=${user.id}`);
        const ticketData = await ticketRes.json();
        if (ticketData.success) setTicketBalance(ticketData.balance);
      } else {
        if (data.jobId) {
          knownJobIdsRef.current.add(data.jobId);
          resolvedJobIdsRef.current.add(data.jobId);
        }

        setLoadingPlaceholders(prev => prev.map(p => {
          if (p.id === placeholderId || p.id === `job-${data.jobId}`) return { ...p, failed: true };
          if (isClusterStudio && p.id === placeholderId2) return { ...p, failed: true };
          return p;
        }));

        if (data.isSensitiveContent) {
          alert('Sensitive Content Detected\n\nYour request was blocked by content filters. Your tickets have been refunded.');
        } else {
          alert(data.error || 'Generation failed');
        }
      }
    } catch (err) {
      console.error('Generation error:', err);
      pendingPositionsRef.current.delete(`${position.x},${position.y}`);
      if (position2) pendingPositionsRef.current.delete(`${position2.x},${position2.y}`);
      setLoadingPlaceholders(prev => prev.map(p => {
        if (p.id === placeholderId) return { ...p, failed: true };
        if (isClusterStudio && p.id === placeholderId2) return { ...p, failed: true };
        return p;
      }));
    } finally {
      setIsStudioGenerating(false);
    }
  };

  // Canvas interactions
  const handleMouseDown = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    // Don't start canvas drag if clicking on interactive elements or panels
    const isInteractive = target.closest('textarea, input, button, label, select, [contenteditable]');
    const isPanel = target.closest('.ref-panel-drag-handle, .prompt-panel-drag-handle, .drag-handle');
    const isScannerPanel = target.closest('[data-scanner-panel]');
    if (isInteractive || isPanel || isScannerPanel) return;

    if (target === canvasRef.current || target.closest('.canvas-content')) {
      setIsDragging(true);
      setDragStart({ x: e.clientX, y: e.clientY });
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging) {
      const deltaX = e.clientX - dragStart.x;
      const deltaY = e.clientY - dragStart.y;

      setCanvasOffset(prev => ({
        x: prev.x + deltaX,
        y: prev.y + deltaY
      }));

      setDragStart({ x: e.clientX, y: e.clientY });
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();

    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;

    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    const canvasPointX = (mouseX - canvasOffset.x) / canvasScale;
    const canvasPointY = (mouseY - canvasOffset.y) / canvasScale;

    const delta = e.deltaY * -0.001;
    const newScale = Math.min(Math.max(0.1, canvasScale + delta * canvasScale), 5);

    const newOffsetX = mouseX - canvasPointX * newScale;
    const newOffsetY = mouseY - canvasPointY * newScale;

    setCanvasScale(newScale);
    setCanvasOffset({ x: newOffsetX, y: newOffsetY });
  };

  // Mobile touch handlers
  const handleTouchStart = (e: React.TouchEvent) => {
    const target = e.target as HTMLElement;
    const isInteractive = target.closest('textarea, input, button, label, select, [contenteditable]');
    const isPanel = target.closest('.ref-panel-drag-handle, .prompt-panel-drag-handle, .drag-handle');
    const isScannerPanel = target.closest('[data-scanner-panel]');
    if (isInteractive || isPanel || isScannerPanel) return;

    e.preventDefault();

    if (e.touches.length === 1) {
      setTouchStart({ x: e.touches[0].clientX, y: e.touches[0].clientY });
      setIsDragging(true);
    } else if (e.touches.length === 2) {
      const touch1 = e.touches[0];
      const touch2 = e.touches[1];
      const distance = Math.hypot(
        touch2.clientX - touch1.clientX,
        touch2.clientY - touch1.clientY
      );
      setLastTouchDistance(distance);
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    e.preventDefault();

    if (e.touches.length === 1 && touchStart) {
      const deltaX = e.touches[0].clientX - touchStart.x;
      const deltaY = e.touches[0].clientY - touchStart.y;

      setCanvasOffset(prev => ({
        x: prev.x + deltaX,
        y: prev.y + deltaY
      }));

      setTouchStart({ x: e.touches[0].clientX, y: e.touches[0].clientY });
    } else if (e.touches.length === 2 && lastTouchDistance) {
      const touch1 = e.touches[0];
      const touch2 = e.touches[1];
      const distance = Math.hypot(
        touch2.clientX - touch1.clientX,
        touch2.clientY - touch1.clientY
      );

      const rect = canvasRef.current?.getBoundingClientRect();
      if (!rect) return;

      const midpointX = (touch1.clientX + touch2.clientX) / 2 - rect.left;
      const midpointY = (touch1.clientY + touch2.clientY) / 2 - rect.top;

      const canvasPointX = (midpointX - canvasOffset.x) / canvasScale;
      const canvasPointY = (midpointY - canvasOffset.y) / canvasScale;

      const delta = (distance - lastTouchDistance) * 0.005;
      const newScale = Math.min(Math.max(0.1, canvasScale + delta * canvasScale), 5);

      const newOffsetX = midpointX - canvasPointX * newScale;
      const newOffsetY = midpointY - canvasPointY * newScale;

      setCanvasScale(newScale);
      setCanvasOffset({ x: newOffsetX, y: newOffsetY });
      setLastTouchDistance(distance);
    }
  };

  const handleTouchEnd = () => {
    setTouchStart(null);
    setLastTouchDistance(null);
    setIsDragging(false);
  };

  const handleImageClick = (idx: number, e: React.MouseEvent) => {
    e.stopPropagation();
    openCarousel(idx);
  };

  const removeImageFromCanvas = (imageId: string, e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent triggering the image click
    if (confirm('Remove this image from canvas?')) {
      setSessionImages(prev => prev.filter(img => img.id !== imageId));
    }
  };

  // Toggle image selection in select mode
  const toggleImageSelection = (imageId: string) => {
    setSelectedImageIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(imageId)) {
        newSet.delete(imageId);
      } else {
        newSet.add(imageId);
      }
      return newSet;
    });
  };

  // Remove all selected images
  const removeSelectedImages = () => {
    if (selectedImageIds.size === 0) return;

    if (confirm(`Remove ${selectedImageIds.size} selected image${selectedImageIds.size > 1 ? 's' : ''} from canvas?`)) {
      // Track the URLs of deleted images so syncJobs doesn't re-add them on refresh.
      sessionImages
        .filter(img => selectedImageIds.has(img.id) && img.imageUrl)
        .forEach(img => deletedImageUrlsRef.current.add(img.imageUrl));

      // Persist deleted URLs immediately (don't wait for the 1s auto-save debounce).
      try {
        const saved = localStorage.getItem('canvas-scanner-autosave');
        const data = saved ? JSON.parse(saved) : {};
        data.deletedImageUrls = Array.from(deletedImageUrlsRef.current);
        localStorage.setItem('canvas-scanner-autosave', JSON.stringify(data));
      } catch {}

      setSessionImages(prev => prev.filter(img => !selectedImageIds.has(img.id)));
      setSelectedImageIds(new Set());
      setIsSelectMode(false);
    }
  };

  // Select all images
  const selectAllImages = () => {
    setSelectedImageIds(new Set(sessionImages.map(img => img.id)));
  };

  // Deselect all images
  const deselectAllImages = () => {
    setSelectedImageIds(new Set());
  };

  const recenterCanvas = () => {
    if (canvasRef.current) {
      const rect = canvasRef.current.getBoundingClientRect();
      setCanvasOffset({ x: rect.width / 2, y: rect.height / 2 });
      setCanvasScale(0.24); // Zoom out to default view
    }
  };

  const createNewSession = () => {
    if (sessionImages.length > 0 && !confirm('Start new session? Current images and reference images will be cleared.')) {
      return;
    }
    setSessionImages([]);
    setLoadingPlaceholders([]);
    setSharedReferenceImages([]); // Clear shared reference images
    recenterCanvas();
  };

  // Save/Load sessions
  const saveCurrentSession = async () => {
    if (!sessionSaveName.trim()) {
      alert('Enter a name for this session');
      return;
    }

    if (sessionImages.length === 0) {
      alert('No images to save');
      return;
    }

    if (savedSessions.length >= 50) {
      alert('Maximum 50 saved sessions allowed. Delete one first.');
      return;
    }

    try {
      // Prepare scanner panels data (exclude File objects, keep URLs only)
      const scannerPanelsData = scannerPanels.map(panel => ({
        id: panel.id,
        position: panel.position,
        scale: panel.scale,
        scanner: {
          model: panel.scanner.model,
          celebrityName: panel.scanner.celebrityName,
          enhancement: panel.scanner.enhancement,
          prompt: panel.scanner.prompt,
          quality: panel.scanner.quality,
          aspectRatio: panel.scanner.aspectRatio,
          referenceImageUrls: panel.scanner.referenceImageUrls || [],
        },
      }));

      const res = await fetch('/api/prompting-studio/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user?.id,
          name: sessionSaveName,
          images: sessionImages,
          // Additional session state
          sharedReferenceImages: sharedReferenceImages,
          savedPrompts: savedPrompts,
          scannerPanels: scannerPanelsData,
          studioScanner: studioScanner,
          canvasMode: canvasMode,
          promptModel: promptModel,
          refPanelPosition: refPanelPosition,
          promptPanelPosition: promptPanelPosition,
          studioPanelPosition: studioPanelPosition,
        }),
      });

      const data = await res.json();
      if (data.success) {
        setSavedSessions([...savedSessions, data.session]);
        setShowSaveModal(false);
        setSessionSaveName('');
        alert('Session saved!');
      } else {
        alert('Failed to save session');
      }
    } catch (err) {
      alert('Error saving session');
    }
  };

  const loadSession = async (sessionId: number) => {
    try {
      const res = await fetch(`/api/prompting-studio/sessions/${sessionId}`);
      const data = await res.json();

      if (data.success) {
        const session = data.session;
        const imagesToLoad = session.images.slice(0, CANVAS_CONFIG.maxImages);
        const skippedCount = session.images.length - imagesToLoad.length;

        const loadedImages = imagesToLoad.map((img: any, idx: number) => {
          let processedImg = { ...img };

          processedImg.id = `img-${Date.now()}-${idx}`;

          // Recalculate positions based on CURRENT mode (canvas spiral or studio zigzag)
          processedImg.position = generatePositionByIndex(idx);

          return processedImg;
        });

        setSessionImages(loadedImages);

        // Restore shared reference images
        if (session.sharedReferenceImages && Array.isArray(session.sharedReferenceImages)) {
          setSharedReferenceImages(session.sharedReferenceImages);
        }

        // Restore saved prompts
        if (session.savedPrompts && Array.isArray(session.savedPrompts)) {
          setSavedPrompts(session.savedPrompts);
        }

        // Restore scanner panels
        if (session.scannerPanels && Array.isArray(session.scannerPanels)) {
          const restoredPanels = session.scannerPanels.map((panel: any) => ({
            ...panel,
            scanner: {
              ...panel.scanner,
              referenceImages: [], // Files can't be restored, only URLs
              referenceImageUrls: panel.scanner.referenceImageUrls || [],
            },
          }));
          setScannerPanels(restoredPanels);
          // Update next scanner ID to avoid conflicts
          if (restoredPanels.length > 0) {
            const maxId = Math.max(...restoredPanels.map((p: any) => p.id));
            setNextScannerId(maxId + 1);
          }
        }

        // Restore studio scanner state
        if (session.studioScanner) {
          setStudioScanner(session.studioScanner);
        }

        // Restore canvas mode
        if (session.canvasMode) {
          setCanvasMode(session.canvasMode);
        }

        // Restore prompt model
        if (session.promptModel) {
          setPromptModel(session.promptModel);
        }

        // Restore panel positions
        if (session.refPanelPosition) {
          setRefPanelPosition(session.refPanelPosition);
        }
        if (session.promptPanelPosition) {
          setPromptPanelPosition(session.promptPanelPosition);
        }
        if (session.studioPanelPosition) {
          setStudioPanelPosition(session.studioPanelPosition);
        }

        setShowLoadModal(false);
        recenterCanvas();
        // Set to default zoomed-out view (same as initial load)
        setCanvasScale(0.24);

        if (skippedCount > 0) {
          alert(`Loaded ${loadedImages.length} images.\n\n${skippedCount} images were skipped (max is ${CANVAS_CONFIG.maxImages}).`);
        } else {
          alert(`Session loaded successfully!\n${loadedImages.length} images restored.`);
        }
      } else {
        alert('Failed to load session');
      }
    } catch (err) {
      alert('Error loading session');
    }
  };

  const deleteSession = async (sessionId: number) => {
    if (!confirm('Delete this saved session?')) return;

    try {
      const res = await fetch(`/api/prompting-studio/sessions/${sessionId}`, {
        method: 'DELETE',
      });

      const data = await res.json();
      if (data.success) {
        setSavedSessions(savedSessions.filter(s => s.id !== sessionId));
        alert('Session deleted!');
      } else {
        alert('Failed to delete session');
      }
    } catch (err) {
      alert('Error deleting session');
    }
  };

  const startRenameSession = (sessionId: number, currentName: string) => {
    setRenamingSessionId(sessionId);
    setRenameSessionName(currentName);
  };

  const cancelRenameSession = () => {
    setRenamingSessionId(null);
    setRenameSessionName('');
  };

  const renameSession = async (sessionId: number) => {
    if (!renameSessionName.trim()) {
      alert('Session name cannot be empty');
      return;
    }

    try {
      const res = await fetch(`/api/prompting-studio/sessions/${sessionId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: renameSessionName.trim() }),
      });

      const data = await res.json();
      if (data.success) {
        setSavedSessions(savedSessions.map(s =>
          s.id === sessionId ? { ...s, name: renameSessionName.trim() } : s
        ));
        setRenamingSessionId(null);
        setRenameSessionName('');
        alert('Session renamed!');
      } else {
        alert('Failed to rename session');
      }
    } catch (err) {
      alert('Error renaming session');
    }
  };

  const openCarousel = (index: number) => {
    setCarouselIndex(index);
    setCarouselOpen(true);
  };

  const nextImage = () => {
    setCarouselIndex((prev) => (prev + 1) % sessionImages.length);
  };

  const prevImage = () => {
    setCarouselIndex((prev) => (prev - 1 + sessionImages.length) % sessionImages.length);
  };

  const copyPrompt = async () => {
    const currentImage = sessionImages[carouselIndex];
    if (currentImage) {
      try {
        await navigator.clipboard.writeText(currentImage.prompt);
        alert('Prompt copied!');
      } catch (err) {
        // Mobile fallback
        try {
          const textArea = document.createElement('textarea');
          textArea.value = currentImage.prompt;
          textArea.style.position = 'fixed';
          textArea.style.left = '-999999px';
          document.body.appendChild(textArea);
          textArea.focus();
          textArea.select();
          const successful = document.execCommand('copy');
          document.body.removeChild(textArea);
          if (successful) {
            alert('Prompt copied!');
          } else {
            alert('Copy failed. Please try again or copy manually.');
          }
        } catch (fallbackErr) {
          alert('Copy failed. Please try again or copy manually.');
        }
      }
    }
  };

  const downloadImage = async () => {
    const currentImage = sessionImages[carouselIndex];
    if (!currentImage) return;

    try {
      const response = await fetch(currentImage.imageUrl);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `generated-${Date.now()}.png`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      console.error('Download error:', err);
      window.open(currentImage.imageUrl, '_blank');
    }
  };

  const rescanToStudioScanner = () => {
    const currentImage = sessionImages[carouselIndex];
    if (!currentImage) return;

    // Populate studio scanner with image data
    setStudioScanner(prev => ({
      ...prev,
      names: currentImage.celebrityName ? [currentImage.celebrityName, '', ''] : ['', '', ''],
      enhancements: currentImage.enhancement ? [currentImage.enhancement, '', ''] : ['', '', ''],
      prompt: currentImage.prompt || '',
      model: currentImage.model || 'nano-banana-pro',
      quality: (currentImage.quality as '2k' | '4k') || '2k',
      aspectRatio: (currentImage.aspectRatio as '1:1' | '4:5' | '9:16' | '16:9') || '1:1',
    }));

    // REPLACE shared reference images with ONLY the active references from this scan
    if (currentImage.referenceImageUrls && currentImage.referenceImageUrls.length > 0) {
      const newRefs: SharedReferenceImage[] = currentImage.referenceImageUrls.map((url, idx) => ({
        id: `ref-rescan-${Date.now()}-${idx}`,
        url,
        enabled: true,
        filename: `Rescan ref ${idx + 1}`,
      }));
      setSharedReferenceImages(newRefs);
    } else {
      setSharedReferenceImages([]);
    }

    setCarouselOpen(false);
    const refCount = currentImage.referenceImageUrls?.length || 0;
    alert(`Loaded into Studio Scanner!${refCount > 0 ? ` (${refCount} reference image${refCount > 1 ? 's' : ''} loaded to Reference Panel)` : ' (Reference Panel cleared)'}`);
  };

  const rescanToPanel = (panelId: number) => {
    const currentImage = sessionImages[carouselIndex];
    if (!currentImage) return;

    setScannerPanels(prev => prev.map(p =>
      p.id === panelId
        ? {
            ...p,
            scanner: {
              ...p.scanner,
              celebrityName: currentImage.celebrityName || '',
              enhancement: currentImage.enhancement || '',
              prompt: currentImage.prompt || '',
              model: currentImage.model || 'nano-banana-pro',
              quality: (currentImage.quality as '2k' | '4k') || '2k',
              aspectRatio: (currentImage.aspectRatio as '1:1' | '4:5' | '9:16' | '16:9') || '1:1',
              referenceImages: [],
              referenceImageUrls: [],
            }
          }
        : p
    ));

    // REPLACE shared reference images with ONLY the active references from this scan
    if (currentImage.referenceImageUrls && currentImage.referenceImageUrls.length > 0) {
      const newRefs: SharedReferenceImage[] = currentImage.referenceImageUrls.map((url, idx) => ({
        id: `ref-rescan-${Date.now()}-${idx}`,
        url,
        enabled: true, // All rescanned references are enabled
        filename: `Rescan ref ${idx + 1}`,
      }));
      // REPLACE (not add) - set shared references to only these rescanned images
      setSharedReferenceImages(newRefs);
    } else {
      // If no reference images, clear the reference panel
      setSharedReferenceImages([]);
    }

    setShowRescanModal(false);
    const refCount = currentImage.referenceImageUrls?.length || 0;
    alert(`Loaded into Scanner ${panelId}!${refCount > 0 ? ` (${refCount} reference image${refCount > 1 ? 's' : ''} loaded to Reference Panel)` : ' (Reference Panel cleared)'}`);
  };

  const markAsDiluted = async () => {
    const currentImage = sessionImages[carouselIndex];
    if (!currentImage) return;

    const newDilutedStatus = !currentImage.isDiluted;

    setSessionImages(prev => prev.map(img =>
      img.id === currentImage.id ? { ...img, isDiluted: newDilutedStatus } : img
    ));

    await fetch('/api/training/mark-diluted', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt: currentImage.prompt,
        imageUrl: currentImage.imageUrl,
        isDiluted: newDilutedStatus,
      }),
    });

    alert(newDilutedStatus ? 'Marked as diluted' : 'Unmarked as diluted');
  };

  const markAsGem = async () => {
    const currentImage = sessionImages[carouselIndex];
    if (!currentImage) return;

    const newGemStatus = !currentImage.isGem;

    setSessionImages(prev => prev.map(img =>
      img.id === currentImage.id ? { ...img, isGem: newGemStatus } : img
    ));

    await fetch('/api/training/mark-gem', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt: currentImage.prompt,
        imageUrl: currentImage.imageUrl,
        isGem: newGemStatus,
      }),
    });

    alert(newGemStatus ? 'Marked as gem!' : 'Unmarked as gem');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#050810] flex items-center justify-center">
        <div className="text-cyan-400 text-xl">Loading...</div>
      </div>
    );
  }

  const currentImage = sessionImages[carouselIndex];

  return (
    <div className="fixed inset-0 bg-[#050810] text-white flex flex-col overflow-hidden">
      <div className="fixed inset-0 bg-[linear-gradient(rgba(0,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(0,255,255,0.02)_1px,transparent_1px)] bg-[size:40px_40px] pointer-events-none" />

      {/* Show maintenance if global maintenance or scanner-specific maintenance */}
      {(adminState.isMaintenanceMode || adminState.canvasScannerMaintenance) && (
        <div className="relative z-10 max-w-4xl mx-auto p-6">
          <div className="mb-4">
            <a href="/dashboard">
              <Button className="bg-slate-800 hover:bg-slate-700 border border-slate-600 text-slate-300">
                <ChevronLeft size={16} className="mr-1" />
                Back to Dashboard
              </Button>
            </a>
          </div>
          <MaintenanceIndicator label={adminState.isMaintenanceMode ? "AI Design Studio" : "Canvas Scanner"} />
        </div>
      )}

      {!adminState.isMaintenanceMode && !adminState.canvasScannerMaintenance && (
        <>
          {/* Header */}
      <div className="relative z-10 flex items-center justify-between px-4 py-2 bg-slate-900/50 backdrop-blur-sm border-b border-cyan-500/30">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <FlaskRound className="text-cyan-400" size={20} />
            <h1 className="text-lg font-black text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-fuchsia-500">
              CANVAS SCANNER
            </h1>
          </div>

          {user && (
            <div className="flex items-center gap-2 px-3 py-1 bg-slate-800/50 rounded-lg border border-slate-700">
              <div className="w-6 h-6 rounded-full bg-gradient-to-r from-cyan-400 to-fuchsia-500 flex items-center justify-center text-xs font-bold text-white">
                {user.email?.[0]?.toUpperCase() || 'D'}
              </div>
              <span className="text-sm text-slate-300">{user.email}</span>
              {ticketBalance !== null && (
                <span className="text-sm font-bold text-yellow-400 ml-2">
                  {ticketBalance} tickets
                </span>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          <Button
            onClick={createNewSession}
            className="bg-purple-600 hover:bg-purple-500 h-8 text-xs"
          >
            <Plus className="mr-1" size={14} />
            New Session
          </Button>
          <Button
            onClick={() => setShowSaveModal(true)}
            disabled={sessionImages.length === 0}
            className="bg-green-600 hover:bg-green-500 h-8 text-xs disabled:opacity-50"
          >
            Save
          </Button>
          <Button
            onClick={() => setShowLoadModal(true)}
            className="bg-blue-600 hover:bg-blue-500 h-8 text-xs"
          >
            Load ({savedSessions.length}/50)
          </Button>
          <Button
            onClick={() => router.push('/dashboard')}
            className="bg-slate-700 hover:bg-slate-600 h-8 text-xs"
          >
            Dashboard
          </Button>
          <Button
            onClick={() => setShowLogoutConfirm(true)}
            className="bg-red-600 hover:bg-red-500 h-8 text-xs"
          >
            Logout
          </Button>
        </div>
      </div>

      {/* Canvas */}
      <div className="relative flex-1 overflow-hidden">
        <div
          ref={canvasRef}
          className="absolute inset-0 cursor-grab active:cursor-grabbing"
          style={{ touchAction: 'none' }}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onWheel={handleWheel}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          <div
            className="canvas-content absolute"
            style={{
              width: `${CANVAS_CONFIG.canvasSize}px`,
              height: `${CANVAS_CONFIG.canvasSize}px`,
              left: `${-CANVAS_CONFIG.canvasSize / 2}px`,
              top: `${-CANVAS_CONFIG.canvasSize / 2}px`,
              transform: `translate(${canvasOffset.x}px, ${canvasOffset.y}px) scale(${canvasScale})`,
              transformOrigin: 'center center',
              transition: isDragging ? 'none' : 'transform 0.1s ease-out',
            }}
          >
            {/* Canvas boundary */}
            <div
              className="absolute pointer-events-none"
              style={{
                left: '200px',
                top: canvasMode === 'studio' ? '-800px' : '200px',
                right: '200px',
                bottom: canvasMode === 'studio' ? '1350px' : '200px',
                border: '3px dashed rgba(6, 182, 212, 0.5)',
                borderRadius: '24px',
                boxShadow: 'inset 0 0 80px rgba(6, 182, 212, 0.05)',
              }}
            >
              <div className="absolute -top-1 -left-1 w-8 h-8 border-t-4 border-l-4 border-cyan-500 rounded-tl-lg" />
              <div className="absolute -top-1 -right-1 w-8 h-8 border-t-4 border-r-4 border-cyan-500 rounded-tr-lg" />
              <div className="absolute -bottom-1 -left-1 w-8 h-8 border-b-4 border-l-4 border-cyan-500 rounded-bl-lg" />
              <div className="absolute -bottom-1 -right-1 w-8 h-8 border-b-4 border-r-4 border-cyan-500 rounded-br-lg" />
            </div>

            {/* Reference Image Loader Panel - draggable like scanners */}
            <div
              className={`absolute bg-slate-900/95 backdrop-blur-sm border-2 rounded-xl shadow-2xl transition-shadow flex flex-col ${
                isRefPanelDragging ? 'border-fuchsia-400 shadow-fuchsia-500/30' : 'border-fuchsia-500/50'
              }`}
              style={{
                left: `calc(50% + ${refPanelPosition.x + (canvasMode === 'expanded' ? -583.5 : 0)}px)`,
                top: `calc(50% + ${refPanelPosition.y}px)`,
                transform: `translate(-50%, -50%)`,
                transformOrigin: 'center center',
                width: canvasMode === 'expanded' ? '2334px' : '1167px',
                height: '3750px',
                zIndex: isRefPanelDragging ? 100 : 25,
              }}
              onClick={(e) => e.stopPropagation()}
              onMouseDown={handleRefPanelMouseDown}
              onTouchStart={handleRefPanelTouchStart}
              onTouchMove={handleRefPanelTouchMove}
              onTouchEnd={handleRefPanelTouchEnd}
            >
              {/* Header - Drag Handle */}
              <div className="ref-panel-drag-handle flex items-center justify-between px-12 py-8 bg-gradient-to-r from-fuchsia-900/80 to-purple-900/80 border-b border-fuchsia-500/30 rounded-t-xl cursor-move touch-none">
                <div className="flex items-center gap-8">
                  <Move size={56} className="text-fuchsia-400" />
                  <span className="text-5xl font-bold text-fuchsia-400">REFERENCES</span>
                </div>
                <span className="text-4xl text-fuchsia-300/70">
                  {sharedReferenceImages.filter(r => r.enabled).length}/{MAX_ACTIVE_REFERENCES} active
                </span>
              </div>

              {/* Upload and Clear Buttons */}
              <div className="p-8 border-b-4 border-fuchsia-500/20 space-y-6">
                <label className={`flex items-center justify-center gap-8 w-full px-12 py-6 rounded-lg transition-colors ${
                  sharedReferenceImages.length >= MAX_REFERENCE_IMAGES
                    ? 'bg-slate-700 cursor-default opacity-50'
                    : 'bg-fuchsia-600 hover:bg-fuchsia-500 cursor-pointer'
                }`}>
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    className="hidden"
                    onChange={handleReferenceImageUpload}
                    disabled={isUploadingReference || sharedReferenceImages.length >= MAX_REFERENCE_IMAGES}
                  />
                  {isUploadingReference ? (
                    <>
                      <div className="animate-spin rounded-full h-16 w-16 border-8 border-white border-t-transparent" />
                      <span className="text-5xl font-bold text-white">Uploading...</span>
                    </>
                  ) : sharedReferenceImages.length >= MAX_REFERENCE_IMAGES ? (
                    <span className="text-5xl font-bold text-slate-400">Max {MAX_REFERENCE_IMAGES} images</span>
                  ) : (
                    <>
                      <Upload size={56} className="text-white" />
                      <span className="text-5xl font-bold text-white">Add ({sharedReferenceImages.length}/{MAX_REFERENCE_IMAGES})</span>
                    </>
                  )}
                </label>

                {/* Load Saved Custom Model */}
                <SavedModelPicker onSelect={handleLoadSavedModel} large />

                {/* Clear All Button */}
                {sharedReferenceImages.length > 0 && (
                  <button
                    onClick={() => {
                      if (confirm(`Clear all ${sharedReferenceImages.length} reference image${sharedReferenceImages.length > 1 ? 's' : ''}?`)) {
                        setSharedReferenceImages([]);
                      }
                    }}
                    className="flex items-center justify-center gap-8 w-full px-12 py-6 rounded-lg bg-red-600 hover:bg-red-500 transition-colors"
                  >
                    <Trash2 size={56} className="text-white" />
                    <span className="text-5xl font-bold text-white">Clear All ({sharedReferenceImages.length})</span>
                  </button>
                )}
              </div>

              {/* Reference Images Grid - 2 columns, now 25 slots with scroll */}
              <div
                className="p-8 flex-1 overflow-y-auto"
                onWheel={(e) => e.stopPropagation()}
                onTouchMove={(e) => e.stopPropagation()}
              >
                {/* Hidden file input for empty slot uploads */}
                <input
                  ref={refImageInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={handleReferenceImageUpload}
                  disabled={isUploadingReference || sharedReferenceImages.length >= MAX_REFERENCE_IMAGES}
                />

                <div className={`grid ${canvasMode === 'expanded' ? 'grid-cols-4' : 'grid-cols-2'} gap-6`}>
                  {Array.from({ length: canvasMode === 'expanded' ? 50 : 25 }, (_, index) => {
                    const ref = sharedReferenceImages[index];
                    const enabledCount = sharedReferenceImages.filter(r => r.enabled).length;

                    if (ref) {
                      const canEnable = ref.enabled || enabledCount < MAX_ACTIVE_REFERENCES;
                      return (
                        <div
                          key={ref.id}
                          className={`relative rounded-lg overflow-hidden border-8 transition-all ${
                            ref.enabled
                              ? 'border-fuchsia-500 shadow-md shadow-fuchsia-500/20'
                              : 'border-slate-700 opacity-60'
                          }`}
                        >
                          {/* Image Preview - Click to view full size */}
                          <div
                            className="relative w-full aspect-square bg-black flex items-center justify-center cursor-pointer hover:opacity-90 transition-opacity overflow-hidden"
                            onClick={() => setPreviewReferenceImage(ref)}
                          >
                            <img
                              src={ref.url}
                              alt={ref.filename}
                              className="w-full h-full object-cover"
                            />
                            {!ref.enabled && (
                              <div className="absolute inset-0 bg-black/50 flex items-center justify-center pointer-events-none">
                                <span className="text-4xl text-slate-400 font-bold">OFF</span>
                              </div>
                            )}
                          </div>
                          {/* Controls */}
                          <div className="flex items-center justify-between px-4 py-2 bg-slate-800">
                            <button
                              onClick={() => toggleReferenceImage(ref.id)}
                              disabled={!canEnable && !ref.enabled}
                              className={`flex items-center gap-2 px-6 py-2 rounded text-4xl font-bold transition-colors ${
                                ref.enabled
                                  ? 'bg-fuchsia-600 text-white'
                                  : canEnable
                                    ? 'bg-slate-700 text-slate-400 hover:bg-slate-600'
                                    : 'bg-slate-700 text-slate-600 cursor-not-allowed'
                              }`}
                              title={!canEnable && !ref.enabled ? `Max ${MAX_ACTIVE_REFERENCES} active` : ''}
                            >
                              {ref.enabled ? (
                                <><ToggleRight size={40} /> ON</>
                              ) : (
                                <><ToggleLeft size={40} /> OFF</>
                              )}
                            </button>
                            <button
                              onClick={() => removeReferenceImage(ref.id)}
                              className="p-2 hover:bg-red-500/20 rounded transition-colors"
                              title="Remove"
                            >
                              <Trash2 size={40} className="text-red-400" />
                            </button>
                          </div>
                        </div>
                      );
                    }

                    // Empty slot placeholder - Click to upload
                    return (
                      <div
                        key={`empty-${index}`}
                        className="relative rounded-lg overflow-hidden border-8 border-dashed border-slate-700/50 cursor-pointer hover:border-fuchsia-500/50 hover:bg-slate-800/50 transition-all"
                        onClick={() => {
                          if (!isUploadingReference && sharedReferenceImages.length < MAX_REFERENCE_IMAGES) {
                            refImageInputRef.current?.click();
                          }
                        }}
                      >
                        <div className="w-full aspect-square bg-slate-800/30 flex flex-col items-center justify-center">
                          <Upload size={64} className="text-slate-600 mb-4" />
                          <span className="text-4xl text-slate-600 font-bold">Click to Upload</span>
                        </div>
                        <div className="flex items-center justify-center px-4 py-2 bg-slate-800/30">
                          <span className="text-3xl text-slate-700">Slot {index + 1}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Footer Info */}
              <div className="px-2 py-1.5 border-t border-fuchsia-500/20 bg-slate-900/50 rounded-b-xl">
                <p className="text-[9px] text-slate-500 text-center">
                  {sharedReferenceImages.filter(r => r.enabled).length}/{MAX_ACTIVE_REFERENCES} active — applies to all scanners
                </p>
              </div>
            </div>

            {/* Prompt Boxes Panel - draggable, positioned to the right of the blue boundary */}
            <div
              className={`absolute bg-slate-900/95 backdrop-blur-sm border-2 rounded-xl shadow-2xl transition-shadow flex flex-col ${
                isPromptPanelDragging ? 'border-green-400 shadow-green-500/30' : 'border-green-500/50'
              }`}
              style={{
                left: `calc(50% + ${promptPanelPosition.x + (canvasMode === 'expanded' ? 583.5 : 0)}px)`,
                top: `calc(50% + ${promptPanelPosition.y}px)`,
                transform: `translate(-50%, -50%)`,
                transformOrigin: 'center center',
                width: canvasMode === 'expanded' ? '2334px' : '1167px',
                height: '3750px',
                zIndex: isPromptPanelDragging ? 100 : 25,
              }}
              onClick={(e) => e.stopPropagation()}
              onMouseDown={handlePromptPanelMouseDown}
              onTouchStart={handlePromptPanelTouchStart}
              onTouchMove={handlePromptPanelTouchMove}
              onTouchEnd={handlePromptPanelTouchEnd}
            >
              {/* Header - Drag Handle */}
              <div className="prompt-panel-drag-handle flex items-center justify-between px-12 py-8 bg-gradient-to-r from-green-900/80 to-emerald-900/80 border-b border-green-500/30 rounded-t-xl cursor-move touch-none">
                <div className="flex items-center gap-8">
                  <Move size={56} className="text-green-400" />
                  <span className="text-5xl font-bold text-green-400">PROMPT BOXES</span>
                </div>
                <span className="text-4xl text-green-300/70">
                  {savedPrompts.filter(p => p.trim()).length}/{savedPrompts.length} used
                </span>
              </div>

              {/* Prompt Boxes - 2 column grid (special layout in hybrid mode, all in other modes) */}
              <div
                className="p-8 flex-1 overflow-y-auto"
                onWheel={(e) => e.stopPropagation()}
                onTouchMove={(e) => e.stopPropagation()}
              >
                {canvasMode === 'hybrid' ? (
                  <>
                    {/* First 4 boxes in hybrid mode */}
                    <div className="grid grid-cols-2 gap-6 mb-8">
                      {savedPrompts.slice(0, 4).map((prompt, index) => (
                        <div key={index} className={`rounded-lg overflow-hidden border-8 transition-all flex flex-col ${
                          prompt.trim()
                            ? 'border-green-500 shadow-md shadow-green-500/20'
                            : 'border-slate-700'
                        }`}>
                          {/* Prompt Header */}
                          <div className="flex items-center justify-between px-6 py-2 bg-slate-700/50 border-b-4 border-slate-600">
                            <span className="text-4xl font-bold text-green-400">{index + 1}</span>
                            <button
                              onClick={() => copyPromptFromBox(index)}
                              disabled={!prompt.trim()}
                              className="flex items-center gap-2 px-6 py-2 bg-green-600 hover:bg-green-500 disabled:bg-slate-600 disabled:opacity-50 rounded text-3xl font-bold text-white transition-colors"
                            >
                              <Copy size={32} />
                              Copy
                            </button>
                          </div>
                          {/* Prompt Textarea */}
                          <textarea
                            value={prompt}
                            onChange={(e) => updateSavedPrompt(index, e.target.value)}
                            placeholder="Prompt..."
                            className="w-full px-6 py-4 bg-slate-800 text-4xl text-white placeholder-slate-500 focus:outline-none resize-none flex-1"
                            style={{ minHeight: '520px' }}
                          />
                        </div>
                      ))}
                    </div>
                  </>
                ) : (
                  <div className={`grid ${canvasMode === 'expanded' ? 'grid-cols-4' : 'grid-cols-2'} gap-6`}>
                    {savedPrompts.slice(0, canvasMode === 'expanded' ? 50 : 25).map((prompt, index) => (
                    <div key={index} className={`rounded-lg overflow-hidden border-8 transition-all flex flex-col ${
                      prompt.trim()
                        ? 'border-green-500 shadow-md shadow-green-500/20'
                        : 'border-slate-700'
                    }`}>
                      {/* Prompt Header */}
                      <div className="flex items-center justify-between px-6 py-2 bg-slate-700/50 border-b-4 border-slate-600">
                        <span className="text-4xl font-bold text-green-400">{index + 1}</span>
                        <button
                          onClick={() => copyPromptFromBox(index)}
                          disabled={!prompt.trim()}
                          className="flex items-center gap-2 px-6 py-2 bg-green-600 hover:bg-green-500 disabled:bg-slate-600 disabled:opacity-50 rounded text-3xl font-bold text-white transition-colors"
                        >
                          <Copy size={32} />
                          Copy
                        </button>
                      </div>
                      {/* Prompt Textarea */}
                      <textarea
                        value={prompt}
                        onChange={(e) => updateSavedPrompt(index, e.target.value)}
                        placeholder="Prompt..."
                        className="w-full px-6 py-4 bg-slate-800 text-4xl text-white placeholder-slate-500 focus:outline-none resize-none flex-1"
                        style={{ minHeight: '520px' }}
                      />
                    </div>
                  ))}
                  </div>
                )}

                {/* Integrated Scanner - Only in Hybrid Mode */}
                {canvasMode === 'hybrid' && (
                  <div className="mt-8 p-12 rounded-lg border-8 border-gradient-to-r from-cyan-500 to-purple-500 bg-gradient-to-b from-slate-900 to-slate-950 shadow-lg">
                    {/* Header */}
                    <div className="flex items-center justify-center gap-8 mb-12 pb-8 border-b-4 border-cyan-500/30">
                      <Sparkles className="text-cyan-400" size={64} />
                      <span className="text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-purple-400">QUICK SCANNER</span>
                    </div>

                    {/* Names Section */}
                    <div className="mb-8">
                      <label className="text-4xl font-bold text-cyan-300 mb-4 block flex items-center gap-4">
                        <span className="text-purple-400">👤</span> Names
                      </label>
                      <div className="grid grid-cols-3 gap-6">
                        {studioScanner.names.map((name, idx) => (
                          <input
                            key={`hybrid-name-${idx}`}
                            type="text"
                            value={name}
                            onChange={(e) => {
                              const newNames = [...studioScanner.names];
                              newNames[idx] = e.target.value;
                              setStudioScanner(prev => ({ ...prev, names: newNames }));
                            }}
                            placeholder={`Name ${idx + 1}`}
                            className="px-8 py-6 bg-slate-800/80 border-4 border-purple-500/30 rounded text-4xl text-cyan-100 placeholder-slate-500 focus:border-purple-400 focus:outline-none transition-colors"
                          />
                        ))}
                      </div>
                    </div>

                    {/* Enhancements Section */}
                    <div className="mb-8">
                      <label className="text-4xl font-bold text-cyan-300 mb-4 block flex items-center gap-4">
                        <span className="text-purple-400">✨</span> Enhancements
                      </label>
                      <div className="grid grid-cols-3 gap-6">
                        {studioScanner.enhancements.map((enhancement, idx) => (
                          <input
                            key={`hybrid-enhancement-${idx}`}
                            type="text"
                            value={enhancement}
                            onChange={(e) => {
                              const newEnhancements = [...studioScanner.enhancements];
                              newEnhancements[idx] = e.target.value;
                              setStudioScanner(prev => ({ ...prev, enhancements: newEnhancements }));
                            }}
                            placeholder={`Enhancement ${idx + 1}`}
                            className="px-8 py-6 bg-slate-800/80 border-4 border-purple-500/30 rounded text-4xl text-cyan-100 placeholder-slate-500 focus:border-purple-400 focus:outline-none transition-colors"
                          />
                        ))}
                      </div>
                    </div>

                    {/* AI Prompt Generation Button */}
                    <button
                      onClick={handleStudioGeneratePrompt}
                      disabled={(!studioScanner.names.some(n => n.trim()) && !studioScanner.enhancements.some(e => e.trim())) || promptCooldown > 0}
                      className="w-full mb-8 px-12 py-8 bg-gradient-to-r from-purple-600 to-fuchsia-600 hover:from-purple-500 hover:to-fuchsia-500 disabled:from-slate-700 disabled:to-slate-700 rounded text-4xl font-bold text-white transition-all disabled:opacity-50 flex items-center justify-center gap-8"
                      title={promptCooldown > 0 ? `Cooldown: ${promptCooldown}s` : 'Generate AI prompt from names & enhancements'}
                    >
                      <Wand2 size={56} />
                      {promptCooldown > 0 ? `AI Cooldown ${promptCooldown}s` : 'Generate AI Prompt'}
                    </button>

                    {/* Prompt Section */}
                    <div className="mb-8">
                      <label className="text-4xl font-bold text-cyan-300 mb-4 block flex items-center gap-4">
                        <span className="text-purple-400">📝</span> Prompt
                      </label>
                      <textarea
                        value={studioScanner.prompt}
                        onChange={(e) => setStudioScanner(prev => ({ ...prev, prompt: e.target.value }))}
                        placeholder="Enter your prompt or use AI generation..."
                        className="w-full px-8 py-8 bg-slate-800/80 border-4 border-purple-500/30 rounded text-4xl text-cyan-100 placeholder-slate-500 resize-none focus:border-purple-400 focus:outline-none transition-colors"
                        rows={3}
                      />
                    </div>

                    {/* Model & Settings */}
                    <div className="mb-8">
                      <label className="text-4xl font-bold text-cyan-300 mb-4 block flex items-center gap-4">
                        <span className="text-purple-400">🤖</span> Model & Settings
                      </label>
                      <div className="flex items-center gap-6 mb-6">
                        {/* Reference Upload Button */}
                        <div className="relative flex-shrink-0" title="Upload reference images">
                          <label className="w-32 h-32 border-8 border-dashed rounded flex items-center justify-center transition-colors bg-slate-800/80 border-fuchsia-500/50 cursor-pointer hover:border-fuchsia-400 hover:bg-slate-700">
                            <input
                              type="file"
                              accept="image/*"
                              multiple
                              className="hidden"
                              onChange={async (e) => {
                                const files = Array.from(e.target.files || []);
                                if (files.length > 0) {
                                  await handleScannerReferenceUpload(files);
                                  e.target.value = '';
                                }
                              }}
                            />
                            <Upload className="text-fuchsia-400" size={56} />
                          </label>
                        </div>

                        {/* Model Selector */}
                        <select
                          value={studioScanner.model}
                          onChange={(e) => {
                            setStudioScanner(prev => ({ ...prev, model: e.target.value }));
                            // Disable all reference images if switching to nano-banana-cluster
                            if (e.target.value === 'nano-banana-cluster') {
                              setSharedReferenceImages(prev => prev.map(ref => ({ ...ref, enabled: false })));
                            }
                          }}
                          className="flex-1 px-8 py-6 bg-slate-800/80 border-4 border-purple-500/30 rounded text-4xl text-cyan-100 font-medium focus:border-purple-400 focus:outline-none"
                        >
                          <option value="nano-banana-pro">⚡ NanoBanana Pro</option>
                          <option value="seedream-4.5">⚡ SeeDream 4.5</option>
                          <option value="gemini-3-pro-image">⚡ Pro Scanner v3</option>
                          <option value="gemini-2.5-flash-image">⚡ Flash Scanner v2.5</option>
                          <option value="flux-2">🌊 FLUX 2</option>
                          <option value="nano-banana-cluster">⚡ NanoBanana Cluster</option>
                        </select>
                      </div>

                      {/* Quality & Aspect Ratio */}
                      <div className="grid grid-cols-2 gap-6">
                        <select
                          value={studioScanner.quality}
                          onChange={(e) => setStudioScanner(prev => ({ ...prev, quality: e.target.value as '2k' | '4k' }))}
                          className="px-8 py-6 bg-slate-800/80 border-4 border-purple-500/30 rounded text-4xl text-cyan-100 font-medium focus:border-purple-400 focus:outline-none"
                        >
                          <option value="2k">📐 Quality: 2K</option>
                          <option value="4k">📐 Quality: 4K</option>
                        </select>
                        <select
                          value={studioScanner.aspectRatio}
                          onChange={(e) => setStudioScanner(prev => ({ ...prev, aspectRatio: e.target.value as any }))}
                          className="px-8 py-6 bg-slate-800/80 border-4 border-purple-500/30 rounded text-4xl text-cyan-100 font-medium focus:border-purple-400 focus:outline-none"
                        >
                          <option value="1:1">📱 Ratio: 1:1</option>
                          <option value="4:5">📱 Ratio: 4:5</option>
                          <option value="9:16">📱 Ratio: 9:16</option>
                          <option value="16:9">📱 Ratio: 16:9</option>
                        </select>
                      </div>
                    </div>

                    {/* Generate Button */}
                    <button
                      onClick={handleStudioGenerate}
                      disabled={!studioScanner.prompt.trim() || loadingPlaceholders.filter(p => !p.failed).length >= MAX_CONCURRENT_GENERATIONS}
                      className="w-full px-12 py-10 bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-400 hover:to-blue-400 disabled:from-slate-700 disabled:to-slate-700 rounded text-5xl font-black text-white transition-all disabled:opacity-50 shadow-lg hover:shadow-cyan-500/50 flex items-center justify-center gap-8"
                      title={loadingPlaceholders.filter(p => !p.failed).length >= MAX_CONCURRENT_GENERATIONS ? `Queue full (max ${MAX_CONCURRENT_GENERATIONS})` : 'Generate image'}
                    >
                      <Zap size={64} />
                      {loadingPlaceholders.filter(p => !p.failed).length >= MAX_CONCURRENT_GENERATIONS ? (
                        `⏳ QUEUE FULL (${loadingPlaceholders.filter(p => !p.failed).length}/${MAX_CONCURRENT_GENERATIONS})`
                      ) : (() => {
                        const m = studioScanner.model;
                        const q = studioScanner.quality;
                        const cost = (m === 'nano-banana-pro' || m === 'pro-scanner-v3') ? (q === '4k' ? 10 : 5)
                          : m === 'seedream-4.5' ? (q === '4k' ? 2 : 1)
                          : m === 'nano-banana-cluster' ? 2 : 1;
                        const suffix = m === 'nano-banana-cluster' ? ' ×2 IMAGES' : '';
                        return `🔍 GENERATE (${cost} 🎫${suffix})`;
                      })()}
                    </button>
                  </div>
                )}

                {/* Last 4 boxes in hybrid mode */}
                {canvasMode === 'hybrid' && (
                  <div className="grid grid-cols-2 gap-6 mt-8">
                    {savedPrompts.slice(4, 8).map((prompt, index) => {
                      const actualIndex = index + 4;
                      return (
                        <div key={actualIndex} className={`rounded-lg overflow-hidden border-8 transition-all flex flex-col ${
                          prompt.trim()
                            ? 'border-green-500 shadow-md shadow-green-500/20'
                            : 'border-slate-700'
                        }`}>
                          {/* Prompt Header */}
                          <div className="flex items-center justify-between px-6 py-2 bg-slate-700/50 border-b-4 border-slate-600">
                            <span className="text-4xl font-bold text-green-400">{actualIndex + 1}</span>
                            <button
                              onClick={() => copyPromptFromBox(actualIndex)}
                              disabled={!prompt.trim()}
                              className="flex items-center gap-2 px-6 py-2 bg-green-600 hover:bg-green-500 disabled:bg-slate-600 disabled:opacity-50 rounded text-3xl font-bold text-white transition-colors"
                            >
                              <Copy size={32} />
                              Copy
                            </button>
                          </div>
                          {/* Prompt Textarea */}
                          <textarea
                            value={prompt}
                            onChange={(e) => updateSavedPrompt(actualIndex, e.target.value)}
                            placeholder="Prompt..."
                            className="w-full px-6 py-4 bg-slate-800 text-4xl text-white placeholder-slate-500 focus:outline-none resize-none flex-1"
                            style={{ minHeight: '520px' }}
                          />
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="px-8 py-6 border-t-4 border-green-500/20 bg-slate-900/50 rounded-b-xl">
                <p className="text-4xl text-slate-500 text-center">
                  Save prompts to reuse across scanners
                </p>
              </div>
            </div>

            {/* Center indicator */}
            <div
              className="absolute w-6 h-6 rounded-full border-2 border-cyan-500 bg-slate-900/50"
              style={{
                left: 'calc(50% - 12px)',
                top: 'calc(50% - 12px)',
              }}
            />

            {/* Loading placeholders */}
            {loadingPlaceholders.map((placeholder) => {
              const isFullscreen = canvasMode === 'fullscreen';
              const placeholderSize = isFullscreen ? 3400 : 680;
              const displayPosition = isFullscreen ? { x: 0, y: 0 } : placeholder.position;

              return (
                <div
                  key={placeholder.id}
                  className={`absolute border-2 border-dashed rounded-lg flex items-center justify-center ${
                    placeholder.failed
                      ? 'border-red-500 bg-red-500/10 cursor-pointer hover:bg-red-500/20 transition-colors'
                      : 'border-cyan-500 bg-yellow-500/10'
                  }`}
                  style={{
                    left: `calc(50% + ${displayPosition.x}px)`,
                    top: `calc(50% + ${displayPosition.y}px)`,
                    transform: 'translate(-50%, -50%)',
                    width: `${placeholderSize}px`,
                    height: `${placeholderSize}px`,
                  }}
                  onClick={() => {
                    if (placeholder.failed) {
                      setLoadingPlaceholders(prev => prev.filter(p => p.id !== placeholder.id));
                    }
                  }}
                  title={placeholder.failed ? 'Click to remove' : ''}
                >
                  <div className="text-center">
                    {placeholder.failed ? (
                      <>
                        <div className={`rounded-full ${isFullscreen ? 'h-32 w-32 border-8' : 'h-16 w-16 border-4'} border-red-500 mx-auto mb-3 flex items-center justify-center`}>
                          <X className="text-red-500" size={isFullscreen ? 64 : 32} />
                        </div>
                        <div className={`text-red-400 font-bold ${isFullscreen ? 'text-4xl' : 'text-xl'}`}>Failed</div>
                        <div className={`text-red-400/70 mt-2 ${isFullscreen ? 'text-base' : 'text-xs'}`}>Click to remove</div>
                      </>
                    ) : (
                      <>
                        <div className={`animate-spin rounded-full ${isFullscreen ? 'h-32 w-32 border-b-8' : 'h-16 w-16 border-b-4'} border-yellow-400 mx-auto mb-3`} />
                        <div className={`text-yellow-400 font-bold ${isFullscreen ? 'text-4xl' : 'text-xl'}`}>Generating...</div>
                      </>
                    )}
                  </div>
                </div>
              );
            })}

            {/* Session images */}
            {sessionImages.map((img, idx) => {
              // Fullscreen: Large preview filling the blue boundary
              const isFullscreen = canvasMode === 'fullscreen';
              const imageSize = isFullscreen ? 3400 : 680; // Fullscreen: 3400px to fill boundary, Canvas: 680px (5x5 grid)

              // In fullscreen mode, only show the current image
              if (isFullscreen && idx !== fullscreenImageIndex) {
                return null;
              }

              // In fullscreen mode, always center the image regardless of stored position
              const displayPosition = isFullscreen ? { x: 0, y: 0 } : img.position;

              return (
                <div
                  key={img.id}
                  className="absolute group"
                  style={{
                    left: `calc(50% + ${displayPosition.x}px)`,
                    top: `calc(50% + ${displayPosition.y}px)`,
                    transform: 'translate(-50%, -50%)',
                  }}
                >
                  <div
                    onClick={(e) => {
                      if (isSelectMode) {
                        e.stopPropagation();
                        toggleImageSelection(img.id);
                      } else {
                        handleImageClick(idx, e);
                      }
                    }}
                    className={`relative cursor-pointer rounded-lg border-2 overflow-hidden bg-slate-950 transition-all ${
                      selectedImageIds.has(img.id) ? 'border-blue-500 shadow-lg shadow-blue-500/50' :
                      img.isGem ? 'border-yellow-400' :
                      img.isDiluted ? 'border-orange-500' :
                      'border-slate-700'
                    } ${isFullscreen ? 'hover:border-cyan-400' : 'hover:border-cyan-400 hover:scale-105 hover:shadow-lg'}`}
                    style={{
                      width: `${imageSize}px`,
                      height: `${imageSize}px`,
                    }}
                  >
                    <img
                      src={img.imageUrl}
                      alt="Generated"
                      className="w-full h-full object-contain"
                    />

                    {/* Selection Checkbox - visible in select mode */}
                    {isSelectMode && (
                      <div className="absolute top-4 left-4 z-20">
                        <div className={`w-12 h-12 rounded-full border-4 flex items-center justify-center transition-all ${
                          selectedImageIds.has(img.id)
                            ? 'bg-blue-500 border-blue-500'
                            : 'bg-slate-800/80 border-slate-400'
                        }`}>
                          {selectedImageIds.has(img.id) && (
                            <CheckCircle size={32} className="text-white" />
                          )}
                        </div>
                      </div>
                    )}

                    {/* Remove Button - appears on hover (hidden in select mode) */}
                    {!isSelectMode && (
                      <button
                        onClick={(e) => removeImageFromCanvas(img.id, e)}
                        className="absolute top-2 right-2 bg-red-600 hover:bg-red-500 text-white rounded-full p-3 opacity-0 group-hover:opacity-100 transition-opacity shadow-lg z-10"
                        title="Remove from canvas"
                      >
                        <X size={48} />
                      </button>
                    )}
                  </div>

                  {(img.isGem || img.isDiluted) && (
                    <div className="flex gap-1 mt-1 justify-center">
                      {img.isGem && (
                        <span className="bg-yellow-500 text-black text-[10px] px-1.5 py-0.5 rounded font-bold">
                          GEM
                        </span>
                      )}
                      {img.isDiluted && (
                        <span className="bg-orange-500 text-white text-[10px] px-1.5 py-0.5 rounded font-bold">
                          DILUTED
                        </span>
                      )}
                    </div>
                  )}
                </div>
              );
            })}

            {/* Fullscreen Mode Navigation Arrows */}
            {canvasMode === 'fullscreen' && sessionImages.length > 1 && (
              <>
                {/* Left Arrow */}
                <div
                  className="absolute pointer-events-auto cursor-pointer"
                  style={{
                    left: 'calc(50% - 1900px)',
                    top: '50%',
                    transform: `translate(-50%, -50%)`,
                    transformOrigin: 'center center',
                    zIndex: 40,
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                    setFullscreenImageIndex((prev) => (prev - 1 + sessionImages.length) % sessionImages.length);
                  }}
                >
                  <div className="w-16 h-16 bg-cyan-600/90 hover:bg-cyan-500 rounded-full flex items-center justify-center shadow-2xl transition-all hover:scale-110">
                    <ChevronLeft size={40} className="text-white" />
                  </div>
                </div>

                {/* Right Arrow */}
                <div
                  className="absolute pointer-events-auto cursor-pointer"
                  style={{
                    left: 'calc(50% + 1900px)',
                    top: '50%',
                    transform: `translate(-50%, -50%)`,
                    transformOrigin: 'center center',
                    zIndex: 40,
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                    setFullscreenImageIndex((prev) => (prev + 1) % sessionImages.length);
                  }}
                >
                  <div className="w-16 h-16 bg-cyan-600/90 hover:bg-cyan-500 rounded-full flex items-center justify-center shadow-2xl transition-all hover:scale-110">
                    <ChevronRight size={40} className="text-white" />
                  </div>
                </div>

                {/* Image Counter */}
                <div
                  className="absolute pointer-events-none"
                  style={{
                    left: '50%',
                    top: 'calc(50% - 1800px)',
                    transform: `translate(-50%, -50%)`,
                    transformOrigin: 'center center',
                    zIndex: 40,
                  }}
                >
                  <div className="bg-slate-900/90 backdrop-blur-sm px-4 py-2 rounded-full border-2 border-cyan-500/50 shadow-xl">
                    <span className="text-cyan-400 font-bold text-lg">
                      {fullscreenImageIndex + 1} / {sessionImages.length}
                    </span>
                  </div>
                </div>
              </>
            )}

            {/* Scanners - Hide in studio mode only */}
            {canvasMode !== 'studio' && scannerPanels.map(panel => (
              <CanvasScanner
                key={panel.id}
                scannerId={panel.id}
                scanner={panel.scanner}
                position={panel.position}
                canvasScale={canvasScale}
                scannerScale={panel.scale}
                onUpdate={(field, value) => updateScannerPanel(panel.id, field, value)}
                onPositionChange={(newPos) => updateScannerPosition(panel.id, newPos)}
                onScaleChange={(newScale) => updateScannerScale(panel.id, newScale)}
                onGeneratePrompt={() => handleGeneratePrompt(panel.id)}
                onGenerate={() => handleGenerate(panel.id)}
                onTest={() => handleTest(panel.id)}
                onClose={() => removeScannerPanel(panel.id)}
                onReferenceUpload={handleScannerReferenceUpload}
                isGenerating={generatingPanels.has(panel.id)}
                generationQueueFull={loadingPlaceholders.filter(p => !p.failed).length >= MAX_CONCURRENT_GENERATIONS}
                promptCooldown={promptCooldown}
                promptModel={promptModel}
                onPromptModelChange={setPromptModel}
                isModelInMaintenance={isModelInMaintenance}
              />
            ))}

            {/* Studio Scanner - Show in studio mode only, now draggable on canvas */}
            {canvasMode === 'studio' && (
              <div
                className={`absolute bg-slate-900/95 backdrop-blur-sm border-2 rounded-xl shadow-2xl transition-shadow flex flex-col ${
                  isStudioPanelDragging ? 'border-purple-400 shadow-purple-500/30' : 'border-purple-500/50'
                }`}
                style={{
                  left: `calc(50% + ${studioPanelPosition.x}px)`,
                  top: `calc(50% + ${studioPanelPosition.y}px)`,
                  transform: `translate(-50%, -50%)`,
                  transformOrigin: 'center center',
                  width: '3750px',
                  zIndex: isStudioPanelDragging ? 100 : 30,
                }}
                onClick={(e) => e.stopPropagation()}
                onMouseDown={handleStudioPanelMouseDown}
                onMouseMove={handleStudioPanelMouseMove}
                onMouseUp={handleStudioPanelMouseUp}
                onMouseLeave={handleStudioPanelMouseUp}
                onTouchStart={handleStudioPanelTouchStart}
                onTouchMove={handleStudioPanelTouchMove}
                onTouchEnd={handleStudioPanelTouchEnd}
              >
                {/* Header - Drag Handle */}
                <div className="studio-panel-drag-handle flex items-center justify-between px-16 py-8 bg-gradient-to-r from-purple-900/80 to-fuchsia-900/80 border-b-4 border-purple-500/30 rounded-t-xl cursor-move touch-none">
                  <div className="flex items-center gap-8">
                    <Move size={56} className="text-purple-400" />
                    <Sparkles size={64} className="text-purple-400" />
                    <span className="text-5xl font-bold text-purple-400">STUDIO SCANNER</span>
                  </div>
                  <div className="text-4xl text-purple-300/70">
                    {sharedReferenceImages.filter(r => r.enabled).length} refs active
                  </div>
                </div>

            {/* Scanner Content */}
            <div className="p-12">
              {/* Names Row */}
              <div className="grid grid-cols-3 gap-8 mb-8">
                {studioScanner.names.map((name, idx) => (
                  <input
                    key={`name-${idx}`}
                    type="text"
                    value={name}
                    onChange={(e) => {
                      const newNames = [...studioScanner.names];
                      newNames[idx] = e.target.value;
                      setStudioScanner(prev => ({ ...prev, names: newNames }));
                    }}
                    placeholder={`Name ${idx + 1}...`}
                    className="px-8 py-6 bg-slate-800 border-4 border-slate-600 rounded text-5xl text-white placeholder-slate-500 focus:border-purple-500 focus:outline-none"
                  />
                ))}
              </div>

              {/* Enhancements Row */}
              <div className="grid grid-cols-3 gap-8 mb-8">
                {studioScanner.enhancements.map((enhancement, idx) => (
                  <input
                    key={`enhancement-${idx}`}
                    type="text"
                    value={enhancement}
                    onChange={(e) => {
                      const newEnhancements = [...studioScanner.enhancements];
                      newEnhancements[idx] = e.target.value;
                      setStudioScanner(prev => ({ ...prev, enhancements: newEnhancements }));
                    }}
                    placeholder={`Enhancement ${idx + 1}...`}
                    className="px-8 py-6 bg-slate-800 border-4 border-slate-600 rounded text-5xl text-white placeholder-slate-500 focus:border-purple-500 focus:outline-none"
                  />
                ))}
              </div>

              {/* Prompt */}
              <textarea
                value={studioScanner.prompt}
                onChange={(e) => setStudioScanner(prev => ({ ...prev, prompt: e.target.value }))}
                placeholder="Prompt..."
                className="w-full px-8 py-6 bg-slate-800 border-4 border-slate-600 rounded text-5xl text-white placeholder-slate-500 focus:border-purple-500 focus:outline-none resize-none mb-8"
                rows={3}
              />

              {/* Controls Row */}
              <div className="flex items-center gap-8">
                {/* Reference Upload Button */}
                <div className="relative flex-shrink-0" title="Upload reference images to shared panel">
                  <label className="w-36 h-36 border-4 border-dashed rounded flex items-center justify-center transition-colors bg-slate-800 border-fuchsia-600 cursor-pointer hover:border-fuchsia-400">
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      className="hidden"
                      onChange={async (e) => {
                        const files = Array.from(e.target.files || []);
                        if (files.length > 0) {
                          await handleScannerReferenceUpload(files);
                          e.target.value = '';
                        }
                      }}
                    />
                    <Upload className="text-fuchsia-400" size={56} />
                  </label>
                </div>

                {/* Model Selector - Made narrower */}
                <select
                  value={studioScanner.model}
                  onChange={(e) => {
                    setStudioScanner(prev => ({ ...prev, model: e.target.value }));
                    // Disable all reference images if switching to nano-banana-cluster
                    if (e.target.value === 'nano-banana-cluster') {
                      setSharedReferenceImages(prev => prev.map(ref => ({ ...ref, enabled: false })));
                    }
                  }}
                  className={`px-8 py-6 bg-slate-800 rounded text-4xl text-white focus:outline-none ${
                    isModelInMaintenance(studioScanner.model)
                      ? 'border-8 border-yellow-500 focus:border-yellow-500'
                      : 'border-4 border-slate-600 focus:border-purple-500'
                  }`}
                  style={{ width: '800px' }}
                >
                  <option value="nano-banana-pro">⚡ NB Pro{isModelInMaintenance('nano-banana-pro') ? ' (MAINT)' : ''}</option>
                  <option value="nano-banana-cluster">⚡ NB Cluster{isModelInMaintenance('nano-banana-cluster') ? ' (MAINT)' : ''}</option>
                  <option value="seedream-4.5">⚡ SeeDream{isModelInMaintenance('seedream-4.5') ? ' (MAINT)' : ''}</option>
                  <option value="pro-scanner-v3">⚡ Pro v3{isModelInMaintenance('pro-scanner-v3') ? ' (MAINT)' : ''}</option>
                  <option value="flash-scanner-v2.5">⚡ Flash v2.5{isModelInMaintenance('flash-scanner-v2.5') ? ' (MAINT)' : ''}</option>
                  <option value="flux-2">🌊 FLUX 2{isModelInMaintenance('flux-2') ? ' (MAINT)' : ''}</option>
                </select>

                {/* Quality - Only show for models that support it */}
                {!['flash-scanner-v2.5', 'nano-banana-cluster', 'flux-2'].includes(studioScanner.model) && (
                  <button
                    onClick={() => setStudioScanner(prev => ({ ...prev, quality: prev.quality === '2k' ? '4k' : '2k' }))}
                    className={`px-12 py-6 rounded font-bold text-4xl transition-colors ${
                      studioScanner.quality === '4k'
                        ? 'bg-purple-600 text-white'
                        : 'bg-slate-800 text-purple-400 border-4 border-purple-600'
                    }`}
                  >
                    {studioScanner.quality.toUpperCase()}
                  </button>
                )}

                {/* Aspect Ratio */}
                <div className="relative">
                  <button
                    onClick={() => setShowStudioAspectDropdown(!showStudioAspectDropdown)}
                    className="px-8 py-6 bg-fuchsia-600 text-white rounded font-bold text-4xl flex items-center gap-4"
                  >
                    <span>{studioScanner.aspectRatio}</span>
                    <ChevronDown size={48} />
                  </button>
                  {showStudioAspectDropdown && (
                    <div className="absolute z-50 bottom-full mb-4 right-0 w-80 bg-slate-800 border-4 border-fuchsia-500 rounded shadow-lg max-h-96 overflow-y-auto">
                      {getSupportedAspectRatios(studioScanner.model).map((ratio) => (
                        <button
                          key={ratio}
                          onClick={() => {
                            setStudioScanner(prev => ({ ...prev, aspectRatio: ratio }));
                            setShowStudioAspectDropdown(false);
                          }}
                          className={`w-full px-8 py-6 text-left text-4xl font-bold hover:bg-slate-700 transition-colors ${
                            studioScanner.aspectRatio === ratio ? 'bg-fuchsia-600 text-white' : 'text-slate-300'
                          }`}
                        >
                          {ratio}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Prompt Model Selector */}
                <div className="relative">
                  <button
                    onClick={() => setShowStudioPromptModelDropdown(!showStudioPromptModelDropdown)}
                    className="px-8 py-6 bg-purple-600 text-white rounded font-bold text-4xl flex items-center gap-4"
                    style={{ width: '360px' }}
                  >
                    <span>{promptModel === 'gemini-3-flash' ? 'G3F' : promptModel === 'gemini-2.0-flash-exp' ? 'G2E' : promptModel === 'gemini-3-pro' ? 'G3P' : 'Exp'}</span>
                    <ChevronDown size={48} />
                  </button>
                  {showStudioPromptModelDropdown && (
                    <div className="absolute z-50 bottom-full mb-4 right-0 w-80 bg-slate-800 border-4 border-purple-500 rounded shadow-lg">
                      <button
                        onClick={() => {
                          setPromptModel('gemini-3-flash');
                          setShowStudioPromptModelDropdown(false);
                        }}
                        className={`w-full px-8 py-6 text-left text-4xl font-bold hover:bg-slate-700 transition-colors ${
                          promptModel === 'gemini-3-flash' ? 'bg-purple-600 text-white' : 'text-slate-300'
                        }`}
                      >
                        G3F
                      </button>
                      <button
                        onClick={() => {
                          setPromptModel('gemini-2.0-flash-exp');
                          setShowStudioPromptModelDropdown(false);
                        }}
                        className={`w-full px-8 py-6 text-left text-4xl font-bold hover:bg-slate-700 transition-colors ${
                          promptModel === 'gemini-2.0-flash-exp' ? 'bg-purple-600 text-white' : 'text-slate-300'
                        }`}
                      >
                        G2E
                      </button>
                      <button
                        onClick={() => {
                          setPromptModel('gemini-3-pro');
                          setShowStudioPromptModelDropdown(false);
                        }}
                        className={`w-full px-8 py-6 text-left text-4xl font-bold hover:bg-slate-700 transition-colors ${
                          promptModel === 'gemini-3-pro' ? 'bg-purple-600 text-white' : 'text-slate-300'
                        }`}
                      >
                        G3P
                      </button>
                      <button
                        onClick={() => {
                          setPromptModel('gemini-exp-1206');
                          setShowStudioPromptModelDropdown(false);
                        }}
                        className={`w-full px-8 py-6 text-left text-4xl font-bold hover:bg-slate-700 transition-colors ${
                          promptModel === 'gemini-exp-1206' ? 'bg-purple-600 text-white' : 'text-slate-300'
                        }`}
                      >
                        Exp
                      </button>
                    </div>
                  )}
                </div>

                {/* Generate Prompt Button */}
                <Button
                  onClick={handleStudioGeneratePrompt}
                  disabled={(!studioScanner.names.some(n => n.trim()) && !studioScanner.enhancements.some(e => e.trim())) || promptCooldown > 0}
                  className="bg-purple-600 hover:bg-purple-500 disabled:opacity-50 disabled:cursor-not-allowed font-bold text-4xl h-36 px-16"
                  title={promptCooldown > 0 ? `Cooldown: ${promptCooldown}s` : ''}
                >
                  {promptCooldown > 0 ? `⏳ ${promptCooldown}s` : '✨ Prompt'}
                </Button>

                {/* Generate Button - Single button that respects global 5-image queue */}
                <Button
                  onClick={handleStudioGenerate}
                  disabled={!studioScanner.prompt.trim() || loadingPlaceholders.filter(p => !p.failed).length >= MAX_CONCURRENT_GENERATIONS}
                  className="bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 disabled:cursor-not-allowed font-bold text-5xl h-36 px-16"
                  title={loadingPlaceholders.filter(p => !p.failed).length >= MAX_CONCURRENT_GENERATIONS ? `Generation queue full (max ${MAX_CONCURRENT_GENERATIONS})` : ''}
                >
                  {loadingPlaceholders.filter(p => !p.failed).length >= MAX_CONCURRENT_GENERATIONS ? (
                    `⏳ Queue Full (${loadingPlaceholders.filter(p => !p.failed).length}/${MAX_CONCURRENT_GENERATIONS})`
                  ) : (() => {
                    const m = studioScanner.model;
                    const q = studioScanner.quality;
                    const cost = (m === 'nano-banana-pro' || m === 'pro-scanner-v3') ? (q === '4k' ? 10 : 5)
                      : m === 'seedream-4.5' ? (q === '4k' ? 2 : 1)
                      : m === 'nano-banana-cluster' ? 2 : 1;
                    const suffix = m === 'nano-banana-cluster' ? ' ×2' : '';
                    return `🔍 Scan (${cost} 🎫${suffix})`;
                  })()}
                </Button>
              </div>
            </div>
              </div>
            )}

          </div>
        </div>

        {/* View Controls */}
        <div className="absolute top-4 right-4 flex flex-col gap-2 z-10">
          {/* Mode Toggle Button */}
          <button
            onClick={() => {
              if (canvasMode === 'canvas') setCanvasMode('fullscreen');
              else if (canvasMode === 'fullscreen') setCanvasMode('studio');
              else if (canvasMode === 'studio') setCanvasMode('hybrid');
              else if (canvasMode === 'hybrid') setCanvasMode('expanded');
              else setCanvasMode('canvas');
            }}
            className={`px-4 py-3 rounded-full font-bold text-white shadow-lg transition-all hover:scale-105 ${
              canvasMode === 'canvas'
                ? 'bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500'
                : canvasMode === 'fullscreen'
                  ? 'bg-gradient-to-r from-orange-600 to-pink-600 hover:from-orange-500 hover:to-pink-500'
                  : canvasMode === 'studio'
                    ? 'bg-gradient-to-r from-purple-600 to-fuchsia-600 hover:from-purple-500 hover:to-fuchsia-500'
                    : canvasMode === 'hybrid'
                      ? 'bg-gradient-to-r from-green-600 to-teal-600 hover:from-green-500 hover:to-teal-500'
                      : 'bg-gradient-to-r from-yellow-600 to-amber-600 hover:from-yellow-500 hover:to-amber-500'
            }`}
          >
            {canvasMode === 'canvas' ? 'Canvas' : canvasMode === 'fullscreen' ? 'Fullscreen' : canvasMode === 'studio' ? 'Studio' : canvasMode === 'hybrid' ? 'Hybrid' : 'Expanded'}
          </button>

          {/* Multi-Select Toggle Button - Only in Canvas & Studio modes */}
          {canvasMode !== 'fullscreen' && sessionImages.length > 0 && (
            <button
              onClick={() => {
                setIsSelectMode(!isSelectMode);
                setSelectedImageIds(new Set()); // Clear selections when toggling
              }}
              className={`px-4 py-3 rounded-full font-bold text-white shadow-lg transition-all hover:scale-105 ${
                isSelectMode
                  ? 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500'
                  : 'bg-gradient-to-r from-slate-600 to-slate-700 hover:from-slate-500 hover:to-slate-600'
              }`}
            >
              {isSelectMode ? 'Exit Select' : 'Select'}
            </button>
          )}

          {/* Selection Action Buttons - Only visible in select mode */}
          {isSelectMode && (
            <>
              {/* Select All / Deselect All */}
              <button
                onClick={() => {
                  if (selectedImageIds.size === sessionImages.length) {
                    deselectAllImages();
                  } else {
                    selectAllImages();
                  }
                }}
                className="px-4 py-2 rounded-full font-bold text-white bg-gradient-to-r from-slate-600 to-slate-700 hover:from-slate-500 hover:to-slate-600 shadow-lg transition-all hover:scale-105 text-sm"
              >
                {selectedImageIds.size === sessionImages.length ? 'Deselect All' : 'Select All'}
              </button>

              {/* Remove Selected Button */}
              {selectedImageIds.size > 0 && (
                <button
                  onClick={removeSelectedImages}
                  className="px-4 py-2 rounded-full font-bold text-white bg-gradient-to-r from-red-600 to-red-700 hover:from-red-500 hover:to-red-600 shadow-lg transition-all hover:scale-105 flex items-center gap-2 justify-center text-sm"
                >
                  <Trash2 size={16} />
                  Remove ({selectedImageIds.size})
                </button>
              )}
            </>
          )}

          {/* Recenter Button */}
          <button
            onClick={recenterCanvas}
            className="p-3 bg-purple-600 hover:bg-purple-500 rounded-full text-white shadow-lg self-center"
            title="Recenter canvas"
          >
            <Maximize2 size={20} />
          </button>
        </div>

        {/* Info overlay */}
        <div className="absolute top-4 left-4 bg-slate-900/80 backdrop-blur-sm rounded-lg px-4 py-2 text-sm text-slate-300 z-10">
          <div className="font-bold mb-1 text-cyan-400">
            {canvasMode === 'fullscreen' ? 'Fullscreen Mode' : canvasMode === 'studio' ? 'Studio Mode' : canvasMode === 'hybrid' ? 'Hybrid Mode' : canvasMode === 'expanded' ? 'Expanded Mode' : 'Canvas Mode'}
          </div>
          <div className="font-bold mb-1">
            {canvasMode === 'fullscreen'
              ? `Viewing: ${sessionImages.length > 0 ? fullscreenImageIndex + 1 : 0}/${sessionImages.length}`
              : `Images: ${sessionImages.length}/${CANVAS_CONFIG.maxImages}`
            }
          </div>
          <div className="flex items-center gap-2">
            <div className={loadingPlaceholders.filter(p => !p.failed).length >= (canvasMode === 'fullscreen' ? 1 : MAX_CONCURRENT_GENERATIONS) ? 'text-yellow-400' : ''}>
              Generating: {loadingPlaceholders.filter(p => !p.failed).length}/{canvasMode === 'fullscreen' ? 1 : MAX_CONCURRENT_GENERATIONS}
            </div>
            {loadingPlaceholders.length > 0 && (
              <button
                onClick={() => {
                  if (confirm('Clear all loading placeholders? This will free up the generation queue.')) {
                    setLoadingPlaceholders([]);
                  }
                }}
                className="px-2 py-0.5 text-xs bg-red-500/20 hover:bg-red-500/40 text-red-400 rounded transition-colors"
                title="Clear stuck placeholders"
              >
                Clear Queue
              </button>
            )}
          </div>
          <div className="text-xs text-fuchsia-400">
            Refs: {sharedReferenceImages.filter(r => r.enabled).length} active / {sharedReferenceImages.length} total
          </div>
          <div className="text-xs text-slate-500 mt-1">Zoom: {canvasScale.toFixed(2)}x</div>
          <div className="text-xs text-slate-500">Click image to preview</div>
          {canvasMode === 'fullscreen' && sessionImages.length > 1 && (
            <div className="text-xs text-cyan-400 mt-1">← → Navigate images</div>
          )}
        </div>
      </div>

      {/* Add Scanner Button */}
      {canvasMode !== 'studio' && (
        <div className="fixed bottom-4 right-4 z-40 flex items-center gap-2">
          <div className="text-sm text-slate-400 bg-slate-900/80 px-3 py-2 rounded-lg">
            <div className="font-bold">Scanners: {scannerPanels.length}/{MAX_SCANNERS}</div>
          </div>
          <button
            onClick={createScannerPanel}
            disabled={scannerPanels.length >= MAX_SCANNERS}
            className="px-4 py-3 bg-gradient-to-r from-purple-600 to-cyan-600 hover:from-purple-500 hover:to-cyan-500 disabled:from-slate-600 disabled:to-slate-600 disabled:cursor-not-allowed rounded-full font-bold text-white shadow-lg transition-all hover:scale-105"
          >
            + Add Scanner
          </button>
        </div>
      )}

      {/* Carousel Modal */}
      {carouselOpen && currentImage && (
        <div className="fixed inset-0 bg-black/95 z-50 flex flex-col">
          {/* Close button */}
          <button
            onClick={() => setCarouselOpen(false)}
            className="absolute top-4 right-4 p-2 bg-slate-900 hover:bg-slate-800 rounded-full text-white z-20"
          >
            <X size={24} />
          </button>

          {/* Navigation buttons */}
          <button
            onClick={prevImage}
            className="absolute left-4 top-1/2 -translate-y-1/2 p-3 bg-slate-900/80 hover:bg-slate-800 rounded-full text-white z-20"
          >
            <ChevronLeft size={32} />
          </button>
          <button
            onClick={nextImage}
            className="absolute right-4 top-1/2 -translate-y-1/2 p-3 bg-slate-900/80 hover:bg-slate-800 rounded-full text-white z-20"
          >
            <ChevronRight size={32} />
          </button>

          {/* Image container */}
          <div className="flex-1 flex items-center justify-center p-4 min-h-0">
            <img
              src={currentImage.imageUrl}
              alt="Carousel"
              className="max-w-full max-h-full object-contain rounded cursor-pointer hover:opacity-90 transition-opacity"
              onClick={(e) => {
                e.stopPropagation();
                window.open(currentImage.imageUrl, '_blank');
              }}
              title="Click to open full size in new tab"
            />
          </div>

          {/* Bottom controls */}
          <div className="flex-shrink-0 w-full bg-slate-900/95 border-t-2 border-cyan-500/30 p-4">
            <div className="max-w-4xl mx-auto">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-slate-400">
                  {carouselIndex + 1} / {sessionImages.length}
                </span>
                <div className="flex gap-2">
                  <span className="text-xs text-slate-400">Model: {currentImage.model}</span>
                  <span className="text-xs text-slate-400">|</span>
                  <span className="text-xs text-slate-400">Quality: {currentImage.quality}</span>
                  <span className="text-xs text-slate-400">|</span>
                  <span className="text-xs text-slate-400">Ratio: {currentImage.aspectRatio}</span>
                </div>
              </div>

              <div className="bg-slate-950 rounded p-3 mb-3">
                <div className="text-sm text-white mb-2">{currentImage.prompt}</div>
              </div>

              <div className="flex flex-wrap gap-2">
                <Button
                  onClick={downloadImage}
                  className="bg-green-600 hover:bg-green-500 h-9 flex-1"
                >
                  <Download className="mr-2" size={16} />
                  Download
                </Button>

                <Button
                  onClick={copyPrompt}
                  className="bg-slate-700 hover:bg-slate-600 h-9 flex-1"
                >
                  <Copy className="mr-2" size={16} />
                  Copy
                </Button>

                <Button
                  onClick={() => {
                    if (canvasMode === 'studio') {
                      // In studio mode, rescan directly to studio scanner
                      rescanToStudioScanner();
                    } else {
                      // In canvas/fullscreen mode, show panel selection modal
                      setShowRescanModal(true);
                    }
                  }}
                  className="bg-purple-600 hover:bg-purple-500 h-9 flex-1"
                >
                  <Wand2 className="mr-2" size={16} />
                  Rescan
                </Button>

                <Button
                  onClick={markAsDiluted}
                  className={`h-9 flex-1 ${
                    currentImage.isDiluted
                      ? 'bg-orange-600 hover:bg-orange-500'
                      : 'bg-slate-700 hover:bg-slate-600'
                  }`}
                >
                  {currentImage.isDiluted ? 'Diluted' : 'Diluted'}
                </Button>

                <Button
                  onClick={markAsGem}
                  className={`h-9 flex-1 ${
                    currentImage.isGem
                      ? 'bg-yellow-500 hover:bg-yellow-400 text-black font-bold'
                      : 'bg-slate-700 hover:bg-slate-600'
                  }`}
                >
                  {currentImage.isGem ? 'Gem' : 'Gem'}
                </Button>

                <Button
                  onClick={() => {
                    if (confirm('Remove this image from canvas?')) {
                      setSessionImages(prev => prev.filter(img => img.id !== currentImage.id));
                      setCarouselOpen(false);
                    }
                  }}
                  className="bg-red-600 hover:bg-red-500 h-9 flex-1"
                >
                  <Trash2 className="mr-2" size={16} />
                  Remove
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Save Modal */}
      {showSaveModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60]">
          <div className="bg-slate-900 border-2 border-green-500/30 rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-bold text-green-400 mb-2">Save Session</h3>
            <p className="text-sm text-slate-400 mb-4">
              Saving {sessionImages.length} images
            </p>
            <input
              type="text"
              value={sessionSaveName}
              onChange={(e) => setSessionSaveName(e.target.value)}
              placeholder="Session name..."
              className="w-full p-2 rounded bg-slate-950 border border-slate-700 text-white text-sm mb-4"
              autoFocus
            />
            <div className="flex gap-2">
              <Button
                onClick={saveCurrentSession}
                className="flex-1 bg-green-600 hover:bg-green-500"
                disabled={savedSessions.length >= 50}
              >
                Save ({savedSessions.length}/50)
              </Button>
              <Button
                onClick={() => {
                  setShowSaveModal(false);
                  setSessionSaveName('');
                }}
                className="flex-1 bg-slate-700 hover:bg-slate-600"
              >
                Cancel
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Load Modal */}
      {showLoadModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60]">
          <div className="bg-slate-900 border-2 border-blue-500/30 rounded-lg p-6 max-w-lg w-full mx-4">
            <h3 className="text-lg font-bold text-blue-400 mb-4">Load Session</h3>

            {savedSessions.length === 0 ? (
              <p className="text-sm text-slate-400 mb-4">No saved sessions yet.</p>
            ) : (
              <div className="space-y-2 mb-4 max-h-60 overflow-y-auto">
                {savedSessions.map((session: any) => (
                  <div
                    key={session.id}
                    className="bg-slate-950 border border-slate-700 rounded p-3"
                  >
                    {renamingSessionId === session.id ? (
                      // Rename Mode
                      <div className="space-y-2">
                        <input
                          type="text"
                          value={renameSessionName}
                          onChange={(e) => setRenameSessionName(e.target.value)}
                          placeholder="New session name..."
                          className="w-full px-3 py-2 bg-slate-900 border border-purple-500 rounded text-white text-sm focus:outline-none focus:border-purple-400"
                          autoFocus
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              renameSession(session.id);
                            } else if (e.key === 'Escape') {
                              cancelRenameSession();
                            }
                          }}
                        />
                        <div className="text-xs text-slate-400 mb-2">
                          {session.imageCount} images | {new Date(session.createdAt).toLocaleDateString()}
                        </div>
                        <div className="flex gap-2">
                          <Button
                            onClick={() => renameSession(session.id)}
                            className="flex-1 bg-green-600 hover:bg-green-500 h-8 text-xs"
                          >
                            Save
                          </Button>
                          <Button
                            onClick={cancelRenameSession}
                            className="flex-1 bg-slate-600 hover:bg-slate-500 h-8 text-xs"
                          >
                            Cancel
                          </Button>
                        </div>
                      </div>
                    ) : (
                      // Normal Mode
                      <>
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex-1">
                            <div className="text-white font-medium">{session.name}</div>
                            <div className="text-xs text-slate-400">
                              {session.imageCount} images | {new Date(session.createdAt).toLocaleDateString()}
                            </div>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            onClick={() => loadSession(session.id)}
                            className="flex-1 bg-cyan-600 hover:bg-cyan-500 h-8 text-xs"
                          >
                            Load
                          </Button>
                          <Button
                            onClick={() => startRenameSession(session.id, session.name)}
                            className="flex-1 bg-purple-600 hover:bg-purple-500 h-8 text-xs"
                          >
                            Rename
                          </Button>
                          <Button
                            onClick={() => deleteSession(session.id)}
                            className="flex-1 bg-red-600 hover:bg-red-500 h-8 text-xs"
                          >
                            Delete
                          </Button>
                        </div>
                      </>
                    )}
                  </div>
                ))}
              </div>
            )}
            <Button
              onClick={() => setShowLoadModal(false)}
              className="w-full bg-slate-700 hover:bg-slate-600"
            >
              Cancel
            </Button>
          </div>
        </div>
      )}

      {/* Rescan Modal */}
      {showRescanModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60]">
          <div className="bg-slate-900 border-2 border-cyan-500/30 rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-bold text-cyan-400 mb-4">Rescan to Scanner</h3>
            {scannerPanels.length === 0 ? (
              <p className="text-sm text-slate-400 mb-4">No scanner panels open. Add a scanner first.</p>
            ) : (
              <div className="grid grid-cols-2 gap-2 mb-4">
                {scannerPanels.map(panel => (
                  <Button
                    key={panel.id}
                    onClick={() => rescanToPanel(panel.id)}
                    className="bg-cyan-600 hover:bg-cyan-500 h-12"
                  >
                    Scanner {panel.id}
                  </Button>
                ))}
              </div>
            )}
            <Button
              onClick={() => setShowRescanModal(false)}
              className="w-full bg-slate-700 hover:bg-slate-600"
            >
              Cancel
            </Button>
          </div>
        </div>
      )}

      {/* Logout Confirmation Modal */}
      {showLogoutConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60]">
          <div className="bg-slate-900 border-2 border-red-500/30 rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-bold text-red-400 mb-2">Confirm Logout</h3>
            <p className="text-sm text-slate-400 mb-6">
              Are you sure you want to sign out? Any unsaved work will be lost.
            </p>
            <div className="flex gap-2">
              <Button
                onClick={async () => {
                  setShowLogoutConfirm(false);
                  await fetch('/api/auth/logout', { method: 'POST' });
                  router.push('/');
                }}
                className="flex-1 bg-red-600 hover:bg-red-500"
              >
                Confirm Logout
              </Button>
              <Button
                onClick={() => setShowLogoutConfirm(false)}
                className="flex-1 bg-slate-700 hover:bg-slate-600"
              >
                Cancel
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Reference Image Preview Modal */}
      {previewReferenceImage && (
        <div
          className="fixed inset-0 bg-black/95 z-[70] flex flex-col"
          onClick={() => setPreviewReferenceImage(null)}
        >
          {/* Close Button */}
          <button
            onClick={() => setPreviewReferenceImage(null)}
            className="absolute top-4 right-4 text-white hover:text-fuchsia-400 transition-colors z-50 bg-black/50 rounded-full p-2"
          >
            <X size={28} />
          </button>

          {/* Image Area */}
          <div className="flex-1 flex items-center justify-center p-4 min-h-0">
            <img
              src={previewReferenceImage.url}
              alt={previewReferenceImage.filename}
              className="max-w-full max-h-full object-contain rounded-lg"
              onClick={(e) => e.stopPropagation()}
            />
          </div>

          {/* Details Panel */}
          <div
            className="flex-shrink-0 w-full bg-slate-900/95 border-t border-fuchsia-500/30 px-4 py-3"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="max-w-4xl mx-auto">
              {/* Filename */}
              <div className="flex items-center gap-2 mb-3">
                <ImageIcon className="text-fuchsia-400 flex-shrink-0" size={14} />
                <p className="text-white text-xs flex-1 truncate">{previewReferenceImage.filename}</p>
                {/* Status badge */}
                <span className={`px-2 py-0.5 rounded text-[10px] font-bold flex-shrink-0 ${
                  previewReferenceImage.enabled
                    ? 'bg-fuchsia-500/30 text-fuchsia-400'
                    : 'bg-slate-700 text-slate-400'
                }`}>
                  {previewReferenceImage.enabled ? 'ACTIVE' : 'INACTIVE'}
                </span>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2">
                <Button
                  onClick={(e) => {
                    e.stopPropagation();
                    removeReferenceImage(previewReferenceImage.id);
                    setPreviewReferenceImage(null);
                  }}
                  className="bg-red-600 hover:bg-red-500 text-white font-bold py-2 px-4 rounded-lg flex items-center gap-2 text-sm"
                >
                  <Trash2 size={14} />
                  Remove
                </Button>
                <Button
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleReferenceImage(previewReferenceImage.id);
                  }}
                  className={`font-bold py-2 px-4 rounded-lg flex items-center gap-2 text-sm ${
                    previewReferenceImage.enabled
                      ? 'bg-slate-600 hover:bg-slate-500 text-white'
                      : 'bg-fuchsia-600 hover:bg-fuchsia-500 text-white'
                  }`}
                >
                  {previewReferenceImage.enabled ? (
                    <><ToggleLeft size={14} /> Deactivate</>
                  ) : (
                    <><ToggleRight size={14} /> Activate</>
                  )}
                </Button>
                <div className="flex-1" />
                <a
                  href={previewReferenceImage.url}
                  download={previewReferenceImage.filename}
                  onClick={(e) => e.stopPropagation()}
                  className="bg-cyan-600 hover:bg-cyan-500 text-white font-bold py-2 px-4 rounded-lg flex items-center gap-2 text-sm"
                >
                  <Download size={14} />
                  Download
                </a>
              </div>
            </div>
          </div>
        </div>
      )}

      <style jsx global>{`
        body {
          overscroll-behavior: none;
          overflow: hidden;
          position: fixed;
          width: 100%;
          height: 100%;
        }
        html {
          overscroll-behavior: none;
        }
      `}</style>
        </>
      )}
    </div>
  );
}
