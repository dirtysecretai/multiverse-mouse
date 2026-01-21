"use client"

import { useState, useEffect } from 'react'
import { Activity, Zap, Crown, Sparkles, ExternalLink, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface ModelUsage {
  id: string
  name: string
  limits: {
    rpm: number
    rpd: number
  }
  usage: {
    rpm: number
    rpd: number
  }
  ticketCost: number
}

interface RateLimitsDashboardProps {
  adminPassword: string
}

export function RateLimitsDashboard({ adminPassword }: RateLimitsDashboardProps) {
  const [models, setModels] = useState<ModelUsage[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [lastUpdated, setLastUpdated] = useState<string | null>(null)

  const fetchRateLimits = async () => {
    setIsLoading(true)
    try {
      const res = await fetch(`/api/admin/rate-limits?password=${adminPassword}`)
      if (res.ok) {
        const data = await res.json()
        setModels(data.models)
        setLastUpdated(new Date(data.lastUpdated).toLocaleTimeString())
      }
    } catch (error) {
      console.error('Failed to fetch rate limits:', error)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchRateLimits()
    // Refresh every 60 seconds
    const interval = setInterval(fetchRateLimits, 60000)
    return () => clearInterval(interval)
  }, [adminPassword])

  const getUsageColor = (usage: number, limit: number) => {
    const percentage = (usage / limit) * 100
    if (percentage >= 90) return 'text-red-400'
    if (percentage >= 70) return 'text-yellow-400'
    return 'text-green-400'
  }

  const getUsageBar = (usage: number, limit: number) => {
    const percentage = Math.min((usage / limit) * 100, 100)
    let colorClass = 'bg-green-500'
    if (percentage >= 90) colorClass = 'bg-red-500'
    else if (percentage >= 70) colorClass = 'bg-yellow-500'

    return (
      <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
        <div 
          className={`h-full ${colorClass} transition-all duration-300`}
          style={{ width: `${percentage}%` }}
        />
      </div>
    )
  }

  const getTierIcon = (ticketCost: number) => {
    if (ticketCost >= 5) return <Sparkles size={14} className="text-yellow-400" />
    if (ticketCost >= 2) return <Crown size={14} className="text-fuchsia-400" />
    return <Zap size={14} className="text-cyan-400" />
  }

  return (
    <div className="mb-12">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-bold flex items-center gap-2 text-cyan-400">
          <Activity size={20} /> AI_MODEL_RATE_LIMITS
        </h2>
        <div className="flex items-center gap-4">
          {lastUpdated && (
            <span className="text-xs text-slate-500">Updated: {lastUpdated}</span>
          )}
          <Button
            onClick={fetchRateLimits}
            disabled={isLoading}
            className="bg-slate-700 hover:bg-slate-600 h-8 text-xs"
          >
            <RefreshCw size={12} className={isLoading ? 'animate-spin' : ''} />
          </Button>
          <Button
            onClick={() => window.open('https://aistudio.google.com/usage', '_blank')}
            className="bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-400 h-8 text-xs"
          >
            <ExternalLink size={12} className="mr-1" /> Google AI Studio
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {models.map((model) => (
          <div key={model.id} className="p-4 rounded-xl border border-slate-800 bg-slate-900/60">
            {/* Header */}
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                {getTierIcon(model.ticketCost)}
                <span className="font-bold text-sm text-white">{model.name}</span>
              </div>
              <span className="text-xs px-2 py-1 rounded bg-slate-800 text-slate-400">
                {model.ticketCost} 🎫
              </span>
            </div>

            {/* Daily Limit */}
            <div className="mb-3">
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="text-slate-400">Daily Requests</span>
                <span className={getUsageColor(model.usage.rpd, model.limits.rpd)}>
                  {model.usage.rpd} / {model.limits.rpd}
                </span>
              </div>
              {getUsageBar(model.usage.rpd, model.limits.rpd)}
            </div>

            {/* Per Minute Limit (if applicable) */}
            {model.limits.rpm > 0 && (
              <div>
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="text-slate-400">Per Minute</span>
                  <span className={getUsageColor(model.usage.rpm, model.limits.rpm)}>
                    {model.usage.rpm} / {model.limits.rpm}
                  </span>
                </div>
                {getUsageBar(model.usage.rpm, model.limits.rpm)}
              </div>
            )}

            {/* Status */}
            <div className="mt-3 pt-3 border-t border-slate-800">
              <div className="flex items-center justify-between text-[10px]">
                <span className="text-slate-500">STATUS</span>
                {model.usage.rpd >= model.limits.rpd ? (
                  <span className="text-red-400 font-bold">⚠️ QUOTA EXCEEDED</span>
                ) : (
                  <span className="text-green-400 font-bold">✓ OPERATIONAL</span>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Warning Banner */}
      {models.some(m => m.usage.rpd >= m.limits.rpd) && (
        <div className="mt-4 p-4 rounded-xl border border-red-500 bg-red-500/10">
          <div className="flex items-center gap-2 text-red-400 text-sm font-bold mb-2">
            <Activity size={16} /> RATE LIMIT WARNING
          </div>
          <p className="text-xs text-red-300">
            One or more AI models have exceeded their daily quota. Users may experience errors when trying to generate images with these models.
            Consider upgrading your Google AI tier or switching users to models with available quota.
          </p>
        </div>
      )}

      {/* Info */}
      <div className="mt-4 p-3 rounded-lg border border-slate-800 bg-slate-900/40">
        <p className="text-xs text-slate-400">
          💡 <strong>Note:</strong> Usage tracking is updated in real-time from your database. 
          For official Google rate limits, visit the Google AI Studio dashboard.
          Tier 2+ accounts get higher limits (requires $250+ spending + 30 days).
        </p>
      </div>
    </div>
  )
}
