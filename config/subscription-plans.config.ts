// Subscription plan configuration
// After creating plans in PayPal, add the Plan IDs here

export interface SubscriptionPlan {
  id: string;
  name: string;
  description: string;
  price: number;
  currency: string;
  interval: 'biweekly' | 'monthly' | 'yearly';
  tickets: number;
  ticketsPerCycle: number;
  paypalPlanId: string | null; // Set this after creating plan in PayPal
  features: string[];
  popular?: boolean;
}

export const SUBSCRIPTION_PLANS: SubscriptionPlan[] = [
  {
    id: 'dev-tier-biweekly',
    name: 'Dev Tier - Biweekly',
    description: 'Perfect for regular creators',
    price: 20,
    currency: 'USD',
    interval: 'biweekly',
    tickets: 250,
    ticketsPerCycle: 250,
    paypalPlanId: 'P-5U930760G4736210DNF6REWA',
    features: [
      '250 tickets every 2 weeks',
      'Full Canvas Scanner access',
      'Multiple scanner panels',
      'Session saving',
      'Priority support',
    ],
  },
  {
    id: 'dev-tier-monthly',
    name: 'Dev Tier - Monthly',
    description: 'Best value for power users',
    price: 40,
    currency: 'USD',
    interval: 'monthly',
    tickets: 500,
    ticketsPerCycle: 500,
    paypalPlanId: 'P-74R11551RU132831DNF6RGCQ',
    features: [
      '500 tickets per month',
      'Full Canvas Scanner access',
      'Multiple scanner panels',
      'Session saving',
      'Priority support',
    ],
    popular: true,
  },
  {
    id: 'dev-tier-yearly',
    name: 'Dev Tier - Yearly',
    description: 'Save 50% with annual billing',
    price: 480,
    currency: 'USD',
    interval: 'yearly',
    tickets: 500,
    ticketsPerCycle: 500, // Per month
    paypalPlanId: 'P-2AF43912DP952071YNF6RGTA',
    features: [
      '500 tickets per month (6,000/year)',
      'Full Canvas Scanner access',
      'Multiple scanner panels',
      'Session saving',
      'Priority support',
      '50% savings vs monthly',
    ],
  },
];

// Helper to get plan by ID
export function getPlanById(id: string): SubscriptionPlan | undefined {
  return SUBSCRIPTION_PLANS.find(plan => plan.id === id);
}

// Helper to get plan by PayPal Plan ID
export function getPlanByPayPalId(paypalPlanId: string): SubscriptionPlan | undefined {
  return SUBSCRIPTION_PLANS.find(plan => plan.paypalPlanId === paypalPlanId);
}

// Format interval for display
export function formatInterval(interval: string): string {
  switch (interval) {
    case 'biweekly':
      return 'every 2 weeks';
    case 'monthly':
      return 'per month';
    case 'yearly':
      return 'per year';
    default:
      return interval;
  }
}
