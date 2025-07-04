const { exec } = require("child_process");
const util = require("util");
const fs = require("fs").promises;
const path = require("path");
const { app } = require("electron");
const { FIXED_PAPER_SIZES } = require("../../constants");

const execAsync = util.promisify(exec);

function log(message) {
  console.log(`[${new Date().toISOString()}] ${message}`);
}

async function detectPrinterCapabilities(printerName) {
  const platform = process.platform;
  let capabilities = {
    color: true,
    duplex: false,
    paperSizes: new Set(FIXED_PAPER_SIZES),
    maxCopies: 999,
    supportedResolutions: ["300dpi"],
    colorJobsOnly: false,
    monochromeJobsOnly: false,
    duplexJobsOnly: false,
    simplexJobsOnly: false,
  };

  try {
    if (platform === "win32") {
      const windowsCaps = await detectWindowsCapabilities(printerName);
      capabilities = { ...capabilities, ...windowsCaps };
    } else if (platform === "linux") {
      const linuxCaps = await detectLinuxCapabilities(printerName);
      capabilities = { ...capabilities, ...linuxCaps };
    }
  } catch (error) {
    log(`Error detecting capabilities for ${printerName}: ${error.message}`);
  }

  return capabilities;
}

async function detectWindowsCapabilities(printerName) {
  const command = `wmic printer where "Name='${printerName}'" list full`;
  const { stdout, stderr } = await execAsync(command);

  if (stderr) throw new Error(`WMIC error: ${stderr}`);

  const lines = stdout.split("\n").filter((line) => line.trim());
  let color = false;
  let duplex = false;
  const detectedPaperSizes = new Set();
  const resolutions = new Set();

  for (const line of lines) {
    if (line.startsWith("CapabilityDescriptions=")) {
      const capsMatch = line.match(/CapabilityDescriptions={(.+)}/);
      if (capsMatch) {
        const capabilitiesList = capsMatch[1]
          .split(",")
          .map((cap) => cap.trim().replace(/"/g, ""));
        color = capabilitiesList.some((cap) => cap.toLowerCase() === "color");
        duplex = capabilitiesList.some((cap) => cap.toLowerCase() === "duplex");
      }
    } else if (line.startsWith("PrinterPaperNames=")) {
      const paperMatch = line.match(/PrinterPaperNames={(.+)}/);
      if (paperMatch) {
        paperMatch[1].split(",").forEach((size) => {
          const trimmed = size.trim().replace(/"/g, "");
          if (FIXED_PAPER_SIZES.includes(trimmed))
            detectedPaperSizes.add(trimmed);
        });
      }
    } else if (
      line.startsWith("HorizontalResolution=") ||
      line.startsWith("VerticalResolution=")
    ) {
      const resMatch = line.match(/=(\d+)/);
      if (resMatch) resolutions.add(`${resMatch[1]}dpi`);
    }
  }

  return {
    color,
    duplex,
    paperSizes:
      detectedPaperSizes.size > 0
        ? detectedPaperSizes
        : new Set(FIXED_PAPER_SIZES),
    maxCopies: 999,
    supportedResolutions:
      resolutions.size > 0 ? Array.from(resolutions) : ["300dpi"],
  };
}

async function detectLinuxCapabilities(printerName) {
  const command = `lpoptions -p "${printerName}"`;
  const { stdout, stderr } = await execAsync(command);

  if (stderr) throw new Error(`lpoptions error: ${stderr}`);

  const options = stdout.split(" ").reduce((acc, opt) => {
    const [key, value] = opt.split("=");
    acc[key] = value;
    return acc;
  }, {});

  const color = options["ColorModel"]
    ? !options["ColorModel"].toLowerCase().includes("gray")
    : true;
  const duplex = options["Duplex"]
    ? !options["Duplex"].toLowerCase().includes("none")
    : false;
  const resolution = options["Resolution"] || "300dpi";

  const paperCommand = `lpstat -l -p "${printerName}"`;
  const { stdout: paperStdout } = await execAsync(paperCommand);
  const detectedPaperSizes = new Set();
  const paperMatch = paperStdout.match(/PaperSize Supported: (.+)/);
  if (paperMatch) {
    paperMatch[1].split(",").forEach((size) => {
      const trimmedSize = size.trim();
      if (FIXED_PAPER_SIZES.includes(trimmedSize))
        detectedPaperSizes.add(trimmedSize);
    });
  }

  return {
    color,
    duplex,
    paperSizes:
      detectedPaperSizes.size > 0
        ? detectedPaperSizes
        : new Set(FIXED_PAPER_SIZES),
    maxCopies: 999,
    supportedResolutions: [resolution],
  };
}

async function getPrintersFromWmic() {
  try {
    const { stdout } = await execAsync('wmic printer get name');
    return stdout
      .split('\n')
      .slice(1)
      .map(name => name.trim())
      .filter(name => name.length > 0)
      .map(name => ({ name }));
  } catch (error) {
    log('WMIC printer detection failed:', error.message);
    return [];
  }
}

async function getPrintersFromPowerShell() {
  const ps_script = `
  $printers = Get-WmiObject Win32_Printer | Where-Object { $_.PortName -like 'USB*' }
  $pnpDevices = Get-WmiObject Win32_PnPEntity | Where-Object { 
      $_.PNPDeviceID -like 'USB\\*' -or $_.PNPDeviceID -like 'USBPRINT\\*' 
  }

  $results = @()
  foreach ($printer in $printers) {
      $usbDevice = $pnpDevices | Where-Object { 
          $_.PNPDeviceID -eq $printer.PNPDeviceID -and $_.PNPDeviceID -like 'USB\\*' 
      } | Select-Object -First 1
      
      if ($null -eq $usbDevice) {
          $usbDevice = $pnpDevices | Where-Object { 
              $_.PNPDeviceID -like 'USBPRINT\\*' -and $_.PNPDeviceID -like "*$($printer.Name)*" 
          } | Select-Object -First 1
      }

      $printerInfo = @{
          name = $printer.Name
          port = $printer.PortName
          deviceId = $printer.DeviceID
          status = $printer.PrinterStatus
          driverName = $printer.DriverName
          location = if ($null -eq $printer.Location) { "Unknown" } else { $printer.Location }
          isConnected = if ($null -eq $usbDevice) { $false } else { $true }
          busAddress = if ($null -eq $usbDevice) { "Not Connected" } else { $usbDevice.PNPDeviceID }
      }
      $results += $printerInfo
  }
  ConvertTo-Json -InputObject $results -Compress
  `;

  try {
    const scriptPath = path.join(app.getPath('temp'), 'printer_check.ps1');
    await fs.writeFile(scriptPath, ps_script);

    const { stdout } = await execAsync(
      `powershell -ExecutionPolicy Bypass -File "${scriptPath}"`,
      { maxBuffer: 1024 * 1024 }
    );

    await fs.unlink(scriptPath);

    const printers = JSON.parse(stdout);
    return printers.filter(printer => 
      printer.isConnected && 
      printer.busAddress !== 'Not Connected' &&
      printer.status !== 3
    );
  } catch (error) {
    log('PowerShell printer detection failed:', error.message);
    return [];
  }
}

async function getPrintersFromWin32() {
  try {
    const win32 = require('win32-api');
    const printers = [];
    const user32 = win32.load('user32');
    const winspool = win32.load('winspool.drv');
    
    const level = 2;
    const flags = 4; // PRINTER_ENUM_LOCAL
    const printerInfo = await winspool.EnumPrinters(flags, null, level);
    
    for (const printer of printerInfo) {
      printers.push({ name: printer.pPrinterName });
    }
    return printers;
  } catch (error) {
    log('Win32 printer detection failed:', error.message);
    return [];
  }
}

async function getPrintersFromSystem32() {
  try {
    const { stdout } = await execAsync('powershell.exe Get-Printer | Format-List Name');
    return stdout
      .split('\n')
      .filter(line => line.startsWith('Name :'))
      .map(line => ({ name: line.replace('Name :', '').trim() }));
  } catch (error) {
    log('System32 printer detection failed:', error.message);
    return [];
  }
}

module.exports = {
  detectPrinterCapabilities,
  detectWindowsCapabilities,
  detectLinuxCapabilities,
  getPrintersFromWmic,
  getPrintersFromPowerShell,
  getPrintersFromWin32,
  getPrintersFromSystem32
};