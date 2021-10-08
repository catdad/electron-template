const path = require('path');
const root = path.resolve(__dirname, '..');
const pkg = require(`${root}/package.json`);
const name = pkg.productName || pkg.name;
const appData = require('app-data-folder')(pkg.productName || pkg.name);

const isPackaged = (() => {
  if (
    process.mainModule &&
    process.mainModule.filename.indexOf('app.asar') !== -1
  ) {
    return true;
  }

  if (process.argv.filter(a => a.indexOf('app.asar') !== -1).length > 0) {
    return true;
  }

  return false;
})();

module.exports = {
  main: process.type === 'browser',
  renderer: process.type === 'renderer',
  worker: process.type === 'worker',
  prod: isPackaged,
  name,
  appData
};
