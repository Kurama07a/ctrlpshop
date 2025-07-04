"use client"

import { Card, CardContent, CardHeader, CardTitle } from "../../ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../ui/table"
import { BarChart3 } from "lucide-react"

export function StatisticsView() {
  const earningsData = [
    { date: "2025-05-22", totalPages: 15, monochromeJobs: 2, colorJobs: 0, totalIncome: 24.0 },
    { date: "2025-05-23", totalPages: 5, monochromeJobs: 3, colorJobs: 0, totalIncome: 9.8 },
    { date: "2025-05-24", totalPages: 1, monochromeJobs: 1, colorJobs: 0, totalIncome: 2.2 },
  ]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center space-x-2">
        <BarChart3 className="h-6 w-6 text-blue-600" />
        <h1 className="text-2xl font-bold">Printing Statistics</h1>
      </div>

      {/* Earnings Table */}
      <Card>
        <CardHeader>
          <CardTitle>Total Earnings by Day</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="border rounded-lg">
            <Table>
              <TableHeader>
                <TableRow className="bg-blue-600 hover:bg-blue-600">
                  <TableHead className="text-white">Date</TableHead>
                  <TableHead className="text-white">Total Pages</TableHead>
                  <TableHead className="text-white">Monochrome Jobs</TableHead>
                  <TableHead className="text-white">Color Jobs</TableHead>
                  <TableHead className="text-white">Total Income</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {earningsData.map((row) => (
                  <TableRow key={row.date}>
                    <TableCell>{row.date}</TableCell>
                    <TableCell>{row.totalPages}</TableCell>
                    <TableCell>{row.monochromeJobs}</TableCell>
                    <TableCell>{row.colorJobs}</TableCell>
                    <TableCell>₹{row.totalIncome.toFixed(2)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-center">Jobs per Day</CardTitle>
          </CardHeader>
          <CardContent className="flex items-center justify-center h-64">
            <div className="text-center text-muted-foreground">
              <BarChart3 className="h-12 w-12 mx-auto mb-2" />
              <p>Chart visualization would go here</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-center">Job Type Distribution</CardTitle>
          </CardHeader>
          <CardContent className="flex items-center justify-center h-64">
            <div className="text-center text-muted-foreground">
              <BarChart3 className="h-12 w-12 mx-auto mb-2" />
              <p>Pie chart would go here</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-center">Paper Size Distribution</CardTitle>
          </CardHeader>
          <CardContent className="flex items-center justify-center h-64">
            <div className="text-center text-muted-foreground">
              <BarChart3 className="h-12 w-12 mx-auto mb-2" />
              <p>Bar chart would go here</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-center">Printer Usage Distribution</CardTitle>
          </CardHeader>
          <CardContent className="flex items-center justify-center h-64">
            <div className="text-center text-muted-foreground">
              <BarChart3 className="h-12 w-12 mx-auto mb-2" />
              <p>Doughnut chart would go here</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-center">Color vs Monochrome Jobs</CardTitle>
          </CardHeader>
          <CardContent className="flex items-center justify-center h-64">
            <div className="text-center text-muted-foreground">
              <BarChart3 className="h-12 w-12 mx-auto mb-2" />
              <p>Pie chart would go here</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-center">Daily Pages Printed</CardTitle>
          </CardHeader>
          <CardContent className="flex items-center justify-center h-64">
            <div className="text-center text-muted-foreground">
              <BarChart3 className="h-12 w-12 mx-auto mb-2" />
              <p>Bar chart would go here</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Print Volume Analysis</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex justify-between">
              <span>Total Pages Printed:</span>
              <span className="font-bold">21</span>
            </div>
            <div className="flex justify-between">
              <span>Average Pages per Job:</span>
              <span className="font-bold">3.50</span>
            </div>
            <div className="flex justify-between">
              <span>Max Pages in a Job:</span>
              <span className="font-bold">3</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Efficiency Metrics</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex justify-between">
              <span>Total Jobs:</span>
              <span className="font-bold">6</span>
            </div>
            <div className="flex justify-between">
              <span>Completed Jobs:</span>
              <span className="font-bold">4</span>
            </div>
            <div className="flex justify-between">
              <span>Failed Jobs:</span>
              <span className="font-bold">2</span>
            </div>
            <div className="flex justify-between">
              <span>Success Rate:</span>
              <span className="font-bold">66.67%</span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
