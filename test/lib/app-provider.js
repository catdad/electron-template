const path = require('path');

const { Application } = require('spectron');
const electronPath = require('electron');

const pkg = require('../../package.json');
const configVar = `${pkg.name.toUpperCase().replace(/-/g, '_')}_CONFIG_PATH`;

let app;

const sleep = time => new Promise(resolve => setTimeout(() => resolve(), time));

const log = (...args) => console.log(...args); // eslint-disable-line no-console

const args = process.env.UNSAFE_CI ?
  ['--no-sandbox', '--disable-setuid-sandbox', '.'] :
  ['.'];

const proxy = (client) => {
  const handler = {
    get: (obj, prop) => {
      if (prop in client) {
        return client[prop].bind(client);
      }

      return async (selector, ...args) => {
        const elem = await client.$(selector);

        if (elem[prop]) {
          return await elem[prop](...args);
        }

        throw new Error(`"${prop}" is not a known client or element method`);
      };
    }
  };

  return new Proxy({}, handler);
};

const start = async (configPath = '') => {
  app = new Application({
    path: electronPath,
    args: args,
    env: {
      [configVar]: configPath
    },
    cwd: path.resolve(__dirname, '../..'),
    waitTimeout: 5000
  });

  await app.start();

  await app.client.waitUntilWindowLoaded();

  app.legacy = proxy(app.client);

  return app;
};

const printLogs = async () => {
  log('\n---- start failure logs ----\n');

  try {
    log(await app.client.getMainProcessLogs());
    log(await app.client.getRenderProcessLogs());
  } catch (e) {
    log(e);
  }

  log('\n---- end failure logs ----\n');
};

const stop = async (logs) => {
  if (app && app.isRunning()) {
    if (logs) {
      await printLogs();
    }

    await app.stop();
    app = null;
  }
};

const ensureApp = (func) => (...args) => {
  if (!(app && app.isRunning())) {
    throw new Error('the application is not running');
  }

  return func(...args);
};

const wrapWebdriver = (name) => ensureApp((...args) => app.legacy[name](...args));

const waitForThrowable = ensureApp(async (func) => {
  let result, error;

  try {
    await app.client.waitUntil(async () => {
      try {
        result = await func();
      } catch (e) {
        error = e;
        return false;
      }

      error = null;
      return true;
    });
  } catch (e) {
    throw error || e;
  }

  return result;
});

const waitForVisible = ensureApp(async (selector) => {
  const elem = await app.client.$(selector);
  return await elem.waitForDisplayed();
});

const waitForElementCount = ensureApp(async (selector, count) => {
  let elements;

  await app.client.waitUntil(async () => {
    elements = await app.client.$$(selector);
    return elements.length === count;
  }, 1000, `did not find ${count} of element "${selector}"`);

  return elements;
});

const elementAttribute = ensureApp(async (element, attribute) => {
  const { value } = await app.client.elementIdAttribute(element.ELEMENT, attribute);
  return value;
});

module.exports = {
  start,
  stop,
  waitUntil: wrapWebdriver('waitUntil'),
  waitForVisible,
  waitForThrowable,
  waitForElementCount,
  elementAttribute,
  sleep
};
