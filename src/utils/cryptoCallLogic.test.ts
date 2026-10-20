/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizePhoneNumber,
  isValidPhoneNumber,
  maskPhoneNumber,
  generateOneTimeCallToken,
  verifyAndBurnToken,
  deriveSecurityEmojis,
  formatCallDuration,
  calculateElapsedCallSeconds,
  estimateRecordingSizeMB,
} from './cryptoCallLogic.ts';

test('normalizePhoneNumber sanitizes whitespace, dashes and preserves country code', () => {
  assert.equal(normalizePhoneNumber('+1 (555) 234-5678'), '+15552345678');
  assert.equal(normalizePhoneNumber('  +91 98765-43210  '), '+919876543210');
  assert.equal(normalizePhoneNumber('555-0199'), '5550199');
});

test('isValidPhoneNumber correctly validates phone number length', () => {
  assert.equal(isValidPhoneNumber('+15551234567'), true);
  assert.equal(isValidPhoneNumber('123'), false);
  assert.equal(isValidPhoneNumber('12345678901234567'), false);
});

test('maskPhoneNumber masks middle digits for privacy', () => {
  const masked = maskPhoneNumber('+15551234567');
  assert.ok(masked.startsWith('+15'));
  assert.ok(masked.endsWith('67'));
  assert.ok(masked.includes('*'));
});

test('generateOneTimeCallToken generates an unburned token with security emojis and pin', () => {
  const t0 = 1000000000000;
  const token = generateOneTimeCallToken('+15551234567', 15, t0);
  assert.equal(token.phoneNumber, '+15551234567');
  assert.equal(token.isBurned, false);
  assert.equal(token.usageCount, 0);
  assert.equal(token.maxUsage, 1);
  assert.equal(token.expiresAt, t0 + 15 * 60 * 1000);
  assert.equal(token.securityEmojis.length, 4);
  assert.equal(token.pinCode.length, 6);
});

test('verifyAndBurnToken successfully burns a token on first use', () => {
  const t0 = 1000000000000;
  const token = generateOneTimeCallToken('+15551234567', 15, t0);

  const res1 = verifyAndBurnToken(token, { currentTime: t0 + 1000, pinToCheck: token.pinCode });
  assert.equal(res1.success, true);
  assert.equal(res1.reason, 'OK');
  assert.equal(res1.updatedToken?.isBurned, true);
  assert.equal(res1.updatedToken?.usageCount, 1);

  // Subsequent attempt must fail with ALREADY_BURNED
  const res2 = verifyAndBurnToken(res1.updatedToken!, { currentTime: t0 + 2000 });
  assert.equal(res2.success, false);
  assert.equal(res2.reason, 'ALREADY_BURNED');
});

test('verifyAndBurnToken rejects expired token and marks it burned', () => {
  const t0 = 1000000000000;
  const token = generateOneTimeCallToken('+15551234567', 10, t0);

  const pastExpiry = t0 + 11 * 60 * 1000;
  const res = verifyAndBurnToken(token, { currentTime: pastExpiry });
  assert.equal(res.success, false);
  assert.equal(res.reason, 'EXPIRED');
  assert.equal(res.updatedToken?.isBurned, true);
});

test('verifyAndBurnToken rejects incorrect PIN code', () => {
  const t0 = 1000000000000;
  const token = generateOneTimeCallToken('+15551234567', 15, t0);

  const res = verifyAndBurnToken(token, { currentTime: t0 + 500, pinToCheck: '000000' });
  assert.equal(res.success, false);
  assert.equal(res.reason, 'PIN_MISMATCH');
});

test('deriveSecurityEmojis produces consistent deterministic 4 emojis', () => {
  const emojis1 = deriveSecurityEmojis('session-secret-abc-123');
  const emojis2 = deriveSecurityEmojis('session-secret-abc-123');
  assert.deepEqual(emojis1, emojis2);
  assert.equal(emojis1.length, 4);
});

test('formatCallDuration formats seconds into MM:SS and HH:MM:SS', () => {
  assert.equal(formatCallDuration(0), '00:00');
  assert.equal(formatCallDuration(65), '01:05');
  assert.equal(formatCallDuration(3661), '01:01:01');
});

test('calculateElapsedCallSeconds calculates accurate seconds without drift', () => {
  const start = 1700000000000;
  assert.equal(calculateElapsedCallSeconds(start, start), 0);
  assert.equal(calculateElapsedCallSeconds(start, start + 5400), 5);
  assert.equal(calculateElapsedCallSeconds(start, start + 125000), 125);
  assert.equal(calculateElapsedCallSeconds(0), 0);
});

test('estimateRecordingSizeMB produces reasonable size numbers', () => {
  const size1Min = estimateRecordingSizeMB(60, 2500);
  assert.ok(size1Min > 10 && size1Min < 25);
});
