const { ipcMain } = require("electron");
const supabaseClient = require("../storage/supabaseClient");
const SessionManager = require("./sessionManager");

const getSupabaseClient = supabaseClient.getSupabaseClient;

let sessionManager;
let currentUser = null;
let currentShopId = null;
let currentSecret = null;
let mainWindow = null;

function log(message) {
  console.log(`[${new Date().toISOString()}] ${message}`);
  if (mainWindow) mainWindow.webContents.send("log-message", message);
}

function initializeAuth(app, window) {
  sessionManager = new SessionManager(app);
  mainWindow = window;
}

async function handleLogin(event, { email, password }) {
  try {
    const supabase = getSupabaseClient();
    const { data: account, error: accountError } = await supabase
      .from("shop_accounts")
      .select("id, shop_name, email, secret, shop_id")
      .eq("email", email)
      .eq("secret", password)
      .single();

    if (accountError) throw accountError;

    let kyc_verified = false;
    if (account.shop_id) {
      const { data: shop, error: shopError } = await supabase
        .from("print_shops")
        .select("id")
        .eq("id", account.shop_id)
        .single();

      if (!shopError && shop) {
        kyc_verified = true;
      }
    }

    currentShopId = account.shop_id || null;
    currentSecret = account.secret;

    const user = {
      id: account.id,
      shop_name: account.shop_name,
      email: account.email,
      shop_id: account.shop_id || null,
      kyc_verified,
      secret: account.secret,
    };

    sessionManager.saveSession(user);
    currentUser = user;
    mainWindow.webContents.send("clear-auth-error");
    event.reply("auth-success", user);
    log(`User logged in: ${user.email}, KYC verified: ${kyc_verified}`);

    if (kyc_verified) {
      mainWindow.webContents.send("kyc-verified");
    } else {
      mainWindow.webContents.send("kyc-required");
    }

    // Fetch shop info after successful login
    const { fetchShopInfo } = require("../kyc/kycManager");
    await fetchShopInfo(user.email);
  } catch (error) {
    log(`Login error: ${error.message}`);
    event.reply("auth-error", error.message || "Invalid credentials");
  }
}

async function handleTestLogin(event) {
  try {
    const user = {
      id: "test-user-id",
      shop_name: "Test Shop",
      email: "test@ctrlp.com",
      shop_id: "test-shop-id",
      kyc_verified: true,
      isTestUser: true,
      secret: "test-secret",
    };

    sessionManager.saveSession(user);
    currentUser = user;
    currentShopId = user.shop_id;
    currentSecret = user.secret;

    event.reply("auth-success", user);
    log(`Test user logged in: ${user.email}`);

    mainWindow.webContents.send("kyc-verified");
    
    const { fetchShopInfo } = require("../kyc/kycManager");
    await fetchShopInfo(user.email);
  } catch (error) {
    log(`Test login error: ${error.message}`);
    event.reply("auth-error", error.message || "Test login failed");
  }
}

function handleSignOut(event) {
  currentShopId = null;
  currentSecret = null;
  currentUser = null;

  sessionManager.clearSession();

  const { closeWebSocket } = require("../websocket/websocketManager");
  closeWebSocket();
  
  event.reply("sign-out-success");
  log("User signed out");
}

async function handleSignup(event, { email, password }) {
  try {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from("shop_accounts")
      .insert({ email, secret: password })
      .select()
      .single();

    if (error) throw error;

    const user = {
      id: data.id,
      shop_name: data.shop_name || "New Shop",
      email: data.email,
      shop_id: data.shop_id || null,
      kyc_verified: false,
    };

    event.reply("auth-success", user);
    log(`User signed up: ${user.email}`);
  } catch (error) {
    log(`Signup error: ${error.message}`);
    event.reply("auth-error", error.message);
  }
}

async function checkForSavedSession() {
  try {
    const savedUser = sessionManager.loadSession();
    if (!savedUser) {
      console.log('No saved session found');
      mainWindow.webContents.send('session-check-complete');
      return;
    }

    console.log('Found saved session, attempting to restore...');
    currentUser = savedUser;
    currentShopId = savedUser.shop_id || null;
    currentSecret = savedUser.secret;

    try {
      const { fetchShopInfo } = require("../kyc/kycManager");
      const result = await fetchShopInfo(savedUser.email);
      
      if (result.success) {
        mainWindow.webContents.send('auth-success', savedUser);
        if (savedUser.kyc_verified) {
          mainWindow.webContents.send('kyc-verified');
        } else {
          mainWindow.webContents.send('kyc-required');
        }
      } else {
        throw new Error(result.error);
      }
    } catch (error) {
      console.error('Failed to verify session:', error);
      sessionManager.clearSession();
      currentUser = null;
      currentShopId = null;
      currentSecret = null;
      mainWindow.webContents.send('session-check-complete');
    }
  } catch (error) {
    console.error('Error checking saved session:', error);
    mainWindow.webContents.send('session-check-complete');
  }
}

function checkSessionStatus() {
  return {
    hasSession: !!currentUser,
    user: currentUser,
  };
}

function setupAuthIpcHandlers() {
  ipcMain.on("login", handleLogin);
  ipcMain.on("test-login", handleTestLogin);
  ipcMain.on("signup", handleSignup);
  ipcMain.on("sign-out", handleSignOut);
  ipcMain.handle("check-session-status", checkSessionStatus);
}

// Getters for other modules
function getCurrentUser() {
  return currentUser;
}

function getCurrentShopId() {
  return currentShopId;
}

function getCurrentSecret() {
  return currentSecret;
}

module.exports = {
  initializeAuth,
  setupAuthIpcHandlers,
  checkForSavedSession,
  getCurrentUser,
  getCurrentShopId,
  getCurrentSecret
};