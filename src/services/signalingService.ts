/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { CallToken, generateOneTimeCallToken, verifyAndBurnToken } from '../utils/cryptoCallLogic';

export interface SignalMessage {
  type: 'JOIN' | 'OFFER' | 'ANSWER' | 'ICE_CANDIDATE' | 'BURN_CALL' | 'PING';
  callId: string;
  senderRole: 'owner' | 'guest';
  payload?: any;
  timestamp: number;
}

const STORAGE_KEY_TOKENS = 'ciphercall_active_tokens';
const STORAGE_KEY_BURNED = 'ciphercall_burned_tokens';
const CHANNEL_NAME = 'ciphercall_p2p_channel';

class SignalingService {
  private channel: BroadcastChannel | null = null;
  private listeners: Set<(msg: SignalMessage) => void> = new Set();

  constructor() {
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      try {
        this.channel = new BroadcastChannel(CHANNEL_NAME);
        this.channel.onmessage = (event) => {
          const msg = event.data as SignalMessage;
          this.notifyListeners(msg);
        };
      } catch {
        // Fallback for environments without BroadcastChannel
      }
    }

    // Cross-tab fallback via window storage event
    if (typeof window !== 'undefined') {
      window.addEventListener('storage', (e) => {
        if (e.key === 'ciphercall_last_signal' && e.newValue) {
          try {
            const msg = JSON.parse(e.newValue) as SignalMessage;
            this.notifyListeners(msg);
          } catch {
            // Ignore malformed storage events
          }
        }
      });
    }
  }

  private notifyListeners(msg: SignalMessage) {
    this.listeners.forEach((listener) => {
      try {
        listener(msg);
      } catch (err) {
        console.error('Signaling listener error:', err);
      }
    });
  }

  public subscribe(callback: (msg: SignalMessage) => void): () => void {
    this.listeners.add(callback);
    return () => {
      this.listeners.delete(callback);
    };
  }

  public sendSignal(msg: SignalMessage): void {
    if (this.channel) {
      this.channel.postMessage(msg);
    }
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        window.localStorage.setItem('ciphercall_last_signal', JSON.stringify(msg));
      } catch {
        // Ignore quota errors
      }
    }
  }

  public saveToken(token: CallToken): void {
    if (typeof window === 'undefined') return;
    try {
      const existing = this.getStoredTokens();
      existing[token.id] = token;
      window.localStorage.setItem(STORAGE_KEY_TOKENS, JSON.stringify(existing));
    } catch {
      // Storage error fallback
    }
  }

  public getStoredTokens(): Record<string, CallToken> {
    if (typeof window === 'undefined') return {};
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY_TOKENS);
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  }

  public getTokenById(id: string): CallToken | null {
    const tokens = this.getStoredTokens();
    return tokens[id] || null;
  }

  public burnToken(id: string, reason: string = 'COMPLETED'): void {
    if (typeof window === 'undefined') return;
    const tokens = this.getStoredTokens();
    if (tokens[id]) {
      tokens[id].isBurned = true;
      tokens[id].burnedAt = Date.now();
      window.localStorage.setItem(STORAGE_KEY_TOKENS, JSON.stringify(tokens));
    }

    // Also persist in burned ledger
    try {
      const burnedRaw = window.localStorage.getItem(STORAGE_KEY_BURNED);
      const burnedList: string[] = burnedRaw ? JSON.parse(burnedRaw) : [];
      if (!burnedList.includes(id)) {
        burnedList.push(id);
        window.localStorage.setItem(STORAGE_KEY_BURNED, JSON.stringify(burnedList));
      }
    } catch {
      // Ignore
    }

    // Broadcast burning signal so peer terminates immediately
    this.sendSignal({
      type: 'BURN_CALL',
      callId: id,
      senderRole: 'owner',
      payload: { reason },
      timestamp: Date.now(),
    });
  }

  public isTokenBurned(id: string): boolean {
    if (typeof window === 'undefined') return false;
    try {
      const burnedRaw = window.localStorage.getItem(STORAGE_KEY_BURNED);
      const burnedList: string[] = burnedRaw ? JSON.parse(burnedRaw) : [];
      if (burnedList.includes(id)) return true;
    } catch {
      //
    }
    const token = this.getTokenById(id);
    return token ? token.isBurned : false;
  }
}

export const signalingService = new SignalingService();
