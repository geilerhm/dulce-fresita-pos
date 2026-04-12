const { app, BrowserWindow, shell, dialog } = require("electron");
const { spawn } = require("child_process");
const path = require("path");
const http = require("http");
const fs = require("fs");
const net = require("net");

// ── Logging to file ──
const logDir = path.join(app.getPath("userData"), "logs");
if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true });
const logFile = path.join(logDir, "app.log");
const logStream = fs.createWriteStream(logFile, { flags: "a" });

function log(msg) {
  const line = `[${new Date().toISOString()}] ${msg}`;
  console.log(line);
  logStream.write(line + "\n");
}

process.on("uncaughtException", (err) => {
  log(`UNCAUGHT: ${err.stack || err.message}`);
});

log(`App starting — version ${app.getVersion()}`);
log(`userData: ${app.getPath("userData")}`);
log(`resourcesPath: ${process.resourcesPath || "N/A (dev)"}`);
log(`isPackaged: ${app.isPackaged}`);

let mainWindow = null;
let serverProcess = null;
let serverPort = 3456;

// Prevent multiple instances
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) { app.quit(); }

app.on("second-instance", () => {
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  }
});

// Paths
function getDataDir() {
  return path.join(app.getPath("userData"), "data");
}

function getServerDir() {
  // In packaged app, resources are in app.asar or extraResources
  const isPacked = app.isPackaged;
  if (isPacked) {
    return path.join(process.resourcesPath, "standalone");
  }
  return path.join(__dirname, "..", ".next", "standalone");
}

// Find a free port
function findFreePort() {
  return new Promise((resolve) => {
    const srv = net.createServer();
    srv.listen(0, () => {
      const port = srv.address().port;
      srv.close(() => resolve(port));
    });
  });
}

// Wait for server to be ready
function waitForServer(port, retries = 60) {
  return new Promise((resolve, reject) => {
    let attempts = 0;
    const check = () => {
      const req = http.get(`http://127.0.0.1:${port}/login`, (res) => {
        if (res.statusCode === 200 || res.statusCode === 304) resolve();
        else if (++attempts < retries) setTimeout(check, 500);
        else reject(new Error("Server did not respond"));
        res.resume();
      });
      req.on("error", () => {
        if (++attempts < retries) setTimeout(check, 500);
        else reject(new Error("Server did not start"));
      });
      req.setTimeout(2000, () => { req.destroy(); });
    };
    check();
  });
}

async function startServer() {
  const dataDir = getDataDir();
  log(`dataDir: ${dataDir}`);
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  serverPort = await findFreePort();
  log(`port: ${serverPort}`);

  const serverDir = getServerDir();
  log(`serverDir: ${serverDir}`);
  log(`serverDir exists: ${fs.existsSync(serverDir)}`);

  const serverScript = path.join(serverDir, "server.js");
  log(`serverScript: ${serverScript}`);
  log(`serverScript exists: ${fs.existsSync(serverScript)}`);

  // Log what's in the server directory
  try {
    const files = fs.readdirSync(serverDir);
    log(`serverDir contents: ${files.join(", ")}`);
    const nmPath = path.join(serverDir, "node_modules");
    if (fs.existsSync(nmPath)) {
      const mods = fs.readdirSync(nmPath);
      log(`node_modules count: ${mods.length}`);
      log(`node_modules has 'next': ${mods.includes("next")}`);
      log(`node_modules first 10: ${mods.slice(0, 10).join(", ")}`);
    } else {
      log(`node_modules NOT FOUND at ${nmPath}`);
    }
  } catch (e) {
    log(`Error reading serverDir: ${e.message}`);
  }

  if (!fs.existsSync(serverScript)) {
    log("FATAL: Server script not found");
    dialog.showErrorBox("Error", `server.js no encontrado en:\n${serverScript}\n\nLogs: ${logFile}`);
    app.quit();
    return;
  }

  const env = {
    ...process.env,
    PORT: String(serverPort),
    HOSTNAME: "127.0.0.1",
    DULCE_DB_PATH: dataDir,
    NODE_ENV: "production",
  };

  log(`Spawning: ${process.execPath} ${serverScript}`);

  serverProcess = spawn(process.execPath, [serverScript], {
    cwd: serverDir,
    env,
    stdio: ["ignore", "pipe", "pipe"],
  });

  serverProcess.stdout.on("data", (d) => log(`[server:out] ${d.toString().trim()}`));
  serverProcess.stderr.on("data", (d) => log(`[server:err] ${d.toString().trim()}`));
  serverProcess.on("exit", (code) => {
    log(`[server] exited with code ${code}`);
    if (code !== 0 && code !== null) {
      dialog.showErrorBox("Error", `El servidor se cerró con código ${code}\n\nLogs: ${logFile}`);
    }
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.loadURL("about:blank");
    }
  });

  await waitForServer(serverPort);
  log("Server ready!");
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    title: "Dulce Fresita",
    icon: path.join(__dirname, "..", "public", "icon-512.png"),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
    autoHideMenuBar: true,
    show: false,
  });

  mainWindow.loadURL(`http://127.0.0.1:${serverPort}`);

  mainWindow.once("ready-to-show", () => {
    mainWindow.show();
  });

  // Open external links in browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

// ── Auto-updater (lazy loaded — app works even if module is missing) ──
function setupAutoUpdater() {
  let autoUpdater;
  try {
    autoUpdater = require("electron-updater").autoUpdater;
  } catch (e) {
    log(`[updater] electron-updater not available: ${e.message}`);
    return;
  }

  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;

  autoUpdater.on("update-available", (info) => {
    console.log("[updater] Update available:", info.version);
    if (mainWindow) {
      mainWindow.webContents.executeJavaScript(
        `document.title = "Dulce Fresita — Actualizando..."`
      );
    }
  });

  autoUpdater.on("update-downloaded", (info) => {
    console.log("[updater] Update downloaded:", info.version);
    dialog.showMessageBox(mainWindow, {
      type: "info",
      title: "Actualización lista",
      message: `Nueva versión ${info.version} descargada. La app se reiniciará para actualizar.`,
      buttons: ["Reiniciar ahora", "Después"],
    }).then((result) => {
      if (result.response === 0) {
        autoUpdater.quitAndInstall();
      }
    });
  });

  autoUpdater.on("error", (err) => {
    console.warn("[updater] Error:", err.message);
  });

  // Check now and every 30 minutes
  autoUpdater.checkForUpdates().catch(() => {});
  setInterval(() => {
    autoUpdater.checkForUpdates().catch(() => {});
  }, 30 * 60 * 1000);
}

app.whenReady().then(async () => {
  try {
    await startServer();
    createWindow();
    setupAutoUpdater();
  } catch (err) {
    console.error("Failed to start:", err);
    app.quit();
  }
});

app.on("window-all-closed", () => {
  if (serverProcess) {
    serverProcess.kill();
    serverProcess = null;
  }
  app.quit();
});

app.on("before-quit", () => {
  if (serverProcess) {
    serverProcess.kill();
    serverProcess = null;
  }
});
