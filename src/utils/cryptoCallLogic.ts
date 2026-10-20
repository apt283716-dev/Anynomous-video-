/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface CallToken {
  id: string;
  phoneNumber: string;
  tokenHash: string;
  pinCode: string;
  createdAt: number;
  expiresAt: number;
  isBurned: boolean;
  burnedAt?: number;
  usageCount: number;
  maxUsage: number;
  shortAuthString: string;
  securityEmojis: string[];
}

const SECURITY_EMOJI_POOL = [
  '🛡️', '⚡', '🗝️', '💎', '🪐', '🦅', '⚓', '🔮',
  '🌊', '🔥', '🌲', '👑', '🚀', '⭐', '🧭', '🎯'
];

/**
 * Normalizes phone numbers, stripping extraneous formatting while retaining leading plus.
 */
export function normalizePhoneNumber(raw: string): string {
  const trimmed = raw.trim();
  const hasPlus = trimmed.startsWith('+');
  const digitsOnly = trimmed.replace(/\D/g, '');
  if (!digitsOnly) return '';
  return hasPlus ? `+${digitsOnly}` : digitsOnly;
}

/**
 * Validates whether an input represents a plausible phone number (min 7 digits, max 15 digits according to E.164).
 */
export function isValidPhoneNumber(phone: string): boolean {
  const digits = phone.replace(/\D/g, '');
  return digits.length >= 7 && digits.length <= 15;
}

/**
 * Masks phone numbers to protect privacy on shared screens.
 */
export function maskPhoneNumber(phone: string): string {
  const norm = normalizePhoneNumber(phone);
  if (norm.length <= 4) return '***';
  const prefix = norm.slice(0, 3);
  const suffix = norm.slice(-2);
  const maskedMiddle = '*'.repeat(Math.max(3, norm.length - 5));
  return `${prefix} ${maskedMiddle} ${suffix}`;
}

/**
 * Generates deterministic 4-emoji security verification code from a pair of keys / IDs.
 */
export function deriveSecurityEmojis(seed: string): string[] {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash << 5) - hash + seed.charCodeAt(i);
    hash |= 0;
  }
  const result: string[] = [];
  for (let i = 0; i < 4; i++) {
    const idx = Math.abs((hash >> (i * 4)) + i * 17) % SECURITY_EMOJI_POOL.length;
    result.push(SECURITY_EMOJI_POOL[idx]);
  }
  return result;
}

/**
 * Generates an ephemeral one-time call invitation record.
 */
export function generateOneTimeCallToken(
  phoneNumber: string,
  validityMinutes: number = 15,
  currentTime: number = Date.now()
): CallToken {
  const normalized = normalizePhoneNumber(phoneNumber);
  const randomChars = Math.random().toString(36).substring(2, 10).toUpperCase();
  const randomHex = Array.from({ length: 8 }, () => Math.floor(Math.random() * 16).toString(16)).join('');
  const id = `call_${Date.now()}_${randomChars}`;
  const pin = Math.floor(100000 + Math.random() * 900000).toString();
  const tokenHash = `tok_${randomHex}_${Date.now()}`;
  const securityEmojis = deriveSecurityEmojis(id + normalized + pin);
  const shortAuthString = securityEmojis.join(' ');

  return {
    id,
    phoneNumber: normalized,
    tokenHash,
    pinCode: pin,
    createdAt: currentTime,
    expiresAt: currentTime + validityMinutes * 60 * 1000,
    isBurned: false,
    usageCount: 0,
    maxUsage: 1,
    shortAuthString,
    securityEmojis,
  };
}

export type TokenVerificationResult =
  | { success: true; reason: 'OK'; updatedToken: CallToken }
  | { success: false; reason: 'INVALID_DATA' | 'EXPIRED' | 'ALREADY_BURNED' | 'PIN_MISMATCH'; updatedToken?: CallToken };

/**
 * Validates and burns a one-time token upon call initiation or completion.
 */
export function verifyAndBurnToken(
  token: CallToken,
  options?: {
    pinToCheck?: string;
    currentTime?: number;
    forceBurn?: boolean;
  }
): TokenVerificationResult {
  const now = options?.currentTime ?? Date.now();

  if (!token || !token.id) {
    return { success: false, reason: 'INVALID_DATA' };
  }

  if (token.isBurned) {
    return { success: false, reason: 'ALREADY_BURNED', updatedToken: token };
  }

  if (now > token.expiresAt) {
    const burnedExpired: CallToken = {
      ...token,
      isBurned: true,
      burnedAt: now,
    };
    return { success: false, reason: 'EXPIRED', updatedToken: burnedExpired };
  }

  if (options?.pinToCheck && options.pinToCheck.trim() !== token.pinCode) {
    return { success: false, reason: 'PIN_MISMATCH', updatedToken: token };
  }

  const updated: CallToken = {
    ...token,
    usageCount: token.usageCount + 1,
    isBurned: true, // One-time guarantee: burned upon activation!
    burnedAt: now,
  };

  return { success: true, reason: 'OK', updatedToken: updated };
}

/**
 * Formats elapsed call time into MM:SS or HH:MM:SS format.
 */
export function formatCallDuration(totalSeconds: number): string {
  const sec = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(sec / 3600);
  const minutes = Math.floor((sec % 3600) / 60);
  const seconds = sec % 60;

  const mm = minutes.toString().padStart(2, '0');
  const ss = seconds.toString().padStart(2, '0');

  if (hours > 0) {
    const hh = hours.toString().padStart(2, '0');
    return `${hh}:${mm}:${ss}`;
  }
  return `${mm}:${ss}`;
}

/**
 * Accurately calculates elapsed call seconds based on wall-clock time, avoiding drift.
 */
export function calculateElapsedCallSeconds(startTimeMs: number, currentTimeMs?: number): number {
  if (!startTimeMs || startTimeMs <= 0) return 0;
  const now = currentTimeMs ?? Date.now();
  return Math.max(0, Math.floor((now - startTimeMs) / 1000));
}

/**
 * Estimates client-side recording storage requirement in megabytes.
 */
export function estimateRecordingSizeMB(durationSeconds: number, bitrateKbps: number = 2500): number {
  // duration (s) * bitrate (kbps) / 8 = kilobytes / 1024 = megabytes
  const bytes = (durationSeconds * bitrateKbps * 1000) / 8;
  return Number((bytes / (1024 * 1024)).toFixed(2));
}
