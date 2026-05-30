/**
 * Electron Main Process
 * Wraps the Connect IT web app as a desktop application.
 * Provides silent full-screen capture via desktopCapturer (no browser dialog).
 */

const { app, BrowserWindow, ipcMain, desktopCapturer, screen } = require('electron');
const path = require('path');
const http = require('http');

let mainWindow = null;
const SERVER_URL = 'http://localhost:3000';

/* ── Wait for the server to be ready ── */
function waitForServer(url, timeout = 30000) {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    function check() {
      http.get(url, (res) => {
        resolve();
      }).on('error', () => {
        if (Date.now() - start > timeout) {
          reject(new Error('Server did not start in time'));
        } else {
          setTimeout(check, 500);
        }
      });
    }
    check();
  });
}

/* ── Create the main browser window ── */
function createWindow() {
  const { width, height } = screen.getPrimaryDisplay().workAreaSize;

  mainWindow = new BrowserWindow({
    width: Math.min(width, 1600),
    height: Math.min(height, 1000),
    minWidth: 1024,
    minHeight: 700,
    title: 'Connect IT',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: false, // allow localhost resources
    },
    show: false,
    backgroundColor: '#0f172a',
  });

  mainWindow.loadURL(SERVER_URL);

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    mainWindow.focus();
  });

  mainWindow.on('closed', () => { mainWindow = null; });
}

function getBestScreenSource(sources, preferredDisplayId) {
  const normalizedPreferredId = String(preferredDisplayId || '');

  const exactMatch = sources.find((source) => String(source.display_id || '') === normalizedPreferredId);
  if (exactMatch) return exactMatch;

  const largestSource = [...sources].sort((a, b) => {
    const aSize = a.thumbnail.getSize();
    const bSize = b.thumbnail.getSize();
    return (bSize.width * bSize.height) - (aSize.width * aSize.height);
  })[0];

  return largestSource || sources[0];
}

/* ── IPC: capture entire screen silently ── */
ipcMain.handle('capture-screen', async () => {
  try {
    const primaryDisplay = screen.getPrimaryDisplay();
    const captureWidth = Math.max(1, Math.floor(primaryDisplay.size.width * (primaryDisplay.scaleFactor || 1)));
    const captureHeight = Math.max(1, Math.floor(primaryDisplay.size.height * (primaryDisplay.scaleFactor || 1)));

    // Get all available screen sources
    const sources = await desktopCapturer.getSources({
      types: ['screen'],
      thumbnailSize: { width: captureWidth, height: captureHeight },
    });

    if (!sources || sources.length === 0) {
      return { error: 'No screen sources available' };
    }

    // Match the actual primary display instead of assuming the first source.
    const primarySource = getBestScreenSource(sources, primaryDisplay.id);
    const thumbnail = primarySource.thumbnail;

    // Convert NativeImage to JPEG buffer
    const jpegBuffer = thumbnail.toJPEG(85);
    const base64 = jpegBuffer.toString('base64');
    const dataUrl = `data:image/jpeg;base64,${base64}`;

    return {
      dataUrl,
      width: thumbnail.getSize().width,
      height: thumbnail.getSize().height,
      sourceName: primarySource.name,
      displayId: primarySource.display_id || null,
    };
  } catch (err) {
    console.error('[Electron] Screen capture failed:', err);
    return { error: err.message };
  }
});

/* ── IPC: set always on top state ── */
ipcMain.handle('set-always-on-top', async (event, flag) => {
  try {
    if (mainWindow) {
      mainWindow.setAlwaysOnTop(Boolean(flag), 'screen-saver');
      return { success: true };
    }
    return { error: 'No main window available' };
  } catch (err) {
    console.error('[Electron] Set always-on-top failed:', err);
    return { error: err.message };
  }
});


/* ── IPC: get all screens (for multi-monitor) ── */
ipcMain.handle('get-screens', async () => {
  try {
    const primaryDisplay = screen.getPrimaryDisplay();
    const sources = await desktopCapturer.getSources({
      types: ['screen'],
      thumbnailSize: { width: 320, height: 180 },
    });
    return sources.map(s => ({
      id: s.id,
      displayId: s.display_id || null,
      isPrimary: String(s.display_id || '') === String(primaryDisplay.id),
      name: s.name,
      thumbnail: s.thumbnail.toDataURL(),
    }));
  } catch (err) {
    return { error: err.message };
  }
});

/* ── App lifecycle ── */
app.whenReady().then(async () => {
  console.log('[Electron] Waiting for server at', SERVER_URL);
  try {
    await waitForServer(SERVER_URL);
    console.log('[Electron] Server ready — opening window');
  } catch (e) {
    console.warn('[Electron] Server wait timed out, opening anyway');
  }
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
