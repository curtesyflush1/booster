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
  },
  {
    id: 'pro',
    name: 'Pro',
    price: '$9.99',
    period: 'month',
    description: 'For serious collectors',
    features: [
      'Unlimited product watches',
      'SMS & Discord alerts',
      'Priority alert delivery',
      'Price predictions & ROI',
      'Historical data access',
      'Premium support'
    ],
    cta: 'Start Free Trial',
    href: '/register',
    popular: true,
    badge: 'Most Popular'
  }
];

export const PRICING_CONFIG = {
  title: 'Simple, Transparent Pricing',
  subtitle: 'Choose the plan that fits your collecting needs',
  currency: 'USD'
} as const;