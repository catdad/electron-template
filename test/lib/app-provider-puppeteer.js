const { spawn } = require('child_process');
const path = require('path');

const puppeteer = require('puppeteer-core');
const getPort = require('get-port');
const electron = require('electron');
const fetch = require('node-fetch');

const pkg = require('../../package.json');
const configVar = `${pkg.name.toUpperCase().replace(/-/g, '_')}_CONFIG_PATH`;
const sleep = time => new Promise(resolve => setTimeout(() => resolve(), time));

const args = process.env.UNSAFE_CI ?
  ['--no-sandbox', '--disable-setuid-sandbox', '.'] :
  ['.'];

const waitForThrowable = async func => {
  const end = Date.now() + (1000 * 2);
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
  const port = await getPort();
  let stopped = false;

  const proc = spawn(electron, [`--remote-debugging-port=${port}`, ...args], {
    stdio: ['ignore', 'pipe', 'pipe'],
    cwd: path.resolve(__dirname, '../..'),
    env: {
      [configVar]: configPath
    }
  });

  proc.on('exit', code => {
    if (stopped) {
      return;
    }

    /* eslint-disable-next-line no-console */
    console.error('[electron process]', `exited with code: ${code}`);
  });
  proc.on('error', err => {
    if (stopped) {
      return;
    }

    /* eslint-disable-next-line no-console */
    console.error('[electron process]', err);
  });

  const stdout = [];
  const stderr = [];

  proc.stdout.on('data', chunk => stdout.push(chunk));
  proc.stderr.on('data', chunk => stderr.push(chunk));

  let browserWSEndpoint;

  await waitForThrowable(async () => {
    const res = await fetch(`http://localhost:${port}/json/version`);

    if (!res.ok) {
      throw new Error(`BAD /json/version respose: ${res.status} "${res.statusText}"`);
    }

    const json = JSON.parse(await res.text());
    browserWSEndpoint = json.webSocketDebuggerUrl;
  });

  const browser = await puppeteer.connect({ browserWSEndpoint });
  const pages = await browser.pages();
  const page = pages[0];

  _stop = async () => {
    stopped = true;
    await browser.disconnect();
    proc.kill();

    await new Promise(r => proc.once('exit', () => r()));
    _stop = null;
  };

  const api = {
    page,
    pages,
    utils: utils(page)
  };

  return api;
};

const stop = async () => {
  if (_stop) {
    await _stop().finally(() => {
      _stop = null;
    });
  }
};

module.exports = {
  start,
  stop,
  sleep
};
