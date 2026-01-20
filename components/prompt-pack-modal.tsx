import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { X, ImagePlus, Trash2 } from "lucide-react"

interface PromptPackModalProps {
  isOpen: boolean
  onClose: () => void
  packInfo: {
    id: number
    name: string
    price: number
  }
}

export function PromptPackModal({ isOpen, onClose, packInfo }: PromptPackModalProps) {
  const [prompts, setPrompts] = useState<string[]>(Array(8).fill(""))
  const [images, setImages] = useState<File[]>([])
  const [customerEmail, setCustomerEmail] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)

  if (!isOpen) return null

  const handlePromptChange = (index: number, value: string) => {
    const newPrompts = [...prompts]
    newPrompts[index] = value
    setPrompts(newPrompts)
  }

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const filesArray = Array.from(e.target.files)
      setImages(prev => [...prev, ...filesArray].slice(0, 8))
    }
  }

  const removeImage = (index: number) => {
    setImages(prev => prev.filter((_, i) => i !== index))
  }

  const handleSubmit = async () => {
    // Validate
    const filledPrompts = prompts.filter(p => p.trim())
    if (filledPrompts.length === 0) {
      alert("Please enter at least one prompt")
      return
    }
    if (!customerEmail.trim()) {
      alert("Please enter your email")
      return
    }

    setIsSubmitting(true)
    try {
      // In production, you'd upload images and send data to your backend
      // For now, we'll just simulate the purchase
      const formData = new FormData()
      formData.append('email', customerEmail)
      formData.append('packId', packInfo.id.toString())
      formData.append('prompts', JSON.stringify(prompts.filter(p => p.trim())))
      
      images.forEach((img, idx) => {
        formData.append(`image_${idx}`, img)
      })

      // TODO: Send to your payment/notification endpoint
      // await fetch('/api/prompt-pack-purchase', { method: 'POST', body: formData })

      alert(`🎉 Purchase initiated! You'll receive a payment link at ${customerEmail}`)
      onClose()
    } catch (err) {
      alert("Purchase failed. Please try again.")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div className="relative w-full max-w-3xl max-h-[90vh] overflow-y-auto bg-slate-950 border-2 border-cyan-500/30 rounded-2xl shadow-[0_0_50px_rgba(6,182,212,0.3)]">
        {/* Header */}
        <div className="sticky top-0 bg-slate-950/95 backdrop-blur-md border-b border-cyan-500/20 p-6 z-10">
          <button 
            onClick={onClose}
            className="absolute top-4 right-4 text-slate-500 hover:text-cyan-400 transition-colors"
          >
            <X size={24} />
          </button>
          <h2 className="text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-fuchsia-500">
            $8 PROMPT PACK
          </h2>
          <p className="text-sm text-slate-400 mt-1">Submit 8 custom prompts + up to 8 reference images</p>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Email */}
          <div>
            <label className="block text-xs font-bold text-cyan-400 mb-2 uppercase tracking-wider">
              Your Email *
            </label>
            <Input 
              type="email"
              value={customerEmail}
              onChange={(e) => setCustomerEmail(e.target.value)}
              placeholder="email@example.com"
              className="bg-slate-900 border-slate-700 text-white"
              required
            />
            <p className="text-[10px] text-slate-500 mt-1">We'll send your payment link and delivery updates here</p>
          </div>

          {/* Prompts */}
          <div>
            <label className="block text-xs font-bold text-cyan-400 mb-3 uppercase tracking-wider">
              Your 8 Prompts
            </label>
            <div className="space-y-3">
              {prompts.map((prompt, idx) => (
                <div key={idx}>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[10px] text-slate-600 font-mono">PROMPT_{idx + 1}</span>
                  </div>
                  <Textarea
                    value={prompt}
                    onChange={(e) => handlePromptChange(idx, e.target.value)}
                    placeholder={`Describe your idea for prompt ${idx + 1}...`}
                    className="bg-slate-900 border-slate-700 text-white resize-none text-sm"
                    rows={2}
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Image Upload */}
          <div>
            <label className="block text-xs font-bold text-cyan-400 mb-3 uppercase tracking-wider">
              Reference Images (Optional, Max 8)
            </label>
            <label className="flex flex-col items-center justify-center gap-2 p-6 border-2 border-dashed border-slate-700 rounded-xl hover:border-cyan-500/50 cursor-pointer transition-all group">
              <ImagePlus size={32} className="text-slate-600 group-hover:text-cyan-400 transition-colors" />
              <span className="text-sm text-slate-500 group-hover:text-cyan-400 transition-colors">
                Click to upload reference images
              </span>
              <span className="text-[10px] text-slate-600">
                {images.length}/8 images uploaded
              </span>
              <input 
                type="file" 
                multiple 
                accept="image/*" 
                onChange={handleImageUpload}
                className="hidden"
                disabled={images.length >= 8}
              />
            </label>

            {/* Image Previews */}
            {images.length > 0 && (
              <div className="grid grid-cols-4 gap-3 mt-4">
                {images.map((img, idx) => (
                  <div key={idx} className="relative group aspect-square">
                    <img 
                      src={URL.createObjectURL(img)} 
                      alt={`ref-${idx}`}
                      className="w-full h-full object-cover rounded-lg border border-cyan-500/30"
                    />
                    <button
                      onClick={() => removeImage(idx)}
                      className="absolute top-1 right-1 p-1 bg-red-500 rounded-md opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <Trash2 size={12} className="text-white" />
                    </button>
                    <span className="absolute bottom-1 left-1 px-1.5 py-0.5 bg-black/60 text-[8px] text-white rounded">
                      {idx + 1}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Instructions */}
          <div className="p-4 bg-slate-900/50 border border-slate-800 rounded-xl">
            <h3 className="text-xs font-bold text-fuchsia-400 mb-2">HOW IT WORKS:</h3>
            <ul className="text-[11px] text-slate-400 space-y-1">
              <li>• Fill in your 8 prompts (describe what you want created)</li>
              <li>• Upload reference images if needed (style examples, character refs, etc)</li>
              <li>• Submit and pay $8 via the link sent to your email</li>
              <li>• Receive your 8 custom AI generations within 48 hours</li>
            </ul>
          </div>

          {/* Submit */}
          <div className="flex gap-3">
            <Button 
              onClick={onClose}
              className="flex-1 bg-slate-800 hover:bg-slate-700 text-white"
            >
              CANCEL
            </Button>
            <Button 
              onClick={handleSubmit}
              disabled={isSubmitting || !customerEmail.trim() || prompts.every(p => !p.trim())}
              className="flex-1 bg-gradient-to-r from-cyan-500 to-fuchsia-500 hover:from-cyan-400 hover:to-fuchsia-400 text-black font-black"
            >
              {isSubmitting ? "PROCESSING..." : `PAY $${packInfo.price}`}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}