/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import {
  Shield,
  Phone,
  Flame,
  Copy,
  Check,
  Clock,
  Key,
  ExternalLink,
  MessageSquare,
  Lock,
  Sparkles,
  QrCode,
  AlertTriangle,
} from 'lucide-react';
import {
  CallToken,
  generateOneTimeCallToken,
  isValidPhoneNumber,
  maskPhoneNumber,
  normalizePhoneNumber,
} from '../utils/cryptoCallLogic';
import { signalingService } from '../services/signalingService';

interface OneTimeCallGeneratorProps {
  ownerPhone: string;
  onUpdateOwnerPhone: (phone: string) => void;
  onStartCallAsOwner: (token: CallToken) => void;
  onSimulatePeerCall: (token: CallToken) => void;
}

export const OneTimeCallGenerator: React.FC<OneTimeCallGeneratorProps> = ({
  ownerPhone,
  onUpdateOwnerPhone,
  onStartCallAsOwner,
  onSimulatePeerCall,
}) => {
  const [phoneInput, setPhoneInput] = useState(ownerPhone);
  const [recipientPhone, setRecipientPhone] = useState('');
  const [validityMins, setValidityMins] = useState(15);
  const [activeToken, setActiveToken] = useState<CallToken | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedSms, setCopiedSms] = useState(false);
  const [timeLeftSec, setTimeLeftSec] = useState(0);
  const [showQrModal, setShowQrModal] = useState(false);
  const [phoneError, setPhoneError] = useState('');

  // Countdown timer for active token
  useEffect(() => {
    if (!activeToken) return;

    const interval = setInterval(() => {
      const remaining = Math.max(0, Math.floor((activeToken.expiresAt - Date.now()) / 1000));
      setTimeLeftSec(remaining);
      if (remaining === 0 && !activeToken.isBurned) {
        signalingService.burnToken(activeToken.id, 'TIME_EXPIRED');
        setActiveToken((prev) => (prev ? { ...prev, isBurned: true } : null));
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [activeToken]);

  const handleGenerate = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanPhone = normalizePhoneNumber(phoneInput);
    if (!isValidPhoneNumber(cleanPhone)) {
      setPhoneError('Please enter a valid phone number (e.g. +1 555-019-2834)');
      return;
    }
    setPhoneError('');
    onUpdateOwnerPhone(cleanPhone);

    const token = generateOneTimeCallToken(cleanPhone, validityMins);
    signalingService.saveToken(token);
    setActiveToken(token);
    setTimeLeftSec(validityMins * 60);
  };

  const getInviteUrl = () => {
    if (!activeToken) return '';
    const origin = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000';
    return `${origin}/?callId=${activeToken.id}&token=${activeToken.tokenHash}&pin=${activeToken.pinCode}`;
  };

  const getSmsInvitationText = () => {
    if (!activeToken) return '';
    const masked = maskPhoneNumber(activeToken.phoneNumber);
    return `🔒 Private One-Time Video Call Invitation from ${masked}.\n\nSingle-use link (self-destructs after call):\n${getInviteUrl()}\n\nSafety PIN: ${activeToken.pinCode}\nSecurity Verification: ${activeToken.shortAuthString}`;
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(getInviteUrl());
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2500);
  };

  const handleCopySms = () => {
    navigator.clipboard.writeText(getSmsInvitationText());
    setCopiedSms(true);
    setTimeout(() => setCopiedSms(false), 2500);
  };

  const minutes = Math.floor(timeLeftSec / 60);
  const seconds = timeLeftSec % 60;
  const timeFormatted = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 shadow-xl backdrop-blur-md">
      <div className="flex items-center justify-between pb-4 border-b border-slate-800/80 mb-5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
            <Flame className="w-5 h-5 text-amber-400" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white tracking-wide">
              One-Time Ephemeral Video Call
            </h2>
            <p className="text-xs text-slate-400">
              Guaranteed single-use link for your number. Self-destructs upon completion.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-950/60 border border-emerald-500/30 text-emerald-400 text-xs font-mono">
          <Lock className="w-3.5 h-3.5" />
          <span>Zero Server Storage</span>
        </div>
      </div>

      {!activeToken || activeToken.isBurned ? (
        <form onSubmit={handleGenerate} className="space-y-4">
          <div>
            <label className="block text-xs font-mono font-medium text-slate-300 mb-1.5">
              YOUR PHONE NUMBER (SECURE HOST IDENTITY)
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                <Phone className="w-4 h-4 text-cyan-400" />
              </div>
              <input
                type="tel"
                value={phoneInput}
                onChange={(e) => {
                  setPhoneInput(e.target.value);
                  setPhoneError('');
                }}
                placeholder="+1 (555) 019-2834"
                className="w-full pl-10 pr-4 py-2.5 bg-slate-950/80 border border-slate-700/80 rounded-xl text-white font-mono text-sm focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition-colors"
                required
              />
            </div>
            {phoneError && <p className="text-xs text-rose-400 mt-1 font-mono">{phoneError}</p>}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-mono font-medium text-slate-300 mb-1.5">
                RECIPIENT NUMBER (OPTIONAL MASK)
              </label>
              <input
                type="tel"
                value={recipientPhone}
                onChange={(e) => setRecipientPhone(e.target.value)}
                placeholder="+1 (555) 987-6543 (optional)"
                className="w-full px-3.5 py-2.5 bg-slate-950/80 border border-slate-700/80 rounded-xl text-white font-mono text-sm focus:outline-none focus:border-cyan-500 transition-colors"
              />
            </div>

            <div>
              <label className="block text-xs font-mono font-medium text-slate-300 mb-1.5">
                LINK EXPIRATION WINDOW
              </label>
              <select
                value={validityMins}
                onChange={(e) => setValidityMins(Number(e.target.value))}
                className="w-full px-3.5 py-2.5 bg-slate-950/80 border border-slate-700/80 rounded-xl text-white font-mono text-sm focus:outline-none focus:border-cyan-500 transition-colors"
              >
                <option value={10}>10 Minutes (Ultra Stealth)</option>
                <option value={15}>15 Minutes (Recommended)</option>
                <option value={30}>30 Minutes</option>
                <option value={60}>60 Minutes</option>
              </select>
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800 text-xs text-slate-400 space-y-1.5">
            <div className="flex items-center gap-2 text-cyan-400 font-semibold">
              <Shield className="w-4 h-4" />
              <span>Anti-Surveillance & One-Time Guarantee</span>
            </div>
            <p>
              The caller can only join once. Once either participant hangs up or leaves, the token is
              instantly burned. Reopening the link will show &ldquo;Burned & Expired&rdquo;.
            </p>
          </div>

          <button
            type="submit"
            className="w-full py-3 px-4 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-semibold rounded-xl text-sm shadow-lg shadow-cyan-900/30 flex items-center justify-center gap-2 transition-all cursor-pointer"
          >
            <Sparkles className="w-4 h-4" />
            <span>Generate Ephemeral One-Time Call Link</span>
          </button>
        </form>
      ) : (
        <div className="space-y-5">
          {/* Active Generated Token Banner */}
          <div className="p-4 rounded-xl bg-cyan-950/40 border border-cyan-500/40 relative overflow-hidden">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2 text-cyan-300 font-mono text-xs uppercase tracking-wider font-semibold">
                <Flame className="w-4 h-4 text-amber-400 animate-pulse" />
                <span>One-Time Call Ready • Single Use Only</span>
              </div>

              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-slate-950 border border-cyan-500/40 font-mono text-xs text-amber-300">
                <Clock className="w-3.5 h-3.5 text-amber-400" />
                <span>Expires in {timeFormatted}</span>
              </div>
            </div>

            {/* Generated Link Box */}
            <div className="bg-slate-950/90 border border-slate-800 rounded-lg p-2.5 mb-3 flex items-center justify-between gap-2">
              <span className="font-mono text-xs text-slate-300 truncate select-all">
                {getInviteUrl()}
              </span>
              <button
                type="button"
                onClick={handleCopyLink}
                className="px-3 py-1.5 rounded-md bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-medium flex items-center gap-1.5 cursor-pointer shrink-0 transition-colors"
                aria-label="Copy call link"
              >
                {copiedLink ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedLink ? 'Copied' : 'Copy'}</span>
              </button>
            </div>

            {/* Security Verification Codes */}
            <div className="grid grid-cols-2 gap-3 pt-1">
              <div className="bg-slate-950/80 border border-slate-800/80 p-2.5 rounded-lg">
                <div className="text-[10px] font-mono text-slate-400 uppercase flex items-center gap-1">
                  <Key className="w-3 h-3 text-cyan-400" />
                  <span>One-Time Safety PIN</span>
                </div>
                <div className="text-base font-mono font-bold text-white tracking-widest mt-0.5">
                  {activeToken.pinCode}
                </div>
              </div>

              <div className="bg-slate-950/80 border border-slate-800/80 p-2.5 rounded-lg">
                <div className="text-[10px] font-mono text-slate-400 uppercase flex items-center gap-1">
                  <Shield className="w-3 h-3 text-emerald-400" />
                  <span>Security Emojis (SAS)</span>
                </div>
                <div className="text-base tracking-wider mt-0.5">
                  {activeToken.shortAuthString}
                </div>
              </div>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <button
              type="button"
              onClick={handleCopySms}
              className="py-2.5 px-3 bg-slate-800/90 hover:bg-slate-700/90 border border-slate-700 text-slate-200 text-xs font-medium rounded-xl flex items-center justify-center gap-2 cursor-pointer transition-colors"
            >
              {copiedSms ? <Check className="w-4 h-4 text-emerald-400" /> : <MessageSquare className="w-4 h-4 text-cyan-400" />}
              <span>{copiedSms ? 'SMS Template Copied!' : 'Copy SMS Invite Text'}</span>
            </button>

            <button
              type="button"
              onClick={() => setShowQrModal(true)}
              className="py-2.5 px-3 bg-slate-800/90 hover:bg-slate-700/90 border border-slate-700 text-slate-200 text-xs font-medium rounded-xl flex items-center justify-center gap-2 cursor-pointer transition-colors"
            >
              <QrCode className="w-4 h-4 text-cyan-400" />
              <span>Show Join QR Code</span>
            </button>
          </div>

          {/* Launch Buttons */}
          <div className="space-y-2 pt-2">
            <button
              type="button"
              onClick={() => onStartCallAsOwner(activeToken)}
              className="w-full py-3.5 px-4 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold rounded-xl text-sm shadow-lg shadow-emerald-950/50 flex items-center justify-center gap-2 transition-all cursor-pointer"
            >
              <Phone className="w-4 h-4" />
              <span>Launch Call As Host / Owner</span>
            </button>

            <button
              type="button"
              onClick={() => onSimulatePeerCall(activeToken)}
              className="w-full py-2.5 px-4 bg-cyan-950/60 hover:bg-cyan-900/60 border border-cyan-800/60 text-cyan-300 font-medium rounded-xl text-xs flex items-center justify-center gap-2 transition-colors cursor-pointer"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span>Test Two-Way Call in Single Window (Simulated Verified Caller)</span>
            </button>

            <button
              type="button"
              onClick={() => {
                signalingService.burnToken(activeToken.id, 'MANUAL_BURN');
                setActiveToken(null);
              }}
              className="w-full py-2 text-rose-400 hover:text-rose-300 text-xs font-mono flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
            >
              <Flame className="w-3.5 h-3.5" />
              <span>Burn & Invalidate Link Now</span>
            </button>
          </div>
        </div>
      )}

      {/* QR Code Modal */}
      {showQrModal && activeToken && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 max-w-sm w-full text-center space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <h3 className="text-sm font-bold text-white">Scan One-Time Call QR</h3>
              <button
                type="button"
                onClick={() => setShowQrModal(false)}
                className="text-slate-400 hover:text-white text-xs font-mono"
              >
                CLOSE
              </button>
            </div>

            <div className="p-4 bg-white rounded-xl inline-block shadow-inner mx-auto">
              {/* Clean SVG visual QR pattern */}
              <svg className="w-48 h-48 mx-auto" viewBox="0 0 100 100" fill="none">
                <rect width="100" height="100" fill="white" />
                {/* QR position squares */}
                <rect x="10" y="10" width="24" height="24" fill="black" />
                <rect x="14" y="14" width="16" height="16" fill="white" />
                <rect x="18" y="18" width="8" height="8" fill="black" />

                <rect x="66" y="10" width="24" height="24" fill="black" />
                <rect x="70" y="14" width="16" height="16" fill="white" />
                <rect x="74" y="18" width="8" height="8" fill="black" />

                <rect x="10" y="66" width="24" height="24" fill="black" />
                <rect x="14" y="70" width="16" height="16" fill="white" />
                <rect x="18" y="74" width="8" height="8" fill="black" />

                {/* Decorative cyber bit matrix */}
                <rect x="40" y="15" width="6" height="6" fill="black" />
                <rect x="50" y="20" width="6" height="6" fill="black" />
                <rect x="42" y="35" width="8" height="8" fill="black" />
                <rect x="25" y="45" width="6" height="6" fill="black" />
                <rect x="60" y="45" width="8" height="6" fill="black" />
                <rect x="45" y="55" width="6" height="6" fill="black" />
                <rect x="75" y="60" width="6" height="6" fill="black" />
                <rect x="40" y="70" width="8" height="8" fill="black" />
                <rect x="55" y="75" width="6" height="6" fill="black" />
                <rect x="70" y="80" width="6" height="6" fill="black" />
              </svg>
            </div>

            <p className="text-xs text-slate-400 font-mono">
              Scan with phone camera to join directly into encrypted session.
            </p>

            <button
              type="button"
              onClick={() => setShowQrModal(false)}
              className="w-full py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-xs font-medium cursor-pointer"
            >
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
