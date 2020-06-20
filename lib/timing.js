/* global performance */

const createLog = require('./log.js');

const slow = 100;

module.exports = function createTimer(name) {
  const log = createLog(name);

  return async ({ label, func }) => {
    const start = performance.now();
    const result = await func();
    const duration = performance.now() - start;

    if (label) {
      const msg = `${label}: ${duration.toFixed(2)}ms`;

      if (duration < slow) {
        log.info(msg);
      } else {
        log.warn(msg);
      }
    }

    return result;
  };
};
