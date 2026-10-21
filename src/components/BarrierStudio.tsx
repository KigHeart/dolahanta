/**
 * DolaHanta — Smart Barrier Studio & Interactive Instrument Workbench
 * Deliverable C & Section 8.3/8.4 implementation
 * 
 * Interactive quantitative workbench featuring:
 * - Real-time price chart with current spot and dynamic barrier lines
 * - Interactive First-Passage Probability vs Barrier Distance curve
 * - Dynamic parameter workbench (distance, expiry, stake, contract type)
 * - Monte Carlo path validation engine (1,500 simulated paths)
 * - Complete mathematical formula decomposition and inspectable risk reasoning
 */

import React, { useState, useMemo } from 'react';
import {
  BarrierCandidate,
  BarrierDirection,
  ContractType,
  Instrument,
  MarketState,
  RiskSettings,
  Tick
} from '../types/trading';
import {
  calculateAnalyticalFirstPassageProbability,
  calculateExpectedValue,
  estimateDerivPayoutMultiplier,
  simulateBarrierMonteCarlo,
  MonteCarloResult
} from '../engine/math';
import { SUPPORTED_INSTRUMENTS } from '../config/instruments';
import {
  Activity,
  Layers,
  Sparkles,
  TrendingUp,
  TrendingDown,
  ShieldAlert,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Play
} from 'lucide-react';

interface BarrierStudioProps {
  selectedCandidate: BarrierCandidate | null;
  onSelectCandidate: (candidate: BarrierCandidate) => void;
  marketState?: MarketState;
  tickHistory: Tick[];
  riskSettings: RiskSettings;
}

export const BarrierStudio: React.FC<BarrierStudioProps> = ({
  selectedCandidate,
  onSelectCandidate,
  marketState,
  tickHistory,
  riskSettings
}) => {
  // Current instrument
  const currentInstrument: Instrument = selectedCandidate?.instrument || SUPPORTED_INSTRUMENTS[0];
  const spotPrice = marketState?.currentPrice || selectedCandidate?.referencePrice || 1000;

  // Interactive Workbench State
  const [contractType, setContractType] = useState<ContractType>(selectedCandidate?.contractType || 'TOUCH');
  const [barrierDirection, setBarrierDirection] = useState<BarrierDirection>(selectedCandidate?.barrierDirection || 'UPPER');
  const [expirySeconds, setExpirySeconds] = useState<number>(selectedCandidate?.expirySeconds || 120);
  const [distancePct, setDistancePct] = useState<number>(selectedCandidate?.relativeDistancePct || 0.65);
  const [stake, setStake] = useState<number>(selectedCandidate?.stake || 10);

  // Monte Carlo simulation result state
  const [mcResult, setMcResult] = useState<MonteCarloResult | null>(null);
  const [isSimulatingMc, setIsSimulatingMc] = useState(false);

  // Real-time calculations based on interactive state
  const calculations = useMemo(() => {
    const decimals = currentInstrument.decimals;
    const factor = Math.pow(10, decimals);
    
    const absoluteDist = spotPrice * (distancePct / 100);
    const barrierLevel = barrierDirection === 'UPPER' 
      ? Math.round((spotPrice + absoluteDist) * factor) / factor
      : Math.round((spotPrice - absoluteDist) * factor) / factor;

    const perSecondVol = Math.max(0.0001, marketState?.realizedVolShort || currentInstrument.baseVolatility);
    const perSecondDrift = marketState?.trendDirection === 'UP' 
      ? 0.00005 * (marketState?.trendStrength || 0.5)
      : marketState?.trendDirection === 'DOWN'
      ? -0.00005 * (marketState?.trendStrength || 0.5)
      : 0;

    // Analytical First-Passage Probability
    const rawTouchProb = calculateAnalyticalFirstPassageProbability(
      spotPrice,
      barrierLevel,
      barrierDirection,
      expirySeconds,
      perSecondVol,
      perSecondDrift
    );

    const isTouch = contractType === 'TOUCH';
    const pSuccess = isTouch ? rawTouchProb : (1.0 - rawTouchProb);

    // Deriv payout model
    const payoutMult = estimateDerivPayoutMultiplier(contractType, rawTouchProb);
    const netReturn = payoutMult - 1.0;

    const { expectedProfitPerUnit, expectedValue } = calculateExpectedValue(pSuccess, payoutMult, stake);

    // Uncertainty margin
    const nObs = Math.max(20, marketState?.tickCount || 60);
    const baseSE = Math.sqrt((pSuccess * (1.0 - pSuccess)) / nObs);
    const totalSE = Math.min(0.20, baseSE + (marketState?.regime === 'REGIME_TRANSITION' ? 0.035 : 0.01));
    const ciMargin = 1.96 * totalSE;
    const ciLower = Math.max(0.01, pSuccess - ciMargin);
    const ciUpper = Math.min(0.99, pSuccess + ciMargin);
    const conservativeEV = (ciLower * (netReturn + 1.0) - 1.0) * stake;

    // Qualification
    let status = 'NO_TRADE';
    const inclusionReasons: string[] = [];
    const rejectionReasons: string[] = [];

    if (expectedProfitPerUnit >= riskSettings.minEVThreshold && totalSE <= riskSettings.maxPermissibleUncertainty && conservativeEV > 0) {
      status = 'STRONG_CANDIDATE';
      inclusionReasons.push(`Positive edge (+${(expectedProfitPerUnit * 100).toFixed(1)}% expected return)`);
      inclusionReasons.push(`Estimation error tight within ±${(totalSE * 100).toFixed(1)}%`);
    } else if (expectedProfitPerUnit > 0) {
      status = 'WATCH';
      inclusionReasons.push('Positive expected value but thin error margin');
    } else {
      status = 'NO_TRADE';
      rejectionReasons.push(`Negative or inadequate expected value (${(expectedProfitPerUnit * 100).toFixed(1)}%)`);
    }

    return {
      barrierLevel,
      absoluteDist,
      rawTouchProb,
      pSuccess,
      payoutMult,
      netReturn,
      expectedProfitPerUnit,
      expectedValue,
      conservativeEV,
      totalSE,
      ciLower,
      ciUpper,
      status,
      inclusionReasons,
      rejectionReasons,
      perSecondVol,
      perSecondDrift
    };
  }, [
    spotPrice,
    distancePct,
    barrierDirection,
    contractType,
    expirySeconds,
    stake,
    currentInstrument,
    marketState,
    riskSettings
  ]);

  // Handler to run in-browser Monte Carlo verification
  const handleRunMonteCarlo = () => {
    setIsSimulatingMc(true);
    setTimeout(() => {
      const result = simulateBarrierMonteCarlo(
        spotPrice,
        calculations.barrierLevel,
        barrierDirection,
        expirySeconds,
        calculations.perSecondVol,
        calculations.perSecondDrift,
        1500,
        50
      );
      setMcResult(result);
      setIsSimulatingMc(false);
    }, 50);
  };

  // Probability vs Barrier Distance Curve points (0.1% to 2.5% distance)
  const curvePoints = useMemo(() => {
    const points: { distPct: number; pTouch: number; pNoTouch: number }[] = [];
    const steps = 18;
    for (let i = 1; i <= steps; i++) {
      const dPct = (i / steps) * 2.2;
      const dist = spotPrice * (dPct / 100);
      const bLevel = barrierDirection === 'UPPER' ? spotPrice + dist : spotPrice - dist;
      const pT = calculateAnalyticalFirstPassageProbability(
        spotPrice,
        bLevel,
        barrierDirection,
        expirySeconds,
        calculations.perSecondVol,
        calculations.perSecondDrift
      );
      points.push({
        distPct: dPct,
        pTouch: pT,
        pNoTouch: 1.0 - pT
      });
    }
    return points;
  }, [spotPrice, barrierDirection, expirySeconds, calculations.perSecondVol, calculations.perSecondDrift]);

  // Chart coordinate math
  const chartHeight = 220;
  const chartWidth = 600;
  const recentPrices = tickHistory.length > 0 ? tickHistory.map(t => t.quote) : [spotPrice];
  const minP = Math.min(...recentPrices, calculations.barrierLevel, spotPrice) * 0.998;
  const maxP = Math.max(...recentPrices, calculations.barrierLevel, spotPrice) * 1.002;
  const pRange = maxP - minP || 1;

  const getY = (val: number) => chartHeight - ((val - minP) / pRange) * (chartHeight - 30) - 15;
  const getX = (idx: number) => (idx / Math.max(1, recentPrices.length - 1)) * (chartWidth - 60) + 10;

  const pathD = recentPrices
    .map((p, idx) => `${idx === 0 ? 'M' : 'L'} ${getX(idx).toFixed(1)} ${getY(p).toFixed(1)}`)
    .join(' ');

  return (
    <div className="space-y-6">
      {/* Instrument Selection & Header */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 bg-neutral-900/80 border border-neutral-800 rounded-lg p-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-neutral-950 border border-neutral-800 rounded-lg text-rose-500">
            <Activity className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <select
                value={currentInstrument.symbol}
                onChange={(e) => {
                  const found = SUPPORTED_INSTRUMENTS.find(i => i.symbol === e.target.value);
                  if (found) {
                    onSelectCandidate({
                      ...calculations,
                      id: `${found.symbol}-STUDIO-INIT`,
                      instrument: found,
                      referencePrice: spotPrice,
                      barrierLevel: calculations.barrierLevel,
                      barrierDirection,
                      absoluteDistance: calculations.absoluteDist,
                      relativeDistancePct: distancePct,
                      contractType,
                      expirySeconds,
                      estimatedProbability: calculations.pSuccess,
                      rawTouchProbability: calculations.rawTouchProb,
                      uncertaintyInterval: [calculations.ciLower, calculations.ciUpper],
                      standardError: calculations.totalSE,
                      stake,
                      payoutMultiplier: calculations.payoutMult,
                      netReturnMultiplier: calculations.netReturn,
                      expectedProfitPerUnit: calculations.expectedProfitPerUnit,
                      expectedValue: calculations.expectedValue,
                      conservativeEV: calculations.conservativeEV,
                      riskAwareScore: calculations.expectedProfitPerUnit - calculations.totalSE,
                      qualificationStatus: calculations.status as any,
                      inclusionReasons: calculations.inclusionReasons,
                      rejectionReasons: calculations.rejectionReasons,
                      modelAssumptions: [],
                      timestamp: Date.now() / 1000
                    });
                  }
                }}
                className="bg-neutral-950 border border-neutral-700 text-white font-bold text-base px-2.5 py-1 rounded outline-none"
              >
                {SUPPORTED_INSTRUMENTS.map((inst) => (
                  <option key={inst.symbol} value={inst.symbol}>
                    {inst.displayName} ({inst.symbol})
                  </option>
                ))}
              </select>
            </div>
            <div className="text-xs text-neutral-400 mt-1 font-mono">
              {currentInstrument.description}
            </div>
          </div>
        </div>

        {/* Spot & Regime Telemetry */}
        <div className="flex items-center gap-6 font-mono text-xs">
          <div>
            <div className="text-neutral-500">SPOT PRICE</div>
            <div className="text-base font-bold text-white tabular-nums">
              {spotPrice.toFixed(currentInstrument.decimals)}
            </div>
          </div>
          <div>
            <div className="text-neutral-500">REGIME</div>
            <div className="font-semibold text-neutral-200">
              {marketState?.regime?.replace(/_/g, ' ') || 'RANGING'}
            </div>
          </div>
          <div>
            <div className="text-neutral-500">REALIZED VOL (15t)</div>
            <div className="font-semibold text-neutral-300 tabular-nums">
              {((marketState?.realizedVolShort || currentInstrument.baseVolatility) * 100).toFixed(3)}%
            </div>
          </div>
        </div>
      </div>

      {/* Main Grid: Chart & Workbench */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Dynamic Visualizations (7 cols) */}
        <div className="lg:col-span-7 space-y-4">
          {/* Price Action & Barrier Chart */}
          <div className="bg-neutral-900/60 border border-neutral-800 rounded-lg p-4">
            <div className="flex items-center justify-between mb-3 text-xs font-mono">
              <span className="text-neutral-300 font-semibold flex items-center gap-1.5">
                <span>Microstructure Price Action & Candidate Barrier</span>
              </span>
              <span className="text-neutral-400">
                Tick History ({recentPrices.length} ticks)
              </span>
            </div>

            <div className="w-full bg-neutral-950 border border-neutral-800/80 rounded relative overflow-hidden">
              <svg viewBox={`0 0 ${chartWidth} ${chartHeight}`} className="w-full h-56">
                {/* Horizontal Grid lines */}
                <line x1="0" y1={chartHeight * 0.25} x2={chartWidth} y2={chartHeight * 0.25} stroke="#262626" strokeDasharray="3 3" />
                <line x1="0" y1={chartHeight * 0.50} x2={chartWidth} y2={chartHeight * 0.50} stroke="#262626" strokeDasharray="3 3" />
                <line x1="0" y1={chartHeight * 0.75} x2={chartWidth} y2={chartHeight * 0.75} stroke="#262626" strokeDasharray="3 3" />

                {/* Barrier Line */}
                <line
                  x1="0"
                  y1={getY(calculations.barrierLevel)}
                  x2={chartWidth}
                  y2={getY(calculations.barrierLevel)}
                  stroke={barrierDirection === 'UPPER' ? '#10b981' : '#f43f5e'}
                  strokeWidth="1.75"
                  strokeDasharray="4 2"
                />

                {/* Spot Price Line */}
                <line
                  x1="0"
                  y1={getY(spotPrice)}
                  x2={chartWidth}
                  y2={getY(spotPrice)}
                  stroke="#38bdf8"
                  strokeWidth="1.2"
                  strokeDasharray="2 2"
                />

                {/* Price Trajectory Path */}
                <path
                  d={pathD}
                  fill="none"
                  stroke="#f5f5f5"
                  strokeWidth="1.75"
                  strokeLinejoin="round"
                />
              </svg>

              {/* In-chart Overlays */}
              <div 
                className="absolute right-2 px-2 py-0.5 rounded text-[10px] font-mono font-bold text-white shadow"
                style={{
                  top: `${Math.max(10, Math.min(chartHeight - 30, getY(calculations.barrierLevel) - 10))}px`,
                  backgroundColor: barrierDirection === 'UPPER' ? 'rgba(16, 185, 129, 0.85)' : 'rgba(244, 63, 94, 0.85)'
                }}
              >
                BARRIER: {calculations.barrierLevel.toFixed(currentInstrument.decimals)} ({barrierDirection === 'UPPER' ? '+' : '-'}{distancePct.toFixed(2)}%)
              </div>

              <div 
                className="absolute right-2 px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-sky-900/90 text-sky-200"
                style={{
                  top: `${Math.max(10, Math.min(chartHeight - 30, getY(spotPrice) - 10))}px`
                }}
              >
                SPOT: {spotPrice.toFixed(currentInstrument.decimals)}
              </div>
            </div>
            
            <div className="flex items-center justify-between text-[11px] font-mono text-neutral-400 mt-2">
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-0.5 bg-sky-400 inline-block"></span> Spot Price
                <span className="text-neutral-500">·</span>
                <span className="w-2.5 h-0.5 bg-emerald-500 inline-block"></span> Candidate Barrier
              </span>
              <span>Expires in {expirySeconds}s</span>
            </div>
          </div>

          {/* Probability vs Barrier Distance Curve */}
          <div className="bg-neutral-900/60 border border-neutral-800 rounded-lg p-4">
            <div className="flex items-center justify-between mb-2 text-xs font-mono">
              <span className="text-neutral-300 font-semibold">
                Probability vs Barrier Distance Decay Curve
              </span>
              <span className="text-neutral-400">
                P(Success) vs % Distance
              </span>
            </div>

            <div className="w-full bg-neutral-950 border border-neutral-800/80 rounded p-3">
              <svg viewBox="0 0 500 160" className="w-full h-40">
                {/* Horizontal axes */}
                <line x1="40" y1="130" x2="480" y2="130" stroke="#333" />
                <line x1="40" y1="20" x2="40" y2="130" stroke="#333" />

                {/* Y-axis labels */}
                <text x="32" y="25" fill="#737373" fontSize="9" textAnchor="end" fontFamily="monospace">100%</text>
                <text x="32" y="75" fill="#737373" fontSize="9" textAnchor="end" fontFamily="monospace">50%</text>
                <text x="32" y="130" fill="#737373" fontSize="9" textAnchor="end" fontFamily="monospace">0%</text>

                {/* Curve Path */}
                <path
                  d={curvePoints
                    .map((pt, i) => {
                      const prob = contractType === 'TOUCH' ? pt.pTouch : pt.pNoTouch;
                      const x = 40 + (pt.distPct / 2.2) * 440;
                      const y = 130 - prob * 110;
                      return `${i === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`;
                    })
                    .join(' ')}
                  fill="none"
                  stroke={contractType === 'TOUCH' ? '#22d3ee' : '#a78bfa'}
                  strokeWidth="2"
                />

                {/* Current Selected Distance Marker */}
                {(() => {
                  const markerX = 40 + Math.min(1.0, distancePct / 2.2) * 440;
                  const markerY = 130 - calculations.pSuccess * 110;
                  const ciTop = 130 - calculations.ciUpper * 110;
                  const ciBot = 130 - calculations.ciLower * 110;

                  return (
                    <g>
                      {/* CI Whisker */}
                      <line x1={markerX} y1={ciTop} x2={markerX} y2={ciBot} stroke="#f59e0b" strokeWidth="2" />
                      <line x1={markerX - 4} y1={ciTop} x2={markerX + 4} y2={ciTop} stroke="#f59e0b" strokeWidth="2" />
                      <line x1={markerX - 4} y1={ciBot} x2={markerX + 4} y2={ciBot} stroke="#f59e0b" strokeWidth="2" />

                      {/* Main point */}
                      <circle cx={markerX} cy={markerY} r="4.5" fill="#f59e0b" stroke="#ffffff" strokeWidth="1.5" />
                    </g>
                  );
                })()}
              </svg>

              <div className="flex items-center justify-between text-[11px] font-mono text-neutral-400 mt-1">
                <span>0.0% Spot</span>
                <span className="text-amber-400">Current Setup: {distancePct.toFixed(2)}% Distance ({ (calculations.pSuccess * 100).toFixed(1) }% P(Success))</span>
                <span>2.2% Distance</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right: Interactive Parameter Workbench & Economics (5 cols) */}
        <div className="lg:col-span-5 space-y-4">
          <div className="bg-neutral-900/80 border border-neutral-800 rounded-lg p-4 space-y-4">
            <div className="text-xs font-mono font-semibold text-neutral-300 pb-2 border-b border-neutral-800">
              Contract & Barrier Controls
            </div>

            {/* Contract Type Toggle */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-neutral-400">Contract Specification</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => setContractType('TOUCH')}
                  className={`py-2 px-3 text-xs font-mono font-semibold rounded-md border transition-colors ${
                    contractType === 'TOUCH'
                      ? 'bg-cyan-950/80 border-cyan-600 text-cyan-200'
                      : 'bg-neutral-950 border-neutral-800 text-neutral-400 hover:text-white'
                  }`}
                >
                  TOUCH (Hits barrier)
                </button>
                <button
                  onClick={() => setContractType('NOTOUCH')}
                  className={`py-2 px-3 text-xs font-mono font-semibold rounded-md border transition-colors ${
                    contractType === 'NOTOUCH'
                      ? 'bg-violet-950/80 border-violet-600 text-violet-200'
                      : 'bg-neutral-950 border-neutral-800 text-neutral-400 hover:text-white'
                  }`}
                >
                  NO TOUCH (Avoids barrier)
                </button>
              </div>
            </div>

            {/* Barrier Direction Toggle */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-neutral-400">Barrier Placement</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => setBarrierDirection('UPPER')}
                  className={`py-1.5 px-3 text-xs font-mono rounded-md border transition-colors ${
                    barrierDirection === 'UPPER'
                      ? 'bg-emerald-950/80 border-emerald-600 text-emerald-200 font-semibold'
                      : 'bg-neutral-950 border-neutral-800 text-neutral-400 hover:text-white'
                  }`}
                >
                  UPPER (Above Spot)
                </button>
                <button
                  onClick={() => setBarrierDirection('LOWER')}
                  className={`py-1.5 px-3 text-xs font-mono rounded-md border transition-colors ${
                    barrierDirection === 'LOWER'
                      ? 'bg-rose-950/80 border-rose-600 text-rose-200 font-semibold'
                      : 'bg-neutral-950 border-neutral-800 text-neutral-400 hover:text-white'
                  }`}
                >
                  LOWER (Below Spot)
                </button>
              </div>
            </div>

            {/* Barrier Distance Slider */}
            <div className="space-y-1.5">
              <div className="flex justify-between items-center text-xs">
                <span className="text-neutral-400">Barrier Distance (% of spot)</span>
                <span className="font-mono font-bold text-white tabular-nums">{distancePct.toFixed(2)}% ({calculations.absoluteDist.toFixed(currentInstrument.decimals)})</span>
              </div>
              <input
                type="range"
                min="0.10"
                max="3.00"
                step="0.05"
                value={distancePct}
                onChange={(e) => setDistancePct(Number(e.target.value))}
                className="w-full accent-rose-500 cursor-pointer bg-neutral-950"
              />
            </div>

            {/* Expiry Selector */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-neutral-400">Contract Expiry Duration</label>
              <div className="grid grid-cols-5 gap-1.5 font-mono text-xs">
                {[60, 120, 300, 900, 3600].map((sec) => (
                  <button
                    key={sec}
                    onClick={() => setExpirySeconds(sec)}
                    className={`py-1.5 rounded border transition-colors ${
                      expirySeconds === sec
                        ? 'bg-neutral-800 border-rose-500 text-white font-bold'
                        : 'bg-neutral-950 border-neutral-800 text-neutral-400 hover:text-white'
                    }`}
                  >
                    {sec >= 60 ? `${sec / 60}m` : `${sec}s`}
                  </button>
                ))}
              </div>
            </div>

            {/* Stake Input */}
            <div className="space-y-1.5">
              <div className="flex justify-between items-center text-xs">
                <span className="text-neutral-400">Proposed Stake (USD)</span>
                <span className="font-mono text-neutral-300">${stake}</span>
              </div>
              <input
                type="number"
                min="1"
                max="1000"
                value={stake}
                onChange={(e) => setStake(Math.max(1, Number(e.target.value)))}
                className="w-full bg-neutral-950 border border-neutral-800 px-3 py-1.5 text-xs text-white rounded font-mono outline-none focus:border-rose-500"
              />
            </div>
          </div>

          {/* Model Evaluation & Economics Card */}
          <div className="bg-neutral-900/80 border border-neutral-800 rounded-lg p-4 space-y-3 font-mono text-xs">
            <div className="flex items-center justify-between pb-2 border-b border-neutral-800">
              <span className="text-neutral-300 font-semibold font-sans">Probabilistic Output & Economics</span>
              <span className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                calculations.status === 'STRONG_CANDIDATE' ? 'bg-emerald-950 text-emerald-300 border border-emerald-800' :
                calculations.status === 'WATCH' ? 'bg-amber-950 text-amber-300 border border-amber-800' :
                'bg-rose-950 text-rose-300 border border-rose-800'
              }`}>
                {calculations.status}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-1">
              <div>
                <span className="text-neutral-500">P(SUCCESS):</span>
                <div className="text-base font-bold text-white tabular-nums">
                  {(calculations.pSuccess * 100).toFixed(1)}%
                </div>
                <div className="text-[10px] text-neutral-400">
                  95% CI: [{(calculations.ciLower * 100).toFixed(1)}% – {(calculations.ciUpper * 100).toFixed(1)}%]
                </div>
              </div>

              <div>
                <span className="text-neutral-500">OFFERED PAYOUT:</span>
                <div className="text-base font-bold text-neutral-200 tabular-nums">
                  {calculations.payoutMult.toFixed(2)}x
                </div>
                <div className="text-[10px] text-neutral-400">
                  +{(calculations.netReturn * 100).toFixed(0)}% net on stake
                </div>
              </div>
            </div>

            <div className="p-2.5 bg-neutral-950 border border-neutral-800 rounded space-y-1">
              <div className="flex justify-between items-center">
                <span className="text-neutral-400">Expected Profit / Unit:</span>
                <span className={`font-bold tabular-nums ${calculations.expectedProfitPerUnit > 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {calculations.expectedProfitPerUnit > 0 ? '+' : ''}{(calculations.expectedProfitPerUnit * 100).toFixed(1)}%
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-neutral-400">Dollar EV (Stake ${stake}):</span>
                <span className={`font-bold tabular-nums ${calculations.expectedValue > 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {calculations.expectedValue > 0 ? '+' : ''}${calculations.expectedValue.toFixed(2)}
                </span>
              </div>
              <div className="flex justify-between items-center text-[11px] text-neutral-500">
                <span>Conservative 95% EV:</span>
                <span className="tabular-nums">${calculations.conservativeEV.toFixed(2)}</span>
              </div>
            </div>

            {/* Monte Carlo Validation Check */}
            <div className="pt-2 border-t border-neutral-800/60">
              <div className="flex items-center justify-between mb-2">
                <span className="text-neutral-400 font-sans text-xs font-medium">Monte Carlo Verification</span>
                <button
                  onClick={handleRunMonteCarlo}
                  disabled={isSimulatingMc}
                  className="px-2.5 py-1 text-[11px] bg-neutral-800 hover:bg-neutral-700 text-white rounded font-mono flex items-center gap-1 transition-colors"
                >
                  <Play className="w-3 h-3 text-rose-500" />
                  <span>{isSimulatingMc ? 'Simulating...' : 'Run 1,500 Paths'}</span>
                </button>
              </div>

              {mcResult && (
                <div className="p-2 bg-neutral-950 border border-neutral-800 rounded text-[11px] space-y-0.5">
                  <div className="flex justify-between">
                    <span className="text-neutral-400">MC Simulated Touch:</span>
                    <span className="text-white font-bold">{(mcResult.simulatedProbability * 100).toFixed(1)}%</span>
                  </div>
                  <div className="flex justify-between text-neutral-400">
                    <span>Wilson 95% Bounds:</span>
                    <span>[{(mcResult.ciLower95 * 100).toFixed(1)}% – {(mcResult.ciUpper95 * 100).toFixed(1)}%]</span>
                  </div>
                  <div className="flex justify-between text-neutral-400">
                    <span>Standard Error:</span>
                    <span>±{(mcResult.standardError * 100).toFixed(2)}%</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
