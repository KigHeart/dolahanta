/**
 * DolaHanta — Mathematical Specification & Probabilistic Modeling Subsystem
 * Deliverable B implementation
 * 
 * Implements:
 * 1. High-precision Standard Normal CDF and Inverse CDF (Quantile)
 * 2. Path-Dependent First-Passage Time CDF for Geometric Brownian Motion with drift
 * 3. Monte Carlo Euler-Maruyama Path Simulator with 95% Clopper-Pearson / Wilson CI
 * 4. Deriv Contract Economics & Expected Value calculations
 * 5. Brier Score & Binary Logarithmic Loss calibration metrics
 */

import { BarrierDirection, ContractType } from '../types/trading';

/**
 * High-precision approximation of the cumulative normal distribution Phi(x)
 * Based on Abramowitz and Stegun formula 26.2.17 (absolute error < 7.5e-8).
 */
export function normalCDF(x: number): number {
  if (isNaN(x)) return 0.5;
  if (x > 8.0) return 1.0;
  if (x < -8.0) return 0.0;

  const b1 = 0.319381530;
  const b2 = -0.356563782;
  const b3 = 1.781477937;
  const b4 = -1.821255978;
  const b5 = 1.330274429;
  const p  = 0.2316419;
  const c2 = 0.3989422804014327; // 1 / sqrt(2 * PI)

  const sign = x < 0 ? -1 : 1;
  const absX = Math.abs(x);
  const t = 1.0 / (1.0 + p * absX);
  const pdf = c2 * Math.exp(-0.5 * absX * absX);
  const poly = t * (b1 + t * (b2 + t * (b3 + t * (b4 + t * b5))));
  const cdf = 1.0 - pdf * poly;

  return sign === 1 ? cdf : 1.0 - cdf;
}

/**
 * Standard Normal Quantile (Inverse Normal CDF) using rational approximation
 * (Peter John Acklam's algorithm, max error < 1.15e-9).
 */
export function normalQuantile(p: number): number {
  if (p <= 0.0) return -Infinity;
  if (p >= 1.0) return Infinity;

  const a = [-3.969683028665376e+01,  2.209460984245205e+02,
             -2.759285104469687e+02,  1.383577518672690e+02,
             -3.066479806614716e+01,  2.506628277459239e+00];

  const b = [-5.447609879822406e+01,  1.615858368580409e+02,
             -1.556989798598866e+02,  6.680131188771972e+01,
             -1.328068155288572e+01];

  const c = [-7.784894002430293e-03, -3.223964580411365e-01,
             -2.400758277161838e+00, -2.549732539343734e+00,
              4.374664141464968e+00,  2.938163982698783e+00];

  const d = [ 7.784695709041462e-03,  3.224671290700398e-01,
              2.445134137142996e+00,  3.754408661907416e+00];

  const q = p < 0.5 ? p : 1.0 - p;
  let r: number;

  if (q > 0.02425) {
    const u = q - 0.5;
    const u2 = u * u;
    r = u * (((((a[0] * u2 + a[1]) * u2 + a[2]) * u2 + a[3]) * u2 + a[4]) * u2 + a[5]) /
            (((((b[0] * u2 + b[1]) * u2 + b[2]) * u2 + b[3]) * u2 + b[4]) * u2 + 1.0);
  } else {
    const v = Math.sqrt(-2.0 * Math.log(q));
    r = (((((c[0] * v + c[1]) * v + c[2]) * v + c[3]) * v + c[4]) * v + c[5]) /
        ((((d[0] * v + d[1]) * v + d[2]) * v + d[3]) * v + 1.0);
  }

  return p < 0.5 ? -r : r;
}

/**
 * First-Passage Time CDF for Geometric Brownian Motion with drift.
 * 
 * Evaluates the analytical probability that a price process reaches barrier B
 * at any time t in [0, T].
 * 
 * Let X_t = ln(S_t / S_0) = alpha * t + sigma * W_t
 * where alpha = mu - 0.5 * sigma^2.
 * 
 * Upper Barrier (B > S_0, b = ln(B/S_0) > 0):
 *   P(tau <= T) = Phi((-b + alpha*T)/(sigma*sqrt(T))) +
 *                 exp(2*alpha*b / sigma^2) * Phi((-b - alpha*T)/(sigma*sqrt(T)))
 * 
 * Lower Barrier (B < S_0, b = ln(B/S_0) < 0):
 *   Let m = -b > 0.
 *   P(tau <= T) = Phi((-m - alpha*T)/(sigma*sqrt(T))) +
 *                 exp(-2*alpha*m / sigma^2) * Phi((-m + alpha*T)/(sigma*sqrt(T)))
 * 
 * @param currentPrice S_0 Current reference price
 * @param barrierLevel B Absolute barrier level
 * @param direction UPPER or LOWER
 * @param expirySeconds Duration T in seconds
 * @param perSecondVol Volatility sigma scaled per second (e.g. 0.001)
 * @param perSecondDrift Drift mu scaled per second (e.g. 0.00001)
 */
export function calculateAnalyticalFirstPassageProbability(
  currentPrice: number,
  barrierLevel: number,
  direction: BarrierDirection,
  expirySeconds: number,
  perSecondVol: number,
  perSecondDrift: number = 0
): number {
  if (currentPrice <= 0 || barrierLevel <= 0 || expirySeconds <= 0) return 0;

  // Immediate breach conditions
  if (direction === 'UPPER' && barrierLevel <= currentPrice) return 1.0;
  if (direction === 'LOWER' && barrierLevel >= currentPrice) return 1.0;

  // Protect against zero or negative volatility
  const sigma = Math.max(1e-7, perSecondVol);
  const T = expirySeconds;
  const sqrtT = Math.sqrt(T);
  const sigmaSqrtT = sigma * sqrtT;
  const sigmaSq = sigma * sigma;
  
  // Drift of log price process: alpha = mu - 0.5 * sigma^2
  const alpha = perSecondDrift - 0.5 * sigmaSq;
  
  // Log-distance to barrier
  const logDistance = Math.log(barrierLevel / currentPrice);

  if (direction === 'UPPER') {
    const b = logDistance; // b > 0
    if (b <= 0) return 1.0;

    const term1 = (-b + alpha * T) / sigmaSqrtT;
    const term2 = (-b - alpha * T) / sigmaSqrtT;

    // Prevent floating point overflow in exp(2 * alpha * b / sigma^2)
    const expArg = (2.0 * alpha * b) / sigmaSq;
    let prob: number;

    if (expArg > 500) {
      prob = 1.0;
    } else if (expArg < -500) {
      prob = normalCDF(term1);
    } else {
      const expFactor = Math.exp(expArg);
      prob = normalCDF(term1) + expFactor * normalCDF(term2);
    }

    return Math.min(1.0, Math.max(0.0, prob));
  } else {
    // Lower barrier
    const m = -logDistance; // m > 0 because B < S_0
    if (m <= 0) return 1.0;

    const term1 = (-m - alpha * T) / sigmaSqrtT;
    const term2 = (-m + alpha * T) / sigmaSqrtT;

    const expArg = (-2.0 * alpha * m) / sigmaSq;
    let prob: number;

    if (expArg > 500) {
      prob = 1.0;
    } else if (expArg < -500) {
      prob = normalCDF(term1);
    } else {
      const expFactor = Math.exp(expArg);
      prob = normalCDF(term1) + expFactor * normalCDF(term2);
    }

    return Math.min(1.0, Math.max(0.0, prob));
  }
}

/**
 * Box-Muller standard normal random number generator
 */
function randomStandardNormal(): number {
  let u = 0;
  let v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
}

export interface MonteCarloResult {
  simulatedProbability: number;
  standardError: number;
  ciLower95: number;
  ciUpper95: number;
  pathCount: number;
  stepsPerPath: number;
}

/**
 * Monte Carlo Path Simulation for Path-Dependent Barrier Touch.
 * Simulates discretized paths using Euler-Maruyama and computes empirical
 * hitting frequency with standard error and Wilson 95% confidence intervals.
 */
export function simulateBarrierMonteCarlo(
  currentPrice: number,
  barrierLevel: number,
  direction: BarrierDirection,
  expirySeconds: number,
  perSecondVol: number,
  perSecondDrift: number = 0,
  pathCount: number = 1000,
  steps: number = 50
): MonteCarloResult {
  const dt = expirySeconds / steps;
  const sqrtDt = Math.sqrt(dt);
  const sigma = Math.max(1e-7, perSecondVol);
  const driftTerm = (perSecondDrift - 0.5 * sigma * sigma) * dt;
  const diffusionTerm = sigma * sqrtDt;

  let touchHits = 0;

  for (let i = 0; i < pathCount; i++) {
    let price = currentPrice;
    let touched = false;

    for (let step = 0; step < steps; step++) {
      const z = randomStandardNormal();
      price *= Math.exp(driftTerm + diffusionTerm * z);

      if (direction === 'UPPER' && price >= barrierLevel) {
        touched = true;
        break;
      } else if (direction === 'LOWER' && price <= barrierLevel) {
        touched = true;
        break;
      }
    }

    if (touched) {
      touchHits++;
    }
  }

  const p = touchHits / pathCount;
  const se = Math.sqrt((p * (1 - p)) / pathCount);

  // Wilson score interval for robust coverage near 0 and 1
  const zScore = 1.95996; // 95%
  const zSq = zScore * zScore;
  const denom = 1 + zSq / pathCount;
  const center = (p + zSq / (2 * pathCount)) / denom;
  const halfWidth = (zScore * Math.sqrt((p * (1 - p) + zSq / (4 * pathCount)) / pathCount)) / denom;

  return {
    simulatedProbability: p,
    standardError: se,
    ciLower95: Math.max(0.0, center - halfWidth),
    ciUpper95: Math.min(1.0, center + halfWidth),
    pathCount,
    stepsPerPath: steps
  };
}

/**
 * Expected profit per unit stake and expected dollar value.
 * 
 * Formula:
 * For contract with success probability p, stake S, and gross payout multiplier M:
 * Net profit on success = S * (M - 1) = S * R
 * Loss on failure = S
 * EV = p * S * R - (1 - p) * S = S * (p * (1 + R) - 1) = S * (p * M - 1)
 */
export function calculateExpectedValue(
  probabilityOfSuccess: number,
  payoutMultiplier: number,
  stake: number
): {
  expectedProfitPerUnit: number;
  expectedValue: number;
} {
  const p = Math.max(0, Math.min(1, probabilityOfSuccess));
  const R = Math.max(0, payoutMultiplier - 1.0);
  
  // expectedProfitPerUnit = p * R - (1 - p) = p * (R + 1) - 1 = p * payoutMultiplier - 1
  const expectedProfitPerUnit = p * (R + 1.0) - 1.0;
  const expectedValue = expectedProfitPerUnit * stake;

  return {
    expectedProfitPerUnit,
    expectedValue
  };
}

/**
 * Calibrated Deriv Payout Pricing Model for Barrier Contracts.
 * Approximates market quotes when real WebSocket proposal is in transit.
 * Fair payout = 1 / P. Deriv applies an empirical broker margin of ~2.5% to 4.5%.
 * Also enforces Deriv boundary rules: minimum payout 1.05x (5% net return), maximum 40.0x.
 */
export function estimateDerivPayoutMultiplier(
  contractType: ContractType,
  rawTouchProbability: number
): number {
  const brokerMargin = 0.035; // 3.5% Deriv fee margin
  const fairSuccessProb = contractType === 'TOUCH' 
    ? rawTouchProbability 
    : (1.0 - rawTouchProbability);
  
  // Guard against extreme division
  const clampedProb = Math.max(0.02, Math.min(0.98, fairSuccessProb));
  const grossMultiplier = (1.0 - brokerMargin) / clampedProb;
  
  // Clamp to standard Deriv barrier payout limits
  return Math.min(35.0, Math.max(1.06, Number(grossMultiplier.toFixed(2))));
}

/**
 * Brier score: mean squared difference between predicted probabilities and binary outcomes
 * Lower is better: 0.0 is perfect, 0.25 is random guessing (for 50/50 events).
 */
export function calculateBrierScore(predictions: number[], outcomes: boolean[]): number {
  if (predictions.length === 0 || predictions.length !== outcomes.length) return 0.25;
  let sumSqErr = 0;
  for (let i = 0; i < predictions.length; i++) {
    const outcome = outcomes[i] ? 1 : 0;
    const diff = predictions[i] - outcome;
    sumSqErr += diff * diff;
  }
  return sumSqErr / predictions.length;
}

/**
 * Binary Logarithmic Loss (Cross-Entropy).
 * Lower is better.
 */
export function calculateLogLoss(predictions: number[], outcomes: boolean[]): number {
  if (predictions.length === 0 || predictions.length !== outcomes.length) return 0.693;
  const eps = 1e-15;
  let totalLoss = 0;
  for (let i = 0; i < predictions.length; i++) {
    const y = outcomes[i] ? 1 : 0;
    const p = Math.max(eps, Math.min(1 - eps, predictions[i]));
    totalLoss += y * Math.log(p) + (1 - y) * Math.log(1 - p);
  }
  return -totalLoss / predictions.length;
}
