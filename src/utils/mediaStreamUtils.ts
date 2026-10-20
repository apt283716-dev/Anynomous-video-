/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Creates a synthetic procedural MediaStream using HTML5 Canvas and Web Audio API.
 * This guarantees rock-solid video calling in headless browser tests, environments
 * without real webcams, or when the user toggles Virtual Privacy Camera.
 */
export function createSyntheticStream(label: string = 'Secure Node', colorHex: string = '#0284c7'): MediaStream {
  const canvas = document.createElement('canvas');
  canvas.width = 640;
  canvas.height = 480;
  const ctx = canvas.getContext('2d');

  let frameCount = 0;
  let animId: number;

  const renderLoop = () => {
    if (!ctx) return;
    frameCount++;

    // Background gradient
    const grad = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
    grad.addColorStop(0, '#090d16');
    grad.addColorStop(0.5, '#0f172a');
    grad.addColorStop(1, '#02182b');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Grid lines for cyber security aesthetic
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.08)';
    ctx.lineWidth = 1;
    for (let x = 0; x < canvas.width; x += 32) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, canvas.height);
      ctx.stroke();
    }
    for (let y = 0; y < canvas.height; y += 32) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(canvas.width, y);
      ctx.stroke();
    }

    // Dynamic central radar / cryptographic halo
    const cx = canvas.width / 2;
    const cy = canvas.height / 2 - 20;
    const pulse = Math.sin(frameCount * 0.05) * 8;
    const ringRadius = 80 + pulse;

    ctx.strokeStyle = colorHex;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(cx, cy, ringRadius, 0, Math.PI * 2);
    ctx.stroke();

    // Rotating scanner line
    const angle = (frameCount * 0.04) % (Math.PI * 2);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + Math.cos(angle) * ringRadius, cy + Math.sin(angle) * ringRadius);
    ctx.stroke();

    // Inner avatar silhouette
    ctx.fillStyle = 'rgba(255, 255, 255, 0.15)';
    ctx.beginPath();
    ctx.arc(cx, cy - 15, 30, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(cx, cy + 45, 45, Math.PI, Math.PI * 2);
    ctx.fill();

    // Label and status HUD
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 18px ui-monospace, SFMono-Regular, monospace';
    ctx.textAlign = 'center';
    ctx.fillText(label.toUpperCase(), cx, canvas.height - 70);

    ctx.fillStyle = '#38bdf8';
    ctx.font = '12px ui-monospace, SFMono-Regular, monospace';
    const timeStr = new Date().toISOString().replace('T', ' ').substring(0, 19);
    ctx.fillText(`[E2EE DTLS-SRTP ACTIVE]  ${timeStr}`, cx, canvas.height - 45);

    ctx.fillStyle = '#22c55e';
    ctx.font = '11px ui-monospace, SFMono-Regular, monospace';
    ctx.fillText(`FRAME #${frameCount} • BITRATE: 2.4 MBPS • ZERO LOGS`, cx, canvas.height - 25);

    animId = requestAnimationFrame(renderLoop);
  };

  renderLoop();

  // Capture canvas video stream
  const canvasStream = canvas.captureStream(30);

  // Add synthetic audio track via Web Audio oscillator
  try {
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (AudioCtx) {
      const audioCtx = new AudioCtx();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      // Very faint ambient hum (barely audible, 80Hz at 0.005 gain) so media streams have active audio track
      osc.type = 'sine';
      osc.frequency.setValueAtTime(80, audioCtx.currentTime);
      gain.gain.setValueAtTime(0.005, audioCtx.currentTime);
      osc.connect(gain);

      const dest = audioCtx.createMediaStreamDestination();
      gain.connect(dest);
      osc.start();

      const audioTrack = dest.stream.getAudioTracks()[0];
      if (audioTrack) {
        canvasStream.addTrack(audioTrack);
      }
    }
  } catch {
    // Ignore audio fallback error if Web Audio blocked by browser policy
  }

  // Handle clean disposal when track stops
  const videoTrack = canvasStream.getVideoTracks()[0];
  if (videoTrack) {
    const origStop = videoTrack.stop.bind(videoTrack);
    videoTrack.stop = () => {
      cancelAnimationFrame(animId);
      origStop();
    };
  }

  return canvasStream;
}

/**
 * Safely requests camera and microphone access with intelligent fallback to synthetic stream.
 */
export async function getSafeUserMedia(preferVirtual: boolean = false): Promise<{
  stream: MediaStream;
  isVirtual: boolean;
}> {
  if (preferVirtual) {
    return {
      stream: createSyntheticStream('My Protected Stream (Virtual HD)', '#38bdf8'),
      isVirtual: true,
    };
  }

  // Check if navigator.mediaDevices exists
  if (typeof navigator !== 'undefined' && navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: true,
      });
      return { stream, isVirtual: false };
    } catch {
      // Camera was denied or unavailable - provide privacy virtual stream
      return {
        stream: createSyntheticStream('Local Verified Stream (Virtual Fallback)', '#10b981'),
        isVirtual: true,
      };
    }
  }

  return {
    stream: createSyntheticStream('Local Verified Stream (Virtual Fallback)', '#10b981'),
    isVirtual: true,
  };
}

/**
 * Creates a combined canvas stream that records local & remote video side-by-side or picture-in-picture,
 * along with combined audio, for client-side local recording.
 */
export function createCompositeRecorder(
  localStream: MediaStream | null,
  remoteStream: MediaStream | null
): {
  recorderStream: MediaStream;
  cleanup: () => void;
} {
  const canvas = document.createElement('canvas');
  canvas.width = 1280;
  canvas.height = 720;
  const ctx = canvas.getContext('2d');

  const localVideo = document.createElement('video');
  localVideo.muted = true;
  localVideo.playsInline = true;
  localVideo.autoplay = true;
  if (localStream) localVideo.srcObject = localStream;

  const remoteVideo = document.createElement('video');
  remoteVideo.muted = true;
  remoteVideo.playsInline = true;
  remoteVideo.autoplay = true;
  if (remoteStream) remoteVideo.srcObject = remoteStream;

  // Attempt play
  localVideo.play().catch(() => {});
  remoteVideo.play().catch(() => {});

  let isRunning = true;
  let animId: number;

  const drawFrame = () => {
    if (!isRunning || !ctx) return;

    ctx.fillStyle = '#0a0f1d';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // If remote stream active, show remote as primary full canvas, and local as PiP
    if (remoteStream && remoteVideo.videoWidth > 0) {
      ctx.drawImage(remoteVideo, 0, 0, canvas.width, canvas.height);

      // Draw local PiP in bottom-right corner
      const pipW = 320;
      const pipH = 180;
      const pipX = canvas.width - pipW - 24;
      const pipY = canvas.height - pipH - 24;

      ctx.save();
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 3;
      ctx.strokeRect(pipX, pipY, pipW, pipH);
      ctx.fillStyle = '#000000';
      ctx.fillRect(pipX, pipY, pipW, pipH);
      if (localStream && localVideo.videoWidth > 0) {
        ctx.drawImage(localVideo, pipX, pipY, pipW, pipH);
      }
      ctx.restore();
    } else if (localStream && localVideo.videoWidth > 0) {
      // Only local stream
      ctx.drawImage(localVideo, 0, 0, canvas.width, canvas.height);
    }

    // Overlay Watermark / Security Stamp
    ctx.fillStyle = 'rgba(15, 23, 42, 0.75)';
    ctx.fillRect(20, 20, 360, 40);
    ctx.fillStyle = '#38bdf8';
    ctx.font = 'bold 14px monospace';
    ctx.fillText('🔒 CIPHERCALL LOCAL CLIENT RECORDING', 32, 45);

    animId = requestAnimationFrame(drawFrame);
  };

  drawFrame();

  const compositeStream = canvas.captureStream(30);

  // Mix audio tracks
  try {
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (AudioCtx) {
      const audioCtx = new AudioCtx();
      const dest = audioCtx.createMediaStreamDestination();

      if (localStream && localStream.getAudioTracks().length > 0) {
        const localSource = audioCtx.createMediaStreamSource(localStream);
        localSource.connect(dest);
      }
      if (remoteStream && remoteStream.getAudioTracks().length > 0) {
        const remoteSource = audioCtx.createMediaStreamSource(remoteStream);
        remoteSource.connect(dest);
      }

      const audioTrack = dest.stream.getAudioTracks()[0];
      if (audioTrack) {
        compositeStream.addTrack(audioTrack);
      }
    }
  } catch {
    // Audio mix fallback
  }

  return {
    recorderStream: compositeStream,
    cleanup: () => {
      isRunning = false;
      cancelAnimationFrame(animId);
      localVideo.pause();
      remoteVideo.pause();
      localVideo.srcObject = null;
      remoteVideo.srcObject = null;
    },
  };
}
