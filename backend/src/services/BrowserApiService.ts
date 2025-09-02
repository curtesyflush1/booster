import axios from 'axios';

export interface CheckoutRequest {
  userId: string;
  productId: string;
  retailerSlug: string;
  qty: number;
  maxPrice?: number;
  sessionFingerprint?: string;
}

export interface CheckoutResult {
  success: boolean;
  addedToCartAt?: string;
  purchasedAt?: string;
  pricePaid?: number;
  orderId?: string;
  failureReason?: string;
}

/**
 * Contract for a remote Browser API that can execute real-world checkout flows.
 * This is a stubbed implementation that optionally POSTs to a configured endpoint
 * or simulates outcomes when not configured.
 */
export class BrowserApiService {
  private baseUrl?: string;
  private token?: string;

  constructor() {
    this.baseUrl = process.env.BROWSER_API_URL;
    this.token = process.env.BROWSER_API_TOKEN;
  }

  async executeCheckout(req: CheckoutRequest): Promise<CheckoutResult> {
    // If remote service configured, call it
    if (this.baseUrl && this.token) {
      try {
        const res = await axios.post(
          `${this.baseUrl.replace(/\/$/, '')}/checkout`,
          req,
          {
            headers: {
              Authorization: `Bearer ${this.token}`,
              'Content-Type': 'application/json',
            },
            timeout: Number(process.env.BROWSER_API_TIMEOUT_MS || 60000),
          }
        );
        return res.data as CheckoutResult;
      } catch (error: any) {
        const message = error?.response?.data?.error || error?.message || 'BROWSER_API_ERROR';
        return { success: false, failureReason: String(message) };
      }
    }

    // Fallback: simulate realistic timings and outcomes
    const startedAt = Date.now();
    await new Promise((r) => setTimeout(r, 1000 + Math.floor(Math.random() * 1000)));
    const ok = Math.random() < 0.7;
    if (!ok) {
      return { success: false, failureReason: 'SIMULATED_OUT_OF_STOCK' };
    }
    const added = new Date(startedAt + 500).toISOString();
    const purchased = new Date().toISOString();
    return {
      success: true,
      addedToCartAt: added,
      purchasedAt: purchased,
      pricePaid: req.maxPrice,
      orderId: `SIM-${Math.random().toString(36).slice(2, 10)}`,
    };
  }
}

