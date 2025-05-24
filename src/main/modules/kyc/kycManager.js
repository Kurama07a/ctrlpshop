const { ipcMain } = require("electron");
const fs = require("fs");
const { getSupabaseClient } = require("../storage/supabaseClient");
const { getCurrentShopId, getCurrentUser } = require("../auth/auth");
const { getPrinterInfo } = require("../storage/fileManager");
const { sendMessage } = require("../websocket/websocketManager");
const { FIXED_PAPER_SIZES } = require("../../constants");

let shopInfo = {};
let mainWindow = null;

function log(message) {
  console.log(`[${new Date().toISOString()}] ${message}`);
  if (mainWindow) mainWindow.webContents.send("log-message", message);
}

function logKyc(message, data) {
  const msg = `[KYC] ${message}` + (data ? ` | ${JSON.stringify(data)}` : "");
  console.log(msg);
  try {
    if (mainWindow) mainWindow.webContents.send("log-message", msg);
  } catch (e) { }
}

function setMainWindow(window) {
  mainWindow = window;
}

async function handleSaveKycData(event, formData) {
  try {
    const supabase = getSupabaseClient();
    const kycData = {
      shop_name: formData.shop_name,
      owner_name: formData.owner_name,
      contact_number: formData.contact_number,
      email: formData.email,
      address: formData.address,
      city: formData.city,
      state: formData.state,
      pincode: formData.pincode,
      gst_number: formData.gst_number,
      aadhaar: formData.aadhaar,
      pan_card_path: formData.pan_card_path,
      bank_proof_path: formData.bank_proof_path,
      passport_photo_path: formData.passport_photo_path,
      account_holder_name: formData.account_holder_name,
      account_number: formData.account_number,
      ifsc_code: formData.ifsc_code,
      bank_name: formData.bank_name,
      branch_name: formData.branch_name,
      kyc_status: "pending",
      updated_at: new Date().toISOString(),
    };

    const { error } = await supabase.from("shop_accounts").upsert(kycData);

    if (error) throw error;
    event.reply("kyc-data-saved", { success: true });
    log("KYC data saved successfully");
  } catch (error) {
    event.reply("kyc-data-saved", { success: false, error: error.message });
    log(`Error saving KYC data: ${error.message}`);
  }
}

async function submitKycData(event, kycData) {
  logKyc("Received submit-kyc-data IPC call", kycData);
  try {
    console.log("Received KYC data:", kycData);

    // Validate required fields
    const requiredFields = [
      "address",
      "aadhaar",
      "pan_card_path",
      "bank_proof_path",
      "passport_photo_path",
    ];
    for (const field of requiredFields) {
      if (!kycData[field]) {
        logKyc(`Missing required field: ${field}`);
        throw new Error(`Missing required field: ${field}`);
      }
    }

    // Validate file paths
    const fileFields = [
      "aadhaar",
      "pan_card_path",
      "bank_proof_path",
      "passport_photo_path",
    ];
    for (const field of fileFields) {
      if (!fs.existsSync(kycData[field])) {
        logKyc(`File not found: ${kycData[field]}`);
        throw new Error(`File not found: ${kycData[field]}`);
      }
    }

    // Fetch shop account
    const supabase = getSupabaseClient();
    const { data: shopAccount, error: accountError } = await supabase
      .from("shop_accounts")
      .select("id")
      .eq("email", shopInfo.email)
      .single();

    if (accountError || !shopAccount) {
      logKyc("Shop account error", accountError?.message || "No account found");
      throw new Error("Shop account not found");
    }

    const shopId = shopAccount.id;
    const identifier = `${shopId}-${Date.now()}`;

    // Define bucket mapping
    const docTypes = {
      aadhaar: "aadhar",
      pan_card_path: "pan",
      bank_proof_path: "bank-proof",
      passport_photo_path: "passport-photos",
    };

    const uploadedPaths = {};
    for (const [field, bucket] of Object.entries(docTypes)) {
      const filePath = kycData[field];
      const docType =
        field === "aadhar" ? "aadhaar-front" : field.replace("_path", "");
      const fileName = `${identifier}-${docType}`;
      logKyc(`Uploading document: ${field} to bucket: ${bucket}`);
      uploadedPaths[field] = await uploadDocumentToBucket(
        bucket,
        filePath,
        fileName
      );
      logKyc(`Uploaded ${field} to ${bucket}: ${uploadedPaths[field]}`);
    }

    // Prepare KYC payload
    const kycPayload = {
      address: kycData.address,
      state: kycData.state,
      aadhaar: uploadedPaths.aadhaar,
      pan_card_path: uploadedPaths.pan_card_path,
      bank_proof_path: uploadedPaths.bank_proof_path,
      passport_photo_path: uploadedPaths.passport_photo_path,
      account_holder_name: kycData.account_holder_name,
      account_number: kycData.account_number,
      ifsc_code: kycData.ifsc_code,
      bank_name: kycData.bank_name,
      branch_name: kycData.branch_name,
      kyc_status: "under_review",
      updated_at: new Date().toISOString(),
    };

    logKyc("Updating shop_accounts with KYC payload", kycPayload);

    // Update shop account
    const { error: updateError } = await supabase
      .from("shop_accounts")
      .update(kycPayload)
      .eq("id", shopId);

    if (updateError) {
      logKyc("Error updating KYC data", updateError.message);
      throw updateError;
    }

    logKyc("KYC data submitted successfully");
    return { success: true };
  } catch (error) {
    logKyc("Error submitting KYC data", error.message);
    return { success: false, error: error.message };
  }
}

async function fetchShopInfo(userEmail) {
  try {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from("shop_accounts")
      .select(
        "shop_name, owner_name, contact_number, email, address, city, state, pincode, gst_number, kyc_status, updated_at"
      )
      .eq("email", userEmail)
      .single();

    if (error) throw error;

    shopInfo = {
      shop_name: data.shop_name || "Not Provided",
      owner_name: data.owner_name || "Not Provided",
      contact_number: data.contact_number || "Not Provided",
      email: data.email || "Not Provided",
      address: data.address || "Not Provided",
      city: data.city || "Not Provided",
      state: data.state || "Not Provided",
      pincode: data.pincode || "Not Provided",
      gst_number: data.gst_number || "Not Provided",
      kyc_status: data.kyc_status || "waiting for document upload",
      updated_at: data.updated_at || new Date().toISOString(),
    };

    if (mainWindow) {
      mainWindow.webContents.send("shop-info-fetched", shopInfo);
    }
    log("Shop information fetched successfully");
    return {success: true, data: shopInfo};
  } catch (error) {
    log(`Error fetching shop information: ${error.message}`);
    if (mainWindow) {
      mainWindow.webContents.send("shop-info-fetched", { error: error.message });
      mainWindow.webContents.send(
        "auth-error",
        "Session expired. Please log in again."
      );
    }

    // Clear auth state on error
    const { closeWebSocket } = require("../websocket/websocketManager");
    closeWebSocket();
    return { success: false, error: error.message };
  }
}

async function updateShopInfo(updatedInfo) {
  const currentShopId = getCurrentShopId();
  if (!currentShopId) return;

  try {
    const supabase = getSupabaseClient();
    const { error } = await supabase
      .from("print_shops")
      .update(updatedInfo)
      .eq("id", currentShopId);

    if (error) throw error;

    if (mainWindow) {
      mainWindow.webContents.send("shop-info-updated", { success: true });
    }
    log("Shop information updated successfully");
  } catch (error) {
    if (mainWindow) {
      mainWindow.webContents.send("shop-info-updated", {
        success: false,
        error: error.message,
      });
    }
    log(`Error updating shop information: ${error.message}`);
  }
}

async function updateShopTechnicalInfo() {
  const currentShopId = getCurrentShopId();
  if (!currentShopId) return;

  try {
    const printerInfo = getPrinterInfo();
    const supportedSettings = {};

    for (const [printerName, capabilities] of Object.entries(
      printerInfo.capabilities
    )) {
      if (printerInfo.discardedPrinters.includes(printerName)) {
        continue; // Skip discarded printers
      }

      const paperSizes = Array.from(
        capabilities.paperSizes || FIXED_PAPER_SIZES
      );
      const supportedPrintSettings = [];

      // Generate printsettings_code for each combination of capabilities
      for (const paperType of paperSizes) {
        for (const orientation of ["portrait", "landscape"]) {
          for (const color of capabilities.color ? [true, false] : [false]) {
            for (const doubleSided of capabilities.duplex ? [true, false] : [false]) {
              const settings = {
                orientation,
                color,
                doubleSided,
                paperType,
              };
              const code = generatePrintSettingsCode(settings);
              supportedPrintSettings.push(code);
            }
          }
        }
      }

      supportedSettings[printerName] = {
        supportedPrintSettings,
        paperLevels: printerInfo.paperLevels[printerName] || {},
      };
    }

    console.log("Supported settings:", supportedSettings);

    // Update the shop's technical info in the database
    const supabase = getSupabaseClient();
    const { error } = await supabase
      .from("print_shops")
      .update({
        supported_settings: supportedSettings,
      })
      .eq("id", currentShopId);

    if (error) throw error;

    log("Shop technical information updated successfully");

    // Send supportedSettings to WebSocket
    sendMessage("SUPPORTED_SETTINGS_UPDATED", { supportedSettings });
    log("Supported settings sent to WebSocket");
  } catch (error) {
    log(`Error updating shop technical information: ${error.message}`);
  }
}

function generatePrintSettingsCode(settings) {
  let code = 0;

  // Orientation: portrait=0, landscape=1
  if (settings.orientation === "landscape") {
    code += 1;
  }

  // Color: BW=0, Color=10
  if (settings.color) {
    code += 10;
  }

  // Double-sided: simplex=0, duplex=100
  if (settings.doubleSided) {
    code += 100;
  }

  // Paper type: multiply by 1000
  const PaperType = {
    A4: 0,
    A3: 1,
    LETTER: 2,
    LEGAL: 3,
  };

  const paperTypeCode =
    PaperType[settings.paperType.toUpperCase()] || PaperType.A4;
  code += paperTypeCode * 1000;

  return code;
}

async function uploadDocumentToBucket(bucketName, filePath, fileName) {
  logKyc(`Uploading document to bucket`, { bucketName, filePath, fileName });
  try {
    console.log(
      `Uploading to bucket: ${bucketName}, filePath: ${filePath}, fileName: ${fileName}`
    );
    if (!filePath || !fs.existsSync(filePath)) {
      throw new Error(`Invalid file path: ${filePath}`);
    }

    const fileContent = fs.readFileSync(filePath); // Read as binary

    let contentType;
    if (filePath.endsWith(".pdf")) {
      contentType = "application/pdf";
    } else if (filePath.endsWith(".png")) {
      contentType = "image/png";
    } else if (filePath.endsWith(".jpg") || fileName.endsWith(".jpeg")) {
      contentType = "image/jpeg";
    } else {
      contentType = "application/octet-stream"; // Default for unknown types
    }

    const supabase = getSupabaseClient();
    const { data, error } = await supabase.storage
      .from(bucketName)
      .upload(fileName, fileContent, {
        contentType: contentType,
      });

    if (error) {
      logKyc(`Supabase upload error: ${error.message}`);
      throw error;
    }

    logKyc(`Uploaded ${fileName} to ${bucketName}: ${data.path}`);
    return data.path;
  } catch (error) {
    logKyc(`Error uploading to ${bucketName}: ${error.message}`);
    throw error;
  }
}

function setupKycIpcHandlers() {
  ipcMain.on("save-kyc-data", handleSaveKycData);
  ipcMain.handle("submit-kyc-data", submitKycData);
  ipcMain.on("fetch-shop-info", (_event, userEmail) => {
    console.log("Fetching shop info for:", userEmail);
    fetchShopInfo(userEmail);
  });
  ipcMain.on("update-shop-info", (_event, updatedInfo) =>
    updateShopInfo(updatedInfo)
  );
}

module.exports = {
  handleSaveKycData,
  submitKycData,
  fetchShopInfo,
  updateShopInfo,
  updateShopTechnicalInfo,
  generatePrintSettingsCode,
  uploadDocumentToBucket,
  setupKycIpcHandlers,
  setMainWindow
};