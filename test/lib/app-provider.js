const { spawn } = require('child_process');
const path = require('path');

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

const args = (process.env.UNSAFE_CI || process.platform === 'linux') ?
  ['--no-sandbox', '--disable-setuid-sandbox', '.'] :
  ['.'];

const waitForThrowable = async (func, waitMs = 2000) => {
  const end = Date.now() + waitMs;
  let error;

  while (Date.now() < end) {
    await sleep(5);

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
  click: async selector => {
    const elem = await page.$(selector);
    await elem.click();
  },
  getText: async selector => {
    return await page.evaluate(s => document.querySelector(s).innerText, selector);
  },
  waitForVisible: async selector => {
    const pageRect = await page.evaluate(() => document.body.parentElement.getBoundingClientRect());

    await waitForThrowable(async () => {
      const elemRect = await page.evaluate((s) => document.querySelector(s).getBoundingClientRect(), selector);

      if (!isInView(pageRect, elemRect)) {
        throw new Error(`element "${selector}" is still not visible`);
      }
    });
  },
  waitForElementCount: async (selector, count = 1) => {
    await waitForThrowable(async () => {
      const elements = await page.$$(selector);

      if (elements.length === count) {
        return;
      }

      throw new Error(`expected ${count} of element "${selector}" but found ${elements.length}`);
    });
  }
});

let _stop;

const start = async (configPath = '') => {
  let app, browser, stopped = false;
  const userData = tempy.directory();
  await fs.ensureDir(userData);
  const port = await getPort();
  const stdchunks = [];

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

    if (browser) {
      await browser.disconnect();
      browser = null;
    }

    if (app) {
      app.kill();

      await new Promise(r => app.once('exit', () => r()));
      app = null;
    }

    await fs.remove(userData);

    _stop = null;
  };

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

  let browserWSEndpoint;

  await waitForThrowable(async () => {
    const res = await fetch(`http://localhost:${port}/json/version`);

    if (!res.ok) {
      throw new Error(`BAD /json/version respose: ${res.status} "${res.statusText}"`);
    }

    const json = JSON.parse(await res.text());
    browserWSEndpoint = json.webSocketDebuggerUrl;
  }, 6000);

  browser = await puppeteer.connect({ browserWSEndpoint, dumpio: true });
  const pages = await browser.pages();
  const page = pages[0];

  if (!page) {
    throw new Error('did not find a renderer when connecting to app');
  }

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
