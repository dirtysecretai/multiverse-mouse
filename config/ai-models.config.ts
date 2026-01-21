// AI Model Configuration - Only models that work with current Gemini API setup
// Imagen models require different setup (commented out for now)

export interface AIModel {
  id: string
  name: string
  displayName: string
  description: string
  ticketCost: number
  category: 'standard' | 'premium' | 'ultra'
  rateLimit: {
    rpm: number
    rpd: number
  }
  quality: 'fast' | 'balanced' | 'high' | 'ultra'
  isAvailable: boolean
}

export const AI_MODELS: AIModel[] = [
  // PRO SCANNER - From rate limits: gemini-3-pro-image (257/250 used)
  {
    id: 'gemini-3-pro-image-preview',
    name: 'gemini-3-pro-image',
    displayName: 'Pro Scanner v3',
    description: 'Professional scanning - may be at daily quota (257/250)',
    ticketCost: 1,
    category: 'standard',
    rateLimit: {
      rpm: 20,
      rpd: 250
    },
    quality: 'balanced',
    isAvailable: true
  },
  
  // FLASH SCANNER - From rate limits: gemini-2.5-flash-preview-image (3/2000 used)
  {
    id: 'gemini-2.5-flash-image',
    name: 'gemini-2.5-flash-preview-image',
    displayName: 'Flash Scanner v2.5',
    description: 'Fast scanning with huge capacity (1997 left today!)',
    ticketCost: 1,
    category: 'standard',
    rateLimit: {
      rpm: 500,
      rpd: 2000
    },
    quality: 'fast',
    isAvailable: true
  },

  // IMAGEN MODELS - Require Vertex AI (different setup)
  // Uncomment these when you set up Vertex AI
  /*
  {
    id: 'imagen-4.0-generate-001',
    name: 'imagen-4.0-generate-001',
    displayName: 'Imagen 4 Standard',
    description: 'Latest image generation with better text rendering',
    ticketCost: 1,
    category: 'standard',
    rateLimit: {
      rpm: 10,
      rpd: 100
    },
    quality: 'high',
    isAvailable: true
  },
  {
    id: 'imagen-4.0-ultra-generate-001',
    name: 'imagen-4.0-ultra-generate-001',
    displayName: 'Imagen 4 ULTRA',
    description: 'Maximum fidelity image generation',
    ticketCost: 1,
    category: 'standard',
    rateLimit: {
      rpm: 5,
      rpd: 50
    },
    quality: 'ultra',
    isAvailable: true
  },
  */

  // PREMIUM TIER - 2 tickets (COMING SOON - Requires Imagen setup)
  // Uncomment these when you set up Imagen API
  /*
  {
    id: 'imagen-4.0-fast-generate',
    name: 'imagen-4.0-fast-generate',
    displayName: 'Imagen Fast v4.0',
    description: 'Premium image generation with enhanced details',
    ticketCost: 2,
    category: 'premium',
    rateLimit: {
      rpm: 0,
      rpd: 10
    },
    quality: 'high',
    isAvailable: true
  },
  {
    id: 'imagen-4.0-generate',
    name: 'imagen-4.0-generate',
    displayName: 'Imagen Standard v4.0',
    description: 'High-quality multiverse imagery with refined output',
    ticketCost: 2,
    category: 'premium',
    rateLimit: {
      rpm: 0,
      rpd: 10
    },
    quality: 'high',
    isAvailable: true
  },

  // ULTRA TIER - 5 tickets (COMING SOON - Requires Imagen setup)
  {
    id: 'imagen-4.0-ultra-generate',
    name: 'imagen-4.0-ultra-generate',
    displayName: 'Imagen ULTRA v4.0 ⚡',
    description: 'Maximum fidelity - The pinnacle of multiverse scanning technology',
    ticketCost: 5,
    category: 'ultra',
    rateLimit: {
      rpm: 0,
      rpd: 5
    },
    quality: 'ultra',
    isAvailable: true
  },
  */
]

// Helper functions
export function getModelById(id: string): AIModel | undefined {
  return AI_MODELS.find(m => m.id === id)
}

export function getAvailableModels(): AIModel[] {
  return AI_MODELS.filter(m => m.isAvailable)
}

export function getModelsByCategory(category: 'standard' | 'premium' | 'ultra'): AIModel[] {
  return AI_MODELS.filter(m => m.category === category && m.isAvailable)
}

export function getTicketCost(modelId: string): number {
  const model = getModelById(modelId)
  return model?.ticketCost || 1
}

// Category colors for UI
export const CATEGORY_COLORS = {
  standard: {
    border: 'border-cyan-400',
    bg: 'bg-cyan-500/10',
    text: 'text-cyan-400',
    glow: 'shadow-cyan-500/50'
  },
  premium: {
    border: 'border-fuchsia-400',
    bg: 'bg-fuchsia-500/10',
    text: 'text-fuchsia-400',
    glow: 'shadow-fuchsia-500/50'
  },
  ultra: {
    border: 'border-yellow-400',
    bg: 'bg-yellow-500/10',
    text: 'text-yellow-400',
    glow: 'shadow-yellow-500/50'
  }
}

// NOTE: To enable Imagen models:
// 1. Verify model availability in Google AI Studio
// 2. Check if models require Vertex AI instead of Gemini API
// 3. Update API endpoint in generate route if needed
// 4. Uncomment models above and set isAvailable: true
// 5. Test each model individually before going live
