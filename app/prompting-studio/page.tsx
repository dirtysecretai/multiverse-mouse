'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Image as ImageIcon, Video, Sparkles, ArrowRight, LayoutDashboard, Ticket } from 'lucide-react';

export default function StudioSelection() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [hasDevTier, setHasDevTier] = useState(false);
  const [ticketBalance, setTicketBalance] = useState<number | null>(null);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const res = await fetch('/api/auth/session');
        const data = await res.json();
        if (!data.authenticated) { router.push('/login'); return; }
        setUser(data.user);
        const [subRes, ticketRes] = await Promise.all([
          fetch('/api/user/subscription'),
          fetch(`/api/user/tickets?userId=${data.user.id}`),
        ]);
        const subData = await subRes.json();
        const ticketData = await ticketRes.json();
        if (subData.success) setHasDevTier(subData.hasPromptStudioDev);
        if (ticketData.success) setTicketBalance(ticketData.balance);
      } catch {
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
        <div className="w-5 h-5 rounded-full border-2 border-slate-700 border-t-cyan-400 animate-spin" />
      </div>
    );
  }

  const tools = [
    {
      id: 'portal-v2',
      label: 'AI Design Studio',
      sublabel: 'Portal V2',
      description: 'Generate images and videos with all models, prompt tools, reference library, and session feed.',
      href: '/',
      icon: Sparkles,
      color: 'cyan',
      accent: 'text-cyan-400',
      border: 'border-cyan-500/20 hover:border-cyan-400/50',
      bg: 'bg-cyan-500/5',
      iconBg: 'bg-cyan-500/15',
      btnClass: 'bg-cyan-500/15 hover:bg-cyan-500/25 border border-cyan-500/30 text-cyan-300',
      glow: 'group-hover:shadow-cyan-500/10',
      tags: ['NanoBanana Pro', 'SeeDream 1.5', 'FLUX 2', 'Kling 3.0', 'Wan 2.5', '+ more'],
      tagColor: 'bg-cyan-500/10 text-cyan-300 border-cyan-500/20',
      badge: 'NEW',
      badgeColor: 'bg-cyan-500 text-black',
    },
    {
      id: 'main-scanner',
      label: 'Legacy Scanner (Main)',
      sublabel: 'Classic',
      description: 'The original AI image scanner with model selector, prompt builder, and a 6-slot generation queue.',
      href: '/scanner',
      icon: ImageIcon,
      color: 'violet',
      accent: 'text-violet-400',
      border: 'border-violet-500/20 hover:border-violet-400/50',
      bg: 'bg-violet-500/5',
      iconBg: 'bg-violet-500/15',
      btnClass: 'bg-violet-500/15 hover:bg-violet-500/25 border border-violet-500/30 text-violet-300',
      glow: 'group-hover:shadow-violet-500/10',
      tags: ['NanoBanana Pro', 'SeeDream 4.5', 'Pro Scanner v3', 'Flash v2.5'],
      tagColor: 'bg-violet-500/10 text-violet-300 border-violet-500/20',
      badge: null,
      badgeColor: '',
    },
    {
      id: 'video-scanner',
      label: 'Video Scanner',
      sublabel: 'Dedicated',
      description: 'Generate AI videos with full control over duration, resolution, aspect ratio, and audio.',
      href: '/video-scanner',
      icon: Video,
      color: 'orange',
      accent: 'text-orange-400',
      border: 'border-orange-500/20 hover:border-orange-400/50',
      bg: 'bg-orange-500/5',
      iconBg: 'bg-orange-500/15',
      btnClass: 'bg-orange-500/15 hover:bg-orange-500/25 border border-orange-500/30 text-orange-300',
      glow: 'group-hover:shadow-orange-500/10',
      tags: ['Kling 3.0', 'Wan 2.5', 'SeeDance 1.5', 'Kling V3 Motion'],
      tagColor: 'bg-orange-500/10 text-orange-300 border-orange-500/20',
      badge: null,
      badgeColor: '',
    },
  ];

  return (
    <div className="min-h-screen bg-[#050810] text-white">
      {/* Subtle grid */}
      <div className="fixed inset-0 bg-[linear-gradient(rgba(255,255,255,0.015)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.015)_1px,transparent_1px)] bg-[size:40px_40px] pointer-events-none" />
      {/* Ambient glows */}
      <div className="fixed top-0 left-1/4 w-[500px] h-[300px] bg-cyan-500/5 rounded-full blur-3xl pointer-events-none" />
      <div className="fixed bottom-0 right-1/4 w-[400px] h-[300px] bg-fuchsia-500/5 rounded-full blur-3xl pointer-events-none" />

      <div className="relative z-10 max-w-4xl mx-auto px-4 py-12">

        {/* Header */}
        <div className="flex items-start justify-between mb-12">
          <div>
            <p className="text-[11px] font-mono text-slate-600 uppercase tracking-widest mb-2">AI Design Studio</p>
            <h1 className="text-3xl font-black text-white tracking-tight">Select a Tool</h1>
            <p className="text-slate-500 text-sm mt-1">Choose where you want to create today</p>
          </div>
          <div className="flex items-center gap-3">
            {ticketBalance !== null && (
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-cyan-500/20 bg-black/40 font-mono text-xs">
                <Ticket size={11} className="text-cyan-500/70" />
                <span className="text-cyan-400 tabular-nums">{ticketBalance.toLocaleString()}</span>
              </div>
            )}
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-white/8 bg-white/3">
              <div className="w-5 h-5 rounded-full bg-gradient-to-br from-cyan-500 to-fuchsia-500 flex items-center justify-center text-[10px] font-black text-black">
                {user?.email?.[0]?.toUpperCase() || 'U'}
              </div>
              <span className="text-xs text-slate-400 max-w-[140px] truncate">{user?.email}</span>
              {hasDevTier && (
                <span className="text-[9px] font-black bg-gradient-to-r from-purple-500 to-cyan-500 text-white px-1.5 py-0.5 rounded-full leading-none">
                  DEV
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Tool cards */}
        <div className="grid md:grid-cols-3 gap-4 mb-10">
          {tools.map((tool) => {
            const Icon = tool.icon;
            return (
              <Link key={tool.id} href={tool.href}>
                <div className={`group relative rounded-2xl border ${tool.border} ${tool.bg} backdrop-blur-sm p-5 h-full flex flex-col transition-all duration-200 hover:shadow-xl ${tool.glow} cursor-pointer`}>
                  {tool.badge && (
                    <span className={`absolute top-4 right-4 text-[9px] font-black px-2 py-0.5 rounded-full ${tool.badgeColor}`}>
                      {tool.badge}
                    </span>
                  )}

                  {/* Icon + title */}
                  <div className="flex items-center gap-3 mb-4">
                    <div className={`w-9 h-9 rounded-xl ${tool.iconBg} flex items-center justify-center shrink-0`}>
                      <Icon size={18} className={tool.accent} />
                    </div>
                    <div>
                      <p className={`text-sm font-black ${tool.accent}`}>{tool.label}</p>
                      <p className="text-[10px] text-slate-600 font-mono">{tool.sublabel}</p>
                    </div>
                  </div>

                  {/* Description */}
                  <p className="text-xs text-slate-400 leading-relaxed mb-4 flex-1">{tool.description}</p>

                  {/* Model tags */}
                  <div className="flex flex-wrap gap-1 mb-4">
                    {tool.tags.map(tag => (
                      <span key={tag} className={`text-[9px] px-1.5 py-0.5 rounded border ${tool.tagColor} font-medium`}>{tag}</span>
                    ))}
                  </div>

                  {/* Open button */}
                  <button className={`w-full flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold transition-all ${tool.btnClass}`}>
                    Open {tool.label}
                    <ArrowRight size={12} />
                  </button>
                </div>
              </Link>
            );
          })}
        </div>

        {/* Footer nav */}
        <div className="flex items-center justify-center gap-3">
          <Link href="/dashboard">
            <button className="flex items-center gap-1.5 px-4 py-2 rounded-lg border border-white/8 bg-white/3 hover:border-white/15 hover:bg-white/5 text-xs text-slate-400 hover:text-white transition-all">
              <LayoutDashboard size={13} />
              Dashboard
            </button>
          </Link>
          <Link href="/my-images">
            <button className="flex items-center gap-1.5 px-4 py-2 rounded-lg border border-white/8 bg-white/3 hover:border-white/15 hover:bg-white/5 text-xs text-slate-400 hover:text-white transition-all">
              My Generations
            </button>
          </Link>
          <Link href="/buy-tickets">
            <button className="flex items-center gap-1.5 px-4 py-2 rounded-lg border border-white/8 bg-white/3 hover:border-white/15 hover:bg-white/5 text-xs text-slate-400 hover:text-white transition-all">
              <Ticket size={13} />
              Buy Tickets
            </button>
          </Link>
        </div>
      </div>
    </div>
  );
}
