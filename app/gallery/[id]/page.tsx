"use client"

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { ChevronLeft, ChevronRight, Lock, X, Check, AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import { PayPalScriptProvider, PayPalButtons } from '@paypal/react-paypal-js'

interface GalleryImage {
  id: number
  imageUrl: string
  caption: string | null
  sortOrder: number
}

interface Gallery {
  id: number
  title: string
  description: string
  coverImageUrl: string
  price: number
  accessType: string
  loreIntro: string | null
  loreOutro: string | null
  images: GalleryImage[]
}

export default function GalleryPage() {
  const params = useParams()
  const router = useRouter()
  const galleryId = params.id as string
  
  const [gallery, setGallery] = useState<Gallery | null>(null)
  const [currentImageIndex, setCurrentImageIndex] = useState(0)
  const [showLoreIntro, setShowLoreIntro] = useState(true)
  const [isLoading, setIsLoading] = useState(true)
  const [hasAccess, setHasAccess] = useState(false)
  const [showPayPal, setShowPayPal] = useState(false)
  const [processingPayment, setProcessingPayment] = useState(false)
  const [paymentSuccess, setPaymentSuccess] = useState(false)
  const [paymentError, setPaymentError] = useState<string | null>(null)
  
  // Check if PayPal is configured
  const paypalClientId = process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID
  const isPayPalConfigured = !!paypalClientId

  const fetchGallery = async () => {
    setIsLoading(true)
    try {
      const res = await fetch(`/api/galleries?id=${galleryId}`)
      if (res.ok) {
        const data = await res.json()
        setGallery(data)
        
        if (data.accessType === 'free') {
          setHasAccess(true)
        } else {
          setHasAccess(paymentSuccess)
        }
      }
    } catch (err) {
      console.error('Failed to fetch gallery:', err)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchGallery()
  }, [galleryId])

  const handlePreviousImage = () => {
    if (!gallery) return
    setCurrentImageIndex((prev) => (prev === 0 ? gallery.images.length - 1 : prev - 1))
  }

  const handleNextImage = () => {
    if (!gallery) return
    setCurrentImageIndex((prev) => (prev === gallery.images.length - 1 ? 0 : prev + 1))
  }

  const createPayPalOrder = async () => {
    try {
      console.log('Creating PayPal order...')
      setPaymentError(null)
      
      const res = await fetch('/api/paypal/create-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          galleryId: gallery?.id,
          amount: gallery?.price,
          galleryTitle: gallery?.title,
        }),
      })

      const data = await res.json()
      console.log('Create order response:', data)
      
      if (data.success) {
        console.log('Order created successfully:', data.orderId)
        return data.orderId
      } else {
        console.error('Order creation failed:', data)
        throw new Error(data.error || 'Failed to create order')
      }
    } catch (error: any) {
      console.error('Order creation error:', error)
      setPaymentError(`Failed to create order: ${error.message}`)
      throw error
    }
  }

  const capturePayPalPayment = async (orderId: string) => {
    try {
      console.log('Capturing payment for order:', orderId)
      setProcessingPayment(true)
      setPaymentError(null)
      
      const res = await fetch('/api/paypal/capture-payment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId,
          galleryId: gallery?.id,
          userEmail: 'user@example.com',
        }),
      })

      const data = await res.json()
      console.log('Capture response:', data)

      if (data.success) {
        console.log('Payment captured successfully!')
        setPaymentSuccess(true)
        setHasAccess(true)
        setShowPayPal(false)
        
        // Reload page to show unlocked gallery
        setTimeout(() => {
          router.refresh()
        }, 1500)
        
        return { success: true }
      } else {
        console.error('Payment capture failed:', data)
        throw new Error(data.details || data.error || 'Payment capture failed')
      }
    } catch (error: any) {
      console.error('Payment capture error:', error)
      setPaymentError(`Payment failed: ${error.message}`)
      return { success: false, error: error.message }
    } finally {
      setProcessingPayment(false)
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#050810] flex items-center justify-center">
        <div className="text-cyan-400 font-mono">LOADING_GALLERY...</div>
      </div>
    )
  }

  if (!gallery) {
    return (
      <div className="min-h-screen bg-[#050810] flex flex-col items-center justify-center p-6">
        <h1 className="text-2xl font-bold text-red-400 mb-4">GALLERY_NOT_FOUND</h1>
        <Link href="/">
          <Button className="bg-cyan-500 hover:bg-cyan-400 text-black">
            RETURN_TO_PORTAL
          </Button>
        </Link>
      </div>
    )
  }

  // LOCKED GALLERY VIEW
  if (!hasAccess && gallery.accessType !== 'free') {
    return (
      <PayPalScriptProvider 
        options={{ 
          clientId: paypalClientId || 'test',
          currency: 'USD',
          intent: 'capture'
        }}
      >
        <div className="min-h-screen bg-[#050810] relative overflow-hidden">
          <div className="fixed inset-0 bg-[linear-gradient(rgba(0,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(0,255,255,0.02)_1px,transparent_1px)] bg-[size:40px_40px] pointer-events-none" />
          
          <div className="relative z-10 flex flex-col items-center justify-center min-h-screen p-6">
            <div className="w-full max-w-2xl">
              {/* Cover Image */}
              <div className="relative aspect-video rounded-xl overflow-hidden mb-6 border border-cyan-500/30">
                <img 
                  src={gallery.coverImageUrl} 
                  alt={gallery.title}
                  className="w-full h-full object-cover blur-sm"
                />
                <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                  <Lock size={64} className="text-cyan-400" />
                </div>
              </div>

              {/* Gallery Info */}
              <div className="p-6 rounded-xl border border-slate-800 bg-slate-900/60 backdrop-blur-sm mb-6">
                <h1 className="text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-fuchsia-500 mb-2">
                  {gallery.title}
                </h1>
                <p className="text-slate-400 text-sm mb-4">{gallery.description}</p>
                
                <div className="flex items-center justify-between p-4 rounded-lg border border-slate-700 bg-slate-950/50">
                  <div>
                    <p className="text-xs text-slate-500 uppercase mb-1">Price</p>
                    <p className="text-2xl font-bold text-cyan-400">${gallery.price.toFixed(2)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500 uppercase mb-1">Images</p>
                    <p className="text-2xl font-bold text-slate-300">{gallery.images.length}</p>
                  </div>
                </div>
              </div>

              {/* PayPal Not Configured Warning */}
              {!isPayPalConfigured && (
                <div className="p-4 rounded-xl border border-yellow-500/30 bg-yellow-500/10 mb-6 flex items-center gap-3">
                  <AlertTriangle size={24} className="text-yellow-400" />
                  <div>
                    <p className="text-yellow-400 font-bold">PayPal Not Configured</p>
                    <p className="text-xs text-slate-400">Add NEXT_PUBLIC_PAYPAL_CLIENT_ID to .env.local</p>
                  </div>
                </div>
              )}

              {/* Success Message */}
              {paymentSuccess && (
                <div className="p-4 rounded-xl border border-green-500/30 bg-green-500/10 mb-6 flex items-center gap-3">
                  <Check size={24} className="text-green-400" />
                  <div>
                    <p className="text-green-400 font-bold">Payment Successful!</p>
                    <p className="text-xs text-slate-400">Unlocking gallery...</p>
                  </div>
                </div>
              )}

              {/* Error Message */}
              {paymentError && (
                <div className="p-4 rounded-xl border border-red-500/30 bg-red-500/10 mb-6">
                  <div className="flex items-center gap-3">
                    <X size={24} className="text-red-400" />
                    <div>
                      <p className="text-red-400 font-bold">Payment Error</p>
                      <p className="text-xs text-slate-400">{paymentError}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Purchase Button */}
              {!showPayPal && !paymentSuccess && isPayPalConfigured && (
                <Button
                  onClick={() => setShowPayPal(true)}
                  className="w-full bg-gradient-to-r from-cyan-500 to-fuchsia-500 hover:from-cyan-400 hover:to-fuchsia-400 text-black font-black text-lg py-6"
                >
                  <Lock size={20} className="mr-2" />
                  PURCHASE ACCESS - ${gallery.price.toFixed(2)}
                </Button>
              )}

              {/* PayPal Buttons */}
              {showPayPal && !paymentSuccess && isPayPalConfigured && (
                <div className="space-y-4">
                  <div className="p-6 rounded-xl border border-cyan-500/30 bg-slate-900/80 backdrop-blur-sm">
                    <h3 className="text-lg font-bold text-cyan-400 mb-4">Complete Payment</h3>
                    
                    {processingPayment ? (
                      <div className="py-12 text-center">
                        <div className="text-cyan-400 font-mono mb-2 animate-pulse">PROCESSING_PAYMENT...</div>
                        <p className="text-xs text-slate-500">Please wait</p>
                      </div>
                    ) : (
                      <PayPalButtons
                        style={{ 
                          layout: 'vertical',
                          shape: 'rect',
                          label: 'pay'
                        }}
                        createOrder={async () => {
                          try {
                            const orderId = await createPayPalOrder()
                            console.log('Returning order ID to PayPal:', orderId)
                            return orderId
                          } catch (error) {
                            console.error('Failed in createOrder:', error)
                            throw error
                          }
                        }}
                        onApprove={async (data, actions) => {
                          console.log('PayPal approved!', data)
                          try {
                            const result = await capturePayPalPayment(data.orderID)
                            if (result.success) {
                              console.log('Payment successful!')
                            } else {
                              console.error('Capture failed:', result.error)
                            }
                          } catch (error) {
                            console.error('Error in onApprove:', error)
                          }
                        }}
                        onError={(err) => {
                          console.error('PayPal SDK error:', err)
                          setPaymentError('Payment error occurred. Please try again.')
                        }}
                        onCancel={(data) => {
                          console.log('Payment cancelled by user', data)
                          setShowPayPal(false)
                          setPaymentError('Payment was cancelled')
                        }}
                      />
                    )}
                  </div>

                  <Button
                    onClick={() => {
                      setShowPayPal(false)
                      setPaymentError(null)
                    }}
                    variant="outline"
                    className="w-full"
                    disabled={processingPayment}
                  >
                    Cancel
                  </Button>
                </div>
              )}

              {/* Back Link */}
              <div className="mt-6 text-center">
                <Link href="/galleries" className="text-sm text-slate-500 hover:text-cyan-400 transition-colors">
                  ← Back to Galleries
                </Link>
              </div>
            </div>
          </div>
        </div>
      </PayPalScriptProvider>
    )
  }

  // UNLOCKED GALLERY VIEW
  const currentImage = gallery.images[currentImageIndex]

  return (
    <div className="min-h-screen bg-[#050810] relative overflow-hidden">
      <div className="fixed inset-0 bg-[linear-gradient(rgba(0,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(0,255,255,0.02)_1px,transparent_1px)] bg-[size:40px_40px] pointer-events-none" />
      
      <div className="relative z-10 min-h-screen p-6">
        {/* Header */}
        <div className="max-w-6xl mx-auto mb-6">
          <Link href="/galleries" className="inline-flex items-center text-slate-500 hover:text-cyan-400 transition-colors mb-4">
            <ChevronLeft size={16} />
            <span className="text-sm">Back to Galleries</span>
          </Link>
          <h1 className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-fuchsia-500">
            {gallery.title}
          </h1>
          <p className="text-slate-400 text-sm mt-2">{gallery.description}</p>
        </div>

        {/* Lore Intro Modal */}
        {showLoreIntro && gallery.loreIntro && (
          <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-6 z-50">
            <div className="max-w-2xl w-full p-8 rounded-xl border border-cyan-500/30 bg-slate-900/95 backdrop-blur-xl">
              <h2 className="text-xl font-bold text-cyan-400 mb-4">Story Introduction</h2>
              <p className="text-slate-300 whitespace-pre-line mb-6">{gallery.loreIntro}</p>
              <Button 
                onClick={() => setShowLoreIntro(false)}
                className="w-full bg-cyan-500 hover:bg-cyan-400 text-black font-bold"
              >
                BEGIN GALLERY
              </Button>
            </div>
          </div>
        )}

        {/* Main Gallery */}
        <div className="max-w-6xl mx-auto">
          {gallery.images.length > 0 ? (
            <>
              {/* Main Image Display */}
              <div className="relative aspect-video rounded-xl overflow-hidden border border-cyan-500/30 mb-6 bg-slate-950">
                <img 
                  src={currentImage.imageUrl} 
                  alt={currentImage.caption || `Image ${currentImageIndex + 1}`}
                  className="w-full h-full object-contain"
                />
                
                {/* Navigation Arrows */}
                <button
                  onClick={handlePreviousImage}
                  className="absolute left-4 top-1/2 -translate-y-1/2 p-3 rounded-full bg-black/50 hover:bg-black/70 border border-cyan-500/30 transition-all"
                >
                  <ChevronLeft className="text-cyan-400" size={24} />
                </button>
                <button
                  onClick={handleNextImage}
                  className="absolute right-4 top-1/2 -translate-y-1/2 p-3 rounded-full bg-black/50 hover:bg-black/70 border border-cyan-500/30 transition-all"
                >
                  <ChevronRight className="text-cyan-400" size={24} />
                </button>

                {/* Image Counter */}
                <div className="absolute bottom-4 left-1/2 -translate-x-1/2 px-4 py-2 rounded-full bg-black/70 border border-cyan-500/30">
                  <span className="text-cyan-400 font-mono text-sm">
                    {currentImageIndex + 1} / {gallery.images.length}
                  </span>
                </div>
              </div>

              {/* Caption */}
              {currentImage.caption && (
                <div className="mb-6 p-4 rounded-xl border border-slate-800 bg-slate-900/60 backdrop-blur-sm">
                  <p className="text-slate-300 text-center">{currentImage.caption}</p>
                </div>
              )}

              {/* Progress Dots */}
              <div className="flex justify-center gap-2 mb-6">
                {gallery.images.map((_, idx) => (
                  <button
                    key={idx}
                    onClick={() => setCurrentImageIndex(idx)}
                    className={`w-2 h-2 rounded-full transition-all ${
                      idx === currentImageIndex 
                        ? 'bg-cyan-400 w-8' 
                        : 'bg-slate-700 hover:bg-slate-600'
                    }`}
                  />
                ))}
              </div>

              {/* Thumbnail Strip */}
              <div className="flex gap-2 overflow-x-auto pb-4 mb-6">
                {gallery.images.map((img, idx) => (
                  <button
                    key={idx}
                    onClick={() => setCurrentImageIndex(idx)}
                    className={`flex-shrink-0 w-24 h-24 rounded-lg overflow-hidden border-2 transition-all ${
                      idx === currentImageIndex
                        ? 'border-cyan-400'
                        : 'border-slate-700 hover:border-slate-500'
                    }`}
                  >
                    <img 
                      src={img.imageUrl} 
                      alt={`Thumbnail ${idx + 1}`}
                      className="w-full h-full object-cover"
                    />
                  </button>
                ))}
              </div>

              {/* Lore Outro */}
              {currentImageIndex === gallery.images.length - 1 && gallery.loreOutro && (
                <div className="p-6 rounded-xl border border-cyan-500/30 bg-slate-900/60 backdrop-blur-sm">
                  <h3 className="text-lg font-bold text-cyan-400 mb-3">Story Conclusion</h3>
                  <p className="text-slate-300 whitespace-pre-line">{gallery.loreOutro}</p>
                </div>
              )}
            </>
          ) : (
            <div className="text-center p-12 rounded-xl border border-slate-800 bg-slate-900/60">
              <p className="text-slate-500">No images in this gallery yet</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}



