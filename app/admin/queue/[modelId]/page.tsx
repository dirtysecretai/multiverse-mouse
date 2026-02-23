'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Trash2, RefreshCw, AlertCircle, CheckCircle, Clock, Zap } from 'lucide-react';
import Link from 'next/link';

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

export default function ModelQueuePage() {
  const router = useRouter();
  const params = useParams();
  const modelId = params.modelId as string;

  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [password, setPassword] = useState('');
  const [queueItems, setQueueItems] = useState<QueueItem[]>([]);
  const [stats, setStats] = useState<QueueStats>({
    totalQueued: 0,
    totalProcessing: 0,
    totalCompleted: 0,
    totalFailed: 0
  });
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<string>('all');

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
  }, [modelId]);

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

  const fetchData = async () => {
    try {
      const [queueRes, statsRes] = await Promise.all([
        fetch('/api/admin/queue/items'),
        fetch('/api/admin/queue/stats')
      ]);

      if (queueRes.ok) {
        const queueData = await queueRes.json();
        // Filter for this specific model
        const modelQueue = (queueData.items || []).filter(
          (item: QueueItem) => item.modelId === modelId
        );
        setQueueItems(modelQueue);

        // Calculate stats for this model
        const modelStats = {
          totalQueued: modelQueue.filter((item: QueueItem) => item.status === 'queued').length,
          totalProcessing: modelQueue.filter((item: QueueItem) => item.status === 'processing').length,
          totalCompleted: modelQueue.filter((item: QueueItem) => item.status === 'completed').length,
          totalFailed: modelQueue.filter((item: QueueItem) => item.status === 'failed').length,
        };
        setStats(modelStats);
      }
    } catch (error) {
      console.error('Failed to fetch queue data:', error);
    } finally {
      setLoading(false);
    }
  };

  const cancelQueueItem = async (id: number) => {
    if (!confirm('Cancel this generation?')) return;

    try {
      const res = await fetch(`/api/admin/queue/items/${id}`, {
        method: 'DELETE'
      });

      if (res.ok) {
        fetchData();
      } else {
        alert('Failed to cancel item');
      }
    } catch (error) {
      console.error('Failed to cancel item:', error);
      alert('Failed to cancel item');
    }
  };

  const retryFailed = async (id: number) => {
    try {
      const res = await fetch(`/api/admin/queue/items/${id}/retry`, {
        method: 'POST'
      });

      if (res.ok) {
        fetchData();
      } else {
        alert('Failed to retry item');
      }
    } catch (error) {
      console.error('Failed to retry item:', error);
      alert('Failed to retry item');
    }
  };

  const clearCompleted = async () => {
    if (!confirm('Clear all completed items from this model queue?')) return;

    try {
      const res = await fetch('/api/admin/queue/clear-completed', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ modelId })
      });

      if (res.ok) {
        fetchData();
      } else {
        alert('Failed to clear completed items');
      }
    } catch (error) {
      console.error('Failed to clear completed:', error);
      alert('Failed to clear completed items');
    }
  };

  const filteredQueue = queueItems.filter(item => {
    if (filterStatus !== 'all' && item.status !== filterStatus) return false;
    return true;
  });

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
              QUEUE: {modelId}
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
              ACCESS QUEUE
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
            <Link href="/admin/queue">
              <Button className="bg-slate-800 hover:bg-slate-700 border border-slate-600 text-slate-300">
                <ArrowLeft size={16} className="mr-1" />
                Back to Queue Management
              </Button>
            </Link>
            <div>
              <h1 className="text-xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-400">
                Queue: {modelId}
              </h1>
              <p className="text-xs text-slate-400 mt-1">Model-specific generation queue</p>
            </div>
          </div>
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

        {/* Queue Items */}
        <div className="p-6 rounded-xl border border-purple-500/30 bg-slate-900/60 backdrop-blur-sm">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-purple-400">Queue Items</h2>
            <div className="flex gap-2">
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="px-3 py-1 rounded bg-slate-800 border border-slate-600 text-white text-xs"
              >
                <option value="all">All Status</option>
                <option value="queued">Queued</option>
                <option value="processing">Processing</option>
                <option value="completed">Completed</option>
                <option value="failed">Failed</option>
              </select>

              <button
                onClick={clearCompleted}
                className="px-3 py-1 rounded bg-slate-700 hover:bg-slate-600 text-white text-xs"
              >
                Clear Completed
              </button>
            </div>
          </div>

          <div className="space-y-2 max-h-[600px] overflow-y-auto">
            {filteredQueue.length === 0 ? (
              <p className="text-center text-slate-500 py-8">No items in queue</p>
            ) : (
              filteredQueue.map((item) => (
                <div
                  key={item.id}
                  className="p-4 rounded-lg border border-slate-700 bg-slate-800/50"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <span className={`px-2 py-1 rounded text-xs font-bold ${
                          item.status === 'queued' ? 'bg-yellow-500/20 text-yellow-400' :
                          item.status === 'processing' ? 'bg-blue-500/20 text-blue-400' :
                          item.status === 'completed' ? 'bg-green-500/20 text-green-400' :
                          'bg-red-500/20 text-red-400'
                        }`}>
                          {item.status}
                        </span>
                        <span className="text-xs text-slate-400">User {item.userId}</span>
                        {item.queuePosition !== null && (
                          <>
                            <span className="text-xs text-slate-500">•</span>
                            <span className="text-xs text-cyan-400">Position #{item.queuePosition}</span>
                          </>
                        )}
                      </div>

                      <p className="text-sm text-white mb-2 line-clamp-2">{item.prompt}</p>

                      <div className="flex items-center gap-4 text-xs text-slate-500">
                        <span>Queued: {new Date(item.queuedAt).toLocaleString()}</span>
                        {item.startedAt && (
                          <span>Started: {new Date(item.startedAt).toLocaleString()}</span>
                        )}
                        {item.completedAt && (
                          <span>Completed: {new Date(item.completedAt).toLocaleString()}</span>
                        )}
                      </div>

                      {item.errorMessage && (
                        <p className="mt-2 text-xs text-red-400 p-2 rounded bg-red-500/10 border border-red-500/30">
                          {item.errorMessage}
                        </p>
                      )}
                    </div>

                    <div className="flex gap-2 ml-4">
                      {item.status === 'failed' && (
                        <button
                          onClick={() => retryFailed(item.id)}
                          className="p-2 rounded bg-blue-600/20 hover:bg-blue-600/40 text-blue-400"
                          title="Retry"
                        >
                          <RefreshCw size={16} />
                        </button>
                      )}
                      {(item.status === 'queued' || item.status === 'processing') && (
                        <button
                          onClick={() => cancelQueueItem(item.id)}
                          className="p-2 rounded bg-red-600/20 hover:bg-red-600/40 text-red-400"
                          title="Cancel"
                        >
                          <Trash2 size={16} />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
