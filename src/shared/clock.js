'use strict';

const { fmtDate } = require('./util');

/**
 * Injectable clock. Business "today" can be pinned (SIM_TODAY) for demos and
 * tests while timestamps stay real.
 */
function createClock(simToday) {
  return {
    now: () => new Date(),
    today: () => simToday || fmtDate(new Date()),
  };
}

module.exports = { createClock };
