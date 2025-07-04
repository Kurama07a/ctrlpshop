const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  ipcRenderer: {
    send: (channel, data) => {
      // Whitelist channels for security
      const validChannels = [
        'login', 'test-login', 'signup', 'sign-out',
        'toggle-websocket', 'update-discarded-printers',
        'update-printer-paper-levels', 'check-for-updates',
        'save-kyc-data', 'fetch-shop-info', 'update-shop-info',
        'process-print-job', 'update-daily-metrics'
      ];
      if (validChannels.includes(channel)) {
        ipcRenderer.send(channel, data);
      }
    },
    invoke: (channel, data) => {
      const validChannels = [
        'check-session-status', 'get-printers', 'get-job-history',
        'get-metrics', 'get-daily-metrics', 'submit-kyc-data',
        'update-printer-capabilities', 'request-payout',
        'update-payout-status', 'get-printer-info', 'get-websocket-status'
      ];
      if (validChannels.includes(channel)) {
        return ipcRenderer.invoke(channel, data);
      }
    },
    on: (channel, func) => {
      const validChannels = [
        'auth-success', 'auth-error', 'session-check-complete',
        'sign-out-success', 'printer-info-updated', 'daily-metrics-updated',
        'print-job', 'print-complete', 'print-failed', 'websocket-status',
        'force-toggle-websocket', 'job-history-updated', 'all-printers-discarded',
        'kyc-verified', 'kyc-required', 'shop-info-fetched', 'log-message',
        'metrics-updated', 'printer-queues-updated'
      ];
      if (validChannels.includes(channel)) {
        // Deliberately strip event as it includes `sender`
        ipcRenderer.on(channel, (event, ...args) => func(...args));
      }
    },
    removeAllListeners: (channel) => {
      ipcRenderer.removeAllListeners(channel);
    }
  }
});