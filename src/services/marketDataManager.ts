/**
 * DolaHanta — Unified Market Data Manager
 * 
 * Bridges Deriv WebSocket API and Calibrated Simulation Engine.
 * Manages active symbol subscriptions, rolling tick ring buffers,
 * state analysis, and candidate generation.
 */

import { SUPPORTED_INSTRUMENTS, DEFAULT_RISK_SETTINGS } from '../config/instruments';
import { analyzeMarketState } from '../engine/regimeClassifier';
import { generateBarrierCandidates } from '../engine/smartBarrierEngine';
import {
  BarrierCandidate,
  ConnectionMode,
  Instrument,
  MarketState,
  RiskSettings,
  Tick
} from '../types/trading';
import { DerivWebSocketClient } from './derivService';
import { SimulationMarketEngine } from './simulationService';

export class MarketDataManager {
  private mode: ConnectionMode = 'SIMULATED';
  private simulationEngine: SimulationMarketEngine;
  private derivClient: DerivWebSocketClient | null = null;
  private tickHistory: Map<string, Tick[]> = new Map();
  private marketStates: Map<string, MarketState> = new Map();
  private allCandidates: BarrierCandidate[] = [];
  private riskSettings: RiskSettings = { ...DEFAULT_RISK_SETTINGS };
  private listeners: Set<() => void> = new Set();
  private customAppId: string = '1089';
  private lastUpdateTimestamp: number = Date.now();

  constructor() {
    this.simulationEngine = new SimulationMarketEngine();
    this.initializeBuffers();
    this.startMode('SIMULATED');
  }

  private initializeBuffers() {
    for (const inst of SUPPORTED_INSTRUMENTS) {
      const hist = this.simulationEngine.getHistoricalTicks(inst.symbol, 120);
      this.tickHistory.set(inst.symbol, hist);
      const state = analyzeMarketState(inst.symbol, hist);
      this.marketStates.set(inst.symbol, state);
    }
    this.recomputeAllCandidates();
  }

  public subscribe(listener: () => void) {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify() {
    this.lastUpdateTimestamp = Date.now();
    for (const listener of this.listeners) {
      listener();
    }
  }

  public getMode(): ConnectionMode {
    return this.mode;
  }

  public getRiskSettings(): RiskSettings {
    return this.riskSettings;
  }

  public updateRiskSettings(newSettings: Partial<RiskSettings>) {
    this.riskSettings = { ...this.riskSettings, ...newSettings };
    this.recomputeAllCandidates();
    this.notify();
  }

  public setMode(newMode: ConnectionMode, customAppId?: string) {
    if (customAppId) {
      this.customAppId = customAppId;
    }
    if (newMode === this.mode) return;
    this.startMode(newMode);
  }

  private startMode(targetMode: ConnectionMode) {
    // Teardown previous
    if (this.derivClient) {
      this.derivClient.disconnect();
      this.derivClient = null;
    }
    this.simulationEngine.stopStreaming();

    if (targetMode === 'SIMULATED') {
      this.mode = 'SIMULATED';
      this.simulationEngine.startStreaming((tick) => this.onIncomingTick(tick));
      this.notify();
    } else {
      this.mode = 'RECONNECTING';
      this.derivClient = new DerivWebSocketClient(this.customAppId);

      this.derivClient.onStatusChange = (status) => {
        if (status === 'CONNECTED') {
          this.mode = 'CONNECTED_LIVE';
          // Subscribe to all supported instruments
          for (const inst of SUPPORTED_INSTRUMENTS) {
            this.derivClient?.subscribeTicks(inst.symbol);
            // Also seed historical ticks
            this.derivClient?.getTickHistory(inst.symbol, 80).then((history) => {
              if (history && history.length > 0) {
                this.tickHistory.set(inst.symbol, history);
                const state = analyzeMarketState(inst.symbol, history);
                this.marketStates.set(inst.symbol, state);
                this.recomputeAllCandidates();
                this.notify();
              }
            });
          }
        } else if (status === 'RECONNECTING') {
          this.mode = 'RECONNECTING';
        } else if (status === 'DISCONNECTED') {
          this.mode = 'DISCONNECTED';
        } else if (status === 'ERROR') {
          this.mode = 'DISCONNECTED';
        }
        this.notify();
      };

      this.derivClient.onTick = (tick) => {
        this.onIncomingTick(tick);
      };

      this.derivClient.onError = (err) => {
        console.warn('[DataManager] Deriv WS error:', err);
      };

      this.derivClient.connect();
    }
  }

  private onIncomingTick(tick: Tick) {
    const history = this.tickHistory.get(tick.symbol) || [];
    history.push(tick);
    if (history.length > 200) {
      history.shift();
    }
    this.tickHistory.set(tick.symbol, history);

    // Update market state
    const state = analyzeMarketState(tick.symbol, history);
    this.marketStates.set(tick.symbol, state);

    // Recompute candidates for this symbol
    const inst = SUPPORTED_INSTRUMENTS.find(i => i.symbol === tick.symbol);
    if (inst) {
      const candidates = generateBarrierCandidates(inst, state, this.riskSettings);
      // Replace existing candidates for this symbol
      this.allCandidates = [
        ...this.allCandidates.filter(c => c.instrument.symbol !== tick.symbol),
        ...candidates
      ];
    }

    this.notify();
  }

  public recomputeAllCandidates() {
    const list: BarrierCandidate[] = [];
    for (const inst of SUPPORTED_INSTRUMENTS) {
      const state = this.marketStates.get(inst.symbol);
      if (state) {
        const candidates = generateBarrierCandidates(inst, state, this.riskSettings);
        list.push(...candidates);
      }
    }
    this.allCandidates = list;
  }

  public getAllCandidates(): BarrierCandidate[] {
    return this.allCandidates;
  }

  public getMarketState(symbol: string): MarketState | undefined {
    return this.marketStates.get(symbol);
  }

  public getAllMarketStates(): MarketState[] {
    return Array.from(this.marketStates.values());
  }

  public getTickHistory(symbol: string): Tick[] {
    return this.tickHistory.get(symbol) || [];
  }

  public getLastUpdateTime(): number {
    return this.lastUpdateTimestamp;
  }
}

// Global Singleton for application lifetime
export const marketDataManager = new MarketDataManager();
