const { ipcMain } = require("electron");
const fs = require("fs");
const { getFilePaths } = require("../../constants");
const { getPrinterInfo, savePrinterInfo } = require("../storage/fileManager");

let jobHistory = new Map();
let mainWindow = null;

function log(message) {
  console.log(`[${new Date().toISOString()}] ${message}`);
  if (mainWindow) mainWindow.webContents.send("log-message", message);
}

function setMainWindow(window) {
  mainWindow = window;
}

function loadJobHistory() {
  try {
    const { JOB_HISTORY_FILE } = getFilePaths();
    if (fs.existsSync(JOB_HISTORY_FILE)) {
      const data = fs.readFileSync(JOB_HISTORY_FILE, "utf8");
      const jobs = JSON.parse(data);
      jobHistory = new Map(jobs.map((job) => [job.id, job]));
      log(`Loaded ${jobHistory.size} unique jobs from history`);
    }
  } catch (error) {
    log(`Error loading job history: ${error.message}`);
    jobHistory = new Map();
  }
}

function saveJobHistory() {
  try {
    const { JOB_HISTORY_FILE } = getFilePaths();
    fs.writeFileSync(
      JOB_HISTORY_FILE,
      JSON.stringify([...jobHistory.values()], null, 2)
    );
    log(`Saved ${jobHistory.size} jobs to history`);
  } catch (error) {
    log(`Error saving job history: ${error.message}`);
  }
}

function addOrUpdateJobInHistory(job, printerName, status) {
  const { getCurrentShopId } = require("../auth/auth");
  
  const jobEntry = {
    ...job,
    assigned_printer: printerName,
    print_status: status,
    processed_timestamp: new Date().toISOString(),
    shop_id: getCurrentShopId(),
    pages_printed: job.number_of_pages + 1,
    total_pages: job.number_of_pages,
  };

  jobHistory.set(job.id, jobEntry);
  saveJobHistory();
  
  if (mainWindow) {
    mainWindow.webContents.send("job-history-updated");
  }
  
  if (status === "completed") {
    const { updateMetrics } = require("../metrics/metricsManager");
    updateMetrics(jobEntry);
  }
}

function updatePaperLevels(printerName, paperSize, change) {
  const printerInfo = getPrinterInfo();
  
  if (
    printerInfo.paperLevels[printerName] &&
    printerInfo.paperLevels[printerName][paperSize] !== undefined
  ) {
    printerInfo.paperLevels[printerName][paperSize] = Math.max(
      0,
      printerInfo.paperLevels[printerName][paperSize] + change
    );
    savePrinterInfo(printerInfo);
    
    if (mainWindow) {
      mainWindow.webContents.send("printer-info-updated", {
        printerInfo,
        printerQueues: Object.fromEntries(require("../printer/printerManager").getPrinterQueues()),
      });
    }
  }
}

function getJobHistory() {
  try {
    return [...jobHistory.values()];
  } catch (error) {
    log(`Error fetching job history: ${error.message}`);
    return [];
  }
}

function setupJobHistoryIpcHandlers() {
  ipcMain.handle("get-job-history", getJobHistory);
}

module.exports = {
  loadJobHistory,
  saveJobHistory,
  addOrUpdateJobInHistory,
  updatePaperLevels,
  getJobHistory,
  setupJobHistoryIpcHandlers,
  setMainWindow
};