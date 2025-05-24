const { ipcMain } = require("electron");
const WebSocket = require("ws");
const { WEBSOCKET_URL } = require("../../constants");
const { hasValidPrinters, areAllPrintersDiscarded } = require("../printer/printerManager");
const { getCurrentShopId, getCurrentSecret } = require("../auth/auth");
const { getPrinterInfo } = require("../storage/fileManager");

let webSocket = null;
let isConnected = false;
let mainWindow = null;

function log(message) {
  console.log(`[${new Date().toISOString()}] ${message}`);
  if (mainWindow) mainWindow.webContents.send("log-message", message);
}

function setMainWindow(window) {
  mainWindow = window;
}

function initializeWebSocket() {
  if (!hasValidPrinters()) {
    log("Cannot initialize WebSocket: No valid printers available");
    if (mainWindow) {
      mainWindow.webContents.send("websocket-status", {
        status: "error",
        message: "No physical printers detected"
      });
    }
    return;
  }

  const printerInfo = getPrinterInfo();
  console.log("Printer Info:", printerInfo);
  console.log("Discarded Printers:", printerInfo.discardedPrinters);
  console.log("All Discarded Printers:", areAllPrintersDiscarded(printerInfo.discardedPrinters));
  if (areAllPrintersDiscarded(printerInfo.discardedPrinters)) {
    log("Cannot initialize WebSocket: All printers are discarded");
    if (mainWindow) {
      mainWindow.webContents.send("websocket-status", "disabled");
    }
    return;
  }

  const currentShopId = getCurrentShopId();
  const currentSecret = getCurrentSecret();
  
  if (!currentShopId || !currentSecret) {
    log("Cannot initialize WebSocket: No shop ID or secret available");
    if (mainWindow) {
      mainWindow.webContents.send("websocket-status", "disabled");
    }
    return;
  }

  if (!webSocket || webSocket.readyState !== WebSocket.OPEN) {
    const authToken = `${currentShopId}:${currentSecret}`;
    webSocket = new WebSocket(WEBSOCKET_URL, [], {
      headers: { Authorization: `Bearer ${authToken}` },
    });

    webSocket.on("open", () => {
      log(`WebSocket connected for shop ${currentShopId}`);
      if (mainWindow) {
        mainWindow.webContents.send("websocket-status", "connected");
      }
      isConnected = true;
      sendMessage("SHOP_OPEN", { shopid: [currentShopId] });
    });

    webSocket.on("message", async (data) => {
      const message = JSON.parse(data.toString());
      log(`Received WebSocket message: ${JSON.stringify(message)}`);

      switch (message.type) {
        case "job_request":
          if (message.data) {
            const job = message.data;
            if (mainWindow) {
              mainWindow.webContents.send("print-job", job);
            }
            
            const { processPrintJob } = require("../job/jobScheduler");
            processPrintJob(null, job);
            
            sendMessage("JOB_RECEIVED", {
              shopId: currentShopId,
              jobId: job.id,
              status: "received",
            });
          }
          break;
        case "PING":
          sendMessage("PONG", { timestamp: Date.now() });
          break;
        case "ERROR":
          log(`WebSocket error: ${message.data.message}`);
          if (mainWindow) {
            mainWindow.webContents.send("websocket-status", "error");
          }
          break;
        case "CONNECTED":
          log(`Server confirmed connection: ${message.data.message}`);
          break;
      }
    });

    webSocket.on("error", (error) => {
      log(`WebSocket error: ${error.message}`);
      if (mainWindow) {
        mainWindow.webContents.send("websocket-status", "error");
        mainWindow.webContents.send("force-toggle-websocket", false);
      }
      isConnected = false;
    });

    webSocket.on("close", () => {
      log("WebSocket connection closed");
      if (mainWindow) {
        mainWindow.webContents.send("websocket-status", "disconnected");
        mainWindow.webContents.send("force-toggle-websocket", false);
      }
      isConnected = false;
    });
  }
}

function closeWebSocket() {
  if (webSocket && webSocket.readyState === WebSocket.OPEN) {
    const currentShopId = getCurrentShopId();
    sendMessage("SHOP_CLOSED", { shopid: [currentShopId] });
    webSocket.close();
  }
  webSocket = null;
  isConnected = false;
  
  if (mainWindow) {
    mainWindow.webContents.send("websocket-status", "disconnected");
  }
}

function sendMessage(type, data) {
  if (webSocket && webSocket.readyState === WebSocket.OPEN) {
    const message = JSON.stringify({ type, data });
    webSocket.send(message);
    log(`Sent ${type} message: ${JSON.stringify(data)}`);
  }
}

function toggleWebSocket(_event, connect) {
  if (connect) {
    // Check for valid printers before allowing connection
    if (!hasValidPrinters()) {
      log("Cannot initialize WebSocket: No valid printers available");
      if (mainWindow) {
        mainWindow.webContents.send("websocket-status", {
          status: "error",
          message: "No physical printers detected. Please connect a printer first."
        });
        mainWindow.webContents.send("force-toggle-websocket", false);
      }
      return;
    }
    initializeWebSocket();
  } else {
    closeWebSocket();
  }
  isConnected = connect;
}

function setupWebSocketIpcHandlers() {
  ipcMain.on("toggle-websocket", toggleWebSocket);
}

module.exports = {
  initializeWebSocket,
  closeWebSocket,
  sendMessage,
  toggleWebSocket,
  setupWebSocketIpcHandlers,
  setMainWindow
};