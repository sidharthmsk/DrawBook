const { contextBridge } = require("electron");

contextBridge.exposeInMainWorld("drawbook", {
  isElectron: true,
});
