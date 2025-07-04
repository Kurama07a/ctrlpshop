"use client"

import { useState, useEffect } from "react"
import { AuthView } from "../components/auth/auth-view"
import { Dashboard } from "../components/dashboard/dashboard"
import { NotificationProvider } from "../components/notifications/notification-provider"
import { ThemeProvider } from "../components/theme-provider"
import { ElectronProvider, useElectron } from "../components/electron/electron-provider"

// Electron IPC types
declare global {
  interface Window {
    electronAPI?: {
      ipcRenderer: {
        send: (channel: string, ...args: any[]) => void
        invoke: (channel: string, ...args: any[]) => Promise<any>
        on: (channel: string, listener: (...args: any[]) => void) => void
        removeAllListeners: (channel: string) => void
      }
    }
  }
}

function AppContent() {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  interface User {
    email: string;
    shop_name: string;
    kyc_verified: boolean;
    shopInfo?: any;
  }
  const [currentUser, setCurrentUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const { isElectron, on, removeAllListeners, invoke, send } = useElectron()

  useEffect(() => {
    if (isElectron) {
      // Set up comprehensive IPC listeners for authentication
      const handleAuthSuccess = (_event: any, user: any) => {
        setCurrentUser(user)
        setIsAuthenticated(true)
        setIsLoading(false)
      }

      const handleAuthError = (_event: any, message: string) => {
        console.error("Auth error:", message)
        setIsLoading(false)
        setIsAuthenticated(false)
        setCurrentUser(null)
      }

      const handleSessionCheckComplete = () => {
        setIsLoading(false)
      }

      const handleSignOutSuccess = () => {
        setCurrentUser(null)
        setIsAuthenticated(false)
      }

      const handleClearAuthError = () => {
        // Clear any authentication related errors
        console.log("Auth error cleared")
      }

      const handleKycRequired = () => {
        console.log("KYC required for user")
        // Could show KYC reminder or redirect to settings
      }

      const handleKycVerified = () => {
        console.log("KYC verified for user")
        // Could show success message or update UI
      }

// In your handleShopInfoFetched function in page.tsx
const handleShopInfoFetched = (_event: any, shopInfo: any) => {
  console.log("APP PAGE: Shop info fetched:", shopInfo)
  // Only update if shopInfo is valid data (not undefined or an error object)
  if (shopInfo && !shopInfo.error && currentUser) {
    console.log("APP PAGE: Updating current user with shop info")
    setCurrentUser({ ...currentUser, shopInfo })
  } else if (shopInfo?.error) {
    console.error("Shop info fetch error:", shopInfo.error)
  }
}

      const handleUpdateAvailable = () => {
        console.log("Update available")
      }

      const handleUpdateDownloaded = () => {
        console.log("Update downloaded")
      }

      const handleUpdateError = (_event: any, error: string) => {
        console.error("Update error:", error)
      }

      const handleLogMessage = (_event: any, message: string) => {
        console.log("[Main Process]", message)
      }

      // Set up all IPC listeners
      on("auth-success", handleAuthSuccess)
      on("auth-error", handleAuthError)
      on("session-check-complete", handleSessionCheckComplete)
      on("sign-out-success", handleSignOutSuccess)
      on("clear-auth-error", handleClearAuthError)
      on("kyc-required", handleKycRequired)
      on("kyc-verified", handleKycVerified)
      on("shop-info-fetched", handleShopInfoFetched)
      on("update-available", handleUpdateAvailable)
      on("update-downloaded", handleUpdateDownloaded)
      on("update-error", handleUpdateError)
      on("log-message", handleLogMessage)

      // Check for existing session
      invoke("check-session-status")
        .then(({ hasSession, user }) => {
          if (hasSession && user) {
            setCurrentUser(user)
            setIsAuthenticated(true)
          }
          setIsLoading(false)
        })
        .catch(() => {
          setIsLoading(false)
        })

      // Cleanup listeners on unmount
      return () => {
        removeAllListeners("auth-success")
        removeAllListeners("auth-error")
        removeAllListeners("session-check-complete")
        removeAllListeners("sign-out-success")
        removeAllListeners("clear-auth-error")
        removeAllListeners("kyc-required")
        removeAllListeners("kyc-verified")
        removeAllListeners("shop-info-fetched")
        removeAllListeners("update-available")
        removeAllListeners("update-downloaded")
        removeAllListeners("update-error")
        removeAllListeners("log-message")
      }
    } else {
      // Fallback for web version
      setTimeout(() => setIsLoading(false), 2000)
    }
  }, [isElectron, currentUser])

  const handleLogin = async (email: string, password: string) => {
    if (isElectron) {
      // Use Electron IPC
      send("login", { email, password })
    } else {
      // Fallback for web version
      await new Promise((resolve) => setTimeout(resolve, 1500))
      const user = { email, shop_name: "Demo Shop", kyc_verified: false }
      setCurrentUser(user)
      setIsAuthenticated(true)
    }
  }

  const handleLogout = () => {
    if (isElectron) {
      send("sign-out")
    } else {
      setCurrentUser(null)
      setIsAuthenticated(false)
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  return (
    <>
      {!isAuthenticated ? <AuthView onLogin={handleLogin} /> : <Dashboard user={currentUser} onLogout={handleLogout} />}
    </>
  )
}

export default function Home() {
  return (
    <ThemeProvider>
      <ElectronProvider>
        <NotificationProvider>
          <AppContent />
        </NotificationProvider>
      </ElectronProvider>
    </ThemeProvider>
  )
}
