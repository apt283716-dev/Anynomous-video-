/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { X, Shield, Lock, Film, Flame, Key, Cpu, EyeOff, CheckCircle2 } from 'lucide-react';

interface SecurityInfoModalProps {
  onClose: () => void;
}

export const SecurityInfoModal: React.FC<SecurityInfoModalProps> = ({ onClose }) => {
  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-2xl w-full max-h-[85vh] overflow-y-auto p-6 space-y-6 shadow-2xl">
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">CipherCall Security Architecture</h2>
              <p className="text-xs text-slate-400 font-mono">Zero-Knowledge Ephemeral Protocol</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-4">
          {/* Pillar 1 */}
          <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-800 space-y-2">
            <div className="flex items-center gap-2 text-cyan-400 font-bold text-sm">
              <Flame className="w-4 h-4 text-amber-400" />
              <span>1. One-Time Ephemeral Call for Your Number</span>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              Every link generated is cryptographically bound to your phone number and valid for a single session.
              Once joined or ended, the token is permanently burned. Reopening or bookmarking the link will result in
              an immediate &ldquo;Link Burned & Expired&rdquo; notice.
            </p>
            <div className="flex items-center gap-2 text-[11px] text-emerald-400 font-mono">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Single-use guarantee with 6-digit random PIN protection</span>
            </div>
          </div>

          {/* Pillar 2 */}
          <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-800 space-y-2">
            <div className="flex items-center gap-2 text-emerald-400 font-bold text-sm">
              <Lock className="w-4 h-4 text-emerald-400" />
              <span>2. Anti-Surveillance & E2EE (No One Sees the Call)</span>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              Video and audio frames travel directly between devices via WebRTC DTLS 1.3 / SRTP peer-to-peer encryption.
              No central server receives, buffers, or stores video packets. Short Authentication Strings (SAS emojis)
              provide instant visual proof against man-in-the-middle attacks.
            </p>
            <div className="flex items-center gap-2 text-[11px] text-emerald-400 font-mono">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Decoy Camouflage mode allows instant blanking if someone approaches</span>
            </div>
          </div>

          {/* Pillar 3 */}
          <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-800 space-y-2">
            <div className="flex items-center gap-2 text-rose-400 font-bold text-sm">
              <Film className="w-4 h-4 text-rose-400" />
              <span>3. Private Recording (For My Side Only)</span>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              Standard calling apps notify remote participants when recording begins. CipherCall’s private recording
              engine executes purely client-side inside your browser’s canvas composition pipeline. Zero recording
              flags or signals are transmitted to the peer. The resulting WebM video is stored directly in your local
              browser buffer, ready for immediate download or DoD 5220.22-M memory shredding.
            </p>
            <div className="flex items-center gap-2 text-[11px] text-emerald-400 font-mono">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>100% stealth local capture • Zero server or peer visibility</span>
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="w-full py-2.5 bg-slate-800 hover:bg-slate-700 text-white font-medium rounded-xl text-xs cursor-pointer transition-colors"
        >
          Understood & Verified
        </button>
      </div>
    </div>
  );
};
