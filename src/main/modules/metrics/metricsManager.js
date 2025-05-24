const { ipcMain } = require("electron");
const { getMetrics, saveMetrics, getDailyMetrics, saveDailyMetrics } = require("../storage/fileManager");

let mainWindow = null;

function log(message) {
  console.log(`[${new Date().toISOString()}] ${message}`);
  if (mainWindow) mainWindow.webContents.send("log-message", message);
}

function setMainWindow(window) {
  mainWindow = window;
}

function updateMetrics(job) {
  if (job.print_status === "completed") {
    const metrics = getMetrics();
    const pagesUsed = job.number_of_pages;
    
    metrics.totalPages += pagesUsed;
    if (job.color_mode.toLowerCase() === "color") {
      metrics.colorJobs++;
    } else {
      metrics.monochromeJobs++;
    }
    metrics.totalIncome += job.amount * 0.8;
    
    saveMetrics(metrics);
    updateDailyMetrics(job);
    
    if (mainWindow) {
      mainWindow.webContents.send("metrics-updated", metrics);
    }
  }
}

function updateDailyMetrics(job) {
  if (job.print_status === "completed") {
    const dailyMetrics = getDailyMetrics();
    const today = new Date().toISOString().split("T")[0];
    
    if (!dailyMetrics[today]) {
      dailyMetrics[today] = {
        totalPages: 0,
        monochromeJobs: 0,
        colorJobs: 0,
        totalIncome: 0,
      };
    }
    
    const pagesUsed = job.number_of_pages;
    dailyMetrics[today].totalPages += pagesUsed;
    
    if (job.color_mode.toLowerCase() === "color") {
      dailyMetrics[today].colorJobs++;
    } else {
      dailyMetrics[today].monochromeJobs++;
    }
    
    dailyMetrics[today].totalIncome += job.amount * 0.8;
    saveDailyMetrics(dailyMetrics);
    
    if (mainWindow) {
      mainWindow.webContents.send("daily-metrics-updated", dailyMetrics);
    }
  }
}

function handleGetMetrics() {
  try {
    const metrics = getMetrics();
    console.log("Fetching metrics...", metrics);
    return metrics;
  } catch (error) {
    log(`Error fetching metrics: ${error.message}`);
    return {
      totalPages: 0,
      monochromeJobs: 0,
      colorJobs: 0,
      totalIncome: 0,
    };
  }
}

function handleGetDailyMetrics() {
  try {
    return getDailyMetrics();
  } catch (error) {
    log(`Error fetching daily metrics: ${error.message}`);
    return {};
  }
}

function initializeMetrics() {
  // Load initial metrics to ensure they exist
  const metrics = getMetrics();
  const dailyMetrics = getDailyMetrics();
  
  log("Metrics initialized");
  console.log("Initial metrics:", metrics);
  console.log("Initial daily metrics:", dailyMetrics);
}

function setupMetricsIpcHandlers() {
  ipcMain.handle("get-metrics", handleGetMetrics);
  ipcMain.handle("get-daily-metrics", handleGetDailyMetrics);
}

module.exports = {
  updateMetrics,
  updateDailyMetrics,
  initializeMetrics,
  setupMetricsIpcHandlers,
  setMainWindow
};