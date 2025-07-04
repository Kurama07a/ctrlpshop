"use client"

import { set } from "date-fns"
import { createContext, useContext, useEffect, useState, type ReactNode } from "react"

interface ElectronContextType {
  ipcRenderer: any
  isElectron: boolean
  send: (channel: string, ...args: any[]) => void
  invoke: (channel: string, ...args: any[]) => Promise<any>
  on: (channel: string, listener: (...args: any[]) => void) => void
  removeAllListeners: (channel: string) => void
  // Global state management
  isConnected: boolean
  setIsConnected: (connected: boolean) => void
  printerQueues: Record<string, any[]>
  setPrinterQueues: (queues: Record<string, any[]>) => void
  metrics: any
  setMetrics: (metrics: any) => void
  dailyMetrics: any
  setDailyMetrics: (metrics: any) => void
  printerInfo: any
  setPrinterInfo: (info: any) => void
  jobHistory: any[]
  setJobHistory: (history: any[]) => void
  currentUser: any
  setCurrentUser: (user: any) => void
  shopInfo: any
  setShopInfo: (info: any) => void
    printers: Array<{
    id: string;
    name: string;
    capabilities: {
      color: boolean;
      duplex: boolean;
      paperSizes: string[];
    };
    paperLevels: Record<string, number>;
    queue: any[];
    isDiscarded: boolean;
  }>;
  setPrinters: (printers: any[] | ((prev: any[]) => any[])) => void;
  discardedPrinters: string[];
  setDiscardedPrinters: (printers: string[] | ((prev: string[]) => string[])) => void;
  refreshPrinters: () => Promise<void>;
  
}

const ElectronContext = createContext<ElectronContextType | undefined>(undefined)

export function ElectronProvider({ children }: { children: ReactNode }) {
  const isElectron = typeof window !== "undefined" && window.electronAPI
  const ipcRenderer = isElectron && window.electronAPI ? window.electronAPI.ipcRenderer : null
   const [printers, setPrinters] = useState<any[]>([]);
  const [discardedPrinters, setDiscardedPrinters] = useState<string[]>([]);

  // Global state
  const [isConnected, setIsConnected] = useState(false)
  const [printerQueues, setPrinterQueues] = useState<Record<string, any[]>>({})
  const [metrics, setMetrics] = useState({ 
    totalPages: 0, 
    monochromeJobs: 0, 
    colorJobs: 0, 
    totalIncome: 0,
    totalPayoutsRequested: 0 
  })
  const [dailyMetrics, setDailyMetrics] = useState({})
  const [printerInfo, setPrinterInfo] = useState({ capabilities: {}, paperLevels: {}, discardedPrinters: [] })
  const [jobHistory, setJobHistory] = useState<any[]>([])
  const [currentUser, setCurrentUser] = useState(null)
  const [shopInfo, setShopInfo] = useState(null)
   const refreshPrinters = async () => {
    if (isElectron) {
      try {
        const response = await invoke("get-printers");
        
        if (!response) {
          console.warn("get-printers returned undefined/null response");
          return;
        }
        
        const {
          printers: printerList = [],
          printerInfo = { capabilities: {}, paperLevels: {}, discardedPrinters: [] },
          printerQueues = {},
        } = response;
        
        const safeprinterInfo = {
          capabilities: printerInfo.capabilities || {},
          paperLevels: printerInfo.paperLevels || {},
          discardedPrinters: printerInfo.discardedPrinters || [],
        };
        
        const mappedPrinters = printerList.map((printer: any) => ({
          id: printer.name,
          name: printer.name,
          capabilities: printer.capabilities || { color: false, duplex: false, paperSizes: [] },
          paperLevels: safeprinterInfo.paperLevels[printer.name] || {},
          queue: printerQueues[printer.name] || [],
          isDiscarded: safeprinterInfo.discardedPrinters.includes(printer.name),
        }));
        
        setPrinters(mappedPrinters);
        setDiscardedPrinters(safeprinterInfo.discardedPrinters);
        setPrinterQueues(printerQueues);
        setPrinterInfo(safeprinterInfo);
      } catch (error) {
        console.error("Error refreshing printers:", error);
      }
    }
  };
  const send = (channel: string, ...args: any[]) => {
    if (ipcRenderer) {
      ipcRenderer.send(channel, ...args)
    } else {
      console.log(`[Mock IPC] Send: ${channel}`, args)
    }
  }

  const invoke = async (channel: string, ...args: any[]) => {
    if (ipcRenderer) {
      return await ipcRenderer.invoke(channel, ...args)
    } else {
      console.log(`[Mock IPC] Invoke: ${channel}`, args)
      return Promise.resolve(null)
    }
  }

  const on = (channel: string, listener: (...args: any[]) => void) => {
    if (ipcRenderer) {
      ipcRenderer.on(channel, listener)
    } else {
      console.log(`[Mock IPC] On: ${channel}`)
    }
  }

  const removeAllListeners = (channel: string) => {
    if (ipcRenderer) {
      ipcRenderer.removeAllListeners(channel)
    } else {
      console.log(`[Mock IPC] Remove listeners: ${channel}`)
    }
  }

  // Set up comprehensive IPC event listeners
  useEffect(() => {
    if (!isElectron) return

    // Authentication & Session Management
    const handleAuthSuccess = (_event: any, user: any) => {
      setCurrentUser(user)
    }

    const handleAuthError = (_event: any, message: string) => {
      console.error("Auth error:", message)
    }

    const handleSignOutSuccess = () => {
      setCurrentUser(null)
      setIsConnected(false)
    }

    const handleSessionCheckComplete = () => {
      console.log("Session check complete")
    }

    const handleClearAuthError = () => {
      console.log("Auth error cleared")
    }

    // WebSocket & Connection Management
    const handleWebSocketStatus = (_event: any, status: string) => {
      setIsConnected(status === "connected")
      console.log("WebSocket status:", status)
    }

    const handleForceToggleWebSocket = (_event: any, connect: boolean) => {
      setIsConnected(connect)
    }

    // Printer Management - Add safety checks
    const handlePrinterInfoUpdated = (_event: any, data: any) => {
      console.log("Printer info updated:", data)
      
      // More robust data validation
      if (!data) {
        console.warn("printer-info-updated received undefined data")
        return
      }
      
      if (typeof data !== "object") {
        console.warn("printer-info-updated received invalid data:", data)
        return
      }

      // Check for required properties with specific structure validation
      const { printerInfo, printerQueues } = data
      
      // Ensure printerInfo has required structure before updating state
      if (printerInfo) {
        // Validate printerInfo structure to ensure it has required properties
        const validPrinterInfo = {
          capabilities: printerInfo.capabilities || {},
          paperLevels: printerInfo.paperLevels || {},
          discardedPrinters: Array.isArray(printerInfo.discardedPrinters) 
            ? printerInfo.discardedPrinters 
            : []
        }
        
        // Now update state with validated data
        setPrinterInfo(validPrinterInfo)
        setDiscardedPrinters(validPrinterInfo.discardedPrinters)
        console.log("Updated printerInfo state:", validPrinterInfo)

        setPrinters(prev => {
      return prev.map(printer => ({
        ...printer,
        paperLevels: validPrinterInfo.paperLevels[printer.name] || {},
        isDiscarded: validPrinterInfo.discardedPrinters.includes(printer.name),
      }));
      });
  
      }
      
      // Ensure printerQueues is a valid object before updating state
      if (printerQueues && typeof printerQueues === "object") {
        setPrinterQueues(printerQueues)
        setPrinters(prev => {
      return prev.map(printer => ({
        ...printer,
        queue: printerQueues[printer.name] || [],
      }));
    });
        console.log("Updated printerQueues state:", printerQueues)
      }
    }

    const handlePrinterQueuesUpdated = (_event: any, queues: any) => {
  if (queues && typeof queues === "object") {
    console.log("ElectronProvider: Printer queues updated from main process:", queues);
    
    // Update the global queues state
    setPrinterQueues(queues);
    
    // Also update the printers state to stay in sync
    setPrinters((prev) => {
      return prev.map((printer) => ({
        ...printer,
        queue: queues[printer.name] || [],
      }));
    });
  }
}

    const handlePrinterStatus = (_event: any, status: any) => {
      console.log("Printer status:", status)
    }

    // Job Management
const handlePrintJob = (_event: any, job: any) => {
  console.log("ElectronProvider: New print job received:", job);
  
  // Update the global queue state
  if (job) {
    // The printer name might be in job.printer_name or job.assigned_printer depending on when in the workflow we are
    const printerName = job.printer_name || job.assigned_printer;
    
    if (printerName) {
      setPrinterQueues((prev) => {
        const newQueues = { ...prev };
        if (!newQueues[printerName]) {
          newQueues[printerName] = [];
        }
        
        // Check if job already exists in queue and update it, or add it if new
        const existingJobIndex = newQueues[printerName].findIndex((queuedJob) => queuedJob.id === job.id);
        
        if (existingJobIndex >= 0) {
          // Update existing job
          newQueues[printerName] = [
            ...newQueues[printerName].slice(0, existingJobIndex),
            job,
            ...newQueues[printerName].slice(existingJobIndex + 1)
          ];
        } else {
          // Add new job
          newQueues[printerName] = [...newQueues[printerName], job];
        }
        
        console.log(`ElectronProvider: Updated queue for ${printerName}:`, newQueues[printerName]);
        return newQueues;
      });
      
      // Also update the printers state to keep it in sync
      setPrinters((prev) => 
        prev.map((printer) => {
          if (printer.name === printerName) {
            // Find if job already exists in queue
            const existingQueue = [...printer.queue || []];
            const existingJobIndex = existingQueue.findIndex((queuedJob) => queuedJob.id === job.id);
            
            let updatedQueue;
            if (existingJobIndex >= 0) {
              // Update existing job
              updatedQueue = [
                ...existingQueue.slice(0, existingJobIndex),
                job,
                ...existingQueue.slice(existingJobIndex + 1)
              ];
            } else {
              // Add new job
              updatedQueue = [...existingQueue, job];
            }
            
            return { ...printer, queue: updatedQueue };
          }
          return printer;
        })
      );
    }
  }
}

const handlePrintComplete = (_event: any, jobId: string) => {
  console.log("Print job completed:", jobId);
  
  // Find the job in all printer queues and update its status
  setPrinterQueues((prev) => {
    const newQueues = { ...prev };
    
    // Check all printer queues for the job
    Object.keys(newQueues).forEach((printerName) => {
      const jobIndex = newQueues[printerName].findIndex((job) => job.id === jobId);
      if (jobIndex >= 0) {
        // Update the job status
        newQueues[printerName] = [
          ...newQueues[printerName].slice(0, jobIndex),
          { ...newQueues[printerName][jobIndex], print_status: "completed" },
          ...newQueues[printerName].slice(jobIndex + 1)
        ];
      }
    });
    
    return newQueues;
  });
  
  // Also update the printers state
  setPrinters((prev) => 
    prev.map((printer) => {
      const jobIndex = printer.queue?.findIndex((job: { id: string }) => job.id === jobId);
      if (jobIndex >= 0 && jobIndex !== undefined) {
        const updatedQueue = [
          ...printer.queue.slice(0, jobIndex),
          { ...printer.queue[jobIndex], print_status: "completed" },
          ...printer.queue.slice(jobIndex + 1)
        ];
        return { ...printer, queue: updatedQueue };
      }
      return printer;
    })
  );
}

const handlePrintFailed = (_event: any, jobId: string) => {
  console.log("Print job failed:", jobId);
  
  // Find the job in all printer queues and update its status
  setPrinterQueues((prev) => {
    const newQueues = { ...prev };
    
    // Check all printer queues for the job
    Object.keys(newQueues).forEach((printerName) => {
      const jobIndex = newQueues[printerName].findIndex((job) => job.id === jobId);
      if (jobIndex >= 0) {
        // Update the job status
        newQueues[printerName] = [
          ...newQueues[printerName].slice(0, jobIndex),
          { ...newQueues[printerName][jobIndex], print_status: "failed" },
          ...newQueues[printerName].slice(jobIndex + 1)
        ];
      }
    });
    
    return newQueues;
  });
  
  // Also update the printers state
  setPrinters((prev) => 
    prev.map((printer) => {
      const jobIndex = printer.queue?.findIndex((job: { id: string }) => job.id === jobId);
      if (jobIndex >= 0 && jobIndex !== undefined) {
        const updatedQueue = [
          ...printer.queue.slice(0, jobIndex),
          { ...printer.queue[jobIndex], print_status: "failed" },
          ...printer.queue.slice(jobIndex + 1)
        ];
        return { ...printer, queue: updatedQueue };
      }
      return printer;
    })
  );
}

    const handleJobHistoryUpdated = () => {
      // Refresh job history
      if (isElectron) {
        invoke("get-job-history").then((history) => {
          if (history) setJobHistory(history)
        })
      }
    }

    // Metrics Management - Add safety checks
    const handleMetricsUpdated = (_event: any, updatedMetrics: any) => {
      if (updatedMetrics && typeof updatedMetrics === "object") {
        // Ensure the metrics object has all required fields with defaults
        const safeMetrics = {
          totalPages: updatedMetrics.totalPages || 0,
          monochromeJobs: updatedMetrics.monochromeJobs || 0,
          colorJobs: updatedMetrics.colorJobs || 0,
          totalIncome: updatedMetrics.totalIncome || 0,
          totalPayoutsRequested: updatedMetrics.totalPayoutsRequested || 0
        };
        
        setMetrics(safeMetrics);
      }
    }

    const handleDailyMetricsUpdated = (_event: any, updatedDailyMetrics: any) => {
      if (updatedDailyMetrics && typeof updatedDailyMetrics === "object") {
        // Make a deep copy to avoid reference issues
        const safeDailyMetrics = JSON.parse(JSON.stringify(updatedDailyMetrics));
        
        // Make sure each day entry has the right structure
        Object.keys(safeDailyMetrics).forEach(date => {
          const dayData = safeDailyMetrics[date];
          
          // Ensure all required properties exist with defaults
          if (!dayData.totalPages) dayData.totalPages = 0;
          if (!dayData.monochromeJobs) dayData.monochromeJobs = 0;
          if (!dayData.colorJobs) dayData.colorJobs = 0;
          if (!dayData.totalIncome) dayData.totalIncome = 0;
          
          // Ensure payouts is an array
          if (!Array.isArray(dayData.payouts)) {
            dayData.payouts = [];
          } else {
            // Make sure each payout has the right structure
            dayData.payouts = dayData.payouts.map((payout: { amount: any; timestamp: any; status: any; reference: any }) => {
              if (typeof payout === 'object') {
                return {
                  amount: Number(payout.amount || 0),
                  timestamp: payout.timestamp || new Date().toISOString(),
                  status: payout.status || "requested",
                  reference: payout.reference || "unknown"
                };
              }
              return {
                amount: 0,
                timestamp: new Date().toISOString(),
                status: "requested",
                reference: "unknown"
              };
            });
          }
        });
        
        console.log("Updated daily metrics:", safeDailyMetrics);
        setDailyMetrics(safeDailyMetrics);
      }
    }

    // KYC & Shop Management
    const handleKycRequired = () => {
      console.log("KYC required")
    }

    const handleKycVerified = () => {
      console.log("KYC verified")
    }

const handleShopInfoFetched = (_event: any, info: any) => {
  console.log("ElectronProvider received shop info:", info);
  if (info && !info.error) {
    setShopInfo(info);
  } else if (info?.error) {
    console.error("Shop info fetch error:", info.error);
    setShopInfo(null);
  }
}

    const handleShopInfoUpdated = (_event: any, result: any) => {
      console.log("Shop info updated:", result)
    }

    // System Updates
    const handleUpdateStatus = (_event: any, data: any) => {
      console.log("Update status:", data)
    }

    const handleUpdateAvailable = () => {
      console.log("Update available")
    }

    const handleUpdateDownloaded = () => {
      console.log("Update downloaded")
    }

    const handleUpdateError = (_event: any, error: string) => {
      console.error("Update error:", error)
    }

    // System Messages
    const handleLogMessage = (_event: any, message: string) => {
      console.log("[Main Process]", message)
    }

    const handleAllPrintersDiscarded = () => {
      console.log("All printers discarded")
    }

    // Set up all IPC listeners
    const listeners = [
      // Authentication
      ["auth-success", handleAuthSuccess],
      ["auth-error", handleAuthError],
      ["sign-out-success", handleSignOutSuccess],
      ["session-check-complete", handleSessionCheckComplete],
      ["clear-auth-error", handleClearAuthError],

      // WebSocket
      ["websocket-status", handleWebSocketStatus],
      ["force-toggle-websocket", handleForceToggleWebSocket],

      // Printers
      ["printer-queues-updated", handlePrinterQueuesUpdated],
      ["printer-info-updated", handlePrinterInfoUpdated],
      ["printer-status", handlePrinterStatus],
      ["all-printers-discarded", handleAllPrintersDiscarded],

      // Jobs
      ["print-job", handlePrintJob],
      ["print-complete", handlePrintComplete],
      ["print-failed", handlePrintFailed],
      ["job-history-updated", handleJobHistoryUpdated],

      // Metrics
      ["metrics-updated", handleMetricsUpdated],
      ["daily-metrics-updated", handleDailyMetricsUpdated],

      // KYC & Shop
      ["kyc-required", handleKycRequired],
      ["kyc-verified", handleKycVerified],
      ["shop-info-fetched", handleShopInfoFetched],
      ["shop-info-updated", handleShopInfoUpdated],

      // Updates
      ["update-status", handleUpdateStatus],
      ["update-available", handleUpdateAvailable],
      ["update-downloaded", handleUpdateDownloaded],
      ["update-error", handleUpdateError],

      // System
      ["log-message", handleLogMessage],
    ]

    // Register all listeners
    listeners.forEach(([channel, handler]) => {
      on(channel as string, handler as any)
    })

    // Initial data loading
    const loadInitialData = async () => {
      try {
        // Load metrics with fallback
        try {
          const metricsData = await invoke("get-metrics")
          if (metricsData && typeof metricsData === "object") {
            setMetrics(metricsData)
          }
        } catch (error) {
          console.warn("Failed to load metrics:", error)
        }

        // Load daily metrics with fallback
        try {
          const dailyMetricsData = await invoke("get-daily-metrics")
          if (dailyMetricsData && typeof dailyMetricsData === "object") {
            setDailyMetrics(dailyMetricsData)
          }
        } catch (error) {
          console.warn("Failed to load daily metrics:", error)
        }

        // Load job history with fallback
        try {
          const historyData = await invoke("get-job-history")
          if (historyData && Array.isArray(historyData)) {
            setJobHistory(historyData)
          }
        } catch (error) {
          console.warn("Failed to load job history:", error)
        }

        // Load printer info with improved error handling
        try {
          //console.log("Attempting to load printer data...")
          const printerData = await invoke("get-printers")
          //console.log("Received printer data:", printerData)
          
          if (printerData && typeof printerData === "object") {
            // Extract properties with default values for safety
            const safeprinterInfo = {
              capabilities: (printerData.printerInfo?.capabilities || {}),
              paperLevels: (printerData.printerInfo?.paperLevels || {}),
              discardedPrinters: Array.isArray(printerData.printerInfo?.discardedPrinters) 
                ? printerData.printerInfo.discardedPrinters 
                : []
            }
            
            // Use validated printer queues or empty object
            const safePrinterQueues = 
              (printerData.printerQueues && typeof printerData.printerQueues === "object") 
                ? printerData.printerQueues 
                : {}
            
            console.log("Setting printer state with:", { safeprinterInfo, safePrinterQueues })
            setPrinterInfo(safeprinterInfo)
            setPrinterQueues(safePrinterQueues)
            const printerList = printerData.printers || [];
          const mappedPrinters = printerList.map((printer: any) => ({
            id: printer.name,
            name: printer.name,
            capabilities: printer.capabilities || { color: false, duplex: false, paperSizes: [] },
            paperLevels: safeprinterInfo.paperLevels[printer.name] || {},
            queue: safePrinterQueues[printer.name] || [],
            isDiscarded: safeprinterInfo.discardedPrinters.includes(printer.name),
          }));
          
          setPrinters(mappedPrinters);
          setDiscardedPrinters(safeprinterInfo.discardedPrinters);

          } else {
            console.warn("Invalid printer data format received:", printerData)
          }
        } catch (error) {
          console.error("Failed to load printer data:", error)
          // Set defaults on error
          setPrinterInfo({ capabilities: {}, paperLevels: {}, discardedPrinters: [] })
          setPrinterQueues({})
          setPrinters([])
          setDiscardedPrinters([])
        }
      } catch (error) {
        console.error("Error loading initial data:", error)
      }
    }

    loadInitialData()

    // Cleanup listeners on unmount
    return () => {
      listeners.forEach(([channel]) => {
        removeAllListeners(channel as string)
      })
    }
  }, [isElectron])

  return (
    <ElectronContext.Provider
      value={{
        ipcRenderer,
        isElectron: !!isElectron,
        send,
        invoke,
        on,
        removeAllListeners,
        isConnected,
        setIsConnected,
        printerQueues,
        setPrinterQueues,
        metrics,
        setMetrics,
        dailyMetrics,
        setDailyMetrics,
        printerInfo,
        setPrinterInfo,
        jobHistory,
        setJobHistory,
        currentUser,
        setCurrentUser,
        shopInfo,
        setShopInfo,
        printers,
        setPrinters,
        discardedPrinters,
        setDiscardedPrinters,
        refreshPrinters,
      }}
    >
      {children}
    </ElectronContext.Provider>
  )
}

export function useElectron() {
  const context = useContext(ElectronContext)
  if (context === undefined) {
    throw new Error("useElectron must be used within an ElectronProvider")
  }
  return context
}
