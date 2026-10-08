import home from './home.js';
import leads from './leads.js';
import customer from './customer.js';
import voice from './voice.js';
import handoffs from './handoffs.js';
import journeys from './journeys.js';
import campaigns from './campaigns.js';
import rules from './rules.js';
import audit from './audit.js';
import approvals from './approvals.js';
import claims from './claims.js';
import dq from './dataQuality.js';
import partners from './partners.js';
import users from './users.js';
import ops from './operations.js';

/** Route name → page module ({ perm, render(main, ctx) }). */
export const PAGES = { home, leads, customer, voice, handoffs, journeys, campaigns, rules, approvals, partners, claims, dq, audit, users, ops };
