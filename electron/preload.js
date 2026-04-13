const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electronAPI", {
  // Get list of available printers
  getPrinters: () => ipcRenderer.invoke("get-printers"),
  // Print HTML silently to a specific printer
  printSilent: (html, printerName) => ipcRenderer.invoke("print-silent", html, printerName),
  // Check if running in Electron
  isElectron: true,
});
