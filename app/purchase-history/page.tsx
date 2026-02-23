"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { ArrowLeft, Receipt } from "lucide-react"
import { useRouter } from "next/navigation"
import Link from "next/link"

interface Purchase {
  id: number
  type: string
  description: string
  amount: number
  date: string
  status: string
  paypalOrderId: string
}

export default function PurchaseHistoryPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [purchases, setPurchases] = useState<Purchase[]>([])

  useEffect(() => {
    checkAuthAndFetch()
  }, [])

  const checkAuthAndFetch = async () => {
    try {
      const res = await fetch('/api/auth/session')
      const data = await res.json()

      if (!data.authenticated) {
        router.push('/login')
        return
      }

      // Fetch purchase history
      const purchasesRes = await fetch('/api/purchases')
      const purchasesData = await purchasesRes.json()

      if (Array.isArray(purchasesData)) {
        setPurchases(purchasesData)
      }
    } catch (error) {
      console.error('Failed to fetch:', error)
      router.push('/login')
    } finally {
      setLoading(false)
    }
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#050810] flex items-center justify-center">
        <div className="text-cyan-400 text-xl">Loading...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#050810] text-white">
      {/* Background grid */}
      <div className="fixed inset-0 bg-[linear-gradient(rgba(0,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(0,255,255,0.02)_1px,transparent_1px)] bg-[size:40px_40px] pointer-events-none" />

      <div className="relative z-10 max-w-4xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <Link href="/dashboard">
            <Button variant="ghost" className="text-slate-400 hover:text-white">
              <ArrowLeft className="mr-2" size={20} />
              Back to Dashboard
            </Button>
          </Link>
        </div>

        {/* Title */}
        <div className="flex items-center gap-3 mb-8">
          <Receipt className="text-cyan-400" size={32} />
          <h1 className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-fuchsia-500">
            PURCHASE HISTORY
          </h1>
        </div>

        {/* Purchase List */}
        <div className="space-y-4">
          {purchases.length === 0 ? (
            <div className="text-center py-16 border border-slate-800 rounded-xl bg-slate-900/50">
              <Receipt className="mx-auto text-slate-700 mb-4" size={64} />
              <p className="text-xl font-bold text-slate-400 mb-2">No purchases yet</p>
              <p className="text-sm text-slate-600">Your ticket purchase history will appear here</p>
            </div>
          ) : (
            purchases.map((purchase) => (
              <div
                key={purchase.id}
                className="p-6 rounded-xl border border-slate-800 bg-slate-900/40 hover:border-cyan-500/30 transition-colors"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <span className="text-lg font-bold text-white">
                        {purchase.description}
                      </span>
                      <span className={`text-xs px-2 py-1 rounded font-bold ${
                        purchase.status === 'completed'
                          ? 'bg-green-500/20 text-green-400'
                          : 'bg-yellow-500/20 text-yellow-400'
                      }`}>
                        {purchase.status.toUpperCase()}
                      </span>
                    </div>
                    <p className="text-sm text-slate-400 mb-1">
                      {formatDate(purchase.date)}
                    </p>
                    <p className="text-xs text-slate-600 font-mono">
                      Order ID: {purchase.paypalOrderId}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-black text-cyan-400">
                      ${purchase.amount.toFixed(2)}
                    </p>
                    <p className="text-xs text-slate-500">{purchase.type}</p>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Summary */}
        {purchases.length > 0 && (
          <div className="mt-8 p-6 rounded-xl border border-cyan-500/30 bg-slate-900/80">
            <div className="flex items-center justify-between">
              <span className="text-lg font-bold text-slate-400">Total Purchases</span>
              <span className="text-2xl font-black text-cyan-400">
                ${purchases.reduce((sum, p) => sum + p.amount, 0).toFixed(2)}
              </span>
            </div>
            <p className="text-xs text-slate-600 mt-2">
              {purchases.length} transaction{purchases.length !== 1 ? 's' : ''}
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
