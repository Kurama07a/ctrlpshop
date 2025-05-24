const { autoUpdater } = require("electron-updater");
const { dialog } = require("electron");
const isDev = require("electron-is-dev");

let mainWindow = null;

function log(message) {
  console.log(`[${new Date().toISOString()}] ${message}`);
  if (mainWindow) mainWindow.webContents.send("log-message", message);
}

function logUpdate(message) {
  console.log(`[Update] ${message}`);
  if (mainWindow) {
    mainWindow.webContents.send("log-message", `[Update] ${message}`);
  }
}

function setMainWindow(window) {
  mainWindow = window;
}

function setupAutoUpdater() {
  console.log("Setting up auto-updater...");

  // Configure logger
  autoUpdater.logger = require("electron-log");
  autoUpdater.logger.transports.file.level = "info";
  autoUpdater.setFeedURL({
    provider: "github",
    owner: "kurama07a",
    repo: "ctrlp-dashboard",
    private: false,
  });

  // Optional: Add update channel
  autoUpdater.channel = "latest";

  if (isDev) {
    logUpdate("Running in development mode - auto updates disabled");
    console.log("Auto-updater disabled in development mode");
    if (mainWindow) {
      mainWindow.webContents.send("update-status", {
        status: "disabled",
        reason: "Development mode",
      });
    }
    return;
  }

  // Production configuration
  try {
    autoUpdater.autoDownload = false;
    autoUpdater.allowDowngrade = false;
    autoUpdater.allowPrerelease = false;

    // Event handlers
    autoUpdater.on("checking-for-update", () => {
      logUpdate("Checking for updates...");
      if (mainWindow) {
        mainWindow.webContents.send("update-status", { status: "checking" });
      }
    });

    autoUpdater.on("update-available", (info) => {
      logUpdate(`Update available: ${info.version}`);
      if (mainWindow) {
        mainWindow.webContents.send("update-status", {
          status: "available",
          info: info,
        });
        
        dialog
          .showMessageBox(mainWindow, {
            type: "info",
            title: "Update Available",
            message: `Version ${info.version} is available. Would you like to download it?`,
            buttons: ["Yes", "No"],
          })
          .then(({ response }) => {
            if (response === 0) {
              autoUpdater.downloadUpdate();
            }
          });
      }
    });

    autoUpdater.on("update-not-available", (info) => {
      logUpdate("No updates available");
      if (mainWindow) {
        mainWindow.webContents.send("update-status", {
          status: "not-available",
          info: info,
        });
      }
    });

    autoUpdater.on("error", (err) => {
      logUpdate(`Error in auto-updater: ${err.message}`);
      if (mainWindow) {
        mainWindow.webContents.send("update-status", {
          status: "error",
          error: err.message,
        });
      }
    });

    autoUpdater.on("download-progress", (progressObj) => {
      const message = `Download speed: ${progressObj.bytesPerSecond} - Downloaded ${progressObj.percent}% (${progressObj.transferred}/${progressObj.total})`;
      logUpdate(message);
      if (mainWindow) {
        mainWindow.webContents.send("update-status", {
          status: "downloading",
          progress: progressObj,
        });
      }
    });

    autoUpdater.on("update-downloaded", (info) => {
      logUpdate(`Update downloaded: ${info.version}`);
      if (mainWindow) {
        mainWindow.webContents.send("update-status", {
          status: "downloaded",
          info: info,
        });

        dialog
          .showMessageBox(mainWindow, {
            type: "info",
            buttons: ["Restart Now", "Later"],
            title: "Update Ready",
            message: "A new version has been downloaded. Restart to install?",
            detail: `Version ${info.version} is ready to install.`,
          })
          .then(({ response }) => {
            if (response === 0) {
              autoUpdater.quitAndInstall(true, true);
            }
          });
      }
    });

    // Initial check
    logUpdate("Performing initial update check...");
    autoUpdater.checkForUpdates().catch((err) => {
      logUpdate(`Initial update check failed: ${err.message}`);
    });

    // Check every hour
    setInterval(() => {
      logUpdate("Performing scheduled update check...");
      autoUpdater.checkForUpdates().catch((err) => {
        logUpdate(`Scheduled update check failed: ${err.message}`);
      });
    }, 60 * 60 * 1000);
  } catch (error) {
    logUpdate(`Error setting up auto-updater: ${error.message}`);
  }
}

function checkForUpdates() {
  if (!isDev) {
    autoUpdater.checkForUpdatesAndNotify();
  } else {
    logUpdate("Manual update check disabled in development mode");
  }
}

module.exports = {
  setupAutoUpdater,
  checkForUpdates,
  setMainWindow
};