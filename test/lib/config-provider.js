const fs = require('fs').promises;
const tempy = require('tempy');

const files = {};

const create = async configObj => {
  const file = tempy.file({ extension: 'json' });
  await clean(file);
  await fs.writeFile(file, JSON.stringify(configObj));

  files[file] = true;
  return file;
};

const clean = async file => {
  await fs.rm(file, { force: true });
  delete files[file];
};

const cleanAll = async () => {
  for (let file in files) {
    await clean(file);
  }
};

module.exports = { create, clean, cleanAll };
