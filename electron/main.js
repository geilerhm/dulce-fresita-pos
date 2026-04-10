const { app, BrowserWindow, shell } = require("electron");
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
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  serverPort = await findFreePort();
  const serverDir = getServerDir();
  const serverScript = path.join(serverDir, "server.js");

  if (!fs.existsSync(serverScript)) {
    console.error("Server script not found:", serverScript);
    console.error("Run 'npm run build' first");
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

  serverProcess = spawn(process.execPath, [serverScript], {
    cwd: serverDir,
    env,
    stdio: ["ignore", "pipe", "pipe"],
  });

  serverProcess.stdout.on("data", (d) => console.log("[server]", d.toString().trim()));
  serverProcess.stderr.on("data", (d) => console.error("[server]", d.toString().trim()));
  serverProcess.on("exit", (code) => {
    console.log("[server] exited with code", code);
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.loadURL("about:blank");
    }
  });

  await waitForServer(serverPort);
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

app.whenReady().then(async () => {
  try {
    await startServer();
    createWindow();
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
