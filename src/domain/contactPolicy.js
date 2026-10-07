'use strict';

const { stripDiacritics } = require('../shared/util');

/**
 * Consent, anti-spam and copy guards. Pure functions over the `contact_policy`
 * and `copy_guard` rule sets; every outbound touch passes through canContact().
 */

function localHour(date, offsetHours) {
  return (date.getUTCHours() + offsetHours) % 24;
}

function inContactWindow(policy, date) {
  const h = localHour(date, policy.timezoneOffsetHours);
  return h >= policy.contactWindow.startHour && h < policy.contactWindow.endHour;
}

function checkCopy(guard, text) {
  const raw = String(text || '').toLowerCase();
  const plain = stripDiacritics(text);
  const hits = guard.bannedPhrases.filter((p) => raw.includes(p.toLowerCase()) || plain.includes(stripDiacritics(p)));
  return { ok: hits.length === 0, violations: hits };
}

/**
 * @param policy  contact_policy payload
 * @param profile golden profile
 * @param channel app_push | zalo_zns | sms | voice_bot | telesales
 * @param opts    { marketing, now: Date, history: [{ at: Date|string, channel, marketing }] }
 */
function canContact(policy, profile, channel, { marketing, now, history = [] }) {
  const reasons = [];
  if (!profile.channels?.[channel]) reasons.push(`not reachable on ${channel}`);
  if (profile.consent?.dnc) reasons.push('customer is on do-not-contact list');
  const needs = [...(marketing ? policy.consentRequired.marketing || [] : []), ...(policy.consentRequired[channel] || [])];
  for (const c of new Set(needs)) if (!profile.consent?.[c]) reasons.push(`no ${c} consent`);
  const capsApply = marketing || !policy.serviceMessagesBypassCaps;
  if (marketing && !inContactWindow(policy, now)) reasons.push('outside allowed contact hours');
  if (capsApply) {
    const t = now.getTime();
    const at = (h) => new Date(h.at).getTime();
    const mk = history.filter((h) => h.marketing);
    if (mk.filter((h) => at(h) > t - 86400000).length >= policy.maxMarketingContactsPerDay) reasons.push('daily contact cap reached');
    if (mk.filter((h) => at(h) > t - 7 * 86400000).length >= policy.maxMarketingContactsPerWeek) reasons.push('weekly contact cap reached');
    if (['voice_bot', 'telesales'].includes(channel)
      && history.filter((h) => ['voice_bot', 'telesales'].includes(h.channel) && at(h) > t - 7 * 86400000).length >= policy.maxCallAttemptsPerWeek) {
      reasons.push('weekly call cap reached');
    }
  }
  return { ok: reasons.length === 0, reasons };
}

module.exports = { canContact, checkCopy, inContactWindow, localHour };
