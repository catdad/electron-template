const { name, productName, appId, version } = require('./package.json');

const fileName = productName.replace(/\s/g, '');

module.exports = {
  appId,
  productName,
  buildVersion: version,
  files: [
    '!assets/*',
    '!scripts/*',
    '!.*'
  ],
  mac: {
    target: [
      'dmg'
    ],
    icon: 'out/icon.icns',
    darkModeSupport: true
  },
  dmg: {
    icon: 'out/icon.icns',
    artifactName: `${fileName}-v\${version}-MacOS-setup.\${ext}`
  },
  win: {
    target: [
      'nsis',
      'portable'
    ],
    icon: 'out/icon.ico'
  },
  nsis: {
    artifactName: `${fileName}-v\${version}-Windows-setup.\${ext}`
  },
  portable: {
    artifactName: `${fileName}-v\${version}-Windows-portable.\${ext}`
  },
  linux: {
    icon: 'out/256x256.png',
    target: [
      'AppImage'
    ],
    executableName: productName,
    category: 'Network',
    asarUnpack: [
      'out/*.png'
    ]
  },
  appImage: {
    artifactName: `${fileName}-v\${version}-Linux.\${ext}`
  }
};
