"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "../../ui/card"
import { Button } from "../../ui/button"
import { Input } from "../../ui/input"
import { Badge } from "../../ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../ui/table"
import { useElectron } from "../../electron/electron-provider"
import { useNotifications } from "../../notifications/notification-provider"

export function TransactionView() {
  const [filteredJobs, setFilteredJobs] = useState<any[]>([])
  const [startDate, setStartDate] = useState("")
  const [endDate, setEndDate] = useState("")
  const { jobHistory, isElectron, on, removeAllListeners } = useElectron()

  useEffect(() => {
    // Set default date range (yesterday to today)
    const today = new Date()
    const yesterday = new Date(today)
    yesterday.setDate(yesterday.getDate() - 1)

    const formatDate = (date: Date) => {
      return date.toISOString().split("T")[0]
    }

    setStartDate(formatDate(yesterday))
    setEndDate(formatDate(today))

    // Apply initial filter
    filterTransactions(formatDate(yesterday), formatDate(today))
  }, [jobHistory])

  useEffect(() => {
    if (isElectron) {
      // Listen for job history updates
      const handleJobHistoryUpdated = () => {
        // Re-apply current filter when history updates
        filterTransactions(startDate, endDate)
      }

      on("job-history-updated", handleJobHistoryUpdated)

      return () => {
        removeAllListeners("job-history-updated")
      }
    }
  }, [isElectron, startDate, endDate])

  const filterTransactions = (start?: string, end?: string) => {
    const startDateValue = start || startDate
    const endDateValue = end || endDate

    // Ensure jobHistory is an array
    if (!Array.isArray(jobHistory)) {
      console.warn("jobHistory is not an array:", jobHistory)
      setFilteredJobs([])
      return
    }


    if (!startDateValue || !endDateValue) {
      setFilteredJobs(jobHistory)
      return
    }

    const startDateTime = new Date(startDateValue)
    const endDateTime = new Date(endDateValue)
    endDateTime.setHours(23, 59, 59, 999)

    const filtered = jobHistory.filter((job) => {
      // Ensure job has required properties
      if (!job || !job.processed_timestamp) {
        console.warn("Invalid job object:", job)
        return false
      }
      console.log("Filtering job:", job)

      const jobDate = new Date(job.processed_timestamp)
      return jobDate >= startDateTime && jobDate <= endDateTime
    })

    setFilteredJobs(filtered)
  }

  const handleFilter = () => {
    filterTransactions()
  }

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case "completed":
        return "default"
      case "failed":
        return "destructive"
      case "in-progress":
        return "secondary"
      default:
        return "outline"
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Transaction History</CardTitle>
        </CardHeader>
        <CardContent>
          {/* Date Filter */}
          <div className="flex items-center space-x-4 mb-6">
            <div className="flex items-center space-x-2">
              <label htmlFor="start-date" className="text-sm font-medium">
                Start Date:
              </label>
              <Input
                id="start-date"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-auto"
              />
            </div>
            <div className="flex items-center space-x-2">
              <label htmlFor="end-date" className="text-sm font-medium">
                End Date:
              </label>
              <Input
                id="end-date"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-auto"
              />
            </div>
            <Button onClick={handleFilter}>Filter</Button>
          </div>

          {/* Transaction Table */}
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Customer</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>File</TableHead>
                  <TableHead>Printer</TableHead>
                  <TableHead>Pages</TableHead>
                  <TableHead>Color</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredJobs.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                      No transactions found for the selected date range.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredJobs.map((job) => (
                    <TableRow key={job.id}>
                      <TableCell className="font-medium">{job.user_name}</TableCell>
                      <TableCell>{Number(job.amount).toFixed(2)}</TableCell>
                      <TableCell>{job.file_path || job.file_name || "N/A"}</TableCell>
                      <TableCell>{job.assigned_printer || "N/A"}</TableCell>
                      <TableCell>{job.total_pages || job.number_of_pages * job.copies || "N/A"}</TableCell>
                      <TableCell>
                        <Badge variant={job.color_mode === "color" ? "default" : "secondary"}>{job.color_mode}</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={getStatusBadgeVariant(job.print_status)}>{job.print_status}</Badge>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
