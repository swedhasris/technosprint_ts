/**
 * Electron Preload Script
 * Exposes safe IPC bridge to the renderer (web app).
 * The web app calls window.electronAPI.captureScreen() to get a silent screenshot.
 */

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  /** Capture the entire screen silently — returns { dataUrl, width, height } */
  captureScreen: () => ipcRenderer.invoke('capture-screen'),

  /** Get list of available screens */
  getScreens: () => ipcRenderer.invoke('get-screens'),

  /** Check if running inside Electron */
  isElectron: true,

  /** Set main window always on top */
  setAlwaysOnTop: (flag) => ipcRenderer.invoke('set-always-on-top', flag),

  /** Expose 3D pet companion controls */
  updatePetStatus: (stateOrStatus, mood, entries) => {
    if (stateOrStatus && typeof stateOrStatus === 'object') {
      ipcRenderer.send('pet-overlay-update', stateOrStatus);
    } else {
      ipcRenderer.send('pet-overlay-update', { status: stateOrStatus, mood, entries });
    }
  },
  movePet: (x, y) => ipcRenderer.send('pet-overlay-move', { x, y }),
});

