import fs from 'fs';
import path from 'path';
import { IModelRunner } from './IModelRunner';
import { Product } from '../../models/Product';
import { logger } from '../../utils/logger';
import { ProductInsights } from '../dashboardService';

type ModelFile = { coef: number[]; features: string[]; trainedAt: string };

export class PricePredictionModelRunner implements IModelRunner {
  private modelPath = path.join(process.cwd(), 'data', 'ml', 'price_model.json');
  private model: ModelFile | null = null;

  constructor() {
    try {
      if (fs.existsSync(this.modelPath)) {
        this.model = JSON.parse(fs.readFileSync(this.modelPath, 'utf8')) as ModelFile;
      }
    } catch {}
  }

  async train(csvPath: string = path.join(process.cwd(), 'data', 'ml', 'ml_training_data.csv')): Promise<void> {
    try {
      if (!fs.existsSync(csvPath)) {
        throw new Error('Training data not found');
      }
      const lines = fs.readFileSync(csvPath, 'utf8').trim().split(/\r?\n/);
      if (lines.length < 2) throw new Error('Insufficient training rows');
      const header = lines[0].split(',');
      const idx = (name: string) => header.indexOf(name);
      const iRecent = idx('recent_avg');
      const iPrev = idx('prev_avg');
      const iTrend = idx('trend_pct');
      const iMsrp = idx('msrp');
      const iPop = idx('popularity');
      const iLabel = idx('label_next7');
      if ([iRecent,iPrev,iTrend,iMsrp,iPop,iLabel].some(n=>n<0)) throw new Error('Invalid training header');

      const X: number[][] = [];
      const y: number[] = [];
      for (let k=1;k<lines.length;k++) {
        const parts = lines[k].split(',');
        if (parts.length !== header.length) continue;
        const recent = Number(parts[iRecent])||0;
        const prev = Number(parts[iPrev])||0;
        const trend = Number(parts[iTrend])||0;
        const msrp = Number(parts[iMsrp])||0;
        const pop = Number(parts[iPop])||0;
        const label = Number(parts[iLabel])||0;
        const popNorm = pop/1000; // rough normalization
        X.push([1, recent, prev, trend, msrp, popNorm]);
        y.push(label);
      }
      const coef = ols(X, y);
      const model: ModelFile = {
        coef,
        features: ['bias','recent','prev','trend','msrp','popNorm'],
        trainedAt: new Date().toISOString()
      };
      fs.mkdirSync(path.dirname(this.modelPath), { recursive: true });
      fs.writeFileSync(this.modelPath, JSON.stringify(model, null, 2), 'utf8');
      this.model = model;
      logger.info('PricePredictionModelRunner trained', { coef });
    } catch (error) {
      logger.error('Training failed', { error: error instanceof Error ? error.message : String(error) });
      throw error;
    }
  }

  async predict(productId: string): Promise<ProductInsights | null> {
    try {
      const product = await Product.findById<any>(productId);
      if (!product) return null;
      const knex = Product.getKnex();
      const rows: Array<{ price: number | null; recorded_at: Date }>
        = await knex('price_history')
          .select('price', 'recorded_at')
          .where('product_id', productId)
          .whereNotNull('price')
          .orderBy('recorded_at', 'desc')
          .limit(28);
      const prices = rows.map(r => (r.price == null ? null : Number(r.price)))
        .filter((n): n is number => typeof n === 'number' && !isNaN(n));
      if (prices.length < 2) return null;
      const window = 7;
      const recentAvg = avg(prices.slice(0, window));
      const prevAvg = avg(prices.slice(window, window*2));
      const trendPct = prevAvg>0 ? (recentAvg - prevAvg)/prevAvg : 0;
      const msrp = typeof product.msrp === 'number' ? product.msrp : Number(product.msrp) || 0;
      const pop = Number((product as any).popularity_score) || 0;
      const popNorm = pop/1000;

      const baseline = recentAvg || msrp || prevAvg || 0;
      let nextWeek = baseline;
      if (this.model) {
        const x = [1, recentAvg, prevAvg, trendPct, msrp, popNorm];
        nextWeek = dot(this.model.coef, x);
      } else {
        // Fallback simple projection
        nextWeek = baseline * (1 + trendPct * 0.5);
      }
      const nextMonth = nextWeek * (1 + trendPct * 2);
      const historyPoints = prices.length;
      const confidence = Math.max(0.4, Math.min(0.95, historyPoints/20));
      const direction: 'up' | 'down' | 'flat' = trendPct > 0.01 ? 'up' : trendPct < -0.01 ? 'down' : 'flat';

      return {
        productId,
        productName: (product as any).name || 'Unknown Product',
        priceForcast: {
          nextWeek: round2(nextWeek),
          nextMonth: round2(nextMonth),
          confidence: round2(confidence)
        },
        basicTrend: {
          direction,
          percent: round2(trendPct * 100),
          window: '7d_vs_prev_7d'
        },
        selloutRisk: {
          score: Math.round(Math.min(100, (pop/10) * 0.6)),
          timeframe: '2-4 weeks',
          confidence: round2(Math.max(0.5, Math.min(0.9, pop/200)))
        },
        roiEstimate: {
          shortTerm: round2(trendPct*100),
          longTerm: round2(trendPct*200),
          confidence: round2(confidence)
        },
        hypeScore: Math.min(100, Math.round((pop/10) * 0.7)),
        updatedAt: new Date().toISOString()
      };
    } catch (error) {
      logger.error('PricePredictionModelRunner.predict failed', { productId, error: error instanceof Error ? error.message : String(error) });
      return null;
    }
  }
}

function avg(arr: number[]) { return arr.length ? arr.reduce((a,b)=>a+b,0)/arr.length : 0; }
function round2(n: number) { return Math.round((n + Number.EPSILON) * 100) / 100; }
function dot(a: number[], b: number[]) { return a.reduce((s,v,i)=>s+v*(b[i]||0),0); }

// Ordinary Least Squares using normal equations (X^T X)^{-1} X^T y
function ols(X: number[][], y: number[]): number[] {
  const XT = transpose(X);
  const XTX = multiply(XT, X);
  const XTy = multiplyVec(XT, y);
  const inv = invertSymmetric(XTX);
  return multiplyVec(inv, XTy);
}

function transpose(A: number[][]): number[][] {
  const m = A.length, n = A[0].length;
  const T = Array.from({length:n},()=>Array(m).fill(0));
  for (let i=0;i<m;i++) for (let j=0;j<n;j++) T[j][i]=A[i][j];
  return T;
}

function multiply(A: number[][], B: number[][]): number[][] {
  const m=A.length, n=B[0].length, k=B.length;
  const C = Array.from({length:m},()=>Array(n).fill(0));
  for (let i=0;i<m;i++) for (let j=0;j<n;j++) {
    let s=0; for (let t=0;t<k;t++) s+=A[i][t]*B[t][j]; C[i][j]=s;
  }
  return C;
}

function multiplyVec(A: number[][], v: number[]): number[] {
  return A.map(row => row.reduce((s, a, i) => s + a * (v[i]||0), 0));
}

// Basic symmetric matrix inversion via Gaussian elimination with partial pivoting
function invertSymmetric(A: number[][]): number[][] {
  const n = A.length;
  // Initialize augmented [A | I]
  const aug = A.map((row,i) => [...row, ...Array.from({length:n},(_,j)=>i===j?1:0)]);
  // Gauss-Jordan elimination
  for (let i=0;i<n;i++) {
    // Pivot
    let maxRow=i; for (let r=i+1;r<n;r++) if (Math.abs(aug[r][i])>Math.abs(aug[maxRow][i])) maxRow=r;
    if (Math.abs(aug[maxRow][i])<1e-12) return identity(n); // singular; fallback
    if (maxRow!==i) [aug[i],aug[maxRow]]=[aug[maxRow],aug[i]];
    // Normalize row
    const pivot=aug[i][i];
    for (let j=0;j<2*n;j++) aug[i][j]/=pivot;
    // Eliminate
    for (let r=0;r<n;r++) if (r!==i) {
      const factor=aug[r][i];
      for (let j=0;j<2*n;j++) aug[r][j]-=factor*aug[i][j];
    }
  }
  // Extract inverse
  return aug.map(row => row.slice(n));
}

function identity(n: number): number[][] {
  return Array.from({length:n},(_,i)=>Array.from({length:n},(_,j)=>i===j?1:0));
}
