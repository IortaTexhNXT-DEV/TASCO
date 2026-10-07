'use strict';

const crypto = require('crypto');
const { errors } = require('../../shared/errors');

/**
 * Sandbox implementations of the outbound ports. Each real adapter (VETC wallet
 * API, TASCO core policy admin, Zalo ZNS, SMS brandname, FCM/APNs push, SIP/
 * voice-AI vendor) implements the same method signatures — see
 * docs/architecture/integration-architecture.pdf for the contracts.
 */

/** Port: PaymentGateway — VETC wallet debit with idempotency. */
function createVetcWalletGateway({ failRate = 0 } = {}) {
  const processed = new Map();
  return {
    name: 'vetc-wallet',
    async debit({ idempotencyKey, customerId, amount, description }) {
      if (processed.has(idempotencyKey)) return processed.get(idempotencyKey);
      if (Math.random() < failRate) throw errors.upstream('VETC wallet timeout');
      if (!Number.isInteger(amount) || amount <= 0) throw errors.validation('amount must be a positive integer');
      const res = { transactionId: `VW-${crypto.randomUUID().slice(0, 12)}`, status: 'captured', amount, customerId, description, at: new Date().toISOString() };
      processed.set(idempotencyKey, res);
      return res;
    },
    async refund({ transactionId, amount }) {
      return { refundId: `VR-${crypto.randomUUID().slice(0, 12)}`, transactionId, amount, status: 'refunded' };
    },
  };
}

/** Port: PolicyAdministration — TASCO core issues policy + e-certificate. */
function createTascoCoreGateway({ publicBaseUrl }) {
  let seq = 100000;
  return {
    name: 'tasco-core',
    async issuePolicy({ product, plate, holderName, startDate, endDate, premiumNet, vat, orderId, coreQuoteRef = null }) {
      seq++;
      const certNo = `TAS-${product.replace(/_/g, '').slice(0, 6)}-${new Date().getUTCFullYear()}-${seq}`;
      return {
        policyNo: `POL-${seq}`,
        certNo,
        product,
        plate,
        holderName,
        startDate,
        endDate,
        premiumNet,
        vat,
        orderId,
        coreQuoteRef, // a real core binds exactly the quote it priced
        certificateUrl: `${publicBaseUrl}/verify/${encodeURIComponent(certNo)}`,
        issuedAt: new Date().toISOString(),
      };
    },
    async cancelPolicy({ policyNo, reason }) {
      return { policyNo, status: 'cancelled', reason };
    },
  };
}

/** Port: NotificationChannel — app push / Zalo ZNS / SMS. */
function createNotificationGateway({ channel, failRate = 0 }) {
  return {
    name: channel,
    async send({ to, text, templateKey, idempotencyKey }) {
      if (Math.random() < failRate) throw errors.upstream(`${channel} provider error`);
      return { providerMessageId: `${channel}-${crypto.createHash('sha1').update(String(idempotencyKey)).digest('hex').slice(0, 12)}`, status: 'accepted', to: to ? '[set]' : null, templateKey, length: text.length };
    },
  };
}

module.exports = { createVetcWalletGateway, createTascoCoreGateway, createNotificationGateway };
