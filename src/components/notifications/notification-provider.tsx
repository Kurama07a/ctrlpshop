"use client"

import { createContext, useContext, useState, type ReactNode } from "react"
import { NotificationToast } from "./notification-toast"

interface Notification {
  id: string
  message: string
  type: "success" | "error" | "warning" | "info"
  timestamp: Date
}

interface NotificationContextType {
  notifications: Notification[]
  addNotification: (message: string, type: Notification["type"]) => void
  removeNotification: (id: string) => void
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined)

export function NotificationProvider({ children }: { children: ReactNode }) {
  const [notifications, setNotifications] = useState<Notification[]>([])

  const addNotification = (message: string, type: Notification["type"]) => {
    const id = Math.random().toString(36).substr(2, 9)
    const notification: Notification = {
      id,
      message,
      type,
      timestamp: new Date(),
    }

    setNotifications((prev) => [notification, ...prev])

    // Auto-remove after 5 seconds for non-error notifications
    if (type !== "error") {
      setTimeout(() => {
        removeNotification(id)
      }, 5000)
    }
  }

  const removeNotification = (id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id))
  }

  return (
    <NotificationContext.Provider value={{ notifications, addNotification, removeNotification }}>
      {children}
      <div className="fixed top-4 right-4 z-50 space-y-2">
        {notifications.slice(0, 5).map((notification) => (
          <NotificationToast key={notification.id} notification={notification} onRemove={removeNotification} />
        ))}
      </div>
    </NotificationContext.Provider>
  )
}

export function useNotifications() {
  const context = useContext(NotificationContext)
  if (context === undefined) {
    throw new Error("useNotifications must be used within a NotificationProvider")
  }
  return context
}
