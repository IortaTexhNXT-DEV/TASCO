'use strict';

const crypto = require('crypto');
const {
  hashPassword, verifyPassword, checkPasswordPolicy, signJwt, verifyJwt, generateTotpSecret, matchTotpStep, otpauthUri, totp,
} = require('../shared/crypto');
const { errors } = require('../shared/errors');

/**
 * Staff identity: password + TOTP MFA (self-enrolment, replay protection),
 * account lockout across both factors, short-lived JWTs with revocation on
 * logout / password or role change, and separation-of-duties checks.
 * In production this federates to TASCO's IdP (OIDC) — see ADR-007.
 */

function createIdentityService({ store, audit, config, clock, rbac }) {
  const users = store.collection('users');
  const revoked = new Map(); // jti → exp (per replica; production: shared cache, see ADR-007)

  const publicUser = (u) => ({
    id: u.id, username: u.username, displayName: u.displayName, roles: u.roles, region: u.region,
    mfaEnabled: !!u.totpSecret && !!u.mfaEnrolled, status: u.status, lastLoginAt: u.lastLoginAt || null,
  });

  async function byUsername(username) {
    const [u] = await users.find({ where: { username: String(username).toLowerCase() }, limit: 1 });
    return u || null;
  }

  function assertSoD(roles) {
    for (const r of roles) if (!rbac.roles[r]) throw errors.validation(`Unknown role ${r}`);
    for (const [a, b] of rbac.separationOfDuties || []) {
      if (roles.includes(a) && roles.includes(b)) throw errors.rule(`Separation of duties: ${a} and ${b} cannot be held by the same person`);
    }
  }

  function issue(u) {
    const permissions = [...new Set(u.roles.flatMap((r) => rbac.roles[r] || []))];
    const accessToken = signJwt(
      { sub: u.id, roles: u.roles, region: u.region, aud: 'staff', amr: u.mfaEnrolled ? ['pwd', 'otp'] : ['pwd'] },
      config.jwtSecret,
      config.jwtTtlSeconds,
    );
    return { accessToken, expiresIn: config.jwtTtlSeconds, user: { ...publicUser(u), permissions } };
  }

  const isLocked = (u) => u.lockedUntil && new Date(u.lockedUntil) > new Date();

  async function registerFailure(u, action, details) {
    const failedLogins = (u.failedLogins || 0) + 1;
    const lockedUntil = failedLogins >= config.lockout.maxFailures ? new Date(Date.now() + config.lockout.minutes * 60000).toISOString() : u.lockedUntil;
    await users.update({ ...u, failedLogins, lockedUntil });
    await audit.record({ actor: u.id, action, entityType: 'user', entityId: u.id, details });
  }

  const service = {
    publicUser,

    /**
     * Create a user. The TOTP seed is never shown to the administrator: the user
     * enrols their own authenticator at first sign-in (no admin impersonation).
     */
    async createUser({ username, password, displayName, roles, region = 'ALL', enableMfa = false, preEnrolled = false }, actor) {
      assertSoD(roles);
      const policy = checkPasswordPolicy(password);
      if (policy.length) throw errors.validation('Password policy', policy);
      if (await byUsername(username)) throw errors.conflict('Username already exists');
      const mfaRequired = roles.some((r) => config.mfaRequiredRoles.includes(r));
      const u = {
        id: `U-${crypto.randomUUID().slice(0, 8)}`, username: username.toLowerCase(), displayName, roles, region,
        passwordHash: hashPassword(password), totpSecret: enableMfa || mfaRequired ? generateTotpSecret() : null,
        mfaEnrolled: !!preEnrolled && actor.id === 'system', mustChangePassword: actor.id !== 'system',
        status: 'active', failedLogins: 0, lockedUntil: null, lastTotpStep: null, tokensValidAfter: null,
        createdAt: clock.now().toISOString(), createdBy: actor.id,
      };
      await users.insert(u);
      await audit.record({ actor: actor.id, action: 'user.created', entityType: 'user', entityId: u.id, details: { roles, region, mfa: !!u.totpSecret } });
      return { user: publicUser(u) };
    },

    async list() {
      return (await users.find({ orderBy: ['username', 'asc'], limit: 1000 })).map(publicUser);
    },

    async update(id, { roles, region, status }, actor) {
      const u = await users.get(id);
      if (!u) throw errors.notFound('User');
      if (id === actor.id && (roles || status)) throw errors.rule('You cannot change your own roles or status');
      if (roles) assertSoD(roles);
      const changed = (roles && JSON.stringify(roles) !== JSON.stringify(u.roles)) || (status && status !== u.status) || (region && region !== u.region);
      const saved = await users.update({
        ...u, roles: roles || u.roles, region: region || u.region, status: status || u.status,
        // Role / status / region changes take effect immediately: existing tokens are invalidated.
        tokensValidAfter: changed ? clock.now().toISOString() : u.tokensValidAfter,
      });
      await audit.record({ actor: actor.id, action: 'user.updated', entityType: 'user', entityId: id, details: { roles: saved.roles, region: saved.region, status: saved.status } });
      return publicUser(saved);
    },

    /** Service-desk actions: unlock and/or force MFA re-enrolment (never reveals seeds). */
    async reset(id, { unlock, resetMfa }, actor) {
      const u = await users.get(id);
      if (!u) throw errors.notFound('User');
      if (id === actor.id) throw errors.rule('Ask another administrator to reset your own account');
      const next = { ...u };
      if (unlock) Object.assign(next, { failedLogins: 0, lockedUntil: null });
      if (resetMfa) Object.assign(next, { totpSecret: generateTotpSecret(), mfaEnrolled: false, lastTotpStep: null, tokensValidAfter: clock.now().toISOString() });
      const saved = await users.update(next);
      await audit.record({ actor: actor.id, action: 'user.reset', entityType: 'user', entityId: id, details: { unlock: !!unlock, resetMfa: !!resetMfa } });
      return publicUser(saved);
    },

    /** Step 1: password → tokens, an MFA challenge, or MFA self-enrolment. */
    async login({ username, password }, { ip } = {}) {
      const u = await byUsername(username);
      if (!u) {
        verifyPassword(password, hashPassword('timing-equaliser-x')); // equalise timing for unknown users
        await audit.record({ actor: 'anonymous', action: 'auth.login_failed', entityType: 'user', details: { reason: 'unknown_user', ip } });
        throw errors.unauthenticated('Invalid username or password');
      }
      if (isLocked(u)) {
        await audit.record({ actor: u.id, action: 'auth.login_locked', entityType: 'user', entityId: u.id, details: { ip } });
        throw errors.locked();
      }
      if (u.status !== 'active' || !verifyPassword(password, u.passwordHash)) {
        await registerFailure(u, 'auth.login_failed', { reason: u.status !== 'active' ? 'inactive' : 'bad_password', ip });
        throw errors.unauthenticated('Invalid username or password');
      }
      const mfaRequired = u.roles.some((r) => config.mfaRequiredRoles.includes(r));
      let current = u;
      if (mfaRequired && !u.totpSecret) current = await users.update({ ...u, totpSecret: generateTotpSecret(), mfaEnrolled: false });
      if (current.totpSecret) {
        const mfaToken = signJwt({ sub: u.id, aud: 'mfa' }, config.jwtSecret, 300);
        if (!current.mfaEnrolled) {
          // Self-enrolment: only the person who knows the password sees the seed, once per challenge.
          return { mfaRequired: true, mfaEnrolment: true, mfaToken, otpauthUri: otpauthUri({ secret: current.totpSecret, account: u.username }) };
        }
        return { mfaRequired: true, mfaToken };
      }
      return service.completeLogin(current, ip);
    },

    /** Step 2: TOTP code (also completes enrolment). Lockout and replay-protected. */
    async verifyMfa({ mfaToken, code }, { ip } = {}) {
      const claims = verifyJwt(mfaToken, config.jwtSecret, { audience: 'mfa' });
      if (!claims) throw errors.unauthenticated('MFA session expired — sign in again');
      const u = await users.get(claims.sub);
      if (!u || !u.totpSecret || u.status !== 'active') throw errors.unauthenticated();
      if (isLocked(u)) throw errors.locked();
      const step = matchTotpStep(u.totpSecret, code);
      const replay = step !== null && u.lastTotpStep !== null && u.lastTotpStep !== undefined && step <= u.lastTotpStep;
      if (step === null || replay) {
        await registerFailure(u, 'auth.mfa_failed', { ip, replay });
        throw errors.unauthenticated(replay
          ? 'This code has already been used — wait for the next code in your authenticator app'
          : 'Invalid code — check the 6 digits and that your phone clock is correct');
      }
      const updated = await users.update({ ...u, lastTotpStep: step, mfaEnrolled: true });
      if (!u.mfaEnrolled) await audit.record({ actor: u.id, action: 'auth.mfa_enrolled', entityType: 'user', entityId: u.id });
      return service.completeLogin(updated, ip);
    },

    async completeLogin(u, ip) {
      const fresh = await users.get(u.id);
      const saved = await users.update({ ...fresh, failedLogins: 0, lockedUntil: null, lastLoginAt: clock.now().toISOString() });
      await audit.record({ actor: u.id, action: 'auth.login', entityType: 'user', entityId: u.id, details: { ip } });
      const out = issue(saved);
      if (saved.mustChangePassword) out.mustChangePassword = true;
      return out;
    },

    async changePassword(userId, { currentPassword, newPassword }) {
      const u = await users.get(userId);
      if (!u || !verifyPassword(currentPassword, u.passwordHash)) throw errors.unauthenticated('Current password is incorrect');
      const policy = checkPasswordPolicy(newPassword);
      if (policy.length) throw errors.validation('Password policy', policy);
      if (verifyPassword(newPassword, u.passwordHash)) throw errors.validation('Password policy', ['must differ from the current password']);
      const now = clock.now().toISOString();
      await users.update({ ...u, passwordHash: hashPassword(newPassword), passwordChangedAt: now, mustChangePassword: false, tokensValidAfter: now });
      await audit.record({ actor: userId, action: 'auth.password_changed', entityType: 'user', entityId: userId });
      return { ok: true, reauthenticate: true };
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
      if (c.aud === 'customer') {
        const p = await store.collection('profiles').get(c.customerId);
        if (!p || p.anonymised) return null; // erased data subjects lose their sessions
        return { id: c.sub, roles: ['customer'], customerId: c.customerId, region: null, claims: c };
      }
      if (c.aud !== 'staff') return null;
      const u = await users.get(c.sub);
      if (!u || u.status !== 'active') return null;
      if (u.tokensValidAfter && c.iat < Math.floor(new Date(u.tokensValidAfter).getTime() / 1000)) return null;
      return { id: u.id, username: u.username, roles: u.roles, region: u.region, claims: c };
    },

    /**
     * Demo/UAT only: the next code that will be accepted (never one already used,
     * so back-to-back sign-ins within one 30 s window still work).
     */
    async demoCode(username) {
      if (!config.demoMode) throw errors.forbidden();
      const u = await byUsername(username);
      if (!u?.totpSecret) return null;
      const now = Date.now();
      const current = Math.floor(now / 30000);
      const next = Math.max(current, (u.lastTotpStep ?? -1) + 1);
      if (next > current + 1) return { code: null, waitSeconds: 30 - (Math.floor(now / 1000) % 30) };
      return { code: totp(u.totpSecret, next * 30000), validForSeconds: (next - current + 1) * 30 - (Math.floor(now / 1000) % 30) };
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
