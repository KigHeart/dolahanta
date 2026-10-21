/**
 * DolaHanta — Smart Barrier Intelligence Platform
 * Core Domain Interfaces & Type Definitions
 */

export type ContractType = 'TOUCH' | 'NOTOUCH';

export type BarrierDirection = 'UPPER' | 'LOWER';

export type MarketRegimeType =
  | 'BULLISH_TREND'
  | 'BEARISH_TREND'
  | 'RANGING'
  | 'HIGH_VOLATILITY'
  | 'LOW_VOLATILITY'
  | 'VOLATILITY_EXPANSION'
  | 'REGIME_TRANSITION'
  | 'INSUFFICIENT_DATA';

export type SignalStatus = 'STRONG_CANDIDATE' | 'WATCH' | 'WEAK_SETUP' | 'NO_TRADE';

export type ConnectionMode = 'CONNECTED_LIVE' | 'RECONNECTING' | 'DISCONNECTED' | 'SIMULATED';

export type InstrumentCategory = 'volatility_indices' | 'step_indices' | 'crash_boom' | 'forex';

export interface Instrument {
  symbol: string;
  displayName: string;
  category: InstrumentCategory;
  tickSize: number;
  decimals: number;
  baseVolatility: number; // typical annualized or per-second volatility
  defaultPayoutMultiplier: number; // e.g. 1.85 (85% net return)
  description: string;
}

export interface Tick {
  epoch: number;
  quote: number;
  symbol: string;
}

export interface Candle {
  epoch: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
}

export interface MarketState {
  symbol: string;
  currentPrice: number;
  lastUpdateEpoch: number;
  dataAgeMs: number;
  tickCount: number;
  isStale: boolean;
  returnsShort: number;    // 5-tick log return
  returnsMedium: number;   // 20-tick log return
  returnsLong: number;     // 60-tick log return
  realizedVolShort: number;  // rolling std dev (15)
  realizedVolMedium: number; // rolling std dev (45)
  realizedVolLong: number;   // rolling std dev (120)
  volAccelerationRatio: number; // short / long vol
  trendStrength: number;     // 0 to 1 score
  trendDirection: 'UP' | 'DOWN' | 'FLAT';
  rsi14: number;
  meanReversionZScore: number;
  atr: number;
  atrPct: number;
  supportLevel: number;
  resistanceLevel: number;
  regime: MarketRegimeType;
  regimeProbabilities: Record<MarketRegimeType, number>;
  regimeConfidence: number; // 0 to 1
  regimeExplanation: string;
}

export interface BarrierCandidate {
  id: string;
  instrument: Instrument;
  referencePrice: number;
  barrierLevel: number;
  barrierDirection: BarrierDirection;
  absoluteDistance: number;
  relativeDistancePct: number;
  contractType: ContractType;
  expirySeconds: number;
  
  // Probabilities & Uncertainty
  estimatedProbability: number; // P(success) under model
  rawTouchProbability: number;  // Path-dependent hitting probability P(touch <= T)
  uncertaintyInterval: [number, number]; // [lower95, upper95]
  standardError: number;
  
  // Deriv Contract Economics
  stake: number;
  payoutMultiplier: number; // Total payout per unit stake, e.g. 1.85 (pays $18.5 on $10 stake)
  netReturnMultiplier: number; // payoutMultiplier - 1.0, e.g. 0.85
  expectedProfitPerUnit: number; // p * R - (1 - p)
  expectedValue: number; // expectedProfitPerUnit * stake
  conservativeEV: number; // EV using lower bound of confidence interval
  
  // Selection & Scoring
  riskAwareScore: number; // Composite score factoring EV, uncertainty penalty, and regime alignment
  qualificationStatus: SignalStatus;
  inclusionReasons: string[];
  rejectionReasons: string[];
  modelAssumptions: string[];
  timestamp: number;
}

export interface ScannerFilters {
  search: string;
  category: 'ALL' | InstrumentCategory;
  contractType: 'ALL' | ContractType;
  barrierDirection: 'ALL' | BarrierDirection;
  regime: 'ALL' | MarketRegimeType;
  signalStatus: 'ALL' | SignalStatus;
  minProbability: number; // 0.0 - 1.0
  minEV: number; // -1.0 to 1.0 (e.g. 0.05 for +5%)
  maxUncertainty: number; // e.g. 0.10 for 10%
  sortBy: 'ev' | 'prob' | 'uncertainty' | 'expiry' | 'recency' | 'distance';
  sortDir: 'asc' | 'desc';
}

export interface RiskSettings {
  maxStakePerTrade: number;
  minEVThreshold: number; // Default 0.05 (+5% expected return)
  maxPermissibleUncertainty: number; // Default 0.08 (8% SE margin)
  maxDataAgeSec: number; // Default 10 seconds before feed flagged stale
  minBarrierDistancePct: number; // Minimum distance % to prevent zero-distance artifacts
  enforceRegimeAlignment: boolean; // Flag counter-trend Touch contracts
  dailyLossLimitStake: number;
}

export interface BacktestGroundTruth {
  symbol: string;
  startTime: number;
  startPrice: number;
  expirySeconds: number;
  barrierLevel: number;
  barrierDirection: BarrierDirection;
  wasTouched: boolean;
  touchTimeSec?: number;
  finalPrice: number;
  pricePathSample: number[];
}

export interface CalibrationBin {
  binMin: number;
  binMax: number;
  predictedAvg: number;
  observedFreq: number;
  sampleCount: number;
}

export interface BacktestReport {
  totalEvaluated: number;
  touchContractsTested: number;
  noTouchContractsTested: number;
  overallBrierScore: number;
  baselineBrierScore: number; // naive 0.5 or unconditional frequency
  overallLogLoss: number;
  calibrationBins: CalibrationBin[];
  regimeBreakdown: Record<string, { count: number; brier: number; winRate: number; avgEV: number }>;
  simulatedTotalPnl: number;
  simulatedRoiPct: number;
  maxDrawdownPct: number;
  winCount: number;
  lossCount: number;
  winRatePct: number;
}

export interface TestSuiteResult {
  id: string;
  name: string;
  category: 'MATH' | 'CONTRACT' | 'REGIME' | 'RISK' | 'INTEGRATION';
  description: string;
  passed: boolean;
  executionTimeMs: number;
  details: string;
  error?: string;
}
