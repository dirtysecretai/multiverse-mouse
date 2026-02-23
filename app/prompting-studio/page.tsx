'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { FlaskRound, Layers, Scan, ArrowRight, Lock } from 'lucide-react';
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

        // Check subscription status
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

      <div className="relative z-10 max-w-4xl mx-auto px-4 py-12">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="flex items-center justify-center gap-3 mb-4">
            <FlaskRound className="text-purple-400" size={40} />
            <h1 className="text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-cyan-400">
              PROMPT STUDIO
            </h1>
          </div>
          <p className="text-slate-400">Choose your scanner mode</p>

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

        {/* Scanner Options */}
        <div className="grid md:grid-cols-2 gap-6">
          {/* Legacy Scanner */}
          <div className="p-6 rounded-2xl border-2 border-cyan-500/30 bg-slate-900/80 backdrop-blur-sm hover:border-cyan-400/50 transition-all group">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-xl bg-cyan-500/20 flex items-center justify-center">
                <Scan className="text-cyan-400" size={28} />
              </div>
              <div>
                <h2 className="text-xl font-bold text-white">Legacy Scanner</h2>
                <p className="text-xs text-slate-400">Classic single-image generation</p>
              </div>
            </div>

            <p className="text-sm text-slate-400 mb-6">
              The original scanner interface. Simple, focused, and efficient for quick single-image generations.
            </p>

            <ul className="text-sm text-slate-400 space-y-2 mb-6">
              <li className="flex items-center gap-2">
                <span className="text-cyan-400">+</span> Simple interface
              </li>
              <li className="flex items-center gap-2">
                <span className="text-cyan-400">+</span> Quick generations
              </li>
              <li className="flex items-center gap-2">
                <span className="text-cyan-400">+</span> Reference image support
              </li>
              <li className="flex items-center gap-2 opacity-0">
                <span className="text-cyan-400">+</span> Spacer
              </li>
            </ul>

            <Link href="/prompting-studio/legacy">
              <Button className="w-full bg-cyan-600 hover:bg-cyan-500 font-bold group-hover:shadow-lg group-hover:shadow-cyan-500/20 transition-all">
                Open Legacy Scanner
                <ArrowRight className="ml-2" size={16} />
              </Button>
            </Link>
          </div>

          {/* Canvas Scanner */}
          <div className="p-6 rounded-2xl border-2 border-purple-500/30 bg-slate-900/80 backdrop-blur-sm hover:border-purple-400/50 transition-all group relative">
            {!hasDevTier && (
              <div className="absolute inset-0 bg-slate-900/80 backdrop-blur-sm rounded-2xl flex items-center justify-center z-10">
                <div className="text-center p-6">
                  <Lock className="text-slate-500 mx-auto mb-3" size={32} />
                  <p className="text-slate-400 mb-4">Dev Tier Required</p>
                  <Link href="/prompting-studio/upgrade">
                    <Button className="bg-gradient-to-r from-purple-600 to-cyan-600 hover:from-purple-500 hover:to-cyan-500 font-bold">
                      Upgrade to Dev Tier
                    </Button>
                  </Link>
                </div>
              </div>
            )}

            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-xl bg-purple-500/20 flex items-center justify-center">
                <Layers className="text-purple-400" size={28} />
              </div>
              <div>
                <h2 className="text-xl font-bold text-white">Canvas Scanner</h2>
                <p className="text-xs text-slate-400">Infinite canvas workspace</p>
              </div>
            </div>

            <p className="text-sm text-slate-400 mb-6">
              Advanced canvas workspace with infinite pan/zoom. Organize generations with drag-and-drop positioning.
            </p>

            <ul className="text-sm text-slate-400 space-y-2 mb-6">
              <li className="flex items-center gap-2">
                <span className="text-purple-400">+</span> Up to 50 images per session
              </li>
              <li className="flex items-center gap-2">
                <span className="text-purple-400">+</span> Infinite pan/zoom canvas
              </li>
              <li className="flex items-center gap-2">
                <span className="text-purple-400">+</span> Up to 4 floating scanners
              </li>
              <li className="flex items-center gap-2">
                <span className="text-purple-400">+</span> Save/load sessions
              </li>
            </ul>

            <Link href="/prompting-studio/canvas">
              <Button
                className="w-full bg-gradient-to-r from-purple-600 to-cyan-600 hover:from-purple-500 hover:to-cyan-500 font-bold group-hover:shadow-lg group-hover:shadow-purple-500/20 transition-all"
                disabled={!hasDevTier}
              >
                Open Canvas Scanner
                <ArrowRight className="ml-2" size={16} />
              </Button>
            </Link>
          </div>
        </div>

        {/* Back button */}
        <div className="text-center mt-8">
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
