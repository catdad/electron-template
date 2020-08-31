const { spawn } = require('child_process');
const path = require('path');

const puppeteer = require('puppeteer-core');
const getPort = require('get-port');
const electron = require('electron');

const pkg = require('../../package.json');
const configVar = `${pkg.name.toUpperCase().replace(/-/g, '_')}_CONFIG_PATH`;
const sleep = time => new Promise(resolve => setTimeout(() => resolve(), time));

const args = process.env.UNSAFE_CI ?
  ['--no-sandbox', '--disable-setuid-sandbox', '.'] :
  ['.'];

let _stop;

const start = async (configPath = '') => {
  const port = await getPort();

  const proc = spawn(electron, [`--remote-debugging-port=${port}`, ...args], {
    stdio: ['ignore', 'pipe', 'pipe'],
    cwd: path.resolve(__dirname, '../..'),
    env: {
      [configVar]: configPath
    }
  });

  proc.on('exit', code => {
    /* eslint-disable-next-line no-console */
    console.error('[electron process]', `exited with code: ${code}`);
  });
  proc.on('error', err => {
    /* eslint-disable-next-line no-console */
    console.error('[electron process]', err);
  });

  const stdout = [];
  const stderr = [];

  proc.stdout.on('data', chunk => stdout.push(chunk));
  proc.stderr.on('data', chunk => stderr.push(chunk));

  const browser = await puppeteer.connect({ browserURL: `http://localhost:${port}` });
  const pages = await browser.pages();

  _stop = async () => {
    await browser.disconnect();
    proc.kill();

    await new Promise(r => proc.once('exit', () => r()));
    _stop = null;
  };

  return pages[0];
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
