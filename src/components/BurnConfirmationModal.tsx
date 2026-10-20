/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Flame, CheckCircle, ShieldAlert, ArrowLeft, RefreshCw } from 'lucide-react';
import { CallToken, formatCallDuration } from '../utils/cryptoCallLogic';

interface BurnConfirmationModalProps {
  token: CallToken | null;
  callDuration: number;
  reason?: string;
  onResetToHome: () => void;
  onViewVault?: () => void;
  hasRecordings?: boolean;
}

export const BurnConfirmationModal: React.FC<BurnConfirmationModalProps> = ({
  token,
  callDuration,
  reason = 'CALL_TERMINATED_AND_BURNED',
  onResetToHome,
  onViewVault,
  hasRecordings = false,
}) => {
  return (
    <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 text-center space-y-5 shadow-2xl relative overflow-hidden">
        {/* Flame effect glow */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-48 h-20 bg-rose-500/20 blur-3xl pointer-events-none" />

        <div className="w-14 h-14 rounded-2xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-400 mx-auto">
          <Flame className="w-7 h-7 text-amber-500 animate-pulse" />
        </div>

        <div>
          <h2 className="text-xl font-bold text-white tracking-wide">
            One-Time Call Burned & Shredded
          </h2>
          <p className="text-xs text-rose-400 font-mono mt-1">
            STATUS: PERMANENTLY INVALIDATED
          </p>
        </div>

        <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 text-left text-xs space-y-2 font-mono">
          <div className="flex justify-between text-slate-400">
            <span>Call Duration:</span>
            <span className="text-white font-bold">{formatCallDuration(callDuration)}</span>
          </div>
          <div className="flex justify-between text-slate-400">
            <span>Token Identifier:</span>
            <span className="text-slate-200 truncate max-w-[160px]">
              {token ? token.id : 'ephemeral-session'}
            </span>
          </div>
          <div className="flex justify-between text-slate-400">
            <span>Burn Timestamp:</span>
            <span className="text-slate-200">{new Date().toLocaleTimeString()}</span>
          </div>
          <div className="flex justify-between text-slate-400">
            <span>WebRTC Cryptographic State:</span>
            <span className="text-emerald-400">Keys Zeroed</span>
          </div>
        </div>

        <div className="text-xs text-slate-400 leading-relaxed text-left bg-slate-950/40 p-3 rounded-lg border border-slate-800/80">
          <div className="flex items-center gap-1.5 text-amber-400 font-medium mb-1">
            <ShieldAlert className="w-4 h-4" />
            <span>Single-Use Policy Enforced</span>
          </div>
          Anyone clicking this invite URL now will be informed that the call has concluded and the link
          has self-destructed. No media traces or chat histories persist on any server.
        </div>

        <div className="space-y-2 pt-2">
          {hasRecordings && onViewVault && (
            <button
              type="button"
              onClick={onViewVault}
              className="w-full py-2.5 px-4 bg-cyan-600 hover:bg-cyan-500 text-white font-medium rounded-xl text-xs transition-colors cursor-pointer"
            >
              Open Client-Side Recording Vault
            </button>
          )}

          <button
            type="button"
            onClick={onResetToHome}
            className="w-full py-3 px-4 bg-slate-800 hover:bg-slate-700 text-white font-medium rounded-xl text-sm transition-colors cursor-pointer flex items-center justify-center gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Return to Dashboard</span>
          </button>
        </div>
      </div>
    </div>
  );
};
