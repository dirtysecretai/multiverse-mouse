"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Terminal, RefreshCw, ArrowLeft, Users as UsersIcon, Search, ChevronDown, ChevronUp, Crown, Ticket, DollarSign, Calendar, Tag, ArrowUpDown
} from "lucide-react"

interface UserData {
  id: number
  email: string
  name: string | null
  createdAt: string
  ticketBalance: number
  totalTicketsBought: number
  totalTicketsUsed: number
  hasDevTier: boolean
  subscription: any | null
  recentPurchases: any[]
  recentTicketPurchases: any[]
  totalSpent: number
  totalPurchases: number
}

interface Stats {
  totalUsers: number
  devTierUsers: number
  freeUsers: number
}

export default function AdminUsersPage() {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [password, setPassword] = useState("")
  const [isLoading, setIsLoading] = useState(true)
  const [users, setUsers] = useState<UserData[]>([])
  const [stats, setStats] = useState<Stats>({ totalUsers: 0, devTierUsers: 0, freeUsers: 0 })
  const [searchQuery, setSearchQuery] = useState("")
  const [filterTier, setFilterTier] = useState<'all' | 'dev' | 'free'>('all')
  const [expandedUserId, setExpandedUserId] = useState<number | null>(null)
  const [sortBy, setSortBy] = useState<'totalSpent' | 'ticketBalance' | 'totalBought' | 'totalUsed'>('totalSpent')

  useEffect(() => {
    const authStatus = localStorage.getItem("multiverse-admin-auth")
    const savedPassword = sessionStorage.getItem("admin-password")

    if (authStatus === "true" && savedPassword) {
      setIsAuthenticated(true)
      fetchUsers()
    } else {
      localStorage.removeItem("multiverse-admin-auth")
      setIsLoading(false)
    }
  }, [])

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()

    try {
      const response = await fetch('/api/admin/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password })
      })

      if (response.ok) {
        sessionStorage.setItem("admin-password", password)
        setIsAuthenticated(true)
        localStorage.setItem("multiverse-admin-auth", "true")
        fetchUsers()
      } else {
        alert("Invalid password")
      }
    } catch (error) {
      console.error("Auth error:", error)
      alert("Authentication failed")
    }
  }

  const fetchUsers = async () => {
    setIsLoading(true)
    try {
      const res = await fetch('/api/admin/users')
      const data = await res.json()

      if (data.success) {
        setUsers(data.users)
        setStats({
          totalUsers: data.totalUsers,
          devTierUsers: data.devTierUsers,
          freeUsers: data.freeUsers
        })
      }
    } catch (err) {
      console.error("Failed to fetch users:", err)
    } finally {
      setIsLoading(false)
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    })
  }

  const formatDateTime = (dateString: string) => {
    return new Date(dateString).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    })
  }

  // Filter and sort users
  const filteredUsers = users
    .filter(user => {
      const matchesSearch = user.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                           user.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                           false
      const matchesTier = filterTier === 'all' ||
                         (filterTier === 'dev' && user.hasDevTier) ||
                         (filterTier === 'free' && !user.hasDevTier)
      return matchesSearch && matchesTier
    })
    .sort((a, b) => {
      switch (sortBy) {
        case 'totalSpent':
          return b.totalSpent - a.totalSpent
        case 'ticketBalance':
          return b.ticketBalance - a.ticketBalance
        case 'totalBought':
          return b.totalTicketsBought - a.totalTicketsBought
        case 'totalUsed':
          return b.totalTicketsUsed - a.totalTicketsUsed
        default:
          return 0
      }
    })

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-[#050810] flex items-center justify-center p-6">
        <div className="w-full max-w-md p-8 rounded-2xl border-2 border-cyan-500/30 bg-slate-900/80 backdrop-blur-sm">
          <div className="text-center mb-8">
            <Terminal className="mx-auto text-cyan-400 mb-4" size={48} />
            <h1 className="text-2xl font-black text-cyan-400">ADMIN_ACCESS</h1>
            <p className="text-sm text-slate-500 mt-2">Authorized personnel only</p>
          </div>
          <form onSubmit={handleLogin}>
            <Input
              type="password"
              placeholder="Enter password..."
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="bg-slate-950 border-slate-700 text-white mb-4"
            />
            <Button type="submit" className="w-full bg-cyan-500 hover:bg-cyan-400 text-black font-bold">
              AUTHENTICATE
            </Button>
          </form>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#050810] relative overflow-hidden">
      <div className="fixed inset-0 bg-[linear-gradient(rgba(0,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(0,255,255,0.02)_1px,transparent_1px)] bg-[size:40px_40px] pointer-events-none" />
      <div className="fixed top-20 left-20 w-96 h-96 bg-purple-500/5 rounded-full blur-3xl" />
      <div className="fixed bottom-20 right-20 w-96 h-96 bg-cyan-500/5 rounded-full blur-3xl" />

      <div className="relative z-10 p-6 max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-cyan-400 flex items-center gap-3">
              <UsersIcon size={32} /> USER_MANAGEMENT
            </h1>
            <p className="text-slate-500 text-sm mt-1">View user accounts and transaction history</p>
          </div>
          <div className="flex gap-2">
            <Button
              onClick={() => window.location.href = '/admin'}
              className="bg-slate-700 hover:bg-slate-600 text-white"
            >
              <ArrowLeft size={16} className="mr-2" /> Back
            </Button>
            <Button onClick={fetchUsers} disabled={isLoading} className="bg-cyan-500 hover:bg-cyan-400 text-black">
              <RefreshCw className={isLoading ? 'animate-spin' : ''} size={16} />
            </Button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <div className="p-6 rounded-xl border-2 border-purple-500/30 bg-slate-900/60">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-400 mb-1">Total Users</p>
                <p className="text-3xl font-black text-white">{stats.totalUsers}</p>
              </div>
              <UsersIcon className="text-purple-400" size={40} />
            </div>
          </div>
          <div className="p-6 rounded-xl border-2 border-cyan-500/30 bg-slate-900/60">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-400 mb-1">Dev Tier Users</p>
                <p className="text-3xl font-black text-cyan-400">{stats.devTierUsers}</p>
              </div>
              <Crown className="text-cyan-400" size={40} />
            </div>
          </div>
          <div className="p-6 rounded-xl border-2 border-slate-700 bg-slate-900/60">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-400 mb-1">Free Tier Users</p>
                <p className="text-3xl font-black text-slate-300">{stats.freeUsers}</p>
              </div>
              <UsersIcon className="text-slate-400" size={40} />
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-col md:flex-row gap-4 mb-6">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
            <Input
              type="text"
              placeholder="Search by email or name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 bg-slate-900 border-slate-700 text-white"
            />
          </div>

          {/* Tier Filter */}
          <div className="flex gap-2">
            <Button
              onClick={() => setFilterTier('all')}
              className={filterTier === 'all' ? 'bg-purple-500 text-white' : 'bg-slate-800 text-slate-300'}
            >
              All
            </Button>
            <Button
              onClick={() => setFilterTier('dev')}
              className={filterTier === 'dev' ? 'bg-cyan-500 text-black' : 'bg-slate-800 text-slate-300'}
            >
              Dev Tier
            </Button>
            <Button
              onClick={() => setFilterTier('free')}
              className={filterTier === 'free' ? 'bg-slate-600 text-white' : 'bg-slate-800 text-slate-300'}
            >
              Free Tier
            </Button>
          </div>
        </div>

        {/* Sort Options */}
        <div className="mb-6 p-4 rounded-xl bg-slate-900/60 border border-slate-800">
          <div className="flex items-center gap-3 mb-3">
            <ArrowUpDown size={16} className="text-cyan-400" />
            <span className="text-sm font-bold text-white">Sort By (Highest to Lowest):</span>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              onClick={() => setSortBy('totalSpent')}
              className={`text-sm ${sortBy === 'totalSpent' ? 'bg-green-500 text-white' : 'bg-slate-800 text-slate-300'}`}
            >
              <DollarSign size={14} className="mr-1" />
              Total Spent
            </Button>
            <Button
              onClick={() => setSortBy('ticketBalance')}
              className={`text-sm ${sortBy === 'ticketBalance' ? 'bg-yellow-500 text-black' : 'bg-slate-800 text-slate-300'}`}
            >
              <Ticket size={14} className="mr-1" />
              Current Tickets
            </Button>
            <Button
              onClick={() => setSortBy('totalBought')}
              className={`text-sm ${sortBy === 'totalBought' ? 'bg-cyan-500 text-black' : 'bg-slate-800 text-slate-300'}`}
            >
              <Ticket size={14} className="mr-1" />
              Tickets Bought
            </Button>
            <Button
              onClick={() => setSortBy('totalUsed')}
              className={`text-sm ${sortBy === 'totalUsed' ? 'bg-red-500 text-white' : 'bg-slate-800 text-slate-300'}`}
            >
              <Ticket size={14} className="mr-1" />
              Tickets Used
            </Button>
          </div>
        </div>

        {/* Users List */}
        {isLoading ? (
          <div className="text-center py-12">
            <RefreshCw className="animate-spin mx-auto text-cyan-400 mb-4" size={40} />
            <p className="text-slate-400">Loading users...</p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredUsers.map((user) => (
              <div key={user.id} className={`p-6 rounded-xl border-2 bg-slate-900/60 backdrop-blur-sm ${user.hasDevTier ? 'border-cyan-500/30' : 'border-slate-800'}`}>
                {/* User Header */}
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-4">
                    <div className={`w-12 h-12 rounded-full ${user.hasDevTier ? 'bg-gradient-to-r from-cyan-500 to-purple-500' : 'bg-slate-700'} flex items-center justify-center`}>
                      <span className="text-white font-bold text-lg">
                        {user.email?.[0]?.toUpperCase() || '?'}
                      </span>
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="text-lg font-bold text-white">{user.email || 'No email'}</p>
                        {user.hasDevTier && (
                          <span className="px-2 py-1 text-xs font-bold rounded-full bg-gradient-to-r from-cyan-500 to-purple-500 text-white">
                            DEV TIER
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-slate-400">Joined {formatDate(user.createdAt)}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => setExpandedUserId(expandedUserId === user.id ? null : user.id)}
                    className="text-slate-400 hover:text-white transition-colors"
                  >
                    {expandedUserId === user.id ? <ChevronUp size={24} /> : <ChevronDown size={24} />}
                  </button>
                </div>

                {/* Quick Stats */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                  <div className="p-3 rounded-lg bg-slate-950/50 border border-slate-800">
                    <div className="flex items-center gap-2 mb-1">
                      <Ticket size={14} className="text-yellow-400" />
                      <p className="text-xs text-slate-400">Tickets</p>
                    </div>
                    <p className="text-lg font-bold text-white">{user.ticketBalance}</p>
                  </div>
                  <div className="p-3 rounded-lg bg-slate-950/50 border border-slate-800">
                    <div className="flex items-center gap-2 mb-1">
                      <DollarSign size={14} className="text-green-400" />
                      <p className="text-xs text-slate-400">Total Spent</p>
                    </div>
                    <p className="text-lg font-bold text-white">${user.totalSpent.toFixed(2)}</p>
                  </div>
                  <div className="p-3 rounded-lg bg-slate-950/50 border border-slate-800">
                    <div className="flex items-center gap-2 mb-1">
                      <Ticket size={14} className="text-cyan-400" />
                      <p className="text-xs text-slate-400">Bought</p>
                    </div>
                    <p className="text-lg font-bold text-white">{user.totalTicketsBought}</p>
                  </div>
                  <div className="p-3 rounded-lg bg-slate-950/50 border border-slate-800">
                    <div className="flex items-center gap-2 mb-1">
                      <Ticket size={14} className="text-red-400" />
                      <p className="text-xs text-slate-400">Used</p>
                    </div>
                    <p className="text-lg font-bold text-white">{user.totalTicketsUsed}</p>
                  </div>
                </div>

                {/* Expanded Details */}
                {expandedUserId === user.id && (
                  <div className="pt-4 border-t border-slate-800 space-y-4">
                    {/* Subscription Info */}
                    {user.subscription && (
                      <div className="p-4 rounded-lg bg-cyan-500/10 border border-cyan-500/30">
                        <h3 className="text-sm font-bold text-cyan-400 mb-3 flex items-center gap-2">
                          <Crown size={16} /> ACTIVE SUBSCRIPTION
                        </h3>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                          <div>
                            <p className="text-slate-400 mb-1">Plan</p>
                            <p className="text-white font-bold capitalize">{user.subscription.billingCycle || 'Monthly'}</p>
                          </div>
                          <div>
                            <p className="text-slate-400 mb-1">Amount</p>
                            <p className="text-white font-bold">${user.subscription.billingAmount?.toFixed(2) || 'N/A'}</p>
                          </div>
                          <div>
                            <p className="text-slate-400 mb-1">Next Billing</p>
                            <p className="text-white font-bold">{user.subscription.nextBillingDate ? formatDate(user.subscription.nextBillingDate) : 'N/A'}</p>
                          </div>
                          <div>
                            <p className="text-slate-400 mb-1">Started</p>
                            <p className="text-white font-bold">{formatDate(user.subscription.createdAt)}</p>
                          </div>
                        </div>
                        {user.subscription.metadata?.ticketsPerCycle && (
                          <div className="mt-3 p-2 rounded bg-green-500/10 border border-green-500/30">
                            <p className="text-xs text-green-400">
                              <Ticket size={12} className="inline mr-1" />
                              {user.subscription.metadata.ticketsPerCycle} tickets per billing cycle
                            </p>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Purchase History */}
                    {(user.recentPurchases.length > 0 || user.recentTicketPurchases.length > 0) && (
                      <div>
                        <h3 className="text-sm font-bold text-white mb-3 flex items-center gap-2">
                          <DollarSign size={16} /> RECENT TRANSACTIONS
                        </h3>
                        <div className="space-y-2">
                          {/* Ticket Purchases */}
                          {user.recentTicketPurchases.map((purchase) => (
                            <div key={`ticket-${purchase.id}`} className="p-3 rounded-lg bg-slate-950/50 border border-slate-800 text-xs">
                              <div className="flex items-center justify-between mb-2">
                                <div className="flex items-center gap-2">
                                  <Ticket size={14} className="text-yellow-400" />
                                  <span className="font-bold text-white">{purchase.tickets} Tickets</span>
                                  {purchase.discountCode && (
                                    <span className="px-2 py-0.5 rounded-full bg-green-500/20 text-green-400 text-[10px] font-bold flex items-center gap-1">
                                      <Tag size={10} /> {purchase.discountCode}
                                    </span>
                                  )}
                                </div>
                                <span className="font-bold text-green-400">${purchase.amount.toFixed(2)}</span>
                              </div>
                              <div className="flex items-center justify-between text-slate-500">
                                <span>{formatDateTime(purchase.date)}</span>
                                {purchase.originalAmount && purchase.discountAmount && (
                                  <span className="text-green-400">
                                    Saved: ${purchase.discountAmount.toFixed(2)}
                                  </span>
                                )}
                              </div>
                            </div>
                          ))}

                          {/* Other Purchases */}
                          {user.recentPurchases.map((purchase) => (
                            <div key={`purchase-${purchase.id}`} className="p-3 rounded-lg bg-slate-950/50 border border-slate-800 text-xs">
                              <div className="flex items-center justify-between mb-2">
                                <div className="flex items-center gap-2">
                                  <DollarSign size={14} className="text-purple-400" />
                                  <span className="font-bold text-white capitalize">{purchase.type}</span>
                                  {purchase.discountCode && (
                                    <span className="px-2 py-0.5 rounded-full bg-green-500/20 text-green-400 text-[10px] font-bold flex items-center gap-1">
                                      <Tag size={10} /> {purchase.discountCode}
                                    </span>
                                  )}
                                </div>
                                <span className="font-bold text-green-400">${purchase.amount.toFixed(2)}</span>
                              </div>
                              <div className="flex items-center justify-between text-slate-500">
                                <span>{formatDateTime(purchase.date)}</span>
                                {purchase.description && <span className="text-slate-400">{purchase.description}</span>}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}

            {filteredUsers.length === 0 && (
              <div className="text-center py-12">
                <UsersIcon className="mx-auto text-slate-600 mb-4" size={48} />
                <p className="text-slate-400">No users found matching your filters</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
