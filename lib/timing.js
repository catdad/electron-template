/* global performance */

const createLog = require('./log.js');

const slow = 100;

function hrnow() {
  const hr = process.hrtime();
  return (hr[0] * 1e9 + hr[1]) / 1e6;
}

const now = () => typeof performance === 'undefined' ? hrnow() : performance.now();

module.exports = function createTimer(name) {
  const log = createLog(name);

  return async ({ label, func }) => {
    const start = now();
    const result = await func();
    const duration = now() - start;

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
