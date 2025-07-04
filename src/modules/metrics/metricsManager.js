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
        payouts: [] // Add this initialization
      };
    }
    
    // Ensure payouts array exists even if we're updating an older entry
    if (!dailyMetrics[today].payouts) {
      dailyMetrics[today].payouts = [];
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

function handleRequestPayout(_event, { amount, reference, date, payoutData }) {
  console.log("metricsManager: handleRequestPayout called with:", { 
    amount, 
    reference, 
    date, 
    payoutData 
  });
  
  try {
    const metrics = getMetrics();
    console.log("metricsManager: Current metrics:", metrics);
    
    const dailyMetrics = getDailyMetrics();
    console.log("metricsManager: Current daily metrics:", dailyMetrics);
    
    const today = date || new Date().toISOString().split("T")[0];
    console.log("metricsManager: Using date:", today);
    
    // Initialize global payout tracking if it doesn't exist
    if (!metrics.totalPayoutsRequested) {
      console.log("metricsManager: Initializing totalPayoutsRequested in metrics");
      metrics.totalPayoutsRequested = 0;
    }
    
    // Initialize daily metrics for today if needed
    if (!dailyMetrics[today]) {
      console.log("metricsManager: Initializing daily metrics for today");
      dailyMetrics[today] = {
        totalPages: 0,
        monochromeJobs: 0,
        colorJobs: 0,
        totalIncome: 0,
        payouts: []
      };
    }
    
    // Initialize payouts array if it doesn't exist for today
    if (!dailyMetrics[today].payouts) {
      console.log("metricsManager: Initializing payouts array for today");
      dailyMetrics[today].payouts = [];
    }
    
    // Calculate total already requested today
    const totalRequestedToday = dailyMetrics[today].payouts.reduce(
      (sum, payout) => sum + Number(payout.amount), 
      0
    );
    console.log("metricsManager: Total requested today:", totalRequestedToday);
    console.log("metricsManager: Today's income:", dailyMetrics[today].totalIncome);
    
    // Ensure amount is a number
    const numAmount = Number(amount);
    
    // Check if requested amount is available
    if (numAmount > (dailyMetrics[today].totalIncome - totalRequestedToday)) {
      console.error("metricsManager: Requested amount exceeds available funds", { 
        requested: numAmount,
        available: dailyMetrics[today].totalIncome - totalRequestedToday
      });
      throw new Error("Requested amount exceeds available funds");
    }
    
    // Create payout record
    const payoutRecord = {
      amount: numAmount,
      timestamp: new Date().toISOString(),
      status: "requested",
      reference
    };
    console.log("metricsManager: Created payout record:", payoutRecord);
    
    // Update metrics
    metrics.totalPayoutsRequested += numAmount;
    dailyMetrics[today].payouts.push(payoutRecord);
    
    // Save updated metrics
    console.log("metricsManager: Saving updated metrics");
    saveMetrics(metrics);
    saveDailyMetrics(dailyMetrics);
    
    // Notify renderer
    if (mainWindow) {
      console.log("metricsManager: Notifying renderer with updated metrics");
      mainWindow.webContents.send("metrics-updated", metrics);
      mainWindow.webContents.send("daily-metrics-updated", dailyMetrics);
    }
    
    // Send payout request via WebSocket
    const { sendMessage } = require("../websocket/websocketManager");
    const { getCurrentShopId } = require("../auth/auth");
    const currentShopId = getCurrentShopId();
    
    if (currentShopId) {
      console.log("metricsManager: Sending PAYOUT_REQUEST via WebSocket");
      
      // Make sure payoutData exists
      if (!payoutData) {
        console.warn("metricsManager: Missing payoutData, creating default");
        payoutData = {
          shopName: "Unknown Shop",
          shopEmail: "unknown@email.com",
          bankDetails: {}
        };
      }
      
      sendMessage("PAYOUT_REQUEST", {
        shopId: currentShopId,
        shopName: payoutData.shopName,
        shopEmail: payoutData.shopEmail,
        payoutAmount: numAmount,
        payoutDate: today,
        bankDetails: payoutData.bankDetails,
        reference: reference || payoutData.reference
      });
      
      log(`Payout request sent: ${reference} for ₹${numAmount}`);
      console.log("metricsManager: Payout request successful");
      return { success: true, reference };
    } else {
      console.error("metricsManager: Shop ID not available");
      throw new Error("Shop ID not available");
    }
  } catch (error) {
    console.error("metricsManager: Error in handleRequestPayout:", error);
    log(`Error requesting payout: ${error.message}`);
    return { success: false, message: error.message };
  }
}

function handleUpdatePayoutStatus(_event, { date, reference, newStatus }) {
  try {
    const dailyMetrics = getDailyMetrics();
    
    if (dailyMetrics[date] && dailyMetrics[date].payouts) {
      const payoutIndex = dailyMetrics[date].payouts.findIndex(p => p.reference === reference);
      
      if (payoutIndex >= 0) {
        dailyMetrics[date].payouts[payoutIndex].status = newStatus;
        saveDailyMetrics(dailyMetrics);
        
        // Notify renderer
        if (mainWindow) {
          mainWindow.webContents.send("daily-metrics-updated", dailyMetrics);
        }
        
        return { success: true };
      }
    }
    
    return { success: false, message: "Payout not found" };
  } catch (error) {
    log(`Error updating payout status: ${error.message}`);
    return { success: false, message: error.message };
  }
}

// Add to setupMetricsIpcHandlers
function setupMetricsIpcHandlers() {
  ipcMain.handle("get-metrics", handleGetMetrics);
  ipcMain.handle("get-daily-metrics", handleGetDailyMetrics);
  ipcMain.handle("request-payout", handleRequestPayout);
  ipcMain.handle("update-payout-status", handleUpdatePayoutStatus);
}

module.exports = {
  updateMetrics,
  updateDailyMetrics,
  initializeMetrics,
  setupMetricsIpcHandlers,
  setMainWindow
};