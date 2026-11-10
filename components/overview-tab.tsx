"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { 
  TrendingUp, 
  TrendingDown, 
  Database, 
  CheckCircle, 
  XCircle, 
  Clock, 
  Activity, 
  Loader2, 
  RefreshCw, 
  AlertTriangle,
  Info,
  ExternalLink,
  Calendar,
  BarChart3,
  Zap,
  Shield,
  Users,
  FileText,
  ArrowUpRight,
  ArrowDownRight
} from "lucide-react"
import { DashboardStats } from "@/components/dashboard-stats"
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
} from "recharts"
import { useOracleData } from "@/lib/oracle-data-context"
import { format, subDays, formatDistanceToNow } from "date-fns"
import { ar, enUS } from "date-fns/locale"
import { usePathname } from 'next/navigation';
import { getLocaleFromPathname } from '@/lib/i18n/utils';
import { useTranslations } from '@/lib/i18n/hooks';
import { toast } from "sonner"

interface LogEntry {
  id: string
  timestamp: string
  level: "info" | "warning" | "error" | "success"
  message: string
  details?: string
  source: string
}

interface SyncStatus {
  timestamp: string | null
  success: boolean | null
  recordsProcessed: number
  duration: string
  message: string
  error?: string
}

interface ActivityStats {
  totalActivities: number
  successCount: number
  errorCount: number
  warningCount: number
  infoCount: number
  lastActivity: string | null
  averageResponseTime: number
}

interface SystemMetrics {
  uptime: string
  totalSyncs: number
  averageSyncTime: number
  dataIntegrity: number
  systemLoad: number
}

export function OverviewTab() {
  const { data, loading, error } = useOracleData()
  const [syncHistory, setSyncHistory] = useState<any[]>([])
  const [recentActivity, setRecentActivity] = useState<LogEntry[]>([])
  const [activityStats, setActivityStats] = useState<ActivityStats>({
    totalActivities: 0,
    successCount: 0,
    errorCount: 0,
    warningCount: 0,
    infoCount: 0,
    lastActivity: null,
    averageResponseTime: 0
  })
  const [systemMetrics, setSystemMetrics] = useState<SystemMetrics>({
    uptime: "0h 0m",
    totalSyncs: 0,
    averageSyncTime: 0,
    dataIntegrity: 100,
    systemLoad: 0
  })
  const [syncStats, setSyncStats] = useState({
    synced: 0,
    failed: 0,
    successRate: 0
  })
  const [isLoading, setIsLoading] = useState(true)
  const [lastSyncStatus, setLastSyncStatus] = useState<SyncStatus | null>(null)
  const [fetchError, setFetchError] = useState<string | null>(null)
  
  // Get locale from pathname for translations
  const pathname = usePathname();
  const locale = getLocaleFromPathname(pathname);
  const t = useTranslations(locale);

  // Fetch sync history from logs with enhanced error handling
  const fetchSyncHistory = async () => {
    try {
      setFetchError(null)
      
      // Get logs from the last 7 days
      const startDate = subDays(new Date(), 7)
      const params = new URLSearchParams({
        startDate: startDate.toISOString(),
        limit: '200'
      })
      
      const response = await fetch(`/api/logs?${params.toString()}`, {
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        },
      })
      
      // Check if response is JSON
      const contentType = response.headers.get('content-type')
      if (!contentType || !contentType.includes('application/json')) {
        throw new Error('Server returned non-JSON response')
      }
      
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.message || `HTTP ${response.status}: Failed to fetch logs`)
      }
      
      const data = await response.json()
      if (!data.success) throw new Error(data.message || 'Failed to fetch logs')

      // Process logs to get sync history
      const syncLogs = data.logs.filter((log: LogEntry) => 
        log.message.toLowerCase().includes('sync') || 
        log.source.toLowerCase().includes('sync') ||
        log.source.toLowerCase().includes('sap')
      )

      // Group by date and count successes/failures
      const historyMap = new Map()
      syncLogs.forEach((log: LogEntry) => {
        const date = format(new Date(log.timestamp), 'MMM d')
        const current = historyMap.get(date) || { date, synced: 0, failed: 0 }
        
        if (log.level === 'success' || log.message.toLowerCase().includes('success')) {
          current.synced++
        } else if (log.level === 'error' || log.message.toLowerCase().includes('fail')) {
          current.failed++
        }
        
        historyMap.set(date, current)
      })

      // Convert map to array and sort by date
      const history = Array.from(historyMap.values())
      history.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())

      // Calculate overall stats
      const totalSynced = history.reduce((sum, day) => sum + day.synced, 0)
      const totalFailed = history.reduce((sum, day) => sum + day.failed, 0)
      const total = totalSynced + totalFailed
      const successRate = total > 0 ? Math.round((totalSynced / total) * 100) : 0

      setSyncHistory(history)
      setSyncStats({
        synced: totalSynced,
        failed: totalFailed,
        successRate
      })

      // Calculate activity statistics
      const activityStats = {
        totalActivities: data.logs.length,
        successCount: data.logs.filter((log: LogEntry) => log.level === 'success').length,
        errorCount: data.logs.filter((log: LogEntry) => log.level === 'error').length,
        warningCount: data.logs.filter((log: LogEntry) => log.level === 'warning').length,
        infoCount: data.logs.filter((log: LogEntry) => log.level === 'info').length,
        lastActivity: data.logs.length > 0 ? data.logs[0].timestamp : null as string | null,
        averageResponseTime: 0
      }
      setActivityStats(activityStats)

      // Calculate system metrics
      const totalSyncs = history.reduce((sum: number, day: any) => sum + day.synced + day.failed, 0)
      const syncTimes = data.logs
        .filter((log: LogEntry) => log.message.toLowerCase().includes('duration') || log.message.toLowerCase().includes('completed'))
        .map((log: LogEntry) => {
          const durationMatch = log.message.match(/(\d+(?:\.\d+)?)s/)
          return durationMatch ? parseFloat(durationMatch[1]) : 0
        })
        .filter((time: number) => time > 0)

      const averageSyncTime = syncTimes.length > 0 
        ? Math.round(syncTimes.reduce((sum: number, time: number) => sum + time, 0) / syncTimes.length * 10) / 10
        : 0

      const errorRate = data.logs.filter((log: LogEntry) => log.level === 'error').length / data.logs.length
      const dataIntegrity = Math.max(0, Math.round((1 - errorRate) * 100))

      const hourlyLogs = data.logs.filter((log: LogEntry) => {
        const logTime = new Date(log.timestamp).getTime()
        const oneHourAgo = Date.now() - (60 * 60 * 1000)
        return logTime > oneHourAgo
      })
      const systemLoad = Math.min(100, Math.round((hourlyLogs.length / 10) * 100))

      const metrics = {
        uptime: "24h 15m",
        totalSyncs,
        averageSyncTime,
        dataIntegrity,
        systemLoad
      }
      setSystemMetrics(metrics)

      // Get recent activity with better filtering
      const recentLogs = data.logs
        .filter((log: LogEntry) => 
          log.source !== 'System' && 
          !log.message.toLowerCase().includes('debug') &&
          !log.message.toLowerCase().includes('initialized') &&
          log.message.length > 10
        )
        .slice(0, 6)
      setRecentActivity(recentLogs)

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred'
      console.error('Error fetching sync history:', error)
      setFetchError(errorMessage)
      toast.error(`Failed to load activity data: ${errorMessage}`)
    }
  }



  // Fetch last sync status
  const fetchLastSyncStatus = async () => {
    try {
      const response = await fetch('/api/cache/status')
      if (!response.ok) throw new Error('Failed to fetch sync status')
      
      const data = await response.json()
      if (!data.success) throw new Error(data.message || 'Failed to fetch sync status')

      setLastSyncStatus(data.lastSyncStatus)
    } catch (error) {
      console.error('Error fetching sync status:', error)
    }
  }

  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true)
      await Promise.all([
        fetchSyncHistory(),
        fetchLastSyncStatus()
      ])
      setIsLoading(false)
    }

    loadData()

    // Refresh every minute
    const interval = setInterval(loadData, 60000)
    return () => clearInterval(interval)
  }, [])

  return (
    <div className={`space-y-8 ${locale === 'ar' ? 'rtl' : 'ltr'}`}>
      {/* Header Section */}
      <div className="space-y-2">
        <h3 className="text-3xl font-bold tracking-tight">{t('overview.title')}</h3>
        <p className="text-muted-foreground text-lg">{t('overview.subtitle')}</p>
      </div>

      {/* Stats Cards */}
      <div className="space-y-4">
        <DashboardStats data={data} isLoading={loading} error={error} />
      </div>

      {/* Charts Section */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-7">
        {/* Sync History Chart */}
        <Card className="col-span-4">
          <CardHeader>
            <CardTitle>{t('overview.syncHistory.title')}</CardTitle>
            <CardDescription>{t('overview.syncHistory.description')}</CardDescription>
          </CardHeader>
          <CardContent className="pl-2">
            {isLoading ? (
              <div className="flex items-center justify-center h-[350px]">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : syncHistory.length > 0 ? (
              <ResponsiveContainer width="100%" height={350}>
                <LineChart data={syncHistory}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip />
                  <Line type="monotone" dataKey="synced" stroke="#22c55e" strokeWidth={2} name={t('overview.systemHealth.synced')} />
                  <Line type="monotone" dataKey="failed" stroke="#ef4444" strokeWidth={2} name={t('overview.systemHealth.failed')} />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex flex-col items-center justify-center h-[350px] text-muted-foreground">
                <Database className="h-8 w-8 mb-2" />
                <p>{t('overview.syncHistory.noData')}</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* System Health */}
        <Card className="col-span-3">
          <CardHeader>
            <CardTitle>{t('overview.systemHealth.title')}</CardTitle>
            <CardDescription>{t('overview.systemHealth.description')}</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center h-[300px]">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <div className="space-y-6">
                <div className="flex items-center justify-center">
                  <div className="relative">
                    <ResponsiveContainer width={200} height={200}>
                      <PieChart>
                        <Pie
                          data={[
                            { name: t('overview.systemHealth.synced'), value: syncStats.synced, color: "#22c55e" },
                            { name: t('overview.systemHealth.failed'), value: syncStats.failed, color: "#ef4444" }
                          ]}
                          cx={100}
                          cy={100}
                          innerRadius={60}
                          outerRadius={80}
                          paddingAngle={5}
                          dataKey="value"
                        >
                          {[
                            { name: t('overview.systemHealth.synced'), color: "#22c55e" },
                            { name: t('overview.systemHealth.failed'), color: "#ef4444" }
                          ].map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="text-center">
                        <div className="text-2xl font-bold">{syncStats.successRate}%</div>
                        <div className="text-xs text-muted-foreground">{t('overview.systemHealth.successRate')}</div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm">{t('overview.systemHealth.successRate')}</span>
                    <Badge
                      variant="secondary"
                      className={
                        syncStats.successRate >= 90
                          ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
                          : syncStats.successRate >= 70
                          ? "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200"
                          : "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200"
                      }
                    >
                      {syncStats.successRate >= 90
                        ? t('overview.systemHealth.excellent')
                        : syncStats.successRate >= 70
                        ? t('overview.systemHealth.good')
                        : t('overview.systemHealth.needsAttention')}
                    </Badge>
                  </div>
                  <Progress value={syncStats.successRate} className="h-2" />

                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                      <span>{t('overview.systemHealth.synced')}: {syncStats.synced}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                      <span>{t('overview.systemHealth.failed')}: {syncStats.failed}</span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Enhanced Recent Activity */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Recent Activity */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Activity className="h-5 w-5" />
                {t('overview.recentActivity.title')}
              </div>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => fetchSyncHistory()}
                disabled={isLoading}
              >
                <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
              </Button>
            </CardTitle>
            <CardDescription>{t('overview.recentActivity.description')}</CardDescription>
          </CardHeader>
          <CardContent>
            {fetchError && (
              <Alert className="mb-4">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>{fetchError}</AlertDescription>
              </Alert>
            )}
            
            {isLoading ? (
              <div className="space-y-4">
                {[1, 2, 3, 4, 5, 6].map((i) => (
                  <div key={i} className="flex items-center gap-3 animate-pulse">
                    <div className="w-2 h-2 bg-gray-200 rounded-full" />
                    <div className="flex-1 space-y-2">
                      <div className="h-4 bg-gray-200 rounded w-3/4" />
                      <div className="h-3 bg-gray-200 rounded w-1/4" />
                    </div>
                    <div className="h-6 bg-gray-200 rounded w-20" />
                  </div>
                ))}
              </div>
            ) : recentActivity.length > 0 ? (
              <div className="space-y-3">
                {recentActivity.map((activity, index) => (
                  <div key={activity.id} className="flex items-start justify-between py-3 border-b last:border-b-0 hover:bg-muted/50 rounded-lg px-2 transition-colors">
                    <div className="flex items-start gap-3 flex-1 min-w-0">
                      <div
                        className={`w-2 h-2 rounded-full mt-2 flex-shrink-0 ${
                          activity.level === "success"
                            ? "bg-green-500"
                            : activity.level === "error"
                            ? "bg-red-500"
                            : activity.level === "warning"
                            ? "bg-yellow-500"
                            : "bg-blue-500"
                        }`}
                      />
                      <div className="flex-1 min-w-0 overflow-hidden">
                        <p className="text-sm font-medium leading-tight mb-1 break-words overflow-hidden text-ellipsis">{activity.message}</p>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
                          <Clock className="h-3 w-3 flex-shrink-0" />
                          <span className="whitespace-nowrap">
                            {formatDistanceToNow(new Date(activity.timestamp), { 
                              addSuffix: true,
                              locale: locale === 'ar' ? ar : enUS
                            })}
                          </span>
                          <span className="hidden sm:inline">•</span>
                          <span className="whitespace-nowrap">{format(new Date(activity.timestamp), 'MMM d, h:mm a')}</span>
                        </div>
                        {activity.details && (
                          <details className="mt-2">
                            <summary className="text-xs text-muted-foreground cursor-pointer hover:text-foreground">
                              {t('overview.recentActivity.viewDetails')}
                            </summary>
                            <pre className="text-xs bg-muted p-2 rounded mt-1 overflow-x-auto whitespace-pre-wrap break-words">
                              {activity.details}
                            </pre>
                          </details>
                        )}
                      </div>
                    </div>
                    <Badge variant="outline" className="flex-shrink-0 ml-2 text-xs">
                      {activity.source}
                    </Badge>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-32 text-muted-foreground">
                <Database className="h-8 w-8 mb-2" />
                <p>{t('overview.recentActivity.noData')}</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Activity Statistics */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              {t('overview.recentActivity.activityStats')}
            </CardTitle>
            <CardDescription>{t('overview.recentActivity.activityStatsDescription')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Activity Summary */}
            <div className="grid grid-cols-2 gap-4">
              <div className="text-center p-3 bg-green-50 dark:bg-green-950/20 rounded-lg">
                <div className="text-2xl font-bold text-green-600">{activityStats.successCount}</div>
                <div className="text-xs text-muted-foreground">{t('overview.recentActivity.success')}</div>
              </div>
              <div className="text-center p-3 bg-red-50 dark:bg-red-950/20 rounded-lg">
                <div className="text-2xl font-bold text-red-600">{activityStats.errorCount}</div>
                <div className="text-xs text-muted-foreground">{t('overview.recentActivity.errors')}</div>
              </div>
              <div className="text-center p-3 bg-yellow-50 dark:bg-yellow-950/20 rounded-lg">
                <div className="text-2xl font-bold text-yellow-600">{activityStats.warningCount}</div>
                <div className="text-xs text-muted-foreground">{t('overview.recentActivity.warnings')}</div>
              </div>
              <div className="text-center p-3 bg-blue-50 dark:bg-blue-950/20 rounded-lg">
                <div className="text-2xl font-bold text-blue-600">{activityStats.infoCount}</div>
                <div className="text-xs text-muted-foreground">{t('overview.recentActivity.info')}</div>
              </div>
            </div>

            {/* System Metrics */}
            <div className="space-y-3">
              <h4 className="font-medium text-sm">{t('overview.recentActivity.systemMetrics')}</h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{t('overview.recentActivity.totalActivities')}:</span>
                  <span className="font-medium">{activityStats.totalActivities}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{t('overview.recentActivity.systemUptime')}:</span>
                  <span className="font-medium">{systemMetrics.uptime}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{t('overview.recentActivity.totalSyncs')}:</span>
                  <span className="font-medium">{systemMetrics.totalSyncs}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{t('overview.recentActivity.avgSyncTime')}:</span>
                  <span className="font-medium">{systemMetrics.averageSyncTime}s</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{t('overview.recentActivity.dataIntegrity')}:</span>
                  <span className="font-medium">{systemMetrics.dataIntegrity}%</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{t('overview.recentActivity.systemLoad')}:</span>
                  <span className="font-medium">{systemMetrics.systemLoad}%</span>
                </div>
              </div>
            </div>

            {/* Last Activity */}
            {activityStats.lastActivity && (
              <div className="pt-3 border-t">
                <div className="flex items-center gap-2 text-sm">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <span className="text-muted-foreground">{t('overview.recentActivity.lastActivity')}:</span>
                  <span className="font-medium">
                    {formatDistanceToNow(new Date(activityStats.lastActivity), { 
                      addSuffix: true,
                      locale: locale === 'ar' ? ar : enUS
                    })}
                  </span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
