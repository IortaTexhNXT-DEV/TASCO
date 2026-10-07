import home from './home.js';
import leads from './leads.js';
import customer from './customer.js';
import voice from './voice.js';
import handoffs from './handoffs.js';
import journeys from './journeys.js';
import rules from './rules.js';
import { partners, claims, dq, audit, users, ops } from './admin.js';

/** Route name → page module ({ perm, render(main, ctx) }). */
export const PAGES = { home, leads, customer, voice, handoffs, journeys, rules, partners, claims, dq, audit, users, ops };
