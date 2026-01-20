"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { PayPalButtons, PayPalScriptProvider } from "@paypal/react-paypal-js"
import { useRouter } from "next/navigation"
import { Ticket, Check, Zap, Crown, Sparkles, TrendingUp, Tag } from "lucide-react"
import Link from "next/link"

interface UserData {
  id: number
  email: string
  ticketBalance: number
}

interface TicketPackage {
  tickets: number
  price: number
  pricePerTicket: number
  popular?: boolean
  bestValue?: boolean
  badge?: string
  icon: React.ReactNode
}

const TICKET_PACKAGES: TicketPackage[] = [
  {
    tickets: 1,
    price: 2.99,
    pricePerTicket: 2.99,
    icon: <Ticket size={32} />,
  },
  {
    tickets: 2,
    price: 3.99,
    pricePerTicket: 2.00,
    popular: true,
    badge: "Save 33%",
    icon: <Zap size={32} />,
  },
  {
    tickets: 5,
    price: 10.00,
    pricePerTicket: 2.00,
    badge: "Save 33%",
    icon: <Sparkles size={32} />,
  },
  {
    tickets: 10,
    price: 20.00,
    pricePerTicket: 2.00,
    badge: "Save 33%",
    icon: <TrendingUp size={32} />,
  },
  {
    tickets: 25,
    price: 40.00,
    pricePerTicket: 1.60,
    bestValue: true,
    badge: "Save 46%",
    icon: <Crown size={32} />,
  },
  {
    tickets: 50,
    price: 79.99,
    pricePerTicket: 1.60,
    badge: "Best Deal",
    icon: <Crown size={32} />,
  },
]

export default function BuyTicketsPage() {
  const router = useRouter()
  const [user, setUser] = useState<UserData | null>(null)
  const [loading, setLoading] = useState(true)
  const [selectedPackage, setSelectedPackage] = useState<TicketPackage | null>(null)
  const [purchasing, setPurchasing] = useState(false)
  const [discountCode, setDiscountCode] = useState("")
  const [appliedDiscount, setAppliedDiscount] = useState<any>(null)
  const [discountError, setDiscountError] = useState("")
  const [checkingDiscount, setCheckingDiscount] = useState(false)
  const [acceptedTOS, setAcceptedTOS] = useState(false)

  useEffect(() => {
    checkAuth()
  }, [])

  const checkAuth = async () => {
    try {
      const res = await fetch('/api/auth/session')
      const data = await res.json()

      if (!data.authenticated) {
        router.push('/login')
        return
      }

      setUser(data.user)
    } catch (error) {
      console.error('Auth check failed:', error)
      router.push('/login')
    } finally {
      setLoading(false)
    }
  }

  const applyDiscountCode = async () => {
    if (!discountCode.trim()) return
    
    setCheckingDiscount(true)
    setDiscountError("")
    
    try {
      const res = await fetch('/api/discount/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: discountCode.trim() })
      })
      
      const data = await res.json()
      
      if (res.ok && data.valid) {
        setAppliedDiscount(data.discount)
        setDiscountError("")
      } else {
        setDiscountError(data.error || 'Invalid discount code')
        setAppliedDiscount(null)
      }
    } catch (error) {
      setDiscountError('Failed to apply discount code')
      setAppliedDiscount(null)
    } finally {
      setCheckingDiscount(false)
    }
  }

  const calculateFinalPrice = () => {
    if (!selectedPackage) return 0
    
    let finalPrice = selectedPackage.price
    
    if (appliedDiscount) {
      if (appliedDiscount.type === 'percentage') {
        finalPrice = finalPrice * (1 - appliedDiscount.value / 100)
      } else if (appliedDiscount.type === 'fixed') {
        finalPrice = Math.max(0, finalPrice - appliedDiscount.value)
      }
    }
    
    return finalPrice
  }

  const createPayPalOrder = async () => {
    if (!selectedPackage) return

    const finalPrice = calculateFinalPrice()

    try {
      const res = await fetch('/api/tickets/purchase', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ticketsCount: selectedPackage.tickets,
          amount: finalPrice,
          discountCode: appliedDiscount?.code || null
        }),
      })

      const data = await res.json()
      return data.orderId
    } catch (error) {
      console.error('Order creation failed:', error)
      throw error
    }
  }

  const onPayPalApprove = async (data: any) => {
    setPurchasing(true)

    try {
      const res = await fetch('/api/tickets/capture', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          orderId: data.orderID,
          discountCode: appliedDiscount?.code || null
        }),
      })

      const result = await res.json()

      if (result.success) {
        setUser(prev => prev ? { ...prev, ticketBalance: result.newBalance } : null)
        alert(`Success! ${result.ticketsAdded} ticket${result.ticketsAdded > 1 ? 's' : ''} added to your account!`)
        router.push('/dashboard')
      } else {
        alert('Purchase failed: ' + result.error)
      }
    } catch (error) {
      console.error('Capture failed:', error)
      alert('Purchase failed. Please try again.')
    } finally {
      setPurchasing(false)
      setSelectedPackage(null)
      setAppliedDiscount(null)
      setDiscountCode("")
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#050810] flex items-center justify-center">
        <div className="text-cyan-400 text-xl font-mono">LOADING...</div>
      </div>
    )
  }

  if (!user) return null

  const finalPrice = calculateFinalPrice()
  const discountAmount = selectedPackage ? selectedPackage.price - finalPrice : 0

  return (
    <PayPalScriptProvider options={{ 
      clientId: process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID || "",
      currency: "USD",
      intent: "capture"
    }}>
      <div className="min-h-screen bg-[#050810] text-white relative overflow-hidden">
        {/* Background effects */}
        <div className="fixed inset-0 bg-[linear-gradient(rgba(0,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(0,255,255,0.02)_1px,transparent_1px)] bg-[size:40px_40px] pointer-events-none" />
        <div className="fixed top-20 left-20 w-96 h-96 bg-cyan-500/5 rounded-full blur-3xl" />
        <div className="fixed bottom-20 right-20 w-96 h-96 bg-fuchsia-500/5 rounded-full blur-3xl" />

        <div className="relative z-10 max-w-7xl mx-auto p-6">
          {/* Header */}
          <div className="mb-8">
            <Link href="/dashboard" className="text-slate-500 hover:text-cyan-400 text-sm mb-4 inline-block">
              ← Back to Dashboard
            </Link>
            <h1 className="text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-fuchsia-500 mb-2">
              BUY TICKETS
            </h1>
            <p className="text-slate-400">1 ticket = 1 AI image generation • High-quality Nano Banana Pro</p>
          </div>

          {/* Current Balance */}
          <div className="mb-8 p-6 rounded-xl border-2 border-cyan-500/30 bg-slate-900/80 backdrop-blur-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-400 mb-1">Current Balance</p>
                <p className="text-3xl font-black text-cyan-400">{user.ticketBalance} Tickets</p>
              </div>
              <Ticket className="text-cyan-400/20" size={64} />
            </div>
          </div>

          {/* Privacy Guarantee Badge */}
          <div className="mb-8 p-4 rounded-xl border-2 border-green-500/30 bg-green-500/5">
            <div className="flex items-start gap-3">
              <div className="text-2xl mt-0.5">🛡️</div>
              <div>
                <h3 className="text-sm font-bold text-green-400 mb-1">Privacy Guarantee</h3>
                <p className="text-xs text-slate-300">
                  Powered by <strong className="text-white">Google Gemini Paid API</strong>. Your prompts and images are <strong className="text-white">never used to train AI models</strong>. Your creativity stays yours.
                </p>
              </div>
            </div>
          </div>

          {/* Package Selection */}
          {!selectedPackage ? (
            <>
              <h2 className="text-2xl font-black text-white mb-6">Choose Your Package</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {TICKET_PACKAGES.map((pkg) => (
                  <div
                    key={pkg.tickets}
                    className={`relative p-6 rounded-xl border-2 transition-all cursor-pointer group ${
                      pkg.bestValue
                        ? 'border-fuchsia-500 bg-gradient-to-br from-fuchsia-500/10 to-transparent'
                        : pkg.popular
                        ? 'border-cyan-500 bg-gradient-to-br from-cyan-500/10 to-transparent'
                        : 'border-slate-800 bg-slate-900/40 hover:border-slate-700'
                    }`}
                    onClick={() => setSelectedPackage(pkg)}
                  >
                    {/* Badge */}
                    {pkg.badge && (
                      <div className={`absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full text-xs font-bold ${
                        pkg.bestValue
                          ? 'bg-fuchsia-500 text-white'
                          : pkg.popular
                          ? 'bg-cyan-500 text-black'
                          : 'bg-yellow-500 text-black'
                      }`}>
                        {pkg.badge}
                      </div>
                    )}

                    {/* Icon */}
                    <div className={`mb-4 ${
                      pkg.bestValue ? 'text-fuchsia-400' : pkg.popular ? 'text-cyan-400' : 'text-slate-500'
                    }`}>
                      {pkg.icon}
                    </div>

                    {/* Tickets */}
                    <div className="mb-4">
                      <p className="text-4xl font-black text-white mb-1">{pkg.tickets}</p>
                      <p className="text-sm text-slate-400">Tickets</p>
                    </div>

                    {/* Price */}
                    <div className="mb-4">
                      <p className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-fuchsia-500">
                        ${pkg.price.toFixed(2)}
                      </p>
                      <p className="text-xs text-slate-500">${pkg.pricePerTicket.toFixed(2)} per ticket</p>
                    </div>

                    {/* Features */}
                    <div className="space-y-2 mb-4">
                      <div className="flex items-center gap-2 text-xs text-slate-400">
                        <Check size={14} className="text-cyan-400" />
                        <span>Nano Banana Pro Quality</span>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-slate-400">
                        <Check size={14} className="text-cyan-400" />
                        <span>4K Resolution</span>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-slate-400">
                        <Check size={14} className="text-cyan-400" />
                        <span>Reference Images Support</span>
                      </div>
                      {pkg.tickets >= 10 && (
                        <div className="flex items-center gap-2 text-xs text-fuchsia-400 font-bold">
                          <Crown size={14} />
                          <span>Premium Value!</span>
                        </div>
                      )}
                    </div>

                    {/* Button */}
                    <Button className={`w-full font-bold ${
                      pkg.bestValue
                        ? 'bg-gradient-to-r from-fuchsia-500 to-pink-500 hover:from-fuchsia-400 hover:to-pink-400 text-white'
                        : pkg.popular
                        ? 'bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-400 hover:to-blue-400 text-black'
                        : 'bg-slate-700 hover:bg-slate-600 text-white'
                    }`}>
                      Select Package
                    </Button>
                  </div>
                ))}
              </div>
            </>
          ) : (
            /* PayPal Checkout */
            <div className="max-w-md mx-auto">
              <div className="mb-6 p-6 rounded-xl border-2 border-cyan-500/30 bg-slate-900/80">
                <h3 className="text-xl font-black text-white mb-4">Checkout</h3>
                
                {/* Discount Code Input */}
                {!appliedDiscount && (
                  <div className="mb-4 p-4 rounded-lg border border-slate-800 bg-slate-950">
                    <label className="block text-xs font-bold text-slate-400 mb-2 uppercase flex items-center gap-2">
                      <Tag size={14} />
                      Discount Code
                    </label>
                    <div className="flex gap-2">
                      <Input
                        value={discountCode}
                        onChange={(e) => setDiscountCode(e.target.value.toUpperCase())}
                        placeholder="ENTER CODE"
                        className="bg-slate-900 border-slate-700 text-white uppercase"
                        disabled={checkingDiscount}
                      />
                      <Button
                        onClick={applyDiscountCode}
                        disabled={checkingDiscount || !discountCode.trim()}
                        className="bg-cyan-500 hover:bg-cyan-400 text-black font-bold whitespace-nowrap"
                      >
                        {checkingDiscount ? 'Checking...' : 'Apply'}
                      </Button>
                    </div>
                    {discountError && (
                      <p className="text-xs text-red-400 mt-2">{discountError}</p>
                    )}
                  </div>
                )}

                {/* Applied Discount Display */}
                {appliedDiscount && (
                  <div className="mb-4 p-3 rounded-lg border border-green-500/30 bg-green-500/10">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Tag size={14} className="text-green-400" />
                        <span className="text-sm font-bold text-green-400">
                          {appliedDiscount.code}
                        </span>
                      </div>
                      <button
                        onClick={() => {
                          setAppliedDiscount(null)
                          setDiscountCode("")
                        }}
                        className="text-xs text-slate-400 hover:text-red-400"
                      >
                        Remove
                      </button>
                    </div>
                    <p className="text-xs text-slate-400 mt-1">
                      {appliedDiscount.type === 'percentage' 
                        ? `${appliedDiscount.value}% off` 
                        : `$${appliedDiscount.value.toFixed(2)} off`}
                    </p>
                  </div>
                )}

                {/* Price Summary */}
                <div className="mb-4 pb-4 border-b border-slate-800">
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <p className="text-sm text-slate-400">Package</p>
                      <p className="text-lg font-bold text-white">{selectedPackage.tickets} Tickets</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-slate-400">Subtotal</p>
                      <p className={`text-lg font-bold ${appliedDiscount ? 'text-slate-500 line-through' : 'text-cyan-400'}`}>
                        ${selectedPackage.price.toFixed(2)}
                      </p>
                    </div>
                  </div>
                  
                  {appliedDiscount && (
                    <>
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-sm text-green-400">Discount</p>
                        <p className="text-sm text-green-400">-${discountAmount.toFixed(2)}</p>
                      </div>
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-bold text-white">Total</p>
                        <p className="text-2xl font-black text-cyan-400">${finalPrice.toFixed(2)}</p>
                      </div>
                    </>
                  )}
                </div>
                
                <p className="text-xs text-slate-500 text-center mb-4">
                  ${(finalPrice / selectedPackage.tickets).toFixed(2)} per ticket
                  {appliedDiscount && ` • ${Math.round(discountAmount / selectedPackage.price * 100)}% savings!`}
                </p>
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
                    . I understand that tickets are non-refundable and images are stored for 30 days.
                  </span>
                </label>
              </div>

              <div className="mb-4 relative">
                {!acceptedTOS && (
                  <div className="absolute inset-0 flex items-center justify-center z-10 bg-slate-900/90 rounded">
                    <p className="text-sm text-yellow-400 font-bold">
                      ⚠️ Please accept Terms of Service
                    </p>
                  </div>
                )}
                <PayPalButtons
                  createOrder={createPayPalOrder}
                  onApprove={onPayPalApprove}
                  disabled={purchasing || !acceptedTOS}
                  style={{ layout: "vertical", label: "checkout" }}
                  forceReRender={[finalPrice, acceptedTOS]}
                />
              </div>

              <Button
                onClick={() => {
                  setSelectedPackage(null)
                  setAppliedDiscount(null)
                  setDiscountCode("")
                  setDiscountError("")
                  setAcceptedTOS(false)
                }}
                variant="outline"
                className="w-full border-slate-700 text-slate-300 hover:border-slate-600"
                disabled={purchasing}
              >
                Choose Different Package
              </Button>
            </div>
          )}
        </div>
      </div>
    </PayPalScriptProvider>
  )
}

