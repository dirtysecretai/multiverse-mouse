"use client"

import { useState, useEffect, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Terminal, RefreshCw, Tag, Crown, Ticket, ArrowLeft
} from "lucide-react"

export default function PromotionsManagerPage() {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [password, setPassword] = useState("")
  const [adminPassword, setAdminPassword] = useState("")

  // Discount codes
  const [discounts, setDiscounts] = useState<any[]>([])
  const [showDiscountForm, setShowDiscountForm] = useState(false)
  const [discountForm, setDiscountForm] = useState({
    code: '',
    type: 'percentage',
    value: '',
    usageLimit: '',
    expiresAt: ''
  })

  // Subscription management
  const [subscriptions, setSubscriptions] = useState<any[]>([])
  const [showSubscriptionForm, setShowSubscriptionForm] = useState(false)
  const [subscriptionForm, setSubscriptionForm] = useState({
    userEmail: '',
    tier: 'prompt-studio-dev',
    endDate: ''
  })

  useEffect(() => {
    const authStatus = localStorage.getItem("multiverse-admin-auth")
    const savedPassword = sessionStorage.getItem("admin-password")

    if (authStatus === "true" && savedPassword) {
      setAdminPassword(savedPassword)
      setIsAuthenticated(true)
      fetchDiscounts(savedPassword)
      fetchSubscriptions(savedPassword)
    } else {
      localStorage.removeItem("multiverse-admin-auth")
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
        setAdminPassword(password)
        sessionStorage.setItem("admin-password", password)
        setIsAuthenticated(true)
        localStorage.setItem("multiverse-admin-auth", "true")
        fetchDiscounts(password)
        fetchSubscriptions(password)
      } else {
        alert("Invalid password")
      }
    } catch (error) {
      console.error("Auth error:", error)
      alert("Authentication failed")
    }
  }

  const fetchDiscounts = async (pwd?: string) => {
    const passToUse = pwd || adminPassword
    if (!passToUse) return

    try {
      const res = await fetch(`/api/admin/discounts?password=${passToUse}`)
      if (res.ok) {
        const data = await res.json()
        setDiscounts(data)
      }
    } catch (error) {
      console.error('Failed to fetch discounts:', error)
    }
  }

  const fetchSubscriptions = async (pwd?: string) => {
    const passToUse = pwd || adminPassword
    if (!passToUse) return

    try {
      const res = await fetch(`/api/admin/subscriptions?password=${passToUse}`)
      if (res.ok) {
        const data = await res.json()
        setSubscriptions(data)
      }
    } catch (error) {
      console.error('Failed to fetch subscriptions:', error)
    }
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-[#050810] flex items-center justify-center p-6">
        <div className="w-full max-w-md p-8 rounded-2xl border-2 border-cyan-500/30 bg-slate-900/80 backdrop-blur-sm">
          <div className="text-center mb-8">
            <Terminal className="mx-auto text-cyan-400 mb-4" size={48} />
            <h1 className="text-2xl font-black text-cyan-400">ADMIN_ACCESS</h1>
            <p className="text-sm text-slate-500 mt-2">Promotions Manager</p>
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
      <div className="fixed top-20 left-20 w-96 h-96 bg-cyan-500/5 rounded-full blur-3xl" />
      <div className="fixed bottom-20 right-20 w-96 h-96 bg-fuchsia-500/5 rounded-full blur-3xl" />

      <div className="relative z-10 p-6 max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-green-400 to-emerald-500 flex items-center gap-3">
              <Tag size={32} /> PROMOTIONS_MANAGER
            </h1>
            <p className="text-slate-500 text-sm mt-1">Discount codes, subscriptions & free tickets</p>
          </div>
          <div className="flex gap-2">
            <Button
              onClick={() => window.location.href = '/admin'}
              className="bg-slate-700 hover:bg-slate-600 text-white"
            >
              <ArrowLeft size={16} className="mr-2" /> Back to Admin
            </Button>
            <Button
              onClick={() => {
                fetchDiscounts()
                fetchSubscriptions()
              }}
              className="bg-cyan-500 hover:bg-cyan-400 text-black"
            >
              <RefreshCw size={16} />
            </Button>
          </div>
        </div>

        {/* DISCOUNT CODE MANAGER - PROMOTIONS */}
        <div className="mb-12">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-green-400 flex items-center gap-2">
              <Tag size={20} /> DISCOUNT_CODES
            </h2>
            <Button
              onClick={() => setShowDiscountForm(!showDiscountForm)}
              className="bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-400 hover:to-emerald-400 text-black font-bold"
            >
              {showDiscountForm ? 'Cancel' : '+ Create Discount Code'}
            </Button>
          </div>

          {/* Create Discount Form */}
          {showDiscountForm && (
            <div className="mb-6 p-6 rounded-xl border border-green-500/30 bg-slate-900/80 backdrop-blur-sm">
              <h3 className="text-lg font-bold text-green-400 mb-4">Create New Discount Code</h3>
              <form onSubmit={async (e) => {
                e.preventDefault()

                try {
                  const res = await fetch('/api/admin/discounts', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      password: adminPassword,
                      ...discountForm
                    })
                  })

                  if (res.ok) {
                    alert('Discount code created!')
                    setDiscountForm({
                      code: '',
                      type: 'percentage',
                      value: '',
                      usageLimit: '',
                      expiresAt: ''
                    })
                    setShowDiscountForm(false)
                    fetchDiscounts()
                  } else {
                    const error = await res.json()
                    alert('Failed: ' + error.error)
                  }
                } catch (error) {
                  alert('Failed to create discount code')
                }
              }} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  {/* Code Input */}
                  <div>
                    <label className="block text-xs font-bold text-green-400 mb-2">CODE</label>
                    <Input
                      value={discountForm.code}
                      onChange={(e) => setDiscountForm({...discountForm, code: e.target.value.toUpperCase()})}
                      placeholder="LAUNCH20"
                      required
                      className="bg-slate-950 border-slate-700 text-white uppercase"
                    />
                  </div>

                  {/* Type Select */}
                  <div>
                    <label className="block text-xs font-bold text-green-400 mb-2">TYPE</label>
                    <Select
                      value={discountForm.type}
                      onValueChange={(val) => setDiscountForm({...discountForm, type: val})}
                    >
                      <SelectTrigger className="bg-slate-950 border-slate-700 text-white">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="percentage">Percentage Off (%)</SelectItem>
                        <SelectItem value="fixed">Fixed Amount ($)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Value Input */}
                  <div>
                    <label className="block text-xs font-bold text-green-400 mb-2">
                      VALUE ({discountForm.type === 'percentage' ? '%' : '$'})
                    </label>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      value={discountForm.value}
                      onChange={(e) => setDiscountForm({...discountForm, value: e.target.value})}
                      placeholder={discountForm.type === 'percentage' ? '20' : '5.00'}
                      required
                      className="bg-slate-950 border-slate-700 text-white"
                    />
                  </div>

                  {/* Usage Limit */}
                  <div>
                    <label className="block text-xs font-bold text-green-400 mb-2">
                      USAGE LIMIT (optional)
                    </label>
                    <Input
                      type="number"
                      min="1"
                      value={discountForm.usageLimit}
                      onChange={(e) => setDiscountForm({...discountForm, usageLimit: e.target.value})}
                      placeholder="Unlimited"
                      className="bg-slate-950 border-slate-700 text-white"
                    />
                  </div>

                  {/* Expiration Date */}
                  <div className="col-span-2">
                    <label className="block text-xs font-bold text-green-400 mb-2">
                      EXPIRES AT (optional)
                    </label>
                    <Input
                      type="datetime-local"
                      value={discountForm.expiresAt}
                      onChange={(e) => setDiscountForm({...discountForm, expiresAt: e.target.value})}
                      className="bg-slate-950 border-slate-700 text-white"
                    />
                  </div>
                </div>

                <Button type="submit" className="w-full bg-green-500 hover:bg-green-400 text-black font-bold">
                  Create Discount Code
                </Button>
              </form>
            </div>
          )}

          {/* Discount Codes List */}
          <div className="space-y-3">
            {discounts.map((discount) => (
              <div key={discount.id} className="p-4 rounded-lg border border-slate-800 bg-slate-900/50 flex items-center justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-1">
                    <code className="text-lg font-bold text-green-400 bg-slate-950 px-3 py-1 rounded">
                      {discount.code}
                    </code>
                    {!discount.isActive && (
                      <span className="text-xs bg-red-500/20 text-red-400 px-2 py-1 rounded font-bold">
                        INACTIVE
                      </span>
                    )}
                    {discount.expiresAt && new Date(discount.expiresAt) < new Date() && (
                      <span className="text-xs bg-yellow-500/20 text-yellow-400 px-2 py-1 rounded font-bold">
                        EXPIRED
                      </span>
                    )}
                  </div>
                  <div className="text-sm text-slate-400 flex items-center gap-4 flex-wrap">
                    <span className="font-medium">
                      {discount.type === 'percentage'
                        ? `${discount.value}% off`
                        : `$${discount.value.toFixed(2)} off`}
                    </span>
                    <span>
                      Used: <span className="text-cyan-400 font-bold">{discount._count?.usedBy || 0}</span>
                      {discount.usageLimit && ` / ${discount.usageLimit}`}
                    </span>
                    {discount.expiresAt && (
                      <span>
                        Expires: {new Date(discount.expiresAt).toLocaleDateString()}
                      </span>
                    )}
                    <span className="text-xs text-slate-600">
                      Created: {new Date(discount.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                </div>
                <div className="flex gap-2 ml-4">
                  <Button
                    onClick={async () => {
                      await fetch('/api/admin/discounts', {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                          password: adminPassword,
                          id: discount.id,
                          isActive: !discount.isActive
                        })
                      })
                      fetchDiscounts()
                    }}
                    size="sm"
                    className={discount.isActive
                      ? "bg-yellow-500 hover:bg-yellow-400 text-black font-bold"
                      : "bg-green-500 hover:bg-green-400 text-black font-bold"
                    }
                  >
                    {discount.isActive ? 'Deactivate' : 'Activate'}
                  </Button>
                  <Button
                    onClick={async () => {
                      if (confirm(`Delete discount code "${discount.code}"?`)) {
                        await fetch(`/api/admin/discounts?password=${adminPassword}&id=${discount.id}`, {
                          method: 'DELETE'
                        })
                        fetchDiscounts()
                      }
                    }}
                    size="sm"
                    className="bg-red-500 hover:bg-red-400 text-white font-bold"
                  >
                    Delete
                  </Button>
                </div>
              </div>
            ))}

            {discounts.length === 0 && (
              <div className="text-center py-12 text-slate-500 border border-slate-800 rounded-lg bg-slate-900/30">
                <Tag size={48} className="mx-auto mb-3 text-slate-700" />
                <p className="text-lg font-bold mb-1">No discount codes yet</p>
                <p className="text-sm">Create your first discount code to get started!</p>
              </div>
            )}
          </div>
        </div>

        {/* SUBSCRIPTION MANAGER */}
        <div className="mb-12">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-purple-400 flex items-center gap-2">
              <Crown size={20} /> SUBSCRIPTION_MANAGER
            </h2>
            <Button
              onClick={() => setShowSubscriptionForm(!showSubscriptionForm)}
              className="bg-gradient-to-r from-purple-500 to-cyan-500 hover:from-purple-400 hover:to-cyan-400 text-white font-bold"
            >
              {showSubscriptionForm ? 'Cancel' : '+ Grant Subscription'}
            </Button>
          </div>

          {/* Create Subscription Form */}
          {showSubscriptionForm && (
            <div className="mb-6 p-6 rounded-xl border border-purple-500/30 bg-slate-900/80 backdrop-blur-sm">
              <h3 className="text-lg font-bold text-purple-400 mb-4">Grant Subscription Access</h3>
              <form onSubmit={async (e) => {
                e.preventDefault()

                try {
                  const res = await fetch('/api/admin/subscriptions', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      password: adminPassword,
                      ...subscriptionForm
                    })
                  })

                  const data = await res.json()

                  if (res.ok) {
                    alert(`Subscription granted to ${subscriptionForm.userEmail}!`)
                    setSubscriptionForm({
                      userEmail: '',
                      tier: 'prompt-studio-dev',
                      endDate: ''
                    })
                    setShowSubscriptionForm(false)
                    fetchSubscriptions()
                  } else {
                    alert('Failed: ' + data.error)
                  }
                } catch (error) {
                  alert('Failed to grant subscription')
                }
              }} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  {/* User Email */}
                  <div>
                    <label className="block text-xs font-bold text-purple-400 mb-2">USER EMAIL</label>
                    <Input
                      type="email"
                      value={subscriptionForm.userEmail}
                      onChange={(e) => setSubscriptionForm({...subscriptionForm, userEmail: e.target.value})}
                      placeholder="user@example.com"
                      required
                      className="bg-slate-950 border-slate-700 text-white"
                    />
                  </div>

                  {/* Tier Select */}
                  <div>
                    <label className="block text-xs font-bold text-purple-400 mb-2">SUBSCRIPTION TIER</label>
                    <Select
                      value={subscriptionForm.tier}
                      onValueChange={(val) => setSubscriptionForm({...subscriptionForm, tier: val})}
                    >
                      <SelectTrigger className="bg-slate-950 border-slate-700 text-white">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="prompt-studio-dev">Prompt Studio Dev Tier</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* End Date */}
                  <div className="col-span-2">
                    <label className="block text-xs font-bold text-purple-400 mb-2">
                      END DATE (leave empty for lifetime access)
                    </label>
                    <Input
                      type="datetime-local"
                      value={subscriptionForm.endDate}
                      onChange={(e) => setSubscriptionForm({...subscriptionForm, endDate: e.target.value})}
                      className="bg-slate-950 border-slate-700 text-white"
                    />
                  </div>
                </div>

                <Button type="submit" className="w-full bg-purple-500 hover:bg-purple-400 text-white font-bold">
                  Grant Subscription
                </Button>
              </form>
            </div>
          )}

          {/* Subscriptions List */}
          <div className="space-y-3">
            {subscriptions.map((sub) => (
              <div key={sub.id} className="p-4 rounded-lg border border-slate-800 bg-slate-900/50 flex items-center justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-1">
                    <span className="text-lg font-bold text-purple-400">
                      {sub.user?.email || 'Unknown User'}
                    </span>
                    <span className={`text-xs px-2 py-1 rounded font-bold ${
                      sub.status === 'active'
                        ? 'bg-green-500/20 text-green-400'
                        : sub.status === 'cancelled'
                        ? 'bg-yellow-500/20 text-yellow-400'
                        : 'bg-red-500/20 text-red-400'
                    }`}>
                      {sub.status.toUpperCase()}
                    </span>
                    {sub.endDate && new Date(sub.endDate) < new Date() && (
                      <span className="text-xs bg-red-500/20 text-red-400 px-2 py-1 rounded font-bold">
                        EXPIRED
                      </span>
                    )}
                  </div>
                  <div className="text-sm text-slate-400 flex items-center gap-4 flex-wrap">
                    <span className="font-medium text-cyan-400">{sub.tier}</span>
                    <span>
                      Started: {new Date(sub.startDate).toLocaleDateString()}
                    </span>
                    {sub.endDate ? (
                      <span>
                        Ends: {new Date(sub.endDate).toLocaleDateString()}
                      </span>
                    ) : (
                      <span className="text-green-400">Lifetime Access</span>
                    )}
                  </div>
                </div>
                <div className="flex gap-2 ml-4">
                  {sub.status === 'active' && (
                    <Button
                      onClick={async () => {
                        if (confirm(`Revoke subscription for ${sub.user?.email}?`)) {
                          await fetch('/api/admin/subscriptions', {
                            method: 'PUT',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                              password: adminPassword,
                              id: sub.id,
                              status: 'cancelled'
                            })
                          })
                          fetchSubscriptions()
                        }
                      }}
                      size="sm"
                      className="bg-yellow-500 hover:bg-yellow-400 text-black font-bold"
                    >
                      Revoke
                    </Button>
                  )}
                  {sub.status !== 'active' && (
                    <Button
                      onClick={async () => {
                        await fetch('/api/admin/subscriptions', {
                          method: 'PUT',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({
                            password: adminPassword,
                            id: sub.id,
                            status: 'active'
                          })
                        })
                        fetchSubscriptions()
                      }}
                      size="sm"
                      className="bg-green-500 hover:bg-green-400 text-black font-bold"
                    >
                      Reactivate
                    </Button>
                  )}
                  <Button
                    onClick={async () => {
                      if (confirm(`Delete subscription for ${sub.user?.email}?`)) {
                        await fetch(`/api/admin/subscriptions?password=${adminPassword}&id=${sub.id}`, {
                          method: 'DELETE'
                        })
                        fetchSubscriptions()
                      }
                    }}
                    size="sm"
                    className="bg-red-500 hover:bg-red-400 text-white font-bold"
                  >
                    Delete
                  </Button>
                </div>
              </div>
            ))}

            {subscriptions.length === 0 && (
              <div className="text-center py-12 text-slate-500 border border-slate-800 rounded-lg bg-slate-900/30">
                <Crown size={48} className="mx-auto mb-3 text-slate-700" />
                <p className="text-lg font-bold mb-1">No subscriptions yet</p>
                <p className="text-sm">Grant subscription access to users above!</p>
              </div>
            )}
          </div>
        </div>

        {/* FREE TICKETS MANAGER */}
        <div className="mb-12">
          <h2 className="text-xl font-bold text-fuchsia-400 mb-4 font-mono flex items-center gap-2">
            <Ticket size={20} /> FREE_TICKETS_MANAGER
          </h2>

          <div className="p-6 rounded-xl border border-fuchsia-500/30 bg-slate-900/80 backdrop-blur-sm">
            <form onSubmit={async (e) => {
              e.preventDefault()
              const formData = new FormData(e.currentTarget)
              const userEmail = formData.get('userEmail') as string
              const ticketsToAdd = parseInt(formData.get('ticketsToAdd') as string)

              if (!userEmail || !ticketsToAdd || ticketsToAdd < 1) {
                alert('Please fill in all fields')
                return
              }

              try {
                const res = await fetch('/api/admin/give-tickets', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ password: adminPassword, userEmail, ticketsToAdd }),
                })

                const data = await res.json()

                if (data.success) {
                  alert(`Success! Added ${ticketsToAdd} tickets to ${userEmail}. New balance: ${data.newBalance}`)
                  e.currentTarget.reset()
                } else {
                  alert('Error: ' + data.error)
                }
              } catch (error) {
                alert('Request failed')
              }
            }}>
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-xs font-bold text-cyan-400 mb-2">USER_EMAIL</label>
                  <Input
                    name="userEmail"
                    type="email"
                    placeholder="user@example.com"
                    className="bg-slate-950 border-slate-700 text-white"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-cyan-400 mb-2">TICKETS_TO_ADD</label>
                  <Input
                    name="ticketsToAdd"
                    type="number"
                    min="1"
                    placeholder="10"
                    className="bg-slate-950 border-slate-700 text-white"
                    required
                  />
                </div>
              </div>

              <Button type="submit" className="w-full bg-gradient-to-r from-fuchsia-500 to-pink-500 hover:from-fuchsia-400 hover:to-pink-400 text-white font-bold">
                GRANT FREE TICKETS
              </Button>
            </form>

            <div className="mt-4 p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/30">
              <p className="text-xs text-yellow-400">
                This will add tickets to the user's account for free (no charge). Use for testing or promotions.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
