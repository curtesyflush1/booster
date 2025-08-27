// Machine Learning and Prediction Types for BoosterBeacon

export interface IPricePrediction {
  productId: string;
  predictedPrice: number;
  confidence: number;
  trend: 'increasing' | 'decreasing' | 'stable';
  timeframe: number; // days
  factors: string[];
  generatedAt: Date;
}

export interface ISelloutRisk {
  productId: string;
  riskScore: number; // 0-100
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  estimatedSelloutTime?: number; // hours
  factors: string[];
  generatedAt: Date;
}

export interface IROIEstimate {
  productId: string;
  currentPrice: number;
  estimatedValue: number;
  roiPercentage: number;
  timeframe: number; // days
  confidence: number;
  marketFactors: string[];
  generatedAt: Date;
}

export interface IHypeMeter {
  productId: string;
  hypeScore: number; // 0-100
  hypeLevel: 'low' | 'medium' | 'high' | 'viral';
  engagementMetrics: IEngagementMetrics;
  trendDirection: 'rising' | 'falling' | 'stable';
  generatedAt: Date;
}

export interface IEngagementMetrics {
  watchCount: number;
  alertCount: number;
  clickThroughRate: number;
  searchVolume: number;
  socialMentions?: number;
  communityDiscussions?: number;
}

export interface IMarketInsights {
  productId: string;
  priceHistory: IPriceDataPoint[];
  availabilityPattern: IAvailabilityDataPoint[];
  seasonalTrends: ISeasonalTrend[];
  competitorAnalysis: ICompetitorData[];
  marketSummary: IMarketSummary;
  generatedAt: Date;
}

export interface IPriceDataPoint {
  date: Date;
  price: number;
  retailerId: string;
  retailerName?: string;
  inStock: boolean;
  originalPrice?: number;
}

export interface IAvailabilityDataPoint {
  date: Date;
  inStock: boolean;
  retailerId: string;
  retailerName?: string;
  stockLevel?: number;
  availabilityStatus?: string;
}

export interface ISeasonalTrend {
  period: string; // 'Q1', 'Q2', 'holiday', 'back-to-school', etc.
  avgPriceChange: number; // percentage
  availabilityChange: number; // percentage
  demandMultiplier: number;
  historicalData: ISeasonalDataPoint[];
}

export interface ISeasonalDataPoint {
  year: number;
  period: string;
  avgPrice: number;
  availabilityRate: number;
  demandScore: number;
}

export interface ICompetitorData {
  retailerId: string;
  retailerName: string;
  avgPrice: number;
  availability: number; // percentage
  marketShare: number; // percentage
  priceCompetitiveness: 'low' | 'medium' | 'high';
  stockReliability: 'low' | 'medium' | 'high';
}

export interface IMarketSummary {
  avgPrice: number;
  priceRange: {
    min: number;
    max: number;
  };
  availabilityRate: number; // percentage across all retailers
  priceVolatility: number; // coefficient of variation
  marketTrend: 'bullish' | 'bearish' | 'stable';
  recommendedAction: 'buy' | 'wait' | 'sell' | 'monitor';
}

export interface IMLAnalysis {
  productId: string;
  pricePrediction: IPricePrediction;
  selloutRisk: ISelloutRisk;
  roiEstimate?: IROIEstimate;
  hypeMeter: IHypeMeter;
  marketInsights: IMarketInsights;
  overallScore: number; // 0-100 composite score
  recommendation: IMLRecommendation;
  generatedAt: Date;
}

export interface IMLRecommendation {
  action: 'strong_buy' | 'buy' | 'hold' | 'sell' | 'avoid';
  confidence: number; // 0-100
  reasoning: string[];
  timeframe: 'immediate' | 'short_term' | 'medium_term' | 'long_term';
  riskLevel: 'low' | 'medium' | 'high';
}

export interface ITrendingProduct {
  productId: string;
  productName: string;
  categoryId?: string;
  hypeMeter: IHypeMeter;
  recentPriceChange?: number;
  availabilityStatus: string;
  trendScore: number; // Composite trending score
  trendRank: number;
}

export interface IHighRiskProduct {
  productId: string;
  productName: string;
  categoryId?: string;
  riskAssessment: ISelloutRisk;
  currentAvailability: number; // percentage
  avgPrice: number;
  urgencyScore: number; // 0-100
}

export interface IMLModelMetrics {
  modelName: string;
  modelVersion: string;
  accuracy: number;
  precision: number;
  recall: number;
  f1Score: number;
  trainingDataSize: number;
  lastTrainedAt: Date;
  validationResults: IValidationResult[];
}

export interface IValidationResult {
  testName: string;
  passed: boolean;
  score: number;
  details: string;
  testedAt: Date;
}

export interface IDataQualityMetrics {
  productId?: string;
  dataCompleteness: number; // percentage
  dataFreshness: number; // hours since last update
  dataAccuracy: number; // percentage
  missingFields: string[];
  qualityScore: number; // 0-100
  recommendations: string[];
}

export interface IPredictionRequest {
  productId: string;
  predictionType: 'price' | 'sellout' | 'roi' | 'hype' | 'comprehensive';
  timeframe?: number;
  currentPrice?: number;
  parameters?: Record<string, any>;
}

export interface IPredictionResponse<T> {
  success: boolean;
  data: T;
  metadata: {
    processingTime: number; // milliseconds
    dataQuality: IDataQualityMetrics;
    modelVersion: string;
    cacheHit: boolean;
  };
  errors?: string[];
  warnings?: string[];
}

export interface IMLConfiguration {
  priceModel: {
    algorithm: 'linear_regression' | 'polynomial' | 'arima' | 'lstm';
    lookbackDays: number;
    confidenceThreshold: number;
  };
  riskModel: {
    algorithm: 'logistic_regression' | 'random_forest' | 'gradient_boost';
    features: string[];
    riskThresholds: {
      low: number;
      medium: number;
      high: number;
    };
  };
  hypeModel: {
    engagementWeights: {
      watches: number;
      alerts: number;
      clicks: number;
      searches: number;
    };
    trendWindow: number; // days
  };
  dataCollection: {
    priceHistoryRetentionDays: number;
    snapshotIntervalMinutes: number;
    batchSize: number;
  };
}

export interface IMLTrainingData {
  productId: string;
  features: Record<string, number>;
  target: number;
  timestamp: Date;
  dataSource: string;
  validated: boolean;
}

export interface IMLModelPerformance {
  modelName: string;
  predictionType: string;
  accuracy: number;
  meanAbsoluteError: number;
  rootMeanSquareError: number;
  r2Score: number;
  predictionCount: number;
  avgProcessingTime: number; // milliseconds
  lastEvaluatedAt: Date;
}

// Enums for type safety
export enum PredictionType {
  PRICE = 'price',
  SELLOUT = 'sellout',
  ROI = 'roi',
  HYPE = 'hype',
  COMPREHENSIVE = 'comprehensive'
}

export enum TrendDirection {
  RISING = 'rising',
  FALLING = 'falling',
  STABLE = 'stable'
}

export enum RiskLevel {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}

export enum HypeLevel {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  VIRAL = 'viral'
}

export enum MarketTrend {
  BULLISH = 'bullish',
  BEARISH = 'bearish',
  STABLE = 'stable'
}

export enum RecommendationAction {
  STRONG_BUY = 'strong_buy',
  BUY = 'buy',
  HOLD = 'hold',
  SELL = 'sell',
  AVOID = 'avoid'
}