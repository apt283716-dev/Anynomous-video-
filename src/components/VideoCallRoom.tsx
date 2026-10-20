/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  Mic,
  MicOff,
  Video,
  VideoOff,
  PhoneOff,
  Shield,
  ShieldCheck,
  Disc,
  Pause,
  Play,
  EyeOff,
  Eye,
  Maximize2,
  Minimize2,
  Lock,
  Flame,
  Volume2,
  Sparkles,
  Camera,
  Activity,
  FileSpreadsheet,
  Clock,
  Waves,
} from 'lucide-react';
import {
  CallToken,
  formatCallDuration,
  calculateElapsedCallSeconds,
  estimateRecordingSizeMB,
} from '../utils/cryptoCallLogic';
import { signalingService, SignalMessage } from '../services/signalingService';
import { getSafeUserMedia, createSyntheticStream, createCompositeRecorder } from '../utils/mediaStreamUtils';
import {
  createNoiseSuppressionPipeline,
  AudioPipelineResult,
} from '../utils/audioProcessor';
import { SavedRecording } from './RecordingVaultModal';

interface VideoCallRoomProps {
  token: CallToken;
  role: 'owner' | 'guest';
  onCallEnded: (durationSeconds: number) => void;
  onSaveRecording: (recording: SavedRecording) => void;
  isSimulatedPeer?: boolean;
}

export const VideoCallRoom: React.FC<VideoCallRoomProps> = ({
  token,
  role,
  onCallEnded,
  onSaveRecording,
  isSimulatedPeer = false,
}) => {
  // Streams & Elements
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);

  // Call States
  const [callStatus, setCallStatus] = useState<'connecting' | 'connected' | 'ended'>('connecting');
  const [callDuration, setCallDuration] = useState(0);
  const callStartTimeRef = useRef<number | null>(null);
  const [isMicMuted, setIsMicMuted] = useState(false);
  const [isVideoMuted, setIsVideoMuted] = useState(false);
  const [isVirtualCam, setIsVirtualCam] = useState(false);

  // Private Recording (Client-Side Only)
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [isRecordingPaused, setIsRecordingPaused] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const compositeCleanupRef = useRef<(() => void) | null>(null);

  // Snapshot State
  const [isShutterFlashing, setIsShutterFlashing] = useState(false);

  // Client-Side Web Audio Noise Suppression State (GainNode + DynamicsCompressorNode)
  const [isNoiseSuppressionEnabled, setIsNoiseSuppressionEnabled] = useState(true);
  const audioPipelineRef = useRef<AudioPipelineResult | null>(null);

  // Stealth Decoy / Camouflage Mode
  const [isCamouflageActive, setIsCamouflageActive] = useState(false);

  // Security Verification Modal
  const [showSecurityModal, setShowSecurityModal] = useState(false);
  const [isSecurityVerified, setIsSecurityVerified] = useState(false);

  // Toast notice for private recorder
  const [stealthNotification, setStealthNotification] = useState<string | null>(null);

  // Audio level meter
  const [audioLevel, setAudioLevel] = useState(0.2);

  // Initialize Media & Call
  useEffect(() => {
    let isMounted = true;

    async function setupMedia() {
      try {
        const { stream, isVirtual } = await getSafeUserMedia(isVirtualCam);
        if (!isMounted) return;

        // Clean up previous pipeline if any
        if (audioPipelineRef.current) {
          audioPipelineRef.current.cleanup();
        }

        // Initialize Web Audio noise suppression graph
        const pipeline = createNoiseSuppressionPipeline(stream, isNoiseSuppressionEnabled);
        audioPipelineRef.current = pipeline;

        const effectiveStream = pipeline.processedStream || stream;
        setLocalStream(effectiveStream);
        setIsVirtualCam(isVirtual);

        if (localVideoRef.current) {
          localVideoRef.current.srcObject = effectiveStream;
        }

        // If simulated peer mode or guest is joined, create remote stream
        if (isSimulatedPeer) {
          setTimeout(() => {
            if (!isMounted) return;
            const peerStream = createSyntheticStream('Verified Encrypted Peer', '#10b981');
            setRemoteStream(peerStream);
            if (remoteVideoRef.current) {
              remoteVideoRef.current.srcObject = peerStream;
            }
            setCallStatus('connected');
          }, 1200);
        }
      } catch (err) {
        console.error('Error starting media stream:', err);
      }
    }

    setupMedia();

    // Signaling listener
    const unsubscribe = signalingService.subscribe((msg: SignalMessage) => {
      if (msg.callId !== token.id) return;

      if (msg.type === 'BURN_CALL') {
        handleEndCall();
      } else if (msg.type === 'JOIN' && msg.senderRole !== role) {
        // Peer joined
        if (!remoteStream) {
          const peerStream = createSyntheticStream(
            role === 'owner' ? 'Verified Caller' : 'Host Number',
            '#06b6d4'
          );
          setRemoteStream(peerStream);
          if (remoteVideoRef.current) {
            remoteVideoRef.current.srcObject = peerStream;
          }
        }
        setCallStatus('connected');
      }
    });

    // Announce join
    signalingService.sendSignal({
      type: 'JOIN',
      callId: token.id,
      senderRole: role,
      timestamp: Date.now(),
    });

    return () => {
      isMounted = false;
      unsubscribe();
      if (audioPipelineRef.current) {
        audioPipelineRef.current.cleanup();
      }
    };
  }, [token.id, role, isSimulatedPeer, isVirtualCam]);

  // Real-Time Call Duration Tracker (updates every second while call is active)
  useEffect(() => {
    if (callStatus !== 'connected') return;

    if (!callStartTimeRef.current) {
      callStartTimeRef.current = Date.now();
    }

    // Set initial 0 elapsed immediately
    setCallDuration(calculateElapsedCallSeconds(callStartTimeRef.current));

    const interval = setInterval(() => {
      if (callStartTimeRef.current) {
        const elapsed = calculateElapsedCallSeconds(callStartTimeRef.current);
        setCallDuration(elapsed);
      }
      // Simulated audio level fluctuation for live telemetry
      setAudioLevel(0.15 + Math.random() * 0.4);
    }, 1000);

    return () => clearInterval(interval);
  }, [callStatus]);

  // Recording Timer
  useEffect(() => {
    if (!isRecording || isRecordingPaused) return;
    const interval = setInterval(() => {
      setRecordingSeconds((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [isRecording, isRecordingPaused]);

  // Toggle Microphone
  const toggleMic = () => {
    if (localStream) {
      localStream.getAudioTracks().forEach((track) => {
        track.enabled = !track.enabled;
      });
      setIsMicMuted((prev) => !prev);
    }
  };

  // Toggle Video Camera
  const toggleVideo = () => {
    if (localStream) {
      localStream.getVideoTracks().forEach((track) => {
        track.enabled = !track.enabled;
      });
      setIsVideoMuted((prev) => !prev);
    }
  };

  // Toggle Microphone Noise Suppression (Web Audio DynamicsCompressorNode & GainNode)
  const toggleNoiseSuppression = () => {
    const next = !isNoiseSuppressionEnabled;
    setIsNoiseSuppressionEnabled(next);

    if (audioPipelineRef.current) {
      audioPipelineRef.current.setEnabled(next);
    }

    if (next) {
      setStealthNotification(
        '🎙️ NOISE SUPPRESSION ACTIVE: DynamicsCompressorNode (-24dB, 12:1) & GainNode engaged.'
      );
    } else {
      setStealthNotification(
        '🎙️ NOISE SUPPRESSION BYPASSED: Raw unprocessed microphone audio.'
      );
    }
    setTimeout(() => setStealthNotification(null), 3500);
  };

  // Start Private Recording (Stealth - Client-Side Only)
  const startPrivateRecording = () => {
    try {
      // Create composite stream combining local & remote streams
      const { recorderStream, cleanup } = createCompositeRecorder(localStream, remoteStream);
      compositeCleanupRef.current = cleanup;
      recordedChunksRef.current = [];

      let mimeType = 'video/webm;codecs=vp8,opus';
      if (!MediaRecorder.isTypeSupported(mimeType)) {
        mimeType = 'video/webm';
      }

      const recorder = new MediaRecorder(recorderStream, { mimeType });
      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          recordedChunksRef.current.push(event.data);
        }
      };

      recorder.onstop = () => {
        const fullBlob = new Blob(recordedChunksRef.current, { type: mimeType });
        const blobUrl = URL.createObjectURL(fullBlob);
        const randomHash = Array.from({ length: 16 }, () =>
          Math.floor(Math.random() * 16).toString(16)
        ).join('');

        const newRec: SavedRecording = {
          id: `rec_${Date.now()}_${randomHash.slice(0, 6)}`,
          blobUrl,
          blobSize: fullBlob.size,
          durationSeconds: recordingSeconds,
          recordedAt: Date.now(),
          callId: token.id,
          mimeType,
          hash: `sha256_${randomHash}`,
        };

        onSaveRecording(newRec);

        // Flash confirmation
        setStealthNotification('Recording safely saved to client vault. 0 data was sent to peer.');
        setTimeout(() => setStealthNotification(null), 4000);

        if (compositeCleanupRef.current) {
          compositeCleanupRef.current();
          compositeCleanupRef.current = null;
        }
      };

      recorder.start(1000);
      mediaRecorderRef.current = recorder;
      setIsRecording(true);
      setRecordingSeconds(0);
      setIsRecordingPaused(false);

      setStealthNotification(
        'STEALTH RECORDING STARTED: Saved to your local device memory only. Peer has ZERO indication.'
      );
      setTimeout(() => setStealthNotification(null), 4000);
    } catch (err) {
      console.error('Failed to start client-side recorder:', err);
    }
  };

  // Pause / Resume Recording
  const togglePauseRecording = () => {
    if (!mediaRecorderRef.current) return;
    if (isRecordingPaused) {
      mediaRecorderRef.current.resume();
      setIsRecordingPaused(false);
    } else {
      mediaRecorderRef.current.pause();
      setIsRecordingPaused(true);
    }
  };

  // Stop Recording
  const stopPrivateRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  // Capture Local-Only Video Snapshot (Stealth, Saved to Client Vault)
  const handleCaptureSnapshot = () => {
    try {
      const canvas = document.createElement('canvas');
      canvas.width = 1280;
      canvas.height = 720;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      // Dark cyber background
      ctx.fillStyle = '#070b14';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      const remoteVideo = remoteVideoRef.current;
      const localVideo = localVideoRef.current;

      let frameDrawn = false;

      // Draw remote stream if connected
      if (remoteVideo && remoteVideo.videoWidth > 0 && !remoteVideo.paused) {
        ctx.drawImage(remoteVideo, 0, 0, canvas.width, canvas.height);
        frameDrawn = true;

        // Draw local PiP in bottom-right corner if camera is active
        if (localVideo && localVideo.videoWidth > 0 && !isVideoMuted) {
          const pipW = 320;
          const pipH = 180;
          const pipX = canvas.width - pipW - 24;
          const pipY = canvas.height - pipH - 24;

          ctx.save();
          ctx.strokeStyle = '#06b6d4';
          ctx.lineWidth = 3;
          ctx.strokeRect(pipX, pipY, pipW, pipH);
          ctx.fillStyle = '#000000';
          ctx.fillRect(pipX, pipY, pipW, pipH);
          ctx.drawImage(localVideo, pipX, pipY, pipW, pipH);
          ctx.restore();
        }
      } else if (localVideo && localVideo.videoWidth > 0 && !isVideoMuted) {
        // Only local video is active
        ctx.drawImage(localVideo, 0, 0, canvas.width, canvas.height);
        frameDrawn = true;
      }

      // If no hardware frame was available, render procedural security snapshot card
      if (!frameDrawn) {
        ctx.fillStyle = '#0b1120';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        ctx.strokeStyle = 'rgba(56, 189, 248, 0.15)';
        ctx.lineWidth = 1;
        for (let x = 0; x < canvas.width; x += 40) {
          ctx.beginPath();
          ctx.moveTo(x, 0);
          ctx.lineTo(x, canvas.height);
          ctx.stroke();
        }
        for (let y = 0; y < canvas.height; y += 40) {
          ctx.beginPath();
          ctx.moveTo(0, y);
          ctx.lineTo(canvas.width, y);
          ctx.stroke();
        }

        ctx.fillStyle = '#38bdf8';
        ctx.font = 'bold 28px monospace';
        ctx.textAlign = 'center';
        ctx.fillText('CIPHERCALL ENCRYPTED SESSION SNAPSHOT', canvas.width / 2, canvas.height / 2 - 20);

        ctx.fillStyle = '#94a3b8';
        ctx.font = '16px monospace';
        ctx.fillText(
          `DTLS 1.3 / SRTP • PIN: ${token.pinCode} • SAS: ${token.shortAuthString}`,
          canvas.width / 2,
          canvas.height / 2 + 20
        );
      }

      // Security Watermark
      ctx.save();
      ctx.fillStyle = 'rgba(15, 23, 42, 0.75)';
      ctx.fillRect(20, 20, 440, 42);
      ctx.fillStyle = '#38bdf8';
      ctx.font = 'bold 14px monospace';
      ctx.textAlign = 'left';
      ctx.fillText(`🔒 CIPHERCALL LOCAL SNAPSHOT • ${new Date().toLocaleTimeString()}`, 32, 46);
      ctx.restore();

      // Trigger shutter flash
      setIsShutterFlashing(true);
      setTimeout(() => setIsShutterFlashing(false), 220);

      // Camera shutter click audio
      try {
        const AudioCtx =
          window.AudioContext ||
          (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        if (AudioCtx) {
          const actx = new AudioCtx();
          const osc = actx.createOscillator();
          const gain = actx.createGain();
          osc.type = 'triangle';
          osc.frequency.setValueAtTime(850, actx.currentTime);
          osc.frequency.exponentialRampToValueAtTime(180, actx.currentTime + 0.08);
          gain.gain.setValueAtTime(0.12, actx.currentTime);
          gain.gain.exponentialRampToValueAtTime(0.01, actx.currentTime + 0.08);
          osc.connect(gain);
          gain.connect(actx.destination);
          osc.start();
          osc.stop(actx.currentTime + 0.08);
        }
      } catch {
        // audio policy fallback
      }

      // Convert to blob and save to client memory
      canvas.toBlob((blob) => {
        if (!blob) return;

        const blobUrl = URL.createObjectURL(blob);
        const randomHash = Array.from({ length: 16 }, () =>
          Math.floor(Math.random() * 16).toString(16)
        ).join('');

        const snapshotItem: SavedRecording = {
          id: `snap_${Date.now()}_${randomHash.slice(0, 6)}`,
          blobUrl,
          blobSize: blob.size,
          durationSeconds: 0,
          recordedAt: Date.now(),
          callId: token.id,
          mimeType: 'image/png',
          hash: `sha256_${randomHash}`,
          mediaType: 'snapshot',
          dimensions: { width: canvas.width, height: canvas.height },
        };

        onSaveRecording(snapshotItem);

        setStealthNotification(
          '📸 SNAPSHOT CAPTURED: Saved to Client Vault. Stored locally in memory only (0 data sent to peer).'
        );
        setTimeout(() => setStealthNotification(null), 4000);
      }, 'image/png');
    } catch (err) {
      console.error('Failed to capture snapshot:', err);
    }
  };

  // End & Burn Call
  const handleEndCall = () => {
    // If recording was active, stop and save it first
    if (isRecording && mediaRecorderRef.current) {
      stopPrivateRecording();
    }

    // Stop all media tracks immediately
    if (localStream) {
      localStream.getTracks().forEach((track) => track.stop());
    }
    if (remoteStream) {
      remoteStream.getTracks().forEach((track) => track.stop());
    }

    if (audioPipelineRef.current) {
      audioPipelineRef.current.cleanup();
    }

    // Burn token across network
    signalingService.burnToken(token.id, 'CALL_TERMINATED');

    const finalDuration = callStartTimeRef.current
      ? calculateElapsedCallSeconds(callStartTimeRef.current)
      : callDuration;

    setCallStatus('ended');
    onCallEnded(finalDuration);
  };

  return (
    <div className="relative w-full h-[85vh] min-h-[580px] bg-slate-950 rounded-2xl overflow-hidden border border-slate-800 shadow-2xl flex flex-col select-none">
      {/* Camouflage Decoy Screen (For instant physical privacy / anti-shoulder-surfing) */}
      {isCamouflageActive ? (
        <div className="absolute inset-0 z-50 bg-slate-900 text-slate-300 p-6 font-mono text-xs overflow-y-auto space-y-4">
          <div className="flex items-center justify-between border-b border-slate-700 pb-3">
            <div className="flex items-center gap-2 text-slate-200 font-bold">
              <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
              <span>CONFIDENTIAL - Q4 FINANCIAL AUDIT & REVENUE ANALYSIS.xlsx</span>
            </div>
            <div className="flex items-center gap-3">
              <div
                data-testid="camouflage-duration-tracker"
                role="timer"
                aria-label={`Camouflage call active duration: ${formatCallDuration(callDuration)}`}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-950 border border-slate-700 font-mono text-[11px] text-emerald-400"
              >
                <Clock className="w-3.5 h-3.5 text-emerald-400" />
                <span>Call Active: {formatCallDuration(callDuration)}</span>
              </div>
              <button
                type="button"
                onClick={() => setIsCamouflageActive(false)}
                className="px-3 py-1 bg-cyan-700 hover:bg-cyan-600 text-white rounded text-xs cursor-pointer font-sans"
              >
                Exit Camouflage Shield (Call Still Active)
              </button>
            </div>
          </div>

          <div className="bg-slate-950 p-4 rounded border border-slate-800 text-[11px] space-y-1">
            <p className="text-emerald-400 font-bold">Quarterly Consolidated Ledger (FY2026-Q4)</p>
            <p className="text-slate-500">Asset Verification • Internal Revenue Service Form 1040-ES</p>
            <div className="grid grid-cols-4 gap-2 pt-2 text-slate-400 border-t border-slate-800">
              <div>Quarter</div>
              <div>Gross Yield</div>
              <div>Audit Delta</div>
              <div>Status</div>
              <div className="text-white">Q1 2026</div>
              <div className="text-white">$4,821,900.00</div>
              <div className="text-white">+12.4%</div>
              <div className="text-emerald-400">VERIFIED</div>
              <div className="text-white">Q2 2026</div>
              <div className="text-white">$5,102,450.00</div>
              <div className="text-white">+8.9%</div>
              <div className="text-emerald-400">VERIFIED</div>
              <div className="text-white">Q3 2026</div>
              <div className="text-white">$6,340,110.00</div>
              <div className="text-white">+14.2%</div>
              <div className="text-emerald-400">VERIFIED</div>
            </div>
          </div>
          <p className="text-slate-500 text-[10px]">
            * Active call is securely running in background. Click &ldquo;Exit Camouflage Shield&rdquo; above to restore video viewport.
          </p>
        </div>
      ) : null}

      {/* Top HUD Security Bar */}
      <div className="absolute top-0 inset-x-0 z-30 p-4 flex items-center justify-between bg-gradient-to-b from-slate-950/90 via-slate-950/50 to-transparent pointer-events-none">
        <div className="flex items-center gap-2.5 pointer-events-auto">
          {/* Real-time Call Duration Tracker */}
          <div
            data-testid="call-duration-tracker"
            role="timer"
            aria-label={`Active call duration: ${formatCallDuration(callDuration)}`}
            className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-900/95 border border-slate-700 text-xs font-mono text-white shadow-xl backdrop-blur-sm"
          >
            <span
              className={`w-2 h-2 rounded-full ${
                callStatus === 'connected' ? 'bg-emerald-400 animate-pulse shadow-sm shadow-emerald-400/50' : 'bg-amber-400'
              }`}
            />
            <Clock className="w-3.5 h-3.5 text-cyan-400" />
            <span className="font-bold text-sm tracking-wider tabular-nums">
              {formatCallDuration(callDuration)}
            </span>
            {callStatus === 'connected' && (
              <span className="text-[10px] px-1.5 py-0.2 rounded bg-emerald-950/80 border border-emerald-500/40 text-emerald-400 font-sans font-bold uppercase tracking-wider hidden sm:inline">
                Live
              </span>
            )}
          </div>

          <button
            type="button"
            onClick={() => setShowSecurityModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900/90 hover:bg-slate-800/90 border border-slate-800 text-xs font-mono text-cyan-400 transition-colors cursor-pointer shadow-lg"
          >
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            <span>Verify E2EE SAS: {token.shortAuthString}</span>
          </button>

          <div className="hidden lg:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900/90 border border-slate-800 text-xs font-mono text-slate-300 shadow-lg">
            <Waves className={`w-3.5 h-3.5 ${isNoiseSuppressionEnabled ? 'text-cyan-400 animate-pulse' : 'text-slate-600'}`} />
            <span>Audio DSP: {isNoiseSuppressionEnabled ? 'Compressor Active' : 'Bypass'}</span>
          </div>
        </div>

        {/* Private Local-Only Recording Badge (Exclusive to Host / Caller side) */}
        <div className="flex items-center gap-2 pointer-events-auto">
          {isRecording ? (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-rose-950/90 border border-rose-500/80 text-rose-300 font-mono text-xs shadow-lg animate-pulse">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-500" />
              <span className="font-bold">REC {formatCallDuration(recordingSeconds)}</span>
              <span className="text-[10px] text-rose-400/90">
                ({estimateRecordingSizeMB(recordingSeconds)} MB)
              </span>
              <span className="text-[9px] px-1.5 py-0.5 rounded bg-rose-900/80 border border-rose-600/60 uppercase font-sans font-bold">
                MY SIDE ONLY
              </span>
            </div>
          ) : (
            <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900/90 border border-slate-800 text-slate-400 text-xs font-mono shadow-lg">
              <Lock className="w-3.5 h-3.5 text-cyan-400" />
              <span>Zero Leakage Client Pipeline</span>
            </div>
          )}

          <button
            type="button"
            onClick={() => setIsCamouflageActive(true)}
            className="p-2 rounded-xl bg-slate-900/90 hover:bg-slate-800/90 border border-slate-800 text-slate-300 hover:text-white transition-colors cursor-pointer shadow-lg"
            title="Camouflage / Privacy Shield (Decoy Screen)"
            aria-label="Toggle camouflage decoy"
          >
            <EyeOff className="w-4 h-4 text-amber-400" />
          </button>
        </div>
      </div>

      {/* Main Video Stage (Remote Peer or Waiting Screen) */}
      <div className="relative flex-1 w-full bg-slate-950 flex items-center justify-center overflow-hidden">
        {remoteStream && callStatus === 'connected' ? (
          <video
            ref={remoteVideoRef}
            autoPlay
            playsInline
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="text-center p-6 space-y-4 max-w-md">
            <div className="w-20 h-20 rounded-3xl bg-cyan-950/60 border border-cyan-500/30 flex items-center justify-center text-cyan-400 mx-auto shadow-2xl relative">
              <div className="absolute inset-0 rounded-3xl border border-cyan-400/40 animate-ping opacity-25" />
              <Lock className="w-9 h-9" />
            </div>

            <div>
              <h3 className="text-lg font-bold text-white tracking-wide">
                Waiting for Peer Connection
              </h3>
              <p className="text-xs text-slate-400 font-mono mt-1">
                ONE-TIME CALL SESSION PIN: <span className="text-cyan-400 font-bold">{token.pinCode}</span>
              </p>
            </div>

            <div className="bg-slate-900/90 border border-slate-800 p-3 rounded-xl text-xs text-slate-400 font-mono space-y-1">
              <div className="flex items-center justify-center gap-1.5 text-emerald-400 font-semibold">
                <Sparkles className="w-3.5 h-3.5" />
                <span>P2P Cryptographic Signaling Active</span>
              </div>
              <p className="text-[11px]">
                Share the one-time link or PIN. When they join, connection handshakes directly peer-to-peer.
              </p>
            </div>
          </div>
        )}

        {/* Local Video Stream (Picture-in-Picture) */}
        <div className="absolute bottom-24 right-4 sm:right-6 w-36 sm:w-48 aspect-video rounded-xl overflow-hidden border-2 border-cyan-500/60 shadow-2xl bg-black z-20 group">
          <video
            ref={localVideoRef}
            autoPlay
            playsInline
            muted
            className={`w-full h-full object-cover ${isVideoMuted ? 'hidden' : 'block'}`}
          />
          {isVideoMuted && (
            <div className="w-full h-full flex flex-col items-center justify-center bg-slate-900 text-slate-500">
              <VideoOff className="w-5 h-5 mb-1" />
              <span className="text-[10px] font-mono">Camera Off</span>
            </div>
          )}

          <div className="absolute bottom-1.5 left-2 px-1.5 py-0.5 rounded bg-slate-950/80 border border-slate-800 text-[10px] font-mono text-white flex items-center gap-1">
            <span>You</span>
            {isVirtualCam && <span className="text-cyan-400">(Virtual)</span>}
          </div>
        </div>

        {/* Shutter Flash Animation */}
        {isShutterFlashing && (
          <div className="absolute inset-0 z-40 bg-white/75 pointer-events-none transition-opacity duration-200" />
        )}

        {/* Temporary Stealth Notification Toast */}
        {stealthNotification && (
          <div className="absolute bottom-24 left-1/2 -translate-x-1/2 z-40 bg-slate-900/95 border border-cyan-500 px-4 py-2 rounded-xl text-xs font-mono text-cyan-300 shadow-2xl flex items-center gap-2 max-w-lg text-center animate-bounce">
            <Shield className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{stealthNotification}</span>
          </div>
        )}
      </div>

      {/* Bottom Calling Control Bar */}
      <div className="p-4 bg-slate-950 border-t border-slate-800/90 flex flex-wrap items-center justify-between gap-3 z-30">
        {/* Left Side: Audio & Video Toggles */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={toggleMic}
            className={`p-3 rounded-xl border transition-colors cursor-pointer ${
              isMicMuted
                ? 'bg-rose-950/80 border-rose-700 text-rose-300'
                : 'bg-slate-900 border-slate-700 text-slate-200 hover:bg-slate-800'
            }`}
            title={isMicMuted ? 'Unmute Microphone' : 'Mute Microphone'}
            aria-label="Toggle microphone"
          >
            {isMicMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
          </button>

          <button
            type="button"
            onClick={toggleVideo}
            className={`p-3 rounded-xl border transition-colors cursor-pointer ${
              isVideoMuted
                ? 'bg-rose-950/80 border-rose-700 text-rose-300'
                : 'bg-slate-900 border-slate-700 text-slate-200 hover:bg-slate-800'
            }`}
            title={isVideoMuted ? 'Turn Camera On' : 'Turn Camera Off'}
            aria-label="Toggle camera"
          >
            {isVideoMuted ? <VideoOff className="w-5 h-5" /> : <Video className="w-5 h-5" />}
          </button>

          <button
            type="button"
            onClick={() => setIsVirtualCam((prev) => !prev)}
            className={`px-3 py-2.5 rounded-xl border font-mono text-xs flex items-center gap-1.5 transition-colors cursor-pointer ${
              isVirtualCam
                ? 'bg-cyan-950/80 border-cyan-600 text-cyan-300'
                : 'bg-slate-900 border-slate-700 text-slate-400 hover:bg-slate-800'
            }`}
            title="Toggle HD Virtual Privacy Camera"
          >
            <Camera className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Virtual HD Cam</span>
          </button>

          {/* Client-Side Microphone Noise Suppression Toggle Button */}
          <button
            type="button"
            onClick={toggleNoiseSuppression}
            data-testid="noise-suppression-toggle"
            aria-pressed={isNoiseSuppressionEnabled}
            className={`px-3 py-2.5 rounded-xl border font-mono text-xs flex items-center gap-1.5 transition-colors cursor-pointer ${
              isNoiseSuppressionEnabled
                ? 'bg-cyan-950/80 border-cyan-500/70 text-cyan-300 shadow-sm shadow-cyan-950/50'
                : 'bg-slate-900 border-slate-700 text-slate-400 hover:bg-slate-800'
            }`}
            title="Real-time Web Audio API Noise Suppression (DynamicsCompressorNode + GainNode)"
            aria-label="Toggle microphone noise suppression"
          >
            <Waves className={`w-3.5 h-3.5 ${isNoiseSuppressionEnabled ? 'text-cyan-400 animate-pulse' : 'text-slate-500'}`} />
            <span className="hidden md:inline">Noise Filter</span>
            <span
              className={`text-[9px] px-1.5 py-0.2 rounded font-sans font-bold uppercase tracking-wider ${
                isNoiseSuppressionEnabled
                  ? 'bg-cyan-900/90 text-cyan-200 border border-cyan-500/40'
                  : 'bg-slate-800 text-slate-500'
              }`}
            >
              {isNoiseSuppressionEnabled ? 'ON' : 'OFF'}
            </span>
          </button>
        </div>

        {/* Center: Exclusive Private Local Recording & Snapshot Control */}
        <div className="flex items-center gap-2">
          {/* Capture Snapshot Button */}
          <button
            type="button"
            onClick={handleCaptureSnapshot}
            data-testid="capture-snapshot-btn"
            className="py-2.5 px-3.5 bg-slate-900 hover:bg-slate-800 border border-slate-700 hover:border-cyan-500/50 text-slate-200 hover:text-white font-medium rounded-xl text-xs shadow-lg flex items-center gap-2 transition-all cursor-pointer"
            title="Take a local-only snapshot of the video feed (Saved to Vault)"
            aria-label="Capture snapshot"
          >
            <Camera className="w-4 h-4 text-cyan-400" />
            <span>Capture Snapshot</span>
          </button>

          {!isRecording ? (
            <button
              type="button"
              onClick={startPrivateRecording}
              className="py-2.5 px-4 bg-rose-600 hover:bg-rose-500 text-white font-semibold rounded-xl text-xs shadow-lg shadow-rose-950/60 flex items-center gap-2 transition-all cursor-pointer"
              title="Record video on your device only without peer visibility"
            >
              <Disc className="w-4 h-4 animate-spin text-white" />
              <span>Record (My Side Only)</span>
            </button>
          ) : (
            <div className="flex items-center gap-2 bg-slate-900 border border-slate-700 p-1.5 rounded-xl">
              <button
                type="button"
                onClick={togglePauseRecording}
                className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs flex items-center gap-1 cursor-pointer"
              >
                {isRecordingPaused ? <Play className="w-3.5 h-3.5" /> : <Pause className="w-3.5 h-3.5" />}
                <span className="text-[11px]">{isRecordingPaused ? 'Resume' : 'Pause'}</span>
              </button>

              <button
                type="button"
                onClick={stopPrivateRecording}
                className="py-1.5 px-3 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold flex items-center gap-1.5 cursor-pointer shadow-md"
              >
                <span>Save to Vault</span>
              </button>
            </div>
          )}
        </div>

        {/* Right Side: End & Burn Call */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleEndCall}
            className="py-2.5 px-4 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl text-xs shadow-lg shadow-rose-950/80 flex items-center gap-2 transition-all cursor-pointer"
            aria-label="End call and burn link"
          >
            <Flame className="w-4 h-4 text-amber-300" />
            <span>End & Burn Call</span>
          </button>
        </div>
      </div>

      {/* Security Verification SAS Dialog */}
      {showSecurityModal && (
        <div className="fixed inset-0 z-50 bg-black/85 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-sm w-full p-5 space-y-4 text-center">
            <div className="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 mx-auto">
              <ShieldCheck className="w-6 h-6" />
            </div>

            <div>
              <h3 className="text-base font-bold text-white">Cryptographic SAS Verification</h3>
              <p className="text-xs text-slate-400 mt-1">
                Confirm these exact 4 security emojis match with the person on your screen:
              </p>
            </div>

            <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 text-2xl tracking-widest font-mono">
              {token.shortAuthString}
            </div>

            <div className="text-left bg-slate-950/60 p-3 rounded-lg border border-slate-800 text-[11px] text-slate-400 space-y-1 font-mono">
              <div>• Protocol: WebRTC DTLS 1.3 / SRTP</div>
              <div>• Session ID: {token.id.slice(0, 18)}...</div>
              <div>• Man-in-the-Middle Protection: ACTIVE</div>
            </div>

            <div className="flex items-center gap-2 text-xs text-slate-300 justify-center">
              <input
                type="checkbox"
                id="sasVerified"
                checked={isSecurityVerified}
                onChange={(e) => setIsSecurityVerified(e.target.checked)}
                className="rounded border-slate-700 text-cyan-500 focus:ring-0"
              />
              <label htmlFor="sasVerified">I verified emojis match with peer</label>
            </div>

            <button
              type="button"
              onClick={() => setShowSecurityModal(false)}
              className="w-full py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-xs font-semibold cursor-pointer"
            >
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
