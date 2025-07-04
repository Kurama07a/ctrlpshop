"use client"

import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card"
import { Button } from "../../components/ui/button"
import { Input } from "../../components/ui/input"
import { Label } from "../../components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../../components/ui/tabs"
import { useElectron } from "../electron/electron-provider"
import { useEffect, useState } from "react"
import { useShopInfo } from "../../hooks/useShopInfo"

interface AccountSettingsProps {
  user: any
}

export function AccountSettings({ user }: AccountSettingsProps) {
  const { currentUser} = useElectron()
  const  { shopInfo, loading, error} = useShopInfo(user?.email || currentUser?.email)

  
  return (
    <Tabs defaultValue="profile" className="space-y-6">
      <TabsList>
        <TabsTrigger value="profile">Profile</TabsTrigger>
        <TabsTrigger value="security">Security</TabsTrigger>
      </TabsList>

      <TabsContent value="profile">
        <Card>
          <CardHeader>
            <CardTitle>Shop Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
             
              <div className="flex justify-center p-4">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              </div>

              <>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label>Shop Name</Label>
                    <div className="p-3 bg-muted rounded-md">
                      {shopInfo?.shop_name || user?.shop_name || "Not Provided"}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Owner Name</Label>
                    <div className="p-3 bg-muted rounded-md">
                      {shopInfo?.owner_name || "Not Provided"}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Contact Number</Label>
                    <div className="p-3 bg-muted rounded-md">
                      {shopInfo?.contact_number || "Not Provided"}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Email Address</Label>
                    <div className="p-3 bg-muted rounded-md">
                      {shopInfo?.email || user?.email || "Not Provided"}
                    </div>
                  </div>

                  <div className="space-y-2 md:col-span-2">
                    <Label>Shop Address</Label>
                    <div className="p-3 bg-muted rounded-md">
                      {shopInfo?.address || "Not Provided"}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>GST Number</Label>
                    <div className="p-3 bg-muted rounded-md">
                      {shopInfo?.gst_number || "Not Provided"}
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <Label>KYC Status</Label>
                    <div className="p-3 bg-muted rounded-md">
                      {shopInfo?.kyc_status || "Not Verified"}
                    </div>
                  </div>
                </div>

                <div className="flex space-x-4">
                  <Button onClick={() => {
                    console.log("Edit shop details clicked")
                    // Add your edit functionality here
                  }}>Edit Shop Details</Button>
                </div>
              </>
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="security">
        {/* Security tab content */}
      </TabsContent>
    </Tabs>
  )
}