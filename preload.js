const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("presenter", {
  isElectron: true,
  getState: () => ipcRenderer.invoke("get-state"),
  command: (cmd) => ipcRenderer.invoke("timer-command", cmd),
  onState: (cb) => {
    const listener = (_event, state) => cb(state);
    ipcRenderer.on("state", listener);
    return () => ipcRenderer.removeListener("state", listener);
  },
  setIgnoreMouse: (ignore) => {
    ipcRenderer.send("set-ignore-mouse", ignore);
  },
  openControls: () => ipcRenderer.send("open-controls"),
  hideOverlay: () => ipcRenderer.send("hide-overlay"),
  getBounds: () => ipcRenderer.invoke("overlay-get-bounds"),
  setBounds: (bounds) => ipcRenderer.send("overlay-set-bounds", bounds),
});
