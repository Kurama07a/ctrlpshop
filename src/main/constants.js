// Application constants
const path = require('path');
const { app } = require('electron');

const SUPABASE_URL = "https://gtcqilbysfgbpitzjulg.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd0Y3FpbGJ5c2ZnYnBpdHpqdWxnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDEwMjQ4ODYsImV4cCI6MjA1NjYwMDg4Nn0.kVEvamqmWXaZoFK8qoKtSnP5acTO0y3HLv_Hf9muL7o";

const BUCKET_NAME = "combined-pdfs";
const WEBSOCKET_URL = "ws://ws.ctrlp.co.in:3001";

const FIXED_PAPER_SIZES = ["A4", "A3", "Letter", "Legal"];

// File paths
const getFilePaths = () => ({
  JOB_HISTORY_FILE: path.join(app.getPath("userData"), "jobHistory.json"),
  METRICS_FILE: path.join(app.getPath("userData"), "metrics.json"),
  DAILY_METRICS_FILE: path.join(app.getPath("userData"), "dailyMetrics.json"),
  PRINTER_INFO_FILE: path.join(app.getPath("userData"), "printerInfo.json"),
  TEMP_DIR: path.join(app.getPath("temp"), "CtrlP")
});

module.exports = {
  SUPABASE_URL,
  SUPABASE_KEY,
  BUCKET_NAME,
  WEBSOCKET_URL,
  FIXED_PAPER_SIZES,
  getFilePaths
};