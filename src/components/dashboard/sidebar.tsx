"use client"

import { Button } from "../../components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "../../components/ui/avatar"
import { Home, ArrowLeftRight, BarChart3, RefreshCw, Settings, Printer, Moon, Sun } from "lucide-react"
import type { ViewType } from "./dashboard"
import { NotificationPanel } from "../../components/notifications/notification-panel"
import { useTheme } from "next-themes"

interface SidebarProps {
  currentView: ViewType
  onViewChange: (view: ViewType) => void
  user: any
  onLogout: () => void
}

const navigationItems = [
  { id: "printer" as ViewType, label: "Dashboard", icon: Home },
  { id: "transaction" as ViewType, label: "Transaction", icon: ArrowLeftRight },
  { id: "statistics" as ViewType, label: "Statistics", icon: BarChart3 },
  { id: "settings" as ViewType, label: "Settings", icon: Settings },
]

export function Sidebar({ currentView, onViewChange, user, onLogout }: SidebarProps) {
  const { theme, setTheme } = useTheme()

  return (
    <div className="w-80 bg-card border-r border-border flex flex-col">
      {/* Logo */}
      <div className="p-6 border-b border-border">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-sm">C+</span>
            </div>
            <span className="text-xl font-bold text-foreground">CTRL+P</span>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            className="h-8 w-8 text-muted-foreground hover:text-foreground"
          >
            {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </Button>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4 space-y-2">
        {navigationItems.map((item) => {
          const Icon = item.icon
          return (
            <Button
              key={item.id}
              variant={currentView === item.id ? "default" : "ghost"}
              className={`w-full justify-start ${
                currentView === item.id
                  ? "bg-blue-600 text-white hover:bg-blue-700"
                  : "text-foreground hover:bg-accent hover:text-accent-foreground"
              }`}
              onClick={() => onViewChange(item.id)}
            >
              <Icon className="mr-3 h-4 w-4" />
              {item.label}
            </Button>
          )
        })}

        <Button
          variant="ghost"
          className="w-full justify-start text-foreground hover:bg-accent hover:text-accent-foreground"
        >
          <RefreshCw className="mr-3 h-4 w-4" />
          Check for Updates
        </Button>
      </nav>

      {/* Notifications */}
      <div className="p-4">
        <NotificationPanel />
      </div>

      {/* User info */}
      <div className="p-4 border-t border-border">
        <div className="flex items-center space-x-3 mb-4">
          <Avatar>
            <AvatarImage src="/placeholder.svg" />
            <AvatarFallback className="bg-blue-100 text-blue-600">
              <Printer className="h-4 w-4" />
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-foreground truncate">{user?.shop_name || "User Name"}</p>
            <p className="text-xs text-muted-foreground truncate">{user?.email || "user@example.com"}</p>
          </div>
        </div>

        <Button
          variant="outline"
          size="sm"
          className="w-full border-border text-foreground hover:bg-accent"
          onClick={onLogout}
        >
          Sign Out
        </Button>

        <div className="mt-4 text-xs text-center text-muted-foreground">Product Developed by CTRL P</div>
      </div>
    </div>
  )
}
