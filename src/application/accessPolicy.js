'use strict';

const { apply, truthy } = require('../rules/jsonLogic');
const { errors } = require('../shared/errors');
const { maskPhone, maskName } = require('../shared/util');

/**
 * Authorisation: RBAC (role → permission, config/security/rbac.json) then ABAC
 * (attribute policies, rule kind `abac`), plus purpose-based PII masking. Deny
 * by default: no permission, no access.
 */

function createAccessPolicy({ rbac, rules }) {
  const permsOf = (principal) => new Set((principal?.roles || []).flatMap((r) => rbac.roles[r] || []));

  return {
    permissions: permsOf,

    has(principal, permission) {
      return permsOf(principal).has(permission);
    },

    require(principal, permission) {
      if (!principal) throw errors.unauthenticated();
      if (!permsOf(principal).has(permission)) throw errors.forbidden(`Missing permission ${permission}`);
    },

    /** ABAC check for a resource instance. Policies only restrict roles they apply to. */
    async check(principal, action, resource) {
      const abac = await rules.get('abac');
      const facts = {
        user: { id: principal.id, roles: principal.roles, region: principal.region, customerId: principal.customerId || null },
        resource,
        action,
      };
      for (const p of abac.policies) {
        if (p.resource !== resource.type || !p.actions.includes(action)) continue;
        if (!principal.roles.some((r) => p.appliesToRoles.includes(r))) continue;
        // Users holding any role outside the policy's scope are not restricted by it.
        if (principal.roles.some((r) => !p.appliesToRoles.includes(r) && (rbac.roles[r] || []).length)) continue;
        if (!truthy(apply(p.allow, facts))) throw errors.forbidden(`Policy ${p.id} denies ${action} on this ${resource.type}`);
      }
    },

    /** Return a copy of a profile with PII masked unless the principal may read it. */
    maskProfile(principal, profile) {
      if (!profile) return profile;
      if (permsOf(principal).has('profile:read_pii')) return profile;
      return { ...profile, name: maskName(profile.name), phone: maskPhone(profile.phone), altPhones: (profile.altPhones || []).map(maskPhone), piiMasked: true };
    },
  };
}

module.exports = { createAccessPolicy };
