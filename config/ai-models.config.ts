// AI Model Configuration - FAL.ai models (NanoBanana + SeeDream)
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
  provider?: 'gemini' | 'fal'
}

export const AI_MODELS: AIModel[] = [
  // NANOBANANA - FAL.ai (Gemini 2.5 Flash Image) - Fast & Cheap - 2 IMAGES!
  {
    id: 'nano-banana',
    name: 'fal-ai/nano-banana',
    displayName: 'NanoBanana Cluster',
    description: 'Fast, artistic generation - 1 ticket for 2 images!',
    ticketCost: 1,
    category: 'standard',
    rateLimit: {
      rpm: 0, // No rate limit on FAL.ai
      rpd: 0  // Unlimited with credits
    },
    quality: 'fast',
    isAvailable: true,
    provider: 'fal'
  },

  // NANOBANANA PRO - FAL.ai (Gemini 3 Pro Image) - High Quality
  {
    id: 'nano-banana-pro',
    name: 'fal-ai/nano-banana-pro',
    displayName: 'NanoBanana Pro',
    description: 'Premium quality - 1 ticket (2K) or 2 tickets (4K)',
    ticketCost: 1,
    category: 'standard',
    rateLimit: {
      rpm: 0, // No rate limit on FAL.ai
      rpd: 0  // Unlimited with credits
    },
    quality: 'high',
    isAvailable: true,
    provider: 'fal'
  },

  // SEEDREAM 4.5 - FAL.ai (ByteDance)
  {
    id: 'seedream-4.5',
    name: 'fal-ai/bytedance/seedream/v4.5/text-to-image',
    displayName: 'SeeDream 4.5',
    description: 'Premium quality with excellent text rendering',
    ticketCost: 1,
    category: 'standard',
    rateLimit: {
      rpm: 0, // No rate limit on FAL.ai
      rpd: 0  // Unlimited with credits
    },
    quality: 'high',
    isAvailable: true,
    provider: 'fal'
  },

  // DIRECT GEMINI API MODELS (No FAL.ai filtering!)
  
  // PRO SCANNER V3 - Direct Gemini API (Gemini 3 Pro Image Preview)
  {
    id: 'gemini-3-pro-image',
    name: 'gemini-3-pro-image-preview',  // Correct model from Google AI Studio
    displayName: 'Pro Scanner v3',
    description: 'Direct Gemini API - No filtering! 1 ticket (2K) or 2 tickets (4K)',
    ticketCost: 1,
    category: 'standard',
    rateLimit: {
      rpm: 10,
      rpd: 250  // Was 250/day based on Tier 2
    },
    quality: 'high',
    isAvailable: true,
    provider: 'gemini'
  },

  // FLASH SCANNER V2.5 - Direct Gemini API (Gemini 2.5 Flash Image)
  {
    id: 'gemini-2.5-flash-image',
    name: 'gemini-2.5-flash-image',
    displayName: 'Flash Scanner v2.5',
    description: 'Direct Gemini API - Fast generation, no filtering!',
    ticketCost: 1,
    category: 'standard',
    rateLimit: {
      rpm: 100,
      rpd: 2000  // Was 2000/day based on Tier 2
    },
    quality: 'balanced',
    isAvailable: true,
    provider: 'gemini'
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

export function getTicketCost(modelId: string, quality?: '2k' | '4k'): number {
  const model = getModelById(modelId)
  if (!model) return 1
  
  // NanoBanana Pro & Pro Scanner v3: 1 ticket for 2K, 2 tickets for 4K
  if ((modelId === 'nano-banana-pro' || modelId === 'gemini-3-pro-image') && quality === '4k') {
    return 2
  }
  
  // All other models use base ticket cost
  return model.ticketCost
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
