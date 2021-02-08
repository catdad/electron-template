const path = require('path');

const iconMap = {
  'win32-runtime': 'icons/icon.ico',
  'linux-runtime': 'icons/32x32.png',
  'linux-build': 'icons/256x256.png',
  'darwin-runtime': 'icons/icon.icns'
};

module.exports = (type = 'runtime') => {
  const iconName = iconMap[`${process.platform}-${type}`] || iconMap[`${process.platform}-runtime`];

  if (iconName) {
    return path.resolve(__dirname, '..', iconName);
  }
};
