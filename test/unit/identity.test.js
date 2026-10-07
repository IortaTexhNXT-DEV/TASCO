'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { normalizePlate, normalizePhone, extractPlateFromSpeech } = require('../../src/domain/identity');

test('normalizePlate handles dirty formats', () => {
  for (const raw of ['30a-123.45', ' 30A 12345 ', '30A.123.45', '30A12345']) {
    const p = normalizePlate(raw);
    assert.equal(p.valid, true, raw);
    assert.equal(p.key, '30A12345');
    assert.equal(p.display, '30A-123.45');
    assert.equal(p.province, 'Hà Nội');
  }
  assert.equal(normalizePlate('29A-1234').display, '29A-1234');
  assert.equal(normalizePlate('51LD-123.45').series, 'LD');
  assert.deepEqual(normalizePlate(''), { valid: false, reason: 'missing' });
  assert.equal(normalizePlate('30-12345').reason, 'format');
  assert.equal(normalizePlate('00A12345').reason, 'province');
});

test('normalizePhone canonicalises Vietnamese mobiles', () => {
  assert.equal(normalizePhone('+84912345678').value, '0912345678');
  assert.equal(normalizePhone('84912345678').value, '0912345678');
  assert.equal(normalizePhone('912345678').value, '0912345678');
  assert.equal(normalizePhone('0912 345 678').e164, '+84912345678');
  assert.equal(normalizePhone('0212345678').valid, false);
  assert.equal(normalizePhone('09123').valid, false);
  assert.equal(normalizePhone(null).reason, 'missing');
});

test('extractPlateFromSpeech understands digits and spoken Vietnamese numbers', () => {
  assert.equal(extractPlateFromSpeech('biển số của tôi là 30A 123 45'), '30A12345');
  assert.equal(extractPlateFromSpeech('ba không A một hai ba bốn năm'), '30A12345');
  assert.equal(extractPlateFromSpeech('xe tôi là 51G 678 90 nhé'), '51G67890');
  assert.equal(extractPlateFromSpeech('tôi không nhớ'), null);
  assert.equal(extractPlateFromSpeech(''), null);
});
