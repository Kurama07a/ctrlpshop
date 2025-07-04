"use client"

import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card"
import { Button } from "../../components/ui/button"
import { Textarea } from "../../components/ui/textarea"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../../components/ui/tabs"
import { Badge } from "../../components/ui/badge"
import { Printer, Activity, BarChart3, MessageSquare } from "lucide-react"
import { useNotifications } from "../../components/notifications/notification-provider"

export function HelpSupport() {
  const { addNotification } = useNotifications()

  const handleSendSupport = () => {
    // Simulate opening WhatsApp
    addNotification("Opening WhatsApp...", "success")
  }

  return (
    <Tabs defaultValue="guide" className="space-y-6">
      <TabsList className="bg-muted">
        <TabsTrigger value="guide" className="data-[state=active]:bg-background">
          User Guide
        </TabsTrigger>
        <TabsTrigger value="support" className="data-[state=active]:bg-background">
          Get Support
        </TabsTrigger>
      </TabsList>

      <TabsContent value="guide">
        <div className="space-y-6">
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="flex items-center space-x-2 text-foreground">
                <Printer className="h-5 w-5 text-blue-600" />
                <span>Managing Printers</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h4 className="font-medium mb-2 text-foreground">How to Discard a Printer</h4>
                <ol className="list-decimal list-inside space-y-1 text-sm text-muted-foreground">
                  <li>Go to the Dashboard view</li>
                  <li>Locate the printer you want to discard</li>
                  <li>Click the "Discard" button in the top-right corner of the printer card</li>
                  <li>The printer will be moved to the "Discarded Printers" section</li>
                </ol>
                <p className="text-sm text-blue-600 mt-2">
                  Note: You can restore discarded printers at any time from the "Discarded Printers" section.
                </p>
              </div>

              <div>
                <h4 className="font-medium mb-2 text-foreground">Adding Paper to Printers</h4>
                <ol className="list-decimal list-inside space-y-1 text-sm text-muted-foreground">
                  <li>Find the printer you want to add paper to</li>
                  <li>Locate the paper size section (e.g., A4, A3)</li>
                  <li>Click either "+100" or "+500" to add that amount of pages</li>
                </ol>
                <p className="text-sm text-blue-600 mt-2">
                  Tip: Keep track of paper levels to ensure uninterrupted printing.
                </p>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="flex items-center space-x-2 text-foreground">
                <Activity className="h-5 w-5 text-blue-600" />
                <span>Print Jobs</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h4 className="font-medium mb-2 text-foreground">Job Status Indicators</h4>
                <div className="space-y-2">
                  <div className="flex items-center space-x-2">
                    <Badge variant="secondary">Pending</Badge>
                    <span className="text-sm text-muted-foreground">Job is waiting to be processed</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Badge className="bg-blue-100 text-blue-800">Printing</Badge>
                    <span className="text-sm text-muted-foreground">Job is currently printing</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Badge>Completed</Badge>
                    <span className="text-sm text-muted-foreground">Job finished successfully</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Badge variant="destructive">Failed</Badge>
                    <span className="text-sm text-muted-foreground">Job encountered an error</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="flex items-center space-x-2 text-foreground">
                <BarChart3 className="h-5 w-5 text-blue-600" />
                <span>Statistics & Reports</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-1 text-sm text-muted-foreground">
                <li>• View daily metrics on the dashboard</li>
                <li>• Access detailed statistics in the Statistics tab</li>
                <li>• Track earnings and performance over time</li>
                <li>• Monitor printer usage and efficiency</li>
              </ul>
            </CardContent>
          </Card>
        </div>
      </TabsContent>

      <TabsContent value="support">
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="text-foreground">Need Help?</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-muted-foreground">
              Having issues with the application? Our support team is here to help!
            </p>

            <div className="space-y-4">
              <Textarea
                placeholder="Describe your issue here..."
                rows={4}
                className="bg-background text-foreground border-border"
              />
              <Button onClick={handleSendSupport} className="w-full bg-green-600 hover:bg-green-700 text-white">
                <MessageSquare className="h-4 w-4 mr-2" />
                Contact Support via WhatsApp
              </Button>
            </div>
          </CardContent>
        </Card>
      </TabsContent>
    </Tabs>
  )
}
