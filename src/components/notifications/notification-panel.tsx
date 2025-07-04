"use client"

import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card"
import { Badge } from "../../components/ui/badge"
import { useNotifications } from "./notification-provider"
import { formatDistanceToNow } from "date-fns"

export function NotificationPanel() {
  const { notifications } = useNotifications()

  const recentNotifications = notifications.slice(0, 3)

  return (
    <Card className="bg-card border-border">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm text-foreground">Recent Notifications</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {recentNotifications.length === 0 ? (
          <p className="text-xs text-muted-foreground">No recent notifications</p>
        ) : (
          recentNotifications.map((notification) => (
            <div key={notification.id} className="text-xs space-y-1">
              <div className="flex items-center space-x-2">
                <Badge variant={notification.type === "error" ? "destructive" : "secondary"} className="text-xs">
                  {notification.type}
                </Badge>
                <span className="text-muted-foreground">
                  {formatDistanceToNow(notification.timestamp, { addSuffix: true })}
                </span>
              </div>
              <p className="text-foreground">{notification.message}</p>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  )
}
