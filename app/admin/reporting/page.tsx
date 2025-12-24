"use client"

import { useState, useEffect } from "react"
import axios from "axios"
import AdminLayout from "@/components/AdminLayout"

interface ReportData {
  taskCompletion: {
    total: number
    completed: number
    inProgress: number
    pending: number
    completionRate: number
  }
  cleanerPerformance: Array<{
    cleanerId: number
    name: string
    tasksCompleted: number
    averageScore: number
    onTimeRate: number
  }>
  issueStats: {
    total: number
    open: number
    resolved: number
    highSeverity: number
  }
  billingSummary: {
    totalRevenue: number
    activeSubscriptions: number
    failedPayments: number
  }
  dateRange: {
    start: string
    end: string
  }
}

export default function ReportingPage() {
  const [reportData, setReportData] = useState<ReportData | null>(null)
  const [loading, setLoading] = useState(true)
  const [dateRange, setDateRange] = useState({
    start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
    end: new Date().toISOString().split("T")[0],
  })
  const [exportFormat, setExportFormat] = useState<"csv" | "pdf">("csv")

  useEffect(() => {
    loadReports()
  }, [dateRange])

  const loadReports = async () => {
    try {
      setLoading(true)
      const token = localStorage.getItem("authToken") || sessionStorage.getItem("authToken")
      const selectedCompanyId = localStorage.getItem("selectedCompanyId")
      
      const params: any = { startDate: dateRange.start, endDate: dateRange.end }
      if (selectedCompanyId) {
        params.companyId = selectedCompanyId
      }
      
      const response = await axios.get("/api/admin/reporting", {
        headers: { Authorization: `Bearer ${token}` },
        params,
      })

      if (response.data.success) {
        const data = response.data.data
        setReportData({
          taskCompletion: data.taskCompletion,
          cleanerPerformance: data.cleanerPerformance,
          issueStats: data.issueStats,
          billingSummary: data.billingSummary,
          dateRange: data.dateRange,
        })
      }
    } catch (error) {
      console.error("Error loading reports:", error)
    } finally {
      setLoading(false)
    }
  }

  const handleExport = async () => {
    try {
      const token = localStorage.getItem("authToken") || sessionStorage.getItem("authToken")
      const response = await axios.get("/api/analytics/export", {
        headers: { Authorization: `Bearer ${token}` },
        params: {
          format: exportFormat,
          startDate: dateRange.start,
          endDate: dateRange.end,
        },
        responseType: "blob",
      })

      const url = window.URL.createObjectURL(new Blob([response.data]))
      const link = document.createElement("a")
      link.href = url
      link.setAttribute("download", `mayaops-report-${dateRange.start}-${dateRange.end}.${exportFormat}`)
      document.body.appendChild(link)
      link.click()
      link.remove()
    } catch (error) {
      console.error("Error exporting report:", error)
      alert("Failed to export report")
    }
  }

  if (loading || !reportData) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center min-h-screen">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-cyan-500"></div>
        </div>
      </AdminLayout>
    )
  }

  return (
    <AdminLayout>
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Reporting & Analytics</h1>
              <p className="text-gray-600 mt-1">Comprehensive reports and performance metrics</p>
            </div>
            <div className="flex items-center gap-3">
              <select
                value={exportFormat}
                onChange={(e) => setExportFormat(e.target.value as "csv" | "pdf")}
                className="px-4 py-2 border border-gray-300 rounded-lg"
              >
                <option value="csv">CSV</option>
                <option value="pdf">PDF</option>
              </select>
              <button
                onClick={handleExport}
                className="px-4 py-2 bg-gradient-to-r from-cyan-500 to-teal-600 text-white rounded-lg hover:from-cyan-600 hover:to-teal-700 transition"
              >
                Export Report
              </button>
            </div>
          </div>
        </div>

        {/* Date Range Filter */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Start Date</label>
              <input
                type="date"
                value={dateRange.start}
                onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">End Date</label>
              <input
                type="date"
                value={dateRange.end}
                onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500"
              />
            </div>
          </div>
        </div>

        {/* Task Completion Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
          <StatCard
            label="Total Tasks"
            value={reportData.taskCompletion.total}
            icon="📋"
            color="bg-blue-50"
          />
          <StatCard
            label="Completed"
            value={reportData.taskCompletion.completed}
            icon="✅"
            color="bg-green-50"
          />
          <StatCard
            label="In Progress"
            value={reportData.taskCompletion.inProgress}
            icon="⚙️"
            color="bg-yellow-50"
          />
          <StatCard
            label="Completion Rate"
            value={`${reportData.taskCompletion.completionRate}%`}
            icon="📊"
            color="bg-purple-50"
          />
        </div>

        {/* Performance Metrics */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          {/* Cleaner Performance */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Top Performers</h2>
            <div className="space-y-3">
              {reportData.cleanerPerformance.length > 0 ? (
                reportData.cleanerPerformance.slice(0, 10).map((performer, index) => (
                  <div
                    key={performer.cleanerId}
                    className="flex items-center justify-between p-3 border border-gray-200 rounded-lg"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-cyan-500 to-teal-600 text-white flex items-center justify-center font-bold text-sm">
                        {index + 1}
                      </div>
                      <div>
                        <p className="font-semibold text-gray-900">{performer.name}</p>
                        <p className="text-sm text-gray-500">
                          Avg Score: {performer.averageScore.toFixed(1)} | On-Time:{" "}
                          {performer.onTimeRate.toFixed(0)}%
                        </p>
                      </div>
                    </div>
                    <p className="text-sm font-semibold text-cyan-600">
                      {performer.tasksCompleted} tasks
                    </p>
                  </div>
                ))
              ) : (
                <p className="text-gray-500 text-center py-4">No performance data available</p>
              )}
            </div>
          </div>

          {/* Issue Statistics */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Issue Statistics</h2>
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                <span className="text-gray-700">Total Issues</span>
                <span className="text-2xl font-bold text-gray-900">{reportData.issueStats.total}</span>
              </div>
              <div className="flex items-center justify-between p-4 bg-yellow-50 rounded-lg">
                <span className="text-gray-700">Open Issues</span>
                <span className="text-2xl font-bold text-yellow-600">{reportData.issueStats.open}</span>
              </div>
              <div className="flex items-center justify-between p-4 bg-green-50 rounded-lg">
                <span className="text-gray-700">Resolved</span>
                <span className="text-2xl font-bold text-green-600">
                  {reportData.issueStats.resolved}
                </span>
              </div>
              <div className="flex items-center justify-between p-4 bg-red-50 rounded-lg">
                <span className="text-gray-700">High Severity</span>
                <span className="text-2xl font-bold text-red-600">
                  {reportData.issueStats.highSeverity}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Billing Summary */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">Billing Summary</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 bg-gradient-to-br from-cyan-50 to-teal-50 rounded-lg">
              <p className="text-sm text-gray-600 mb-1">Total Revenue</p>
              <p className="text-2xl font-bold text-gray-900">
                £{reportData.billingSummary.totalRevenue.toLocaleString()}
              </p>
            </div>
            <div className="p-4 bg-blue-50 rounded-lg">
              <p className="text-sm text-gray-600 mb-1">Active Subscriptions</p>
              <p className="text-2xl font-bold text-gray-900">
                {reportData.billingSummary.activeSubscriptions}
              </p>
            </div>
            <div className="p-4 bg-red-50 rounded-lg">
              <p className="text-sm text-gray-600 mb-1">Failed Payments</p>
              <p className="text-2xl font-bold text-red-600">
                {reportData.billingSummary.failedPayments}
              </p>
            </div>
          </div>
        </div>
      </div>
    </AdminLayout>
  )
}

function StatCard({ label, value, icon, color }: { label: string; value: string | number; icon: string; color: string }) {
  return (
    <div className={`${color} rounded-lg p-6 shadow-sm border border-gray-100`}>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-gray-600 text-sm font-medium">{label}</p>
          <p className="text-3xl font-bold text-gray-900 mt-2">{value}</p>
        </div>
        <div className="text-4xl">{icon}</div>
      </div>
    </div>
  )
}



