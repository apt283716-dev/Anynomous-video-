/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Shield, Key, Phone, Flame, Lock, ArrowRight, AlertCircle } from 'lucide-react';
import { CallToken, verifyAndBurnToken, maskPhoneNumber } from '../utils/cryptoCallLogic';
import { signalingService } from '../services/signalingService';

interface GuestJoinScreenProps {
  token: CallToken | null;
  onJoinSuccess: (token: CallToken) => void;
  onTokenInvalid: (reason: string) => void;
}

export const GuestJoinScreen: React.FC<GuestJoinScreenProps> = ({
  token,
  onJoinSuccess,
  onTokenInvalid,
}) => {
  const [pinInput, setPinInput] = useState(token?.pinCode || '');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (token) {
      if (token.isBurned) {
        onTokenInvalid('This one-time call link has already been used and burned.');
      }
    }
  }, [token, onTokenInvalid]);

  const handleJoin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) {
      setError('Invalid or expired call session token.');
      return;
    }

    // Verify token & burn upon join
    const result = verifyAndBurnToken(token, {
      pinToCheck: pinInput.trim(),
      currentTime: Date.now(),
    });

    if (!result.success) {
      if (result.reason === 'PIN_MISMATCH') {
        setError('Incorrect 6-digit Safety PIN. Please ask the host.');
      } else if (result.reason === 'EXPIRED') {
        setError('This one-time call link has expired.');
        onTokenInvalid('Link has expired past its validity window.');
      } else if (result.reason === 'ALREADY_BURNED') {
        setError('This one-time link was already burned.');
        onTokenInvalid('This single-use link has already been burned.');
      } else {
        setError('Unable to authenticate one-time session.');
      }
      return;
    }

    // Save burned status in storage so replay attacks fail
    signalingService.saveToken(result.updatedToken);

    onJoinSuccess(result.updatedToken);
  };

  if (!token) {
    return (
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 text-center space-y-4 max-w-md mx-auto">
        <div className="w-12 h-12 rounded-xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-400 mx-auto">
          <Flame className="w-6 h-6 text-amber-500" />
        </div>
        <h2 className="text-lg font-bold text-white">Call Session Not Found or Burned</h2>
        <p className="text-xs text-slate-400 font-mono">
          The requested one-time video link is invalid or has already been permanently destroyed.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl max-w-md mx-auto space-y-5">
      <div className="flex items-center justify-between pb-3 border-b border-slate-800">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
            <Lock className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-white">Join One-Time Video Call</h2>
            <p className="text-xs text-slate-400">Zero-knowledge, single-use encrypted session</p>
          </div>
        </div>

        <span className="px-2 py-0.5 rounded-full bg-cyan-950/80 border border-cyan-500/40 text-cyan-400 text-[10px] font-mono">
          E2EE Active
        </span>
      </div>

      <div className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800 text-xs space-y-2">
        <div className="flex justify-between text-slate-400 font-mono">
          <span>HOST CALL NUMBER:</span>
          <span className="text-white font-bold">{maskPhoneNumber(token.phoneNumber)}</span>
        </div>
        <div className="flex justify-between text-slate-400 font-mono">
          <span>SESSION ID:</span>
          <span className="text-slate-300">{token.id.slice(0, 16)}...</span>
        </div>
        <div className="flex justify-between text-slate-400 font-mono">
          <span>SECURITY VERIFICATION:</span>
          <span className="text-base">{token.shortAuthString}</span>
        </div>
      </div>

      <form onSubmit={handleJoin} className="space-y-4">
        <div>
          <label className="block text-xs font-mono font-medium text-slate-300 mb-1.5">
            ENTER 6-DIGIT SAFETY PIN
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
              <Key className="w-4 h-4 text-cyan-400" />
            </div>
            <input
              type="text"
              maxLength={6}
              value={pinInput}
              onChange={(e) => {
                setPinInput(e.target.value.replace(/\D/g, ''));
                setError(null);
              }}
              placeholder="e.g. 842194"
              className="w-full pl-10 pr-4 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-white font-mono text-center tracking-widest text-lg font-bold focus:outline-none focus:border-cyan-500"
              required
            />
          </div>
          {error && (
            <p className="text-xs text-rose-400 mt-1.5 font-mono flex items-center gap-1">
              <AlertCircle className="w-3.5 h-3.5" />
              <span>{error}</span>
            </p>
          )}
        </div>

        <div className="p-3 rounded-lg bg-slate-950/40 border border-slate-800/80 text-[11px] text-slate-400 font-mono">
          🔥 <strong className="text-amber-400">Notice:</strong> Entering the PIN will burn this
          link. If you disconnect, this URL cannot be reused.
        </div>

        <button
          type="submit"
          className="w-full py-3 px-4 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold rounded-xl text-sm shadow-lg shadow-emerald-950/40 flex items-center justify-center gap-2 cursor-pointer transition-all"
        >
          <span>Join Encrypted Video Call</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </form>
    </div>
  );
};
