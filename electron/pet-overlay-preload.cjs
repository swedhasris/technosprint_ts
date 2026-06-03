/**
 * Electron Preload Script for Pet Overlay
 * Bridges state, mood, and mouse interaction updates from the main process to the transparent overlay window.
 */

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('petBridge', {
  onStateChange: (callback) => {
    ipcRenderer.on('pet-state', (event, data) => {
      callback(data);
    });
  },
  setIgnoreMouseEvents: (ignore, options) => {
    ipcRenderer.send('pet-set-ignore-mouse-events', ignore, options);
  },
  stopTracker: () => {
    ipcRenderer.send('stop-tracker-click');
  }
});
