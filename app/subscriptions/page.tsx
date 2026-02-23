'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { CreditCard, Calendar, RefreshCw, XCircle, CheckCircle, ArrowLeft, AlertTriangle } from 'lucide-react';
import Link from 'next/link';

interface Subscription {
  id: number;
  tier: string;
  status: string;
  startDate: string;
  endDate: string | null;
  nextBillingDate: string | null;
  billingAmount: number | null;
  billingCycle: string | null;
  autoRenew: boolean;
  cancelledAt: string | null;
}

const TIER_DISPLAY: Record<string, { name: string; description: string; color: string }> = {
  'prompt-studio-dev': {
    name: 'Prompt Studio Dev Tier',
    description: 'Full access to Canvas Scanner, multiple layers, and advanced features',
    color: 'purple'
  }
};

export default function SubscriptionsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [cancelling, setCancelling] = useState<number | null>(null);
  const [showCancelConfirm, setShowCancelConfirm] = useState<number | null>(null);

  useEffect(() => {
    fetchSubscriptions();
  }, []);

  const fetchSubscriptions = async () => {
    try {
      const res = await fetch('/api/user/subscriptions');
      const data = await res.json();

      if (!data.success) {
        if (data.error === 'Not authenticated') {
          router.push('/login');
          return;
        }
      }

      setSubscriptions(data.subscriptions || []);
    } catch (err) {
      console.error('Failed to fetch subscriptions:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCancelSubscription = async (subscriptionId: number) => {
    setCancelling(subscriptionId);
    try {
      const res = await fetch('/api/user/subscriptions/cancel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subscriptionId })
      });

      const data = await res.json();

      if (data.success) {
        // Refresh subscriptions
        fetchSubscriptions();
        setShowCancelConfirm(null);
      } else {
        alert(data.error || 'Failed to cancel subscription');
      }
    } catch (err) {
      console.error('Failed to cancel subscription:', err);
      alert('Failed to cancel subscription');
    } finally {
      setCancelling(null);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  };

  const getStatusBadge = (sub: Subscription) => {
    if (sub.status === 'active' && !sub.cancelledAt) {
      return (
        <span className="flex items-center gap-1 text-xs font-bold bg-green-500/20 text-green-400 px-2 py-1 rounded-full">
          <CheckCircle size={12} />
          Active
        </span>
      );
    } else if (sub.status === 'active' && sub.cancelledAt) {
      return (
        <span className="flex items-center gap-1 text-xs font-bold bg-yellow-500/20 text-yellow-400 px-2 py-1 rounded-full">
          <AlertTriangle size={12} />
          Cancelling
        </span>
      );
    } else if (sub.status === 'cancelled') {
      return (
        <span className="flex items-center gap-1 text-xs font-bold bg-orange-500/20 text-orange-400 px-2 py-1 rounded-full">
          <XCircle size={12} />
          Cancelled
        </span>
      );
    } else if (sub.status === 'expired') {
      return (
        <span className="flex items-center gap-1 text-xs font-bold bg-slate-500/20 text-slate-400 px-2 py-1 rounded-full">
          <XCircle size={12} />
          Expired
        </span>
      );
    }
    return null;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#050810] flex items-center justify-center">
        <div className="text-cyan-400 text-xl font-mono">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#050810] text-white">
      {/* Background */}
      <div className="fixed inset-0 bg-[linear-gradient(rgba(0,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(0,255,255,0.02)_1px,transparent_1px)] bg-[size:40px_40px] pointer-events-none" />

      <div className="relative z-10 max-w-3xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <Link href="/dashboard">
            <Button className="bg-slate-800 hover:bg-slate-700 border border-slate-600 text-slate-300 h-9 px-3">
              <ArrowLeft size={16} className="mr-1" />
              Back
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-cyan-400">
              Manage Subscriptions
            </h1>
            <p className="text-sm text-slate-400">View and manage your active subscriptions</p>
          </div>
        </div>

        {/* Subscriptions List */}
        {subscriptions.length === 0 ? (
          <div className="p-8 rounded-xl border-2 border-slate-700 bg-slate-900/80 text-center">
            <CreditCard className="mx-auto text-slate-600 mb-3" size={48} />
            <h2 className="text-lg font-bold text-slate-400 mb-2">No Active Subscriptions</h2>
            <p className="text-sm text-slate-500 mb-4">You don't have any active subscriptions yet.</p>
            <Link href="/prompting-studio/upgrade">
              <Button className="bg-gradient-to-r from-purple-600 to-cyan-600 hover:from-purple-500 hover:to-cyan-500 font-bold">
                Upgrade to Dev Tier
              </Button>
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {subscriptions.map((sub) => {
              const tierInfo = TIER_DISPLAY[sub.tier] || { name: sub.tier, description: '', color: 'slate' };
              const isActive = sub.status === 'active';
              const isCancelled = !!sub.cancelledAt;

              return (
                <div
                  key={sub.id}
                  className={`p-6 rounded-xl border-2 ${
                    isActive && !isCancelled
                      ? 'border-purple-500/30 bg-slate-900/80'
                      : 'border-slate-700 bg-slate-900/50'
                  }`}
                >
                  {/* Header */}
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="text-lg font-bold text-white">{tierInfo.name}</h3>
                        {getStatusBadge(sub)}
                      </div>
                      <p className="text-sm text-slate-400">{tierInfo.description}</p>
                    </div>
                  </div>

                  {/* Details Grid */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                    <div className="p-3 rounded-lg bg-slate-950/50 border border-slate-800">
                      <div className="flex items-center gap-2 text-xs text-slate-500 mb-1">
                        <Calendar size={12} />
                        Started
                      </div>
                      <p className="text-sm text-white font-medium">{formatDate(sub.startDate)}</p>
                    </div>

                    {sub.billingAmount && sub.billingCycle && (
                      <div className="p-3 rounded-lg bg-slate-950/50 border border-slate-800">
                        <div className="flex items-center gap-2 text-xs text-slate-500 mb-1">
                          <CreditCard size={12} />
                          Billing
                        </div>
                        <p className="text-sm text-white font-medium">
                          {formatCurrency(sub.billingAmount)}/{sub.billingCycle === 'monthly' ? 'mo' : 'yr'}
                        </p>
                      </div>
                    )}

                    {sub.nextBillingDate && !isCancelled && (
                      <div className="p-3 rounded-lg bg-slate-950/50 border border-slate-800">
                        <div className="flex items-center gap-2 text-xs text-slate-500 mb-1">
                          <RefreshCw size={12} />
                          Next Billing
                        </div>
                        <p className="text-sm text-white font-medium">{formatDate(sub.nextBillingDate)}</p>
                      </div>
                    )}

                    <div className="p-3 rounded-lg bg-slate-950/50 border border-slate-800">
                      <div className="flex items-center gap-2 text-xs text-slate-500 mb-1">
                        <Calendar size={12} />
                        {isCancelled ? 'Access Until' : 'Subscription Ends'}
                      </div>
                      <p className={`text-sm font-medium ${isCancelled ? 'text-yellow-400' : sub.endDate ? 'text-white' : 'text-green-400'}`}>
                        {sub.endDate ? formatDate(sub.endDate) : 'Unlimited'}
                      </p>
                    </div>

                    <div className="p-3 rounded-lg bg-slate-950/50 border border-slate-800">
                      <div className="flex items-center gap-2 text-xs text-slate-500 mb-1">
                        <RefreshCw size={12} />
                        Auto-Renew
                      </div>
                      <p className={`text-sm font-medium ${sub.autoRenew ? 'text-green-400' : 'text-slate-400'}`}>
                        {sub.autoRenew ? 'Enabled' : 'Disabled'}
                      </p>
                    </div>
                  </div>

                  {/* Cancellation Notice */}
                  {isCancelled && sub.endDate && (
                    <div className="p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/30 mb-4">
                      <p className="text-sm text-yellow-400">
                        <AlertTriangle size={14} className="inline mr-2" />
                        Your subscription has been cancelled. You will continue to have access until{' '}
                        <strong>{formatDate(sub.endDate)}</strong>.
                      </p>
                    </div>
                  )}

                  {/* Actions */}
                  {isActive && !isCancelled && (
                    <div className="pt-4 border-t border-slate-800">
                      {showCancelConfirm === sub.id ? (
                        <div className="flex items-center gap-3">
                          <p className="text-sm text-slate-400 flex-1">
                            Are you sure? Your access will continue until the end of your billing period.
                          </p>
                          <Button
                            onClick={() => setShowCancelConfirm(null)}
                            className="bg-slate-700 hover:bg-slate-600 text-sm h-8"
                          >
                            Keep Subscription
                          </Button>
                          <Button
                            onClick={() => handleCancelSubscription(sub.id)}
                            disabled={cancelling === sub.id}
                            className="bg-red-600 hover:bg-red-500 text-sm h-8"
                          >
                            {cancelling === sub.id ? 'Cancelling...' : 'Confirm Cancel'}
                          </Button>
                        </div>
                      ) : (
                        <Button
                          onClick={() => setShowCancelConfirm(sub.id)}
                          className="bg-slate-800 hover:bg-red-500/20 text-red-400 border border-red-500/30 hover:border-red-500 text-sm h-9"
                        >
                          <XCircle size={14} className="mr-2" />
                          Cancel Subscription
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
