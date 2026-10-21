/**
 * DolaHanta — Automated Test Suite Runner
 * Deliverable F implementation
 * 
 * Verifies mathematical formulas, boundary conditions, contract economics,
 * risk filters, and no-trade invariants directly in the browser runtime.
 */

import { DEFAULT_RISK_SETTINGS } from '../config/instruments';
import {
  calculateAnalyticalFirstPassageProbability,
  calculateBrierScore,
  calculateExpectedValue,
  calculateLogLoss,
  normalCDF
} from './math';
import { analyzeMarketState } from './regimeClassifier';
import { generateBarrierCandidates } from './smartBarrierEngine';
import { Instrument, TestSuiteResult, Tick } from '../types/trading';

const MOCK_INSTRUMENT: Instrument = {
  symbol: 'R_100',
  displayName: 'Volatility 100 Index',
  category: 'volatility_indices',
  tickSize: 0.01,
  decimals: 2,
  baseVolatility: 0.0035,
  defaultPayoutMultiplier: 1.85,
  description: 'Test instrument fixture'
};

export function runAllAutomatedTests(): TestSuiteResult[] {
  const results: TestSuiteResult[] = [];

  // Helper
  function recordTest(
    id: string,
    name: string,
    category: 'MATH' | 'CONTRACT' | 'REGIME' | 'RISK' | 'INTEGRATION',
    desc: string,
    fn: () => { passed: boolean; details: string }
  ) {
    const t0 = performance.now();
    try {
      const res = fn();
      const elapsed = performance.now() - t0;
      results.push({
        id,
        name,
        category,
        description: desc,
        passed: res.passed,
        executionTimeMs: Number(elapsed.toFixed(2)),
        details: res.details
      });
    } catch (err: any) {
      const elapsed = performance.now() - t0;
      results.push({
        id,
        name,
        category,
        description: desc,
        passed: false,
        executionTimeMs: Number(elapsed.toFixed(2)),
        details: 'Exception thrown during assertion',
        error: String(err?.message || err)
      });
    }
  }

  // 1. Math: Normal CDF Symmetry
  recordTest(
    'MATH-01',
    'Standard Normal CDF Symmetry & Limits',
    'MATH',
    'Verifies Phi(0) == 0.5, Phi(-x) + Phi(x) == 1, and tails approach 0 and 1.',
    () => {
      const p0 = normalCDF(0);
      const p1 = normalCDF(1.96);
      const pm1 = normalCDF(-1.96);
      const pFar = normalCDF(10);
      const sumSym = p1 + pm1;

      const passed = Math.abs(p0 - 0.5) < 1e-6 &&
                     Math.abs(sumSym - 1.0) < 1e-6 &&
                     Math.abs(p1 - 0.975) < 1e-3 &&
                     pFar === 1.0;
      return {
        passed,
        details: `Phi(0)=${p0.toFixed(4)}, Phi(1.96)+Phi(-1.96)=${sumSym.toFixed(6)}, Phi(1.96)=${p1.toFixed(4)}`
      };
    }
  );

  // 2. Math: First-Passage Upper Boundary Test
  recordTest(
    'MATH-02',
    'First-Passage Probability Upper Barrier Boundaries',
    'MATH',
    'Verifies P(touch) -> 1.0 as barrier approaches spot, and P(touch) -> 0.0 for extreme distance.',
    () => {
      const spot = 1000;
      const nearBarrier = 1000.01;
      const farBarrier = 100000;
      const pNear = calculateAnalyticalFirstPassageProbability(spot, nearBarrier, 'UPPER', 60, 0.002, 0);
      const pFar = calculateAnalyticalFirstPassageProbability(spot, farBarrier, 'UPPER', 60, 0.002, 0);

      const passed = pNear > 0.98 && pFar < 0.0001;
      return {
        passed,
        details: `P(near upper 1000.01)=${pNear.toFixed(4)}, P(far upper 100000)=${pFar.toFixed(6)}`
      };
    }
  );

  // 3. Math: Lower Barrier First-Passage Test
  recordTest(
    'MATH-03',
    'First-Passage Probability Lower Barrier Boundaries',
    'MATH',
    'Verifies P(touch) -> 1.0 as lower barrier approaches spot, and P(touch) -> 0.0 for deep OTM.',
    () => {
      const spot = 1000;
      const nearBarrier = 999.99;
      const farBarrier = 1.0;
      const pNear = calculateAnalyticalFirstPassageProbability(spot, nearBarrier, 'LOWER', 60, 0.002, 0);
      const pFar = calculateAnalyticalFirstPassageProbability(spot, farBarrier, 'LOWER', 60, 0.002, 0);

      const passed = pNear > 0.98 && pFar < 0.0001;
      return {
        passed,
        details: `P(near lower 999.99)=${pNear.toFixed(4)}, P(far lower 1.0)=${pFar.toFixed(6)}`
      };
    }
  );

  // 4. Math: Expiry Monotonicity Invariant
  recordTest(
    'MATH-04',
    'Expiry Monotonicity Invariant',
    'MATH',
    'Verifies P(touch, T1) <= P(touch, T2) for all T1 < T2 (longer duration has higher touch chance).',
    () => {
      const spot = 1000;
      const barrier = 1020;
      const p60s = calculateAnalyticalFirstPassageProbability(spot, barrier, 'UPPER', 60, 0.002, 0);
      const p300s = calculateAnalyticalFirstPassageProbability(spot, barrier, 'UPPER', 300, 0.002, 0);
      const p3600s = calculateAnalyticalFirstPassageProbability(spot, barrier, 'UPPER', 3600, 0.002, 0);

      const passed = p60s <= p300s && p300s <= p3600s;
      return {
        passed,
        details: `P(60s)=${p60s.toFixed(4)} <= P(300s)=${p300s.toFixed(4)} <= P(3600s)=${p3600s.toFixed(4)}`
      };
    }
  );

  // 5. Contract: Expected Value Formula Identity
  recordTest(
    'CONTRACT-01',
    'Expected Value Formula Exactness',
    'CONTRACT',
    'Verifies EV = p * R * stake - (1 - p) * stake under varying payout multipliers.',
    () => {
      const stake = 10;
      const prob = 0.60;
      const payoutMult = 1.85; // net R = 0.85
      const { expectedProfitPerUnit, expectedValue } = calculateExpectedValue(prob, payoutMult, stake);

      // Manual: 0.60 * 0.85 - 0.40 * 1.0 = 0.51 - 0.40 = 0.11 per unit. EV = $1.10
      const expectedManual = 0.11;
      const passed = Math.abs(expectedProfitPerUnit - expectedManual) < 1e-5 &&
                     Math.abs(expectedValue - 1.10) < 1e-5;
      return {
        passed,
        details: `Calculated EV/unit=${expectedProfitPerUnit.toFixed(4)}, Dollar EV=$${expectedValue.toFixed(2)} (Expected $1.10)`
      };
    }
  );

  // 6. Contract: Break-Even Probability Condition
  recordTest(
    'CONTRACT-02',
    'Break-Even Probability Threshold',
    'CONTRACT',
    'Verifies EV is zero when p == 1 / payoutMultiplier (fair odds identity).',
    () => {
      const payoutMult = 2.0; // requires 50% for break-even
      const fairP = 0.50;
      const { expectedProfitPerUnit } = calculateExpectedValue(fairP, payoutMult, 10);

      const passed = Math.abs(expectedProfitPerUnit) < 1e-6;
      return {
        passed,
        details: `At P=50% with 2.0x payout: Expected profit per unit=${expectedProfitPerUnit.toFixed(6)}`
      };
    }
  );

  // 7. Risk: Stale Data Cutoff Enforcement
  recordTest(
    'RISK-01',
    'Stale Data Cutoff & NO_TRADE Enforcement',
    'RISK',
    'Verifies system produces NO_TRADE when market data age exceeds maximum threshold.',
    () => {
      const now = Date.now() / 1000;
      // Stale ticks from 120 seconds ago
      const staleTicks: Tick[] = [
        { epoch: now - 150, quote: 1000, symbol: 'R_100' },
        { epoch: now - 140, quote: 1002, symbol: 'R_100' },
        { epoch: now - 120, quote: 1001, symbol: 'R_100' }
      ];
      const state = analyzeMarketState('R_100', staleTicks, now);
      const candidates = generateBarrierCandidates(MOCK_INSTRUMENT, state, DEFAULT_RISK_SETTINGS);

      const allNoTrade = candidates.every(c => c.qualificationStatus === 'NO_TRADE');
      const passed = state.isStale && allNoTrade;
      return {
        passed,
        details: `Data age=${(state.dataAgeMs / 1000).toFixed(1)}s, isStale=${state.isStale}, All candidates NO_TRADE=${allNoTrade}`
      };
    }
  );

  // 8. Risk: Negative EV Rejection
  recordTest(
    'RISK-02',
    'Negative EV Rejection Gatekeeper',
    'RISK',
    'Verifies candidates with negative expected value are never classified as STRONG_CANDIDATE.',
    () => {
      const now = Date.now() / 1000;
      const ticks: Tick[] = [];
      for (let i = 0; i < 40; i++) {
        ticks.push({ epoch: now - 40 + i, quote: 1000 + Math.sin(i / 5), symbol: 'R_100' });
      }
      const state = analyzeMarketState('R_100', ticks, now);
      const candidates = generateBarrierCandidates(MOCK_INSTRUMENT, state, DEFAULT_RISK_SETTINGS);

      const invalidStrong = candidates.filter(
        c => c.expectedValue <= 0 && c.qualificationStatus === 'STRONG_CANDIDATE'
      );
      const passed = invalidStrong.length === 0;
      return {
        passed,
        details: `Evaluated ${candidates.length} candidates. Unqualified STRONG_CANDIDATE count: ${invalidStrong.length}`
      };
    }
  );

  // 9. Validation: Brier Score Calibration Invariant
  recordTest(
    'MATH-05',
    'Brier Score Metric Calibration',
    'MATH',
    'Verifies Brier score yields 0.0 for perfect foresight and 0.25 for uncalibrated random 50/50 guessing.',
    () => {
      const perfectPreds = [1.0, 0.0, 1.0, 0.0];
      const actuals = [true, false, true, false];
      const brierPerfect = calculateBrierScore(perfectPreds, actuals);

      const coinFlipPreds = [0.5, 0.5, 0.5, 0.5];
      const brierCoin = calculateBrierScore(coinFlipPreds, actuals);

      const passed = Math.abs(brierPerfect) < 1e-6 && Math.abs(brierCoin - 0.25) < 1e-6;
      return {
        passed,
        details: `Perfect Brier=${brierPerfect.toFixed(4)}, 50/50 Baseline Brier=${brierCoin.toFixed(4)}`
      };
    }
  );

  // 10. Regime: Regime Alignment Enforcement
  recordTest(
    'REGIME-01',
    'Counter-Trend Regime Filter Enforcement',
    'REGIME',
    'Verifies that Upper Touch in a verified Bearish Trend is disqualified from STRONG_CANDIDATE.',
    () => {
      const now = Date.now() / 1000;
      const bearishTicks: Tick[] = [];
      // Steep downward slope
      for (let i = 0; i < 50; i++) {
        bearishTicks.push({ epoch: now - 50 + i, quote: 1000 - i * 1.5, symbol: 'R_100' });
      }
      const state = analyzeMarketState('R_100', bearishTicks, now);
      const candidates = generateBarrierCandidates(MOCK_INSTRUMENT, state, {
        ...DEFAULT_RISK_SETTINGS,
        enforceRegimeAlignment: true
      });

      const upperTouches = candidates.filter(c => c.contractType === 'TOUCH' && c.barrierDirection === 'UPPER');
      const upperTouchStrong = upperTouches.filter(c => c.qualificationStatus === 'STRONG_CANDIDATE');

      const passed = state.regime === 'BEARISH_TREND' && upperTouchStrong.length === 0;
      return {
        passed,
        details: `Detected regime: ${state.regime}. Upper Touch STRONG count: ${upperTouchStrong.length} (Expected 0)`
      };
    }
  );

  return results;
}
