/**
 * DolaHanta — Supported Deriv Instruments Catalog
 * Official Deriv symbols for Touch and No Touch contracts
 */

import { Instrument } from '../types/trading';

export const SUPPORTED_INSTRUMENTS: Instrument[] = [
  {
    symbol: 'R_100',
    displayName: 'Volatility 100 Index',
    category: 'volatility_indices',
    tickSize: 0.01,
    decimals: 2,
    baseVolatility: 0.0035, // High constant volatility
    defaultPayoutMultiplier: 1.85,
    description: 'Constant volatility synthetic index with 100% annual volatility parameter.'
  },
  {
    symbol: 'R_75',
    displayName: 'Volatility 75 Index',
    category: 'volatility_indices',
    tickSize: 0.01,
    decimals: 2,
    baseVolatility: 0.0028,
    defaultPayoutMultiplier: 1.88,
    description: 'Simulates market with constant 75% volatility rate.'
  },
  {
    symbol: 'R_50',
    displayName: 'Volatility 50 Index',
    category: 'volatility_indices',
    tickSize: 0.0001,
    decimals: 4,
    baseVolatility: 0.0020,
    defaultPayoutMultiplier: 1.85,
    description: 'Medium volatility synthetic index with balanced price action.'
  },
  {
    symbol: 'R_25',
    displayName: 'Volatility 25 Index',
    category: 'volatility_indices',
    tickSize: 0.001,
    decimals: 3,
    baseVolatility: 0.0012,
    defaultPayoutMultiplier: 1.90,
    description: 'Smoother continuous synthetic with 25% annualized volatility.'
  },
  {
    symbol: 'R_10',
    displayName: 'Volatility 10 Index',
    category: 'volatility_indices',
    tickSize: 0.001,
    decimals: 3,
    baseVolatility: 0.0007,
    defaultPayoutMultiplier: 1.92,
    description: 'Low-volatility synthetic index ideal for studying mean-reverting No Touch barriers.'
  },
  {
    symbol: '1HZ100V',
    displayName: 'Volatility 100 (1s) Index',
    category: 'volatility_indices',
    tickSize: 0.01,
    decimals: 2,
    baseVolatility: 0.0040,
    defaultPayoutMultiplier: 1.82,
    description: 'High-frequency 1-second tick generation with 100% volatility.'
  },
  {
    symbol: 'BOOM500',
    displayName: 'Boom 500 Index',
    category: 'crash_boom',
    tickSize: 0.01,
    decimals: 2,
    baseVolatility: 0.0025,
    defaultPayoutMultiplier: 1.86,
    description: 'Downside drift interrupted by sudden upward spikes (average 1 spike per 500 ticks).'
  },
  {
    symbol: 'CRASH500',
    displayName: 'Crash 500 Index',
    category: 'crash_boom',
    tickSize: 0.01,
    decimals: 2,
    baseVolatility: 0.0025,
    defaultPayoutMultiplier: 1.86,
    description: 'Upside drift interrupted by sudden downward drops (average 1 drop per 500 ticks).'
  },
  {
    symbol: 'frxEURUSD',
    displayName: 'EUR/USD',
    category: 'forex',
    tickSize: 0.00001,
    decimals: 5,
    baseVolatility: 0.0003,
    defaultPayoutMultiplier: 1.85,
    description: 'Euro against US Dollar major currency pair.'
  },
  {
    symbol: 'frxUSDJPY',
    displayName: 'USD/JPY',
    category: 'forex',
    tickSize: 0.001,
    decimals: 3,
    baseVolatility: 0.00035,
    defaultPayoutMultiplier: 1.85,
    description: 'US Dollar against Japanese Yen major currency pair.'
  }
];

export const DEFAULT_RISK_SETTINGS = {
  maxStakePerTrade: 50,
  minEVThreshold: 0.05, // +5% net expected return
  maxPermissibleUncertainty: 0.08, // 8% error standard error cap
  maxDataAgeSec: 15, // 15 seconds cutoff
  minBarrierDistancePct: 0.15, // 0.15% minimum distance from spot
  enforceRegimeAlignment: true,
  dailyLossLimitStake: 150
};
