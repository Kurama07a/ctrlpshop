"use client"

import { useEffect, useState } from "react"

export function PrinterAnimation() {
  const [isPrinting, setIsPrinting] = useState(false)

  useEffect(() => {
    const interval = setInterval(() => {
      setIsPrinting(true)
      setTimeout(() => setIsPrinting(false), 3000)
    }, 6000)

    return () => clearInterval(interval)
  }, [])

  return (
    <div className="relative w-48 h-32 mx-auto">
      {/* Printer body */}
      <div className="w-full h-20 bg-blue-700 rounded-lg shadow-lg relative overflow-hidden">
        {/* Printer top */}
        <div className="absolute -top-3 left-0 w-full h-3 bg-blue-800 rounded-t-lg"></div>

        {/* Paper slot */}
        <div className="absolute top-3 left-1/2 transform -translate-x-1/2 w-3/4 h-1.5 bg-black/30 rounded-sm"></div>

        {/* Highlight */}
        <div className="absolute top-0 left-0 w-full h-6 bg-white/10 rounded-t-lg"></div>

        {/* Paper */}
        <div
          className={`absolute -top-8 left-1/2 transform -translate-x-1/2 w-16 bg-white rounded-t transition-all duration-1000 ${
            isPrinting ? "h-20" : "h-0"
          }`}
        >
          {/* Paper content lines */}
          <div className="p-2 space-y-1">
            <div className="h-0.5 bg-gray-300 rounded w-3/4"></div>
            <div className="h-0.5 bg-gray-300 rounded w-full"></div>
            <div className="h-0.5 bg-gray-300 rounded w-2/3"></div>
            <div className="h-0.5 bg-gray-300 rounded w-full"></div>
          </div>
        </div>
      </div>
    </div>
  )
}
