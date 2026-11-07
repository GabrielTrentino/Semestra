const { contextBridge, ipcRenderer } = require("electron");

const api = {
  setMode: (mode) => ipcRenderer.invoke("semestra:set-mode", mode),
  bubbleDragStart: () => ipcRenderer.invoke("semestra:bubble:drag-start"),
  bubbleDragEnd: () => ipcRenderer.invoke("semestra:bubble:drag-end"),
  hide: () => ipcRenderer.invoke("semestra:hide"),
  getState: () => ipcRenderer.invoke("semestra:get-state"),
  openExternal: (url) => ipcRenderer.invoke("semestra:open-external", url),
  runCode: (payload) => ipcRenderer.invoke("semestra:run-code", payload),
  checkRuntimes: () => ipcRenderer.invoke("semestra:check-runtimes"),
  data: {
    getLocation: () => ipcRenderer.invoke("semestra:data:get-location"),
    pickFolder: () => ipcRenderer.invoke("semestra:data:pick-folder"),
    read: () => ipcRenderer.invoke("semestra:data:read"),
    write: (state) => ipcRenderer.invoke("semestra:data:write", state),
    reveal: () => ipcRenderer.invoke("semestra:data:reveal"),
    saveImage: (payload) => ipcRenderer.invoke("semestra:data:save-image", payload),
  },
  onMode: (cb) => {
    const listener = (_e, mode) => cb(mode);
    ipcRenderer.on("semestra:mode", listener);
    return () => ipcRenderer.removeListener("semestra:mode", listener);
  },
};

contextBridge.exposeInMainWorld("semestra", api);
