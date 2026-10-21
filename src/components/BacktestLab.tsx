/**
 * DolaHanta — Backtesting & Probability Calibration Lab Component
 * Deliverable E implementation
 */

import React, { useState } from 'react';
import { runWalkForwardBacktest } from '../engine/backtestEngine';
import { BacktestReport, Instrument, Tick } from '../types/trading';
import { SUPPORTED_INSTRUMENTS } from '../config/instruments';
import { Play, RotateCcw, AlertTriangle, CheckCircle2, TrendingUp, BarChart2 } from 'lucide-react';

interface BacktestLabProps {
  tickHistoryMap: Map<string, Tick[]>;
}

export const BacktestLab: React.FC<BacktestLabProps> = ({ tickHistoryMap }) => {
  const [selectedSymbol, setSelectedSymbol] = useState<string>('R_100');
  const [expirySec, setExpirySec] = useState<number>(60);
  const [minEVFilter, setMinEVFilter] = useState<number>(0.03); // +3%
  const [stakePerTrade, setStakePerTrade] = useState<number>(10);
  const [report, setReport] = useState<BacktestReport | null>(null);
  const [isRunning, setIsRunning] = useState<boolean>(false);

  const currentInst = SUPPORTED_INSTRUMENTS.find(i => i.symbol === selectedSymbol) || SUPPORTED_INSTRUMENTS[0];
  const ticks = tickHistoryMap.get(selectedSymbol) || [];

  const handleRunBacktest = () => {
    setIsRunning(true);
    setTimeout(() => {
      const rep = runWalkForwardBacktest(ticks, {
        instrument: currentInst,
        expirySeconds: expirySec,
        barrierDistanceMuls: [0.8, 1.2, 1.8, 2.5],
        walkForwardStep: 4,
        stakePerTrade,
        minEVFilter
      });
      setReport(rep);
      setIsRunning(false);
    }, 50);
  };

  return (
    <div className="space-y-6">
      {/* Controls & Configuration Bar */}
      <div className="bg-neutral-900/80 border border-neutral-800 rounded-lg p-4 space-y-4">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <h2 className="text-base font-bold text-white font-sans flex items-center gap-2">
              <BarChart2 className="w-5 h-5 text-rose-500" />
              <span>Walk-Forward Probability Calibration & Replay Lab</span>
            </h2>
            <p className="text-xs text-neutral-400 mt-1">
              Validates first-passage touch probability forecasts and calculates Brier scores against ground-truth tick trajectories.
            </p>
          </div>

          <button
            onClick={handleRunBacktest}
            disabled={isRunning || ticks.length < 50}
            className="flex items-center gap-2 px-4 py-2 text-xs font-mono font-bold text-white bg-rose-600 hover:bg-rose-500 disabled:bg-neutral-800 disabled:text-neutral-500 rounded-md transition-colors shadow"
          >
            <Play className="w-4 h-4 fill-white" />
            <span>{isRunning ? 'Replaying History...' : 'Run Walk-Forward Validation'}</span>
          </button>
        </div>

        {/* Parameter Sliders & Dropdowns */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-3 border-t border-neutral-800/80 font-mono text-xs">
          <div>
            <label className="text-neutral-500 block mb-1">Target Instrument</label>
            <select
              value={selectedSymbol}
              onChange={(e) => setSelectedSymbol(e.target.value)}
              className="w-full bg-neutral-950 border border-neutral-800 text-white px-2.5 py-1.5 rounded outline-none"
            >
              {SUPPORTED_INSTRUMENTS.map((inst) => (
                <option key={inst.symbol} value={inst.symbol}>
                  {inst.displayName}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-neutral-500 block mb-1">Expiry Horizon</label>
            <select
              value={expirySec}
              onChange={(e) => setExpirySec(Number(e.target.value))}
              className="w-full bg-neutral-950 border border-neutral-800 text-white px-2.5 py-1.5 rounded outline-none"
            >
              <option value={60}>60 Seconds (1m)</option>
              <option value={120}>120 Seconds (2m)</option>
              <option value={300}>300 Seconds (5m)</option>
            </select>
          </div>

          <div>
            <label className="text-neutral-500 block mb-1">Trade Filter (Min EV)</label>
            <select
              value={minEVFilter}
              onChange={(e) => setMinEVFilter(Number(e.target.value))}
              className="w-full bg-neutral-950 border border-neutral-800 text-white px-2.5 py-1.5 rounded outline-none"
            >
              <option value={0.0}>EV &gt; 0% (All positive edge)</option>
              <option value={0.03}>EV &gt; +3% (Conservative edge)</option>
              <option value={0.08}>EV &gt; +8% (High selectivity)</option>
            </select>
          </div>

          <div>
            <label className="text-neutral-500 block mb-1">Historical Tick Buffer</label>
            <div className="px-2.5 py-1.5 bg-neutral-950 border border-neutral-800 text-neutral-300 rounded tabular-nums">
              {ticks.length} recorded ticks
            </div>
          </div>
        </div>
      </div>

      {/* Results View */}
      {report ? (
        <div className="space-y-6">
          {/* Key Validation Metrics Strip */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="p-3.5 bg-neutral-900/70 border border-neutral-800 rounded-lg">
              <div className="text-xs font-medium text-neutral-400 mb-1">Model Brier Score</div>
              <div className="flex items-baseline gap-2 font-mono">
                <span className="text-xl font-bold text-emerald-400 tabular-nums">
                  {report.overallBrierScore.toFixed(4)}
                </span>
                <span className="text-xs text-neutral-500">
                  vs {report.baselineBrierScore.toFixed(4)} naive
                </span>
              </div>
              <div className="text-[11px] text-neutral-400 mt-1 font-mono">
                {report.overallBrierScore < report.baselineBrierScore ? (
                  <span className="text-emerald-400">Calibrated: Outperforms coin-flip baseline</span>
                ) : (
                  <span className="text-amber-400">Near baseline variance</span>
                )}
              </div>
            </div>

            <div className="p-3.5 bg-neutral-900/70 border border-neutral-800 rounded-lg">
              <div className="text-xs font-medium text-neutral-400 mb-1">Logarithmic Loss</div>
              <div className="flex items-baseline gap-2 font-mono">
                <span className="text-xl font-bold text-white tabular-nums">
                  {report.overallLogLoss.toFixed(4)}
                </span>
                <span className="text-xs text-neutral-500">cross-entropy</span>
              </div>
              <div className="text-[11px] text-neutral-400 mt-1 font-mono">
                Evaluated over {report.totalEvaluated} paths
              </div>
            </div>

            <div className="p-3.5 bg-neutral-900/70 border border-neutral-800 rounded-lg">
              <div className="text-xs font-medium text-neutral-400 mb-1">Simulated Edge P&amp;L</div>
              <div className="flex items-baseline gap-2 font-mono">
                <span className={`text-xl font-bold tabular-nums ${report.simulatedTotalPnl >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {report.simulatedTotalPnl >= 0 ? '+' : ''}${report.simulatedTotalPnl.toFixed(2)}
                </span>
                <span className="text-xs text-neutral-400">
                  ({report.simulatedRoiPct >= 0 ? '+' : ''}{report.simulatedRoiPct}%)
                </span>
              </div>
              <div className="text-[11px] text-neutral-400 mt-1 font-mono">
                Win Rate: {report.winRatePct}% ({report.winCount}W / {report.lossCount}L)
              </div>
            </div>

            <div className="p-3.5 bg-neutral-900/70 border border-neutral-800 rounded-lg">
              <div className="text-xs font-medium text-neutral-400 mb-1">Sample Size & Scope</div>
              <div className="flex items-baseline gap-2 font-mono">
                <span className="text-xl font-bold text-white tabular-nums">
                  {report.touchContractsTested + report.noTouchContractsTested}
                </span>
                <span className="text-xs text-neutral-400">contracts</span>
              </div>
              <div className="text-[11px] text-neutral-400 mt-1 font-mono">
                {report.touchContractsTested} Touch · {report.noTouchContractsTested} No Touch
              </div>
            </div>
          </div>

          {/* Calibration Reliability Diagram & Table */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Reliability Diagram (7 cols) */}
            <div className="lg:col-span-7 bg-neutral-900/60 border border-neutral-800 rounded-lg p-4">
              <div className="flex items-center justify-between mb-3 text-xs font-mono">
                <span className="text-neutral-300 font-semibold">Reliability Diagram (Predicted vs Observed Frequency)</span>
                <span className="text-neutral-400">Diagonal = Perfect Calibration</span>
              </div>

              <div className="w-full bg-neutral-950 border border-neutral-800/80 rounded p-4">
                <svg viewBox="0 0 400 240" className="w-full h-56">
                  {/* Diagonal Identity Line (Perfect calibration) */}
                  <line x1="40" y1="200" x2="360" y2="40" stroke="#404040" strokeDasharray="3 3" />

                  {/* Grid Lines */}
                  <line x1="40" y1="200" x2="360" y2="200" stroke="#262626" />
                  <line x1="40" y1="40" x2="40" y2="200" stroke="#262626" />

                  {/* Axes Labels */}
                  <text x="32" y="45" fill="#737373" fontSize="9" textAnchor="end" fontFamily="monospace">1.0</text>
                  <text x="32" y="120" fill="#737373" fontSize="9" textAnchor="end" fontFamily="monospace">0.5</text>
                  <text x="32" y="200" fill="#737373" fontSize="9" textAnchor="end" fontFamily="monospace">0.0</text>

                  <text x="40" y="215" fill="#737373" fontSize="9" textAnchor="middle" fontFamily="monospace">0.0</text>
                  <text x="200" y="215" fill="#737373" fontSize="9" textAnchor="middle" fontFamily="monospace">0.5</text>
                  <text x="360" y="215" fill="#737373" fontSize="9" textAnchor="middle" fontFamily="monospace">1.0</text>

                  {/* Plotted Bins */}
                  {report.calibrationBins
                    .filter(b => b.sampleCount > 0)
                    .map((bin, i) => {
                      const cx = 40 + bin.predictedAvg * 320;
                      const cy = 200 - bin.observedFreq * 160;
                      return (
                        <g key={i}>
                          <circle cx={cx} cy={cy} r="4" fill="#f43f5e" stroke="#ffffff" strokeWidth="1" />
                        </g>
                      );
                    })}
                </svg>

                <div className="flex justify-between items-center text-[11px] font-mono text-neutral-400 mt-2">
                  <span>Horizontal: Forecasted Probability</span>
                  <span>Vertical: Empirical Realization Rate</span>
                </div>
              </div>
            </div>

            {/* Calibration Bins Data Table (5 cols) */}
            <div className="lg:col-span-5 bg-neutral-900/60 border border-neutral-800 rounded-lg p-4">
              <div className="text-xs font-mono font-semibold text-neutral-300 mb-3">
                Decile Calibration Breakdown
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left font-mono text-[11px]">
                  <thead>
                    <tr className="border-b border-neutral-800 text-neutral-400">
                      <th className="py-1.5 px-2">Bin</th>
                      <th className="py-1.5 px-2">Mean P</th>
                      <th className="py-1.5 px-2">Empirical</th>
                      <th className="py-1.5 px-2 text-right">Samples</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-800/40">
                    {report.calibrationBins.map((bin, i) => (
                      <tr key={i} className="hover:bg-neutral-800/30">
                        <td className="py-1 px-2 text-neutral-400">
                          {(bin.binMin * 100).toFixed(0)}–{(bin.binMax * 100).toFixed(0)}%
                        </td>
                        <td className="py-1 px-2 text-white">
                          {(bin.predictedAvg * 100).toFixed(1)}%
                        </td>
                        <td className="py-1 px-2 text-rose-400">
                          {(bin.observedFreq * 100).toFixed(1)}%
                        </td>
                        <td className="py-1 px-2 text-right text-neutral-400 tabular-nums">
                          {bin.sampleCount}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Regime Breakdown Table */}
          <div className="bg-neutral-900/60 border border-neutral-800 rounded-lg p-4">
            <div className="text-xs font-mono font-semibold text-neutral-300 mb-3">
              Performance by Market Microstructure Regime
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left font-mono text-xs">
                <thead>
                  <tr className="border-b border-neutral-800 text-neutral-400 text-[11px]">
                    <th className="py-2 px-3">Regime</th>
                    <th className="py-2 px-3">Evaluations</th>
                    <th className="py-2 px-3">Regime Brier</th>
                    <th className="py-2 px-3">Win Rate %</th>
                    <th className="py-2 px-3 text-right">Net Simulated P&amp;L</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-800/40">
                  {Object.entries(report.regimeBreakdown).map(([reg, s]) => (
                    <tr key={reg} className="hover:bg-neutral-800/30">
                      <td className="py-2 px-3 text-white font-semibold">
                        {reg.replace(/_/g, ' ')}
                      </td>
                      <td className="py-2 px-3 text-neutral-300 tabular-nums">
                        {s.count}
                      </td>
                      <td className="py-2 px-3 text-neutral-200 tabular-nums">
                        {s.brier.toFixed(4)}
                      </td>
                      <td className="py-2 px-3 text-emerald-400 tabular-nums">
                        {s.winRate}%
                      </td>
                      <td className="py-2 px-3 text-right tabular-nums">
                        <span className={s.avgEV >= 0 ? 'text-emerald-400 font-bold' : 'text-rose-400 font-bold'}>
                          {s.avgEV >= 0 ? '+' : ''}${s.avgEV.toFixed(2)}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : (
        /* Empty State */
        <div className="bg-neutral-900/40 border border-neutral-800 rounded-lg p-12 text-center text-neutral-400">
          <BarChart2 className="w-10 h-10 mx-auto text-neutral-600 mb-3" />
          <h3 className="text-sm font-semibold text-neutral-300 mb-1">Historical Model Validation Ready</h3>
          <p className="text-xs text-neutral-500 max-w-md mx-auto mb-4">
            Click &quot;Run Walk-Forward Validation&quot; above to replay the recorded price history, label Touch and No Touch events, and calculate calibration diagnostics.
          </p>
        </div>
      )}

      {/* Disclaimers & Rigor Notice */}
      <div className="p-3 bg-neutral-950 border border-neutral-800 rounded text-neutral-400 text-xs font-mono space-y-1">
        <div className="flex items-center gap-1.5 text-amber-400 font-semibold">
          <AlertTriangle className="w-3.5 h-3.5" />
          <span>Historical Validation Notice</span>
        </div>
        <p className="text-[11px] text-neutral-400">
          A profitable historical backtest does not prove future profitability. Calibration curves verify probabilistic forecasting accuracy (Brier score and log-loss), not guaranteed trade outcomes.
        </p>
      </div>
    </div>
  );
};
