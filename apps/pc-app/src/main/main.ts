import * as electron from 'electron';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { registerDesktopIpc } from './ipc.js';
import { configureUserDataPath } from './runtime-state.js';

const electronApi = (electron as typeof electron & { default?: typeof electron }).default ?? electron;
const { app, BrowserWindow, shell } = electronApi;

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const isDev = Boolean(process.env.QIUAI_PC_DEV_SERVER_URL);

configureUserDataPath();

async function createMainWindow() {
  const mainWindow = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 1100,
    minHeight: 720,
    title: 'QiuAI WorkOS',
    backgroundColor: '#f6f8fa',
    webPreferences: {
      preload: path.join(currentDir, '../preload/preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
      allowRunningInsecureContent: false
    }
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https://')) {
      void shell.openExternal(url);
    }

    return { action: 'deny' };
  });

  mainWindow.webContents.on('will-navigate', (event, url) => {
    const devUrl = process.env.QIUAI_PC_DEV_SERVER_URL;
    if (devUrl && url.startsWith(devUrl)) {
      return;
    }

    if (!devUrl && url.startsWith('file://')) {
      return;
    }

    event.preventDefault();
  });

  if (isDev && process.env.QIUAI_PC_DEV_SERVER_URL) {
    await mainWindow.loadURL(process.env.QIUAI_PC_DEV_SERVER_URL);
    mainWindow.webContents.openDevTools({ mode: 'detach' });
    return;
  }

  await mainWindow.loadFile(path.join(currentDir, '../renderer/index.html'));
}

app.whenReady().then(() => {
  registerDesktopIpc();
  void createMainWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      void createMainWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
