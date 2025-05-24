const fs = require("fs");
const fsPromises = require("fs").promises;
const path = require("path");
const { getFilePaths, FIXED_PAPER_SIZES } = require("../../constants");
const { ipcMain } = require("electron");

let printerInfo = { paperLevels: {}, discardedPrinters: [], capabilities: {} };
let metrics = { totalPages: 0, monochromeJobs: 0, colorJobs: 0, totalIncome: 0 };
let dailyMetrics = {};

function log(message) {
  console.log(`[${new Date().toISOString()}] ${message}`);
}

function loadPrinterInfo() {
  try {
    const { PRINTER_INFO_FILE } = getFilePaths();
    if (fs.existsSync(PRINTER_INFO_FILE)) {
      const data = fs.readFileSync(PRINTER_INFO_FILE, "utf8");
      printerInfo = JSON.parse(data);
      log("Loaded printer information from file");
      
      // Ensure paperSizes are Sets
      for (const printerName in printerInfo.capabilities) {
        if (!printerInfo.capabilities[printerName].paperSizes || 
            !(printerInfo.capabilities[printerName].paperSizes instanceof Set)) {
          printerInfo.capabilities[printerName].paperSizes = new Set(
            Array.isArray(printerInfo.capabilities[printerName].paperSizes)
              ? printerInfo.capabilities[printerName].paperSizes
              : FIXED_PAPER_SIZES
          );
        }
      }
    }
  } catch (error) {
    log(`Error loading printer information: ${error.message}`);
    printerInfo = { paperLevels: {}, discardedPrinters: [], capabilities: {} };
  }
  return printerInfo;
}

function savePrinterInfo(info = printerInfo) {
  try {
    const { PRINTER_INFO_FILE } = getFilePaths();
    fs.writeFileSync(PRINTER_INFO_FILE, JSON.stringify(info, null, 2));
    log("Saved printer information to file");
  } catch (error) {
    log(`Error saving printer info: ${error.message}`);
  }
}

function loadMetrics() {
  try {
    const { METRICS_FILE } = getFilePaths();
    if (fs.existsSync(METRICS_FILE)) {
      const data = fs.readFileSync(METRICS_FILE, "utf8");
      metrics = JSON.parse(data);
      log("Loaded metrics from file");
    } else {
      saveMetrics();
    }
  } catch (error) {
    log(`Error loading metrics: ${error.message}`);
    metrics = { totalPages: 0, monochromeJobs: 0, colorJobs: 0, totalIncome: 0 };
  }
  return metrics;
}

function saveMetrics(metricsData = metrics) {
  try {
    const { METRICS_FILE } = getFilePaths();
    fs.writeFileSync(METRICS_FILE, JSON.stringify(metricsData, null, 2));
    log("Saved metrics to file");
  } catch (error) {
    log(`Error saving metrics: ${error.message}`);
  }
}

function loadDailyMetrics() {
  try {
    const { DAILY_METRICS_FILE } = getFilePaths();
    if (fs.existsSync(DAILY_METRICS_FILE)) {
      const data = fs.readFileSync(DAILY_METRICS_FILE, "utf8");
      dailyMetrics = JSON.parse(data);
      log("Loaded daily metrics from file");
    } else {
      saveDailyMetrics();
    }
  } catch (error) {
    log(`Error loading daily metrics: ${error.message}`);
    dailyMetrics = {};
  }
  return dailyMetrics;
}

function saveDailyMetrics(dailyMetricsData = dailyMetrics) {
  try {
    const { DAILY_METRICS_FILE } = getFilePaths();
    fs.writeFileSync(DAILY_METRICS_FILE, JSON.stringify(dailyMetricsData, null, 2));
    log("Saved daily metrics to file");
  } catch (error) {
    log(`Error saving daily metrics: ${error.message}`);
  }
}

async function saveTempFile(name, buffer) {
  const { TEMP_DIR } = getFilePaths();
  
  if (!fs.existsSync(TEMP_DIR)) {
    fs.mkdirSync(TEMP_DIR, { recursive: true });
  }
  
  const tempPath = path.join(TEMP_DIR, `${Date.now()}-${name}`);
  await fsPromises.writeFile(tempPath, buffer);
  return tempPath;
}

function setupFileIpcHandlers() {
  ipcMain.handle('save-temp-file', async (_event, { name, buffer }) => {
    return await saveTempFile(name, buffer);
  });
  ipcMain.handle('get-metrics', () => getMetrics());
  ipcMain.handle('get-daily-metrics', () => getDailyMetrics());
  
  // Add handler for printer info
  ipcMain.handle('get-printer-info', () => getPrinterInfo());
}

module.exports = {
  loadPrinterInfo,
  savePrinterInfo,
  loadMetrics,
  saveMetrics,
  loadDailyMetrics,
  saveDailyMetrics,
  saveTempFile,
  setupFileIpcHandlers,
  // Getters for current state
  getPrinterInfo: () => printerInfo,
  getMetrics: () => metrics,
  getDailyMetrics: () => dailyMetrics
};