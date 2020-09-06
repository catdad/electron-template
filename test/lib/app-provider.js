const { spawn } = require('child_process');
const path = require('path');

const { expect } = require('chai');
const puppeteer = require('puppeteer-core');
const getPort = require('get-port');
const electron = require('electron');
const fetch = require('node-fetch');
const chalk = require('chalk');
const fs = require('fs-extra');
const tempy = require('tempy');

const pkg = require('../../package.json');
const configVar = `${pkg.name.toUpperCase().replace(/-/g, '_')}_CONFIG_PATH`;
const sleep = time => new Promise(resolve => setTimeout(() => resolve(), time));

const args = process.env.UNSAFE_CI ?
  ['--no-sandbox', '--disable-setuid-sandbox', '.'] :
  ['.'];

const waitForThrowable = async (func, { interval = 5, total = 2000, count = Infinity } = {}) => {
  const end = Date.now() + total;
  let error;
  let c = 0;

  while (Date.now() < end || c < count) {
    c += 1;
    await sleep(interval);

    try {
      return await func();
    } catch (e) {
      error = e;
    }
  }

  if (error) {
    throw error;
  }
};

function isInView(containerBB, elBB) {
  return (!(
    elBB.top >= containerBB.bottom ||
    elBB.left >= containerBB.right ||
    elBB.bottom <= containerBB.top ||
    elBB.right <= containerBB.left
  ));
}

const utils = page => ({
  waitForThrowable,
  click: async selector => await page.click(selector),
  getRect: async selector => await page.evaluate(s => document.querySelector(s).getBoundingClientRect(), selector),
  getText: async selector => {
    return await page.evaluate(s => document.querySelector(s).innerText, selector);
  },
  waitForVisible: async selector => {
    const { getRect } = utils(page);
    const pageRect = await getRect('body');

    await waitForThrowable(async () => {
      const elemRect = await getRect(selector);

      if (!isInView(pageRect, elemRect)) {
        throw new Error(`element "${selector}" is still not visible`);
      }
    });
  },
  waitForElementCount: async (selector, count = 1) => {
    await waitForThrowable(async () => {
      const elements = await page.$$(selector);
      const errStr = `expected ${count} of element "${selector}" but found ${elements.length}`;

      expect(elements.length, errStr).to.equal(count);
    });
  }
});

let _stop;

const start = async (configPath = '') => {
  let app, browser, stopped = false;
  const userData = tempy.directory();
  const port = await getPort();
  const stdchunks = [];

  const stopApp = async () => {
    if (app) {
      app.kill();

      await new Promise(r => app.once('exit', () => r()));
      app = null;
    }
  };

  const stopBrowser = async () => {
    if (browser) {
      await browser.disconnect();
      browser = null;
    }
  };

  _stop = async (printLogs) => {
    stopped = true;

    if (printLogs) {
      const logs = stdchunks.map(c => c.toString()).map(str => {
        const clean = str.replace(/^\[[0-9:/.]+INFO:CONSOLE\([0-9]+\)\]\s{0,}/, '');

        return clean === str ? chalk.yellow(str) : chalk.cyan(clean);
      }).join('');

      /* eslint-disable-next-line no-console */
      console.log(logs);
    }

    await stopBrowser();
    await stopApp();
    await fs.remove(userData);

    _stop = null;
  };

  const browserWSEndpoint = await waitForThrowable(async () => {
    await stopApp();
    await fs.remove(userData);
    await fs.ensureDir(userData);

    app = spawn(electron, [
      `--remote-debugging-port=${port}`,
      '--enable-logging',
      '-v=0',
      `--user-data-dir=${userData}`,
      ...args
    ], {
      stdio: ['ignore', 'pipe', 'pipe'],
      cwd: path.resolve(__dirname, '../..'),
      env: {
        // using all existing env variables is required for Linux
        ...process.env,
        [configVar]: configPath
      }
    });

    app.on('exit', code => {
      if (stopped) {
        return;
      }

      /* eslint-disable-next-line no-console */
      console.error('[electron process]', `exited with code: ${code}`);
    });
    app.on('error', err => {
      if (stopped) {
        return;
      }

      /* eslint-disable-next-line no-console */
      console.error('[electron process]', err);
    });

    app.stdout.on('data', chunk => stdchunks.push(chunk));
    app.stderr.on('data', chunk => stdchunks.push(chunk));

    // watch for the logged message:
    // DevTools listening on ws://127.0.0.1:60030/devtools/browser/973afdb7-00af-4311-9663-c8833d51febb
    // also make sure that we can connect to the debug port
    return await waitForThrowable(async () => {
      const startedStr = stdchunks.map(c => c.toString()).join('').indexOf(`:${port}/devtools/`);

      if (startedStr < 0) {
        throw new Error('devtools not listening yet');
      }

      const res = await fetch(`http://localhost:${port}/json/version`);

      if (!res.ok) {
        throw new Error(`BAD /json/version respose: ${res.status} "${res.statusText}"`);
      }

      const json = JSON.parse(await res.text());

      return json.webSocketDebuggerUrl;
    }, { total: 5000 });
  }, { count: 3, total: Infinity });

  const { page, pages } = await waitForThrowable(async () => {
    if (browser) {
      await browser.disconnect();
      browser = null;
    }

    browser = await puppeteer.connect({ browserWSEndpoint, dumpio: true });
    const pages = await browser.pages();
    const page = pages[0];

    if (!page) {
      throw new Error('did not find a renderer when connecting to app');
    }

    return { pages, page };
  });

  const api = {
    page,
    pages,
    utils: utils(page)
  };

  return api;
};

const stop = async (...args) => {
  if (_stop) {
    await _stop(...args);
  }
};

module.exports = {
  start,
  stop,
  sleep
};
