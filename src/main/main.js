const { app, BrowserWindow, ipcMain } = require("electron");
const path = require("path");
const fs = require("fs");
const { getFilePaths } = require("./constants");

// Import modules
const { initializeAuth, setupAuthIpcHandlers, checkForSavedSession } = require("./modules/auth/auth");
const { setupPrinterIpcHandlers, initializePrinters, setMainWindow: setPrinterMainWindow } = require("./modules/printer/printerManager");
const { setupJobIpcHandlers, setMainWindow: setJobMainWindow } = require("./modules/job/jobScheduler");
const { setupJobHistoryIpcHandlers, loadJobHistory, setMainWindow: setJobHistoryMainWindow } = require("./modules/job/jobHistory");
const { setupFileIpcHandlers, loadPrinterInfo, loadMetrics, loadDailyMetrics } = require("./modules/storage/fileManager");
const { setupWebSocketIpcHandlers, setMainWindow: setWebSocketMainWindow } = require("./modules/websocket/websocketManager");
const { setupMetricsIpcHandlers, initializeMetrics, setMainWindow: setMetricsMainWindow } = require("./modules/metrics/metricsManager");
const { setupKycIpcHandlers, setMainWindow: setKycMainWindow } = require("./modules/kyc/kycManager");
const { setupAutoUpdater, checkForUpdates, setMainWindow: setUpdaterMainWindow } = require("./modules/updater/autoUpdater");

let mainWindow;

function log(message) {
  console.log(`[${new Date().toISOString()}] ${message}`);
  if (mainWindow) mainWindow.webContents.send("log-message", message);
}

function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1920,
    height: 1080,
    frame: true,
    title: "CTRL-P Dashboard",
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      enableRemoteModule: false,
    },
  });
  
  setupIpcHandlers();

  mainWindow.loadFile("src/renderer/index.html");
  
  mainWindow.webContents.on('did-finish-load', () => {
    checkForSavedSession();
  });

  // Set main window reference for all modules
  setPrinterMainWindow(mainWindow);
  setJobMainWindow(mainWindow);
  setJobHistoryMainWindow(mainWindow);
  setWebSocketMainWindow(mainWindow);
  setMetricsMainWindow(mainWindow);
  setKycMainWindow(mainWindow);
  setUpdaterMainWindow(mainWindow);
}

function setupIpcHandlers() {
  setupFileIpcHandlers();
  setupAuthIpcHandlers();
  setupPrinterIpcHandlers();
  setupJobIpcHandlers();
  setupJobHistoryIpcHandlers();
  
  setupWebSocketIpcHandlers();
  setupMetricsIpcHandlers();
  setupKycIpcHandlers();

  // Add check for updates handler
  ipcMain.on("check-for-updates", () => {
    console.log('Check for updates button clicked');
    checkForUpdates();
    if (mainWindow) {
      mainWindow.webContents.send("log-message", "Checking for updates...");
    }
  });
}

function initializeDirectories() {
  const { TEMP_DIR } = getFilePaths();
  if (!fs.existsSync(TEMP_DIR)) {
    fs.mkdirSync(TEMP_DIR, { recursive: true });
  }
}

app.whenReady().then(async () => {
  // Initialize directories
  initializeDirectories();
  
  // Create main window
  createMainWindow();
  
  // Initialize authentication
  initializeAuth(app, mainWindow);
  
  // Load data
  loadPrinterInfo();
  loadJobHistory();
  loadMetrics();
  loadDailyMetrics();
  
  // Initialize modules
  await initializePrinters();
  initializeMetrics();
  
  // Setup IPC handlers
  //setupIpcHandlers();
  
  // Setup auto updater
  setupAutoUpdater();
  
  log("Application initialized successfully");
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

// Export mainWindow for use in modules
module.exports = { getMainWindow: () => mainWindow };