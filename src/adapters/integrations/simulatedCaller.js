'use strict';

const { rng } = require('../../shared/util');

/**
 * Port: Telephony / speech. In production a voice-AI vendor (SIP trunk + ASR/TTS
 * in Vietnamese) streams customer speech as text turns into the dialogue
 * engine. This sandbox simulates realistic customer replies so campaigns can be
 * rehearsed end-to-end (and load-tested) without dialling anyone.
 */

function spokenPlate(plateDisplay) {
  // "30A-123.45" → "30A 123 45" as an ASR engine would typically transcribe.
  return plateDisplay.replace('-', ' ').replace('.', ' ');
}

const PERSONAS = [
  { id: 'eager', weight: 22, script: (p) => [`biển số ${spokenPlate(p)}`, 'đúng rồi', 'tôi muốn mua ngay'] },
  { id: 'self_serve', weight: 26, script: (p) => [`${spokenPlate(p)}`, 'đúng', 'gửi link qua zalo cho tôi'] },
  { id: 'price_shopper', weight: 12, script: (p) => [`xe tôi là ${spokenPlate(p)}`, 'phí bao nhiêu tiền vậy', 'gửi link cho tôi'] },
  { id: 'skeptic', weight: 10, script: (p) => ['sao biết số tôi, lừa đảo à', `${spokenPlate(p)}`, 'đúng', 'gửi link trên app'] },
  { id: 'already_renewed', weight: 12, script: (p) => [`${spokenPlate(p)}`, 'tôi đã gia hạn rồi', 'mua bên Bảo Việt, hết hạn tháng 9 năm sau'] },
  { id: 'busy', weight: 10, script: () => ['đang lái xe, gọi lại sau nhé'] },
  { id: 'opt_out', weight: 4, script: () => ['đừng gọi nữa'] },
  { id: 'wrong_plate', weight: 4, script: () => ['biển số 29A 999 99'] },
];

function createSimulatedCaller({ seed = 7 } = {}) {
  const r = rng(seed);
  return {
    name: 'simulated-caller',
    pickPersona() {
      return r.weighted(PERSONAS.map((p) => [p, p.weight]));
    },
    /** Drive a full call through the dialogue engine; returns the ended session. */
    async runCall(dialogue, session, plateDisplay) {
      const persona = this.pickPersona();
      session.persona = persona.id;
      for (const utterance of persona.script(plateDisplay)) {
        if (session.state === 'ended') break;
        dialogue.turn(session, utterance);
      }
      if (session.state !== 'ended') dialogue.turn(session, 'không');
      if (session.state !== 'ended') dialogue.turn(session, 'không');
      return session;
    },
  };
}

module.exports = { createSimulatedCaller, PERSONAS };
