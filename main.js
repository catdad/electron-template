const path = require('path');
const url = require('url');
const EventEmitter = require('events');
const events = new EventEmitter();

const { app, BrowserWindow, ipcMain, screen, systemPreferences } = require('electron');

require('./lib/app-id.js')(app);
const icon = require('./lib/icon.js');
const log = require('./lib/log.js')('main');
const config = require('./lib/config.js');
const debounce = require('./lib/debounce.js');

log.info(`electron node version: ${process.version}`);

let mainWindow;
let stayAlive;

// macOS Mojave light/dark mode changed
const setMacOSTheme = () => {
  if (!(systemPreferences.setAppLevelAppearance && systemPreferences.isDarkMode)) {
    log.info('this system does not support setting app-level appearance');
    return;
  }

  const mode = systemPreferences.isDarkMode() ? 'dark' : 'light';
  log.info(`setting app-level appearance to ${mode}`);
  systemPreferences.setAppLevelAppearance(mode);
};

if (systemPreferences.subscribeNotification) {
  systemPreferences.subscribeNotification('AppleInterfaceThemeChangedNotification', setMacOSTheme);
  setMacOSTheme();
}

// TODO remove?
function onIpc(ev, data) {
  switch (true) {
    case data.type === 'dragstart':
      ev.sender.startDrag({
        file: data.filepath,
        icon: '' // icon is required :(
      });
  }
}

function getLocationOnExistingScreen() {
  const x = config.getProp('window.x');
  const y = config.getProp('window.y');
  const width = config.getProp('window.width') || 1000;
  const height = config.getProp('window.height') || 800;

  for (const { bounds } of screen.getAllDisplays()) {
    const xInBounds = x >= bounds.x && x <= bounds.x + bounds.width;
    const yInBounds = y >= bounds.y && y <= bounds.y + bounds.height;

    if (xInBounds && yInBounds) {
      return { x, y, width, height };
    }
  }

  return { width, height };
}

function createWindow () {
  Promise.all([
    config.read()
  ]).then(() => {
    const windowOptions = {
      ...getLocationOnExistingScreen(),
      backgroundColor: '#121212',
      darkTheme: true,
      webPreferences: {
        nodeIntegration: true,
        nodeIntegrationInWorker: true,
        webviewTag: true,
        contextIsolation: false,
      },
      icon: icon(),
      frame: process.platform === 'darwin' ? true : !config.getProp('experiments.framelessWindow')
    };

    if (process.platform === 'darwin' && config.getProp('experiments.framelessWindow')) {
      windowOptions.titleBarStyle = 'hidden';
    }

    // Create the browser window.
    mainWindow = new BrowserWindow(windowOptions);

    stayAlive = false;

    if (config.getProp('window.maximized')) {
      mainWindow.maximize();
    }

    mainWindow.loadURL(url.format({
      pathname: path.join(__dirname, 'public', 'index.html'),
      protocol: 'file:',
      slashes: true
    }));

    mainWindow.on('closed', () => {
      mainWindow = null;
    });

    const onBoundsChange = debounce(() => {
      if (mainWindow.isMaximized() || mainWindow.isMinimized()) {
        return;
      }

      const bounds = mainWindow.getBounds();

      config.setProp('window.x', bounds.x);
      config.setProp('window.y', bounds.y);
      config.setProp('window.width', bounds.width);
      config.setProp('window.height', bounds.height);
    }, 500);

    mainWindow.on('resize', onBoundsChange);
    mainWindow.on('move', onBoundsChange);

    mainWindow.on('maximize', () => {
      config.setProp('window.maximized', true);
    });

    mainWindow.on('unmaximize', () => {
      config.setProp('window.maximized', false);
    });

    ipcMain.on('message', onIpc);

    mainWindow.webContents.on('devtools-opened', () => {
      config.setProp('devToolsOpen', true);
    });

    mainWindow.webContents.on('devtools-closed', () => {
      config.setProp('devToolsOpen', false);
    });

    if (config.getProp('devToolsOpen')) {
      mainWindow.webContents.openDevTools();
    }

    events.on('reload', () => {
      mainWindow.reload();
    });

    events.on('reset', () => {
      stayAlive = true;

      log.info('reopening main window');
      mainWindow.once('close', () => {
        createWindow();
      });

      mainWindow.close();
      mainWindow = null;
    });
  }).catch((err) => {
    throw err;
  });
}

// It's common to need to do some cleanup before closing, so if
// you do, do it here
app.once('before-quit', () => {
  log.info(`${app.getName()} is closing, cleaning up`);
});

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on('ready', createWindow);

// Quit when all windows are closed.
app.on('window-all-closed', () => {
  // On OS X it is common for applications and their menu bar
  // to stay active until the user quits explicitly with Cmd + Q
  if (process.platform === 'darwin' || stayAlive) {
    events.removeAllListeners();
  } else {
    app.quit();
  }
});

app.on('activate', () => {
  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (mainWindow === null) {
    createWindow();
  }
});
