/**
 * DolaHanta — Smart Barrier Intelligence Platform
 * Main Application Entry Point
 */

import React, { useState, useEffect } from 'react';
import { marketDataManager } from './services/marketDataManager';
import { BarrierCandidate, ConnectionMode, MarketState, Tick } from './types/trading';
import { TopBar } from './components/TopBar';
import { MarketOverview } from './components/MarketOverview';
import { ScannerTable } from './components/ScannerTable';
import { BarrierStudio } from './components/BarrierStudio';
import { BacktestLab } from './components/BacktestLab';
import { TestSuiteRunner } from './components/TestSuiteRunner';
import { DocumentationModal } from './components/DocumentationModal';
import { RiskSettingsModal } from './components/RiskSettingsModal';

export function App() {
  const [activeTab, setActiveTab] = useState<'scanner' | 'studio' | 'backtest' | 'tests' | 'docs'>('scanner');
  const [candidates, setCandidates] = useState<BarrierCandidate[]>(() => marketDataManager.getAllCandidates());
  const [marketStates, setMarketStates] = useState<MarketState[]>(() => marketDataManager.getAllMarketStates());
  const [connectionMode, setConnectionMode] = useState<ConnectionMode>(() => marketDataManager.getMode());
  const [lastUpdateEpoch, setLastUpdateEpoch] = useState<number>(() => marketDataManager.getLastUpdateTime());
  const [selectedCandidate, setSelectedCandidate] = useState<BarrierCandidate | null>(null);
  const [isRiskModalOpen, setIsRiskModalOpen] = useState<boolean>(false);
  const [customAppId, setCustomAppId] = useState<string>('1089');

  // Subscribe to real-time market data ticks & state updates
  useEffect(() => {
    const unsubscribe = marketDataManager.subscribe(() => {
      const allC = marketDataManager.getAllCandidates();
      setCandidates(allC);
      setMarketStates(marketDataManager.getAllMarketStates());
      setConnectionMode(marketDataManager.getMode());
      setLastUpdateEpoch(marketDataManager.getLastUpdateTime());

      // If no candidate currently selected, pick first
      if (!selectedCandidate && allC.length > 0) {
        setSelectedCandidate(allC[0]);
      }
    });

    return () => {
      unsubscribe();
    };
  }, [selectedCandidate]);

  // Toggle connection between Live Deriv WebSocket and Simulation
  const handleToggleConnection = () => {
    if (connectionMode === 'CONNECTED_LIVE' || connectionMode === 'RECONNECTING') {
      marketDataManager.setMode('SIMULATED');
    } else {
      marketDataManager.setMode('CONNECTED_LIVE', customAppId);
    }
  };

  const handleSelectCandidate = (candidate: BarrierCandidate) => {
    setSelectedCandidate(candidate);
    setActiveTab('studio');
  };

  // Build tick history map for backtesting lab
  const tickHistoryMap = new Map<string, Tick[]>();
  for (const s of marketStates) {
    tickHistoryMap.set(s.symbol, marketDataManager.getTickHistory(s.symbol));
  }

  const currentStudioState = selectedCandidate ? marketDataManager.getMarketState(selectedCandidate.instrument.symbol) : marketStates[0];
  const currentStudioTicks = selectedCandidate ? marketDataManager.getTickHistory(selectedCandidate.instrument.symbol) : [];

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 flex flex-col font-sans selection:bg-rose-900 selection:text-white">
      {/* 3-Zone Top Navigation Bar */}
      <TopBar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        connectionMode={connectionMode}
        onToggleConnection={handleToggleConnection}
        onOpenRiskModal={() => setIsRiskModalOpen(true)}
      />

      {/* Mobile Sub-Navigation Bar for small viewports */}
      <div className="lg:hidden flex items-center gap-1 overflow-x-auto px-4 py-2 bg-neutral-900/90 border-b border-neutral-800 text-xs font-medium">
        <button
          onClick={() => setActiveTab('scanner')}
          className={`px-3 py-1.5 rounded transition-colors whitespace-nowrap shrink-0 ${
            activeTab === 'scanner' ? 'bg-neutral-800 text-white font-bold' : 'text-neutral-400 hover:text-white'
          }`}
        >
          Signal Scanner
        </button>
        <button
          onClick={() => setActiveTab('studio')}
          className={`px-3 py-1.5 rounded transition-colors whitespace-nowrap shrink-0 ${
            activeTab === 'studio' ? 'bg-neutral-800 text-white font-bold' : 'text-neutral-400 hover:text-white'
          }`}
        >
          Smart Barrier Studio
        </button>
        <button
          onClick={() => setActiveTab('backtest')}
          className={`px-3 py-1.5 rounded transition-colors whitespace-nowrap shrink-0 ${
            activeTab === 'backtest' ? 'bg-neutral-800 text-white font-bold' : 'text-neutral-400 hover:text-white'
          }`}
        >
          Backtest &amp; Calibration
        </button>
        <button
          onClick={() => setActiveTab('tests')}
          className={`px-3 py-1.5 rounded transition-colors whitespace-nowrap shrink-0 ${
            activeTab === 'tests' ? 'bg-neutral-800 text-white font-bold' : 'text-neutral-400 hover:text-white'
          }`}
        >
          Automated Test Suite
        </button>
        <button
          onClick={() => setActiveTab('docs')}
          className={`px-3 py-1.5 rounded transition-colors whitespace-nowrap shrink-0 ${
            activeTab === 'docs' ? 'bg-neutral-800 text-white font-bold' : 'text-neutral-400 hover:text-white'
          }`}
        >
          Specs &amp; Deliverables
        </button>
      </div>

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-4 space-y-4">
        {/* Market Microstructure Overview Strip */}
        <MarketOverview
          marketStates={marketStates}
          candidates={candidates}
          connectionMode={connectionMode}
          lastUpdateEpoch={lastUpdateEpoch}
        />

        {/* Tab Content */}
        {activeTab === 'scanner' && (
          <ScannerTable
            candidates={candidates}
            onSelectCandidate={handleSelectCandidate}
          />
        )}

        {activeTab === 'studio' && (
          <BarrierStudio
            selectedCandidate={selectedCandidate}
            onSelectCandidate={setSelectedCandidate}
            marketState={currentStudioState}
            tickHistory={currentStudioTicks}
            riskSettings={marketDataManager.getRiskSettings()}
          />
        )}

        {activeTab === 'backtest' && (
          <BacktestLab tickHistoryMap={tickHistoryMap} />
        )}

        {activeTab === 'tests' && (
          <TestSuiteRunner />
        )}

        {activeTab === 'docs' && (
          <DocumentationModal />
        )}
      </main>

      {/* Risk Controls Drawer / Modal */}
      <RiskSettingsModal
        isOpen={isRiskModalOpen}
        onClose={() => setIsRiskModalOpen(false)}
        settings={marketDataManager.getRiskSettings()}
        onSave={(newSettings) => marketDataManager.updateRiskSettings(newSettings)}
        customAppId={customAppId}
        onSaveAppId={(appId) => setCustomAppId(appId)}
      />

      {/* Quiet, Professional Quantitative Footer */}
      <footer className="border-t border-neutral-900 bg-neutral-950 py-4 px-6 text-xs text-neutral-400 font-mono flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="font-bold text-neutral-200">DolaHanta</span>
          <span>·</span>
          <span>Deriv Touch &amp; No Touch Intelligence Platform</span>
        </div>
        <div className="text-center sm:text-right text-[11px] text-neutral-400">
          Decision support only. No automatic trade execution. First-passage models are statistical estimates.
        </div>
      </footer>
    </div>
  );
}
export default App;
