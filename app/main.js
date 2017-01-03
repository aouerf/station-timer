const {app, BrowserWindow, ipcMain} = require('electron');

let mainWindow, setupWindow, pauseWindow;

function createMainWindow () {
  mainWindow = new BrowserWindow({
    fullscreen: true,
    frame: false
  });
  mainWindow.loadURL(`file://${__dirname}/views/index.html`);
  mainWindow.setMenu(null);

  mainWindow.once('ready-to-show', mainWindow.show);

  mainWindow.on('closed', () => mainWindow = null);
}

function createSetupModalWindow () {
  setupWindow = new BrowserWindow({
    parent: mainWindow,
    modal: true,
    minWidth: 400,
    minHeight: 300,
    frame: false
  });
  setupWindow.loadURL(`file://${__dirname}/views/setup.html`);
  setupWindow.setMenu(null);

  setupWindow.once('ready-to-show', setupWindow.show);

  setupWindow.on('close', exitApp);

  setupWindow.on('closed', () => setupWindow = null);
}

function createPauseModalWindow () {
  mainWindow.webContents.executeJavaScript(
    'document.body.classList.add(\'dim\')'
  );

  pauseWindow = new BrowserWindow({
    parent: mainWindow,
    modal: true,
    width: 400,
    height: 250,
    resizable: false,
    closable: false,
    frame: false
  });
  pauseWindow.loadURL(`file://${__dirname}/views/pause.html`);
  pauseWindow.setMenu(null);

  pauseWindow.once('ready-to-show', pauseWindow.show);

  pauseWindow.on('close', exitApp);

  pauseWindow.on('closed', () => {
    mainWindow.webContents.executeJavaScript(
      'document.body.classList.remove(\'dim\')'
    );
    pauseWindow = null;
  });
}

function createStartWindows () {
  createMainWindow();
  createSetupModalWindow();
}

function exitApp () {
  // Do not exit the program on macOS (standard OS-specific behaviour).
  // Instead, lose app focus and close all open windows.
  if (process.platform === 'darwin') {
    app.hide();
    BrowserWindow.getAllWindows().forEach(win => win.close());
  } else {
    app.quit();
  }
}

app.on('ready', createStartWindows);

app.on('window-all-closed', exitApp);

app.on('activate', createStartWindows);

ipcMain.on('setup-timer', (evt, settings) => 
  mainWindow.webContents.send('start-timer', settings)
);

ipcMain.on('pause', createPauseModalWindow);

/**
 * Called after the pause window has been opened and it is safe to wait for a
 * synchronous reply before continuing the counter.
 * There is undoubtedly a better way of handling pause, but this works for now.
 * 
 * @return  the false boolean value for the paused flag in mainWindow
 */
ipcMain.on('pause-wait', evt => {
  // If it has already been closed before this channel, then return immediately
  if (pauseWindow == null) {
    evt.returnValue = false;
  } else {
    pauseWindow.on('closed', () => evt.returnValue = false);
  }
});

ipcMain.on('exit', exitApp);
