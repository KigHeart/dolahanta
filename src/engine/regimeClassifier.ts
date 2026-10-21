/**
 * DolaHanta — Market State & Probabilistic Regime Classifier
 * 
 * Classifies market microstructure into:
 * - BULLISH_TREND
 * - BEARISH_TREND
 * - RANGING
 * - HIGH_VOLATILITY
 * - LOW_VOLATILITY
 * - VOLATILITY_EXPANSION
 * - REGIME_TRANSITION
 * - INSUFFICIENT_DATA
 */

import { MarketRegimeType, MarketState, Tick } from '../types/trading';

/**
 * Calculates exponential moving average for a price series
 */
export function calculateEMA(prices: number[], period: number): number[] {
  if (prices.length === 0) return [];
  const k = 2 / (period + 1);
  const emaValues: number[] = [prices[0]];
  for (let i = 1; i < prices.length; i++) {
    const val = prices[i] * k + emaValues[i - 1] * (1 - k);
    emaValues.push(val);
  }
  return emaValues;
}

/**
 * Calculates RSI (Relative Strength Index)
 */
export function calculateRSI(prices: number[], period: number = 14): number {
  if (prices.length <= period) return 50;
  let gains = 0;
  let losses = 0;

  for (let i = 1; i <= period; i++) {
    const diff = prices[i] - prices[i - 1];
    if (diff >= 0) gains += diff;
    else losses -= diff;
  }

  let avgGain = gains / period;
  let avgLoss = losses / period;

  for (let i = period + 1; i < prices.length; i++) {
    const diff = prices[i] - prices[i - 1];
    if (diff >= 0) {
      avgGain = (avgGain * (period - 1) + diff) / period;
      avgLoss = (avgLoss * (period - 1)) / period;
    } else {
      avgGain = (avgGain * (period - 1)) / period;
      avgLoss = (avgLoss * (period - 1) - diff) / period;
    }
  }

  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return 100 - (100 / (1 + rs));
}

/**
 * Computes rolling realized volatility (standard deviation of log returns)
 */
export function calculateRealizedVol(prices: number[], window: number): number {
  if (prices.length < window + 1) return 0.001;
  const slice = prices.slice(-window - 1);
  const logReturns: number[] = [];
  for (let i = 1; i < slice.length; i++) {
    if (slice[i - 1] > 0) {
      logReturns.push(Math.log(slice[i] / slice[i - 1]));
    }
  }
  if (logReturns.length === 0) return 0.001;

  const mean = logReturns.reduce((acc, r) => acc + r, 0) / logReturns.length;
  const variance = logReturns.reduce((acc, r) => acc + Math.pow(r - mean, 2), 0) / (logReturns.length - 1 || 1);
  return Math.sqrt(Math.max(1e-10, variance));
}

/**
 * Identifies local support and resistance swing levels from price window
 */
export function identifySupportResistance(prices: number[]): { support: number; resistance: number } {
  if (prices.length < 5) {
    const p = prices[prices.length - 1] || 100;
    return { support: p * 0.99, resistance: p * 1.01 };
  }
  const recent = prices.slice(-60);
  let min = Infinity;
  let max = -Infinity;
  for (const p of recent) {
    if (p < min) min = p;
    if (p > max) max = p;
  }
  return { support: min, resistance: max };
}

/**
 * Core Market State Estimation and Regime Classification
 */
export function analyzeMarketState(
  symbol: string,
  ticks: Tick[],
  currentEpoch: number = Date.now() / 1000
): MarketState {
  const tickCount = ticks.length;
  
  // Guard: Insufficient data check
  if (tickCount < 10) {
    const lastPrice = tickCount > 0 ? ticks[tickCount - 1].quote : 100;
    const lastTime = tickCount > 0 ? ticks[tickCount - 1].epoch : currentEpoch;
    return {
      symbol,
      currentPrice: lastPrice,
      lastUpdateEpoch: lastTime,
      dataAgeMs: Math.max(0, Math.round((currentEpoch - lastTime) * 1000)),
      tickCount,
      isStale: true,
      returnsShort: 0,
      returnsMedium: 0,
      returnsLong: 0,
      realizedVolShort: 0.001,
      realizedVolMedium: 0.001,
      realizedVolLong: 0.001,
      volAccelerationRatio: 1.0,
      trendStrength: 0,
      trendDirection: 'FLAT',
      rsi14: 50,
      meanReversionZScore: 0,
      atr: lastPrice * 0.002,
      atrPct: 0.2,
      supportLevel: lastPrice * 0.99,
      resistanceLevel: lastPrice * 1.01,
      regime: 'INSUFFICIENT_DATA',
      regimeProbabilities: {
        BULLISH_TREND: 0.05,
        BEARISH_TREND: 0.05,
        RANGING: 0.1,
        HIGH_VOLATILITY: 0.05,
        LOW_VOLATILITY: 0.05,
        VOLATILITY_EXPANSION: 0.05,
        REGIME_TRANSITION: 0.05,
        INSUFFICIENT_DATA: 0.6
      },
      regimeConfidence: 0.15,
      regimeExplanation: 'Accumulating initial tick stream. Less than 10 observations recorded.'
    };
  }

  const prices = ticks.map(t => t.quote);
  const currentPrice = prices[prices.length - 1];
  const lastUpdateEpoch = ticks[ticks.length - 1].epoch;
  const dataAgeMs = Math.max(0, Math.round((currentEpoch - lastUpdateEpoch) * 1000));
  const isStale = dataAgeMs > 15000; // Flag stale if older than 15 seconds

  // Returns
  const pShort = prices[Math.max(0, prices.length - 5)];
  const pMed = prices[Math.max(0, prices.length - 20)];
  const pLong = prices[Math.max(0, prices.length - 60)];

  const returnsShort = pShort > 0 ? Math.log(currentPrice / pShort) : 0;
  const returnsMedium = pMed > 0 ? Math.log(currentPrice / pMed) : 0;
  const returnsLong = pLong > 0 ? Math.log(currentPrice / pLong) : 0;

  // Realized volatility across windows
  const realizedVolShort = calculateRealizedVol(prices, 15);
  const realizedVolMedium = calculateRealizedVol(prices, 45);
  const realizedVolLong = calculateRealizedVol(prices, 120);

  const volAccelerationRatio = realizedVolLong > 0 
    ? realizedVolShort / realizedVolLong 
    : 1.0;

  // Moving averages
  const ema9 = calculateEMA(prices, 9);
  const ema21 = calculateEMA(prices, 21);
  const ema55 = calculateEMA(prices, 55);

  const currentEma9 = ema9[ema9.length - 1];
  const currentEma21 = ema21[ema21.length - 1];
  const currentEma55 = ema55[ema55.length - 1];

  // Trend strength and direction
  const emaSpreadShort = (currentEma9 - currentEma21) / currentPrice;
  const emaSpreadLong = (currentEma21 - currentEma55) / currentPrice;
  const rawTrendScore = (emaSpreadShort * 2 + emaSpreadLong) * 100;
  const trendStrength = Math.min(1.0, Math.abs(rawTrendScore) * 2.5);
  
  let trendDirection: 'UP' | 'DOWN' | 'FLAT' = 'FLAT';
  if (rawTrendScore > 0.08) trendDirection = 'UP';
  else if (rawTrendScore < -0.08) trendDirection = 'DOWN';

  // RSI and Mean Reversion Z-Score
  const rsi14 = calculateRSI(prices, 14);
  const sma20Slice = prices.slice(-20);
  const sma20 = sma20Slice.reduce((a, b) => a + b, 0) / sma20Slice.length;
  const std20 = Math.sqrt(
    sma20Slice.reduce((a, b) => a + Math.pow(b - sma20, 2), 0) / sma20Slice.length
  ) || 0.001;
  const meanReversionZScore = (currentPrice - sma20) / std20;

  // Approximate ATR
  const recentHigh = Math.max(...prices.slice(-14));
  const recentLow = Math.min(...prices.slice(-14));
  const atr = Math.max(currentPrice * 0.0005, (recentHigh - recentLow) / 3.0);
  const atrPct = (atr / currentPrice) * 100;

  // Support / Resistance
  const { support, resistance } = identifySupportResistance(prices);

  // Probabilistic Regime Classification
  const probs: Record<MarketRegimeType, number> = {
    BULLISH_TREND: 0.05,
    BEARISH_TREND: 0.05,
    RANGING: 0.1,
    HIGH_VOLATILITY: 0.05,
    LOW_VOLATILITY: 0.05,
    VOLATILITY_EXPANSION: 0.05,
    REGIME_TRANSITION: 0.05,
    INSUFFICIENT_DATA: 0.0
  };

  // 1. Volatility Expansion trigger
  if (volAccelerationRatio > 1.45) {
    probs.VOLATILITY_EXPANSION += 0.45;
    probs.HIGH_VOLATILITY += 0.25;
  } else if (volAccelerationRatio < 0.7) {
    probs.LOW_VOLATILITY += 0.35;
    probs.RANGING += 0.25;
  }

  // 2. Trend assessment
  if (trendDirection === 'UP' && trendStrength > 0.3) {
    probs.BULLISH_TREND += 0.4 + trendStrength * 0.3;
  } else if (trendDirection === 'DOWN' && trendStrength > 0.3) {
    probs.BEARISH_TREND += 0.4 + trendStrength * 0.3;
  } else if (Math.abs(meanReversionZScore) < 0.9 && trendStrength < 0.25) {
    probs.RANGING += 0.45;
  }

  // 3. Regime transition check: sudden moving average crossover or RSI divergence
  const maCrossSignal = (currentEma9 > currentEma21 && emaSpreadLong < -0.05) ||
                        (currentEma9 < currentEma21 && emaSpreadLong > 0.05);
  if (maCrossSignal) {
    probs.REGIME_TRANSITION += 0.35;
  }

  // Normalize probabilities to sum to 1.0
  const totalWeight = Object.values(probs).reduce((a, b) => a + b, 0);
  for (const k of Object.keys(probs) as MarketRegimeType[]) {
    probs[k] = probs[k] / totalWeight;
  }

  // Select primary regime
  let bestRegime: MarketRegimeType = 'RANGING';
  let maxP = -1;
  for (const [r, p] of Object.entries(probs) as [MarketRegimeType, number][]) {
    if (p > maxP) {
      maxP = p;
      bestRegime = r;
    }
  }

  // Build qualitative explanation
  let explanation = '';
  switch (bestRegime) {
    case 'BULLISH_TREND':
      explanation = `Persistent upward momentum (Trend strength: ${(trendStrength * 100).toFixed(0)}%, EMA9 > EMA21). Upper barrier touch probabilities elevated.`;
      break;
    case 'BEARISH_TREND':
      explanation = `Persistent downward pressure (Trend strength: ${(trendStrength * 100).toFixed(0)}%, EMA9 < EMA21). Lower barrier touch probabilities elevated.`;
      break;
    case 'VOLATILITY_EXPANSION':
      explanation = `Short-term volatility accelerating (${volAccelerationRatio.toFixed(2)}x baseline). Path variance is widening; No Touch barriers are exposed to sudden reach.`;
      break;
    case 'HIGH_VOLATILITY':
      explanation = `Elevated realized volatility (ATR ${atrPct.toFixed(2)}%). Wide price swings make tight No Touch contracts precarious.`;
      break;
    case 'LOW_VOLATILITY':
      explanation = `Compressed realized volatility. Quiet consolidation observed; distant No Touch configurations show statistical stability.`;
      break;
    case 'RANGING':
      explanation = `Mean-reverting consolidation between S: ${support.toFixed(2)} and R: ${resistance.toFixed(2)} (Z-score: ${meanReversionZScore.toFixed(2)}).`;
      break;
    case 'REGIME_TRANSITION':
      explanation = `Short and medium momentum curves are conflicting. High regime uncertainty penalizes candidate confidence.`;
      break;
    default:
      explanation = 'Awaiting sufficient verified observations.';
  }

  return {
    symbol,
    currentPrice,
    lastUpdateEpoch,
    dataAgeMs,
    tickCount,
    isStale,
    returnsShort,
    returnsMedium,
    returnsLong,
    realizedVolShort,
    realizedVolMedium,
    realizedVolLong,
    volAccelerationRatio,
    trendStrength,
    trendDirection,
    rsi14,
    meanReversionZScore,
    atr,
    atrPct,
    supportLevel: support,
    resistanceLevel: resistance,
    regime: bestRegime,
    regimeProbabilities: probs,
    regimeConfidence: Number(maxP.toFixed(3)),
    regimeExplanation: explanation
  };
}
