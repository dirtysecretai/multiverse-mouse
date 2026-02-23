// Model configuration for Prompt Studio
// This matches the main page scanner dropdown design

export interface ModelConfig {
  id: string;
  name: string;
  icon: string;
  badges: string[];
  badgeColors: string[];
  quality: 'FAST' | 'HIGH' | 'BALANCED';
  cost: {
    '2k': number;
    '4k': number;
  };
  note?: string;
  warning?: string;
  color: string;
  dailyLimit?: number;
  dailyLimitText?: string;
}

export const MODEL_CONFIG: Record<string, ModelConfig> = {
  'nano-banana-cluster': {
    id: 'nano-banana-cluster',
    name: 'NanoBanana Cluster',
    icon: '⚡',
    badges: ['MULTIPLE IMAGES'],
    badgeColors: ['bg-fuchsia-500'],
    quality: 'FAST',
    cost: { '2k': 2, '4k': 2 },
    note: 'Fast, artistic generation - 2 tickets for 2 images!',
    color: 'fuchsia',
    dailyLimit: undefined,
  },
  'nano-banana-pro': {
    id: 'nano-banana-pro',
    name: 'NanoBanana Pro',
    icon: '⚡',
    badges: ['BEST QUALITY', 'UNSTABLE'],
    badgeColors: ['bg-yellow-500', 'bg-orange-500'],
    quality: 'HIGH',
    cost: { '2k': 5, '4k': 10 },
    note: 'Premium quality - 5 tickets (2K) or 10 tickets (4K)',
    warning: '⚠️ Tip: Keep prompts SFW (safe for work) for best results. Sensitive content may trigger quality reduction.',
    color: 'purple',
    dailyLimit: undefined,
  },
  'seedream-4.5': {
    id: 'seedream-4.5',
    name: 'SeeDream 4.5',
    icon: '⚡',
    badges: ['UNCENSORED'],
    badgeColors: ['bg-green-500'],
    quality: 'HIGH',
    cost: { '2k': 1, '4k': 2 },
    note: 'Premium quality with excellent text rendering - 1 ticket (2K) or 2 tickets (4K)',
    color: 'green',
    dailyLimit: undefined,
  },
  'pro-scanner-v3': {
    id: 'pro-scanner-v3',
    name: 'Pro Scanner v3',
    icon: '⚡',
    badges: ['BEST QUALITY', 'LIMITED USE', 'SELECTED'],
    badgeColors: ['bg-yellow-500', 'bg-cyan-500', 'bg-slate-800'],
    quality: 'HIGH',
    cost: { '2k': 5, '4k': 10 },
    note: 'Direct Gemini API - No filtering! 5 tickets (2K) or 10 tickets (4K)',
    warning: '⚠️ Daily Limit: 250 generations per day. Resets at midnight PST.',
    color: 'cyan',
    dailyLimit: 250,
    dailyLimitText: 'Daily Limit: 250',
  },
  'flash-scanner-v2.5': {
    id: 'flash-scanner-v2.5',
    name: 'Flash Scanner v2.5',
    icon: '⚡',
    badges: ['FAST', 'LIMITED USE'],
    badgeColors: ['bg-blue-500', 'bg-cyan-500'],
    quality: 'BALANCED',
    cost: { '2k': 1, '4k': 1 },
    note: 'Direct Gemini API - Fast generation, no filtering!',
    warning: '⚠️ Daily Limit: 2000 generations per day. Resets at midnight PST.',
    color: 'blue',
    dailyLimit: 2000,
    dailyLimitText: 'Daily Limit: 2000',
  },
  'flux-2': {
    id: 'flux-2',
    name: 'FLUX 2',
    icon: '🌊',
    badges: ['REALISM'],
    badgeColors: ['bg-blue-500'],
    quality: 'HIGH',
    cost: { '2k': 1, '4k': 1 },
    note: 'Enhanced realism, crisp text, native editing - 1 ticket',
    color: 'blue',
    dailyLimit: undefined,
  },
};

export const getModelConfig = (modelId: string): ModelConfig => {
  return MODEL_CONFIG[modelId] || MODEL_CONFIG['nano-banana-pro'];
};

export const getAllModels = (): ModelConfig[] => {
  return Object.values(MODEL_CONFIG);
};
