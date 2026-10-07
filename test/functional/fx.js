'use strict';

/** Shared fixtures for the functional acceptance suites (one test per user-story scenario). */
const { makeContainer, startServer, findProfile } = require('../helpers');

async function setup(env) {
  const c = await makeContainer({ env });
  const srv = await startServer(c);
  const tokens = {};
  const as = async (user) => { tokens[user] = tokens[user] || await srv.login(user); return tokens[user]; };
  const customer = async (profileId) => (await srv.call('POST', '/api/customer/session', { body: { link: c.links.sign(profileId) } })).body.token;
  const profile = (pred) => findProfile(c, pred);
  const plateSpoken = (p) => p.plate.replace('-', ' ').replace('.', ' ');
  return { c, srv, as, customer, profile, plateSpoken, call: srv.call };
}

const individual = (x) => !x.anonymised && x.ownerType === 'individual';

module.exports = { setup, individual };
