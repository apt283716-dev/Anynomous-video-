/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Parameters for the Web Audio DynamicsCompressorNode and GainNode pipeline.
 */
export interface NoiseSuppressionParams {
  threshold: number;      // in dB (-100 to 0)
  knee: number;           // in dB (0 to 40)
  ratio: number;          // compression ratio (1 to 20)
  attack: number;         // in seconds (0 to 1)
  release: number;        // in seconds (0 to 1)
  gain: number;           // linear gain multiplier (>0)
  highpassCutoff: number; // in Hz
}

/**
 * Pure function returning parameters for noise suppression enabled vs bypass mode.
 */
export function getNoiseSuppressionConfig(enabled: boolean): NoiseSuppressionParams {
  if (enabled) {
    return {
      threshold: -24,     // Attenuates noisy peaks & room rumble
      knee: 30,           // Smooth soft-knee transition
      ratio: 12,          // Firm compression ratio for voice clarity
      attack: 0.003,      // Fast 3ms attack for transients
      release: 0.25,      // 250ms release for natural vocal decay
      gain: 1.25,         // Make-up gain for punchy vocal presence
      highpassCutoff: 85, // 85Hz high-pass filter cuts desk bumps and AC rumble
    };
  }

  // Bypass mode: flat, transparent pass-through
  return {
    threshold: 0,
    knee: 0,
    ratio: 1,
    attack: 0,
    release: 0.05,
    gain: 1.0,
    highpassCutoff: 10,
  };
}

export interface AudioPipelineResult {
  processedStream: MediaStream;
  audioContext: AudioContext | null;
  compressorNode: DynamicsCompressorNode | null;
  gainNode: GainNode | null;
  filterNode: BiquadFilterNode | null;
  setEnabled: (enabled: boolean) => void;
  cleanup: () => void;
}

/**
 * Initializes a real-time Web Audio noise suppression graph using GainNode and DynamicsCompressorNode.
 */
export function createNoiseSuppressionPipeline(
  inputStream: MediaStream,
  initialEnabled: boolean = true
): AudioPipelineResult {
  const audioTracks = inputStream.getAudioTracks();

  // If no audio track present or Web Audio unavailable, return passthrough
  const AudioCtx =
    typeof window !== 'undefined'
      ? window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
      : null;

  if (!AudioCtx || audioTracks.length === 0) {
    return {
      processedStream: inputStream,
      audioContext: null,
      compressorNode: null,
      gainNode: null,
      filterNode: null,
      setEnabled: () => {},
      cleanup: () => {},
    };
  }

  try {
    const audioContext = new AudioCtx();
    const sourceNode = audioContext.createMediaStreamSource(inputStream);

    // Highpass filter for low-end rumble attenuation
    const filterNode = audioContext.createBiquadFilter();
    filterNode.type = 'highpass';

    // DynamicsCompressorNode for real-time background noise smoothing
    const compressorNode = audioContext.createDynamicsCompressor();

    // GainNode for vocal clarity and make-up gain
    const gainNode = audioContext.createGain();

    // Destination node to package processed audio back into a MediaStream
    const destinationNode = audioContext.createMediaStreamDestination();

    // Connect audio processing graph:
    // Source -> Highpass Filter -> DynamicsCompressorNode -> GainNode -> Destination
    sourceNode.connect(filterNode);
    filterNode.connect(compressorNode);
    compressorNode.connect(gainNode);
    gainNode.connect(destinationNode);

    const applyConfig = (enabled: boolean) => {
      const config = getNoiseSuppressionConfig(enabled);
      const currentTime = audioContext.currentTime;

      if (filterNode.frequency.setTargetAtTime) {
        filterNode.frequency.setTargetAtTime(config.highpassCutoff, currentTime, 0.01);
      } else {
        filterNode.frequency.value = config.highpassCutoff;
      }

      if (compressorNode.threshold.setTargetAtTime) {
        compressorNode.threshold.setTargetAtTime(config.threshold, currentTime, 0.01);
        compressorNode.knee.setTargetAtTime(config.knee, currentTime, 0.01);
        compressorNode.ratio.setTargetAtTime(config.ratio, currentTime, 0.01);
        compressorNode.attack.setTargetAtTime(config.attack, currentTime, 0.01);
        compressorNode.release.setTargetAtTime(config.release, currentTime, 0.01);
      } else {
        compressorNode.threshold.value = config.threshold;
        compressorNode.knee.value = config.knee;
        compressorNode.ratio.value = config.ratio;
        compressorNode.attack.value = config.attack;
        compressorNode.release.value = config.release;
      }

      if (gainNode.gain.setTargetAtTime) {
        gainNode.gain.setTargetAtTime(config.gain, currentTime, 0.01);
      } else {
        gainNode.gain.value = config.gain;
      }
    };

    applyConfig(initialEnabled);

    // Build the processed stream preserving existing video tracks
    const processedStream = new MediaStream();
    inputStream.getVideoTracks().forEach((track) => processedStream.addTrack(track));
    destinationNode.stream.getAudioTracks().forEach((track) => processedStream.addTrack(track));

    const cleanup = () => {
      try {
        sourceNode.disconnect();
        filterNode.disconnect();
        compressorNode.disconnect();
        gainNode.disconnect();
        if (audioContext.state !== 'closed') {
          audioContext.close();
        }
      } catch {
        // cleanup ignore
      }
    };

    return {
      processedStream,
      audioContext,
      compressorNode,
      gainNode,
      filterNode,
      setEnabled: applyConfig,
      cleanup,
    };
  } catch (err) {
    console.error('Failed to initialize Web Audio noise suppression graph:', err);
    return {
      processedStream: inputStream,
      audioContext: null,
      compressorNode: null,
      gainNode: null,
      filterNode: null,
      setEnabled: () => {},
      cleanup: () => {},
    };
  }
}
