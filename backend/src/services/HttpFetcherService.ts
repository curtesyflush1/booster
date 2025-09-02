import axios, { AxiosRequestConfig } from 'axios';

// Providers: 'proxy' is our in-house unlocker gateway. 'brightdata' remains a deprecated alias.
type Provider = 'direct' | 'proxy' | 'browser' | 'brightdata';

export interface FetchOptions {
  params?: Record<string, any>;
  headers?: Record<string, string>;
  timeout?: number;
  render?: boolean; // request via headless/browser when supported
  country?: string; // preferred country/geo
  useSession?: boolean; // keep session sticky across retries
}

export class HttpFetcherService {
  private provider: Provider;
  private brightSession: { id: string; expiresAt: number } | null = null;

  constructor(provider?: Provider) {
    const raw = (provider || (process.env.HTTP_FETCH_PROVIDER as Provider) || 'direct');
    // Back-compat: map deprecated 'brightdata' to our internal 'proxy' provider
    this.provider = raw === 'brightdata' ? 'proxy' : raw;
  }

  async get(url: string, options: FetchOptions = {}): Promise<{ data: any; status: number; headers: Record<string, any> }> {
    switch (this.provider) {
      case 'proxy':
      case 'brightdata':
        return this.fetchViaProxyUnlocker(url, options);
      case 'browser':
        return this.fetchViaBrowserAPI(url, options);
      case 'direct':
      default:
        return this.fetchDirect(url, options);
    }
  }

  private async fetchDirect(url: string, options: FetchOptions): Promise<{ data: any; status: number; headers: Record<string, any> }> {
    const res = await axios.get(url, {
      params: options.params,
      headers: options.headers,
      timeout: options.timeout || 15000
    });
    return { data: res.data, status: res.status, headers: res.headers };
  }

  // Internal HTTP Unlocker/Proxy Gateway (in-house). Accepts BRIGHTDATA_* envs for back-compat.
  private async fetchViaProxyUnlocker(url: string, options: FetchOptions): Promise<{ data: any; status: number; headers: Record<string, any> }> {
    const endpoint = process.env.UNLOCKER_API_URL || process.env.UNLOCKER_URL || process.env.PROXY_GATEWAY_URL || process.env.BRIGHTDATA_API_URL || process.env.BRIGHTDATA_UNLOCKER_URL;
    const token = process.env.UNLOCKER_API_TOKEN || process.env.PROXY_GATEWAY_TOKEN || process.env.BRIGHTDATA_API_TOKEN || process.env.BRIGHTDATA_TOKEN;
    const defaultCountry = process.env.PROXY_COUNTRY || process.env.UNLOCKER_COUNTRY || process.env.BRIGHTDATA_COUNTRY || 'us';
    const maxRetries = Number(process.env.PROXY_MAX_RETRIES || process.env.UNLOCKER_MAX_RETRIES || process.env.BRIGHTDATA_MAX_RETRIES || 2);
    const ttlMs = Number(process.env.PROXY_SESSION_TTL_MS || process.env.UNLOCKER_SESSION_TTL_MS || process.env.BRIGHTDATA_SESSION_TTL_MS || 120000);
    const timeout = options.timeout || Number(process.env.PROXY_TIMEOUT_MS || process.env.UNLOCKER_TIMEOUT_MS || process.env.BRIGHTDATA_TIMEOUT_MS || 30000);
    if (!endpoint || !token) {
      return this.fetchDirect(url, options);
    }

    const now = Date.now();
    if (options.useSession !== false) {
      if (!this.brightSession || this.brightSession.expiresAt <= now) {
        this.brightSession = { id: `bb_${Math.random().toString(36).slice(2)}`, expiresAt: now + ttlMs };
      }
    } else {
      this.brightSession = null;
    }

    const baseHeaders: Record<string, string> = {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...(options.headers || {})
    };

    const tryOnce = async (attempt: number) => {
      const payload: Record<string, any> = {
        url,
        method: 'GET',
        params: options.params || {},
        render: !!options.render,
        country: options.country || defaultCountry,
        // Common unlocker fields when supported
        session: this.brightSession?.id,
        headers: {
          'User-Agent': options.headers?.['User-Agent'] || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36',
          'Accept-Language': options.headers?.['Accept-Language'] || 'en-US,en;q=0.8'
        }
      };

      try {
        const res = await axios.post(endpoint, payload, { headers: baseHeaders, timeout });
        const d = res.data;
        // Flexible extraction across providers
        const content = d?.content ?? d?.solution?.content ?? d?.response?.body ?? d;
        return { data: content, status: res.status, headers: res.headers } as const;
      } catch (err: any) {
        const status = err?.response?.status;
        const shouldRetry = attempt < maxRetries && (status === 403 || status === 429 || err.code === 'ECONNABORTED');
        if (shouldRetry) {
          // rotate session and backoff
          this.brightSession = { id: `bb_${Math.random().toString(36).slice(2)}`, expiresAt: Date.now() + ttlMs };
          const backoff = 250 * Math.pow(2, attempt);
          await new Promise(r => setTimeout(r, backoff));
          return tryOnce(attempt + 1);
        }
        // final fallback to direct for scraping use-cases
        if (!status || status === 403 || status === 429) {
          try {
            return await this.fetchDirect(url, options);
          } catch {}
        }
        throw err;
      }
    };

    return tryOnce(0);
  }

  // Placeholder for remote browser service (e.g., Browserless/Zyte smart browser)
  private async fetchViaBrowserAPI(url: string, options: FetchOptions): Promise<{ data: any; status: number; headers: Record<string, any> }> {
    const endpoint = process.env.BROWSER_API_URL;
    const token = process.env.BROWSER_API_TOKEN;
    if (!endpoint || !token) {
      return this.fetchDirect(url, options);
    }
    const headers: Record<string, string> = {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...(options.headers || {})
    };
    const payload = { url, params: options.params || {} };
    const res = await axios.post(endpoint, payload, { headers, timeout: options.timeout || 45000 });
    return { data: res.data, status: res.status, headers: res.headers };
  }
}
