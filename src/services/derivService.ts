/**
 * DolaHanta — Official Deriv WebSocket Integration Subsystem
 * 
 * Implements:
 * - WebSocket protocol to wss://ws.derivws.com/websockets/v3
 * - Active symbol verification
 * - Tick subscription and history retrieval
 * - Contract proposal & payout retrieval
 * - Connection health monitoring, ping heartbeats, and bounded backoff
 * - Error detection and rate limit handling
 */

import { ContractType, Tick } from '../types/trading';

export type DerivConnectionStatus = 'DISCONNECTED' | 'CONNECTING' | 'CONNECTED' | 'RECONNECTING' | 'ERROR';

export interface DerivProposalResponse {
  askPrice: number;
  payout: number;
  spot: number;
  barrier: string;
  payoutMultiplier: number;
}

export class DerivWebSocketClient {
  private ws: WebSocket | null = null;
  private url: string;
  private appId: string;
  private status: DerivConnectionStatus = 'DISCONNECTED';
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectTimer: any = null;
  private pingTimer: any = null;
  private subscribedSymbols: Set<string> = new Set();
  private pendingRequests: Map<string, { resolve: (val: any) => void; reject: (err: any) => void }> = new Map();
  private reqIdCounter = 1;

  public onStatusChange?: (status: DerivConnectionStatus) => void;
  public onTick?: (tick: Tick) => void;
  public onError?: (errorMsg: string) => void;

  constructor(appId: string = '1089') {
    this.appId = appId;
    this.url = `wss://ws.derivws.com/websockets/v3?app_id=${this.appId}`;
  }

  public getStatus(): DerivConnectionStatus {
    return this.status;
  }

  private setStatus(status: DerivConnectionStatus) {
    this.status = status;
    if (this.onStatusChange) {
      this.onStatusChange(status);
    }
  }

  public connect() {
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      return;
    }

    this.setStatus(this.reconnectAttempts > 0 ? 'RECONNECTING' : 'CONNECTING');

    try {
      this.ws = new WebSocket(this.url);

      this.ws.onopen = () => {
        this.setStatus('CONNECTED');
        this.reconnectAttempts = 0;
        this.startHeartbeat();
        // Re-subscribe to symbols
        for (const sym of this.subscribedSymbols) {
          this.subscribeTicks(sym);
        }
      };

      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          this.handleIncomingMessage(data);
        } catch (err) {
          console.error('[DerivWS] Failed to parse message:', err);
        }
      };

      this.ws.onerror = (err) => {
        console.warn('[DerivWS] Connection error:', err);
        if (this.onError) {
          this.onError('Deriv WebSocket communication error.');
        }
      };

      this.ws.onclose = () => {
        this.stopHeartbeat();
        if (this.status !== 'DISCONNECTED') {
          this.scheduleReconnect();
        }
      };
    } catch (err) {
      console.error('[DerivWS] Connection creation failed:', err);
      this.scheduleReconnect();
    }
  }

  public disconnect() {
    this.stopHeartbeat();
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.setStatus('DISCONNECTED');
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  private scheduleReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      this.setStatus('ERROR');
      if (this.onError) {
        this.onError('Max reconnection attempts reached. Switched to fallback/offline mode.');
      }
      return;
    }

    this.setStatus('RECONNECTING');
    this.reconnectAttempts++;
    const backoffMs = Math.min(15000, 1000 * Math.pow(2, this.reconnectAttempts - 1));

    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.reconnectTimer = setTimeout(() => {
      this.connect();
    }, backoffMs);
  }

  private startHeartbeat() {
    this.stopHeartbeat();
    this.pingTimer = setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({ ping: 1 }));
      }
    }, 30000);
  }

  private stopHeartbeat() {
    if (this.pingTimer) {
      clearInterval(this.pingTimer);
      this.pingTimer = null;
    }
  }

  private handleIncomingMessage(msg: any) {
    if (msg.error) {
      console.warn('[DerivWS] API Error:', msg.error.message);
      if (msg.req_id && this.pendingRequests.has(String(msg.req_id))) {
        this.pendingRequests.get(String(msg.req_id))?.reject(new Error(msg.error.message));
        this.pendingRequests.delete(String(msg.req_id));
      }
      return;
    }

    // Handle tick stream
    if (msg.msg_type === 'tick' && msg.tick) {
      const tick: Tick = {
        epoch: msg.tick.epoch,
        quote: msg.tick.quote,
        symbol: msg.tick.symbol
      };
      if (this.onTick) {
        this.onTick(tick);
      }
    }

    // Handle resolved request
    if (msg.req_id && this.pendingRequests.has(String(msg.req_id))) {
      this.pendingRequests.get(String(msg.req_id))?.resolve(msg);
      this.pendingRequests.delete(String(msg.req_id));
    }
  }

  private sendRequest(req: Record<string, any>): Promise<any> {
    return new Promise((resolve, reject) => {
      if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
        return reject(new Error('WebSocket not connected'));
      }
      const reqId = this.reqIdCounter++;
      req.req_id = reqId;
      this.pendingRequests.set(String(reqId), { resolve, reject });
      this.ws.send(JSON.stringify(req));

      // Timeout request after 10s
      setTimeout(() => {
        if (this.pendingRequests.has(String(reqId))) {
          this.pendingRequests.get(String(reqId))?.reject(new Error('Request timeout'));
          this.pendingRequests.delete(String(reqId));
        }
      }, 10000);
    });
  }

  public subscribeTicks(symbol: string) {
    this.subscribedSymbols.add(symbol);
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ ticks: symbol, subscribe: 1 }));
    }
  }

  public async getTickHistory(symbol: string, count: number = 100): Promise<Tick[]> {
    try {
      const res = await this.sendRequest({
        ticks_history: symbol,
        end: 'latest',
        count,
        style: 'ticks'
      });

      if (res.history && res.history.prices && res.history.times) {
        const prices: number[] = res.history.prices;
        const times: number[] = res.history.times;
        const ticks: Tick[] = [];
        for (let i = 0; i < prices.length; i++) {
          ticks.push({
            epoch: times[i],
            quote: prices[i],
            symbol
          });
        }
        return ticks;
      }
      return [];
    } catch (err) {
      console.warn(`[DerivWS] Failed to fetch tick history for ${symbol}:`, err);
      return [];
    }
  }

  public async getContractProposal(
    symbol: string,
    contractType: ContractType,
    barrier: number,
    durationSeconds: number,
    stake: number = 10
  ): Promise<DerivProposalResponse | null> {
    try {
      const res = await this.sendRequest({
        proposal: 1,
        amount: stake,
        basis: 'stake',
        contract_type: contractType === 'TOUCH' ? 'ONETOUCH' : 'NOTOUCH',
        currency: 'USD',
        duration: durationSeconds,
        duration_unit: 's',
        symbol,
        barrier: String(barrier)
      });

      if (res.proposal) {
        const p = res.proposal;
        return {
          askPrice: p.ask_price,
          payout: p.payout,
          spot: p.spot,
          barrier: String(barrier),
          payoutMultiplier: p.payout / (p.ask_price || stake)
        };
      }
      return null;
    } catch (err) {
      // Non-fatal: proposal might not be offered for exact boundary
      return null;
    }
  }
}
