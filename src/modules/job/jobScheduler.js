const { ipcMain } = require("electron");
const pdfToPrinter = require("pdf-to-printer");
const fs = require("fs");
const { PDFDocument } = require("pdf-lib");
const say = require("say");
const { getPrinterInfo } = require("../storage/fileManager");
const { downloadFileFromSupabase } = require("../storage/supabaseClient");
const { addOrUpdateJobInHistory, updatePaperLevels } = require("./jobHistory");
const { getPrinterQueues } = require("../printer/printerManager");

let mainWindow = null;

function log(message) {
  console.log(`[${new Date().toISOString()}] ${message}`);
  if (mainWindow) mainWindow.webContents.send("log-message", message);
}

function setMainWindow(window) {
  mainWindow = window;
}

function parsePrintSettingsCode(code) {
  const settings = {
    orientation: "portrait",
    color_mode: "monochrome",
    duplex: "simplex",
    paper_size: "A4",
  };

  const paperTypeCode = Math.floor(code / 1000);
  settings.paper_size = ["A4", "A3", "Letter", "Legal"][paperTypeCode] || "A4";

  const remainingCode = code % 1000;
  if (remainingCode >= 100) {
    settings.duplex = "vertical";
    code -= 100;
  }
  if (remainingCode >= 10) {
    settings.color_mode = "color";
    code -= 10;
  }
  if (remainingCode % 10 === 1) settings.orientation = "landscape";

  return settings;
}

function createPrintOptions(job, printer) {
  const printerInfo = getPrinterInfo();
  const caps = printerInfo.capabilities[printer.name];
  
  return {
    printer: printer.name,
    pages: `${job.start_page || 1}-${job.end_page || job.number_of_pages + 1}`,
    copies: Math.min(job.copies, caps.maxCopies),
    monochrome: job.color_mode.toLowerCase() === "monochrome" || !caps.color,
    paperSize: caps.paperSizes.has(job.paper_size) ? job.paper_size : "A4",
    orientation: job.orientation.toLowerCase(),
    resolution: caps.supportedResolutions[0],
  };
}

async function printJobWithWrappers(filePath, printOptions, job) {
  try {
    let coverPage = 0;
    // Load the PDF to determine the total number of pages
    const pdfBytes = await fs.promises.readFile(filePath);
    const pdfDoc = await PDFDocument.load(pdfBytes);
    const totalPages = pdfDoc.getPageCount();
    if(job.number_of_pages > totalPages) 
      coverPage = 1;
    // Check if we need special handling for landscape or duplex
    const needsSpecialHandling =
      (printOptions.orientation === "landscape" ||
      (job.duplex && job.duplex !== "simplex") ||
      printOptions.copies > 1) && coverPage === 1;

    if (needsSpecialHandling) {
      // Print the first page (cover invoice) with default settings
      const firstPageOptions = {
        printer: printOptions.printer,
        pages: "1",
        copies: 1,
        monochrome: true,
      };
      

      // Print the main content with the provided print options
      const mainContentOptions = {
        ...printOptions,
        pages: `2-${totalPages}`,
      };
      await pdfToPrinter.print(filePath, mainContentOptions);
      log(`Printed the main content for job ${job.id}`);

      await pdfToPrinter.print(filePath, firstPageOptions);
      log(`Printed the first page (cover) for job ${job.id}`);
    } else {
      // For normal portrait/simplex jobs, print everything at once
      await pdfToPrinter.print(filePath, printOptions);
      log(`Printed all pages at once for job ${job.id} with standard settings`);
    }

    // Delete the PDF after successful printing
    fs.unlinkSync(filePath);
    log(`Deleted file after printing: ${filePath}`);
  } catch (error) {
    log(`Error printing job ${job.id}: ${error.message}`);
    throw error;
  }
}

function playJobCompletionSound(jobId, printerName) {
  try {
    log(`Playing audio notification for job ${jobId}`);
    
    const platform = process.platform;
    
    if (platform === 'win32') {
      say.speak(`Print job received successfully on printer ${printerName}`, null, 1.0);
    } else if (platform === 'darwin') {
      say.speak(`Print job ${jobId} completed successfully`, null, 1.0, (err) => {
        if (err) {
          log(`Error playing audio notification: ${err.message}`);
        }
      });
    } else {
      say.speak(`Print job ${jobId} completed successfully`, null, 1.0, (err) => {
        if (err) {
          log(`Error playing audio notification: ${err.message}`);
        }
      });
    }
  } catch (error) {
    log(`Error playing job completion sound: ${error.message}`);
  }
}

class JobScheduler {
  constructor() {
    this.processing = new Set();
    this.queueLocks = new Map();
  }

async scheduleJob(job) {
  if (this.processing.has(job.id)) {
    log(`Job ${job.id} is already being processed`);
    return null;
  }

  const allPrinters = await pdfToPrinter.getPrinters();
  const validPrinters = this.filterValidPrinters(allPrinters, job);

  if (validPrinters.length === 0) {
    log(`No suitable printers for job ${job.id}`);
    return null;
  }

  const bestPrinter = this.findBestPrinter(validPrinters, job);
  if (!bestPrinter) {
    log(`No best printer found for job ${job.id}`);
    return null;
  }

  const printerQueues = getPrinterQueues();
  if (!printerQueues.has(bestPrinter.name)) {
    printerQueues.set(bestPrinter.name, []);
  }

  // Add the printer name to the job
  job.printer_name = bestPrinter.name;
  
  // Add to queue
  printerQueues.get(bestPrinter.name).push({ ...job, print_status: "received" });
  this.processing.add(job.id);
  
  log(`Added job ${job.id} to queue for printer ${bestPrinter.name}`);
  
  if (mainWindow) {
    // Send updated queue information
    log(`Sending printer-queues-updated for job ${job.id}`);
    mainWindow.webContents.send(
      "printer-queues-updated",
      Object.fromEntries(printerQueues)
    );
    
    // Also send comprehensive printer info update
    const printerInfo = getPrinterInfo();
    log(`Sending printer-info-updated for job ${job.id}`);
    mainWindow.webContents.send("printer-info-updated", {
      printerInfo: printerInfo || { capabilities: {}, paperLevels: {}, discardedPrinters: [] },
      printerQueues: Object.fromEntries(printerQueues),
    });
  }

  setTimeout(() => this.processQueue(bestPrinter.name), 0);
  return bestPrinter;
}

  filterValidPrinters(printers, job) {
    const printerInfo = getPrinterInfo();
    
    return printers.filter((printer) => {
      const caps = printerInfo.capabilities[printer.name];
      const paperLevels = printerInfo.paperLevels[printer.name];
      const pagesNeeded = job.number_of_pages + 1;

      // Basic capability checks
      if (
        !caps ||
        !paperLevels ||
        printerInfo.discardedPrinters.includes(printer.name) ||
        !caps.paperSizes.has(job.paper_size) ||
        paperLevels[job.paper_size] < pagesNeeded
      ) {
        return false;
      }

      // Color capability checks
      if (job.color_mode.toLowerCase() === "color" && !caps.color) {
        return false;
      }

      // Duplex capability checks
      if (job.duplex !== "simplex" && !caps.duplex) {
        return false;
      }

      // Job routing rule checks
      if (caps.colorJobsOnly && job.color_mode.toLowerCase() !== "color") {
        return false;
      }

      if (caps.monochromeJobsOnly && job.color_mode.toLowerCase() === "color") {
        return false;
      }

      if (caps.duplexJobsOnly && job.duplex === "simplex") {
        return false;
      }

      if (caps.simplexJobsOnly && job.duplex !== "simplex") {
        return false;
      }

      return true;
    });
  }

  findBestPrinter(printers, job) {
    const printerInfo = getPrinterInfo();
    
    // First get all compatible printers
    const compatiblePrinters = printers.filter(printer => {
      const caps = printerInfo.capabilities[printer.name];
      const isDiscarded = printerInfo.discardedPrinters.includes(printer.name);
      
      return !isDiscarded && 
             caps.paperSizes.has(job.paper_size) &&
             this.checkRoutingRules(caps, job);
    });

    if (compatiblePrinters.length === 0) {
      return null;
    }

    if (compatiblePrinters.length === 1) {
      return compatiblePrinters[0];
    }

    // For multiple compatible printers, use scoring system
    const printerQueues = getPrinterQueues();
    const scoredPrinters = compatiblePrinters.map(printer => {
      const caps = printerInfo.capabilities[printer.name];
      const paperLevel = printerInfo.paperLevels[printer.name][job.paper_size] || 0;
      const queueLength = printerQueues.get(printer.name)?.length || 0;

      let score = 100;

      const paperScore = this.calculatePaperScore(paperLevel, job.number_of_pages);
      score += (paperScore * 0.3);

      const capabilityScore = this.calculateCapabilityScore(caps, job);
      score += (capabilityScore * 0.4);

      const queuePenalty = Math.min(queueLength * 10, 30);
      score -= queuePenalty;

      return {
        printer,
        score,
        metrics: {
          paperLevel,
          queueLength,
          paperScore,
          capabilityScore,
          queuePenalty,
          finalScore: score
        }
      };
    });

    scoredPrinters.sort((a, b) => b.score - a.score);
    this.logPrinterSelection(job, scoredPrinters);

    return scoredPrinters[0].printer;
  }

  calculatePaperScore(paperLevel, pagesNeeded) {
    if (paperLevel < pagesNeeded) return 0;
    const ratio = paperLevel / pagesNeeded;
    return Math.min(ratio * 20, 100);
  }

  calculateCapabilityScore(caps, job) {
    let score = 50;
    
    if (job.color_mode.toLowerCase() === "color" && caps.color) score += 25;
    if (job.color_mode.toLowerCase() === "monochrome" && !caps.color) score += 25;
    
    if (job.duplex !== "simplex" && caps.duplex) score += 25;
    if (job.duplex === "simplex" && !caps.duplex) score += 25;
    
    return score;
  }

  checkRoutingRules(caps, job) {
    if (caps.colorJobsOnly && job.color_mode.toLowerCase() !== "color") return false;
    if (caps.monochromeJobsOnly && job.color_mode.toLowerCase() === "color") return false;
    if (caps.duplexJobsOnly && job.duplex === "simplex") return false;
    if (caps.simplexJobsOnly && job.duplex !== "simplex") return false;
    return true;
  }

  logPrinterSelection(job, validPrinters) {
    console.log(`Printer selection for job ${job.id}:`);
    validPrinters.forEach(({ printer, metrics }) => {
      const formattedMetrics = {
        finalScore: metrics?.finalScore?.toFixed(2) ?? 'N/A',
        paper: metrics?.paperLevel ? 
          `${metrics.paperLevel} sheets (${metrics.paperScore?.toFixed(2) ?? 'N/A'})` : 'N/A',
        queue: metrics?.queueLength !== undefined ? 
          `${metrics.queueLength} jobs (${metrics.queuePenalty?.toFixed(2) ?? 'N/A'})` : 'N/A',
        capability: metrics?.capabilityScore?.toFixed(2) ?? 'N/A'
      };

      console.log(`${printer.name}:`, formattedMetrics);
    });
  }

  async processQueue(printerName) {
    if (this.queueLocks.get(printerName)) {
      log(`Queue for printer ${printerName} is already being processed`);
      return false;
    }

    const printerQueues = getPrinterQueues();
    const queue = printerQueues.get(printerName);
    if (!queue || queue.length === 0) {
      log(`No jobs in queue for printer ${printerName}`);
      return false;
    }

    this.queueLocks.set(printerName, true);
    log(`Locked queue for printer ${printerName}`);

    let processedAny = false;

    try {
      while (queue.length > 0) {
        const job = queue[0];
        await this.processJob(printerName, job);
        processedAny = true;
      }
    } finally {
      this.queueLocks.set(printerName, false);
      log(`Released queue lock for printer ${printerName}`);
    }

    return processedAny;
  }

  async processJob(printerName, job) {
    job.print_status = "in-progress";
    log(`Processing job ${job.id} on printer ${printerName}`);

    const printingUpdate = {
      type: "job_status",
      data: {
        jobId: job.id,
        userId: job.user_id,
        status: "printing",
        reason: "Processing started",
      },
    };

    const { sendMessage } = require("../websocket/websocketManager");
    sendMessage(printingUpdate.type, printingUpdate.data);
    
    const printerQueues = getPrinterQueues();
    if (mainWindow) {
      mainWindow.webContents.send(
        "printer-queues-updated",
        Object.fromEntries(printerQueues)
      );
    }

    try {
      const filePath = await downloadFileFromSupabase(job.combined_file_path);
      const printOptions = createPrintOptions(job, { name: printerName });

      log(`Printing job ${job.id} with options: ${JSON.stringify(printOptions)}`);
      await printJobWithWrappers(filePath, printOptions, job);

      updatePaperLevels(printerName, job.paper_size, -job.number_of_pages - 2);

      const queue = printerQueues.get(printerName);
      queue.shift();

      this.processing.delete(job.id);
      job.print_status = "completed";
      addOrUpdateJobInHistory(job, printerName, "completed");

      const completedUpdate = {
        type: "job_status",
        data: {
          jobId: job.id,
          userId: job.user_id,
          status: "completed",
          reason: "Print job finished",
        },
      };
      
      playJobCompletionSound(job.id, printerName);
      sendMessage(completedUpdate.type, completedUpdate.data);
      
      if (mainWindow) {
        mainWindow.webContents.send("print-complete", job.id);
        mainWindow.webContents.send(
          "printer-queues-updated",
          Object.fromEntries(printerQueues)
        );
      }
    } catch (error) {
      log(`Error processing job ${job.id}: ${error.message}`);
      job.print_status = "failed";

      const printerQueues = getPrinterQueues();
      const queue = printerQueues.get(printerName);
      queue.shift();

      this.processing.delete(job.id);
      addOrUpdateJobInHistory(job, printerName, "failed");

      const failedUpdate = {
        type: "job_status",
        data: {
          jobId: job.id,
          userId: job.user_id,
          status: "failed",
          reason: error.message,
        },
      };

      const { sendMessage } = require("../websocket/websocketManager");
      sendMessage(failedUpdate.type, failedUpdate.data);
      
      if (mainWindow) {
        mainWindow.webContents.send("print-failed", job.id);
        mainWindow.webContents.send(
          "printer-queues-updated",
          Object.fromEntries(printerQueues)
        );
      }
    }
  }
}

const scheduler = new JobScheduler();

async function processPrintJob(event, job) {
  try {
    const { getJobHistory } = require("./jobHistory");
    const jobHistory = new Map(getJobHistory().map(j => [j.id, j]));
    
    if (
      jobHistory.has(job.id) &&
      ["completed", "in-progress"].includes(jobHistory.get(job.id).print_status)
    ) {
      log(`Job ${job.id} already processed or in progress`);
      return;
    }

    addOrUpdateJobInHistory(job, null, "received");
    const parsedJob = {
      ...job,
      ...parsePrintSettingsCode(job.printsettings_code || 0),
      number_of_pages: job.number_of_pages || 1,
      copies: job.copies || 1,
    };

    const printer = await scheduler.scheduleJob(parsedJob);
    
    if (printer) {
      // Add the printer_name to the job for tracking
      parsedJob.printer_name = printer.name;
      
      // Send notification about the job immediately
      if (mainWindow) {
        log(`Sending print-job event to renderer for job ${parsedJob.id} on printer ${printer.name}`);
        mainWindow.webContents.send("print-job", parsedJob);
      }
    } else {
      log(`No suitable printer found for job ${parsedJob.id}`);
      addOrUpdateJobInHistory(parsedJob, null, "failed");
      if (mainWindow) {
        mainWindow.webContents.send("print-failed", parsedJob.id);
      }

      const failedUpdate = {
        type: "job_status",
        data: {
          jobId: parsedJob.id,
          userId: parsedJob.user_id,
          status: "failed",
          reason: "No suitable printer available",
        },
      };

      const { sendMessage } = require("../websocket/websocketManager");
      sendMessage(failedUpdate.type, failedUpdate.data);
    }
  } catch (error) {
    log(`Error processing job ${job.id}: ${error.message}`);
    addOrUpdateJobInHistory(job, null, "failed");
    if (mainWindow) {
      mainWindow.webContents.send("print-failed", job.id);
    }

    const failedUpdate = {
      type: "job_status",
      data: {
        jobId: job.id,
        userId: job.user_id,
        status: "failed",
        reason: error.message,
      },
    };

    const { sendMessage } = require("../websocket/websocketManager");
    sendMessage(failedUpdate.type, failedUpdate.data);
  }
}

function setupJobIpcHandlers() {
  ipcMain.on("process-print-job", processPrintJob);
}

module.exports = {
  processPrintJob,
  parsePrintSettingsCode,
  createPrintOptions,
  printJobWithWrappers,
  playJobCompletionSound,
  setupJobIpcHandlers,
  setMainWindow
};