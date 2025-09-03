import axios, { AxiosRequestConfig } from 'axios';
import { HttpsProxyAgent } from 'https-proxy-agent';

// Providers: 'proxy' is our in-house unlocker gateway. 'brightdata' remains a deprecated alias.
type Provider = 'direct' | 'proxy' | 'browser' | 'brightdata' | 'forward';

export interface FetchOptions {
  params?: Record<string, any>;
  headers?: Record<string, string>;
  timeout?: number;
  render?: boolean; // request via headless/browser when supported
  country?: string; // preferred country/geo
  useSession?: boolean; // keep session sticky across retries
  retailerId?: string; // optional retailer context for per-retailer creds
}

export class HttpFetcherService {
  private provider: Provider;
  private brightSession: { id: string; expiresAt: number } | null = null;
  private cookieJar: Map<string, string> = new Map();
  private forwardUsername?: string;

  constructor(provider?: Provider) {
    const raw = (provider || (process.env.HTTP_FETCH_PROVIDER as Provider) || 'direct');
    // Back-compat: map deprecated 'brightdata' to our internal 'proxy' provider
    this.provider = raw === 'brightdata' ? 'proxy' : raw;
    this.forwardUsername = process.env.FORWARD_PROXY_USERNAME;
  }

  // Expose a stable session key to allow upstreams to vary headers per session
  public getSessionKey(): string {
    switch (this.provider) {
      case 'forward':
        return this.forwardUsername || process.env.FORWARD_PROXY_USERNAME || 'forward:default';
      case 'proxy':
        return this.brightSession?.id || 'proxy:none';
      case 'browser':
        return 'browser';
      case 'direct':
      default:
        return 'direct';
    }
  }

  async get(url: string, options: FetchOptions = {}): Promise<{ data: any; status: number; headers: Record<string, any> }> {
    // Force browser API when render=true and credentials available, regardless of provider
    if (options.render === true && process.env.BROWSER_API_URL && process.env.BROWSER_API_TOKEN) {
      return this.fetchViaBrowserAPI(url, options);
    }
    switch (this.provider) {
      case 'proxy':
      case 'brightdata':
        return this.fetchViaProxyUnlocker(url, options);
      case 'forward':
        return this.fetchViaForwardProxy(url, options);
      case 'browser':
        return this.fetchViaBrowserAPI(url, options);
      case 'direct':
      default:
        return this.fetchDirect(url, options);
    }
  }

  private async fetchDirect(url: string, options: FetchOptions): Promise<{ data: any; status: number; headers: Record<string, any> }> {
    const headers = { ...(options.headers || {}) } as Record<string, string>;
    try {
      const host = new URL(url).host;
      const cookie = this.cookieJar.get(host);
      if (cookie && !headers['Cookie']) headers['Cookie'] = cookie;
    } catch {}
    const res = await axios.get(url, {
      params: options.params,
      headers,
      timeout: options.timeout || 15000
    });
    this.captureSetCookie(url, res.headers);
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
        this.captureSetCookie(url, res.headers as any);
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

  // Raw forward proxy (e.g., Oxylabs, Smartproxy) via CONNECT using a proxy agent
  private async fetchViaForwardProxy(url: string, options: FetchOptions): Promise<{ data: any; status: number; headers: Record<string, any> }> {
    const envForRetailer = (key: string, retailerId?: string): string | undefined => {
      if (retailerId) {
        const suffix = retailerId.toUpperCase().replace(/[^A-Z0-9]/g, '_');
        const v = process.env[`${key}_${suffix}`];
        if (v !== undefined) return v;
      }
      return process.env[key];
    };

    const host = envForRetailer('FORWARD_PROXY_HOST', options.retailerId) || process.env.FORWARD_PROXY_HOST;
    const portStr = envForRetailer('FORWARD_PROXY_PORT', options.retailerId) || process.env.FORWARD_PROXY_PORT;
    const port = Number(portStr || 0);
    const configuredUsername = envForRetailer('FORWARD_PROXY_USERNAME', options.retailerId) || process.env.FORWARD_PROXY_USERNAME;
    const username = configuredUsername || this.forwardUsername;
    const password = envForRetailer('FORWARD_PROXY_PASSWORD', options.retailerId) || process.env.FORWARD_PROXY_PASSWORD;
    const protocol = (envForRetailer('FORWARD_PROXY_PROTOCOL', options.retailerId) || process.env.FORWARD_PROXY_PROTOCOL || 'http').toLowerCase();

    if (!host || !port || !username || !password) {
      // Fallback to direct if not configured
      return this.fetchDirect(url, options);
    }

    // First, try axios native proxy config (supports both HTTP/HTTPS targets)
    const headers = { ...(options.headers || {}) } as Record<string, string>;
    try {
      const h = new URL(url).host;
      const cookie = this.cookieJar.get(h);
      if (cookie && !headers['Cookie']) headers['Cookie'] = cookie;
    } catch {}

    try {
      const res = await axios.get(url, {
        params: options.params,
        headers,
        timeout: options.timeout || 20000,
        proxy: {
          protocol,
          host,
          port,
          auth: { username, password }
        },
        decompress: true,
      } as AxiosRequestConfig & { proxy: any });
      this.captureSetCookie(url, res.headers);
      return { data: res.data, status: res.status, headers: res.headers };
    } catch (err: any) {
      // Fallback to explicit CONNECT tunneling via agent, which some environments require
      const proxyUrl = `${protocol}://${encodeURIComponent(username)}:${encodeURIComponent(password)}@${host}:${port}`;
      const agent = new HttpsProxyAgent(proxyUrl);
      const res = await axios.get(url, {
        params: options.params,
        headers,
        timeout: options.timeout || 20000,
        httpAgent: agent,
        httpsAgent: agent,
        decompress: true,
      });
      this.captureSetCookie(url, res.headers);
      return { data: res.data, status: res.status, headers: res.headers };
    }
  }

  // Placeholder for remote browser service (e.g., Browserless/Zyte smart browser)
  private async fetchViaBrowserAPI(url: string, options: FetchOptions): Promise<{ data: any; status: number; headers: Record<string, any> }> {
    let endpoint = process.env.BROWSER_API_URL;
    const token = process.env.BROWSER_API_TOKEN;
    if (!endpoint || !token) {
      return this.fetchDirect(url, options);
    }
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers || {})
    };

    // Provider-specific auth handling
    const epLower = endpoint.toLowerCase();
    if (epLower.includes('chrome.browserless.io')) {
      // Browserless: token as query param (?token=)
      if (!/token=/.test(endpoint)) {
        endpoint += (endpoint.includes('?') ? '&' : '?') + `token=${encodeURIComponent(token)}`;
      }
    } else if (epLower.includes('zyte.com')) {
      // Zyte: use Apikey scheme
      headers['Authorization'] = `Apikey ${token}`;
    } else {
      // Default: Bearer
      headers['Authorization'] = `Bearer ${token}`;
    }
    const payload = { url, params: options.params || {} };
    const res = await axios.post(endpoint, payload, { headers, timeout: options.timeout || 45000 });
    this.captureSetCookie(url, res.headers as any);
    return { data: res.data, status: res.status, headers: res.headers };
  }

  private captureSetCookie(url: string, headers: Record<string, any>) {
    try {
      const host = new URL(url).host;
      const setCookie = (headers['set-cookie'] || headers['Set-Cookie']) as string[] | string | undefined;
      if (setCookie) {
        const cookieStr = Array.isArray(setCookie) ? setCookie.map(c => c.split(';')[0]).join('; ') : setCookie.split(';')[0];
        if (cookieStr) this.cookieJar.set(host, cookieStr);
      }
    } catch {}
  }

  public rotateForwardProxySession(): void {
    if (this.provider !== 'forward') return;
    const base = this.forwardUsername || process.env.FORWARD_PROXY_USERNAME || '';
    const rand = Math.floor(Math.random() * 1_000_000_000);
    let updated = base;
    if (/-sessid-[^-]+/i.test(base)) {
      updated = base.replace(/-sessid-[^-]+/i, `-sessid-${rand}`);
    } else {
      updated = `${base}-sessid-${rand}`;
    }
    this.forwardUsername = updated;
  }

  public async getWithBrowser(url: string, options: FetchOptions = {}) {
    return this.fetchViaBrowserAPI(url, options);
  }
}
