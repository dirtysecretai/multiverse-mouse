'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Scan, Upload, X, Wand2, Zap, ArrowLeft, Ticket, ChevronDown, Image as ImageIcon, Download, Copy, RotateCcw, Lock, AlertTriangle } from 'lucide-react';
import Link from 'next/link';
import { getModelConfig, getAllModels } from '../modelConfig';
import { SavedModelPicker } from '@/components/SavedModelPicker';

interface GeneratedImage {
  id: string;
  prompt: string;
  imageUrl: string;  // For images: image URL. For videos: thumbnail/poster URL (may be empty)
  videoUrl?: string; // Video URL — set only for video items
  isVideo?: boolean;
  model: string;
  timestamp: number;
  loading?: boolean; // For loading placeholders
  failed?: boolean;  // For red failed state
}

interface AdminState {
  isMaintenanceMode: boolean;
  legacyScannerMaintenance: boolean;

  // OLD maintenance (kept for backward compatibility)
  nanoBananaMaintenance: boolean;
  nanoBananaProMaintenance: boolean;
  seedreamMaintenance: boolean;

  // NEW per-scanner, per-model maintenance
  legacyScanner_nanoBanana?: boolean;
  legacyScanner_nanoBananaPro?: boolean;
  legacyScanner_seedream?: boolean;
  legacyScanner_flux2?: boolean;
  legacyScanner_proScannerV3?: boolean;
  legacyScanner_flashScannerV25?: boolean;
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

export default function LegacyScanner() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [ticketBalance, setTicketBalance] = useState<number>(0);
  const [hasPromptStudioDev, setHasPromptStudioDev] = useState(false);
  const [adminState, setAdminState] = useState<AdminState>({
    isMaintenanceMode: false,
    legacyScannerMaintenance: false,
    nanoBananaMaintenance: false,
    nanoBananaProMaintenance: false,
    seedreamMaintenance: false,
    legacyScanner_nanoBanana: false,
    legacyScanner_nanoBananaPro: false,
    legacyScanner_seedream: false,
    legacyScanner_flux2: false,
    legacyScanner_proScannerV3: false,
    legacyScanner_flashScannerV25: false,
  });

  // Scanner state
  const [model, setModel] = useState('nano-banana-pro');
  const [celebrityName, setCelebrityName] = useState('');
  const [enhancement, setEnhancement] = useState('');
  const [prompt, setPrompt] = useState('');
  const [quality, setQuality] = useState<'2k' | '4k'>('2k');
  const [aspectRatio, setAspectRatio] = useState<'1:1' | '4:5' | '9:16' | '16:9'>('1:1');
  const [referenceImages, setReferenceImages] = useState<File[]>([]);
  const [referencePreviewUrls, setReferencePreviewUrls] = useState<string[]>([]);
  const [savedModelUrls, setSavedModelUrls] = useState<string[]>([]);
  const [greyedOutUrls, setGreyedOutUrls] = useState<string[]>([]);
  const [isLoadingModel, setIsLoadingModel] = useState(false);

  // UI state
  const [showModelSelector, setShowModelSelector] = useState(false);
  const [generationQueue, setGenerationQueue] = useState(0); // Track concurrent generations (max 3)
  const [generatedImages, setGeneratedImages] = useState<GeneratedImage[]>([]);
  const [selectedImage, setSelectedImage] = useState<GeneratedImage | null>(null);
  const [activeGenerations, setActiveGenerations] = useState<Set<string>>(new Set()); // Track which buttons are actively generating

  // AI Prompt Generation Models
  const [promptModel, setPromptModel] = useState<'gemini-3-flash' | 'gemini-2.0-flash-exp' | 'gemini-3-pro' | 'gemini-exp-1206'>('gemini-3-flash');
  const [lastPromptGenTime, setLastPromptGenTime] = useState<Record<string, number>>({});
  const [promptCooldown, setPromptCooldown] = useState<number>(0);
  const [showPromptModelDropdown, setShowPromptModelDropdown] = useState(false);

  // Refs for cross-refresh generation tracking
  const sessionStartRef = useRef(Date.now())
  const syncedJobIdsRef = useRef<Set<number>>(new Set())

  const MAX_QUEUE_SIZE = user?.email === 'dirtysecretai@gmail.com' ? 10 : hasPromptStudioDev ? 6 : 2;
  const MAX_FEED_SIZE = 50;

  const allModels = getAllModels();
  const modelConfig = getModelConfig(model);

  // Models that don't support certain features
  const NO_REFERENCE_MODELS = ['nano-banana-cluster'];
  const NO_QUALITY_MODELS = ['flash-scanner-v2.5', 'nano-banana-cluster', 'flux-2'];

  // Models that support 8 reference images (premium models)
  const EIGHT_REFERENCE_MODELS = ['nano-banana-pro', 'seedream-4.5', 'pro-scanner-v3'];

  const supportsReferenceImages = !NO_REFERENCE_MODELS.includes(model);
  const supportsQuality = !NO_QUALITY_MODELS.includes(model);

  // Get max reference images for current model
  const getMaxReferenceImages = () => {
    if (!supportsReferenceImages) return 0;
    return EIGHT_REFERENCE_MODELS.includes(model) ? 8 : 4;
  };

  // Check if a model is in maintenance
  const isModelInMaintenance = (modelId: string): boolean => {
    const modelMap: Record<string, keyof AdminState> = {
      'nano-banana': 'legacyScanner_nanoBanana',
      'nano-banana-cluster': 'legacyScanner_nanoBanana', // Legacy scanner uses 'nano-banana-cluster'
      'nano-banana-pro': 'legacyScanner_nanoBananaPro',
      'seedream-4.5': 'legacyScanner_seedream',
      'flux-2': 'legacyScanner_flux2',
      'gemini-3-pro-image': 'legacyScanner_proScannerV3',
      'pro-scanner-v3': 'legacyScanner_proScannerV3',
      'gemini-2.5-flash-image': 'legacyScanner_flashScannerV25',
      'flash-scanner-v2.5': 'legacyScanner_flashScannerV25',
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

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const res = await fetch('/api/auth/session');
        const data = await res.json();

        if (!data.authenticated) {
          router.push('/login');
          return;
        }

        setUser(data.user);

        // Fetch subscription status
        const subRes = await fetch('/api/user/subscription');
        const subData = await subRes.json();
        if (subData.success) {
          setHasPromptStudioDev(subData.hasPromptStudioDev);
        }

        // Fetch ticket balance
        const ticketRes = await fetch(`/api/user/tickets?userId=${data.user.id}`);
        const ticketData = await ticketRes.json();
        if (ticketData.success) {
          setTicketBalance(ticketData.balance);
        }

        // Fetch admin config for maintenance status
        const adminRes = await fetch('/api/admin/config');
        const adminData = await adminRes.json();
        if (adminRes.ok) {
          setAdminState({
            isMaintenanceMode: !!adminData.isMaintenanceMode,
            legacyScannerMaintenance: !!adminData.legacyScannerMaintenance || false,
            nanoBananaMaintenance: !!adminData.nanoBananaMaintenance || false,
            nanoBananaProMaintenance: !!adminData.nanoBananaProMaintenance || false,
            seedreamMaintenance: !!adminData.seedreamMaintenance || false,
            legacyScanner_nanoBanana: !!adminData.legacyScanner_nanoBanana || false,
            legacyScanner_nanoBananaPro: !!adminData.legacyScanner_nanoBananaPro || false,
            legacyScanner_seedream: !!adminData.legacyScanner_seedream || false,
            legacyScanner_flux2: !!adminData.legacyScanner_flux2 || false,
            legacyScanner_proScannerV3: !!adminData.legacyScanner_proScannerV3 || false,
            legacyScanner_flashScannerV25: !!adminData.legacyScanner_flashScannerV25 || false,
          });
        }

        // Fetch user's 50 most recent generated images
        const imagesRes = await fetch('/api/my-images?limit=50');
        const imagesData = await imagesRes.json();
        if (imagesData.success && imagesData.images) {
          const recentImages: GeneratedImage[] = imagesData.images.map((img: any) => {
            const isVideo = !!(img.videoMetadata?.isVideo) || img.model === 'wan-2.5';
            return {
              id: img.id.toString(),
              prompt: img.prompt,
              imageUrl: isVideo ? (img.videoMetadata?.thumbnailUrl || '') : img.imageUrl,
              videoUrl: isVideo ? img.imageUrl : undefined,
              isVideo,
              model: img.model,
              timestamp: new Date(img.createdAt).getTime(),
              loading: false,
            };
          });
          setGeneratedImages(recentImages);
        }
      } catch (err) {
        router.push('/login');
      } finally {
        setLoading(false);
      }
    };
    checkAuth();
  }, [router]);

  // Cooldown timer effect
  useEffect(() => {
    if (promptCooldown > 0) {
      const timer = setInterval(() => {
        setPromptCooldown(prev => Math.max(0, prev - 1));
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [promptCooldown]);

  // Auto-save session
  useEffect(() => {
    if (!user) return;

    const saveTimer = setTimeout(() => {
      try {
        const sessionData = {
          model,
          celebrityName,
          enhancement,
          prompt,
          quality,
          aspectRatio,
          referencePreviewUrls,
          generatedImages: generatedImages.filter(img => !img.loading), // Don't save loading placeholders
          promptModel,
          timestamp: Date.now(),
        };
        localStorage.setItem('legacy-scanner-autosave', JSON.stringify(sessionData));
      } catch (err) {
        console.error('Failed to auto-save legacy scanner session:', err);
      }
    }, 1000);

    return () => clearTimeout(saveTimer);
  }, [user, model, celebrityName, enhancement, prompt, quality, aspectRatio, referencePreviewUrls, generatedImages, promptModel]);

  // Auto-restore session on mount
  useEffect(() => {
    if (!user) return;

    const restoreSession = async () => {
      try {
        const saved = localStorage.getItem('legacy-scanner-autosave');
        if (saved) {
          const sessionData = JSON.parse(saved);
          const hoursSinceLastSave = (Date.now() - (sessionData.timestamp || 0)) / (1000 * 60 * 60);

          if (hoursSinceLastSave < 24) {
            // Restore all saved state
            if (sessionData.model) setModel(sessionData.model);
            if (sessionData.celebrityName !== undefined) setCelebrityName(sessionData.celebrityName);
            if (sessionData.enhancement !== undefined) setEnhancement(sessionData.enhancement);
            if (sessionData.prompt !== undefined) setPrompt(sessionData.prompt);
            if (sessionData.quality) setQuality(sessionData.quality);
            if (sessionData.aspectRatio) setAspectRatio(sessionData.aspectRatio);
            if (sessionData.referencePreviewUrls) setReferencePreviewUrls(sessionData.referencePreviewUrls);
            if (sessionData.promptModel) setPromptModel(sessionData.promptModel);

            // Restore generated images and check for recently completed ones
            const restoredImages = sessionData.generatedImages || [];
            const existingImageIds = new Set(restoredImages.map((img: any) => img.id));

            // Fetch recent images to find any completed during refresh (last 5 minutes)
            const fiveMinutesAgo = Date.now() - (5 * 60 * 1000);
            const res = await fetch('/api/my-images?limit=20');
            if (res.ok) {
              const data = await res.json();
              if (data.success && data.images) {
                const recentNewImages = data.images
                  .filter((img: any) => {
                    const imgTime = new Date(img.createdAt).getTime();
                    return imgTime >= fiveMinutesAgo && !existingImageIds.has(img.id.toString());
                  })
                  .map((img: any) => {
                    const isVideo = !!(img.videoMetadata?.isVideo) || img.model === 'wan-2.5';
                    return {
                      id: img.id.toString(),
                      prompt: img.prompt,
                      // For videos: use thumbnail as preview; actual video URL stored in videoUrl
                      imageUrl: isVideo ? (img.videoMetadata?.thumbnailUrl || '') : img.imageUrl,
                      videoUrl: isVideo ? img.imageUrl : undefined,
                      isVideo,
                      model: img.model,
                      timestamp: new Date(img.createdAt).getTime(),
                      loading: false,
                    };
                  });

                // Combine new images with restored images (new first)
                const combinedImages = [...recentNewImages, ...restoredImages].slice(0, MAX_FEED_SIZE);
                setGeneratedImages(combinedImages);
              } else {
                setGeneratedImages(restoredImages);
              }
            } else {
              setGeneratedImages(restoredImages);
            }
          }
        }
      } catch (err) {
        console.error('Failed to restore legacy scanner session:', err);
      }
    };

    restoreSession();
  }, [user]);

  // Persistent generation tracking — polls DB every 4s to restore loading placeholders
  // after page refresh and detect completion/failure of pre-session jobs.
  // Only adds placeholders for jobs created BEFORE this session (pre-session jobs),
  // so in-session generations tracked by handleGenerate don't get duplicate placeholders.
  useEffect(() => {
    if (!user) return

    const syncJobs = async () => {
      try {
        const res = await fetch('/api/prompting-studio/jobs')
        if (!res.ok) return
        const { jobs } = await res.json()

        for (const job of jobs) {
          const jobFeedId = `job-${job.id}`
          const jobCreatedAt = new Date(job.createdAt).getTime()
          // 2-second buffer: only treat as pre-session if created clearly before this session
          const isPreSessionJob = jobCreatedAt < sessionStartRef.current - 2000

          if ((job.status === 'processing' || job.status === 'queued') && !syncedJobIdsRef.current.has(job.id) && isPreSessionJob) {
            // Pre-session in-flight job — add a loading placeholder
            syncedJobIdsRef.current.add(job.id)
            setGeneratedImages(prev => {
              if (prev.some(img => img.id === jobFeedId)) return prev
              const placeholder: GeneratedImage = {
                id: jobFeedId,
                prompt: job.prompt || '(resuming generation...)',
                imageUrl: '',
                model: job.modelId || model,
                timestamp: jobCreatedAt,
                loading: true,
              }
              return [placeholder, ...prev].slice(0, MAX_FEED_SIZE)
            })
            setGenerationQueue(prev => prev + 1)
          } else if (job.status === 'completed' && job.resultUrl && syncedJobIdsRef.current.has(job.id)) {
            // Pre-session job completed — replace placeholder with image
            syncedJobIdsRef.current.delete(job.id)
            setGeneratedImages(prev =>
              prev.map(img =>
                img.id === jobFeedId
                  ? { ...img, imageUrl: job.resultUrl, loading: false, failed: false }
                  : img
              )
            )
            setGenerationQueue(prev => Math.max(0, prev - 1))
          } else if (job.status === 'failed' && syncedJobIdsRef.current.has(job.id)) {
            // Pre-session job failed — show red failed state
            syncedJobIdsRef.current.delete(job.id)
            setGeneratedImages(prev =>
              prev.map(img =>
                img.id === jobFeedId
                  ? { ...img, loading: false, failed: true }
                  : img
              )
            )
            setGenerationQueue(prev => Math.max(0, prev - 1))
          }
        }
      } catch (err) {
        console.error('syncJobs error:', err)
      }
    }

    syncJobs()
    const interval = setInterval(syncJobs, 4000)
    return () => clearInterval(interval)
  }, [user])

  // Trim reference images when switching to a model with a lower limit
  useEffect(() => {
    const maxImages = getMaxReferenceImages();
    // Trim uploaded files first
    if (referenceImages.length > maxImages) {
      setReferenceImages(prev => prev.slice(0, maxImages));
      setReferencePreviewUrls(prev => prev.slice(0, maxImages));
      setSavedModelUrls([]);
      setGreyedOutUrls([]);
    } else {
      // Trim saved model URLs to fill remaining slots
      const remaining = maxImages - referenceImages.length;
      if (savedModelUrls.length > remaining) {
        setGreyedOutUrls(prev => [...savedModelUrls.slice(remaining), ...prev]);
        setSavedModelUrls(prev => prev.slice(0, remaining));
      }
    }
  }, [model]);

  const getTicketCost = () => {
    // NanoBanana Pro & Pro Scanner v3: 5 tickets for 2K, 10 tickets for 4K
    if (model === 'nano-banana-pro' || model === 'pro-scanner-v3') {
      return quality === '4k' ? 10 : 5;
    }
    // NanoBanana Cluster & SeeDream: 2 tickets
    if (model === 'nano-banana-cluster' || model === 'seedream-4.5') {
      return 2;
    }
    // Flash Scanner v2.5 & FLUX 2: 1 ticket
    return 1;
  };

  const handleReferenceUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    const maxImages = getMaxReferenceImages();
    const remainingSlots = maxImages - referenceImages.length;

    if (remainingSlots <= 0) {
      alert(`Maximum ${maxImages} reference images allowed for ${modelConfig?.name || 'this model'}.`);
      return;
    }

    // Only take files that fit within the limit
    const filesToAdd = files.slice(0, remainingSlots);
    const newPreviews = filesToAdd.map(file => URL.createObjectURL(file));

    setReferencePreviewUrls(prev => [...prev, ...newPreviews]);
    setReferenceImages(prev => [...prev, ...filesToAdd]);

    // Warn user if some files were not added
    if (files.length > filesToAdd.length) {
      alert(`Only ${filesToAdd.length} of ${files.length} images added. Maximum ${maxImages} reference images allowed for ${modelConfig?.name || 'this model'}.`);
    }
  };

  const removeReferenceImage = (index: number) => {
    setReferencePreviewUrls(prev => prev.filter((_, i) => i !== index));
    setReferenceImages(prev => prev.filter((_, i) => i !== index));
  };

  const handleLoadSavedModel = (savedModel: { referenceImageUrls: string[] }) => {
    const maxImages = getMaxReferenceImages();
    const usedSlots = referenceImages.length;
    const available = Math.max(0, maxImages - usedSlots);
    const active = savedModel.referenceImageUrls.slice(0, available);
    const overflow = savedModel.referenceImageUrls.slice(available);
    setSavedModelUrls(prev => {
      const combined = [...prev, ...active];
      return combined.slice(0, available);
    });
    setGreyedOutUrls(prev => [...prev, ...overflow]);
  };

  const handleGeneratePrompt = async () => {
    // Check cooldown for restricted models
    if (promptModel !== 'gemini-3-flash') {
      const lastUse = lastPromptGenTime[promptModel] || 0;
      const timeSince = (Date.now() - lastUse) / 1000;
      const cooldownSeconds = 10;

      if (timeSince < cooldownSeconds) {
        const remaining = Math.ceil(cooldownSeconds - timeSince);
        setPromptCooldown(remaining);
        return;
      }
    }

    const name = celebrityName.trim() || 'a person';
    const style = enhancement.trim() || 'photorealistic portrait';

    try {
      const res = await fetch('/api/prompting-studio/generate-single', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          celebrity: name,
          baseStyle: style,
          model: model,
          promptModel: promptModel,
        })
      });

      const data = await res.json();
      if (data.success && data.prompt) {
        setPrompt(data.prompt);

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

  const handleGenerate = async () => {
    // Check if selected model is in maintenance
    const modelInMaintenance = (() => {
      // Map model IDs to maintenance fields
      const modelMap: Record<string, keyof AdminState> = {
        'nano-banana': 'legacyScanner_nanoBanana',
        'nano-banana-cluster': 'legacyScanner_nanoBanana', // Legacy scanner uses 'nano-banana-cluster'
        'nano-banana-pro': 'legacyScanner_nanoBananaPro',
        'seedream-4.5': 'legacyScanner_seedream',
        'flux-2': 'legacyScanner_flux2',
        'gemini-3-pro-image': 'legacyScanner_proScannerV3',
        'pro-scanner-v3': 'legacyScanner_proScannerV3',
        'gemini-2.5-flash-image': 'legacyScanner_flashScannerV25',
        'flash-scanner-v2.5': 'legacyScanner_flashScannerV25',
      };

      const maintenanceField = modelMap[model];
      if (maintenanceField && adminState[maintenanceField]) return true;

      // Fallback to OLD maintenance fields
      if (model === 'nano-banana-pro' && adminState.nanoBananaProMaintenance) return true;
      if (model === 'nano-banana' && adminState.nanoBananaMaintenance) return true;
      if (model === 'nano-banana-cluster' && adminState.nanoBananaMaintenance) return true;
      if (model === 'seedream-4.5' && adminState.seedreamMaintenance) return true;

      return false;
    })();

    if (modelInMaintenance) {
      alert('This model is currently under maintenance. Please select a different model.');
      return;
    }

    if (!prompt.trim()) {
      alert('Please enter a prompt');
      return;
    }

    // Check queue limit
    if (generationQueue >= MAX_QUEUE_SIZE) {
      alert(`Generation queue full (max ${MAX_QUEUE_SIZE}). Please wait for current scans to complete.`);
      return;
    }

    // Create unique generation ID(s)
    const isCluster = model === 'nano-banana-cluster';
    const generationId = `gen-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const generationId2: string | null = isCluster ? `gen-${Date.now() + 1}-${Math.random().toString(36).substr(2, 9)}-2` : null;

    // Add to active generations
    setActiveGenerations(prev => new Set(prev).add(generationId));
    setGenerationQueue(prev => prev + (isCluster ? 2 : 1)); // Cluster counts as 2

    // Add loading placeholder(s) to generated images (newest first, limit to 50)
    const placeholders: GeneratedImage[] = [
      { id: generationId, prompt, imageUrl: '', model, timestamp: Date.now(), loading: true },
    ];
    if (isCluster && generationId2) {
      placeholders.push({ id: generationId2, prompt, imageUrl: '', model, timestamp: Date.now() + 1, loading: true });
    }
    setGeneratedImages(prev => [...placeholders, ...prev].slice(0, MAX_FEED_SIZE));

    try {
      // Upload reference images first, then combine with pre-uploaded model URLs
      let referenceUrls: string[] = [...savedModelUrls];
      if (referenceImages.length > 0) {
        for (const file of referenceImages) {
          try {
            const formData = new FormData();
            formData.append('file', file);
            const res = await fetch('/api/upload-reference', {
              method: 'POST',
              body: formData
            });
            const data = await res.json();
            if (data.url) referenceUrls.push(data.url);
          } catch (err) {
            console.error('Failed to upload reference:', err);
          }
        }
      }
      referenceUrls = referenceUrls.slice(0, getMaxReferenceImages());

      // Generate image
      const requestBody: any = {
        userId: user.id,
        prompt: prompt,
        model: model,
        quality: quality,
        aspectRatio: aspectRatio,
        referenceImages: referenceUrls,
      };

      if (celebrityName.trim()) {
        requestBody.celebrityName = celebrityName;
      }
      if (enhancement.trim()) {
        requestBody.enhancement = enhancement;
      }

      const res = await fetch('/api/prompting-studio/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
      });

      const data = await res.json();

      if (data.success && data.imageUrl) {
        // Replace loading placeholder(s) with actual image(s)
        if (isCluster && data.images && data.images.length > 1 && generationId2) {
          // Cluster returned 2 images — resolve both placeholders
          setGeneratedImages(prev =>
            prev.map(img => {
              if (img.id === generationId) return { ...img, imageUrl: data.images[0].url, loading: false, failed: false };
              if (img.id === generationId2) return { ...img, imageUrl: data.images[1].url, loading: false, failed: false };
              return img;
            }).slice(0, MAX_FEED_SIZE)
          );
        } else {
          // Single image (or cluster returned only 1)
          setGeneratedImages(prev =>
            prev.map(img =>
              img.id === generationId
                ? { ...img, imageUrl: data.imageUrl, loading: false, failed: false }
                : img
            ).slice(0, MAX_FEED_SIZE)
          );
          // Remove unused second placeholder if cluster only returned 1 image
          if (isCluster && generationId2) {
            setGeneratedImages(prev => prev.filter(img => img.id !== generationId2));
          }
        }

        // Refresh ticket balance
        const ticketRes = await fetch(`/api/user/tickets?userId=${user.id}`);
        const ticketData = await ticketRes.json();
        if (ticketData.success) {
          setTicketBalance(ticketData.balance);
        }
      } else {
        // Mark loading placeholder(s) as failed (red state)
        setGeneratedImages(prev =>
          prev.map(img =>
            (img.id === generationId || (isCluster && img.id === generationId2))
              ? { ...img, loading: false, failed: true }
              : img
          )
        );

        if (data.isSensitiveContent) {
          alert('Sensitive content detected. Your tickets have been refunded.');
        } else {
          alert(data.error || 'Generation failed');
        }
      }
    } catch (err) {
      console.error('Generation error:', err);
      // Mark as failed — could be network error or page refresh interrupting fetch
      setGeneratedImages(prev =>
        prev.map(img =>
          (img.id === generationId || (isCluster && img.id === generationId2))
            ? { ...img, loading: false, failed: true }
            : img
        )
      );
    } finally {
      // Remove from active generations
      setActiveGenerations(prev => {
        const newSet = new Set(prev);
        newSet.delete(generationId);
        return newSet;
      });
      setGenerationQueue(prev => Math.max(0, prev - (isCluster ? 2 : 1))); // Cluster counts as 2
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#050810] flex items-center justify-center">
        <div className="text-cyan-400 text-xl font-mono">Loading...</div>
      </div>
    );
  }

  // Check if user is admin
  const isAdmin = user?.email === "dirtysecretai@gmail.com"

  // Show global maintenance page to non-admins only
  // Show maintenance page to non-admins if global maintenance OR scanner-specific maintenance is enabled
  if ((adminState.isMaintenanceMode || adminState.legacyScannerMaintenance) && !isAdmin) {
    return (
      <div className="min-h-screen bg-[#050810] flex items-center justify-center p-6">
        <div className="text-center p-12 rounded-2xl border-2 border-yellow-500/30 bg-yellow-500/5 backdrop-blur-sm max-w-md">
          <AlertTriangle className="mx-auto text-yellow-500 mb-4 animate-pulse" size={64} />
          <h1 className="text-2xl font-black text-yellow-400 mb-3">MAINTENANCE MODE</h1>
          <p className="text-slate-400 text-sm">
            {adminState.isMaintenanceMode
              ? 'AI Design Studio is temporarily offline for maintenance. We\'ll be back soon!'
              : 'The Legacy Scanner is temporarily offline for maintenance. Please try another scanner.'}
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#050810] text-white">
      {/* Background */}
      <div className="fixed inset-0 bg-[linear-gradient(rgba(0,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(0,255,255,0.02)_1px,transparent_1px)] bg-[size:40px_40px] pointer-events-none" />

      {/* Header */}
          <div className="relative z-10 border-b border-cyan-500/30 bg-slate-900/50 backdrop-blur-sm">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/dashboard">
              <Button className="bg-slate-800 hover:bg-slate-700 border border-slate-600 text-slate-300 h-9 px-3">
                <ArrowLeft size={16} className="mr-1" />
                Back
              </Button>
            </Link>
            <div className="flex items-center gap-2">
              <Scan className="text-cyan-400" size={24} />
              <h1 className="text-xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-fuchsia-500">
                Legacy Scanner
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 text-yellow-400 font-bold">
              <Ticket size={18} />
              {ticketBalance} tickets
            </div>
            <Link href="/dashboard">
              <Button className="bg-slate-700 hover:bg-slate-600 h-9 text-sm">
                Dashboard
              </Button>
            </Link>
          </div>
        </div>
      </div>

      <div className="relative z-10 max-w-6xl mx-auto px-4 py-6">
        <div className="grid lg:grid-cols-2 gap-6">
          {/* Scanner Panel */}
          <div className="p-6 rounded-2xl border-2 border-cyan-500/30 bg-slate-900/80 backdrop-blur-sm">
            <h2 className="text-lg font-bold text-cyan-400 mb-4 flex items-center gap-2">
              <Scan size={20} />
              Scanner Controls
            </h2>

            {/* Model Selector - Enhanced Design */}
            <div className="mb-4">
              <label className="text-xs font-bold text-cyan-400 mb-2 block uppercase tracking-wider">AI Model</label>
              <div className="relative">
                <button
                  onClick={() => setShowModelSelector(!showModelSelector)}
                  className={`w-full p-3 rounded-xl text-left flex items-center justify-between transition-all ${
                    isModelInMaintenance(model)
                      ? 'border-2 border-yellow-500/50 bg-yellow-500/10 hover:shadow-lg hover:shadow-yellow-500/20'
                      : modelConfig?.color === 'cyan' || modelConfig?.color === 'blue'
                      ? 'border-2 border-cyan-500/30 bg-cyan-500/10 hover:shadow-lg hover:shadow-cyan-500/50'
                      : 'border-2 border-fuchsia-500/30 bg-fuchsia-500/10 hover:shadow-lg hover:shadow-fuchsia-500/50'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <div className={`p-1.5 rounded-lg ${
                      isModelInMaintenance(model)
                        ? 'bg-yellow-500/20'
                        : modelConfig?.color === 'cyan' || modelConfig?.color === 'blue'
                        ? 'bg-cyan-500/20'
                        : 'bg-fuchsia-500/20'
                    }`}>
                      <span className="text-lg">{modelConfig?.icon || '⚡'}</span>
                    </div>
                    <div>
                      <div className={`font-bold text-sm flex items-center gap-2 ${
                        isModelInMaintenance(model)
                          ? 'text-yellow-400'
                          : modelConfig?.color === 'cyan' || modelConfig?.color === 'blue'
                          ? 'text-cyan-400'
                          : 'text-fuchsia-400'
                      }`}>
                        {modelConfig?.name || model}
                        {isModelInMaintenance(model) && (
                          <span className="text-[9px] px-2 py-0.5 rounded-full bg-yellow-500 text-black font-bold">
                            MAINTENANCE
                          </span>
                        )}
                      </div>
                      <div className="text-[10px] text-slate-400">
                        {isModelInMaintenance(model)
                          ? 'Model temporarily offline'
                          : `${modelConfig?.cost[quality] || 1} ticket${modelConfig?.cost[quality] > 1 ? 's' : ''}`
                        }
                      </div>
                    </div>
                  </div>
                  <ChevronDown size={18} className="text-slate-400" />
                </button>

                {showModelSelector && (
                  <div className="absolute top-full left-0 right-0 mt-2 bg-slate-900 border-2 border-cyan-500/50 rounded-xl shadow-2xl z-50 max-h-[400px] overflow-y-auto">
                    {allModels.map((m: any) => {
                      const inMaintenance = isModelInMaintenance(m.id);
                      const isGemini = m.color === 'cyan' || m.color === 'blue';
                      const borderColor = isGemini ? 'border-cyan-500' : 'border-fuchsia-500';
                      const bgColor = isGemini ? 'bg-cyan-500/10' : 'bg-fuchsia-500/10';
                      const textColor = isGemini ? 'text-cyan-400' : 'text-fuchsia-400';
                      const hoverGlow = isGemini ? 'hover:shadow-cyan-500/50' : 'hover:shadow-fuchsia-500/50';

                      return (
                        <button
                          key={m.id}
                          onClick={() => {
                            setModel(m.id);
                            setShowModelSelector(false);
                            if (NO_REFERENCE_MODELS.includes(m.id)) {
                              setReferenceImages([]);
                              setReferencePreviewUrls([]);
                            }
                          }}
                          className={`w-full p-4 text-left border-b border-slate-800 last:border-b-0 transition-all ${
                            inMaintenance
                              ? 'bg-yellow-500/10 hover:bg-yellow-500/20'
                              : model === m.id
                              ? `${bgColor} border-l-4 ${borderColor}`
                              : `hover:${bgColor} ${hoverGlow} hover:shadow-lg`
                          }`}
                        >
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-lg">{m.icon}</span>
                              <span className={`font-bold text-sm ${
                                inMaintenance ? 'text-yellow-400' : textColor
                              }`}>
                                {m.name}
                              </span>
                              {/* Badges */}
                              {!inMaintenance && m.badges.slice(0, 2).map((badge: string, idx: number) => (
                                <span
                                  key={idx}
                                  className={`text-[9px] px-2 py-0.5 rounded-full ${m.badgeColors[idx]} text-white font-bold`}
                                >
                                  {badge}
                                </span>
                              ))}
                              {inMaintenance && (
                                <span className="text-[9px] px-2 py-0.5 rounded-full bg-yellow-500 text-black font-bold">
                                  MAINTENANCE
                                </span>
                              )}
                              {model === m.id && !inMaintenance && (
                                <span className="text-[9px] px-2 py-0.5 rounded-full bg-white text-black font-bold">
                                  SELECTED
                                </span>
                              )}
                            </div>
                            <span className={`text-xs font-bold px-2 py-1 rounded-lg ${
                              inMaintenance
                                ? 'bg-yellow-500/20 text-yellow-400'
                                : `${bgColor} ${textColor}`
                            }`}>
                              {m.cost[quality]} 🎫
                            </span>
                          </div>
                          <p className="text-xs text-slate-300 mb-1">
                            {inMaintenance ? 'Model temporarily offline' : m.note}
                          </p>
                          {m.warning && !inMaintenance && (
                            <div className="text-[10px] text-slate-400 mt-1">
                              {m.warning}
                            </div>
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* Name & Enhancement */}
            <div className="grid grid-cols-2 gap-3 mb-4">
              <div>
                <label className="text-xs text-slate-400 mb-1 block">Name (optional)</label>
                <Input
                  value={celebrityName}
                  onChange={(e) => setCelebrityName(e.target.value)}
                  placeholder="Subject name..."
                  className="bg-slate-950 border-slate-700 text-white text-sm h-9"
                />
              </div>
              <div>
                <label className="text-xs text-slate-400 mb-1 block">Enhancement (optional)</label>
                <Input
                  value={enhancement}
                  onChange={(e) => setEnhancement(e.target.value)}
                  placeholder="Style/enhancement..."
                  className="bg-slate-950 border-slate-700 text-white text-sm h-9"
                />
              </div>
            </div>

            {/* Prompt */}
            <div className="mb-4">
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs text-slate-400">Prompt</label>
                {/* AI Prompt Generation */}
                <div className="flex items-center gap-2">
                  {hasPromptStudioDev ? (
                    <>
                      {/* Prompt Model Selector - Dev Tier */}
                      <div className="relative">
                        <button
                          onClick={() => setShowPromptModelDropdown(!showPromptModelDropdown)}
                          className="px-3 py-1 bg-purple-600 text-white rounded font-bold text-xs flex items-center gap-1 h-7"
                        >
                          <span>
                            {promptModel === 'gemini-3-flash' ? 'Gemini 3 Flash' :
                             promptModel === 'gemini-2.0-flash-exp' ? 'Gemini 2 Exp' :
                             promptModel === 'gemini-3-pro' ? 'Gemini 3 Pro' :
                             'Gemini Exp 1206'}
                          </span>
                          <ChevronDown size={10} />
                        </button>
                        {showPromptModelDropdown && (
                          <div className="absolute z-50 top-full mt-1 right-0 w-40 bg-slate-800 border border-purple-500 rounded shadow-lg">
                            <button
                              onClick={() => {
                                setPromptModel('gemini-3-flash');
                                setShowPromptModelDropdown(false);
                              }}
                              className={`w-full px-3 py-2 text-left text-xs font-bold hover:bg-slate-700 transition-colors ${
                                promptModel === 'gemini-3-flash' ? 'bg-purple-600 text-white' : 'text-slate-300'
                              }`}
                            >
                              Gemini 3 Flash
                            </button>
                            <button
                              onClick={() => {
                                setPromptModel('gemini-2.0-flash-exp');
                                setShowPromptModelDropdown(false);
                              }}
                              className={`w-full px-3 py-2 text-left text-xs font-bold hover:bg-slate-700 transition-colors ${
                                promptModel === 'gemini-2.0-flash-exp' ? 'bg-purple-600 text-white' : 'text-slate-300'
                              }`}
                            >
                              Gemini 2 Exp
                            </button>
                            <button
                              onClick={() => {
                                setPromptModel('gemini-3-pro');
                                setShowPromptModelDropdown(false);
                              }}
                              className={`w-full px-3 py-2 text-left text-xs font-bold hover:bg-slate-700 transition-colors ${
                                promptModel === 'gemini-3-pro' ? 'bg-purple-600 text-white' : 'text-slate-300'
                              }`}
                            >
                              Gemini 3 Pro
                            </button>
                            <button
                              onClick={() => {
                                setPromptModel('gemini-exp-1206');
                                setShowPromptModelDropdown(false);
                              }}
                              className={`w-full px-3 py-2 text-left text-xs font-bold hover:bg-slate-700 transition-colors ${
                                promptModel === 'gemini-exp-1206' ? 'bg-purple-600 text-white' : 'text-slate-300'
                              }`}
                            >
                              Gemini Exp 1206
                            </button>
                          </div>
                        )}
                      </div>
                      <Button
                        onClick={handleGeneratePrompt}
                        disabled={promptCooldown > 0}
                        size="sm"
                        className="bg-purple-600 hover:bg-purple-500 disabled:opacity-50 h-7 text-xs px-2"
                        title={promptCooldown > 0 ? `Cooldown: ${promptCooldown}s` : ''}
                      >
                        <Wand2 size={12} className="mr-1" />
                        {promptCooldown > 0 ? `${promptCooldown}s` : 'Generate'}
                      </Button>
                    </>
                  ) : (
                    /* Free Tier - Locked AI Generation */
                    <Link href="/prompting-studio/subscribe" className="no-underline">
                      <Button
                        size="sm"
                        className="bg-slate-700 hover:bg-slate-600 h-7 text-xs px-2 cursor-pointer"
                        disabled
                      >
                        <Lock size={12} className="mr-1" />
                        AI Prompting (Upgrade)
                      </Button>
                    </Link>
                  )}
                </div>
              </div>
              <Textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="Enter your prompt..."
                className="bg-slate-950 border-slate-700 text-white text-sm min-h-[100px] resize-none"
              />
            </div>

            {/* Quality & Aspect Ratio */}
            <div className="grid grid-cols-2 gap-3 mb-4">
              {supportsQuality && (
                <div>
                  <label className="text-xs text-slate-400 mb-1 block">Quality</label>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setQuality('2k')}
                      className={`flex-1 py-2 rounded text-xs font-bold ${quality === '2k' ? 'bg-cyan-600 text-white' : 'bg-slate-800 text-slate-400'}`}
                    >
                      2K ({modelConfig?.cost['2k'] || 1} ticket{modelConfig?.cost['2k'] > 1 ? 's' : ''})
                    </button>
                    <button
                      onClick={() => setQuality('4k')}
                      className={`flex-1 py-2 rounded text-xs font-bold ${quality === '4k' ? 'bg-cyan-600 text-white' : 'bg-slate-800 text-slate-400'}`}
                    >
                      4K ({modelConfig?.cost['4k'] || 1} ticket{modelConfig?.cost['4k'] > 1 ? 's' : ''})
                    </button>
                  </div>
                </div>
              )}
              <div>
                <label className="text-xs text-slate-400 mb-1 block">Aspect Ratio</label>
                <div className="flex gap-1">
                  {(['1:1', '4:5', '9:16', '16:9'] as const).map((ratio) => (
                    <button
                      key={ratio}
                      onClick={() => setAspectRatio(ratio)}
                      className={`flex-1 py-2 rounded text-xs font-bold ${aspectRatio === ratio ? 'bg-cyan-600 text-white' : 'bg-slate-800 text-slate-400'}`}
                    >
                      {ratio}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Reference Images */}
            {supportsReferenceImages && (
              <div className="mb-4">
                <label className="text-xs text-slate-400 mb-2 block">
                  Reference Images ({referenceImages.length + savedModelUrls.length}/{getMaxReferenceImages()})
                </label>

                {/* Saved Preset Picker — prominent dedicated row */}
                <div className="mb-3 p-2.5 rounded-lg border border-fuchsia-500/20 bg-fuchsia-500/5">
                  <p className="text-[10px] text-fuchsia-400/70 font-medium mb-1.5 uppercase tracking-wide">Load a saved preset</p>
                  <SavedModelPicker onSelect={handleLoadSavedModel} disabled={isLoadingModel} />
                  {isLoadingModel && (
                    <div className="flex items-center gap-2 text-xs text-fuchsia-400 mt-2">
                      <div className="w-3 h-3 border border-fuchsia-500/30 border-t-fuchsia-500 rounded-full animate-spin" />
                      Loading model images...
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  {/* Upload button */}
                  {referenceImages.length + savedModelUrls.length < getMaxReferenceImages() && (
                    <label className="flex items-center gap-2 px-3 py-2 bg-slate-800 hover:bg-slate-700 rounded cursor-pointer text-xs text-slate-300">
                      <Upload size={14} />
                      Upload
                      <input
                        type="file"
                        multiple
                        accept="image/*"
                        onChange={handleReferenceUpload}
                        className="hidden"
                      />
                    </label>
                  )}

                  {/* File upload previews */}
                  {referencePreviewUrls.map((url, idx) => (
                    <div key={`file-${idx}`} className="relative w-12 h-12 rounded border border-cyan-500/30 overflow-hidden group">
                      <img src={url} alt={`ref-${idx}`} className="w-full h-full object-cover" />
                      <button
                        onClick={() => removeReferenceImage(idx)}
                        className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center"
                      >
                        <X size={14} className="text-white" />
                      </button>
                    </div>
                  ))}

                  {/* Saved model URL previews */}
                  {savedModelUrls.map((url, idx) => (
                    <div key={`model-${idx}`} className="relative w-12 h-12 rounded border border-fuchsia-500/40 overflow-hidden group">
                      <img src={url} alt={`model-ref-${idx}`} className="w-full h-full object-cover" />
                      <button
                        onClick={() => setSavedModelUrls(prev => prev.filter((_, i) => i !== idx))}
                        className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center"
                      >
                        <X size={14} className="text-white" />
                      </button>
                    </div>
                  ))}
                </div>

                {/* Greyed-out overflow images */}
                {greyedOutUrls.length > 0 && (
                  <div className="mt-2">
                    <p className="text-[10px] text-slate-500 mb-1">Not used — exceeds {getMaxReferenceImages()} image limit:</p>
                    <div className="flex gap-2 flex-wrap">
                      {greyedOutUrls.map((url, idx) => (
                        <div key={`grey-${idx}`} className="relative w-12 h-12 rounded border border-slate-700 overflow-hidden opacity-40">
                          <img src={url} alt={`inactive-${idx}`} className="w-full h-full object-cover" />
                          <div className="absolute inset-0 bg-slate-900/50 flex items-end justify-center pb-0.5">
                            <span className="text-[7px] text-slate-300 font-bold uppercase">Off</span>
                          </div>
                          <button
                            onClick={() => setGreyedOutUrls(prev => prev.filter((_, i) => i !== idx))}
                            className="absolute top-0.5 right-0.5 bg-slate-600 hover:bg-slate-500 text-white rounded-full p-0.5"
                          >
                            <X size={10} />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Generate Button - Single button with queue tracking */}
            <Button
              onClick={handleGenerate}
              disabled={!prompt.trim() || generationQueue >= MAX_QUEUE_SIZE}
              className="w-full bg-gradient-to-r from-cyan-500 to-fuchsia-500 hover:from-cyan-400 hover:to-fuchsia-400 text-black font-bold h-12 text-sm disabled:opacity-50"
              title={generationQueue >= MAX_QUEUE_SIZE ? `Generation queue full (max ${MAX_QUEUE_SIZE})` : ''}
            >
              {generationQueue >= MAX_QUEUE_SIZE ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-black mr-2" />
                  Queue Full ({generationQueue}/{MAX_QUEUE_SIZE})
                </>
              ) : generationQueue > 0 ? (
                <>
                  <Zap size={16} className="mr-2" />
                  Generate ({getTicketCost()}🎫) - {generationQueue}/{MAX_QUEUE_SIZE} active
                </>
              ) : (
                <>
                  <Zap size={16} className="mr-2" />
                  Generate ({getTicketCost()}🎫)
                </>
              )}
            </Button>
          </div>

          {/* Generated Images */}
          <div className="p-6 rounded-2xl border-2 border-fuchsia-500/30 bg-slate-900/80 backdrop-blur-sm">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-fuchsia-400 flex items-center gap-2">
                <ImageIcon size={20} />
                Generated Images ({generatedImages.length})
              </h2>
              {generatedImages.length > 0 && (
                <Button
                  onClick={() => {
                    if (confirm(`Clear all ${generatedImages.length} generated image${generatedImages.length > 1 ? 's' : ''} from view? (They will reload on page refresh)`)) {
                      setGeneratedImages([]);
                    }
                  }}
                  variant="outline"
                  size="sm"
                  className="bg-red-600/20 hover:bg-red-600/40 border-red-500/50 text-red-400 hover:text-red-300 h-8 text-xs"
                >
                  <X size={14} className="mr-1" />
                  Clear View
                </Button>
              )}
            </div>

            {generatedImages.length === 0 ? (
              <div className="text-center py-12 text-slate-500">
                <ImageIcon size={48} className="mx-auto mb-3 opacity-50" />
                <p>No images generated yet</p>
                <p className="text-xs mt-1">Use the scanner controls to generate images</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3 max-h-[600px] overflow-y-auto">
                {generatedImages.map((img) => (
                  <div
                    key={img.id}
                    onClick={() => !img.loading && !img.failed && setSelectedImage(img)}
                    className={`rounded-lg border-2 overflow-hidden transition-all ${
                      img.loading
                        ? 'border-slate-700 cursor-default'
                        : img.failed
                        ? 'border-red-500/50 cursor-default'
                        : 'border-slate-700 cursor-pointer hover:border-fuchsia-400'
                    }`}
                  >
                    {img.loading ? (
                      <div className="w-full aspect-square bg-slate-800 flex items-center justify-center">
                        <div className="text-center">
                          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-cyan-400 mx-auto mb-3" />
                          <p className="text-cyan-400 text-sm font-bold">Generating...</p>
                        </div>
                      </div>
                    ) : img.failed ? (
                      <div className="w-full aspect-square bg-red-900/20 flex items-center justify-center">
                        <div className="text-center">
                          <X size={32} className="text-red-400 mx-auto mb-2" />
                          <p className="text-red-400 text-sm font-bold">Failed</p>
                          <p className="text-red-500/70 text-xs mt-1">Generation error</p>
                        </div>
                      </div>
                    ) : img.isVideo ? (
                      <div className="relative w-full aspect-square bg-slate-950">
                        {img.imageUrl ? (
                          <img
                            src={img.imageUrl}
                            alt="Video thumbnail"
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center bg-slate-900">
                            <div className="text-center text-slate-500">
                              <svg className="mx-auto mb-1" width="32" height="32" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
                              <p className="text-xs">Video</p>
                            </div>
                          </div>
                        )}
                        {/* Play button overlay */}
                        <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                          <div className="w-10 h-10 rounded-full bg-black/70 flex items-center justify-center">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="white"><path d="M8 5v14l11-7z"/></svg>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <img
                        src={img.imageUrl}
                        alt="Generated"
                        className="w-full aspect-square object-cover"
                      />
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Image Modal */}
      {selectedImage && (
        <div
          className="fixed inset-0 bg-black/95 z-50 flex flex-col"
          onClick={() => setSelectedImage(null)}
        >
          {/* Close button */}
          <button
            onClick={() => setSelectedImage(null)}
            className="absolute top-4 right-4 p-2 bg-black/50 hover:bg-slate-800 rounded-full text-white z-50"
          >
            <X size={24} />
          </button>

          {/* Image/Video Area - Takes remaining space */}
          <div className="flex-1 flex items-center justify-center p-4 min-h-0">
            {selectedImage.isVideo && selectedImage.videoUrl ? (
              <video
                src={selectedImage.videoUrl}
                controls
                autoPlay
                loop
                className="max-w-full max-h-full rounded-lg"
                onClick={(e) => e.stopPropagation()}
              />
            ) : (
              <img
                src={selectedImage.imageUrl}
                alt="Selected"
                className="max-w-full max-h-full object-contain rounded-lg cursor-pointer hover:opacity-90 transition-opacity"
                onClick={(e) => {
                  e.stopPropagation();
                  window.open(selectedImage.imageUrl, '_blank');
                }}
                title="Click to open full size in new tab"
              />
            )}
          </div>

          {/* Details Panel - Fixed at bottom */}
          <div
            className="flex-shrink-0 w-full bg-slate-900/95 border-t border-cyan-500/30 px-4 py-3"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="max-w-4xl mx-auto">
              {/* Prompt - Single line with truncation */}
              <div className="flex items-center gap-2 mb-2">
                <Wand2 className="text-cyan-400 flex-shrink-0" size={14} />
                <p className="text-white text-xs flex-1 truncate">{selectedImage.prompt}</p>
              </div>

              {/* Info row + Action Buttons - All in one row */}
              <div className="flex items-center gap-3 flex-wrap">
                {/* Info badges */}
                <div className="flex items-center gap-2 text-[10px] text-slate-400 flex-shrink-0">
                  <span className="px-1.5 py-0.5 rounded bg-cyan-500/20 text-cyan-400 font-mono">
                    {getModelConfig(selectedImage.model).name}
                  </span>
                  <span>{new Date(selectedImage.timestamp).toLocaleTimeString()}</span>
                </div>

                {/* Spacer */}
                <div className="flex-1" />

                {/* Action Buttons */}
                <div className="flex items-center gap-2">
                  <a
                    href={selectedImage.isVideo ? (selectedImage.videoUrl || selectedImage.imageUrl) : selectedImage.imageUrl}
                    download
                    onClick={(e) => e.stopPropagation()}
                    className="bg-cyan-500 hover:bg-cyan-400 text-black font-bold py-1.5 px-3 rounded-lg flex items-center gap-1.5 text-xs"
                  >
                    <Download size={12} />
                    Download
                  </a>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      // Load the prompt back into the scanner
                      setPrompt(selectedImage.prompt);
                      setModel(selectedImage.model);
                      setSelectedImage(null);
                      // Scroll to top
                      window.scrollTo({ top: 0, behavior: 'smooth' });
                    }}
                    className="bg-fuchsia-600 hover:bg-fuchsia-500 text-white font-bold py-1.5 px-3 rounded-lg flex items-center gap-1.5 text-xs"
                  >
                    <RotateCcw size={12} />
                    Rescan
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      navigator.clipboard.writeText(selectedImage.prompt);
                    }}
                    className="bg-purple-600 hover:bg-purple-500 text-white font-bold py-1.5 px-3 rounded-lg flex items-center gap-1.5 text-xs"
                    title="Copy prompt"
                  >
                    <Copy size={12} />
                    Copy
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
