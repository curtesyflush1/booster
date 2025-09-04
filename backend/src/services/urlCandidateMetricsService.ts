import { redisService } from './redisService';

type MetricType = 'requests' | 'blocked' | 'errors' | 'live' | 'valid' | 'invalid';

export class UrlCandidateMetricsService {
  static minuteBucket(d: Date = new Date()): string {
    const y = d.getUTCFullYear();
    const m = String(d.getUTCMonth()+1).padStart(2,'0');
    const day = String(d.getUTCDate()).padStart(2,'0');
    const h = String(d.getUTCHours()).padStart(2,'0');
    const min = String(d.getUTCMinutes()).padStart(2,'0');
    return `${y}${m}${day}${h}${min}`;
  }

  static key(slug: string, bucket: string, metric: MetricType): string {
    return `metrics:urlcand:${slug}:${bucket}:${metric}`;
  }

  static async record(slug: string, metric: MetricType, at: Date = new Date()): Promise<void> {
    try {
      const bucket = this.minuteBucket(at);
      const key = this.key(slug, bucket, metric);
      await redisService.incr(key);
      // expire after 2 hours
      await redisService.expire(key, 2*60*60);
    } catch {}
  }

  static async getSeries(slugs: string[], minutes: number = 60, metrics: MetricType[] = ['requests','blocked']): Promise<{ times: string[]; data: Record<string, Record<MetricType, number[]>> }> {
    const times: string[] = [];
    const now = new Date();
    for (let i = minutes-1; i >= 0; i--) {
      const t = new Date(now.getTime() - i*60*1000);
      times.push(this.minuteBucket(t));
    }
    const data: Record<string, Record<MetricType, number[]>> = {} as any;
    for (const slug of slugs) {
      data[slug] = {} as any;
      for (const metric of metrics) {
        const arr: number[] = [];
        for (const bucket of times) {
          try {
            const val = await redisService.get(this.key(slug, bucket, metric));
            arr.push(val ? parseInt(val, 10) || 0 : 0);
          } catch {
            arr.push(0);
          }
        }
        (data[slug] as any)[metric] = arr;
      }
    }
    return { times, data };
  }
}

export const urlCandidateMetricsService = UrlCandidateMetricsService;

