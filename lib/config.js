const path = require('path');
const { promises: fs, readFileSync } = require('fs');
const _ = require('lodash');

const is = require('./is.js');
const root = require('./root.js');
const name = 'config';
const { info, error } = require('./log.js')(name);
const isomorphic = require('./isomorphic.js');
const pkg = require('../package.json');

const location = process.env[`${pkg.name.toUpperCase().replace(/-/g, '_')}_CONFIG_PATH`] || path.resolve(is.prod ? is.appData : root, `.${pkg.name}-config.json`);
const directory = path.dirname(location);

let configObj = {
  version: '1.0.0'
};

if (is.main) {
  try {
    const file = readFileSync(location, 'utf8');
    Object.assign(configObj, JSON.parse(file));
  } catch (e) {
    error('count not read config file, a new one will be created');
  }
}

const perform = ((operation) => {
  return func => new Promise((resolve, reject) => {
    operation = operation.finally(() => func().then(resolve).catch(reject));
  });
})(Promise.resolve());


const autoSave = _.debounce(() => {
  info('auto saving');

  implementation.write().then(() => {
    info('auto save done');
  }).catch((err) => {
    error('auto save error', err);
  });
}, 1000);

const tryRead = async () => {
  try {
    return JSON.parse(await fs.readFile(location, 'utf8'));
  } catch (e) {
    return {};
  }
};

const mergeRead = async () => {
  configObj = Object.assign(await tryRead(), configObj);
  return configObj;
};

const implementation = {
  read: () => perform(async () => await mergeRead()),
  write: () => perform(async () => {
    const config = await mergeRead();
    await fs.mkdir(directory, { recursive: true });
    await fs.writeFile(location, JSON.stringify(config, null, 2));
  }),
  getProp: (name) => {
    return _.get(configObj, name);
  },
  setProp: (name, value) => {
    _.set(configObj, name, value);
    autoSave();
  }
};

module.exports = isomorphic({ name, implementation });
