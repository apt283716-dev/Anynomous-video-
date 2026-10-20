/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import {
  Shield,
  Phone,
  Film,
  Box,
  Flame,
  Lock,
  Layers,
  Sparkles,
  Info,
} from 'lucide-react';
import { maskPhoneNumber } from '../utils/cryptoCallLogic';

interface NavbarProps {
  ownerPhone: string;
  recordingsCount: number;
  onOpenVault: () => void;
  show3DEnclave: boolean;
  onToggle3DEnclave: () => void;
  isInCall: boolean;
  onOpenInfoModal?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  ownerPhone,
  recordingsCount,
  onOpenVault,
  show3DEnclave,
  onToggle3DEnclave,
  isInCall,
  onOpenInfoModal,
}) => {
  return (
    <header className="w-full bg-slate-950/80 border-b border-slate-800/80 sticky top-0 z-40 backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
        {/* Brand */}
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-cyan-600 to-blue-600 flex items-center justify-center text-white shadow-lg shadow-cyan-950/50">
            <Shield className="w-5 h-5 text-cyan-200" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base font-extrabold text-white tracking-wider flex items-center gap-1.5 font-mono">
                <span>CIPHERCALL</span>
              </h1>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-cyan-950 border border-cyan-500/40 text-cyan-400 font-mono">
                E2EE • EPHEMERAL
              </span>
            </div>
            <p className="text-[10px] text-slate-400 font-mono hidden sm:block">
              Single-Use Video Calling • Private Local-Only Recording
            </p>
          </div>
        </div>

        {/* Right Actions */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Owner Number Display */}
          <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-xs font-mono text-slate-300">
            <Phone className="w-3.5 h-3.5 text-cyan-400" />
            <span className="text-slate-400">Host Number:</span>
            <span className="text-white font-bold">{maskPhoneNumber(ownerPhone)}</span>
          </div>

          {/* 3D Enclave Viewport Toggle */}
          <button
            type="button"
            onClick={onToggle3DEnclave}
            className={`px-3 py-1.5 rounded-xl border text-xs font-mono flex items-center gap-1.5 transition-colors cursor-pointer ${
              show3DEnclave
                ? 'bg-cyan-950/60 border-cyan-500/50 text-cyan-300'
                : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
            }`}
            title="Toggle 3D Holographic Cryptographic Enclave"
          >
            <Box className="w-3.5 h-3.5 text-cyan-400" />
            <span className="hidden sm:inline">3D Shield</span>
          </button>

          {/* Recording Vault Button */}
          <button
            type="button"
            onClick={onOpenVault}
            className="relative px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-xs font-mono text-slate-200 flex items-center gap-1.5 transition-colors cursor-pointer"
            title="Open Private Client-Side Recording Vault"
            aria-label="Open recording vault"
          >
            <Film className="w-3.5 h-3.5 text-rose-400" />
            <span>Vault</span>
            {recordingsCount > 0 && (
              <span className="px-1.5 py-0.2 rounded-full bg-rose-600 text-[10px] text-white font-bold">
                {recordingsCount}
              </span>
            )}
          </button>

          {onOpenInfoModal && (
            <button
              type="button"
              onClick={onOpenInfoModal}
              className="p-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-400 hover:text-white transition-colors cursor-pointer"
              title="Security Architecture & Guarantees"
            >
              <Info className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
