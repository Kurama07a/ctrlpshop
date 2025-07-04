"use client"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../../ui/tabs"
import { Settings, User, Printer, CreditCard, Bell, HelpCircle } from "lucide-react"
import { AccountSettings } from "../../settings/account-settings"
import { PrinterSettings } from "../../settings/printer-settings"
import { KycSettings } from "../../settings/kyc-settings"
import { NotificationSettings } from "../../settings/notification-settings"
import { HelpSupport } from "../../settings/help-support"

interface SettingsViewProps {
  user: any
}

export function SettingsView({ user }: SettingsViewProps) {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center space-x-2">
        <Settings className="h-6 w-6 text-blue-600" />
        <h1 className="text-2xl font-bold">Settings</h1>
      </div>

      {/* Settings Tabs */}
      <Tabs defaultValue="account" className="space-y-6">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="account" className="flex items-center space-x-2">
            <User className="h-4 w-4" />
            <span>Account</span>
          </TabsTrigger>
          <TabsTrigger value="printers" className="flex items-center space-x-2">
            <Printer className="h-4 w-4" />
            <span>Printers</span>
          </TabsTrigger>
          <TabsTrigger value="notifications" className="flex items-center space-x-2">
            <Bell className="h-4 w-4" />
            <span>Notifications</span>
          </TabsTrigger>
          <TabsTrigger value="help" className="flex items-center space-x-2">
            <HelpCircle className="h-4 w-4" />
            <span>Help & Support</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="account">
          <AccountSettings user={user} />
        </TabsContent>

        <TabsContent value="printers">
          <PrinterSettings />
        </TabsContent>

        <TabsContent value="notifications">
          <NotificationSettings />
        </TabsContent>

        <TabsContent value="help">
          <HelpSupport />
        </TabsContent>
      </Tabs>
    </div>
  )
}
