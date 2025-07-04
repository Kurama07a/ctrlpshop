"use client"

import { useState } from "react"
import { Sidebar } from "./sidebar"
import { Header } from "./header"
import { PrinterView } from "./views/printer-view"
import { TransactionView } from "./views/transaction-view"
import { StatisticsView } from "./views/statistics-view"
import { SettingsView } from "./views/settings-view"

interface DashboardProps {
  user: any
  onLogout: () => void
}

export type ViewType = "printer" | "transaction" | "statistics" | "settings"

export function Dashboard({ user, onLogout }: DashboardProps) {
  const [currentView, setCurrentView] = useState<ViewType>("printer")
  const [isOnline, setIsOnline] = useState(false)

  const renderView = () => {
    switch (currentView) {
      case "printer":
        return <PrinterView />
      case "transaction":
        return <TransactionView />
      case "statistics":
        return <StatisticsView />
      case "settings":
        return <SettingsView user={user} />
      default:
        return <PrinterView />
    }
  }

  return (
    <div className="flex h-screen bg-background">
      <Sidebar currentView={currentView} onViewChange={setCurrentView} user={user} onLogout={onLogout} />

      <div className="flex-1 flex flex-col overflow-hidden">
        {currentView === "printer" && <Header isOnline={isOnline} onToggleOnline={setIsOnline} />}

        <main className="flex-1 overflow-auto p-6 bg-background">{renderView()}</main>
      </div>
    </div>
  )
}
