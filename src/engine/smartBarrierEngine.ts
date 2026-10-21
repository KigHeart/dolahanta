/**
 * DolaHanta — Smart Barrier Engine
 * 
 * Central analytical engine:
 * 1. Generates candidate barrier grid across multiples of volatility and ATR
 * 2. Evaluates First-Passage Path-Dependent probabilities for Touch and No Touch
 * 3. Computes uncertainty intervals, Deriv contract economics, and Expected Value
 * 4. Applies risk gatekeeper rules and regime alignment filters
 * 5. Transparently reports inclusion and rejection reasoning
 */

import {
  BarrierCandidate,
  BarrierDirection,
  ContractType,
  Instrument,
  MarketState,
  RiskSettings,
  SignalStatus
} from '../types/trading';
import {
  calculateAnalyticalFirstPassageProbability,
  calculateExpectedValue,
  estimateDerivPayoutMultiplier
} from './math';

/**
 * Standard candidate expiry horizons in seconds
 */
export const CANDIDATE_EXPIRIES = [
  { label: '1m', seconds: 60 },
  { label: '2m', seconds: 120 },
  { label: '5m', seconds: 300 },
  { label: '15m', seconds: 900 },
  { label: '1h', seconds: 3600 }
];

/**
 * Standard volatility multipliers for barrier grid generation
 */
export const BARRIER_MULTIPLIERS = [0.6, 1.0, 1.5, 2.2, 3.0];

/**
 * Generates and evaluates candidate Touch and No Touch barrier contracts
 * for a given instrument and current market state.
 */
export function generateBarrierCandidates(
  instrument: Instrument,
  marketState: MarketState,
  riskSettings: RiskSettings,
  stake: number = 10
): BarrierCandidate[] {
  const candidates: BarrierCandidate[] = [];
  const currentPrice = marketState.currentPrice;

  // Stale or insufficient data enforcement -> NO_TRADE candidates
  if (marketState.isStale || marketState.regime === 'INSUFFICIENT_DATA') {
    return [createNoTradeDummyCandidate(instrument, marketState, stake, 'Data is stale or observation count is insufficient')];
  }

  // Base per-second volatility (convert short-term realized vol to per-second rate)
  // Assuming tick interval ~ 1s for volatility indices
  const perSecondVol = Math.max(0.0001, marketState.realizedVolShort);
  
  // Drift estimate based on short-term return
  const perSecondDrift = marketState.trendDirection === 'UP' 
    ? 0.00005 * marketState.trendStrength 
    : marketState.trendDirection === 'DOWN' 
    ? -0.00005 * marketState.trendStrength 
    : 0.0;

  const directions: BarrierDirection[] = ['UPPER', 'LOWER'];
  const contractTypes: ContractType[] = ['TOUCH', 'NOTOUCH'];

  for (const expiry of CANDIDATE_EXPIRIES) {
    const T = expiry.seconds;
    // Expected movement envelope: sigma * sqrt(T) * S_0
    const expectedMove = currentPrice * perSecondVol * Math.sqrt(T);

    for (const mult of BARRIER_MULTIPLIERS) {
      const distance = Math.max(currentPrice * 0.001, expectedMove * mult);
      const relativeDistPct = (distance / currentPrice) * 100;

      // Filter out barriers below minimum distance constraint
      if (relativeDistPct < riskSettings.minBarrierDistancePct) {
        continue;
      }

      for (const direction of directions) {
        const rawBarrier = direction === 'UPPER' 
          ? currentPrice + distance 
          : currentPrice - distance;
        
        // Format to instrument tick precision
        const factor = Math.pow(10, instrument.decimals);
        const barrierLevel = Math.round(rawBarrier * factor) / factor;

        // Path-dependent first passage probability
        const rawTouchProb = calculateAnalyticalFirstPassageProbability(
          currentPrice,
          barrierLevel,
          direction,
          T,
          perSecondVol,
          perSecondDrift
        );

        for (const contractType of contractTypes) {
          const isTouch = contractType === 'TOUCH';
          const pSuccess = isTouch ? rawTouchProb : (1.0 - rawTouchProb);

          // Payout multiplier (real market quote or calibrated broker pricing)
          const payoutMultiplier = estimateDerivPayoutMultiplier(contractType, rawTouchProb);
          const netReturn = payoutMultiplier - 1.0;

          // EV Calculations
          const { expectedProfitPerUnit, expectedValue } = calculateExpectedValue(
            pSuccess,
            payoutMultiplier,
            stake
          );

          // Standard error and uncertainty estimation
          // Factors: sample size of ticks + regime uncertainty + volatility expansion penalty
          const nObs = Math.max(20, marketState.tickCount);
          const baseSE = Math.sqrt((pSuccess * (1.0 - pSuccess)) / nObs);
          let uncertaintyAdjustment = 0;

          if (marketState.regime === 'REGIME_TRANSITION') {
            uncertaintyAdjustment += 0.035; // +3.5% error margin for transition
          }
          if (marketState.regime === 'VOLATILITY_EXPANSION') {
            uncertaintyAdjustment += 0.04; // +4.0% error margin during vol spikes
          }

          const totalSE = Math.min(0.20, baseSE + uncertaintyAdjustment);
          const ciMargin = 1.96 * totalSE;
          const ciLower = Math.max(0.01, pSuccess - ciMargin);
          const ciUpper = Math.min(0.99, pSuccess + ciMargin);

          // Conservative EV based on lower 95% bound
          const conservativeEV = (ciLower * (netReturn + 1.0) - 1.0) * stake;

          // Risk-Aware Score
          const regimePenalty = (marketState.regime === 'REGIME_TRANSITION' || marketState.regime === 'VOLATILITY_EXPANSION') ? 0.15 : 0.0;
          const riskAwareScore = expectedProfitPerUnit - totalSE * 1.5 - regimePenalty;

          // Reason logs
          const inclusionReasons: string[] = [];
          const rejectionReasons: string[] = [];

          // Regime Alignment Checks
          let isRegimeAligned = true;
          if (riskSettings.enforceRegimeAlignment) {
            if (isTouch) {
              if (direction === 'UPPER' && marketState.regime === 'BEARISH_TREND') {
                isRegimeAligned = false;
                rejectionReasons.push('Counter-trend: Upper Touch attempted in Bearish Trend regime');
              } else if (direction === 'LOWER' && marketState.regime === 'BULLISH_TREND') {
                isRegimeAligned = false;
                rejectionReasons.push('Counter-trend: Lower Touch attempted in Bullish Trend regime');
              }
            } else {
              // No Touch in Volatility Expansion is dangerous
              if (marketState.regime === 'VOLATILITY_EXPANSION' && mult < 2.0) {
                isRegimeAligned = false;
                rejectionReasons.push('High Danger: Close No Touch barrier during Volatility Expansion regime');
              }
            }
          }

          // Expected value test
          if (expectedProfitPerUnit < riskSettings.minEVThreshold) {
            rejectionReasons.push(`Expected profit (${(expectedProfitPerUnit * 100).toFixed(1)}%) below minimum threshold (${(riskSettings.minEVThreshold * 100).toFixed(1)}%)`);
          } else {
            inclusionReasons.push(`Positive expected return +${(expectedProfitPerUnit * 100).toFixed(1)}% per unit`);
          }

          // Uncertainty test
          if (totalSE > riskSettings.maxPermissibleUncertainty) {
            rejectionReasons.push(`Model estimation error (±${(totalSE * 100).toFixed(1)}%) exceeds safety tolerance (±${(riskSettings.maxPermissibleUncertainty * 100).toFixed(1)}%)`);
          } else {
            inclusionReasons.push(`Estimation error tight within ±${(totalSE * 100).toFixed(1)}%`);
          }

          // Conservative EV test
          if (conservativeEV <= 0) {
            rejectionReasons.push(`Lower 95% confidence EV is negative ($${conservativeEV.toFixed(2)})`);
          } else {
            inclusionReasons.push(`Conservative 95% EV remains profitable ($${conservativeEV.toFixed(2)})`);
          }

          if (isRegimeAligned) {
            inclusionReasons.push(`Structure compatible with ${marketState.regime.replace(/_/g, ' ')}`);
          }

          // Status assignment
          let qualificationStatus: SignalStatus = 'NO_TRADE';
          if (expectedProfitPerUnit >= riskSettings.minEVThreshold &&
              totalSE <= riskSettings.maxPermissibleUncertainty &&
              conservativeEV > 0 &&
              isRegimeAligned) {
            qualificationStatus = 'STRONG_CANDIDATE';
          } else if (expectedProfitPerUnit > 0 && isRegimeAligned && totalSE <= 0.12) {
            qualificationStatus = 'WATCH';
          } else if (expectedProfitPerUnit > -0.05) {
            qualificationStatus = 'WEAK_SETUP';
          } else {
            qualificationStatus = 'NO_TRADE';
          }

          const modelAssumptions = [
            'Geometric Brownian Motion with drift calibrated to 15-tick realized volatility',
            'Deriv barrier touch condition: price reaches or crosses barrier anytime before expiry',
            'Analytical First-Passage distribution with reflection principle adjustment',
            'Payout reflects Deriv 3.5% broker fee spread model'
          ];

          candidates.push({
            id: `${instrument.symbol}-${contractType}-${direction}-${expiry.seconds}s-${barrierLevel}`,
            instrument,
            referencePrice: currentPrice,
            barrierLevel,
            barrierDirection: direction,
            absoluteDistance: distance,
            relativeDistancePct: relativeDistPct,
            contractType,
            expirySeconds: expiry.seconds,
            estimatedProbability: Number(pSuccess.toFixed(4)),
            rawTouchProbability: Number(rawTouchProb.toFixed(4)),
            uncertaintyInterval: [Number(ciLower.toFixed(4)), Number(ciUpper.toFixed(4))],
            standardError: Number(totalSE.toFixed(4)),
            stake,
            payoutMultiplier,
            netReturnMultiplier: Number(netReturn.toFixed(2)),
            expectedProfitPerUnit: Number(expectedProfitPerUnit.toFixed(4)),
            expectedValue: Number(expectedValue.toFixed(2)),
            conservativeEV: Number(conservativeEV.toFixed(2)),
            riskAwareScore: Number(riskAwareScore.toFixed(4)),
            qualificationStatus,
            inclusionReasons,
            rejectionReasons,
            modelAssumptions,
            timestamp: marketState.lastUpdateEpoch
          });
        }
      }
    }
  }

  return candidates;
}

/**
 * Creates an explicit NO_TRADE candidate when data conditions are invalid
 */
function createNoTradeDummyCandidate(
  instrument: Instrument,
  marketState: MarketState,
  stake: number,
  reason: string
): BarrierCandidate {
  return {
    id: `${instrument.symbol}-NO_TRADE-DUMMY`,
    instrument,
    referencePrice: marketState.currentPrice,
    barrierLevel: marketState.currentPrice * 1.01,
    barrierDirection: 'UPPER',
    absoluteDistance: marketState.currentPrice * 0.01,
    relativeDistancePct: 1.0,
    contractType: 'TOUCH',
    expirySeconds: 60,
    estimatedProbability: 0,
    rawTouchProbability: 0,
    uncertaintyInterval: [0, 0],
    standardError: 0.5,
    stake,
    payoutMultiplier: 1.0,
    netReturnMultiplier: 0,
    expectedProfitPerUnit: -1.0,
    expectedValue: -stake,
    conservativeEV: -stake,
    riskAwareScore: -1.0,
    qualificationStatus: 'NO_TRADE',
    inclusionReasons: [],
    rejectionReasons: [reason],
    modelAssumptions: ['Safety filter active: invalid data inputs abort candidate synthesis'],
    timestamp: marketState.lastUpdateEpoch
  };
}
