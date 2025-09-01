export interface PricingPlan {
  id: string;
  name: string;
  price: string;
  period: string;
  description: string;
  features: string[];
  cta: string;
  href: string;
  popular: boolean;
  badge?: string;
}

// Keep only the Free tier here. Paid plans are loaded from the backend.
export const PRICING_PLANS: PricingPlan[] = [
  {
    id: 'free',
    name: 'Free',
    price: '$0',
    period: 'forever',
    description: 'Perfect for casual collectors',
    features: [
      'Up to 5 product watches',
      'Basic email alerts',
      'Web push notifications',
      'Community support'
    ],
    cta: 'Get Started',
    href: '/register',
    popular: false
  }
];

export const PRICING_CONFIG = {
  title: 'Simple, Transparent Pricing',
  subtitle: 'Choose the plan that fits your collecting needs',
  currency: 'USD'
} as const;
