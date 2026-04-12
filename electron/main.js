const { app, BrowserWindow, shell, dialog } = require("electron");
const { spawn } = require("child_process");
const path = require("path");
const http = require("http");
const fs = require("fs");
const net = require("net");

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

// ── Logging ──
const logDir = path.join(app.getPath("userData"), "logs");
if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true });
const logFile = path.join(logDir, "app.log");
// Truncate log on each start (keep only current session)
const logStream = fs.createWriteStream(logFile, { flags: "w" });

function log(msg) {
  const line = `[${new Date().toISOString()}] ${msg}`;
  console.log(line);
  logStream.write(line + "\n");
}

process.on("uncaughtException", (err) => {
  log(`UNCAUGHT: ${err.stack || err.message}`);
});

log(`App starting — version ${app.getVersion()}`);
log(`isPackaged: ${app.isPackaged}`);

// ── Paths ──
const dataDir = path.join(app.getPath("userData"), "data");
const runtimeDir = path.join(app.getPath("userData"), "server");

function getSourceDir() {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, "standalone");
  }
  return path.join(__dirname, "..", ".next", "standalone");
}

/** Recursively copy directory, renaming _node_modules → node_modules */
function copyDirSync(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const srcName = entry.name;
    // Rename _node_modules back to node_modules
    const destName = srcName === "_node_modules" ? "node_modules" : srcName;
    const srcPath = path.join(src, srcName);
    const destPath = path.join(dest, destName);
    if (entry.isDirectory()) {
      copyDirSync(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

/** Check if we need to re-extract (first run or version changed) */
function needsExtract() {
  const versionFile = path.join(runtimeDir, ".version");
  if (!fs.existsSync(versionFile)) return true;
  const installed = fs.readFileSync(versionFile, "utf-8").trim();
  return installed !== app.getVersion();
}

/** Extract standalone to writable userData directory */
function extractStandalone() {
  const sourceDir = getSourceDir();
  log(`Extracting standalone from ${sourceDir} → ${runtimeDir}`);

  // Remove old version
  if (fs.existsSync(runtimeDir)) {
    fs.rmSync(runtimeDir, { recursive: true, force: true });
  }

  copyDirSync(sourceDir, runtimeDir);

  // Write version marker
  fs.writeFileSync(path.join(runtimeDir, ".version"), app.getVersion());

  // Verify
  const nmExists = fs.existsSync(path.join(runtimeDir, "node_modules"));
  const nextExists = fs.existsSync(path.join(runtimeDir, "node_modules", "next"));
  log(`Extraction done. node_modules: ${nmExists}, next: ${nextExists}`);
}

// ── Server ──
function findFreePort() {
  return new Promise((resolve) => {
    const srv = net.createServer();
    srv.listen(0, () => {
      const port = srv.address().port;
      srv.close(() => resolve(port));
    });
  });
}

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
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  // Copy seed database if no local database exists (first install)
  const dbFile = path.join(dataDir, "dulce-fresita.db");
  if (!fs.existsSync(dbFile)) {
    const seedDb = path.join(runtimeDir, "scripts", "seed-database.db");
    if (fs.existsSync(seedDb)) {
      log("Copying seed database (first install)...");
      fs.copyFileSync(seedDb, dbFile);
      log("Seed database copied");
    } else {
      log("No seed database found — starting fresh");
    }
  }

  // Extract standalone to writable location (first run or update)
  if (needsExtract()) {
    log("Extracting standalone (first run or update)...");
    try {
      extractStandalone();
    } catch (e) {
      log(`FATAL extraction error: ${e.message}`);
      dialog.showErrorBox("Error", `No se pudo extraer la app:\n${e.message}\n\nLogs: ${logFile}`);
      app.quit();
      return;
    }
  } else {
    log("Standalone already extracted, skipping");
  }

  serverPort = await findFreePort();
  log(`Port: ${serverPort}`);

  const serverScript = path.join(runtimeDir, "server.js");
  log(`Server: ${serverScript}`);
  log(`Server exists: ${fs.existsSync(serverScript)}`);

  // Verify node_modules
  const nmCheck = path.join(runtimeDir, "node_modules", "next");
  log(`next module exists: ${fs.existsSync(nmCheck)}`);

  if (!fs.existsSync(serverScript)) {
    dialog.showErrorBox("Error", `server.js no encontrado\n\nLogs: ${logFile}`);
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

  // Use portable node.exe (bundled) instead of Electron's process
  const portableNode = path.join(runtimeDir, "_portable_node", "node.exe");
  const nodeExe = fs.existsSync(portableNode) ? portableNode : process.execPath;
  log(`Node executable: ${nodeExe} (portable: ${fs.existsSync(portableNode)})`);
  log("Starting server...");

  serverProcess = spawn(nodeExe, [serverScript], {
    cwd: runtimeDir,
    env,
    stdio: ["ignore", "pipe", "pipe"],
  });

  serverProcess.stdout.on("data", (d) => log(`[server:out] ${d.toString().trim()}`));
  serverProcess.stderr.on("data", (d) => log(`[server:err] ${d.toString().trim()}`));
  serverProcess.on("exit", (code) => {
    log(`[server] exited with code ${code}`);
    if (code !== 0 && code !== null) {
      dialog.showErrorBox("Error", `El servidor falló (código ${code})\n\nLogs: ${logFile}`);
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

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

// ── Auto-updater (lazy loaded) ──
function setupAutoUpdater() {
  let autoUpdater;
  try {
    autoUpdater = require("electron-updater").autoUpdater;
  } catch (e) {
    log(`[updater] Not available: ${e.message}`);
    return;
  }

  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;

  autoUpdater.on("update-available", (info) => {
    log(`[updater] Update available: ${info.version}`);
  });

  autoUpdater.on("update-downloaded", (info) => {
    log(`[updater] Downloaded: ${info.version}`);
    dialog.showMessageBox(mainWindow, {
      type: "info",
      title: "Actualización lista",
      message: `Nueva versión ${info.version} descargada. La app se reiniciará.`,
      buttons: ["Reiniciar ahora", "Después"],
    }).then((result) => {
      if (result.response === 0) autoUpdater.quitAndInstall();
    });
  });

  autoUpdater.on("error", (err) => {
    log(`[updater] Error: ${err.message}`);
  });

  autoUpdater.checkForUpdates().catch(() => {});
  setInterval(() => autoUpdater.checkForUpdates().catch(() => {}), 30 * 60 * 1000);
}

// ── Start ──
app.whenReady().then(async () => {
  try {
    await startServer();
    createWindow();
    setupAutoUpdater();
  } catch (err) {
    log(`FATAL: ${err.stack || err.message}`);
    dialog.showErrorBox("Error", `No se pudo iniciar:\n${err.message}\n\nLogs: ${logFile}`);
    app.quit();
  }
});

app.on("window-all-closed", () => {
  if (serverProcess) { serverProcess.kill(); serverProcess = null; }
  app.quit();
});

app.on("before-quit", () => {
  if (serverProcess) { serverProcess.kill(); serverProcess = null; }
});
