/**
 * DolaHanta — Top Bar Navigation Component
 * Complies with the 3-zone Top Bar Contract from frontend design guidelines:
 * Zone 1: Single text wordmark
 * Zone 2: 4 single-line clean nav links (internal dev specs removed)
 * Zone 3: Connection status, Risk controls & Client License Log Out
 */

import React from 'react';
import { ConnectionMode } from '../types/trading';
import { ShieldAlert, Radio, Activity, Cpu, LogOut, CheckCircle } from 'lucide-react';

interface TopBarProps {
  activeTab: 'scanner' | 'studio' | 'backtest' | 'tests';
  setActiveTab: (tab: 'scanner' | 'studio' | 'backtest' | 'tests') => void;
  connectionMode: ConnectionMode;
  onToggleConnection: () => void;
  onOpenRiskModal: () => void;
  clientEmail?: string;
  onLogOut: () => void;
}

export const TopBar: React.FC<TopBarProps> = ({
  activeTab,
  setActiveTab,
  connectionMode,
  onToggleConnection,
  onOpenRiskModal,
  clientEmail,
  onLogOut
}) => {
  const isLive = connectionMode === 'CONNECTED_LIVE';
  const isReconnecting = connectionMode === 'RECONNECTING';

  return (
    <header className="sticky top-0 z-50 flex items-center justify-between gap-4 md:gap-8 px-4 md:px-8 py-3.5 bg-neutral-950/90 backdrop-blur-md border-b border-neutral-800">
      {/* Zone 1: Wordmark */}
      <div className="flex items-center gap-3 shrink-0">
        <a 
          href="#scanner" 
          onClick={(e) => { e.preventDefault(); setActiveTab('scanner'); }}
          className="text-lg md:text-xl font-bold tracking-tight text-white font-sans flex items-center gap-2 whitespace-nowrap shrink-0"
        >
          <span className="w-2.5 h-2.5 bg-rose-600 rounded-xs"></span>
          <span>DolaHanta</span>
        </a>
      </div>

      {/* Zone 2: Navigation Links (Single-line, unboxed, strictly client-facing) */}
      <nav className="hidden lg:flex items-center gap-6 text-sm font-medium text-neutral-400">
        <button
          onClick={() => setActiveTab('scanner')}
          className={`transition-colors whitespace-nowrap shrink-0 ${
            activeTab === 'scanner' ? 'text-white border-b-2 border-rose-500 pb-0.5' : 'hover:text-neutral-200'
          }`}
        >
          Signal Scanner
        </button>
        <button
          onClick={() => setActiveTab('studio')}
          className={`transition-colors whitespace-nowrap shrink-0 ${
            activeTab === 'studio' ? 'text-white border-b-2 border-rose-500 pb-0.5' : 'hover:text-neutral-200'
          }`}
        >
          Smart Barrier Studio
        </button>
        <button
          onClick={() => setActiveTab('backtest')}
          className={`transition-colors whitespace-nowrap shrink-0 ${
            activeTab === 'backtest' ? 'text-white border-b-2 border-rose-500 pb-0.5' : 'hover:text-neutral-200'
          }`}
        >
          Backtest &amp; Calibration
        </button>
        <button
          onClick={() => setActiveTab('tests')}
          className={`transition-colors whitespace-nowrap shrink-0 ${
            activeTab === 'tests' ? 'text-white border-b-2 border-rose-500 pb-0.5' : 'hover:text-neutral-200'
          }`}
        >
          Automated Test Suite
        </button>
      </nav>

      {/* Zone 3: Connection & Client License Controls (Download zip removed) */}
      <div className="flex items-center gap-2.5 shrink-0 font-mono text-xs">
        {/* Connection Mode Toggle */}
        <button
          onClick={onToggleConnection}
          title={isLive ? 'Connected to live Deriv WebSocket. Click to toggle Simulation.' : 'Operating in calibrated Simulation mode. Click to connect to Deriv WebSocket.'}
          className={`flex items-center gap-1.5 px-3 py-1.5 font-medium rounded-md transition-colors border whitespace-nowrap shrink-0 ${
            isLive
              ? 'bg-emerald-950/60 border-emerald-700/60 text-emerald-300 hover:bg-emerald-900/60'
              : isReconnecting
              ? 'bg-amber-950/60 border-amber-700/60 text-amber-300 animate-pulse'
              : 'bg-neutral-900 border-neutral-700 text-neutral-300 hover:bg-neutral-800'
          }`}
        >
          {isLive ? (
            <>
              <Radio className="w-3.5 h-3.5 text-emerald-400" />
              <span>DERIV LIVE</span>
            </>
          ) : isReconnecting ? (
            <>
              <Activity className="w-3.5 h-3.5 text-amber-400" />
              <span>CONNECTING...</span>
            </>
          ) : (
            <>
              <Cpu className="w-3.5 h-3.5 text-neutral-400" />
              <span>CALIBRATED FEED</span>
            </>
          )}
        </button>

        {/* Risk Controls */}
        <button
          onClick={onOpenRiskModal}
          className="flex items-center gap-1.5 px-3 py-1.5 font-medium text-neutral-300 bg-neutral-900 border border-neutral-800 hover:border-neutral-700 hover:text-white rounded-md transition-colors whitespace-nowrap shrink-0"
        >
          <ShieldAlert className="w-3.5 h-3.5 text-rose-500" />
          <span className="hidden sm:inline">Risk Controls</span>
        </button>

        {/* Client License Badge & Sign Out */}
        <div className="hidden sm:flex items-center gap-2 pl-2 border-l border-neutral-800">
          <div className="flex items-center gap-1 text-[11px] text-emerald-400">
            <CheckCircle className="w-3.5 h-3.5" />
            <span className="truncate max-w-[100px]">{clientEmail || 'Licensed'}</span>
          </div>
          <button
            onClick={onLogOut}
            title="Lock terminal and sign out"
            className="p-1.5 text-neutral-400 hover:text-rose-400 hover:bg-neutral-900 rounded transition-colors"
          >
            <LogOut className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </header>
  );
};
