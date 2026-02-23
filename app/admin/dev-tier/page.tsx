"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { ArrowLeft, CreditCard, AlertCircle, CheckCircle, XCircle, ToggleLeft, ToggleRight, Trash2, DollarSign, Calendar, User, Mail, RefreshCw, Gift } from "lucide-react"
import { useRouter } from "next/navigation"

interface SubscriptionTransaction {
  id: number
  subscriptionId: number
  userId: number
  type: string // 'payment' | 'ticket_distribution'
  amount: number | null
  paypalTransactionId: string | null
  ticketsAdded: number | null
  previousBalance: number | null
  newBalance: number | null
  description: string | null
  metadata: any
  createdAt: string
}

interface Subscription {
  id: number
  userId: number
  tier: string
  status: string
  startDate: string
  endDate: string | null
  nextBillingDate: string | null
  billingAmount: number | null
  billingCycle: string | null
  autoRenew: boolean
  cancelledAt: string | null
  paypalSubscriptionId: string | null
  paypalOrderId: string | null
  paypalCaptureId: string | null
  metadata: any
  createdAt: string
  updatedAt: string
  user: {
    id: number
    email: string
    name: string | null
    createdAt: string
  }
  transactions: SubscriptionTransaction[]
}

export default function DevTierAnalytics() {
  const router = useRouter()
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [processingId, setProcessingId] = useState<number | null>(null)

  const fetchSubscriptions = async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch('/api/admin/subscriptions', {
        headers: {
          'x-admin-password': sessionStorage.getItem('admin-password') || ''
        }
      })

      if (!response.ok) {
        throw new Error('Failed to fetch subscriptions')
      }

      const data = await response.json()
      setSubscriptions(data.subscriptions || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load subscriptions')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchSubscriptions()
  }, [])

  const toggleAutoRenew = async (subscriptionId: number, currentAutoRenew: boolean) => {
    if (!confirm(`Are you sure you want to ${currentAutoRenew ? 'disable' : 'enable'} auto-renew for this subscription?`)) {
      return
    }

    setProcessingId(subscriptionId)
    try {
      const response = await fetch('/api/admin/subscriptions/toggle-auto-renew', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-password': sessionStorage.getItem('admin-password') || ''
        },
        body: JSON.stringify({
          subscriptionId,
          autoRenew: !currentAutoRenew
        })
      })

      if (!response.ok) {
        throw new Error('Failed to toggle auto-renew')
      }

      await fetchSubscriptions()
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to toggle auto-renew')
    } finally {
      setProcessingId(null)
    }
  }

  const revokeAccess = async (subscriptionId: number, userEmail: string) => {
    if (!confirm(`⚠️ WARNING: This will IMMEDIATELY revoke Dev Tier access for ${userEmail}.\n\nThis will:\n- Set status to 'cancelled'\n- End their subscription access now\n- They will lose all Dev Tier features immediately\n\nAre you absolutely sure?`)) {
      return
    }

    setProcessingId(subscriptionId)
    try {
      const response = await fetch('/api/admin/subscriptions/revoke-access', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-password': sessionStorage.getItem('admin-password') || ''
        },
        body: JSON.stringify({ subscriptionId })
      })

      if (!response.ok) {
        throw new Error('Failed to revoke access')
      }

      await fetchSubscriptions()
      alert('Access revoked successfully')
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to revoke access')
    } finally {
      setProcessingId(null)
    }
  }

  const distributeTickets = async (subscriptionId: number, userEmail: string) => {
    const ticketAmount = prompt(`How many tickets would you like to distribute to ${userEmail}?`)
    if (!ticketAmount) return

    const tickets = parseInt(ticketAmount)
    if (isNaN(tickets) || tickets <= 0) {
      alert('Please enter a valid positive number')
      return
    }

    const description = prompt(`Optional: Add a description for this distribution\n(e.g., "Bonus tickets", "Compensation", etc.)`) || undefined

    setProcessingId(subscriptionId)
    try {
      const response = await fetch('/api/admin/subscriptions/distribute-tickets', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-password': sessionStorage.getItem('admin-password') || ''
        },
        body: JSON.stringify({
          subscriptionId,
          ticketAmount: tickets,
          description
        })
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to distribute tickets')
      }

      const data = await response.json()
      await fetchSubscriptions()
      alert(`✅ Successfully distributed ${tickets} tickets!\n\nPrevious balance: ${data.transaction.previousBalance}\nNew balance: ${data.transaction.newBalance}`)
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to distribute tickets')
    } finally {
      setProcessingId(null)
    }
  }

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'N/A'
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const formatCurrency = (amount: number | null) => {
    if (amount === null) return 'N/A'
    return `$${amount.toFixed(2)}`
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return <span className="px-3 py-1 rounded-full bg-green-500/20 text-green-400 text-xs font-bold border border-green-500/50">ACTIVE</span>
      case 'cancelled':
        return <span className="px-3 py-1 rounded-full bg-red-500/20 text-red-400 text-xs font-bold border border-red-500/50">CANCELLED</span>
      case 'expired':
        return <span className="px-3 py-1 rounded-full bg-orange-500/20 text-orange-400 text-xs font-bold border border-orange-500/50">EXPIRED</span>
      default:
        return <span className="px-3 py-1 rounded-full bg-slate-500/20 text-slate-400 text-xs font-bold border border-slate-500/50">{status.toUpperCase()}</span>
    }
  }

  const getTotalRevenue = () => {
    return subscriptions.reduce((total, sub) => {
      return total + (sub.billingAmount || 0)
    }, 0)
  }

  const getActiveCount = () => {
    return subscriptions.filter(sub => sub.status === 'active').length
  }

  const getCancelledCount = () => {
    return subscriptions.filter(sub => sub.status === 'cancelled').length
  }

  return (
    <div className="min-h-screen bg-[#050810] relative overflow-hidden">
      {/* Background effects */}
      <div className="fixed inset-0 bg-[linear-gradient(rgba(0,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(0,255,255,0.02)_1px,transparent_1px)] bg-[size:40px_40px] pointer-events-none" />
      <div className="fixed top-20 left-20 w-96 h-96 bg-emerald-500/5 rounded-full blur-3xl" />
      <div className="fixed bottom-20 right-20 w-96 h-96 bg-teal-500/5 rounded-full blur-3xl" />

      <div className="relative z-10 p-6 max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <button
            onClick={() => router.push('/admin')}
            className="flex items-center gap-2 text-slate-400 hover:text-cyan-400 transition-colors mb-4"
          >
            <ArrowLeft size={20} />
            Back to Admin Terminal
          </button>

          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-teal-500 flex items-center gap-3">
                <CreditCard size={40} /> Dev Tier Analytics
              </h1>
              <p className="text-slate-500 text-sm mt-2">Manage subscriptions and view user analytics</p>
            </div>
            <button
              onClick={fetchSubscriptions}
              disabled={loading}
              className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:bg-emerald-800 disabled:cursor-not-allowed text-white rounded-lg font-bold transition-colors"
            >
              <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
              Refresh
            </button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <div className="p-6 rounded-xl border-2 border-green-500/30 bg-green-500/5 backdrop-blur-sm">
            <div className="flex items-center gap-3 mb-2">
              <CheckCircle className="text-green-400" size={24} />
              <div className="text-2xl font-black text-green-400">{getActiveCount()}</div>
            </div>
            <div className="text-sm text-slate-400">Active Subscriptions</div>
          </div>

          <div className="p-6 rounded-xl border-2 border-red-500/30 bg-red-500/5 backdrop-blur-sm">
            <div className="flex items-center gap-3 mb-2">
              <XCircle className="text-red-400" size={24} />
              <div className="text-2xl font-black text-red-400">{getCancelledCount()}</div>
            </div>
            <div className="text-sm text-slate-400">Cancelled Subscriptions</div>
          </div>

          <div className="p-6 rounded-xl border-2 border-emerald-500/30 bg-emerald-500/5 backdrop-blur-sm">
            <div className="flex items-center gap-3 mb-2">
              <DollarSign className="text-emerald-400" size={24} />
              <div className="text-2xl font-black text-emerald-400">{formatCurrency(getTotalRevenue())}</div>
            </div>
            <div className="text-sm text-slate-400">Total Revenue (Initial Payments)</div>
          </div>
        </div>

        {/* Loading State */}
        {loading && (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-4 border-emerald-500 mx-auto mb-4" />
            <p className="text-slate-400">Loading subscriptions...</p>
          </div>
        )}

        {/* Error State */}
        {error && !loading && (
          <div className="p-6 rounded-xl border-2 border-red-500/30 bg-red-500/5 backdrop-blur-sm">
            <div className="flex items-center gap-3 mb-2">
              <AlertCircle className="text-red-400" size={24} />
              <h3 className="text-lg font-bold text-red-400">Error Loading Subscriptions</h3>
            </div>
            <p className="text-slate-400 text-sm">{error}</p>
          </div>
        )}

        {/* Subscriptions Table */}
        {!loading && !error && subscriptions.length === 0 && (
          <div className="p-12 text-center rounded-xl border-2 border-slate-700 bg-slate-900/60 backdrop-blur-sm">
            <CreditCard className="mx-auto text-slate-600 mb-4" size={48} />
            <h3 className="text-xl font-bold text-slate-400 mb-2">No Subscriptions Yet</h3>
            <p className="text-slate-500 text-sm">Dev Tier subscriptions will appear here once users subscribe.</p>
          </div>
        )}

        {!loading && !error && subscriptions.length > 0 && (
          <div className="space-y-4">
            {subscriptions.map((sub) => (
              <div
                key={sub.id}
                className="p-6 rounded-xl border-2 border-slate-700 bg-slate-900/60 backdrop-blur-sm hover:border-slate-600 transition-all"
              >
                {/* User Info Header */}
                <div className="flex items-start justify-between mb-4 pb-4 border-b border-slate-700">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <User className="text-cyan-400" size={20} />
                      <h3 className="text-lg font-bold text-white">
                        {sub.user.name || 'Unknown User'}
                      </h3>
                      {getStatusBadge(sub.status)}
                    </div>
                    <div className="flex items-center gap-2 text-sm text-slate-400 mb-1">
                      <Mail size={14} />
                      {sub.user.email}
                    </div>
                    <div className="text-xs text-slate-500 mb-3">
                      User ID: {sub.userId} • Subscription ID: {sub.id}
                    </div>

                    {/* Transaction Summary */}
                    {sub.transactions && sub.transactions.length > 0 && (
                      <div className="flex gap-4 mt-3">
                        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-green-500/10 border border-green-500/30">
                          <DollarSign size={14} className="text-green-400" />
                          <div>
                            <div className="text-xs text-slate-500">Total Paid</div>
                            <div className="text-sm font-bold text-green-400">
                              {formatCurrency(
                                sub.transactions
                                  .filter(tx => tx.type === 'payment')
                                  .reduce((sum, tx) => sum + (tx.amount || 0), 0)
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-blue-500/10 border border-blue-500/30">
                          <CreditCard size={14} className="text-blue-400" />
                          <div>
                            <div className="text-xs text-slate-500">Total Tickets</div>
                            <div className="text-sm font-bold text-blue-400">
                              {sub.transactions
                                .filter(tx => tx.type === 'ticket_distribution')
                                .reduce((sum, tx) => sum + (tx.ticketsAdded || 0), 0)}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-purple-500/10 border border-purple-500/30">
                          <Calendar size={14} className="text-purple-400" />
                          <div>
                            <div className="text-xs text-slate-500">Transactions</div>
                            <div className="text-sm font-bold text-purple-400">
                              {sub.transactions.length}
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Action Buttons */}
                  {sub.status === 'active' && (
                    <div className="flex gap-2">
                      <button
                        onClick={() => distributeTickets(sub.id, sub.user.email)}
                        disabled={processingId === sub.id}
                        className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-500 disabled:bg-purple-800 disabled:cursor-not-allowed text-white rounded-lg font-bold transition-colors"
                        title="Manually distribute tickets"
                      >
                        <Gift size={18} />
                        Give Tickets
                      </button>

                      <button
                        onClick={() => toggleAutoRenew(sub.id, sub.autoRenew)}
                        disabled={processingId === sub.id}
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg font-bold transition-all ${
                          sub.autoRenew
                            ? 'bg-green-600 hover:bg-green-500 text-white'
                            : 'bg-slate-700 hover:bg-slate-600 text-slate-300'
                        } disabled:opacity-50 disabled:cursor-not-allowed`}
                        title={sub.autoRenew ? 'Auto-renew enabled' : 'Auto-renew disabled'}
                      >
                        {sub.autoRenew ? <ToggleRight size={18} /> : <ToggleLeft size={18} />}
                        {processingId === sub.id ? 'Processing...' : sub.autoRenew ? 'Auto-Renew ON' : 'Auto-Renew OFF'}
                      </button>

                      <button
                        onClick={() => revokeAccess(sub.id, sub.user.email)}
                        disabled={processingId === sub.id}
                        className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-500 disabled:bg-red-800 disabled:cursor-not-allowed text-white rounded-lg font-bold transition-colors"
                      >
                        <Trash2 size={18} />
                        Revoke Access
                      </button>
                    </div>
                  )}
                </div>

                {/* Subscription Details Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  {/* Billing Amount */}
                  <div className="p-4 rounded-lg bg-slate-800/50">
                    <div className="text-xs text-slate-500 mb-1">Billing Amount</div>
                    <div className="text-lg font-bold text-emerald-400">
                      {formatCurrency(sub.billingAmount)}
                      {sub.billingCycle && <span className="text-xs text-slate-400 ml-1">/ {sub.billingCycle}</span>}
                    </div>
                  </div>

                  {/* Start Date */}
                  <div className="p-4 rounded-lg bg-slate-800/50">
                    <div className="text-xs text-slate-500 mb-1">Start Date</div>
                    <div className="text-sm font-bold text-white">{formatDate(sub.startDate)}</div>
                  </div>

                  {/* Next Billing */}
                  <div className="p-4 rounded-lg bg-slate-800/50">
                    <div className="text-xs text-slate-500 mb-1">Next Billing</div>
                    <div className="text-sm font-bold text-white">{formatDate(sub.nextBillingDate)}</div>
                  </div>

                  {/* End Date */}
                  <div className="p-4 rounded-lg bg-slate-800/50">
                    <div className="text-xs text-slate-500 mb-1">End Date</div>
                    <div className="text-sm font-bold text-white">{formatDate(sub.endDate)}</div>
                  </div>

                  {/* PayPal Subscription ID */}
                  <div className="p-4 rounded-lg bg-slate-800/50">
                    <div className="text-xs text-slate-500 mb-1">PayPal Subscription ID</div>
                    <div className="text-xs font-mono text-cyan-400 truncate" title={sub.paypalSubscriptionId || 'N/A'}>
                      {sub.paypalSubscriptionId || 'N/A'}
                    </div>
                  </div>

                  {/* PayPal Order ID */}
                  <div className="p-4 rounded-lg bg-slate-800/50">
                    <div className="text-xs text-slate-500 mb-1">PayPal Order ID</div>
                    <div className="text-xs font-mono text-cyan-400 truncate" title={sub.paypalOrderId || 'N/A'}>
                      {sub.paypalOrderId || 'N/A'}
                    </div>
                  </div>

                  {/* Created At */}
                  <div className="p-4 rounded-lg bg-slate-800/50">
                    <div className="text-xs text-slate-500 mb-1">Created At</div>
                    <div className="text-sm font-bold text-white">{formatDate(sub.createdAt)}</div>
                  </div>

                  {/* Cancelled At */}
                  {sub.cancelledAt && (
                    <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/30">
                      <div className="text-xs text-red-500 mb-1">Cancelled At</div>
                      <div className="text-sm font-bold text-red-400">{formatDate(sub.cancelledAt)}</div>
                    </div>
                  )}
                </div>

                {/* Metadata */}
                {sub.metadata && (
                  <div className="mt-4 p-4 rounded-lg bg-slate-800/30 border border-slate-700">
                    <div className="text-xs text-slate-500 mb-2">Plan Metadata</div>
                    <pre className="text-xs text-slate-300 font-mono overflow-x-auto">
                      {JSON.stringify(sub.metadata, null, 2)}
                    </pre>
                  </div>
                )}

                {/* Transaction History */}
                {sub.transactions && sub.transactions.length > 0 && (
                  <div className="mt-6 p-6 rounded-lg bg-slate-800/50 border-2 border-emerald-500/30">
                    <h4 className="text-lg font-bold text-emerald-400 mb-4 flex items-center gap-2">
                      <Calendar size={20} />
                      Transaction History ({sub.transactions.length})
                    </h4>
                    <div className="space-y-3">
                      {sub.transactions.map((tx) => (
                        <div
                          key={tx.id}
                          className={`p-4 rounded-lg border-2 ${
                            tx.type === 'payment'
                              ? 'bg-green-500/5 border-green-500/30'
                              : 'bg-blue-500/5 border-blue-500/30'
                          }`}
                        >
                          <div className="flex items-start justify-between mb-3">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-2">
                                {tx.type === 'payment' ? (
                                  <DollarSign className="text-green-400" size={18} />
                                ) : (
                                  <CreditCard className="text-blue-400" size={18} />
                                )}
                                <span className={`text-sm font-bold ${
                                  tx.type === 'payment' ? 'text-green-400' : 'text-blue-400'
                                }`}>
                                  {tx.type === 'payment' ? 'PAYMENT RECEIVED' : 'TICKETS DISTRIBUTED'}
                                </span>
                                <span className="text-xs text-slate-500">
                                  {formatDate(tx.createdAt)}
                                </span>
                              </div>
                              {tx.description && (
                                <p className="text-sm text-slate-300 mb-2">{tx.description}</p>
                              )}
                            </div>
                          </div>

                          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                            {tx.type === 'payment' ? (
                              <>
                                <div className="p-3 rounded bg-slate-900/50">
                                  <div className="text-xs text-slate-500 mb-1">Amount</div>
                                  <div className="text-lg font-bold text-green-400">
                                    {formatCurrency(tx.amount)}
                                  </div>
                                </div>
                                {tx.paypalTransactionId && (
                                  <div className="p-3 rounded bg-slate-900/50 col-span-3">
                                    <div className="text-xs text-slate-500 mb-1">PayPal Transaction ID</div>
                                    <div className="text-xs font-mono text-cyan-400 truncate" title={tx.paypalTransactionId}>
                                      {tx.paypalTransactionId}
                                    </div>
                                  </div>
                                )}
                              </>
                            ) : (
                              <>
                                <div className="p-3 rounded bg-slate-900/50">
                                  <div className="text-xs text-slate-500 mb-1">Tickets Added</div>
                                  <div className="text-lg font-bold text-blue-400">
                                    +{tx.ticketsAdded}
                                  </div>
                                </div>
                                <div className="p-3 rounded bg-slate-900/50">
                                  <div className="text-xs text-slate-500 mb-1">Previous Balance</div>
                                  <div className="text-sm font-bold text-slate-400">
                                    {tx.previousBalance !== null ? tx.previousBalance : 'N/A'}
                                  </div>
                                </div>
                                <div className="p-3 rounded bg-slate-900/50">
                                  <div className="text-xs text-slate-500 mb-1">New Balance</div>
                                  <div className="text-sm font-bold text-emerald-400">
                                    {tx.newBalance !== null ? tx.newBalance : 'N/A'}
                                  </div>
                                </div>
                                <div className="p-3 rounded bg-slate-900/50">
                                  <div className="text-xs text-slate-500 mb-1">Change</div>
                                  <div className="text-sm font-bold text-blue-400">
                                    {tx.previousBalance !== null && tx.newBalance !== null
                                      ? `+${tx.newBalance - tx.previousBalance}`
                                      : 'N/A'}
                                  </div>
                                </div>
                              </>
                            )}
                          </div>

                          {tx.metadata && (
                            <div className="mt-3 p-3 rounded bg-slate-900/30 border border-slate-700">
                              <div className="text-xs text-slate-500 mb-1">Transaction Metadata</div>
                              <pre className="text-xs text-slate-400 font-mono overflow-x-auto">
                                {JSON.stringify(tx.metadata, null, 2)}
                              </pre>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* No Transactions */}
                {(!sub.transactions || sub.transactions.length === 0) && (
                  <div className="mt-6 p-6 rounded-lg bg-slate-800/30 border border-slate-700 text-center">
                    <Calendar className="mx-auto text-slate-600 mb-2" size={32} />
                    <p className="text-sm text-slate-500">No transaction history yet</p>
                    <p className="text-xs text-slate-600 mt-1">
                      Payment and ticket distribution records will appear here
                    </p>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
