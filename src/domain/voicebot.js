'use strict';

const crypto = require('crypto');
const { stripDiacritics, maskPhone } = require('../shared/util');
const { extractPlateFromSpeech, normalizePlate } = require('./identity');
const { template } = require('../rules/jsonLogic');

/**
 * AI voice bot dialogue policy (Track 1).
 *
 * Designed around the trust problem:
 *  1. Discloses it is an automated VETC assistant and that VETC never asks for
 *     OTP / card / payment on a call.
 *  2. Verifies the LICENCE PLATE FIRST — the customer says it, the bot never
 *     reads it out — proving the call is genuine and protecting privacy.
 *  3. Answers price questions truthfully (regulated, same everywhere) and
 *     pivots to service value — never discounts.
 *  4. Hands hot leads to telesales with a structured summary, or sends a
 *     renewal link inside the VETC app / Zalo OA (the only place to pay).
 *
 * The script and NLU keywords are governed content (rule kind
 * `content.voicebot`). The state machine is code; the words are configuration.
 * ASR/TTS and an optional LLM classifier plug in through the telephony / NLU ports.
 */

function keywordClassifier(script) {
  const intents = script.intents.map(([name, kws]) => [name, kws.map((k) => ` ${stripDiacritics(k)} `)]);
  return (text) => {
    const t = ` ${stripDiacritics(text).replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ')} `;
    for (const [name, kws] of intents) if (kws.some((k) => t.includes(k))) return name;
    return 'unknown';
  };
}

function maskPlate(display) {
  return String(display).replace(/-(\d{3})\.(\d{2})$/, '-***.$2').replace(/-(\d{2})(\d{2})$/, '-**$2');
}

function viDate(iso) {
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

function createDialogue(script, { classify = keywordClassifier(script) } = {}) {
  const say = (s, key) => {
    const line = script.lines[key];
    s.transcript.push({ speaker: 'bot', key, text: template(line.vi, s.ctx), gloss: template(line.en, s.ctx) });
  };
  const end = (s, outcome, key) => {
    if (key) say(s, key);
    s.state = 'ended';
    s.outcome = outcome;
    s.endedAt = new Date().toISOString();
  };

  function start(profile, lead) {
    const s = {
      id: crypto.randomUUID(),
      customerId: profile.id,
      phoneMasked: maskPhone(profile.phone),
      region: profile.province,
      state: 'verify_plate',
      plateAttempts: 0,
      clarifications: 0,
      verified: false,
      outcome: null,
      signals: { priceAsked: false, trustConcern: false, expiryConfirmed: null, competitorInfo: null, expiryStatement: null },
      transcript: [],
      ctx: {
        plateKey: normalizePlate(profile.plate).key,
        plateMasked: maskPlate(profile.plate),
        expiry: profile.policy.expiryDate,
        expiryVi: profile.policy.expiryDate ? viDate(profile.policy.expiryDate) : '',
        expiryKnown: profile.policy.expiryConfidence >= 0.5 && !!profile.policy.expiryDate,
        lapsed: lead.daysToExpiry !== null && lead.daysToExpiry < 0,
        premium: `${Number(lead.premium).toLocaleString('en-US')} VND`,
        premiumVi: `${Number(lead.premium).toLocaleString('vi-VN')} đồng`,
      },
      startedAt: new Date().toISOString(),
    };
    say(s, 'intro');
    return s;
  }

  function global(s, intent) {
    if (intent === 'opt_out') { end(s, 'opted_out', 'optOut'); return true; }
    if (intent === 'wrong_person') { end(s, 'wrong_person', 'wrongPerson'); return true; }
    if (intent === 'callback_later') { end(s, 'callback_later', 'callback'); return true; }
    if (intent === 'scam_concern') {
      s.signals.trustConcern = true;
      say(s, 'trust');
      if (s.state !== 'verify_plate') s.state = 'offer';
      return true;
    }
    return false;
  }

  function turn(s, text) {
    if (s.state === 'ended') throw new Error('session ended');
    s.transcript.push({ speaker: 'customer', text: String(text).slice(0, 500) });
    const intent = classify(text);
    s.lastIntent = intent;
    if (global(s, intent)) return s;

    switch (s.state) {
      case 'verify_plate': {
        const plate = extractPlateFromSpeech(text);
        if (!plate) {
          s.plateAttempts++;
          if (s.plateAttempts >= script.maxPlateAttempts) end(s, 'unverified', 'goodbye');
          else say(s, 'plateRetry');
          return s;
        }
        if (plate !== s.ctx.plateKey) { end(s, 'plate_mismatch', 'plateMismatch'); return s; }
        s.verified = true;
        s.state = 'confirm_expiry';
        say(s, s.ctx.expiryKnown ? (s.ctx.lapsed ? 'expiryLapsed' : 'expiryKnown') : 'expiryUnknown');
        return s;
      }
      case 'confirm_expiry': {
        if (intent === 'already_renewed') { s.state = 'capture_competitor'; say(s, 'alreadyRenewed'); return s; }
        if (intent === 'price') { s.signals.priceAsked = true; s.state = 'offer'; say(s, 'price'); return s; }
        s.signals.expiryConfirmed = intent === 'yes' ? true : intent === 'no' ? false : null;
        if (!s.ctx.expiryKnown) s.signals.expiryStatement = String(text).slice(0, 200);
        if (intent === 'buy_now') { end(s, 'hot_handoff', 'handoff'); return s; }
        s.state = 'offer';
        say(s, 'pitch');
        return s;
      }
      case 'capture_competitor':
        s.signals.competitorInfo = String(text).slice(0, 200);
        end(s, 'already_renewed', 'alreadyRenewedThanks');
        return s;
      case 'offer': {
        if (['buy_now', 'human', 'yes'].includes(intent)) { end(s, 'hot_handoff', 'handoff'); return s; }
        if (intent === 'send_link') { end(s, 'link_sent', 'link'); return s; }
        if (intent === 'price') { s.signals.priceAsked = true; say(s, 'price'); return s; }
        if (intent === 'benefits') { say(s, 'benefits'); return s; }
        if (intent === 'already_renewed') { s.state = 'capture_competitor'; say(s, 'alreadyRenewed'); return s; }
        if (intent === 'no') { end(s, 'not_interested', 'goodbye'); return s; }
        s.clarifications++;
        if (s.clarifications >= script.maxClarifications) { end(s, 'link_sent', 'link'); return s; }
        say(s, 'clarify');
        return s;
      }
      default:
        throw new Error(`bad state ${s.state}`);
    }
  }

  return { start, turn, classify };
}

/** What a telesales agent needs — nothing more (data minimisation). */
function handoffSummary(session, profile, lead) {
  return {
    id: `HO-${session.id.slice(0, 8)}`,
    sessionId: session.id,
    customerId: profile.id,
    region: profile.province,
    plate: profile.plate,
    plateVerifiedByCustomer: session.verified,
    name: profile.name,
    phoneMasked: session.phoneMasked,
    journey: lead.journey,
    expiryDate: profile.policy.expiryDate,
    daysToExpiry: lead.daysToExpiry,
    premium: lead.premium,
    score: lead.score,
    outcome: session.outcome,
    priceAsked: session.signals.priceAsked,
    trustConcern: session.signals.trustConcern,
    talkingPoints: [
      'Call from the official VETC hotline and reference the assistant call.',
      session.signals.trustConcern ? 'Customer raised a trust concern: complete everything inside the VETC app; never take payment by phone.' : null,
      session.signals.priceAsked ? 'Customer asked about price: TNDS premium is regulated and identical everywhere — lead with service value.' : null,
      ...lead.benefits.map((b) => `Benefit: ${b.title} — ${b.why}`),
      'Close by sending the one-tap link to the VETC app / Zalo OA while on the call.',
    ].filter(Boolean),
    status: 'open',
    assignedTo: null,
    createdAt: new Date().toISOString(),
  };
}

module.exports = { createDialogue, keywordClassifier, handoffSummary, maskPlate };
