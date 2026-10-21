/**
 * DolaHanta — Market Overview & Telemetry Strip
 */

import React from 'react';
import { BarrierCandidate, ConnectionMode, MarketState } from '../types/trading';

interface MarketOverviewProps {
  marketStates: MarketState[];
  candidates: BarrierCandidate[];
  connectionMode: ConnectionMode;
  lastUpdateEpoch: number;
}

export const MarketOverview: React.FC<MarketOverviewProps> = ({
  marketStates,
  candidates,
  connectionMode,
  lastUpdateEpoch
}) => {
  // Aggregate regime counts
  let bullishCount = 0;
  let bearishCount = 0;
  let rangingCount = 0;
  let highVolCount = 0;

  for (const s of marketStates) {
    if (s.regime === 'BULLISH_TREND') bullishCount++;
    else if (s.regime === 'BEARISH_TREND') bearishCount++;
    else if (s.regime === 'RANGING' || s.regime === 'LOW_VOLATILITY') rangingCount++;
    else if (s.regime === 'HIGH_VOLATILITY' || s.regime === 'VOLATILITY_EXPANSION') highVolCount++;
  }

  // Candidate status counts
  const strongCount = candidates.filter(c => c.qualificationStatus === 'STRONG_CANDIDATE').length;
  const watchCount = candidates.filter(c => c.qualificationStatus === 'WATCH').length;
  const noTradeCount = candidates.filter(c => c.qualificationStatus === 'NO_TRADE').length;

  const touchEligible = candidates.filter(c => c.contractType === 'TOUCH' && (c.qualificationStatus === 'STRONG_CANDIDATE' || c.qualificationStatus === 'WATCH')).length;
  const noTouchEligible = candidates.filter(c => c.contractType === 'NOTOUCH' && (c.qualificationStatus === 'STRONG_CANDIDATE' || c.qualificationStatus === 'WATCH')).length;

  const secondsAgo = Math.max(0, Math.round((Date.now() - lastUpdateEpoch) / 1000));

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 py-4">
      {/* 1. Market Regimes */}
      <div className="p-3.5 bg-neutral-900/70 border border-neutral-800 rounded-lg">
        <div className="text-xs font-medium text-neutral-400 mb-1">Market Regime Distribution</div>
        <div className="flex items-baseline gap-2 font-mono">
          <span className="text-lg font-bold text-white tabular-nums">{marketStates.length}</span>
          <span className="text-xs text-neutral-400">active symbols</span>
        </div>
        <div className="flex items-center gap-2 mt-2 text-xs font-mono text-neutral-400">
          <span className="text-emerald-400">{bullishCount} Bull</span>
          <span>·</span>
          <span className="text-rose-400">{bearishCount} Bear</span>
          <span>·</span>
          <span className="text-neutral-300">{rangingCount} Range</span>
          <span>·</span>
          <span className="text-amber-400">{highVolCount} Vol</span>
        </div>
      </div>

      {/* 2. Qualified Candidates */}
      <div className="p-3.5 bg-neutral-900/70 border border-neutral-800 rounded-lg">
        <div className="text-xs font-medium text-neutral-400 mb-1">Signal Qualification</div>
        <div className="flex items-baseline gap-2 font-mono">
          <span className="text-lg font-bold text-emerald-400 tabular-nums">{strongCount}</span>
          <span className="text-xs text-neutral-400">strong setups</span>
        </div>
        <div className="flex items-center gap-2 mt-2 text-xs font-mono text-neutral-400">
          <span className="text-amber-400">{watchCount} Watch</span>
          <span>·</span>
          <span className="text-neutral-500">{noTradeCount} Rejected</span>
        </div>
      </div>

      {/* 3. Contract Breakdown */}
      <div className="p-3.5 bg-neutral-900/70 border border-neutral-800 rounded-lg">
        <div className="text-xs font-medium text-neutral-400 mb-1">Active Setups by Type</div>
        <div className="flex items-baseline gap-2 font-mono">
          <span className="text-lg font-bold text-white tabular-nums">{touchEligible + noTouchEligible}</span>
          <span className="text-xs text-neutral-400">evaluations</span>
        </div>
        <div className="flex items-center gap-2 mt-2 text-xs font-mono text-neutral-400">
          <span className="text-cyan-400">{touchEligible} Touch</span>
          <span>·</span>
          <span className="text-violet-400">{noTouchEligible} No Touch</span>
        </div>
      </div>

      {/* 4. Telemetry & Data Freshness */}
      <div className="p-3.5 bg-neutral-900/70 border border-neutral-800 rounded-lg">
        <div className="text-xs font-medium text-neutral-400 mb-1">Data Feed & Freshness</div>
        <div className="flex items-baseline gap-2 font-mono">
          <span className="text-sm font-semibold text-white">
            {connectionMode === 'CONNECTED_LIVE' ? 'Deriv WS Live' : connectionMode === 'RECONNECTING' ? 'Reconnecting' : 'Calibrated Sim'}
          </span>
          <span className="text-xs text-neutral-400 tabular-nums">{secondsAgo}s ago</span>
        </div>
        <div className="mt-2 text-xs font-mono text-neutral-400 truncate">
          {connectionMode === 'CONNECTED_LIVE' ? (
            <span className="text-emerald-400">Real-time tick streaming</span>
          ) : (
            <span className="text-neutral-400">Jump-diffusion synthetic model</span>
          )}
        </div>
      </div>
    </div>
  );
};
