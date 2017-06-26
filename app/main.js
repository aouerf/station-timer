const { app, BrowserWindow, ipcMain } = require('electron');

/** @constant { boolean }
 *
 * Checks if the current environment is in development by looking for the asar package.
 * If the package exists, then the app is in production mode.
 * Otherwise (if it is not found), then the program is in development mode.
 */
const DEVELOPMENT = process.mainModule.filename.indexOf('app.asar') === -1;

let mainWindow = null;
let setupWindow = null;
let pauseWindow = null;

const initializeWindow = (windowType, windowName) => {
  windowType.loadURL(`file://${__dirname}/views/${windowName}.html`);
  windowType.setMenu(null);
  if (DEVELOPMENT) {
    windowType.webContents.openDevTools();
  }

  windowType.once('ready-to-show', windowType.show);
};

const exitApp = () => {
  // Do not exit the program on macOS (standard OS-specific behaviour).
  // Instead, lose app focus and close all open windows.
  if (process.platform === 'darwin') {
    app.hide();
    BrowserWindow.getAllWindows().forEach(win => win.close());
  } else {
    app.quit();
  }
};

const createMainWindow = () => {
  mainWindow = new BrowserWindow({
    fullscreen: true,
    frame: false,
  });
  initializeWindow(mainWindow, 'index');

  mainWindow.on('closed', () => (mainWindow = null));
};

const createSetupModalWindow = () => {
  setupWindow = new BrowserWindow({
    parent: mainWindow,
    modal: true,
    minWidth: 400,
    minHeight: 300,
    frame: false,
  });
  initializeWindow(setupWindow, 'setup');

  setupWindow.on('close', exitApp);

  setupWindow.on('closed', () => (setupWindow = null));
};

const createPauseModalWindow = () => {
  mainWindow.webContents.executeJavaScript('document.body.classList.add(\'dim\')');

  pauseWindow = new BrowserWindow({
    parent: mainWindow,
    modal: true,
    width: 400,
    height: 250,
    resizable: false,
    closable: false,
    frame: false,
  });
  initializeWindow(pauseWindow, 'pause');

  pauseWindow.on('close', exitApp);

  pauseWindow.on('closed', () => {
    mainWindow.webContents.executeJavaScript('document.body.classList.remove(\'dim\')');
    pauseWindow = null;
  });
};

const createStartWindows = () => {
  createMainWindow();
  createSetupModalWindow();
};

app.on('ready', createStartWindows);

app.on('window-all-closed', exitApp);

app.on('activate', createStartWindows);

ipcMain.on('setup-timer', (evt, settings) => mainWindow.webContents.send('start-timer', settings));

ipcMain.on('pause', createPauseModalWindow);

/**
 * Called after the pause window has been opened and it is safe to wait for a
 * synchronous reply before continuing the counter.
 * There is undoubtedly a better way of handling pause, but this works for now.
 *
 * @return  the false boolean value for the paused flag in mainWindow
 */
ipcMain.on('pause-wait', (evt) => {
  // If it has already been closed before this channel, then return immediately
  if (pauseWindow === null) {
    evt.returnValue = false;
  } else {
    pauseWindow.on('closed', () => (evt.returnValue = false));
  }
});

ipcMain.on('exit', exitApp);
