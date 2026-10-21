/**
 * DolaHanta — Realistic Market Simulation Engine
 * 
 * Provides calibrated price paths for offline testing, backtesting, and development.
 * Explicitly designated as SIMULATED DATA — never represented as live feeds.
 */

import { Instrument, Tick } from '../types/trading';

interface InstrumentState {
  currentPrice: number;
  drift: number;
  volatility: number;
  ticks: Tick[];
}

export class SimulationMarketEngine {
  private states: Map<string, InstrumentState> = new Map();
  private timer: any = null;
  private onTickCallback: ((tick: Tick) => void) | null = null;
  private isRunning: boolean = false;

  constructor() {
    this.initDefaultStates();
  }

  private initDefaultStates() {
    const basePrices: Record<string, number> = {
      R_100: 2548.50,
      R_75: 9845.20,
      R_50: 312.4500,
      R_25: 1450.850,
      R_10: 6420.350,
      '1HZ100V': 3120.40,
      BOOM500: 4820.10,
      CRASH500: 6150.30,
      frxEURUSD: 1.08450,
      frxUSDJPY: 154.250
    };

    const initialEpoch = Math.floor(Date.now() / 1000) - 180; // 180s historical buffer

    for (const [symbol, basePrice] of Object.entries(basePrices)) {
      const isBoom = symbol.startsWith('BOOM');
      const isCrash = symbol.startsWith('CRASH');
      const isForex = symbol.startsWith('frx');

      const vol = isForex ? 0.0003 : isBoom || isCrash ? 0.0025 : 0.0020;
      const drift = isBoom ? -0.00008 : isCrash ? 0.00008 : 0.00001;

      // Pre-seed 120 historical ticks
      const ticks: Tick[] = [];
      let price = basePrice;
      for (let i = 0; i < 120; i++) {
        const t = initialEpoch + i;
        price = this.nextStep(price, drift, vol, isBoom, isCrash);
        ticks.push({ epoch: t, quote: price, symbol });
      }

      this.states.set(symbol, {
        currentPrice: price,
        drift,
        volatility: vol,
        ticks
      });
    }
  }

  private nextStep(
    current: number,
    drift: number,
    vol: number,
    isBoom: boolean,
    isCrash: boolean
  ): number {
    // Standard Brownian step
    const u1 = Math.max(1e-7, Math.random());
    const u2 = Math.random();
    const z = Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);

    let deltaPct = drift + vol * z;

    // Special jump-diffusion for Boom and Crash indices
    if (isBoom && Math.random() < 0.015) {
      // Sudden upward spike ~ +1.5% to +2.5%
      deltaPct += 0.018 + Math.random() * 0.01;
    } else if (isCrash && Math.random() < 0.015) {
      // Sudden downward crash ~ -1.5% to -2.5%
      deltaPct -= 0.018 + Math.random() * 0.01;
    }

    const next = current * Math.exp(deltaPct);
    return Math.max(0.00001, Number(next.toFixed(5)));
  }

  public startStreaming(onTick: (tick: Tick) => void) {
    if (this.isRunning) return;
    this.onTickCallback = onTick;
    this.isRunning = true;

    // Emit ticks every 1000ms
    this.timer = setInterval(() => {
      const now = Math.floor(Date.now() / 1000);
      for (const [symbol, state] of this.states.entries()) {
        const isBoom = symbol.startsWith('BOOM');
        const isCrash = symbol.startsWith('CRASH');
        const nextPrice = this.nextStep(
          state.currentPrice,
          state.drift,
          state.volatility,
          isBoom,
          isCrash
        );
        state.currentPrice = nextPrice;

        const newTick: Tick = {
          epoch: now,
          quote: nextPrice,
          symbol
        };

        state.ticks.push(newTick);
        if (state.ticks.length > 200) {
          state.ticks.shift();
        }

        if (this.onTickCallback) {
          this.onTickCallback(newTick);
        }
      }
    }, 1000);
  }

  public stopStreaming() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    this.isRunning = false;
  }

  public getHistoricalTicks(symbol: string, count: number = 100): Tick[] {
    const state = this.states.get(symbol);
    if (!state) return [];
    return state.ticks.slice(-count);
  }

  public getCurrentPrice(symbol: string): number {
    return this.states.get(symbol)?.currentPrice || 100;
  }
}
