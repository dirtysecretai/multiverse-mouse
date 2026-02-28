'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Play, Pause, Trash2, RefreshCw, Settings, AlertCircle, CheckCircle, Clock, Zap } from 'lucide-react';
import Link from 'next/link';
import { AI_MODELS } from '@/config/ai-models.config';

interface ModelLimit {
  id: number;
  modelId: string;
  modelType: 'image' | 'video';
  maxConcurrent: number;
  currentActive: number;
  updatedAt: string;
}

interface QueueItem {
  id: number;
  userId: number;
  modelId: string;
  modelType: string;
  prompt: string;
  status: string;
  priority: number;
  ticketCost: number;
  queuedAt: string;
  startedAt: string | null;
  completedAt: string | null;
  queuePosition: number | null;
  errorMessage: string | null;
}

interface QueueStats {
  totalQueued: number;
  totalProcessing: number;
  totalCompleted: number;
  totalFailed: number;
}

export default function AdminQueuePage() {
  const router = useRouter();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [password, setPassword] = useState('');
  const [limits, setLimits] = useState<ModelLimit[]>([]);
  const [queueItems, setQueueItems] = useState<QueueItem[]>([]);
  const [stats, setStats] = useState<QueueStats>({
    totalQueued: 0,
    totalProcessing: 0,
    totalCompleted: 0,
    totalFailed: 0
  });
  const [loading, setLoading] = useState(true);
  const [modelLimits, setModelLimits] = useState<Record<string, number>>({});
  const [tempLimits, setTempLimits] = useState<Record<string, number | string>>({});

  useEffect(() => {
    const authStatus = localStorage.getItem('multiverse-admin-auth');
    const savedPassword = sessionStorage.getItem('admin-password');
    if (authStatus === 'true' && savedPassword) {
      setIsAuthenticated(true);
      fetchData();
      const interval = setInterval(fetchData, 5000);
      setIsAuthLoading(false);
      return () => clearInterval(interval);
    }
    setIsAuthLoading(false);
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/admin/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });
      if (res.ok) {
        sessionStorage.setItem('admin-password', password);
        localStorage.setItem('multiverse-admin-auth', 'true');
        setIsAuthenticated(true);
        fetchData();
        const interval = setInterval(fetchData, 5000);
        return () => clearInterval(interval);
      } else {
        alert('Invalid password');
      }
    } catch {
      alert('Authentication failed');
    }
  };

  const resetStaleJobs = async () => {
    try {
      const res = await fetch('/api/admin/queue/reset-stale', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        alert(data.message);
        fetchData();
      } else {
        alert(data.error || 'Failed to reset stale jobs');
      }
    } catch {
      alert('Failed to reset stale jobs');
    }
  };

  const fetchData = async () => {
    try {
      const [limitsRes, queueRes, statsRes] = await Promise.all([
        fetch('/api/admin/queue/limits'),
        fetch('/api/admin/queue/items'),
        fetch('/api/admin/queue/stats')
      ]);

      if (limitsRes.ok) {
        const limitsData = await limitsRes.json();
        setLimits(limitsData.limits || []);

        // Build a map of modelId -> maxConcurrent
        const limitsMap: Record<string, number> = {};
        limitsData.limits?.forEach((limit: ModelLimit) => {
          limitsMap[limit.modelId] = limit.maxConcurrent;
        });
        setModelLimits(limitsMap);
      }

      if (queueRes.ok) {
        const queueData = await queueRes.json();
        setQueueItems(queueData.items || []);
      }

      if (statsRes.ok) {
        const statsData = await statsRes.json();
        setStats(statsData.stats || stats);
      }
    } catch (error) {
      console.error('Failed to fetch queue data:', error);
    } finally {
      setLoading(false);
    }
  };

  const saveLimit = async (modelId: string, modelType: 'image' | 'video') => {
    const inputValue = tempLimits[modelId];
    const maxConcurrent = typeof inputValue === 'string' ? parseInt(inputValue) : inputValue;

    if (maxConcurrent === undefined || isNaN(maxConcurrent) || maxConcurrent < 0 || maxConcurrent > 99) {
      alert('Please enter a valid number between 0 and 99');
      return;
    }

    // 0 means no limit, we'll use 999 internally
    const actualLimit = maxConcurrent === 0 ? 999 : maxConcurrent;

    try {
      // Check if limit exists
      const existingLimit = limits.find(l => l.modelId === modelId);

      let res;
      if (existingLimit) {
        // Update existing limit
        res = await fetch('/api/admin/queue/limits', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ modelId, maxConcurrent: actualLimit })
        });
      } else {
        // Create new limit
        res = await fetch('/api/admin/queue/limits', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ modelId, modelType, maxConcurrent: actualLimit })
        });
      }

      if (res.ok) {
        fetchData();
        setTempLimits(prev => ({ ...prev, [modelId]: '' }));
      } else {
        const data = await res.json();
        alert(data.error || 'Failed to save limit');
      }
    } catch (error) {
      console.error('Failed to save limit:', error);
      alert('Failed to save limit');
    }
  };


  if (isAuthLoading) {
    return (
      <div className="min-h-screen bg-[#050810] flex items-center justify-center">
        <div className="text-cyan-400 text-xl font-mono">Loading...</div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <div className="mb-8 text-center">
            <h1 className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-fuchsia-500 mb-2">
              QUEUE MANAGEMENT
            </h1>
            <p className="text-slate-500 text-sm">Authentication Required</p>
          </div>
          <form onSubmit={handleLogin} className="p-6 rounded-xl border border-slate-800 bg-slate-900/60 backdrop-blur-sm">
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter admin password"
              className="w-full p-3 rounded-lg bg-slate-950 border border-slate-700 text-white focus:border-cyan-500 focus:outline-none mb-4"
            />
            <Button type="submit" className="w-full bg-gradient-to-r from-cyan-500 to-fuchsia-500 hover:from-cyan-400 hover:to-fuchsia-400 text-black font-bold">
              ACCESS QUEUE MANAGEMENT
            </Button>
          </form>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#050810] flex items-center justify-center">
        <div className="text-cyan-400 text-xl font-mono">Loading queue data...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#050810] text-white">
      <div className="fixed inset-0 bg-[linear-gradient(rgba(0,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(0,255,255,0.02)_1px,transparent_1px)] bg-[size:40px_40px] pointer-events-none" />

      {/* Header */}
      <div className="relative z-10 border-b border-cyan-500/30 bg-slate-900/50 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/admin">
              <Button className="bg-slate-800 hover:bg-slate-700 border border-slate-600 text-slate-300">
                <ArrowLeft size={16} className="mr-1" />
                Back
              </Button>
            </Link>
            <div className="flex items-center gap-2">
              <Settings className="text-cyan-400" size={24} />
              <h1 className="text-xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-400">
                Queue & Concurrency Management
              </h1>
            </div>
          </div>
          <button
            onClick={resetStaleJobs}
            className="px-3 py-2 rounded-lg bg-orange-900/50 hover:bg-orange-800/60 border border-orange-500/40 text-orange-400 text-xs font-bold transition-all"
            title="Mark all processing jobs older than 30 minutes as failed"
          >
            Reset Stuck Jobs
          </button>
          <button
            onClick={fetchData}
            className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 transition-all"
            title="Refresh"
          >
            <RefreshCw size={18} className="text-cyan-400" />
          </button>
        </div>
      </div>

      <div className="relative z-10 max-w-7xl mx-auto p-6">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="p-4 rounded-xl border border-yellow-500/30 bg-yellow-500/5 backdrop-blur-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-slate-400 mb-1">Queued</p>
                <p className="text-2xl font-bold text-yellow-400">{stats.totalQueued}</p>
              </div>
              <Clock className="text-yellow-400" size={32} />
            </div>
          </div>

          <div className="p-4 rounded-xl border border-blue-500/30 bg-blue-500/5 backdrop-blur-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-slate-400 mb-1">Processing</p>
                <p className="text-2xl font-bold text-blue-400">{stats.totalProcessing}</p>
              </div>
              <Zap className="text-blue-400" size={32} />
            </div>
          </div>

          <div className="p-4 rounded-xl border border-green-500/30 bg-green-500/5 backdrop-blur-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-slate-400 mb-1">Completed</p>
                <p className="text-2xl font-bold text-green-400">{stats.totalCompleted}</p>
              </div>
              <CheckCircle className="text-green-400" size={32} />
            </div>
          </div>

          <div className="p-4 rounded-xl border border-red-500/30 bg-red-500/5 backdrop-blur-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-slate-400 mb-1">Failed</p>
                <p className="text-2xl font-bold text-red-400">{stats.totalFailed}</p>
              </div>
              <AlertCircle className="text-red-400" size={32} />
            </div>
          </div>
        </div>

        {/* Model Limits */}
        <div className="mb-6 p-6 rounded-xl border border-cyan-500/30 bg-slate-900/60 backdrop-blur-sm">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-cyan-400">Model Concurrency Limits</h2>
            <p className="text-xs text-slate-400">Set max concurrent generations per model</p>
          </div>

          <div className="space-y-6">
            {/* Image Models */}
            <div>
              <h3 className="text-sm font-bold text-purple-400 mb-3 flex items-center gap-2">
                <span className="px-2 py-1 rounded bg-purple-500/20 text-purple-300 text-xs">IMAGE MODELS</span>
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {AI_MODELS.filter(m => m.isAvailable).map((model) => {
                  const existingLimit = limits.find(l => l.modelId === model.id);
                  const currentLimit = existingLimit?.maxConcurrent;
                  const displayLimit = currentLimit === 999 ? 'No Limit' : currentLimit ? `${currentLimit}` : 'No Limit';

                  return (
                    <div
                      key={model.id}
                      className="p-4 rounded-lg border border-slate-700 bg-slate-800/50"
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex-1">
                          <h3 className="text-sm font-bold text-white">{model.displayName}</h3>
                          <p className="text-xs text-slate-400">{model.id}</p>
                          <p className="text-xs text-slate-500 mt-1">{model.ticketCost} tickets</p>
                        </div>
                        {existingLimit && (
                          <span className={`px-2 py-1 rounded text-xs font-bold ${
                            currentLimit !== 999 && existingLimit.currentActive >= existingLimit.maxConcurrent
                              ? 'bg-red-500/20 text-red-400'
                              : 'bg-green-500/20 text-green-400'
                          }`}>
                            {existingLimit.currentActive}/{displayLimit}
                          </span>
                        )}
                      </div>

                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-slate-400 whitespace-nowrap">Current:</span>
                          <span className="text-sm font-bold text-cyan-400">{displayLimit}</span>
                        </div>
                        <div className="flex gap-2">
                          <input
                            type="number"
                            min="0"
                            max="99"
                            value={tempLimits[model.id] ?? ''}
                            onChange={(e) => setTempLimits(prev => ({ ...prev, [model.id]: e.target.value }))}
                            placeholder="0-99 (0=no limit)"
                            className="flex-1 px-2 py-1.5 rounded bg-slate-950 border border-cyan-500/30 text-white text-sm focus:outline-none focus:ring-2 focus:ring-cyan-400"
                          />
                          <button
                            onClick={() => saveLimit(model.id, 'image')}
                            className="px-4 py-1.5 rounded bg-cyan-600 hover:bg-cyan-500 text-white text-sm font-bold"
                          >
                            Set
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Video Models */}
            <div>
              <h3 className="text-sm font-bold text-pink-400 mb-3 flex items-center gap-2">
                <span className="px-2 py-1 rounded bg-pink-500/20 text-pink-300 text-xs">VIDEO MODELS</span>
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {[
                  { id: 'wan-2.5', displayName: 'Wan 2.5', ticketCost: 10 },
                ].map((model) => {
                  const existingLimit = limits.find(l => l.modelId === model.id);
                  const currentLimit = existingLimit?.maxConcurrent;
                  const displayLimit = currentLimit === 999 ? 'No Limit' : currentLimit ? `${currentLimit}` : 'No Limit';

                  return (
                    <div
                      key={model.id}
                      className="p-4 rounded-lg border border-slate-700 bg-slate-800/50"
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex-1">
                          <h3 className="text-sm font-bold text-white">{model.displayName}</h3>
                          <p className="text-xs text-slate-400">{model.id}</p>
                          <p className="text-xs text-slate-500 mt-1">{model.ticketCost} tickets</p>
                        </div>
                        {existingLimit && (
                          <span className={`px-2 py-1 rounded text-xs font-bold ${
                            currentLimit !== 999 && existingLimit.currentActive >= existingLimit.maxConcurrent
                              ? 'bg-red-500/20 text-red-400'
                              : 'bg-green-500/20 text-green-400'
                          }`}>
                            {existingLimit.currentActive}/{displayLimit}
                          </span>
                        )}
                      </div>

                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-slate-400 whitespace-nowrap">Current:</span>
                          <span className="text-sm font-bold text-cyan-400">{displayLimit}</span>
                        </div>
                        <div className="flex gap-2">
                          <input
                            type="number"
                            min="0"
                            max="99"
                            value={tempLimits[model.id] ?? ''}
                            onChange={(e) => setTempLimits(prev => ({ ...prev, [model.id]: e.target.value }))}
                            placeholder="0-99 (0=no limit)"
                            className="flex-1 px-2 py-1.5 rounded bg-slate-950 border border-cyan-500/30 text-white text-sm focus:outline-none focus:ring-2 focus:ring-cyan-400"
                          />
                          <button
                            onClick={() => saveLimit(model.id, 'video')}
                            className="px-4 py-1.5 rounded bg-cyan-600 hover:bg-cyan-500 text-white text-sm font-bold"
                          >
                            Set
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* Model Queue Selection */}
        <div className="p-6 rounded-xl border border-purple-500/30 bg-slate-900/60 backdrop-blur-sm">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-purple-400">Generation Queues</h2>
            <p className="text-xs text-slate-400">Select a model to view its queue</p>
          </div>

          <div className="space-y-6">
            {/* Image Model Queues */}
            <div>
              <h3 className="text-sm font-bold text-purple-400 mb-3 flex items-center gap-2">
                <span className="px-2 py-1 rounded bg-purple-500/20 text-purple-300 text-xs">IMAGE MODEL QUEUES</span>
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {AI_MODELS.filter(m => m.isAvailable).map((model) => {
                  const modelQueue = queueItems.filter(item => item.modelId === model.id);
                  const queuedCount = modelQueue.filter(item => item.status === 'queued').length;
                  const processingCount = modelQueue.filter(item => item.status === 'processing').length;

                  return (
                    <Link key={model.id} href={`/admin/queue/${model.id}`}>
                      <button className="w-full p-4 rounded-lg border border-slate-700 bg-slate-800/50 hover:bg-slate-700/50 transition-all text-left">
                        <div className="flex items-center justify-between mb-2">
                          <h3 className="text-sm font-bold text-white">{model.displayName}</h3>
                          <div className="flex gap-1">
                            {queuedCount > 0 && (
                              <span className="px-2 py-1 rounded bg-yellow-500/20 text-yellow-400 text-xs font-bold">
                                {queuedCount} queued
                              </span>
                            )}
                            {processingCount > 0 && (
                              <span className="px-2 py-1 rounded bg-blue-500/20 text-blue-400 text-xs font-bold">
                                {processingCount} processing
                              </span>
                            )}
                          </div>
                        </div>
                        <p className="text-xs text-slate-400">{model.id}</p>
                        <p className="text-xs text-slate-500 mt-1">
                          Total in queue: {modelQueue.length}
                        </p>
                      </button>
                    </Link>
                  );
                })}
              </div>
            </div>

            {/* Video Model Queue */}
            <div>
              <h3 className="text-sm font-bold text-pink-400 mb-3 flex items-center gap-2">
                <span className="px-2 py-1 rounded bg-pink-500/20 text-pink-300 text-xs">VIDEO MODEL QUEUE</span>
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {[
                  { id: 'wan-2.5', displayName: 'Wan 2.5' },
                ].map((model) => {
                  const modelQueue = queueItems.filter(item => item.modelId === model.id);
                  const queuedCount = modelQueue.filter(item => item.status === 'queued').length;
                  const processingCount = modelQueue.filter(item => item.status === 'processing').length;

                  return (
                    <Link key={model.id} href={`/admin/queue/${model.id}`}>
                      <button className="w-full p-4 rounded-lg border border-slate-700 bg-slate-800/50 hover:bg-slate-700/50 transition-all text-left">
                        <div className="flex items-center justify-between mb-2">
                          <h3 className="text-sm font-bold text-white">{model.displayName}</h3>
                          <div className="flex gap-1">
                            {queuedCount > 0 && (
                              <span className="px-2 py-1 rounded bg-yellow-500/20 text-yellow-400 text-xs font-bold">
                                {queuedCount} queued
                              </span>
                            )}
                            {processingCount > 0 && (
                              <span className="px-2 py-1 rounded bg-blue-500/20 text-blue-400 text-xs font-bold">
                                {processingCount} processing
                              </span>
                            )}
                          </div>
                        </div>
                        <p className="text-xs text-slate-400">{model.id}</p>
                        <p className="text-xs text-slate-500 mt-1">
                          Total in queue: {modelQueue.length}
                        </p>
                      </button>
                    </Link>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
