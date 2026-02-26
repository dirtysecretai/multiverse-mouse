'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Sparkles, Scan, Layers, Video, Lock, ArrowRight, Image, Paintbrush } from 'lucide-react';
import Link from 'next/link';

export default function StudioSelection() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [hasDevTier, setHasDevTier] = useState(false);

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

        const subRes = await fetch('/api/user/subscription');
        const subData = await subRes.json();
        if (subData.success) {
          setHasDevTier(subData.hasPromptStudioDev);
        }
      } catch (err) {
        router.push('/login');
      } finally {
        setLoading(false);
      }
    };
    checkAuth();
  }, [router]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#050810] flex items-center justify-center">
        <div className="text-cyan-400 text-xl font-mono">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#050810] text-white relative overflow-hidden">
      {/* Background effects */}
      <div className="fixed inset-0 bg-[linear-gradient(rgba(0,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(0,255,255,0.02)_1px,transparent_1px)] bg-[size:40px_40px] pointer-events-none" />
      <div className="fixed top-20 left-20 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl" />
      <div className="fixed bottom-20 right-20 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl" />
      <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-fuchsia-500/5 rounded-full blur-3xl" />

      <div className="relative z-10 max-w-5xl mx-auto px-4 py-12">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="flex items-center justify-center gap-3 mb-4">
            <Sparkles className="text-cyan-400" size={40} />
            <h1 className="text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-fuchsia-400 to-purple-400">
              AI DESIGN STUDIO
            </h1>
          </div>
          <p className="text-slate-400">Select a tool to get started</p>

          {/* User info */}
          <div className="mt-4 inline-flex items-center gap-3 bg-slate-900/50 rounded-lg px-4 py-2 border border-slate-700/50">
            <div className="w-8 h-8 rounded-full bg-gradient-to-r from-cyan-500 to-fuchsia-500 flex items-center justify-center font-bold text-black text-sm">
              {user?.email?.[0]?.toUpperCase() || 'U'}
            </div>
            <span className="text-sm text-slate-300">{user?.email}</span>
            {hasDevTier ? (
              <span className="text-[10px] font-bold bg-gradient-to-r from-purple-500 to-cyan-500 text-white px-2 py-0.5 rounded-full">
                DEV TIER
              </span>
            ) : (
              <span className="text-[10px] font-medium bg-slate-700 text-slate-300 px-2 py-0.5 rounded-full">
                FREE TIER
              </span>
            )}
          </div>
        </div>

        {/* ── IMAGE SECTION ─────────────────────────────────────────── */}
        <div className="mb-10">
          <div className="flex items-center gap-2 mb-4">
            <Image className="text-cyan-400" size={20} />
            <h2 className="text-sm font-bold text-cyan-400 tracking-widest uppercase">Image</h2>
            <div className="flex-1 h-px bg-cyan-500/20" />
          </div>

          <div className="grid md:grid-cols-2 gap-5">
            {/* Main Scanner (Canvas Scanner) */}
            <div className="p-6 rounded-2xl border-2 border-cyan-500/30 bg-slate-900/80 backdrop-blur-sm hover:border-cyan-400/60 transition-all group relative">
              {!hasDevTier && (
                <div className="absolute inset-0 bg-slate-900/85 backdrop-blur-sm rounded-2xl flex items-center justify-center z-10">
                  <div className="text-center p-6">
                    <Lock className="text-slate-500 mx-auto mb-3" size={28} />
                    <p className="text-slate-400 text-sm mb-4">Dev Tier Required</p>
                    <Link href="/prompting-studio/upgrade">
                      <Button className="bg-gradient-to-r from-purple-600 to-cyan-600 hover:from-purple-500 hover:to-cyan-500 font-bold text-sm">
                        Upgrade to Dev Tier
                      </Button>
                    </Link>
                  </div>
                </div>
              )}
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-xl bg-cyan-500/20 flex items-center justify-center">
                  <Layers className="text-cyan-400" size={22} />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white">Main Scanner</h3>
                  <p className="text-xs text-slate-400">Multi-image canvas workspace</p>
                </div>
              </div>
              <p className="text-sm text-slate-400 mb-4">
                The primary scanner with up to 25 concurrent generations on an infinite pan/zoom canvas. Run multiple scanners simultaneously.
              </p>
              <div className="mb-5">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Models</p>
                <div className="flex flex-wrap gap-1.5">
                  {['NanoBanana Cluster', 'NanoBanana Pro', 'SeeDream 4.5', 'FLUX 2', 'Pro Scanner v3', 'Flash Scanner v2.5'].map(m => (
                    <span key={m} className="text-[10px] bg-cyan-500/10 text-cyan-300 border border-cyan-500/20 rounded px-2 py-0.5 font-medium">{m}</span>
                  ))}
                </div>
              </div>
              <Link href="/prompting-studio/canvas">
                <Button className="w-full bg-cyan-700 hover:bg-cyan-600 font-bold group-hover:shadow-lg group-hover:shadow-cyan-500/20 transition-all">
                  Open Main Scanner
                  <ArrowRight className="ml-2" size={15} />
                </Button>
              </Link>
            </div>

            {/* Legacy Scanner */}
            <div className="p-6 rounded-2xl border-2 border-slate-600/40 bg-slate-900/80 backdrop-blur-sm hover:border-slate-500/60 transition-all group">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-xl bg-slate-700/50 flex items-center justify-center">
                  <Scan className="text-slate-400" size={22} />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white">Legacy Scanner</h3>
                  <p className="text-xs text-slate-400">Classic single-image generation</p>
                </div>
              </div>
              <p className="text-sm text-slate-400 mb-4">
                The original scanner interface. Simple and focused — perfect for quick one-off generations with full model and reference image support.
              </p>
              <div className="mb-5">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Models</p>
                <div className="flex flex-wrap gap-1.5">
                  {['NanoBanana Cluster', 'NanoBanana Pro', 'SeeDream 4.5', 'FLUX 2', 'Pro Scanner v3', 'Flash Scanner v2.5'].map(m => (
                    <span key={m} className="text-[10px] bg-slate-700/60 text-slate-400 border border-slate-600/40 rounded px-2 py-0.5 font-medium">{m}</span>
                  ))}
                </div>
              </div>
              <Link href="/prompting-studio/legacy">
                <Button className="w-full bg-slate-700 hover:bg-slate-600 font-bold group-hover:shadow-lg group-hover:shadow-slate-500/10 transition-all">
                  Open Legacy Scanner
                  <ArrowRight className="ml-2" size={15} />
                </Button>
              </Link>
            </div>
          </div>
        </div>

        {/* ── VIDEO SECTION ─────────────────────────────────────────── */}
        <div className="mb-10">
          <div className="flex items-center gap-2 mb-4">
            <Video className="text-rose-400" size={20} />
            <h2 className="text-sm font-bold text-rose-400 tracking-widest uppercase">Video</h2>
            <div className="flex-1 h-px bg-rose-500/20" />
          </div>

          <div className="p-6 rounded-2xl border-2 border-rose-500/30 bg-slate-900/80 backdrop-blur-sm hover:border-rose-400/60 transition-all group">
            <div className="flex flex-col md:flex-row md:items-center gap-6">
              <div className="flex items-center gap-3 flex-shrink-0">
                <div className="w-10 h-10 rounded-xl bg-rose-500/20 flex items-center justify-center">
                  <Video className="text-rose-400" size={22} />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white">Video Scanner</h3>
                  <p className="text-xs text-slate-400">AI video generation</p>
                </div>
              </div>
              <p className="text-sm text-slate-400 flex-1">
                Generate high-quality AI videos with audio. Control duration, aspect ratio, and motion style for cinematic results.
              </p>
              <div className="flex-shrink-0">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Models</p>
                <div className="flex flex-wrap gap-1.5 mb-4 md:mb-0">
                  {['Kling 3.0'].map(m => (
                    <span key={m} className="text-[10px] bg-rose-500/10 text-rose-300 border border-rose-500/20 rounded px-2 py-0.5 font-medium">{m}</span>
                  ))}
                </div>
              </div>
            </div>
            <div className="mt-5 md:mt-4">
              <Link href="/video-scanner">
                <Button className="w-full md:w-auto bg-rose-700 hover:bg-rose-600 font-bold group-hover:shadow-lg group-hover:shadow-rose-500/20 transition-all">
                  Open Video Scanner
                  <ArrowRight className="ml-2" size={15} />
                </Button>
              </Link>
            </div>
          </div>
        </div>

        {/* ── AI DESIGN STUDIO SECTION ──────────────────────────────── */}
        <div className="mb-10">
          <div className="flex items-center gap-2 mb-4">
            <Sparkles className="text-fuchsia-400" size={20} />
            <h2 className="text-sm font-bold text-fuchsia-400 tracking-widest uppercase">AI Design Studio</h2>
            <div className="flex-1 h-px bg-fuchsia-500/20" />
          </div>

          <div className="grid md:grid-cols-2 gap-5">
            {/* Composition Canvas */}
            <div className="p-6 rounded-2xl border-2 border-fuchsia-500/30 bg-slate-900/80 backdrop-blur-sm hover:border-fuchsia-400/60 transition-all group relative">
              {!hasDevTier && (
                <div className="absolute inset-0 bg-slate-900/85 backdrop-blur-sm rounded-2xl flex items-center justify-center z-10">
                  <div className="text-center p-6">
                    <Lock className="text-slate-500 mx-auto mb-3" size={28} />
                    <p className="text-slate-400 text-sm mb-4">Dev Tier Required</p>
                    <Link href="/prompting-studio/upgrade">
                      <Button className="bg-gradient-to-r from-purple-600 to-cyan-600 hover:from-purple-500 hover:to-cyan-500 font-bold text-sm">
                        Upgrade to Dev Tier
                      </Button>
                    </Link>
                  </div>
                </div>
              )}
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-xl bg-fuchsia-500/20 flex items-center justify-center">
                  <Layers className="text-fuchsia-400" size={22} />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white">Composition Canvas</h3>
                  <p className="text-xs text-slate-400">Layered AI composition tool</p>
                </div>
              </div>
              <p className="text-sm text-slate-400 mb-4">
                Build multi-layer compositions using AI generation. Select areas to inpaint, composite images across layers, and export at full 4K resolution.
              </p>
              <div className="mb-5">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Models</p>
                <div className="flex flex-wrap gap-1.5">
                  {['NanoBanana Pro', 'Pro Scanner v3', 'SeeDream 4.5'].map(m => (
                    <span key={m} className="text-[10px] bg-fuchsia-500/10 text-fuchsia-300 border border-fuchsia-500/20 rounded px-2 py-0.5 font-medium">{m}</span>
                  ))}
                </div>
              </div>
              <Link href="/composition-canvas">
                <Button className="w-full bg-fuchsia-700 hover:bg-fuchsia-600 font-bold group-hover:shadow-lg group-hover:shadow-fuchsia-500/20 transition-all">
                  Open Composition Canvas
                  <ArrowRight className="ml-2" size={15} />
                </Button>
              </Link>
            </div>

            {/* Scanner Canvas (AI Canvas) */}
            <div className="p-6 rounded-2xl border-2 border-purple-500/30 bg-slate-900/80 backdrop-blur-sm hover:border-purple-400/60 transition-all group relative">
              {!hasDevTier && (
                <div className="absolute inset-0 bg-slate-900/85 backdrop-blur-sm rounded-2xl flex items-center justify-center z-10">
                  <div className="text-center p-6">
                    <Lock className="text-slate-500 mx-auto mb-3" size={28} />
                    <p className="text-slate-400 text-sm mb-4">Dev Tier Required</p>
                    <Link href="/prompting-studio/upgrade">
                      <Button className="bg-gradient-to-r from-purple-600 to-cyan-600 hover:from-purple-500 hover:to-cyan-500 font-bold text-sm">
                        Upgrade to Dev Tier
                      </Button>
                    </Link>
                  </div>
                </div>
              )}
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-xl bg-purple-500/20 flex items-center justify-center">
                  <Paintbrush className="text-purple-400" size={22} />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white">Scanner Canvas</h3>
                  <p className="text-xs text-slate-400">AI drawing & painting canvas</p>
                </div>
              </div>
              <p className="text-sm text-slate-400 mb-4">
                Draw, paint, and erase on a 4K canvas with AI generation. Use your brushwork as reference input or fill selected areas with AI-generated content.
              </p>
              <div className="mb-5">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Models</p>
                <div className="flex flex-wrap gap-1.5">
                  {['NanoBanana Pro', 'SeeDream 4.5'].map(m => (
                    <span key={m} className="text-[10px] bg-purple-500/10 text-purple-300 border border-purple-500/20 rounded px-2 py-0.5 font-medium">{m}</span>
                  ))}
                </div>
              </div>
              <Link href="/ai-canvas">
                <Button className="w-full bg-purple-700 hover:bg-purple-600 font-bold group-hover:shadow-lg group-hover:shadow-purple-500/20 transition-all">
                  Open Scanner Canvas
                  <ArrowRight className="ml-2" size={15} />
                </Button>
              </Link>
            </div>
          </div>
        </div>

        {/* Back button */}
        <div className="text-center mt-6">
          <Link href="/dashboard">
            <Button className="bg-slate-800 hover:bg-slate-700 border border-slate-600 text-slate-300">
              Back to Dashboard
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
