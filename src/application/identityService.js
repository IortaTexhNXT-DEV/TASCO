'use strict';

const crypto = require('crypto');
const {
  hashPassword, verifyPassword, checkPasswordPolicy, signJwt, verifyJwt, generateTotpSecret, verifyTotp,
} = require('../shared/crypto');
const { errors } = require('../shared/errors');

/**
 * Staff identity: password + TOTP MFA, account lockout, short-lived JWTs, role
 * and region attributes. In production this federates to TASCO's IdP (Azure
 * AD / Keycloak via OIDC) — the token contract stays the same (ADR-007).
 */

function createIdentityService({ store, audit, config, clock, rbac }) {
  const users = store.collection('users');
  const revoked = new Map(); // jti → exp (per replica; production: shared cache)

  const publicUser = (u) => ({ id: u.id, username: u.username, displayName: u.displayName, roles: u.roles, region: u.region, mfaEnabled: !!u.totpSecret, status: u.status, lastLoginAt: u.lastLoginAt || null });

  async function byUsername(username) {
    const [u] = await users.find({ where: { username: String(username).toLowerCase() }, limit: 1 });
    return u || null;
  }

  function issue(u) {
    const permissions = [...new Set(u.roles.flatMap((r) => rbac.roles[r] || []))];
    const accessToken = signJwt(
      { sub: u.id, roles: u.roles, region: u.region, aud: 'staff', amr: u.totpSecret ? ['pwd', 'otp'] : ['pwd'] },
      config.jwtSecret,
      config.jwtTtlSeconds,
    );
    return { accessToken, expiresIn: config.jwtTtlSeconds, user: { ...publicUser(u), permissions } };
  }

  const service = {
    publicUser,

    async createUser({ username, password, displayName, roles, region = 'ALL', enableMfa = false }, actor) {
      for (const r of roles) if (!rbac.roles[r]) throw errors.validation(`Unknown role ${r}`);
      const policy = checkPasswordPolicy(password);
      if (policy.length) throw errors.validation('Password policy', policy);
      if (await byUsername(username)) throw errors.conflict('Username already exists');
      const u = {
        id: `U-${crypto.randomUUID().slice(0, 8)}`, username: username.toLowerCase(), displayName, roles, region,
        passwordHash: hashPassword(password), totpSecret: enableMfa ? generateTotpSecret() : null, status: 'active',
        failedLogins: 0, lockedUntil: null, createdAt: clock.now().toISOString(), createdBy: actor.id,
      };
      await users.insert(u);
      await audit.record({ actor: actor.id, action: 'user.created', entityType: 'user', entityId: u.id, details: { roles, region } });
      return { user: publicUser(u), totpSecret: u.totpSecret };
    },

    async list() {
      return (await users.find({ orderBy: ['username', 'asc'], limit: 1000 })).map(publicUser);
    },

    async update(id, { roles, region, status }, actor) {
      const u = await users.get(id);
      if (!u) throw errors.notFound('User');
      if (roles) for (const r of roles) if (!rbac.roles[r]) throw errors.validation(`Unknown role ${r}`);
      if (id === actor.id && roles && !roles.includes('admin')) throw errors.rule('You cannot remove your own admin role');
      const saved = await users.update({ ...u, roles: roles || u.roles, region: region || u.region, status: status || u.status });
      await audit.record({ actor: actor.id, action: 'user.updated', entityType: 'user', entityId: id, details: { roles: saved.roles, region: saved.region, status: saved.status } });
      return publicUser(saved);
    },

    /** Step 1: password. Returns tokens, or an MFA challenge when MFA is enrolled/required. */
    async login({ username, password }, { ip } = {}) {
      const u = await byUsername(username);
      const fail = async (reason) => {
        if (u) {
          const failedLogins = (u.failedLogins || 0) + 1;
          const lockedUntil = failedLogins >= config.lockout.maxFailures ? new Date(Date.now() + config.lockout.minutes * 60000).toISOString() : u.lockedUntil;
          await users.update({ ...u, failedLogins, lockedUntil });
        }
        await audit.record({ actor: u?.id || 'anonymous', action: 'auth.login_failed', entityType: 'user', entityId: u?.id || null, details: { reason, ip } });
        return errors.unauthenticated('Invalid username or password');
      };
      if (!u) {
        verifyPassword(password, hashPassword('timing-equaliser-x')); // equalise timing for unknown users
        throw await fail('unknown_user');
      }
      if (u.status !== 'active') throw await fail('inactive');
      if (u.lockedUntil && new Date(u.lockedUntil) > new Date()) {
        await audit.record({ actor: u.id, action: 'auth.login_locked', entityType: 'user', entityId: u.id, details: { ip } });
        throw errors.locked();
      }
      if (!verifyPassword(password, u.passwordHash)) throw await fail('bad_password');

      const mfaRequired = u.roles.some((r) => config.mfaRequiredRoles.includes(r));
      if (u.totpSecret || mfaRequired) {
        if (!u.totpSecret) throw errors.forbidden('MFA enrolment required for your role — contact an administrator');
        const mfaToken = signJwt({ sub: u.id, aud: 'mfa' }, config.jwtSecret, 300);
        return { mfaRequired: true, mfaToken };
      }
      return service.completeLogin(u, ip);
    },

    /** Step 2: TOTP code. */
    async verifyMfa({ mfaToken, code }, { ip } = {}) {
      const claims = verifyJwt(mfaToken, config.jwtSecret, { audience: 'mfa' });
      if (!claims) throw errors.unauthenticated('MFA session expired — sign in again');
      const u = await users.get(claims.sub);
      if (!u || !u.totpSecret) throw errors.unauthenticated();
      if (!verifyTotp(u.totpSecret, code)) {
        await audit.record({ actor: u.id, action: 'auth.mfa_failed', entityType: 'user', entityId: u.id, details: { ip } });
        const failedLogins = (u.failedLogins || 0) + 1;
        await users.update({ ...u, failedLogins, lockedUntil: failedLogins >= config.lockout.maxFailures ? new Date(Date.now() + config.lockout.minutes * 60000).toISOString() : u.lockedUntil });
        throw errors.unauthenticated('Invalid code');
      }
      return service.completeLogin(u, ip);
    },

    async completeLogin(u, ip) {
      const fresh = await users.get(u.id);
      await users.update({ ...fresh, failedLogins: 0, lockedUntil: null, lastLoginAt: clock.now().toISOString() });
      await audit.record({ actor: u.id, action: 'auth.login', entityType: 'user', entityId: u.id, details: { ip } });
      return issue(fresh);
    },

    async changePassword(userId, { currentPassword, newPassword }) {
      const u = await users.get(userId);
      if (!u || !verifyPassword(currentPassword, u.passwordHash)) throw errors.unauthenticated('Current password is incorrect');
      const policy = checkPasswordPolicy(newPassword);
      if (policy.length) throw errors.validation('Password policy', policy);
      await users.update({ ...u, passwordHash: hashPassword(newPassword), passwordChangedAt: clock.now().toISOString() });
      await audit.record({ actor: userId, action: 'auth.password_changed', entityType: 'user', entityId: userId });
      return { ok: true };
    },

    logout(claims) {
      revoked.set(claims.jti, claims.exp);
      for (const [k, exp] of revoked) if (exp * 1000 < Date.now()) revoked.delete(k);
      return { ok: true };
    },

    /** Resolve a bearer token into a principal (or null). */
    async authenticate(token) {
      const c = verifyJwt(token, config.jwtSecret);
      if (!c || revoked.has(c.jti)) return null;
      if (c.aud === 'customer') return { id: c.sub, roles: ['customer'], customerId: c.customerId, region: null, claims: c };
      if (c.aud !== 'staff') return null;
      const u = await users.get(c.sub);
      if (!u || u.status !== 'active') return null;
      return { id: u.id, username: u.username, roles: u.roles, region: u.region, claims: c };
    },

    async getTotpSecretForDemo(username) {
      if (!config.demoMode) throw errors.forbidden();
      const u = await byUsername(username);
      return u?.totpSecret || null;
    },

    byUsername,
  };
  return service;
}

module.exports = { createIdentityService };
