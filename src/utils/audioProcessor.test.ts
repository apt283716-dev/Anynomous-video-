/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getNoiseSuppressionConfig } from './audioProcessor.ts';

test('getNoiseSuppressionConfig returns compression parameters when enabled', () => {
  const config = getNoiseSuppressionConfig(true);
  assert.equal(config.threshold, -24);
  assert.equal(config.ratio, 12);
  assert.equal(config.knee, 30);
  assert.equal(config.attack, 0.003);
  assert.equal(config.release, 0.25);
  assert.equal(config.gain, 1.25);
  assert.equal(config.highpassCutoff, 85);
});

test('getNoiseSuppressionConfig returns bypass transparent parameters when disabled', () => {
  const config = getNoiseSuppressionConfig(false);
  assert.equal(config.threshold, 0);
  assert.equal(config.ratio, 1);
  assert.equal(config.gain, 1.0);
  assert.equal(config.highpassCutoff, 10);
});
