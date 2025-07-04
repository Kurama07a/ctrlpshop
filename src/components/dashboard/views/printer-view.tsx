"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "../../ui/card"
import { Button } from "../../ui/button"
import { Badge } from "../../ui/badge"
import { RefreshCw, Trash2, Undo2 } from "lucide-react"
import { useNotifications } from "../../notifications/notification-provider"
import { useElectron } from "../../electron/electron-provider"
import { set } from "date-fns"

interface Payout {
  reference: string;
  timestamp: string;
  amount: number;
  status: string;
}

interface Printer {
  id: string
  name: string
  capabilities: {
    color: boolean
    duplex: boolean
    paperSizes: string[]
  }
  paperLevels: Record<string, number>
  queue: any[]
  isDiscarded: boolean
}

export function PrinterView() {
  
  const { 
    dailyMetrics, 
    printerQueues, 
    setDailyMetrics,
    printerInfo, 
    invoke, 
    send, 
    on, 
    removeAllListeners, 
    isElectron,
    // Add these from the global state
    printers,
    setPrinters,
    discardedPrinters,
    setDiscardedPrinters,
    refreshPrinters: globalRefreshPrinters
  } = useElectron()
  const { addNotification } = useNotifications()

  useEffect(() => {
    if (isElectron) {
      // Set up IPC listeners for real-time updates
      const handlePrinterInfoUpdated = (_event: any, data: any) => {
  // Handle case where data is undefined
  if (!data) {
    console.warn("printer-info-updated received undefined data")
    return;
  }

  // Safely destructure with default empty objects
  const printerInfo = data.printerInfo || {};
  const printerQueues = data.printerQueues || {};

  // Ensure printerInfo has required structure
  const safeprinterInfo = {
    capabilities: printerInfo.capabilities || {},
    paperLevels: printerInfo.paperLevels || {},
    discardedPrinters: Array.isArray(printerInfo.discardedPrinters) 
      ? printerInfo.discardedPrinters 
      : [],
  }
  console.log("PrinterView: Setting discarded printers", safeprinterInfo.discardedPrinters)
  setDiscardedPrinters(safeprinterInfo.discardedPrinters)

  // Update printer paper levels and queues safely
  console.log("PrinterView: Updating printer with the new queue data", printerQueues)
  setPrinters((prev) =>
    prev.map((printer) => ({
      ...printer,
      paperLevels: safeprinterInfo.paperLevels[printer.name] || printer.paperLevels,
      queue: printerQueues[printer.name] || [],
    })),
  )
}

      const handlePrintJob = (_event: any, job: any) => {
  console.log("PrinterView: Received print-job event for job:", job);
  addNotification(`New job received: ${job.id}`, "info");

  // Get the printer name from the job
  const printerName = job.printer_name || job.assigned_printer;
  
  if (printerName) {
    console.log(`PrinterView: Updating local queue for printer ${printerName}`);
    
    // Update the printers state immediately
    setPrinters((prev) => 
      prev.map((printer) => {
        if (printer.name === printerName) {
          // Check if job already exists in queue
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
          
          console.log(`PrinterView: Updated queue for ${printer.name}:`, updatedQueue);
          return { ...printer, queue: updatedQueue };
        }
        return printer;
      })
    );
  } else {
    console.warn("PrinterView: Job received without printer name:", job);
  }
}
const handlePrintComplete = (_event: any, jobId: string, jobData?: any) => {
  console.log(`PrinterView: Job ${jobId} completed`, jobData);
  addNotification(`Job ${jobId} completed successfully`, "success");
  
  // Update job status in the UI immediately
  setPrinters((prev) => 
    prev.map((printer) => {
      const jobIndex = printer.queue?.findIndex((job: { id: string }) => job.id === jobId);
      if (jobIndex >= 0 && jobIndex !== undefined) {
        console.log(`PrinterView: Updating job ${jobId} status to completed in ${printer.name} queue`);
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
  
  // Find the completed job in our printers state to update metrics
  let completedJob = null;
  printers.forEach(printer => {
    const job = printer.queue?.find((j: { id: string }) => j.id === jobId);
    if (job) completedJob = job;
  });
  
  // Update metrics if we found the job
  if (completedJob) {
    updateMetricsForCompletedJob(completedJob);
  } else if (jobData) {
    // If job wasn't found in state but data was provided with the event
    updateMetricsForCompletedJob(jobData);
  }
  
  // Also fetch the latest data
  fetchAndDisplayPrinters();
}

// Fix the function to properly update dailyMetrics
const updateMetricsForCompletedJob = (job: any) => {
  const today = new Date().toISOString().split('T')[0];
  console.log("PrinterView: Updating metrics for completed job", job);
  
  // Calculate values to add
  const isColorJob = job.color_mode?.toLowerCase() === 'color';
  const pagesToAdd = Number(job.number_of_pages) || 0;
  const colorJobsToAdd = isColorJob ? 1 : 0;
  const monochromeJobsToAdd = isColorJob ? 0 : 1;
  
  // Calculate income (adjust based on your pricing model)
  const pricePerPage = isColorJob ? 5 : 1; // Example: ₹5 for color, ₹1 for B&W
  const jobAmount = job.amount || pagesToAdd * pricePerPage;
  const incomeToAdd = Number(jobAmount) * 0.8; // 80% of job amount goes to income
  
  console.log(`PrinterView: Updating metrics for job ${job.id}:`, {
    pages: pagesToAdd,
    colorJob: isColorJob,
    income: incomeToAdd
  });
  
  // Send update to main process if in Electron mode
  if (isElectron) {
    // Fixed: Use dailyMetrics from context rather than calling it as a function
    const updatedTodayMetrics = {
      totalPages: (dailyMetrics[today]?.totalPages || 0) + pagesToAdd,
      colorJobs: (dailyMetrics[today]?.colorJobs || 0) + colorJobsToAdd,
      monochromeJobs: (dailyMetrics[today]?.monochromeJobs || 0) + monochromeJobsToAdd,
      totalIncome: (dailyMetrics[today]?.totalIncome || 0) + incomeToAdd,
    };
    
    console.log("PrinterView: Sending updated metrics to main process", updatedTodayMetrics);
    
    // Update global state through electron
    send("update-daily-metrics", {
      date: today,
      metrics: updatedTodayMetrics
    });
    
    // Fixed: Use setDailyMetrics from context
    setDailyMetrics({
      ...dailyMetrics,
      [today]: updatedTodayMetrics
    });
  }
}

const handlePrintFailed = (_event: any, jobId: string) => {
  console.log(`PrinterView: Job ${jobId} failed`);
  addNotification(`Job ${jobId} failed`, "error");
  
  // Update job status in the UI immediately
  setPrinters((prev) => 
    prev.map((printer) => {
      const jobIndex = printer.queue?.findIndex((job: { id: string }) => job.id === jobId);
      if (jobIndex >= 0 && jobIndex !== undefined) {
        console.log(`PrinterView: Updating job ${jobId} status to failed in ${printer.name} queue`);
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
  
  // Also fetch the latest data
  fetchAndDisplayPrinters();
}


      const handleAllPrintersDiscarded = () => {
        addNotification("All printers are discarded. WebSocket connection disabled.", "warning")
      }

      const handleJobHistoryUpdated = () => {
        // Refresh printer data when job history updates
        fetchAndDisplayPrinters()
      }

      // Set up listeners
      on("printer-info-updated", handlePrinterInfoUpdated)
      on("print-job", handlePrintJob)
      on("print-complete", handlePrintComplete)
      on("print-failed", handlePrintFailed)
      on("all-printers-discarded", handleAllPrintersDiscarded)
      on("job-history-updated", handleJobHistoryUpdated)

      // Initial data fetch
      fetchAndDisplayPrinters()

      return () => {
        removeAllListeners("printer-info-updated")
        removeAllListeners("print-job")
        removeAllListeners("print-complete")
        removeAllListeners("print-failed")
        removeAllListeners("all-printers-discarded")
        removeAllListeners("job-history-updated")
      }
    }
     else {
      // Mock data for web version
      setPrinters([
        {
          id: "1",
          name: "Microsoft Print to PDF",
          capabilities: {
            color: true,
            duplex: false,
            paperSizes: ["A4", "A3", "Letter", "Legal"],
          },
          paperLevels: { A4: 586, A3: 0, Letter: 0, Legal: 0 },
          queue: [],
          isDiscarded: false,
        },
      ])
    }
  }, [isElectron, setPrinters, setDiscardedPrinters, addNotification, on, removeAllListeners])

  // Update printer queues when global state changes
  useEffect(() => {
    console.log("PrinterView: printerQueues state updated:", printerQueues);
    
    setPrinters((prev) => {
      console.log("PrinterView: Updating printer queues from global state");
      return prev.map((printer) => {
        const newQueue = printerQueues[printer.name] || [];
        if (JSON.stringify(printer.queue) !== JSON.stringify(newQueue)) {
          console.log(`PrinterView: Queue updated for ${printer.name}:`, newQueue);
        }
        return {
          ...printer,
          queue: newQueue,
        };
      });
    });
  }, [printerQueues])

  const fetchAndDisplayPrinters = async () => {
    try {
      const response = await invoke("get-printers")

      // Handle case where response is undefined or null
      if (!response) {
        console.warn("get-printers returned undefined/null response")
        setPrinters([])
        setDiscardedPrinters([])
        return
      }

      // Destructure with fallbacks
      const {
        printers: printerList = [],
        printerInfo = { capabilities: {}, paperLevels: {}, discardedPrinters: [] },
        printerQueues = {},
      } = response

      // Ensure printerInfo has required properties
      const safeprinterInfo = {
        capabilities: printerInfo.capabilities || {},
        paperLevels: printerInfo.paperLevels || {},
        discardedPrinters: printerInfo.discardedPrinters || [],
      }

      const mappedPrinters = printerList.map((printer: any) => ({
        id: printer.name,
        name: printer.name,
        capabilities: printer.capabilities || { color: false, duplex: false, paperSizes: [] },
        paperLevels: safeprinterInfo.paperLevels[printer.name] || {},
        queue: printerQueues[printer.name] || [],
        isDiscarded: safeprinterInfo.discardedPrinters.includes(printer.name),
      }))

      setPrinters(mappedPrinters)
      setDiscardedPrinters(safeprinterInfo.discardedPrinters)
    } catch (error) {
      console.error("Error fetching printers:", error)
      addNotification("Failed to fetch printers", "error")
      // Set safe defaults on error
      setPrinters([])
      setDiscardedPrinters([])
    }
  }

  const addPaper = async (printerName: string, paperSize: string, amount: number) => {
    if (isElectron) {
      // Get current levels
      const printer = printers.find((p) => p.name === printerName)
      if (printer) {
        const newLevels = {
          ...printer.paperLevels,
          [paperSize]: (printer.paperLevels[paperSize] || 0) + amount,
        }

        send("update-printer-paper-levels", { printerName, levels: newLevels })

        // Update local state immediately for better UX
        setPrinters((prev) => prev.map((p) => (p.name === printerName ? { ...p, paperLevels: newLevels } : p)))
      }
    } else {
      // Mock update for web version
      setPrinters((prev) =>
        prev.map((p) =>
          p.name === printerName
            ? {
                ...p,
                paperLevels: {
                  ...p.paperLevels,
                  [paperSize]: (p.paperLevels[paperSize] || 0) + amount,
                },
              }
            : p,
        ),
      )
    }

    addNotification(`Added ${amount} pages of ${paperSize} to ${printerName}`, "success")
  }

  const discardPrinter = (printerName: string) => {
    const newDiscardedList = [...discardedPrinters, printerName]
    setDiscardedPrinters(newDiscardedList)

    if (isElectron) {
      send("update-discarded-printers", newDiscardedList)
    }

    addNotification(`Printer ${printerName} discarded`, "warning")
  }

  const restorePrinter = (printerName: string) => {
    const newDiscardedList = discardedPrinters.filter((name) => name !== printerName)
    setDiscardedPrinters(newDiscardedList)

    if (isElectron) {
      send("update-discarded-printers", newDiscardedList)
    }

    addNotification(`Printer ${printerName} restored`, "success")
  }

  const refreshPrinters = async () => {
    if (isElectron) {
      await fetchAndDisplayPrinters()
      addNotification("Printer list refreshed successfully", "success")
    } else {
      addNotification("Refresh not available in web mode", "info")
    }
  }

  const activePrinters = printers.filter((p) => !discardedPrinters.includes(p.name))
  const discardedPrintersList = printers.filter((p) => discardedPrinters.includes(p.name))

  // Get today's metrics
  const today = new Date().toISOString().split("T")[0]
  const todayMetrics = dailyMetrics[today] || {
    totalPages: 0,
    monochromeJobs: 0,
    colorJobs: 0,
    totalIncome: 0,
    payouts: []
  };

  // Calculate total payouts already requested today
  const totalPayoutsRequestedToday = (todayMetrics.payouts || [])
    .reduce((sum: any, payout: { amount: any }) => sum + payout.amount, 0);

  // Calculate available amount for payout
  const availableForPayout = Math.max(0, todayMetrics.totalIncome - totalPayoutsRequestedToday);

const PayoutButton = ({ totalIncome, eligibleAmount }: { totalIncome: number, eligibleAmount: number }) => {
  const { invoke, send, currentUser, shopInfo, dailyMetrics } = useElectron();
  const { addNotification } = useNotifications();
  const [isRequesting, setIsRequesting] = useState(false);
  
  // Ensure eligibleAmount is >= 0
  const safeEligibleAmount = Math.max(0, eligibleAmount);
  
  const requestPayout = async () => {
    console.log("PayoutButton: Request payout clicked", { 
      totalIncome, 
      eligibleAmount: safeEligibleAmount,
      shopInfo: shopInfo || "No shop info available", 
      currentUser: currentUser || "No user info available" 
    });
    
    if (!shopInfo) {
      console.error("PayoutButton: Shop information not available", { shopInfo });
      addNotification("Shop information not available. Cannot request payout.", "error");
      return;
    }
    
    setIsRequesting(true);
    
    try {
      // Calculate correct eligible amount based on today's payouts
      const today = new Date().toISOString().split("T")[0];
      console.log("PayoutButton: Today's date for payout", today);
      console.log("PayoutButton: Daily metrics data", dailyMetrics);
      
      const todayPayouts = (dailyMetrics[today]?.payouts || []);
      console.log("PayoutButton: Today's existing payouts", todayPayouts);
      
      const totalPayoutsRequestedToday = todayPayouts.reduce((total: number, payout: { amount: any }) => total + Number(payout.amount), 0);
      console.log("PayoutButton: Total payouts requested today", totalPayoutsRequestedToday);
      
      const actualEligibleAmount = Math.max(0, totalIncome - totalPayoutsRequestedToday);
      console.log("PayoutButton: Actual eligible amount", actualEligibleAmount);
      
      // Don't allow negative payouts or more than available
      if (actualEligibleAmount <= 0) {
        console.error("PayoutButton: No funds available for payout", { actualEligibleAmount });
        throw new Error("No funds available for payout");
      }

      // Use the actual eligible amount for the payout request
      const reference = `PAY-${today.slice(5,7)}${today.slice(8,10)}-${Math.floor(Math.random()*1000).toString().padStart(3, '0')}`;
      console.log("PayoutButton: Generated reference", reference);
      
      const payoutData = {
        shopName: shopInfo.name || "Unknown Shop",
        shopEmail: shopInfo.email || currentUser?.email || "unknown@email.com",
        bankDetails: shopInfo.bankDetails || {},
        reference
      };
      
      console.log("PayoutButton: Sending payout request to main process", {
        amount: safeEligibleAmount,
        reference,
        date: today,
        payoutData
      });
      
      // Send the payout request to the main process
      const result = await invoke("request-payout", {
        amount: safeEligibleAmount,
        reference,
        date: today,
        payoutData
      });
      
      console.log("PayoutButton: Received response from main process", result);
      
      if (result && result.success) {
        addNotification(`Payout request of ₹${safeEligibleAmount.toFixed(2)} submitted successfully`, "success");
      } else {
        throw new Error(result?.message || "Unknown error");
      }
    } catch (error) {
      console.error("PayoutButton: Error requesting payout:", error);
      addNotification(`Failed to request payout: ${error instanceof Error ? error.message : "Unknown error"}`, "error");
    } finally {
      setIsRequesting(false);
    }
  };
  
  return (
    <Button 
      onClick={requestPayout} 
      disabled={safeEligibleAmount < 50 || isRequesting}
      className="mt-2 w-full"
    >
      {isRequesting ? "Requesting..." : `Request Payout (₹${safeEligibleAmount.toFixed(2)})`}
    </Button>
  );
};

// Add this component to show payout history
const PayoutHistory = ({ payouts = [] }: { payouts: Payout[] }) => {
  if (payouts.length === 0) {
    return <p className="text-sm text-muted-foreground">No payout history</p>;
  }

  return (
    <div className="mt-2">
      <h4 className="text-sm font-medium mb-1">Recent Payouts</h4>
      <div className="text-xs space-y-1">
        {payouts.map((payout, i) => (
          <div key={i} className="flex justify-between border-b pb-1">
            <div>
              <span className="font-medium">{payout.reference}</span>
              <span className="ml-2 text-muted-foreground">
                {new Date(payout.timestamp).toLocaleString()}
              </span>
            </div>
            <div className="flex items-center">
              <span className="mr-2">₹{payout.amount.toFixed(2)}</span>
                           <Badge 
                variant={payout.status === "completed" ? "default" : 
                       payout.status === "requested" ? "outline" : "destructive"}
              >
                {payout.status}
              </Badge>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

  return (
    <div className="space-y-6">
      {/* Daily Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Today's Total Pages</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{todayMetrics.totalPages}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Today's Total Jobs</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              <span className="text-black">{todayMetrics.monochromeJobs}</span>
              <span className="mx-1">/</span>
              <span className="text-red-600">{todayMetrics.colorJobs}</span>
              <div className="text-xs text-muted-foreground mt-1">B&W / Color</div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Today's Total Income</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">₹{Number(todayMetrics.totalIncome).toFixed(2)}</div>
          </CardContent>
        </Card>
      </div>

      {/* Payout Card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">Payout Eligible</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <div className="text-sm text-muted-foreground">Total Income</div>
                <div className="text-lg font-semibold">₹{Number(todayMetrics.totalIncome).toFixed(2)}</div>
              </div>
              <div>
                <div className="text-sm text-muted-foreground">Total Payouts Requested</div>
                <div className="text-lg font-semibold">₹{Number(todayMetrics.totalPayoutsRequested || 0).toFixed(2)}</div>
              </div>
            </div>
            
            <div className="border-t pt-2 mt-2">
              <div className="text-sm text-muted-foreground">Available for Payout</div>
              <div className="text-xl font-bold">
                ₹{Number(todayMetrics.totalIncome - (todayMetrics.totalPayoutsRequested || 0)).toFixed(2)}
              </div>
            </div>
            
            <PayoutButton 
              totalIncome={todayMetrics.totalIncome} 
              eligibleAmount={availableForPayout} 
            />

            {/* Add Payout History here */}
            <PayoutHistory payouts={todayMetrics.payouts || []} />
          </div>
        </CardContent>
      </Card>

      {/* Discarded Printers */}
      {discardedPrintersList.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Undo2 className="h-5 w-5" />
              <span>Discarded Printers</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {discardedPrintersList.map((printer) => (
                <Button
                  key={printer.id}
                  variant="outline"
                  size="sm"
                  onClick={() => restorePrinter(printer.name)}
                  className="flex items-center space-x-2"
                >
                  <Undo2 className="h-4 w-4" />
                  <span>Restore {printer.name}</span>
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Connected Printers */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Connected Printers</h2>
        <Button variant="outline" size="sm" onClick={refreshPrinters}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh Printers
        </Button>
      </div>

      <div className="space-y-4">
        {activePrinters.map((printer) => (
          <Card key={printer.id}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>{printer.name}</CardTitle>
                  <div className="flex items-center space-x-4 mt-2">
                    <span className="text-sm text-muted-foreground">
                      Color: {printer.capabilities.color ? "Yes" : "No"}
                    </span>
                    <span className="text-sm text-muted-foreground">
                      Duplex: {printer.capabilities.duplex ? "Yes" : "No"}
                    </span>
                  </div>
                </div>
                <Button variant="destructive" size="sm" onClick={() => discardPrinter(printer.name)}>
                  <Trash2 className="h-4 w-4 mr-2" />
                  Discard
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {/* Paper Levels */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
                {printer.capabilities.paperSizes.map((size) => (
                  <div key={size} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">{size}</span>
                      <span className="text-sm text-muted-foreground">{printer.paperLevels[size] || 0} pages</span>
                    </div>
                    <div className="flex space-x-2">
                      <Button size="sm" variant="outline" onClick={() => addPaper(printer.name, size, 100)}>
                        +100
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => addPaper(printer.name, size, 500)}>
                        +500
                      </Button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Job Queue */}
              <div className="border rounded-lg p-4">
                <h4 className="font-medium mb-2">Job Queue</h4>
                {printer.queue.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No jobs in queue</p>
                ) : (
                  <div className="space-y-2">
                    {printer.queue.map((job: any, index: number) => (
                      <div key={index} className="flex items-center justify-between p-2 bg-muted rounded">
                        <span className="text-sm">
                          Job {job.id} - {job.number_of_pages} pages ({job.color_mode})
                        </span>
                        <Badge variant={job.print_status === "completed" ? "default" : "secondary"}>
                          {job.print_status}
                        </Badge>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {activePrinters.length === 0 && (
        <Card>
          <CardContent className="text-center py-12">
            <h3 className="text-lg font-medium mb-2">No Physical Printers Found</h3>
            <p className="text-muted-foreground mb-4">Please ensure that:</p>
            <ul className="text-sm text-muted-foreground space-y-1">
              <li>• Your printer is properly connected</li>
              <li>• Printer drivers are installed</li>
              <li>• The printer is turned on</li>
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
