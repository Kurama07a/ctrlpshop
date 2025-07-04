"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card"
import { Button } from "../../components/ui/button"
import { Badge } from "../../components/ui/badge"
import { Switch } from "../../components/ui/switch"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../../components/ui/tabs"
import { RefreshCw, Palette, Copy, FileText, ArrowLeft } from "lucide-react"
import { useElectron } from "../../components/electron/electron-provider"
import { useNotifications } from "../../components/notifications/notification-provider"

interface PrinterCapability {
  id: string
  name: string
  paperSizes: number
  sheets: number
  badges: string[]
  capabilities: {
    color: boolean
    duplex: boolean
    paperSizes: string[]
    colorJobsOnly?: boolean
    monochromeJobsOnly?: boolean
    duplexJobsOnly?: boolean
    simplexJobsOnly?: boolean
  }
}

export function PrinterSettings() {
  const [selectedPrinter, setSelectedPrinter] = useState<string | null>(null)
  const [printers, setPrinters] = useState<PrinterCapability[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const { invoke, isElectron } = useElectron()
  const { addNotification } = useNotifications()

  useEffect(() => {
    if (isElectron) {
      loadPrinterCapabilities()
    } else {
      // Mock data for web version
      setPrinters([
        {
          id: "1",
          name: "Microsoft Print to PDF",
          paperSizes: 4,
          sheets: 586,
          badges: ["Color", "Low Paper"],
          capabilities: {
            color: true,
            duplex: false,
            paperSizes: ["A4", "A3", "Letter", "Legal"],
          },
        },
      ])
    }
  }, [isElectron])

  const loadPrinterCapabilities = async () => {
    setIsLoading(true)
    try {
      const { printers: printerList, printerInfo } = await invoke("get-printers")

      if (!printerList || printerList.length === 0) {
        setPrinters([])
        return
      }

      const mappedPrinters = printerList.map((printer: any) => {
        const paperLevels = printerInfo.paperLevels[printer.name] || {}
        const isDiscarded = printerInfo.discardedPrinters.includes(printer.name)

        let totalPaper = 0
        let lowPaper = false

        for (const [size, amount] of Object.entries(paperLevels)) {
          totalPaper += amount as number
          if ((amount as number) < 10) lowPaper = true
        }

        const badges = []
        if (printer.capabilities.color) badges.push("Color")
        else badges.push("Monochrome")
        if (printer.capabilities.duplex) badges.push("Duplex")
        if (isDiscarded) badges.push("Discarded")
        if (lowPaper) badges.push("Low Paper")

        return {
          id: printer.name,
          name: printer.name,
          paperSizes: Object.entries(paperLevels).length,
          sheets: totalPaper,
          badges,
          capabilities: printer.capabilities,
        }
      })

      setPrinters(mappedPrinters)
    } catch (error) {
      console.error("Error loading printer capabilities:", error)
      addNotification("Failed to load printer capabilities", "error")
    } finally {
      setIsLoading(false)
    }
  }

  const saveCapabilities = async (printerName: string, capabilities: any) => {
    if (!isElectron) {
      addNotification("Save not available in web mode", "info")
      return
    }

    try {
      const capabilityChanges = {
        [printerName]: capabilities,
      }

      const result = await invoke("update-printer-capabilities", capabilityChanges)

      if (result.success) {
        addNotification(`Printer ${printerName} capabilities updated successfully`, "success")
        await loadPrinterCapabilities() // Refresh the list
      } else {
        addNotification(`Error: ${result.error}`, "error")
      }
    } catch (error) {
      addNotification(`Error saving printer capabilities: ${(error as Error).message}`, "error")
    }
  }

  if (selectedPrinter) {
    const printer = printers.find((p) => p.id === selectedPrinter)

    if (!printer) {
      return (
        <Card>
          <CardContent className="text-center py-12">
            <p>Printer not found</p>
            <Button onClick={() => setSelectedPrinter(null)} className="mt-4">
              Back to Printer List
            </Button>
          </CardContent>
        </Card>
      )
    }

    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <Button variant="outline" onClick={() => setSelectedPrinter(null)}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Printer List
          </Button>
          <Button onClick={loadPrinterCapabilities}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>{printer.name}</CardTitle>
              <Badge>Active</Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Physical Capabilities */}
            <div>
              <h4 className="font-medium mb-4 flex items-center">
                Physical Capabilities
                <Badge variant="secondary" className="ml-2 text-xs">
                  Cannot be modified
                </Badge>
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex items-center justify-between p-3 bg-muted rounded-lg opacity-60">
                  <div className="flex items-center space-x-2">
                    <Palette className="h-4 w-4" />
                    <span>Color Printing</span>
                  </div>
                  <Switch checked={printer.capabilities.color} disabled />
                </div>

                <div className="flex items-center justify-between p-3 bg-muted rounded-lg opacity-60">
                  <div className="flex items-center space-x-2">
                    <Copy className="h-4 w-4" />
                    <span>Duplex Printing</span>
                  </div>
                  <Switch checked={printer.capabilities.duplex} disabled />
                </div>
              </div>
              <p className="text-sm text-muted-foreground mt-2">
                These are the physical capabilities detected for this printer and cannot be modified.
              </p>
            </div>

            {/* Supported Paper Sizes */}
            <div>
              <h4 className="font-medium mb-4">Supported Paper Sizes</h4>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                {["A4", "A3", "Letter", "Legal"].map((size) => (
                  <label
                    key={size}
                    className="flex items-center space-x-2 p-2 border rounded cursor-pointer hover:bg-muted"
                  >
                    <input
                      type="checkbox"
                      checked={printer.capabilities.paperSizes.includes(size)}
                      onChange={(e) => {
                        // Handle paper size toggle
                        const newPaperSizes = e.target.checked
                          ? [...printer.capabilities.paperSizes, size]
                          : printer.capabilities.paperSizes.filter((s) => s !== size)

                        const updatedCapabilities = {
                          ...printer.capabilities,
                          paperSizes: newPaperSizes,
                        }

                        // Update local state
                        setPrinters((prev) =>
                          prev.map((p) => (p.id === printer.id ? { ...p, capabilities: updatedCapabilities } : p)),
                        )
                      }}
                    />
                    <span>{size}</span>
                  </label>
                ))}
              </div>
              <p className="text-sm text-muted-foreground mt-2">
                You can disable paper sizes that are physically supported, but cannot enable unsupported sizes.
              </p>
            </div>

            {/* Job Routing Rules */}
            {printer.capabilities.color && (
              <div>
                <h4 className="font-medium mb-4">Job Routing Rules</h4>
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                    <span>Color Jobs:</span>
                    <select
                      className="border rounded px-2 py-1"
                      value={
                        printer.capabilities.colorJobsOnly
                          ? "colorOnly"
                          : printer.capabilities.monochromeJobsOnly
                            ? "monoOnly"
                            : "both"
                      }
                      onChange={(e) => {
                        const value = e.target.value
                        const updatedCapabilities = {
                          ...printer.capabilities,
                          colorJobsOnly: value === "colorOnly",
                          monochromeJobsOnly: value === "monoOnly",
                        }

                        setPrinters((prev) =>
                          prev.map((p) => (p.id === printer.id ? { ...p, capabilities: updatedCapabilities } : p)),
                        )
                      }}
                    >
                      <option value="both">Allow both color and monochrome jobs</option>
                      <option value="colorOnly">Only accept color jobs</option>
                      <option value="monoOnly">Only accept monochrome jobs</option>
                    </select>
                  </div>
                </div>
              </div>
            )}

            <Button
              onClick={() =>
                saveCapabilities(printer.name, {
                  capabilities: printer.capabilities,
                  paperSizes: printer.capabilities.paperSizes,
                })
              }
            >
              Save Capabilities
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <Tabs defaultValue="capabilities" className="space-y-6">
      <TabsList>
        <TabsTrigger value="capabilities">Capabilities</TabsTrigger>
        <TabsTrigger value="manage">Manage Printers</TabsTrigger>
        <TabsTrigger value="defaults">Default Settings</TabsTrigger>
      </TabsList>

      <TabsContent value="capabilities">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Printer Capabilities</CardTitle>
              <Button variant="outline" onClick={loadPrinterCapabilities} disabled={isLoading}>
                <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? "animate-spin" : ""}`} />
                Refresh
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-sm text-blue-800 flex items-center">
                <FileText className="h-4 w-4 mr-2" />
                Customize which types of print jobs each printer can handle. You can restrict capabilities but cannot
                exceed a printer's physical limits.
              </p>
            </div>

            {isLoading ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                <p className="mt-2 text-muted-foreground">Loading printers...</p>
              </div>
            ) : printers.length === 0 ? (
              <div className="text-center py-12 border-2 border-dashed border-gray-300 rounded-lg">
                <FileText className="h-12 w-12 mx-auto text-gray-400 mb-4" />
                <h3 className="text-lg font-medium mb-2">No Printers Found</h3>
                <p className="text-muted-foreground">
                  Please connect and configure printers before customizing capabilities.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                <h3 className="font-medium">Select a printer to configure</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {printers.map((printer) => (
                    <Card
                      key={printer.id}
                      className="cursor-pointer hover:shadow-md transition-shadow"
                      onClick={() => setSelectedPrinter(printer.id)}
                    >
                      <CardContent className="p-4">
                        <h4 className="font-medium mb-2">{printer.name}</h4>
                        <p className="text-sm text-muted-foreground mb-3">
                          {printer.paperSizes} paper sizes · {printer.sheets} sheets total
                        </p>
                        <div className="flex flex-wrap gap-1">
                          {printer.badges.map((badge) => (
                            <Badge key={badge} variant="secondary" className="text-xs">
                              {badge}
                            </Badge>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="manage">
        <Card>
          <CardHeader>
            <CardTitle>Manage Printers</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <h3 className="font-medium">Active Printers</h3>
              <p className="text-muted-foreground">Printer management interface would go here.</p>
            </div>
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="defaults">
        <Card>
          <CardHeader>
            <CardTitle>Default Settings</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">Default printer settings would go here.</p>
          </CardContent>
        </Card>
      </TabsContent>
    </Tabs>
  )
}
