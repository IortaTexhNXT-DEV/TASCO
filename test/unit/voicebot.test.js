'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { createDialogue, handoffSummary, maskPlate } = require('../../src/domain/voicebot');

const script = JSON.parse(fs.readFileSync(path.join(__dirname, '..', '..', 'config', 'rules', 'content.voicebot.json'), 'utf8')).payload;
const d = createDialogue(script);
const profile = { id: '30A12345', plate: '30A-123.45', province: 'Hà Nội', name: 'An', phone: '0912345678', policy: { expiryDate: '2026-10-20', expiryConfidence: 1 } };
const lead = { daysToExpiry: 13, premium: 480700, journey: 'renewal', score: 88, benefits: [{ title: 'Roadside', why: 'long trips' }] };

function run(lines, p = profile, l = lead) {
  const s = d.start(p, l);
  for (const line of lines) { if (s.state !== 'ended') d.turn(s, line); }
  return s;
}

test('bot discloses automation and never asks for OTP/payment, and masks the plate', () => {
  const s = d.start(profile, lead);
  assert.match(s.transcript[0].text, /trợ lý tự động/);
  assert.match(s.transcript[0].text, /không bao giờ yêu cầu mã OTP/);
  assert.equal(maskPlate('30A-123.45'), '30A-***.45');
  assert.equal(maskPlate('29A-1234'), '29A-**34');
  assert.ok(!JSON.stringify(s.transcript).includes('123.45'));
});

test('happy path: plate first, confirm, buy → hot handoff', () => {
  const s = run(['biển số 30A 123 45', 'đúng rồi', 'tôi muốn mua ngay']);
  assert.equal(s.verified, true);
  assert.equal(s.outcome, 'hot_handoff');
  const h = handoffSummary(s, profile, lead);
  assert.equal(h.plateVerifiedByCustomer, true);
  assert.ok(h.talkingPoints.some((t) => t.includes('Roadside')));
  assert.equal(h.status, 'open');
});

test('buy intent at expiry confirmation hands off immediately', () => {
  assert.equal(run(['30A 123 45', 'gia hạn ngay']).outcome, 'hot_handoff');
});

test('wrong plate ends the call to protect privacy', () => {
  const s = run(['29A 999 99']);
  assert.equal(s.outcome, 'plate_mismatch');
  assert.equal(s.verified, false);
});

test('unclear plate retries then gives up', () => {
  assert.equal(run(['ờ', 'à', 'hả']).outcome, 'unverified');
  const s = run(['ờ']);
  assert.equal(s.transcript.at(-1).key, 'plateRetry');
});

test('trust concern is answered and the call continues to the offer', () => {
  const s = run(['lừa đảo à', '30A 123 45', 'đúng', 'sao biết số tôi', 'gửi link qua zalo']);
  assert.equal(s.signals.trustConcern, true);
  assert.equal(s.outcome, 'link_sent');
});

test('price question gets a truthful regulated-price answer, then link', () => {
  const s = run(['30A 123 45', 'phí bao nhiêu tiền', 'gửi link cho tôi']);
  assert.equal(s.signals.priceAsked, true);
  assert.ok(s.transcript.some((t) => t.key === 'price' && t.text.includes('480.700')));
  assert.equal(s.outcome, 'link_sent');
});

test('benefits, price in offer, clarification fallback, refusal', () => {
  const s = run(['30A 123 45', 'đúng', 'được gì', 'bao nhiêu tiền', 'hmm', 'hmm']);
  assert.ok(s.transcript.some((t) => t.key === 'benefits'));
  assert.equal(s.outcome, 'link_sent', 'two unclear answers → send link');
  assert.equal(run(['30A 123 45', 'đúng', 'không']).outcome, 'not_interested');
  assert.equal(run(['30A 123 45', 'đúng', 'nhân viên']).outcome, 'hot_handoff');
});

test('already renewed captures competitor info (data repair)', () => {
  const s = run(['30A 123 45', 'tôi đã gia hạn rồi', 'Bảo Việt, tháng 9 năm sau']);
  assert.equal(s.outcome, 'already_renewed');
  assert.match(s.signals.competitorInfo, /Bảo Việt/);
  const s2 = run(['30A 123 45', 'đúng', 'mua rồi', 'PVI']);
  assert.equal(s2.outcome, 'already_renewed');
});

test('opt-out, wrong person and callback are honoured at any point', () => {
  assert.equal(run(['đừng gọi nữa']).outcome, 'opted_out');
  assert.equal(run(['30A 123 45', 'nhầm số rồi']).outcome, 'wrong_person');
  assert.equal(run(['đang lái xe, gọi lại sau']).outcome, 'callback_later');
});

test('unknown and lapsed expiry use the right script lines', () => {
  const unknown = run(['30A 123 45', 'tháng 12'], { ...profile, policy: { expiryDate: null, expiryConfidence: 0 } });
  assert.ok(unknown.transcript.some((t) => t.key === 'expiryUnknown'));
  assert.equal(unknown.signals.expiryStatement, 'tháng 12');
  const lapsed = run(['30A 123 45'], profile, { ...lead, daysToExpiry: -5 });
  assert.ok(lapsed.transcript.some((t) => t.key === 'expiryLapsed'));
  const ended = run(['đừng gọi nữa']);
  assert.throws(() => d.turn(ended, 'hello'), /session ended/);
  const bad = d.start(profile, lead);
  bad.state = 'weird';
  assert.throws(() => d.turn(bad, 'x'), /bad state/);
});
