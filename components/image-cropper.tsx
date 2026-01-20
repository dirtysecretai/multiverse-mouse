"use client"

import { useState, useCallback } from 'react'
import Cropper from 'react-easy-crop'
import { Button } from '@/components/ui/button'
import { Slider } from '@/components/ui/slider'
import { X, Check, RotateCw } from 'lucide-react'

interface ImageCropperProps {
  imageUrl: string
  onCropComplete: (croppedImageUrl: string) => void
  onCancel: () => void
  aspectRatio?: number
}

export function ImageCropper({ imageUrl, onCropComplete, onCancel, aspectRatio = 4/3 }: ImageCropperProps) {
  const [crop, setCrop] = useState({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(1)
  const [rotation, setRotation] = useState(0)
  const [croppedAreaPixels, setCroppedAreaPixels] = useState(null)
  const [isCropping, setIsCropping] = useState(false)

  const onCropChange = (crop: any) => {
    setCrop(crop)
  }

  const onZoomChange = (zoom: number) => {
    setZoom(zoom)
  }

  const onCropAreaChange = useCallback((croppedArea: any, croppedAreaPixels: any) => {
    setCroppedAreaPixels(croppedAreaPixels)
  }, [])

  const createCroppedImage = async () => {
    setIsCropping(true)
    try {
      const croppedImageUrl = await getCroppedImg(
        imageUrl,
        croppedAreaPixels,
        rotation
      )
      onCropComplete(croppedImageUrl)
    } catch (e) {
      console.error('Crop failed:', e)
      alert('Failed to crop image. Please try again.')
    } finally {
      setIsCropping(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/90 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4 bg-slate-900/80 backdrop-blur-sm border-b border-cyan-500/30">
        <h3 className="text-lg font-bold text-cyan-400">CROP IMAGE</h3>
        <button onClick={onCancel} className="p-2 hover:bg-slate-800 rounded-lg transition-colors">
          <X className="text-slate-400" size={20} />
        </button>
      </div>

      {/* Cropper */}
      <div className="flex-1 relative">
        <Cropper
          image={imageUrl}
          crop={crop}
          zoom={zoom}
          rotation={rotation}
          aspect={aspectRatio}
          onCropChange={onCropChange}
          onZoomChange={onZoomChange}
          onCropComplete={onCropAreaChange}
        />
      </div>

      {/* Controls */}
      <div className="p-6 bg-slate-900/80 backdrop-blur-sm border-t border-cyan-500/30 space-y-4">
        {/* Zoom */}
        <div>
          <label className="text-xs text-slate-400 mb-2 block uppercase tracking-widest">
            Zoom: {zoom.toFixed(1)}x
          </label>
          <Slider
            value={[zoom]}
            onValueChange={(values) => setZoom(values[0])}
            min={1}
            max={3}
            step={0.1}
            className="w-full"
          />
        </div>

        {/* Rotation */}
        <div>
          <label className="text-xs text-slate-400 mb-2 block uppercase tracking-widest flex items-center gap-2">
            <RotateCw size={12} />
            Rotation: {rotation}°
          </label>
          <Slider
            value={[rotation]}
            onValueChange={(values) => setRotation(values[0])}
            min={0}
            max={360}
            step={1}
            className="w-full"
          />
        </div>

        {/* Instructions */}
        <div className="text-xs text-slate-500 space-y-1">
          <p>• Drag to reposition the image</p>
          <p>• Pinch or scroll to zoom</p>
          <p>• Use sliders to fine-tune</p>
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <Button
            onClick={onCancel}
            className="flex-1 bg-slate-700 hover:bg-slate-600 text-white"
          >
            Cancel
          </Button>
          <Button
            onClick={createCroppedImage}
            disabled={isCropping}
            className="flex-1 bg-cyan-500 hover:bg-cyan-400 text-black font-bold flex items-center justify-center gap-2"
          >
            {isCropping ? (
              "Cropping..."
            ) : (
              <>
                <Check size={16} />
                Apply Crop
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  )
}

// Helper function to create cropped image
async function getCroppedImg(
  imageSrc: string,
  pixelCrop: any,
  rotation = 0
): Promise<string> {
  const image = await createImage(imageSrc)
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')

  if (!ctx) {
    throw new Error('No 2d context')
  }

  const maxSize = Math.max(image.width, image.height)
  const safeArea = 2 * ((maxSize / 2) * Math.sqrt(2))

  canvas.width = safeArea
  canvas.height = safeArea

  ctx.translate(safeArea / 2, safeArea / 2)
  ctx.rotate((rotation * Math.PI) / 180)
  ctx.translate(-safeArea / 2, -safeArea / 2)

  ctx.drawImage(
    image,
    safeArea / 2 - image.width * 0.5,
    safeArea / 2 - image.height * 0.5
  )

  const data = ctx.getImageData(0, 0, safeArea, safeArea)

  canvas.width = pixelCrop.width
  canvas.height = pixelCrop.height

  ctx.putImageData(
    data,
    Math.round(0 - safeArea / 2 + image.width * 0.5 - pixelCrop.x),
    Math.round(0 - safeArea / 2 + image.height * 0.5 - pixelCrop.y)
  )

  return new Promise((resolve) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        console.error('Canvas is empty')
        return
      }
      const url = URL.createObjectURL(blob)
      resolve(url)
    }, 'image/jpeg', 0.95)
  })
}

function createImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.addEventListener('load', () => resolve(image))
    image.addEventListener('error', (error) => reject(error))
    image.setAttribute('crossOrigin', 'anonymous')
    image.src = url
  })
}