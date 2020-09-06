const { spawn } = require('child_process');

const electron = require('electron');
const puppeteer = require('puppeteer-core');

const tempy = require('tempy');
const getPort = require('get-port');
const fs = require('fs-extra');
const fetch = require('node-fetch');
const waitForThrowable = require('wait-for-throwable');

const once = async (ev, name) => await new Promise(r => ev.once(name, v => r(v)));

const launch = async (args, options) => {
  let app, browser, stopped = false;
  const userData = tempy.directory();
  const stdchunks = [];

  const stopApp = async () => {
    if (app) {
      app.kill();

      await once(app, 'exit');
      app = null;
    }
  };

  const stopBrowser = async () => {
    if (browser) {
      await browser.disconnect();
      browser = null;
    }
  };

  const _getLogs = () => [].concat(stdchunks).map(c => c.toString());

  const _stop = async () => {
    stopped = true;

    await stopBrowser();
    await stopApp();
    await fs.remove(userData);
  };

  const browserWSEndpoint = await waitForThrowable(async () => {
    await stopApp();
    await fs.remove(userData);
    await fs.ensureDir(userData);

    const port = await getPort();

    app = spawn(electron, [
      `--remote-debugging-port=${port}`,
      '--enable-logging',
      '-v=0',
      `--user-data-dir=${userData}`,
      ...args
    ], {
      ...options,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: {
        // using all existing env variables is required for Linux
        ...process.env,
        ...options.env
      }
    });

    app.on('exit', code => {
      if (stopped) {
        return;
      }

      /* eslint-disable-next-line no-console */
      console.error('Electron process unexpected exit:', `exited with code: ${code}`);
    });
    app.on('error', err => {
      if (stopped) {
        return;
      }

      /* eslint-disable-next-line no-console */
      console.error('Electron process unexpected error:', err);
    });

    app.stdout.on('data', chunk => stdchunks.push(chunk));
    app.stderr.on('data', chunk => stdchunks.push(chunk));

    // watch for the logged message:
    // DevTools listening on ws://127.0.0.1:60030/devtools/browser/973afdb7-00af-4311-9663-c8833d51febb
    // also make sure that we can connect to the debug port
    return await waitForThrowable(async () => {
      const startedStr = _getLogs().join('').indexOf(`:${port}/devtools/`);

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

  await waitForThrowable(async () => {
    if (browser) {
      await stopBrowser();
    }

    browser = await puppeteer.connect({ browserWSEndpoint, dumpio: true });
    const pages = await browser.pages();
    const page = pages[0];

    if (!page) {
      throw new Error('did not find a renderer when connecting to app');
    }
  });

  return new Proxy(browser, {
    get: (target, key, receiver) => {
      if (key === 'close') {
        return _stop;
      }

      if (key === 'getLogs') {
        return _getLogs;
      }

      return Reflect.get(target, key, receiver);
    },
    set: (target, key, value, receiver) => {
      if (['close', 'getLogs'].includes(key)) {
        throw new Error(`cannot set read-only "${key}" property`);
      }

      Reflect.set(target, key, value, receiver);
    }
  });
};

module.exports = { launch };
