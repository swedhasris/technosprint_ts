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


// ── NEW: 3D Pet Overlay Window ──
let petOverlayWindow = null;

function getVirtualScreenBounds() {
  try {
    const displays = screen.getAllDisplays();
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    displays.forEach((display) => {
      const { x, y, width, height } = display.bounds;
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x + width > maxX) maxX = x + width;
      if (y + height > maxY) maxY = y + height;
    });
    return {
      x: minX,
      y: minY,
      width: maxX - minX,
      height: maxY - minY
    };
  } catch (err) {
    console.error('[Electron] Failed to get virtual screen bounds, falling back to primary:', err);
    const { width, height } = screen.getPrimaryDisplay().bounds;
    return { x: 0, y: 0, width, height };
  }
}

function createPetOverlay() {
  if (petOverlayWindow) return;

  const bounds = getVirtualScreenBounds();

  petOverlayWindow = new BrowserWindow({
    width: bounds.width,
    height: bounds.height,
    x: bounds.x,
    y: bounds.y,
    transparent: true,
    frame: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    focusable: false,
    resizable: false,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'pet-overlay-preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: false,
    }
  });

  petOverlayWindow.setAlwaysOnTop(true, 'screen-saver');
  petOverlayWindow.setIgnoreMouseEvents(true, { forward: true });
  petOverlayWindow.loadFile(path.join(__dirname, 'pet-overlay.html'));

  petOverlayWindow.on('closed', () => {
    petOverlayWindow = null;
  });
}

// IPC: tracker status or full state changed → forward to overlay
ipcMain.on('pet-overlay-update', (event, data) => {
  if (!petOverlayWindow) {
    createPetOverlay();
  }
  if (petOverlayWindow) {
    // Determine visibility from status or explicit visible flag
    const shouldShow = Boolean(data.visible || data.status === 'active');
    if (shouldShow) {
      if (!petOverlayWindow.isVisible()) {
        petOverlayWindow.showInactive();
      }
      // Re-assert always on top state to prevent other windows from covering it
      petOverlayWindow.setAlwaysOnTop(true, 'screen-saver');
    } else {
      petOverlayWindow.hide();
    }
    petOverlayWindow.webContents.send('pet-state', data);
  }
});

// IPC: dynamic click-through ignore coordination
ipcMain.on('pet-set-ignore-mouse-events', (event, ignore, options) => {
  if (petOverlayWindow && !petOverlayWindow.isDestroyed()) {
    petOverlayWindow.setIgnoreMouseEvents(ignore, options);
  }
});

// IPC: transparent overlay stop-tracker button clicked -> forward to main React app window
ipcMain.on('stop-tracker-click', () => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('stop-activity-tracker');
  }
});

// IPC: move pet to new position relative to main window (deprecated/no-op in global overlay mode)
ipcMain.on('pet-overlay-move', (event, { x, y }) => {
  // Safe no-op: in global overlay mode, the overlay window covers all displays
  // at the virtual coordinate origin, and the pet moves inside the HTML document.
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

  // Auto-adjust overlay bounds on monitor / resolution / layout changes safely after ready
  screen.on('display-metrics-changed', () => {
    if (petOverlayWindow) {
      try {
        const bounds = getVirtualScreenBounds();
        petOverlayWindow.setBounds(bounds);
      } catch (err) {
        console.error('[Electron] Failed to update overlay bounds on display changes:', err);
      }
    }
  });

  createWindow();
  createPetOverlay();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
      createPetOverlay();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
