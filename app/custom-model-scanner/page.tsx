'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Scan, Upload, X, Zap, ArrowLeft, Ticket, ChevronDown, Image as ImageIcon, Download, Copy, RotateCcw, Plus, Trash2, Package, AlertTriangle } from 'lucide-react';
import Link from 'next/link';

interface GeneratedImage {
  id: string;
  prompt: string;
  imageUrl: string;
  model: string;
  timestamp: number;
  loading?: boolean;
}

interface UserModel {
  id: number;
  name: string;
  referenceImageUrls: string[];
  createdAt: string;
}

interface AdminState {
  isMaintenanceMode: boolean;
}

// Only these 3 models are available
const AVAILABLE_MODELS = [
  {
    id: 'nano-banana-pro',
    name: 'NanoBanana Pro',
    icon: '🍌',
    color: 'fuchsia',
    cost: { '2k': 5, '4k': 10 }
  },
  {
    id: 'seedream-4.5',
    name: 'SeeDream 4.5',
    icon: '🌱',
    color: 'fuchsia',
    cost: { '2k': 2, '4k': 2 }
  },
  {
    id: 'pro-scanner-v3',
    name: 'Pro Scanner v3',
    icon: '⚡',
    color: 'cyan',
    cost: { '2k': 5, '4k': 10 }
  }
];

export default function CustomModelScanner() {
  const router = useRouter();

  // Admin auth guard
  const [isAdminAuthenticated, setIsAdminAuthenticated] = useState(false);
  const [isAdminLoading, setIsAdminLoading] = useState(true);
  const [adminPassword, setAdminPassword] = useState('');

  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [ticketBalance, setTicketBalance] = useState<number>(0);
  const [hasPromptStudioDev, setHasPromptStudioDev] = useState(false);
  const [adminState, setAdminState] = useState<AdminState>({
    isMaintenanceMode: false,
  });

  // Scanner state
  const [model, setModel] = useState('nano-banana-pro');
  const [prompt, setPrompt] = useState('');
  const [quality, setQuality] = useState<'2k' | '4k'>('2k');
  const [aspectRatio, setAspectRatio] = useState<'1:1' | '4:5' | '9:16' | '16:9'>('1:1');

  // User models
  const [userModels, setUserModels] = useState<UserModel[]>([]);
  const [selectedModelId, setSelectedModelId] = useState<number | null>(null);
  const [showModelManager, setShowModelManager] = useState(false);

  // Create new model state
  const [newModelName, setNewModelName] = useState('');
  const [newModelImages, setNewModelImages] = useState<File[]>([]);
  const [newModelPreviewUrls, setNewModelPreviewUrls] = useState<string[]>([]);
  const [isCreatingModel, setIsCreatingModel] = useState(false);

  // UI state
  const [showModelSelector, setShowModelSelector] = useState(false);
  const [generationQueue, setGenerationQueue] = useState(0);
  const [generatedImages, setGeneratedImages] = useState<GeneratedImage[]>([]);
  const [selectedImage, setSelectedImage] = useState<GeneratedImage | null>(null);

  const MAX_QUEUE_SIZE = 3;
  const MAX_FEED_SIZE = 50;

  const modelConfig = AVAILABLE_MODELS.find(m => m.id === model) || AVAILABLE_MODELS[0];
  const selectedUserModel = userModels.find(m => m.id === selectedModelId);

  // Admin auth check — runs once on mount
  useEffect(() => {
    const authStatus = localStorage.getItem('multiverse-admin-auth');
    const savedPassword = sessionStorage.getItem('admin-password');
    if (authStatus === 'true' && savedPassword) {
      setIsAdminAuthenticated(true);
    }
    setIsAdminLoading(false);
  }, []);

  const handleAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const response = await fetch('/api/admin/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: adminPassword })
      });
      if (response.ok) {
        sessionStorage.setItem('admin-password', adminPassword);
        localStorage.setItem('multiverse-admin-auth', 'true');
        setIsAdminAuthenticated(true);
      } else {
        alert('Invalid admin password');
      }
    } catch {
      alert('Authentication failed');
    }
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

          // Custom Model Scanner requires Dev Tier
          if (!subData.hasPromptStudioDev) {
            router.push('/prompting-studio/subscribe');
            return;
          }
        }

        // Fetch ticket balance
        const ticketRes = await fetch(`/api/user/tickets?userId=${data.user.id}`);
        const ticketData = await ticketRes.json();
        if (ticketData.success) {
          setTicketBalance(ticketData.balance);
        }

        // Fetch admin config
        const adminRes = await fetch('/api/admin/config');
        const adminData = await adminRes.json();
        if (adminRes.ok) {
          setAdminState({
            isMaintenanceMode: !!adminData.isMaintenanceMode,
          });
        }

        // Fetch user models
        await fetchUserModels();

        // Fetch recent images
        const imagesRes = await fetch('/api/my-images?limit=50');
        const imagesData = await imagesRes.json();
        if (imagesData.success && imagesData.images) {
          const recentImages: GeneratedImage[] = imagesData.images
            .filter((img: any) => ['nano-banana-pro', 'seedream-4.5', 'pro-scanner-v3'].includes(img.model))
            .map((img: any) => ({
              id: img.id.toString(),
              prompt: img.prompt,
              imageUrl: img.imageUrl,
              model: img.model,
              timestamp: new Date(img.createdAt).getTime(),
              loading: false,
            }));
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

  const fetchUserModels = async () => {
    try {
      const res = await fetch('/api/user/models');
      const data = await res.json();
      if (data.success) {
        setUserModels(data.models);
      }
    } catch (err) {
      console.error('Failed to fetch user models:', err);
    }
  };

  const handleNewModelImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    const remainingSlots = 8 - newModelImages.length;
    if (remainingSlots <= 0) {
      alert('Maximum 8 reference images allowed.');
      return;
    }

    const filesToAdd = files.slice(0, remainingSlots);
    const newPreviews = filesToAdd.map(file => URL.createObjectURL(file));

    setNewModelPreviewUrls(prev => [...prev, ...newPreviews]);
    setNewModelImages(prev => [...prev, ...filesToAdd]);

    if (files.length > filesToAdd.length) {
      alert(`Only ${filesToAdd.length} of ${files.length} images added. Maximum 8 reference images allowed.`);
    }
  };

  const removeNewModelImage = (index: number) => {
    setNewModelPreviewUrls(prev => prev.filter((_, i) => i !== index));
    setNewModelImages(prev => prev.filter((_, i) => i !== index));
  };

  const handleCreateModel = async () => {
    if (!newModelName.trim()) {
      alert('Please enter a model name');
      return;
    }

    if (newModelImages.length === 0) {
      alert('Please upload at least one reference image');
      return;
    }

    setIsCreatingModel(true);

    try {
      // Upload images
      const referenceUrls: string[] = [];
      for (const file of newModelImages) {
        const formData = new FormData();
        formData.append('file', file);
        const res = await fetch('/api/upload-reference', {
          method: 'POST',
          body: formData
        });
        const data = await res.json();
        if (data.url) referenceUrls.push(data.url);
      }

      // Create model
      const res = await fetch('/api/user/models', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newModelName,
          referenceImageUrls: referenceUrls
        })
      });

      const data = await res.json();
      if (data.success) {
        alert('Model created successfully!');
        await fetchUserModels();
        setNewModelName('');
        setNewModelImages([]);
        setNewModelPreviewUrls([]);
        setShowModelManager(false);
      } else {
        alert(data.error || 'Failed to create model');
      }
    } catch (err) {
      console.error('Error creating model:', err);
      alert('Failed to create model');
    } finally {
      setIsCreatingModel(false);
    }
  };

  const handleDeleteModel = async (modelId: number) => {
    if (!confirm('Delete this model? This cannot be undone.')) return;

    try {
      const res = await fetch(`/api/user/models?id=${modelId}`, {
        method: 'DELETE'
      });

      const data = await res.json();
      if (data.success) {
        if (selectedModelId === modelId) {
          setSelectedModelId(null);
        }
        await fetchUserModels();
      } else {
        alert(data.error || 'Failed to delete model');
      }
    } catch (err) {
      console.error('Error deleting model:', err);
      alert('Failed to delete model');
    }
  };

  const getTicketCost = () => {
    return modelConfig.cost[quality] || 1;
  };

  const handleGenerate = async () => {
    if (!prompt.trim()) {
      alert('Please enter a prompt');
      return;
    }

    if (!selectedUserModel) {
      alert('Please select a custom model first');
      return;
    }

    if (generationQueue >= MAX_QUEUE_SIZE) {
      alert(`Generation queue full (max ${MAX_QUEUE_SIZE}). Please wait for current scans to complete.`);
      return;
    }

    const generationId = `gen-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    setGenerationQueue(prev => prev + 1);

    const loadingPlaceholder: GeneratedImage = {
      id: generationId,
      prompt: prompt,
      imageUrl: '',
      model: model,
      timestamp: Date.now(),
      loading: true,
    };
    setGeneratedImages(prev => [loadingPlaceholder, ...prev].slice(0, MAX_FEED_SIZE));

    try {
      const requestBody: any = {
        userId: user.id,
        prompt: prompt,
        model: model,
        quality: quality,
        aspectRatio: aspectRatio,
        referenceImages: selectedUserModel.referenceImageUrls,
      };

      const res = await fetch('/api/prompting-studio/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
      });

      const data = await res.json();

      if (data.success && data.imageUrl) {
        setGeneratedImages(prev =>
          prev.map(img =>
            img.id === generationId
              ? { ...img, imageUrl: data.imageUrl, loading: false }
              : img
          ).slice(0, MAX_FEED_SIZE)
        );

        const ticketRes = await fetch(`/api/user/tickets?userId=${user.id}`);
        const ticketData = await ticketRes.json();
        if (ticketData.success) {
          setTicketBalance(ticketData.balance);
        }
      } else {
        setGeneratedImages(prev => prev.filter(img => img.id !== generationId));

        if (data.isSensitiveContent) {
          alert('Sensitive content detected. Your tickets have been refunded.');
        } else {
          alert(data.error || 'Generation failed');
        }
      }
    } catch (err) {
      console.error('Generation error:', err);
      setGeneratedImages(prev => prev.filter(img => img.id !== generationId));
    } finally {
      setGenerationQueue(prev => Math.max(0, prev - 1));
    }
  };

  if (isAdminLoading) {
    return (
      <div className="min-h-screen bg-[#050810] flex items-center justify-center">
        <div className="text-purple-400 text-xl font-mono">Loading...</div>
      </div>
    );
  }

  if (!isAdminAuthenticated) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <div className="mb-8 text-center">
            <h1 className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-violet-400 to-purple-500 mb-2">
              ADMIN ACCESS ONLY
            </h1>
            <p className="text-slate-500 text-sm">This page is restricted to administrators</p>
          </div>
          <form onSubmit={handleAdminLogin} className="p-6 rounded-xl border border-slate-800 bg-slate-900/60 backdrop-blur-sm">
            <input
              type="password"
              value={adminPassword}
              onChange={(e) => setAdminPassword(e.target.value)}
              placeholder="Enter admin password"
              className="w-full p-3 rounded-lg bg-slate-950 border border-slate-700 text-white focus:border-violet-500 focus:outline-none mb-4"
            />
            <Button type="submit" className="w-full bg-gradient-to-r from-violet-500 to-purple-500 hover:from-violet-400 hover:to-purple-400 text-white font-bold">
              ACCESS PAGE
            </Button>
          </form>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#050810] flex items-center justify-center">
        <div className="text-cyan-400 text-xl font-mono">Loading...</div>
      </div>
    );
  }

  const isAdmin = user?.email === "dirtysecretai@gmail.com";

  if (adminState.isMaintenanceMode && !isAdmin) {
    return (
      <div className="min-h-screen bg-[#050810] flex items-center justify-center p-6">
        <div className="text-center p-12 rounded-2xl border-2 border-yellow-500/30 bg-yellow-500/5 backdrop-blur-sm max-w-md">
          <AlertTriangle className="mx-auto text-yellow-500 mb-4 animate-pulse" size={64} />
          <h1 className="text-2xl font-black text-yellow-400 mb-3">MAINTENANCE MODE</h1>
          <p className="text-slate-400 text-sm">
            AI Design Studio is temporarily offline for maintenance. We'll be back soon!
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#050810] text-white">
      <div className="fixed inset-0 bg-[linear-gradient(rgba(0,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(0,255,255,0.02)_1px,transparent_1px)] bg-[size:40px_40px] pointer-events-none" />

      {/* Header */}
      <div className="relative z-10 border-b border-purple-500/30 bg-slate-900/50 backdrop-blur-sm">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/admin/prototype">
              <Button className="bg-slate-800 hover:bg-slate-700 border border-slate-600 text-slate-300 h-9 px-3">
                <ArrowLeft size={16} className="mr-1" />
                Back
              </Button>
            </Link>
            <div className="flex items-center gap-2">
              <Package className="text-purple-400" size={24} />
              <h1 className="text-xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-fuchsia-400">
                Custom Model Scanner
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 text-yellow-400 font-bold">
              <Ticket size={18} />
              {ticketBalance} tickets
            </div>
            <Link href="/admin/prototype">
              <Button className="bg-slate-700 hover:bg-slate-600 h-9 text-sm">
                Prototype Lab
              </Button>
            </Link>
          </div>
        </div>
      </div>

      <div className="relative z-10 max-w-6xl mx-auto px-4 py-6">
        <div className="grid lg:grid-cols-2 gap-6">
          {/* Scanner Panel */}
          <div className="p-6 rounded-2xl border-2 border-purple-500/30 bg-slate-900/80 backdrop-blur-sm">
            <h2 className="text-lg font-bold text-purple-400 mb-4 flex items-center gap-2">
              <Scan size={20} />
              Scanner Controls
            </h2>

            {/* Model Selector */}
            <div className="mb-4">
              <label className="text-xs font-bold text-purple-400 mb-2 block uppercase tracking-wider">AI Model</label>
              <div className="relative">
                <button
                  onClick={() => setShowModelSelector(!showModelSelector)}
                  className="w-full p-3 rounded-xl text-left flex items-center justify-between transition-all border-2 border-purple-500/30 bg-purple-500/10 hover:shadow-lg hover:shadow-purple-500/50"
                >
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 rounded-lg bg-purple-500/20">
                      <span className="text-lg">{modelConfig.icon}</span>
                    </div>
                    <div>
                      <div className="font-bold text-sm text-purple-400">
                        {modelConfig.name}
                      </div>
                      <div className="text-[10px] text-slate-400">
                        {modelConfig.cost[quality]} ticket{modelConfig.cost[quality] > 1 ? 's' : ''}
                      </div>
                    </div>
                  </div>
                  <ChevronDown size={18} className="text-slate-400" />
                </button>

                {showModelSelector && (
                  <div className="absolute top-full left-0 right-0 mt-2 bg-slate-900 border-2 border-purple-500/50 rounded-xl shadow-2xl z-50">
                    {AVAILABLE_MODELS.map((m) => (
                      <button
                        key={m.id}
                        onClick={() => {
                          setModel(m.id);
                          setShowModelSelector(false);
                        }}
                        className={`w-full p-4 text-left border-b border-slate-800 last:border-b-0 transition-all ${
                          model === m.id
                            ? 'bg-purple-500/10 border-l-4 border-purple-500'
                            : 'hover:bg-purple-500/10'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-lg">{m.icon}</span>
                          <span className="font-bold text-sm text-purple-400">{m.name}</span>
                          {model === m.id && (
                            <span className="text-[9px] px-2 py-0.5 rounded-full bg-white text-black font-bold ml-auto">
                              SELECTED
                            </span>
                          )}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Custom Model Selection */}
            <div className="mb-4">
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-bold text-purple-400 uppercase tracking-wider">Custom Model</label>
                <Button
                  onClick={() => setShowModelManager(!showModelManager)}
                  size="sm"
                  className="bg-purple-600 hover:bg-purple-500 h-7 text-xs px-2"
                >
                  <Plus size={12} className="mr-1" />
                  Manage Models
                </Button>
              </div>

              {userModels.length === 0 ? (
                <div className="p-4 rounded-lg border-2 border-dashed border-purple-500/30 bg-purple-500/5 text-center">
                  <Package className="mx-auto text-purple-400 mb-2" size={32} />
                  <p className="text-sm text-slate-400 mb-2">No custom models yet</p>
                  <p className="text-xs text-slate-500">Create a model to get started</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  {userModels.map((model) => (
                    <button
                      key={model.id}
                      onClick={() => setSelectedModelId(model.id)}
                      className={`p-3 rounded-lg border-2 transition-all text-left ${
                        selectedModelId === model.id
                          ? 'border-purple-500 bg-purple-500/20'
                          : 'border-slate-700 bg-slate-800 hover:border-purple-500/50'
                      }`}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <Package size={14} className="text-purple-400" />
                        <span className="text-xs font-bold text-white truncate">{model.name}</span>
                      </div>
                      <p className="text-[10px] text-slate-400">
                        {model.referenceImageUrls.length} image{model.referenceImageUrls.length !== 1 ? 's' : ''}
                      </p>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Prompt */}
            <div className="mb-4">
              <label className="text-xs text-slate-400 mb-1 block">Prompt</label>
              <Textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="Enter your prompt..."
                className="bg-slate-950 border-slate-700 text-white text-sm min-h-[100px] resize-none"
              />
            </div>

            {/* Quality & Aspect Ratio */}
            <div className="grid grid-cols-2 gap-3 mb-4">
              <div>
                <label className="text-xs text-slate-400 mb-1 block">Quality</label>
                <div className="flex gap-2">
                  <button
                    onClick={() => setQuality('2k')}
                    className={`flex-1 py-2 rounded text-xs font-bold ${quality === '2k' ? 'bg-purple-600 text-white' : 'bg-slate-800 text-slate-400'}`}
                  >
                    2K ({modelConfig.cost['2k']} 🎫)
                  </button>
                  <button
                    onClick={() => setQuality('4k')}
                    className={`flex-1 py-2 rounded text-xs font-bold ${quality === '4k' ? 'bg-purple-600 text-white' : 'bg-slate-800 text-slate-400'}`}
                  >
                    4K ({modelConfig.cost['4k']} 🎫)
                  </button>
                </div>
              </div>
              <div>
                <label className="text-xs text-slate-400 mb-1 block">Aspect Ratio</label>
                <div className="flex gap-1">
                  {(['1:1', '4:5', '9:16', '16:9'] as const).map((ratio) => (
                    <button
                      key={ratio}
                      onClick={() => setAspectRatio(ratio)}
                      className={`flex-1 py-2 rounded text-xs font-bold ${aspectRatio === ratio ? 'bg-purple-600 text-white' : 'bg-slate-800 text-slate-400'}`}
                    >
                      {ratio}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Generate Button */}
            <Button
              onClick={handleGenerate}
              disabled={!prompt.trim() || !selectedUserModel || generationQueue >= MAX_QUEUE_SIZE}
              className="w-full bg-gradient-to-r from-purple-500 to-fuchsia-500 hover:from-purple-400 hover:to-fuchsia-400 text-black font-bold h-12 text-sm disabled:opacity-50"
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
                    if (confirm(`Clear all ${generatedImages.length} generated image${generatedImages.length > 1 ? 's' : ''} from view?`)) {
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
                <p className="text-xs mt-1">Select a custom model and generate images</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3 max-h-[600px] overflow-y-auto">
                {generatedImages.map((img) => (
                  <div
                    key={img.id}
                    onClick={() => !img.loading && setSelectedImage(img)}
                    className={`rounded-lg border-2 border-slate-700 overflow-hidden transition-all ${
                      img.loading ? 'cursor-default' : 'cursor-pointer hover:border-fuchsia-400'
                    }`}
                  >
                    {img.loading ? (
                      <div className="w-full aspect-square bg-slate-800 flex items-center justify-center">
                        <div className="text-center">
                          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-400 mx-auto mb-3" />
                          <p className="text-purple-400 text-sm font-bold">Generating...</p>
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

      {/* Model Manager Modal */}
      {showModelManager && (
        <div
          className="fixed inset-0 bg-black/95 z-50 flex items-center justify-center p-4"
          onClick={() => setShowModelManager(false)}
        >
          <div
            className="bg-slate-900 rounded-2xl border-2 border-purple-500/30 p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-purple-400">Manage Custom Models</h2>
              <button onClick={() => setShowModelManager(false)}>
                <X className="text-slate-400 hover:text-white" size={24} />
              </button>
            </div>

            {/* Create New Model */}
            <div className="p-4 rounded-xl border-2 border-purple-500/30 bg-purple-500/5 mb-4">
              <h3 className="text-sm font-bold text-purple-400 mb-3">Create New Model</h3>

              <div className="mb-3">
                <label className="text-xs text-slate-400 mb-1 block">Model Name</label>
                <Input
                  value={newModelName}
                  onChange={(e) => setNewModelName(e.target.value)}
                  placeholder="My Custom Model"
                  className="bg-slate-950 border-slate-700 text-white text-sm h-9"
                />
              </div>

              <div className="mb-3">
                <label className="text-xs text-slate-400 mb-1 block">
                  Reference Images ({newModelImages.length}/8)
                </label>
                <div className="flex items-center gap-2 flex-wrap">
                  <label className="flex items-center gap-2 px-3 py-2 bg-slate-800 hover:bg-slate-700 rounded cursor-pointer text-xs text-slate-300">
                    <Upload size={14} />
                    Upload
                    <input
                      type="file"
                      multiple
                      accept="image/*"
                      onChange={handleNewModelImageUpload}
                      className="hidden"
                    />
                  </label>
                  {newModelPreviewUrls.map((url, idx) => (
                    <div key={idx} className="relative w-12 h-12 rounded border border-purple-500/30 overflow-hidden group">
                      <img src={url} alt={`ref-${idx}`} className="w-full h-full object-cover" />
                      <button
                        onClick={() => removeNewModelImage(idx)}
                        className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center"
                      >
                        <X size={14} className="text-white" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <Button
                onClick={handleCreateModel}
                disabled={isCreatingModel || !newModelName.trim() || newModelImages.length === 0}
                className="w-full bg-purple-600 hover:bg-purple-500 font-bold h-9 text-sm disabled:opacity-50"
              >
                {isCreatingModel ? 'Creating...' : 'Create Model'}
              </Button>
            </div>

            {/* Existing Models */}
            <div>
              <h3 className="text-sm font-bold text-fuchsia-400 mb-3">Your Models</h3>
              {userModels.length === 0 ? (
                <p className="text-sm text-slate-500 text-center py-4">No models created yet</p>
              ) : (
                <div className="space-y-2">
                  {userModels.map((model) => (
                    <div
                      key={model.id}
                      className="p-3 rounded-lg border border-slate-700 bg-slate-800 flex items-center justify-between"
                    >
                      <div>
                        <p className="text-sm font-bold text-white">{model.name}</p>
                        <p className="text-xs text-slate-400">
                          {model.referenceImageUrls.length} image{model.referenceImageUrls.length !== 1 ? 's' : ''}
                        </p>
                      </div>
                      <Button
                        onClick={() => handleDeleteModel(model.id)}
                        size="sm"
                        className="bg-red-600/20 hover:bg-red-600/40 border border-red-500/50 text-red-400 h-8 text-xs px-2"
                      >
                        <Trash2 size={14} />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Image Modal */}
      {selectedImage && (
        <div
          className="fixed inset-0 bg-black/95 z-50 flex flex-col"
          onClick={() => setSelectedImage(null)}
        >
          <button
            onClick={() => setSelectedImage(null)}
            className="absolute top-4 right-4 p-2 bg-black/50 hover:bg-slate-800 rounded-full text-white z-50"
          >
            <X size={24} />
          </button>

          <div className="flex-1 flex items-center justify-center p-4 min-h-0">
            <img
              src={selectedImage.imageUrl}
              alt="Selected"
              className="max-w-full max-h-full object-contain rounded-lg"
              onClick={(e) => e.stopPropagation()}
            />
          </div>

          <div
            className="flex-shrink-0 w-full bg-slate-900/95 border-t border-purple-500/30 px-4 py-3"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="max-w-4xl mx-auto">
              <div className="flex items-center gap-2 mb-2">
                <Scan className="text-purple-400 flex-shrink-0" size={14} />
                <p className="text-white text-xs flex-1 truncate">{selectedImage.prompt}</p>
              </div>

              <div className="flex items-center gap-3 flex-wrap">
                <div className="flex items-center gap-2 text-[10px] text-slate-400 flex-shrink-0">
                  <span className="px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-400 font-mono">
                    {AVAILABLE_MODELS.find(m => m.id === selectedImage.model)?.name || selectedImage.model}
                  </span>
                  <span>{new Date(selectedImage.timestamp).toLocaleTimeString()}</span>
                </div>

                <div className="flex-1" />

                <div className="flex items-center gap-2">
                  <a
                    href={selectedImage.imageUrl}
                    download
                    onClick={(e) => e.stopPropagation()}
                    className="bg-purple-500 hover:bg-purple-400 text-black font-bold py-1.5 px-3 rounded-lg flex items-center gap-1.5 text-xs"
                  >
                    <Download size={12} />
                    Download
                  </a>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setPrompt(selectedImage.prompt);
                      setModel(selectedImage.model);
                      setSelectedImage(null);
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
