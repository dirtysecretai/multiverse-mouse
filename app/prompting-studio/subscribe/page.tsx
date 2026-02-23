'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { FlaskRound, Sparkles, Check, ArrowLeft, Zap, Crown, Ticket } from 'lucide-react';
import Link from 'next/link';

interface UserData {
  id: number;
  email: string;
}

interface SubscriptionPlan {
  id: string;
  name: string;
  price: number;
  tickets: number;
  interval: 'biweekly' | 'monthly' | 'yearly';
  intervalLabel: string;
  popular?: boolean;
  bestValue?: boolean;
  savings?: string;
}

const SUBSCRIPTION_PLANS: SubscriptionPlan[] = [
  {
    id: 'biweekly',
    name: 'Biweekly Plan',
    price: 20,
    tickets: 250,
    interval: 'biweekly',
    intervalLabel: 'every 2 weeks',
  },
  {
    id: 'monthly',
    name: 'Monthly Plan',
    price: 40,
    tickets: 500,
    interval: 'monthly',
    intervalLabel: 'per month',
    popular: true,
  },
  {
    id: 'yearly',
    name: 'Yearly Plan',
    price: 480,
    tickets: 500,
    interval: 'yearly',
    intervalLabel: 'per year',
    bestValue: true,
    savings: 'Save $0/mo vs Monthly',
  },
];

export default function SubscribePage() {
  const router = useRouter();
  const [user, setUser] = useState<UserData | null>(null);
  const [loading, setLoading] = useState(true);
  const [acceptedTOS, setAcceptedTOS] = useState(false);
  const [hasSubscription, setHasSubscription] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<SubscriptionPlan | null>(null);
  const [comingSoon, setComingSoon] = useState(false);

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      const res = await fetch('/api/auth/session');
      const data = await res.json();

      if (!data.authenticated) {
        router.push('/login');
        return;
      }

      setUser(data.user);

      // Check if already subscribed
      const subRes = await fetch('/api/user/subscription');
      const subData = await subRes.json();
      if (subData.success && subData.hasPromptStudioDev) {
        setHasSubscription(true);
      }
    } catch (error) {
      console.error('Auth check failed:', error);
      router.push('/login');
    } finally {
      setLoading(false);
    }
  };

  const handleSubscribe = () => {
    if (!acceptedTOS) return;
    setComingSoon(true);
    setTimeout(() => setComingSoon(false), 4000);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#050810] flex items-center justify-center">
        <div className="text-cyan-400 text-xl font-mono">Loading...</div>
      </div>
    );
  }

  if (!user) return null;

  // Already subscribed
  if (hasSubscription) {
    return (
      <div className="min-h-screen bg-[#050810] text-white">
        <div className="fixed inset-0 bg-[linear-gradient(rgba(0,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(0,255,255,0.02)_1px,transparent_1px)] bg-[size:40px_40px] pointer-events-none" />

        <div className="relative z-10 max-w-2xl mx-auto px-4 py-16">
          <div className="text-center p-12 rounded-xl border-2 border-green-500/30 bg-green-900/20">
            <Sparkles className="mx-auto text-green-400 mb-6" size={64} />
            <h2 className="text-3xl font-bold text-green-400 mb-3">You're Already Subscribed!</h2>
            <p className="text-slate-300 mb-6 text-lg">You have full access to the Development Tier.</p>
            <div className="flex gap-4 justify-center">
              <Link href="/prompting-studio/canvas">
                <Button className="bg-green-600 hover:bg-green-500 font-bold">
                  Open Canvas Scanner
                </Button>
              </Link>
              <Link href="/subscriptions">
                <Button variant="outline" className="border-slate-600 text-slate-300 hover:bg-slate-800">
                  Manage Subscription
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const devTierFeatures = [
    { text: '30–37% off all ticket package purchases', highlight: true },
    { text: '250–500 tickets auto-delivered each billing cycle', highlight: true },
    { text: 'Up to 6 concurrent generations (vs 2 on free tier)', highlight: true },
    { text: 'AI Design Studio — Canvas Scanner & advanced tools', highlight: false },
    { text: 'AI-powered prompt generation (Gemini models)', highlight: false },
    { text: 'Early access to new experimental features', highlight: false },
  ];

  return (
    <div className="min-h-screen bg-[#050810] text-white relative overflow-hidden">
        {/* Background effects */}
        <div className="fixed inset-0 bg-[linear-gradient(rgba(0,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(0,255,255,0.02)_1px,transparent_1px)] bg-[size:40px_40px] pointer-events-none" />
        <div className="fixed top-20 left-20 w-96 h-96 bg-purple-500/5 rounded-full blur-3xl" />
        <div className="fixed bottom-20 right-20 w-96 h-96 bg-cyan-500/5 rounded-full blur-3xl" />

        <div className="relative z-10 max-w-4xl mx-auto p-6">
          {/* Header */}
          <div className="mb-8">
            <Link href="/prompting-studio/upgrade" className="text-slate-500 hover:text-cyan-400 text-sm mb-4 inline-block">
              <ArrowLeft className="inline mr-2" size={16} />
              Back to Upgrade Page
            </Link>
            <div className="flex items-center gap-3 mb-3">
              <FlaskRound className="text-purple-400" size={40} />
              <h1 className="text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-cyan-400">
                DEVELOPMENT TIER
              </h1>
            </div>
            <p className="text-slate-400 text-lg">Discounted tickets, auto delivery, 6 concurrent generations, and the full AI Design Studio.</p>
          </div>

          {/* Logged in account info */}
          <div className="mb-8 p-4 rounded-xl border-2 border-cyan-500/30 bg-slate-950/50 backdrop-blur-sm">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-gradient-to-r from-cyan-500 to-purple-500 flex items-center justify-center">
                <span className="text-white font-bold text-lg">
                  {user.email?.[0]?.toUpperCase() || '?'}
                </span>
              </div>
              <div>
                <p className="text-xs text-slate-500">Purchasing for account:</p>
                <p className="text-sm font-bold text-cyan-400">{user.email}</p>
              </div>
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-8">
            {/* Left: Features */}
            <div className="p-6 rounded-xl border-2 border-purple-500/30 bg-slate-900/80 backdrop-blur-sm">
              <div className="flex items-center gap-2 mb-1">
                <Crown className="text-cyan-400" size={18} />
                <h2 className="text-xl font-bold text-white">Dev Tier Benefits</h2>
              </div>
              <p className="text-xs text-slate-500 mb-5">Everything in the free tier, plus:</p>

              {/* 3 stat highlights */}
              <div className="grid grid-cols-3 gap-2 mb-5">
                <div className="p-2.5 rounded-lg bg-purple-500/10 border border-purple-500/20 text-center">
                  <div className="text-xl font-black text-purple-400">37%</div>
                  <div className="text-[10px] text-slate-500 leading-tight">off tickets</div>
                </div>
                <div className="p-2.5 rounded-lg bg-cyan-500/10 border border-cyan-500/20 text-center">
                  <div className="text-xl font-black text-cyan-400">6×</div>
                  <div className="text-[10px] text-slate-500 leading-tight">concurrent gens</div>
                </div>
                <div className="p-2.5 rounded-lg bg-green-500/10 border border-green-500/20 text-center">
                  <div className="text-xl font-black text-green-400">500</div>
                  <div className="text-[10px] text-slate-500 leading-tight">tickets/mo</div>
                </div>
              </div>

              <ul className="space-y-2.5 mb-5">
                {devTierFeatures.map((feature, idx) => (
                  <li key={idx} className="flex items-start gap-2.5">
                    <Check className={`flex-shrink-0 mt-0.5 ${feature.highlight ? 'text-cyan-400' : 'text-cyan-700'}`} size={15} />
                    <span className={`text-sm ${feature.highlight ? 'text-white font-semibold' : 'text-slate-400'}`}>{feature.text}</span>
                  </li>
                ))}
              </ul>

              <div className="p-3 rounded-lg bg-slate-950 border border-slate-800">
                <p className="text-[11px] text-slate-500 leading-relaxed">
                  <span className="text-slate-300 font-semibold">Free tier includes</span> — Main Scanner, Legacy Scanner, Video Scanner, all AI models, and 2 concurrent generations.
                </p>
              </div>
            </div>

            {/* Right: Plan Selection or Checkout */}
            <div>
              {!selectedPlan ? (
                /* Plan Selection */
                <>
                  <h3 className="text-xl font-black text-white mb-4">Choose Your Plan</h3>
                  <div className="space-y-3">
                    {SUBSCRIPTION_PLANS.map((plan) => (
                      <div
                        key={plan.id}
                        onClick={() => setSelectedPlan(plan)}
                        className={`p-4 rounded-xl border-2 cursor-pointer transition-all ${
                          plan.bestValue
                            ? 'border-fuchsia-500/50 bg-gradient-to-br from-fuchsia-500/10 to-transparent hover:border-fuchsia-400'
                            : plan.popular
                            ? 'border-purple-500/50 bg-gradient-to-br from-purple-500/10 to-transparent hover:border-purple-400'
                            : 'border-slate-700 bg-slate-900/40 hover:border-slate-600'
                        }`}
                      >
                        {/* Badge */}
                        {(plan.popular || plan.bestValue) && (
                          <div className="mb-2">
                            <span className={`text-[10px] font-bold px-2 py-1 rounded-full ${
                              plan.bestValue ? 'bg-fuchsia-500 text-white' : 'bg-purple-500 text-white'
                            }`}>
                              {plan.bestValue ? 'BEST VALUE' : 'POPULAR'}
                            </span>
                          </div>
                        )}

                        <div className="flex items-center justify-between mb-3">
                          <div>
                            <h4 className="font-bold text-white text-lg">{plan.name}</h4>
                            <p className="text-xs text-slate-400">{plan.intervalLabel}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-purple-400">
                              ${plan.price}
                            </p>
                            {plan.interval === 'yearly' && (
                              <p className="text-[10px] text-slate-500">$40/mo equivalent</p>
                            )}
                          </div>
                        </div>

                        {/* Tickets */}
                        <div className="p-2.5 rounded-lg bg-green-500/10 border border-green-500/30">
                          <div className="flex items-center gap-2">
                            <Ticket size={13} className="text-green-400 flex-shrink-0" />
                            <span className="text-xs text-green-400 font-bold">
                              {plan.tickets} tickets {plan.interval === 'yearly' ? 'per month' : plan.intervalLabel}
                            </span>
                          </div>
                          <p className="text-[10px] text-slate-600 mt-1 pl-5">Auto-delivered · never expire</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                /* Checkout for Selected Plan */
                <>
                  <div className="p-6 rounded-xl border-2 border-cyan-500/30 bg-slate-900/80 backdrop-blur-sm mb-4">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-xl font-black text-white">Subscription Details</h3>
                      <button
                        onClick={() => setSelectedPlan(null)}
                        className="text-xs text-slate-400 hover:text-cyan-400 transition-colors"
                      >
                        Change Plan
                      </button>
                    </div>

                    {/* Selected Plan Summary */}
                    <div className="mb-4 pb-4 border-b border-slate-800">
                      <div className="flex items-baseline justify-between">
                        <div>
                          <p className="text-sm text-slate-400">{selectedPlan.name}</p>
                          <p className="text-xs text-slate-500 mt-1">Billed {selectedPlan.intervalLabel}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-purple-400">
                            ${selectedPlan.price}
                          </p>
                          {selectedPlan.interval === 'yearly' && (
                            <p className="text-xs text-slate-500">($40/mo equivalent)</p>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Included Tickets */}
                    <div className="mb-4 p-3 rounded-lg bg-green-500/10 border border-green-500/30">
                      <div className="flex items-center gap-2 mb-1">
                        <Zap size={16} className="text-green-400" />
                        <span className="text-sm font-bold text-green-400">
                          {selectedPlan.tickets} tickets included {selectedPlan.interval === 'yearly' ? 'monthly' : selectedPlan.intervalLabel}
                        </span>
                      </div>
                      <p className="text-xs text-slate-400">
                        Automatically added to your account with each billing cycle
                      </p>
                    </div>

                    <div className="space-y-2 text-xs text-slate-400">
                      <div className="flex items-center gap-2">
                        <Check size={14} className="text-green-400" />
                        <span>Cancel anytime</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Check size={14} className="text-green-400" />
                        <span>Instant access to all features</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Check size={14} className="text-green-400" />
                        <span>Auto-renews {selectedPlan.intervalLabel}</span>
                      </div>
                    </div>
                  </div>

                  {/* TOS ACCEPTANCE */}
                  <div className="mb-4 p-4 rounded-lg border border-yellow-500/30 bg-yellow-500/5">
                    <label className="flex items-start gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={acceptedTOS}
                        onChange={(e) => setAcceptedTOS(e.target.checked)}
                        className="mt-1 w-4 h-4 rounded border-slate-600 bg-slate-800 text-cyan-500 focus:ring-cyan-500 focus:ring-offset-slate-900 cursor-pointer"
                      />
                      <span className="text-xs text-slate-300 leading-relaxed">
                        I agree to the{' '}
                        <a href="/terms" target="_blank" className="text-cyan-400 hover:text-cyan-300 underline">
                          Terms of Service
                        </a>
                        {' '}and{' '}
                        <a href="/privacy" target="_blank" className="text-cyan-400 hover:text-cyan-300 underline">
                          Privacy Policy
                        </a>
                        . I understand that subscriptions auto-renew {selectedPlan.intervalLabel} and can be cancelled anytime from account settings.
                      </span>
                    </label>
                  </div>

                  {/* Subscribe button */}
                  <button
                    onClick={handleSubscribe}
                    disabled={!acceptedTOS}
                    className={`w-full py-4 rounded-xl font-black text-base tracking-widest transition-all ${
                      !acceptedTOS
                        ? 'cursor-not-allowed bg-slate-900 border-2 border-slate-800 text-slate-600'
                        : comingSoon
                        ? 'cursor-default bg-slate-800 border-2 border-slate-600 text-slate-300'
                        : 'cursor-pointer bg-gradient-to-r from-purple-600 to-cyan-600 border-2 border-purple-400/50 text-white hover:shadow-lg hover:shadow-purple-500/30 active:scale-[0.99]'
                    }`}
                  >
                    {comingSoon ? 'CHECKOUT COMING SOON...' : 'SUBSCRIBE'}
                    <span className={`block text-[10px] font-normal mt-0.5 tracking-normal ${
                      !acceptedTOS ? 'text-slate-700' : comingSoon ? 'text-slate-400' : 'text-white/60'
                    }`}>
                      {comingSoon
                        ? 'Secure checkout is coming soon — check back shortly!'
                        : !acceptedTOS
                        ? 'Accept the terms above to continue'
                        : `${selectedPlan.name} · $${selectedPlan.price} ${selectedPlan.intervalLabel}`}
                    </span>
                  </button>

                  <p className="text-[9px] text-slate-700 text-center font-mono tracking-widest uppercase mt-3">
                    Secure checkout coming soon
                  </p>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
  );
}
