"use client"

import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card"
import { Button } from "../../components/ui/button"
import { Switch } from "../../components/ui/switch"
import { Label } from "../../components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../../components/ui/tabs"

export function NotificationSettings() {
  return (
    <Tabs defaultValue="email" className="space-y-6">
      <TabsList>
        <TabsTrigger value="email">Email Notifications</TabsTrigger>
        <TabsTrigger value="app">App Notifications</TabsTrigger>
      </TabsList>

      <TabsContent value="email">
        <Card>
          <CardHeader>
            <CardTitle>Email Notification Preferences</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>New Print Jobs</Label>
                  <p className="text-sm text-muted-foreground">
                    Receive email notifications when new print jobs are received
                  </p>
                </div>
                <Switch defaultChecked />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Completed Jobs</Label>
                  <p className="text-sm text-muted-foreground">Receive email notifications when jobs are completed</p>
                </div>
                <Switch defaultChecked />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Failed Jobs</Label>
                  <p className="text-sm text-muted-foreground">Receive email notifications when jobs fail</p>
                </div>
                <Switch />
              </div>
            </div>

            <Button>Save Email Preferences</Button>
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="app">
        <Card>
          <CardHeader>
            <CardTitle>App Notification Preferences</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Sound Alerts</Label>
                  <p className="text-sm text-muted-foreground">Play sound when new print jobs arrive</p>
                </div>
                <Switch defaultChecked />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Browser Notifications</Label>
                  <p className="text-sm text-muted-foreground">Show desktop notifications for important alerts</p>
                </div>
                <Switch />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>In-App Notifications</Label>
                  <p className="text-sm text-muted-foreground">Show notifications within the app interface</p>
                </div>
                <Switch defaultChecked />
              </div>
            </div>

            <Button>Save App Preferences</Button>
          </CardContent>
        </Card>
      </TabsContent>
    </Tabs>
  )
}
