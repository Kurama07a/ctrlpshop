const { ipcMain } = require("electron");
const pdfToPrinter = require("pdf-to-printer");
const WebSocket = require("ws");
const { 
  detectPrinterCapabilities,
  getPrintersFromWmic,
  getPrintersFromPowerShell,
  getPrintersFromWin32,
  getPrintersFromSystem32
} = require("./printerUtils");
const { getPrinterInfo, savePrinterInfo } = require("../storage/fileManager");
const { FIXED_PAPER_SIZES } = require("../../constants");

let printerQueues = new Map();
let localPrinterWs = null;
let localPrinterReconnectTimer = null;
let mainWindow = null;

function log(message) {
  console.log(`[${new Date().toISOString()}] ${message}`);
  if (mainWindow) mainWindow.webContents.send("log-message", message);
}

function setMainWindow(window) {
  mainWindow = window;
}

function filterPhysicalPrinters(allPrinters) {
  const virtualPrinterKeywords = ["virtual", "fax"];
  return allPrinters.filter(
    (printer) =>
      !virtualPrinterKeywords.some((keyword) =>
        printer.name.toLowerCase().includes(keyword)
      )
  );
}

async function initializePrinters() {
  try {
    let allPrinters = [];
    
    // Method 1: PDF to Printer library
    log('Attempting to detect printers using pdf-to-printer...');
    allPrinters = await pdfToPrinter.getPrinters();
    
    // Method 2: PowerShell if first method fails
    if (!allPrinters.length) {
      log('Trying PowerShell detection method...');
      allPrinters = await getPrintersFromPowerShell();
    }

    // Method 3: WMIC if previous methods fail
    if (!allPrinters.length) {
      log('Trying WMIC detection method...');
      allPrinters = await getPrintersFromWmic();
    }

    // Method 4: Win32 API if previous methods fail
    if (!allPrinters.length) {
      log('Trying Win32 API detection method...');
      allPrinters = await getPrintersFromWin32();
    }

    // Method 5: System32 PowerShell as last resort
    if (!allPrinters.length) {
      log('Trying System32 PowerShell detection method...');
      allPrinters = await getPrintersFromSystem32();
    }

    // If still no printers found, notify user and exit
    if (!allPrinters.length) {
      log('No printers detected using any available method');
      if (mainWindow) {
        mainWindow.webContents.send("printer-status", {
          status: "error",
          message: "No physical printers detected"
        });
        
        // Close WebSocket if connected
        const { closeWebSocket } = require("../websocket/websocketManager");
        closeWebSocket();
        mainWindow.webContents.send("force-toggle-websocket", false);
      }
      return;
    }

    log(`Detected ${allPrinters.length} printers, filtering physical printers...`);
    const physicalPrinters = filterPhysicalPrinters(allPrinters);
    log(`Found ${physicalPrinters.length} physical printers`);

    const printerInfo = getPrinterInfo();

    // Initialize capabilities and queues for each physical printer
    for (const printer of physicalPrinters) {
      if (!printerInfo.capabilities[printer.name]) {
        log(`Detecting capabilities for printer: ${printer.name}`);
        const capabilities = await detectPrinterCapabilities(printer.name);
        printerInfo.capabilities[printer.name] = capabilities;
        printerInfo.paperLevels[printer.name] = {};
        capabilities.paperSizes.forEach((size) => {
          printerInfo.paperLevels[printer.name][size] =
            printerInfo.paperLevels[printer.name][size] || 0;
        });
        log(`Initialized capabilities for ${printer.name}`);
      }
      
      if (!printerQueues.has(printer.name)) {
        printerQueues.set(printer.name, []);
        log(`Initialized print queue for ${printer.name}`);
      }
    }

    // Clean up disconnected printers
    for (const printerName of Object.keys(printerInfo.capabilities)) {
      if (!physicalPrinters.some((p) => p.name === printerName)) {
        log(`Removing disconnected printer: ${printerName}`);
        delete printerInfo.capabilities[printerName];
        delete printerInfo.paperLevels[printerName];
        printerQueues.delete(printerName);
      }
    }

    savePrinterInfo(printerInfo);
    log('Printer information saved successfully');
    
    if (mainWindow) {
      mainWindow.webContents.send("printer-info-updated", {
        printerInfo,
        printerQueues: Object.fromEntries(printerQueues),
      });
    }
    
  } catch (error) {
    log(`Error initializing printers: ${error.message}`);
    if (mainWindow) {
      mainWindow.webContents.send("printer-status", {
        status: "error",
        message: `Failed to initialize printers: ${error.message}`
      });
    }
  }
}

async function getPrinters() {
  await initializePrinters();
  const printerInfo = getPrinterInfo();
  return {
    printers: Object.entries(printerInfo.capabilities).map(([name, caps]) => ({
      name,
      capabilities: { ...caps, paperSizes: Array.from(caps.paperSizes) },
    })),
    printerInfo,
    printerQueues: Object.fromEntries(printerQueues),
  };
}

function updateDiscardedPrinters(_event, updatedDiscardedPrinters) {
  const printerInfo = getPrinterInfo();
  printerInfo.discardedPrinters = updatedDiscardedPrinters;
  savePrinterInfo(printerInfo);
  log(`Updated discarded printers: ${updatedDiscardedPrinters.join(", ")}`);
  
  if (mainWindow) {
    mainWindow.webContents.send("printer-info-updated", {
      printerInfo,
      printerQueues: Object.fromEntries(printerQueues),
    });
  }
  
  // Update shop technical info
  const { updateShopTechnicalInfo } = require("../kyc/kycManager");
  updateShopTechnicalInfo();
  
  if (areAllPrintersDiscarded(updatedDiscardedPrinters)) {
    const { closeWebSocket } = require("../websocket/websocketManager");
    closeWebSocket();
    if (mainWindow) {
      mainWindow.webContents.send("all-printers-discarded");
    }
  }
}

function areAllPrintersDiscarded(discardedPrinters) {
  const printerInfo = getPrinterInfo();
  const totalPrinters = Object.keys(printerInfo.paperLevels).length;
  return totalPrinters > 0 && totalPrinters === discardedPrinters.length;
}

function hasValidPrinters() {
  const printerInfo = getPrinterInfo();
  const availablePrinters = Object.keys(printerInfo.capabilities);
  const nonDiscardedPrinters = availablePrinters.filter(
    printer => !printerInfo.discardedPrinters.includes(printer)
  );
  return nonDiscardedPrinters.length > 0;
}

function updatePrinterPaperLevels(_event, { printerName, levels }) {
  const printerInfo = getPrinterInfo();
  printerInfo.paperLevels[printerName] = levels;
  savePrinterInfo(printerInfo);
  log(`Updated paper levels for ${printerName}: ${JSON.stringify(levels)}`);
  
  if (mainWindow) {
    mainWindow.webContents.send("printer-info-updated", {
      printerInfo,
      printerQueues: Object.fromEntries(printerQueues),
    });
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
        printerQueues: Object.fromEntries(printerQueues),
      });
    }
  }
}

async function updatePrinterCapabilities(_event, capabilityChanges) {
  try {
    const printerInfo = getPrinterInfo();
    
    // Process each printer's capability changes
    for (const [printerName, changes] of Object.entries(capabilityChanges)) {
      if (!printerInfo.capabilities[printerName]) {
        log(`Warning: Trying to update capabilities for unknown printer: ${printerName}`);
        continue;
      }

      // Update job routing rules
      if (changes.capabilities) {
        Object.assign(printerInfo.capabilities[printerName], changes.capabilities);
      }

      // Update paper sizes if they've changed
      if (changes.paperSizes && changes.paperSizes.length > 0) {
        // Get the original physical paper sizes
        const physicalPaperSizes = Array.from(
          printerInfo.capabilities[printerName].paperSizes
        );

        // Filter requested paper sizes to only include physically supported ones
        const validPaperSizes = changes.paperSizes.filter((size) =>
          physicalPaperSizes.includes(size)
        );

        // Update the paper sizes
        printerInfo.capabilities[printerName].paperSizes = new Set(validPaperSizes);

        // Ensure paper levels exist for all supported paper sizes
        validPaperSizes.forEach((size) => {
          if (!printerInfo.paperLevels[printerName][size]) {
            printerInfo.paperLevels[printerName][size] = 0;
          }
        });
      }
    }

    // Save the updated printerInfo
    savePrinterInfo(printerInfo);
    log("Printer capabilities updated successfully");

    // Notify renderer about the updated printer info
    if (mainWindow) {
      mainWindow.webContents.send("printer-info-updated", {
        printerInfo,
        printerQueues: Object.fromEntries(printerQueues),
      });
    }

    // Update the shop's technical info (supported settings)
    const { updateShopTechnicalInfo } = require("../kyc/kycManager");
    updateShopTechnicalInfo();

    return { success: true };
  } catch (error) {
    log(`Error updating printer capabilities: ${error.message}`);
    return { success: false, error: error.message };
  }
}

function initializeLocalPrinterMonitor() {
  if (localPrinterWs) {
    log('Closing existing local printer WebSocket connection');
    localPrinterWs.close();
  }

  log('Attempting to connect to local printer monitor at ws://localhost:8765');
  localPrinterWs = new WebSocket('ws://localhost:8765');

  localPrinterWs.on('open', () => {
    log('Successfully connected to local printer monitor');
    if (localPrinterReconnectTimer) {
      clearInterval(localPrinterReconnectTimer);
      localPrinterReconnectTimer = null;
    }
  });

  localPrinterWs.on('message', async (data) => {
    log(`Received message from local printer monitor: ${data}`);
    try {
      const message = JSON.parse(data.toString());
      log(`Parsed message: ${JSON.stringify(message)}`);
      
      if (message.type === 'printer_status') {
        const printerInfo = getPrinterInfo();
        
        // Get list of all connected printers from the message
        const connectedPrinters = message.data.filter(printer => 
          printer.isConnected === true && 
          printer.busAddress !== 'Not Connected' &&
          printer.status !== 3
        ).map(printer => printer.name);

        // Get all printers we're currently tracking (both active and discarded)
        const allTrackedPrinters = [
          ...Object.keys(printerInfo.capabilities),
          ...printerInfo.discardedPrinters
        ];

        // Remove any printer that's not in the connected printers list
        allTrackedPrinters.forEach(printerName => {
          if (!connectedPrinters.includes(printerName)) {
            // Remove from capabilities
            delete printerInfo.capabilities[printerName];
            
            // Remove from paper levels
            delete printerInfo.paperLevels[printerName];
            
            // Remove from printer queues
            printerQueues.delete(printerName);
            
            // Remove from discarded printers
            printerInfo.discardedPrinters = printerInfo.discardedPrinters.filter(
              name => name !== printerName
            );
            
            log(`Completely removed disconnected printer: ${printerName}`);
          }
        });

        // Save changes
        savePrinterInfo(printerInfo);

        // Notify renderer about changes
        if (mainWindow) {
          mainWindow.webContents.send('printer-info-updated', {
            printerInfo,
            printerQueues: Object.fromEntries(printerQueues)
          });
        }

        // Update shop technical info if needed
        const { getCurrentShopId } = require("../auth/auth");
        if (getCurrentShopId()) {
          const { updateShopTechnicalInfo } = require("../kyc/kycManager");
          updateShopTechnicalInfo();
        }

        log('Updated printer status based on connectivity');
      }
    } catch (error) {
      log(`Error processing printer monitor message: ${error.message}`);
    }
  });

  localPrinterWs.on('close', () => {
    log('Disconnected from local printer monitor. Attempting to reconnect...');
    if (!localPrinterReconnectTimer) {
      localPrinterReconnectTimer = setInterval(() => {
        log('Reconnection attempt to local printer monitor');
        initializeLocalPrinterMonitor();
      }, 5000);
    }
  });

  localPrinterWs.on('error', (error) => {
    log(`Local printer monitor error: ${error.message}`);
  });
}

function setupPrinterIpcHandlers() {
  ipcMain.handle("get-printers", getPrinters);
  ipcMain.on("update-discarded-printers", updateDiscardedPrinters);
  ipcMain.on("update-printer-paper-levels", updatePrinterPaperLevels);
  ipcMain.handle("update-printer-capabilities", updatePrinterCapabilities);
}

// Getters for other modules
function getPrinterQueues() {
  return printerQueues;
}

module.exports = {
  initializePrinters,
  getPrinters,
  updateDiscardedPrinters,
  updatePrinterPaperLevels,
  updatePrinterCapabilities,
  areAllPrintersDiscarded,
  hasValidPrinters,
  updatePaperLevels,
  initializeLocalPrinterMonitor,
  setupPrinterIpcHandlers,
  setMainWindow,
  getPrinterQueues
};