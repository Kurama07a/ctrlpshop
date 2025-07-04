"use client"

import { Switch } from "../../components/ui/switch"
import { Button } from "../../components/ui/button"
import { Eye, EyeOff } from "lucide-react"
import { useState, useEffect } from "react"
import { useElectron } from "../../components/electron/electron-provider"
import { useNotifications } from "../../components/notifications/notification-provider"
import { tr } from "date-fns/locale"

interface HeaderProps {
  isOnline: boolean
  onToggleOnline: (online: boolean) => void
}

export function Header({ isOnline, onToggleOnline }: HeaderProps) {
  const { isConnected, setIsConnected, send } = useElectron()
  const { addNotification } = useNotifications()
  const [isToggling, setIsToggling] = useState(false)

  const handleToggleWebSocket = (checked: boolean) => {
    setIsConnected(checked)
    send("toggle-websocket", checked)
    onToggleOnline(checked)
     // Update local state immediately for UI feedback
    setTimeout(() => setIsToggling(false), 1000)
    //addNotification(checked ? "WebSocket connected" : "WebSocket disconnected", checked ? "success" : "info")
  }

  return (
    <header className="flex items-center justify-between p-6 bg-background border-b">
      <h1 className="text-2xl font-bold">Dashboard</h1>

      <div className="flex items-center space-x-4">
        <div className="flex items-center space-x-2">
          <Switch checked={isConnected} onCheckedChange={handleToggleWebSocket} id="websocket-toggle" />
          <span className={`text-sm font-medium ${isConnected ? "text-green-600" : "text-gray-500"}`}>
            {isConnected ? "ONLINE" : "OFFLINE"}
          </span>
        </div>
      </div>
    </header>
  )
}
