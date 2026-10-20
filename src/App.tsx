/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Navbar } from './components/Navbar';
import { OneTimeCallGenerator } from './components/OneTimeCallGenerator';
import { VideoCallRoom } from './components/VideoCallRoom';
import { GuestJoinScreen } from './components/GuestJoinScreen';
import { ThreeSecurityEnclave } from './components/ThreeSecurityEnclave';
import { RecordingVaultModal, SavedRecording } from './components/RecordingVaultModal';
import { BurnConfirmationModal } from './components/BurnConfirmationModal';
import { SecurityInfoModal } from './components/SecurityInfoModal';
import {
  CallToken,
  generateOneTimeCallToken,
  normalizePhoneNumber,
} from './utils/cryptoCallLogic';
import { signalingService } from './services/signalingService';
import {
  Shield,
  Phone,
  Flame,
  Film,
  Lock,
  Layers,
  Sparkles,
  UserCheck,
  Smartphone,
  ExternalLink,
  ChevronRight,
  ShieldAlert,
} from 'lucide-react';

export default function App() {
  // App state
  const [ownerPhone, setOwnerPhone] = useState('+1 (555) 019-2834');
  const [activeCallToken, setActiveCallToken] = useState<CallToken | null>(null);
  const [callRole, setCallRole] = useState<'owner' | 'guest'>('owner');
  const [isCallActive, setIsCallActive] = useState(false);
  const [isSimulatedPeer, setIsSimulatedPeer] = useState(false);
  const [show3DEnclave, setShow3DEnclave] = useState(true);

  // Modals
  const [showVaultModal, setShowVaultModal] = useState(false);
  const [showInfoModal, setShowInfoModal] = useState(false);
  const [showBurnModal, setShowBurnModal] = useState(false);
  const [lastCallDuration, setLastCallDuration] = useState(0);
  const [tokenInvalidReason, setTokenInvalidReason] = useState<string | null>(null);

  // Client-Side Saved Recordings
  const [savedRecordings, setSavedRecordings] = useState<SavedRecording[]>([]);

  // Check URL parameters for guest invite link on initial load
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const params = new URLSearchParams(window.location.search);
    const callId = params.get('callId');
    const tokenHash = params.get('token');
    const pin = params.get('pin');
    const autostart = params.get('autostart');

    if (callId) {
      // Check if burned
      if (signalingService.isTokenBurned(callId)) {
        setTokenInvalidReason('This one-time call link has already been used and burned.');
        return;
      }

      const existingToken = signalingService.getTokenById(callId);
      if (existingToken) {
        if (existingToken.isBurned) {
          setTokenInvalidReason('This single-use link has already expired or been burned.');
        } else {
          setActiveCallToken(existingToken);
          setCallRole('guest');
        }
      } else {
        // Construct token representation from invite URL
        const mockToken: CallToken = {
          id: callId,
          phoneNumber: ownerPhone,
          tokenHash: tokenHash || 'token_ephemeral',
          pinCode: pin || '842194',
          createdAt: Date.now(),
          expiresAt: Date.now() + 15 * 60 * 1000,
          isBurned: false,
          usageCount: 0,
          maxUsage: 1,
          shortAuthString: '🛡️ ⚡ 🗝️ 💎',
          securityEmojis: ['🛡️', '⚡', '🗝️', '💎'],
        };
        setActiveCallToken(mockToken);
        setCallRole('guest');
      }
    } else if (autostart === '1') {
      // Testability autostart query param
      const testToken = generateOneTimeCallToken(ownerPhone, 15);
      signalingService.saveToken(testToken);
      setActiveCallToken(testToken);
      setCallRole('owner');
      setIsSimulatedPeer(true);
      setIsCallActive(true);
    }
  }, []);

  // Handlers for call flows
  const handleStartCallAsOwner = (token: CallToken) => {
    setActiveCallToken(token);
    setCallRole('owner');
    setIsSimulatedPeer(false);
    setIsCallActive(true);
  };

  const handleSimulatePeerCall = (token: CallToken) => {
    setActiveCallToken(token);
    setCallRole('owner');
    setIsSimulatedPeer(true);
    setIsCallActive(true);
  };

  const handleGuestJoinSuccess = (updatedToken: CallToken) => {
    setActiveCallToken(updatedToken);
    setCallRole('guest');
    setIsSimulatedPeer(false);
    setIsCallActive(true);
  };

  const handleCallEnded = (duration: number) => {
    setLastCallDuration(duration);
    setIsCallActive(false);
    setShowBurnModal(true);
    // Remove query params from address bar without reload
    if (typeof window !== 'undefined' && window.history) {
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  };

  const handleSaveRecording = (recording: SavedRecording) => {
    setSavedRecordings((prev) => [recording, ...prev]);
  };

  const handleDeleteRecording = (id: string) => {
    setSavedRecordings((prev) => prev.filter((r) => r.id !== id));
  };

  const handleClearAllRecordings = () => {
    setSavedRecordings([]);
  };

  const handleResetToHome = () => {
    setShowBurnModal(false);
    setActiveCallToken(null);
    setTokenInvalidReason(null);
    setCallRole('owner');
    setIsCallActive(false);
    setIsSimulatedPeer(false);
  };

  return (
    <div className="min-h-screen bg-[#070b14] text-slate-100 flex flex-col font-sans selection:bg-cyan-500 selection:text-white">
      {/* Top Navigation */}
      <Navbar
        ownerPhone={ownerPhone}
        recordingsCount={savedRecordings.length}
        onOpenVault={() => setShowVaultModal(true)}
        show3DEnclave={show3DEnclave}
        onToggle3DEnclave={() => setShow3DEnclave((prev) => !prev)}
        isInCall={isCallActive}
        onOpenInfoModal={() => setShowInfoModal(true)}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 flex flex-col gap-6">
        {/* Invalid / Burned Token Notice */}
        {tokenInvalidReason && (
          <div className="p-4 rounded-2xl bg-rose-950/70 border border-rose-500/60 flex items-center justify-between gap-4 text-xs font-mono shadow-xl">
            <div className="flex items-center gap-3 text-rose-300">
              <Flame className="w-5 h-5 text-amber-500 shrink-0 animate-pulse" />
              <div>
                <p className="font-bold text-white uppercase">One-Time Call Expired or Burned</p>
                <p>{tokenInvalidReason}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={handleResetToHome}
              className="px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-700 cursor-pointer shrink-0"
            >
              Back to Home
            </button>
          </div>
        )}

        {/* ACTIVE CALL VIEWPORT */}
        {isCallActive && activeCallToken ? (
          <div className="space-y-6">
            <VideoCallRoom
              token={activeCallToken}
              role={callRole}
              onCallEnded={handleCallEnded}
              onSaveRecording={handleSaveRecording}
              isSimulatedPeer={isSimulatedPeer}
            />

            {/* Optional 3D Cryptographic Enclave visualizer during call */}
            {show3DEnclave && (
              <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-4">
                <div className="flex items-center justify-between mb-3 text-xs font-mono text-slate-400">
                  <span className="flex items-center gap-1.5 text-cyan-400 font-semibold">
                    <Shield className="w-4 h-4" />
                    <span>3D Cryptographic Quantum Enclave (Live Channel Status)</span>
                  </span>
                  <span>Audio & P2P Reactive</span>
                </div>
                <ThreeSecurityEnclave
                  status="connected"
                  audioLevel={0.4}
                  isRecording={false}
                  securityHash={activeCallToken.id}
                />
              </div>
            )}
          </div>
        ) : (
          /* DASHBOARD & CONFIGURATION VIEWPORT */
          <div className="space-y-6">
            {/* Guest Join Flow (if opened via invite link) */}
            {callRole === 'guest' ? (
              <GuestJoinScreen
                token={activeCallToken}
                onJoinSuccess={handleGuestJoinSuccess}
                onTokenInvalid={(reason) => setTokenInvalidReason(reason)}
              />
            ) : (
              /* Owner Host Hub */
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                {/* Left Column: One-Time Call Generator (7 cols) */}
                <div className="lg:col-span-7 space-y-6">
                  {/* Hero Introduction Card */}
                  <div className="relative overflow-hidden p-6 rounded-2xl bg-gradient-to-br from-slate-900 via-slate-900/95 to-slate-950 border border-slate-800/90 shadow-xl">
                    <div className="absolute top-0 right-0 w-64 h-64 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />

                    <div className="relative space-y-3">
                      <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-950/70 border border-cyan-500/40 text-cyan-300 text-xs font-mono">
                        <Sparkles className="w-3.5 h-3.5" />
                        <span>High-Assurance Privacy Protocol</span>
                      </div>

                      <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
                        One-Time Video Calls <br />
                        <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-sky-300 to-blue-500">
                          Stealth Local Recording Only
                        </span>
                      </h2>

                      <p className="text-xs sm:text-sm text-slate-400 leading-relaxed max-w-xl">
                        Generate a secure, single-use video call link linked to your verified number.
                        Once the call ends, the session burns forever. Activate local recording on your
                        side with <strong>0 remote leaks</strong> — no peer notification, zero cloud
                        upload.
                      </p>

                      <div className="grid grid-cols-3 gap-3 pt-2 text-xs font-mono">
                        <div className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800">
                          <Flame className="w-4 h-4 text-amber-400 mb-1" />
                          <div className="text-white font-bold">1-Time Burn</div>
                          <div className="text-[10px] text-slate-500">Self-destructs</div>
                        </div>
                        <div className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800">
                          <Lock className="w-4 h-4 text-emerald-400 mb-1" />
                          <div className="text-white font-bold">DTLS-SRTP</div>
                          <div className="text-[10px] text-slate-500">Direct P2P E2EE</div>
                        </div>
                        <div className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800">
                          <Film className="w-4 h-4 text-rose-400 mb-1" />
                          <div className="text-white font-bold">My Side Only</div>
                          <div className="text-[10px] text-slate-500">Stealth capture</div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* One-Time Generator Box */}
                  <OneTimeCallGenerator
                    ownerPhone={ownerPhone}
                    onUpdateOwnerPhone={(phone) => setOwnerPhone(phone)}
                    onStartCallAsOwner={handleStartCallAsOwner}
                    onSimulatePeerCall={handleSimulatePeerCall}
                  />
                </div>

                {/* Right Column: Three.js 3D Cryptographic Enclave (5 cols) */}
                <div className="lg:col-span-5 space-y-4">
                  {show3DEnclave ? (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between text-xs font-mono text-slate-400 px-1">
                        <span className="flex items-center gap-1.5 text-cyan-400 font-semibold">
                          <Shield className="w-4 h-4" />
                          <span>3D Cryptographic Enclave</span>
                        </span>
                        <span>Studio PBR Render</span>
                      </div>

                      <ThreeSecurityEnclave
                        status="idle"
                        audioLevel={0.05}
                        isRecording={false}
                        securityHash="SHA256:ENCLAVE:READY"
                      />

                      {/* Hardware / Cryptographic Feature Specs */}
                      <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 text-xs space-y-2.5 font-mono">
                        <div className="text-slate-300 font-bold flex items-center gap-2">
                          <Lock className="w-3.5 h-3.5 text-cyan-400" />
                          <span>ENCLAVE SECURITY SPECIFICATIONS</span>
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-400">
                          <div>
                            <span className="text-slate-500 block">KEY EXCHANGE:</span>
                            <span className="text-slate-200">ECDH P-256 Curve</span>
                          </div>
                          <div>
                            <span className="text-slate-500 block">CIPHER SUITE:</span>
                            <span className="text-slate-200">AES-128-GCM</span>
                          </div>
                          <div>
                            <span className="text-slate-500 block">RECORDING SINK:</span>
                            <span className="text-emerald-400">Client Memory Only</span>
                          </div>
                          <div>
                            <span className="text-slate-500 block">PEER ALERT:</span>
                            <span className="text-rose-400">Disabled (Stealth)</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="p-8 rounded-2xl bg-slate-900/40 border border-slate-800 text-center space-y-3">
                      <Shield className="w-8 h-8 text-slate-600 mx-auto" />
                      <p className="text-xs text-slate-400 font-mono">3D Security Enclave is Hidden</p>
                      <button
                        type="button"
                        onClick={() => setShow3DEnclave(true)}
                        className="px-3 py-1.5 rounded-lg bg-cyan-950 border border-cyan-800 text-cyan-300 text-xs font-mono"
                      >
                        Enable 3D Visualizer
                      </button>
                    </div>
                  )}

                  {/* Mode Switching Helper for Testing */}
                  <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800/80 text-xs space-y-3">
                    <div className="flex items-center justify-between text-slate-300 font-medium">
                      <span>Test as Caller / Guest:</span>
                      <span className="text-[10px] font-mono text-cyan-400">DUAL ROLE READY</span>
                    </div>
                    <p className="text-[11px] text-slate-400 leading-normal">
                      Need to join an invitation with a PIN? Switch to Guest mode directly:
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        const sampleToken = generateOneTimeCallToken(ownerPhone, 15);
                        setActiveCallToken(sampleToken);
                        setCallRole('guest');
                      }}
                      className="w-full py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl font-mono text-xs flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
                    >
                      <Smartphone className="w-3.5 h-3.5 text-cyan-400" />
                      <span>Switch View to Guest Pin Entry</span>
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </main>

      {/* FOOTER */}
      <footer className="w-full border-t border-slate-800/80 py-4 px-6 text-center text-xs font-mono text-slate-500 flex flex-col sm:flex-row items-center justify-between max-w-7xl mx-auto gap-2">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-400" />
          <span>CipherCall • Ephemeral One-Time E2EE Video Protocol</span>
        </div>
        <div className="flex items-center gap-4 text-[11px]">
          <span>Zero Server Logs</span>
          <span>•</span>
          <span>Client-Only MediaRecorder</span>
          <span>•</span>
          <span>Three.js PBR Studio Core</span>
        </div>
      </footer>

      {/* MODALS */}
      {showVaultModal && (
        <RecordingVaultModal
          recordings={savedRecordings}
          onClose={() => setShowVaultModal(false)}
          onDeleteRecording={handleDeleteRecording}
          onClearAll={handleClearAllRecordings}
        />
      )}

      {showBurnModal && (
        <BurnConfirmationModal
          token={activeCallToken}
          callDuration={lastCallDuration}
          onResetToHome={handleResetToHome}
          onViewVault={() => {
            setShowBurnModal(false);
            setShowVaultModal(true);
          }}
          hasRecordings={savedRecordings.length > 0}
        />
      )}

      {showInfoModal && (
        <SecurityInfoModal onClose={() => setShowInfoModal(false)} />
      )}
    </div>
  );
}
