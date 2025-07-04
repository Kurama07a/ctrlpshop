"use client"

import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card"
import { Button } from "../../components/ui/button"
import { Badge } from "../../components/ui/badge"
import { Clock, CheckCircle, Eye, Edit } from "lucide-react"

interface KycSettingsProps {
  user: any
}

type KycStatus = "pending" | "verified" | "not_started";

export function KycSettings({ user }: KycSettingsProps) {
  const kycStatus = "pending" as KycStatus // This would come from user data

  const getStatusIcon = () => {
    switch (kycStatus) {
      case "verified":
        return <CheckCircle className="h-5 w-5 text-green-600" />
      case "pending":
        return <Clock className="h-5 w-5 text-yellow-600" />
      default:
        return <Clock className="h-5 w-5 text-gray-400" />
    }
  }

  const getStatusBadge = () => {
    switch (kycStatus) {
      case "verified":
        return <Badge className="bg-green-100 text-green-800">Verified</Badge>
      case "pending":
        return <Badge className="bg-yellow-100 text-yellow-800">Pending Verification</Badge>
      default:
        return <Badge variant="secondary">Not Started</Badge>
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>KYC Verification Status</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Status Indicator */}
        <div className="flex items-center space-x-3 p-4 bg-muted rounded-lg">
          {getStatusIcon()}
          <div className="flex-1">
            <div className="flex items-center space-x-2">
              <span className="font-medium">Verification Status</span>
              {getStatusBadge()}
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              {kycStatus === "pending"
                ? "Your KYC documents are currently under review. This typically takes 1-3 business days."
                : kycStatus === "verified"
                  ? "Your KYC has been successfully verified."
                  : "Please complete your KYC verification to access all features."}
            </p>
          </div>
        </div>

        {/* Timeline */}
        <div className="space-y-4">
          <h4 className="font-medium">Verification Timeline</h4>
          <div className="space-y-4">
            <div className="flex items-start space-x-3">
              <div className="w-4 h-4 bg-blue-600 rounded-full mt-1"></div>
              <div>
                <h5 className="font-medium">Documents Submitted</h5>
                <p className="text-sm text-muted-foreground">May 15, 2023 - 10:30 AM</p>
              </div>
            </div>

            <div className="flex items-start space-x-3">
              <div className="w-4 h-4 bg-blue-600 rounded-full mt-1"></div>
              <div>
                <h5 className="font-medium">Verification In Progress</h5>
                <p className="text-sm text-muted-foreground">Our team is reviewing your documents</p>
              </div>
            </div>

            <div className="flex items-start space-x-3">
              <div className="w-4 h-4 bg-gray-300 rounded-full mt-1"></div>
              <div>
                <h5 className="font-medium text-muted-foreground">Verification Complete</h5>
                <p className="text-sm text-muted-foreground">Once verified, your account will be fully activated</p>
              </div>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex space-x-4">
          <Button variant="outline">
            <Eye className="h-4 w-4 mr-2" />
            View Submitted Documents
          </Button>
          <Button>
            <Edit className="h-4 w-4 mr-2" />
            Update KYC Information
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
