/**
 * DolaHanta — Signal Scanner Subsystem
 * Deliverable C implementation
 * 
 * High-density tabular scanner for Deriv Touch and No Touch candidate setups.
 * Features fast multi-axis filtering, quantitative sorting, and deep inspectability.
 */

import React, { useState, useMemo } from 'react';
import {
  BarrierCandidate,
  ContractType,
  BarrierDirection,
  MarketRegimeType,
  SignalStatus,
  InstrumentCategory
} from '../types/trading';
import {
  Search,
  ArrowUpDown,
  ChevronRight,
  Filter,
  CheckCircle2,
  Clock,
  AlertTriangle,
  XCircle,
  HelpCircle,
  Info,
  X
} from 'lucide-react';

interface ScannerTableProps {
  candidates: BarrierCandidate[];
  onSelectCandidate: (candidate: BarrierCandidate) => void;
}

export const ScannerTable: React.FC<ScannerTableProps> = ({
  candidates,
  onSelectCandidate
}) => {
  // Filter States
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<'ALL' | InstrumentCategory>('ALL');
  const [selectedContract, setSelectedContract] = useState<'ALL' | ContractType>('ALL');
  const [selectedDirection, setSelectedDirection] = useState<'ALL' | BarrierDirection>('ALL');
  const [selectedStatus, setSelectedStatus] = useState<'ALL' | SignalStatus>('ALL');
  const [minEV, setMinEV] = useState<number>(-1); // -1 = any
  const [minProb, setMinProb] = useState<number>(0);
  const [maxUncertainty, setMaxUncertainty] = useState<number>(1.0);
  const [justifiedCandidate, setJustifiedCandidate] = useState<BarrierCandidate | null>(null);

  // Sorting
  const [sortBy, setSortBy] = useState<'ev' | 'prob' | 'uncertainty' | 'expiry' | 'distance'>('ev');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  // Filter and sort candidate list
  const filteredCandidates = useMemo(() => {
    return candidates.filter((c) => {
      // Search
      if (search.trim()) {
        const query = search.toLowerCase();
        const matchesSym = c.instrument.symbol.toLowerCase().includes(query);
        const matchesName = c.instrument.displayName.toLowerCase().includes(query);
        if (!matchesSym && !matchesName) return false;
      }

      // Category
      if (selectedCategory !== 'ALL' && c.instrument.category !== selectedCategory) {
        return false;
      }

      // Contract
      if (selectedContract !== 'ALL' && c.contractType !== selectedContract) {
        return false;
      }

      // Direction
      if (selectedDirection !== 'ALL' && c.barrierDirection !== selectedDirection) {
        return false;
      }

      // Status
      if (selectedStatus !== 'ALL' && c.qualificationStatus !== selectedStatus) {
        return false;
      }

      // Min EV
      if (minEV > -1 && c.expectedProfitPerUnit < minEV) {
        return false;
      }

      // Min Prob
      if (c.estimatedProbability < minProb) {
        return false;
      }

      // Max Uncertainty
      if (c.standardError > maxUncertainty) {
        return false;
      }

      return true;
    }).sort((a, b) => {
      let diff = 0;
      if (sortBy === 'ev') diff = a.expectedValue - b.expectedValue;
      else if (sortBy === 'prob') diff = a.estimatedProbability - b.estimatedProbability;
      else if (sortBy === 'uncertainty') diff = a.standardError - b.standardError;
      else if (sortBy === 'expiry') diff = a.expirySeconds - b.expirySeconds;
      else if (sortBy === 'distance') diff = a.relativeDistancePct - b.relativeDistancePct;

      return sortDir === 'asc' ? diff : -diff;
    });
  }, [
    candidates,
    search,
    selectedCategory,
    selectedContract,
    selectedDirection,
    selectedStatus,
    minEV,
    minProb,
    maxUncertainty,
    sortBy,
    sortDir
  ]);

  const handleSort = (field: 'ev' | 'prob' | 'uncertainty' | 'expiry' | 'distance') => {
    if (sortBy === field) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortDir('desc');
    }
  };

  return (
    <div className="space-y-4">
      {/* Search and Quick Filter Bar */}
      <div className="bg-neutral-900/80 border border-neutral-800 rounded-lg p-3.5 space-y-3">
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          {/* Search Input */}
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Filter instrument (e.g. Volatility 100, Boom, EUR/USD)..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-neutral-950 border border-neutral-800 focus:border-rose-500 pl-9 pr-3 py-1.5 text-xs text-white placeholder-neutral-500 rounded-md outline-none transition-colors"
            />
          </div>

          {/* Quick Filter Selectors */}
          <div className="flex flex-wrap items-center gap-2 text-xs">
            {/* Contract Type Tabs */}
            <div className="flex items-center p-1 bg-neutral-950 border border-neutral-800 rounded-md">
              <button
                onClick={() => setSelectedContract('ALL')}
                className={`px-2.5 py-1 text-xs font-medium rounded transition-colors whitespace-nowrap shrink-0 ${
                  selectedContract === 'ALL' ? 'bg-neutral-800 text-white' : 'text-neutral-400 hover:text-white'
                }`}
              >
                All Contracts
              </button>
              <button
                onClick={() => setSelectedContract('TOUCH')}
                className={`px-2.5 py-1 text-xs font-medium rounded transition-colors whitespace-nowrap shrink-0 ${
                  selectedContract === 'TOUCH' ? 'bg-cyan-950 text-cyan-300 border border-cyan-800/50' : 'text-neutral-400 hover:text-white'
                }`}
              >
                Touch
              </button>
              <button
                onClick={() => setSelectedContract('NOTOUCH')}
                className={`px-2.5 py-1 text-xs font-medium rounded transition-colors whitespace-nowrap shrink-0 ${
                  selectedContract === 'NOTOUCH' ? 'bg-violet-950 text-violet-300 border border-violet-800/50' : 'text-neutral-400 hover:text-white'
                }`}
              >
                No Touch
              </button>
            </div>

            {/* Signal Status Tabs */}
            <div className="flex items-center p-1 bg-neutral-950 border border-neutral-800 rounded-md">
              <button
                onClick={() => setSelectedStatus('ALL')}
                className={`px-2.5 py-1 text-xs font-medium rounded transition-colors whitespace-nowrap shrink-0 ${
                  selectedStatus === 'ALL' ? 'bg-neutral-800 text-white' : 'text-neutral-400 hover:text-white'
                }`}
              >
                All Status
              </button>
              <button
                onClick={() => setSelectedStatus('STRONG_CANDIDATE')}
                className={`px-2.5 py-1 text-xs font-medium rounded transition-colors whitespace-nowrap shrink-0 ${
                  selectedStatus === 'STRONG_CANDIDATE' ? 'bg-emerald-950 text-emerald-300 border border-emerald-800/50' : 'text-neutral-400 hover:text-white'
                }`}
              >
                Strong
              </button>
              <button
                onClick={() => setSelectedStatus('WATCH')}
                className={`px-2.5 py-1 text-xs font-medium rounded transition-colors whitespace-nowrap shrink-0 ${
                  selectedStatus === 'WATCH' ? 'bg-amber-950 text-amber-300 border border-amber-800/50' : 'text-neutral-400 hover:text-white'
                }`}
              >
                Watch
              </button>
              <button
                onClick={() => setSelectedStatus('NO_TRADE')}
                className={`px-2.5 py-1 text-xs font-medium rounded transition-colors whitespace-nowrap shrink-0 ${
                  selectedStatus === 'NO_TRADE' ? 'bg-rose-950 text-rose-300 border border-rose-800/50' : 'text-neutral-400 hover:text-white'
                }`}
              >
                No Trade
              </button>
            </div>
          </div>
        </div>

        {/* Secondary Filter Parameters */}
        <div className="flex flex-wrap items-center gap-4 pt-2 border-t border-neutral-800/60 text-xs text-neutral-400 font-mono">
          <div className="flex items-center gap-1.5">
            <span className="text-neutral-500">Min EV:</span>
            <select
              value={minEV}
              onChange={(e) => setMinEV(Number(e.target.value))}
              className="bg-neutral-950 border border-neutral-800 text-neutral-200 px-2 py-0.5 rounded outline-none"
            >
              <option value={-1}>Any EV</option>
              <option value={0}>&gt; 0% (Profitable)</option>
              <option value={0.05}>&gt; +5% (Robust)</option>
              <option value={0.10}>&gt; +10% (High Edge)</option>
            </select>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="text-neutral-500">Direction:</span>
            <select
              value={selectedDirection}
              onChange={(e) => setSelectedDirection(e.target.value as any)}
              className="bg-neutral-950 border border-neutral-800 text-neutral-200 px-2 py-0.5 rounded outline-none"
            >
              <option value="ALL">All Directions</option>
              <option value="UPPER">Upper Barrier</option>
              <option value="LOWER">Lower Barrier</option>
            </select>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="text-neutral-500">Max Error:</span>
            <select
              value={maxUncertainty}
              onChange={(e) => setMaxUncertainty(Number(e.target.value))}
              className="bg-neutral-950 border border-neutral-800 text-neutral-200 px-2 py-0.5 rounded outline-none"
            >
              <option value={1.0}>Any Uncertainty</option>
              <option value={0.10}>&le; 10% Margin</option>
              <option value={0.06}>&le; 6% Tight Margin</option>
            </select>
          </div>

          <div className="ml-auto text-neutral-400">
            Showing <span className="text-white font-bold tabular-nums">{filteredCandidates.length}</span> of <span className="tabular-nums">{candidates.length}</span> candidates
          </div>
        </div>
      </div>

      {/* Main Scanner Table */}
      <div className="bg-neutral-900/60 border border-neutral-800 rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-neutral-800 bg-neutral-950 text-neutral-400 font-mono text-[11px]">
                <th className="py-2.5 px-3">Instrument</th>
                <th className="py-2.5 px-3">Spot Price</th>
                <th className="py-2.5 px-3">Contract</th>
                <th 
                  className="py-2.5 px-3 cursor-pointer hover:text-white"
                  onClick={() => handleSort('distance')}
                >
                  <div className="flex items-center gap-1">
                    <span>Barrier & Distance</span>
                    <ArrowUpDown className="w-3 h-3 text-neutral-500" />
                  </div>
                </th>
                <th 
                  className="py-2.5 px-3 cursor-pointer hover:text-white"
                  onClick={() => handleSort('expiry')}
                >
                  <div className="flex items-center gap-1">
                    <span>Expiry</span>
                    <ArrowUpDown className="w-3 h-3 text-neutral-500" />
                  </div>
                </th>
                <th 
                  className="py-2.5 px-3 cursor-pointer hover:text-white"
                  onClick={() => handleSort('prob')}
                >
                  <div className="flex items-center gap-1">
                    <span>Est. Prob (95% CI)</span>
                    <ArrowUpDown className="w-3 h-3 text-neutral-500" />
                  </div>
                </th>
                <th className="py-2.5 px-3">Payout</th>
                <th 
                  className="py-2.5 px-3 cursor-pointer hover:text-white"
                  onClick={() => handleSort('ev')}
                >
                  <div className="flex items-center gap-1">
                    <span>Expected Value</span>
                    <ArrowUpDown className="w-3 h-3 text-neutral-500" />
                  </div>
                </th>
                <th className="py-2.5 px-3">Qualification</th>
                <th className="py-2.5 px-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-800/60 font-sans">
              {filteredCandidates.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-12 text-center text-neutral-400">
                    <p className="font-medium text-neutral-300">No candidates match the active filter criteria.</p>
                    <p className="text-xs text-neutral-500 mt-1">Adjust your filters or minimum expected value threshold.</p>
                  </td>
                </tr>
              ) : (
                filteredCandidates.map((candidate) => {
                  const isTouch = candidate.contractType === 'TOUCH';
                  const isUpper = candidate.barrierDirection === 'UPPER';
                  const isStrong = candidate.qualificationStatus === 'STRONG_CANDIDATE';
                  const isWatch = candidate.qualificationStatus === 'WATCH';
                  const isNoTrade = candidate.qualificationStatus === 'NO_TRADE';

                  return (
                    <tr
                      key={candidate.id}
                      onClick={() => onSelectCandidate(candidate)}
                      className="hover:bg-neutral-800/40 cursor-pointer transition-colors group"
                    >
                      {/* Instrument */}
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        <div className="font-semibold text-white group-hover:text-rose-400 transition-colors">
                          {candidate.instrument.displayName}
                        </div>
                        <div className="text-[11px] font-mono text-neutral-400">
                          {candidate.instrument.symbol}
                        </div>
                      </td>

                      {/* Spot Price */}
                      <td className="py-2.5 px-3 whitespace-nowrap font-mono tabular-nums text-neutral-200">
                        {candidate.referencePrice.toFixed(candidate.instrument.decimals)}
                      </td>

                      {/* Contract Type & Direction */}
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        <div className="flex items-center gap-1.5 font-mono text-[11px]">
                          <span className={isTouch ? 'text-cyan-400 font-semibold' : 'text-violet-400 font-semibold'}>
                            {candidate.contractType}
                          </span>
                          <span className="text-neutral-500">·</span>
                          <span className={isUpper ? 'text-emerald-400' : 'text-rose-400'}>
                            {candidate.barrierDirection}
                          </span>
                        </div>
                      </td>

                      {/* Barrier Level & Distance */}
                      <td className="py-2.5 px-3 whitespace-nowrap font-mono tabular-nums">
                        <div className="text-neutral-100 font-medium">
                          {candidate.barrierLevel.toFixed(candidate.instrument.decimals)}
                        </div>
                        <div className="text-[11px] text-neutral-400">
                          {isUpper ? '+' : '-'}{candidate.relativeDistancePct.toFixed(2)}% ({candidate.absoluteDistance.toFixed(candidate.instrument.decimals)})
                        </div>
                      </td>

                      {/* Expiry */}
                      <td className="py-2.5 px-3 whitespace-nowrap font-mono tabular-nums text-neutral-300">
                        {candidate.expirySeconds >= 60 ? `${candidate.expirySeconds / 60}m` : `${candidate.expirySeconds}s`}
                      </td>

                      {/* Estimated Probability & CI */}
                      <td className="py-2.5 px-3 whitespace-nowrap font-mono tabular-nums">
                        <div className="font-semibold text-white">
                          {(candidate.estimatedProbability * 100).toFixed(1)}%
                        </div>
                        <div className="text-[11px] text-neutral-400">
                          [{(candidate.uncertaintyInterval[0] * 100).toFixed(1)}% – {(candidate.uncertaintyInterval[1] * 100).toFixed(1)}%]
                        </div>
                      </td>

                      {/* Payout */}
                      <td className="py-2.5 px-3 whitespace-nowrap font-mono tabular-nums">
                        <div className="text-neutral-200 font-medium">
                          {candidate.payoutMultiplier.toFixed(2)}x
                        </div>
                        <div className="text-[11px] text-neutral-400">
                          +{(candidate.netReturnMultiplier * 100).toFixed(0)}% net
                        </div>
                      </td>

                      {/* Expected Value */}
                      <td className="py-2.5 px-3 whitespace-nowrap font-mono tabular-nums">
                        <div className={`font-bold ${
                          candidate.expectedValue > 0 ? 'text-emerald-400' : 'text-neutral-400'
                        }`}>
                          {candidate.expectedValue > 0 ? '+' : ''}${candidate.expectedValue.toFixed(2)}
                        </div>
                        <div className={`text-[11px] ${
                          candidate.expectedProfitPerUnit > 0 ? 'text-emerald-400' : 'text-neutral-400'
                        }`}>
                          {candidate.expectedProfitPerUnit > 0 ? '+' : ''}{(candidate.expectedProfitPerUnit * 100).toFixed(1)}% / unit
                        </div>
                      </td>

                      {/* Signal Status */}
                      <td className="py-2.5 px-3 whitespace-nowrap font-mono text-[11px]">
                        {isStrong ? (
                          <div className="flex items-center gap-1.5 text-emerald-400 font-semibold">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>STRONG CANDIDATE</span>
                          </div>
                        ) : isWatch ? (
                          <div className="flex items-center gap-1.5 text-amber-400 font-medium">
                            <Clock className="w-3.5 h-3.5" />
                            <span>WATCH</span>
                          </div>
                        ) : isNoTrade ? (
                          <div className="flex items-center gap-1.5 text-rose-400 font-medium">
                            <XCircle className="w-3.5 h-3.5" />
                            <span>NO TRADE</span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1.5 text-neutral-400">
                            <AlertTriangle className="w-3.5 h-3.5" />
                            <span>WEAK SETUP</span>
                          </div>
                        )}
                        <div className="text-[10px] text-neutral-400 max-w-[160px] truncate">
                          {candidate.inclusionReasons[0] || candidate.rejectionReasons[0] || 'Awaiting conditions'}
                        </div>
                      </td>

                      {/* Action */}
                      <td className="py-2.5 px-3 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setJustifiedCandidate(candidate);
                            }}
                            className="px-2 py-1 text-[11px] font-mono text-neutral-400 hover:text-white bg-neutral-950 hover:bg-neutral-800 border border-neutral-800 rounded transition-colors inline-flex items-center gap-1"
                            title="Inspect mathematical and empirical justification for all numbers"
                          >
                            <Info className="w-3 h-3 text-rose-500" />
                            <span>Proof</span>
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onSelectCandidate(candidate);
                            }}
                            className="px-2.5 py-1 text-xs font-mono font-medium text-white bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 rounded transition-colors inline-flex items-center gap-1"
                          >
                            <span>Analyze</span>
                            <ChevronRight className="w-3 h-3" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Mathematical & Microstructure Justification Inspector Modal */}
      {justifiedCandidate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in font-sans">
          <div className="w-full max-w-2xl bg-neutral-950 border border-neutral-800 rounded-xl shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-neutral-800 bg-neutral-900/60">
              <div className="flex items-center gap-2">
                <Info className="w-4 h-4 text-rose-500" />
                <h3 className="text-sm font-bold text-white font-mono">
                  Numerical Justification Proof — {justifiedCandidate.instrument.displayName} ({justifiedCandidate.contractType} {justifiedCandidate.barrierDirection})
                </h3>
              </div>
              <button
                onClick={() => setJustifiedCandidate(null)}
                className="p-1 text-neutral-400 hover:text-white rounded transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-4 font-mono text-xs text-neutral-300 max-h-[80vh] overflow-y-auto">
              <div className="p-3 bg-neutral-900/70 border border-neutral-800 rounded space-y-1">
                <div className="text-white font-semibold flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Empirical Market State Vectors (Observed, Not Simulated)</span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-[11px] pt-1 text-neutral-300">
                  <div>Reference Spot: <span className="text-white font-bold">{justifiedCandidate.referencePrice}</span></div>
                  <div>Barrier Level: <span className="text-white font-bold">{justifiedCandidate.barrierLevel}</span> ({justifiedCandidate.relativeDistancePct.toFixed(2)}%)</div>
                  <div>Expiry Horizon: <span className="text-white font-bold">{justifiedCandidate.expirySeconds}s</span></div>
                  <div>Contract Mode: <span className="text-white font-bold">{justifiedCandidate.contractType}</span></div>
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="text-white font-semibold text-[11px]">1. First-Passage Time Probability Derivation</div>
                <div className="p-3 bg-neutral-900/70 border border-neutral-800 rounded text-[11px] space-y-1">
                  <div>&bull; Model: Analytical Reflection Principle under Geometric Brownian Motion with drift</div>
                  <div>&bull; Hitting Probability P(&tau; &le; T): <span className="text-cyan-400 font-bold">{(justifiedCandidate.rawTouchProbability * 100).toFixed(2)}%</span></div>
                  <div>&bull; Contract Success Probability p: <span className="text-emerald-400 font-bold">{(justifiedCandidate.estimatedProbability * 100).toFixed(2)}%</span></div>
                  <div>&bull; 95% Wilson Confidence Interval: <span className="text-amber-400 font-bold">[{(justifiedCandidate.uncertaintyInterval[0] * 100).toFixed(1)}% &ndash; {(justifiedCandidate.uncertaintyInterval[1] * 100).toFixed(1)}%]</span></div>
                  <div>&bull; Standard Error (&plusmn;SE): <span className="text-neutral-200 font-bold">&plusmn;{(justifiedCandidate.standardError * 100).toFixed(2)}%</span></div>
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="text-white font-semibold text-[11px]">2. Deriv Contract Economics Proof</div>
                <div className="p-3 bg-neutral-900/70 border border-neutral-800 rounded text-[11px] space-y-1">
                  <div>&bull; Deriv Gross Payout Multiplier: <span className="text-white font-bold">{justifiedCandidate.payoutMultiplier.toFixed(2)}x</span> (Net return R = +{(justifiedCandidate.netReturnMultiplier * 100).toFixed(0)}%)</div>
                  <div>&bull; Expected Return Formula: EV/unit = p &middot; R - (1 - p)</div>
                  <div>&bull; Value Substitution: ({justifiedCandidate.estimatedProbability.toFixed(3)} &times; {justifiedCandidate.netReturnMultiplier.toFixed(2)}) &ndash; ({(1 - justifiedCandidate.estimatedProbability).toFixed(3)} &times; 1.0)</div>
                  <div>&bull; Exact Unit Edge: <span className={justifiedCandidate.expectedProfitPerUnit >= 0 ? 'text-emerald-400 font-bold' : 'text-rose-400 font-bold'}>{(justifiedCandidate.expectedProfitPerUnit * 100).toFixed(2)}%</span></div>
                  <div>&bull; Dollar Value on ${justifiedCandidate.stake} Stake: <span className={justifiedCandidate.expectedValue >= 0 ? 'text-emerald-400 font-bold' : 'text-rose-400 font-bold'}>${justifiedCandidate.expectedValue.toFixed(2)}</span></div>
                  <div>&bull; Conservative 95% Lower Bound EV: <span className="text-neutral-200 font-bold">${justifiedCandidate.conservativeEV.toFixed(2)}</span></div>
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="text-white font-semibold text-[11px]">3. Decision Classification Verdict</div>
                <div className="p-3 bg-neutral-900/70 border border-neutral-800 rounded text-[11px] space-y-1">
                  <div>Status: <span className="text-white font-bold">{justifiedCandidate.qualificationStatus}</span></div>
                  {justifiedCandidate.inclusionReasons.map((r, i) => (
                    <div key={i} className="text-emerald-400">&bull; Pass: {r}</div>
                  ))}
                  {justifiedCandidate.rejectionReasons.map((r, i) => (
                    <div key={i} className="text-rose-400">&bull; Filter: {r}</div>
                  ))}
                </div>
              </div>
            </div>

            <div className="px-5 py-3 border-t border-neutral-800 bg-neutral-900/40 text-right">
              <button
                onClick={() => setJustifiedCandidate(null)}
                className="px-4 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-white font-mono text-xs rounded transition-colors"
              >
                Close Proof
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
