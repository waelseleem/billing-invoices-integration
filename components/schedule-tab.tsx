"use client"

import { useState, useEffect } from "react"
import { toast } from "sonner"
import { useOracleData } from "@/lib/oracle-data-context"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Clock, Play, Pause, Settings, Calendar, AlertCircle, RefreshCw, Send } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { usePathname } from 'next/navigation';
import { getLocaleFromPathname } from '@/lib/i18n/utils';
import { useTranslations } from '@/lib/i18n/hooks';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

export function ScheduleTab() {
  const [isEnabled, setIsEnabled] = useState(true)
  const [cronExpression, setCronExpression] = useState("0 */6 * * *")
  const [timezone, setTimezone] = useState("UTC")
  const [retryAttempts, setRetryAttempts] = useState("3")
  const [retryDelay, setRetryDelay] = useState("5")
  const [isSyncing, setIsSyncing] = useState(false)
  const [showConfirmDialog, setShowConfirmDialog] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [nextRunTime, setNextRunTime] = useState<string | null>(null)
  const [lastSyncStatus, setLastSyncStatus] = useState<any>(null)
  const { data: oracleData, fetchData: refreshOracleData } = useOracleData()
  
  // Get locale from pathname for translations
  const pathname = usePathname();
  const locale = getLocaleFromPathname(pathname);
  const t = useTranslations(locale);

  // Load saved schedule configuration on component mount
  useEffect(() => {
    fetchScheduleStatus();
    
    // Set up interval to refresh status
    const interval = setInterval(() => {
      fetchScheduleStatus();
    }, 60000); // Refresh every minute
    
    return () => clearInterval(interval);
  }, []);

  // Fetch schedule status from server
  const fetchScheduleStatus = async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      const response = await fetch('/api/cache/status');
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to fetch schedule status');
      }
      
      const data = await response.json();
      
      if (!data.success) {
        throw new Error(data.message || 'Failed to fetch schedule status');
      }
      
      // Update state with server data
      if (data.scheduleConfig) {
        setIsEnabled(data.scheduleConfig.isEnabled ?? true);
        setCronExpression(data.scheduleConfig.cronExpression ?? "0 */6 * * *");
        setTimezone(data.scheduleConfig.timezone ?? "UTC");
        setRetryAttempts(data.scheduleConfig.retryAttempts ?? "3");
        setRetryDelay(data.scheduleConfig.retryDelay ?? "5");
      }
      
      // Update next run time
      setNextRunTime(data.nextRunTime);
      
      // Update last sync status
      setLastSyncStatus(data.lastSyncStatus);
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
      setError(errorMessage);
      console.error("Failed to load schedule configuration:", error);
      toast.error(`Failed to load schedule configuration: ${errorMessage}`);
    } finally {
      setIsLoading(false);
    }
  };

  // Save schedule configuration to server
  const saveScheduleConfiguration = async () => {
    try {
      const config = {
        isEnabled,
        cronExpression,
        timezone,
        retryAttempts,
        retryDelay
      };
      
      const response = await fetch('/api/cache/sync', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          type: 'schedule-config',
          config
        }),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to save schedule configuration');
      }
      
      const data = await response.json();
      
      if (!data.success) {
        throw new Error(data.message || 'Failed to save schedule configuration');
      }
      
      toast.success("Schedule configuration saved successfully");
      
      // Refresh status to get updated next run time
      fetchScheduleStatus();
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
      console.error("Failed to save schedule configuration:", error);
      toast.error(`Failed to save schedule configuration: ${errorMessage}`);
    }
  };

  // Just performs the SAP sync API call
  const executeSync = async () => {
    const startTime = Date.now();
    try {
      // Get data directly from localStorage
      const storedData = localStorage.getItem('oracle_billing_data');
      if (!storedData) {
        throw new Error('No data found in localStorage');
      }

      // Parse the data
      const parsedData = JSON.parse(storedData);
      if (!Array.isArray(parsedData) || parsedData.length === 0) {
        throw new Error('Invalid or empty data in localStorage');
      }

      toast.info(`Starting SAP B1 journal entry sync with ${parsedData.length} records...`);

      // Create a payload with the raw data
      const payload = {
        billingData: parsedData
      };

      // Log the payload size
      const payloadString = JSON.stringify(payload);
      console.log(`Schedule sync payload size: ${payloadString.length} bytes`);
      console.log('First record:', parsedData[0]);

      // Send the request
      const response = await fetch("/api/sap/sync", {
        method: "POST",
        headers: {
          'Content-Type': 'application/json',
        },
        body: payloadString,
      });
      
      const result = await response.json();
      if (!response.ok) {
        if (response.status === 409 && result.isDuplicate) {
          // Handle duplicate case - show warning but don't treat as error
          toast.warning('Journal entry already exists in SAP', {
            description: result.message
          });
          return; // Don't throw error for duplicates
        }
        throw new Error(result.message || t('schedule.messages.syncFailedNoMessage'));
      }
      
      // Calculate duration
      const endTime = Date.now();
      const durationMs = endTime - startTime;
      const durationSec = (durationMs / 1000).toFixed(1);
      
      // Save sync status to server
      const syncStatus = {
        timestamp: new Date().toISOString(),
        success: true,
        recordsProcessed: parsedData.length,
        duration: `${durationSec}s`,
        docEntry: result.docEntries?.[0] || null,
        journalNumber: result.journalNumbers?.[0] || null,
        message: result.message || t('schedule.messages.syncCompleted')
      };
      
      await saveSyncStatus(syncStatus);
      
      toast.success(result.message || t('schedule.messages.manualSyncCompleted'), {
        description: result.docEntries?.[0] ? 
          `Document Entry: ${result.docEntries[0]}${result.journalNumbers?.[0] ? `, Journal Number: ${result.journalNumbers[0]}` : ''}` : 
          undefined,
      });
    } catch (error) {
      // Save failed status to server
      const errorMessage = error instanceof Error ? error.message : t('common.error');
      const endTime = Date.now();
      const durationMs = endTime - startTime;
      const durationSec = (durationMs / 1000).toFixed(1);
      
      const syncStatus = {
        timestamp: new Date().toISOString(),
        success: false,
        recordsProcessed: 0,
        duration: `${durationSec}s`,
        error: errorMessage
      };
      
      await saveSyncStatus(syncStatus);
      
      throw new Error(`${t('schedule.messages.syncProcessFailed')}: ${errorMessage}`);
    }
  }

  // Save sync status to server
  const saveSyncStatus = async (status: any) => {
    try {
      const response = await fetch('/api/cache/sync', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          type: 'sync-status',
          status
        }),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        console.error('Failed to save sync status:', errorData);
      }
    } catch (error) {
      console.error('Error saving sync status:', error);
    }
  };
  
  // The main function that orchestrates the sync process
  const runSyncProcess = async (shouldReload: boolean) => {
    setShowConfirmDialog(false)
    setIsSyncing(true)
    try {
      if (shouldReload) {
        await refreshOracleData(true)
      }
      await executeSync()
      // Refresh status after sync
      await fetchScheduleStatus()
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : t('common.error')
      toast.error(`${t('schedule.messages.syncProcessFailed')}: ${errorMessage}`)
    } finally {
      setIsSyncing(false)
    }
  }

  // This function is called when the main button is clicked
  const handleRunSyncClick = () => {
    if (oracleData && oracleData.length > 0) {
      setShowConfirmDialog(true)
    } else {
      // If there's no data, just reload and sync
      runSyncProcess(true)
    }
  }

  const schedulePresets = [
    { label: "Every 15 minutes", value: "*/15 * * * *" },
    { label: "Every hour", value: "0 * * * *" },
    { label: "Every 6 hours", value: "0 */6 * * *" },
    { label: "Daily at midnight", value: "0 0 * * *" },
    { label: "Daily at 9 AM", value: "0 9 * * *" },
    { label: "Weekly (Sunday)", value: "0 0 * * 0" },
  ]

  const getNextRunTime = () => {
    if (isLoading) return t('common.loading');
    if (error) return t('common.error');
          if (!isEnabled) return t('schedule.status.scheduleDisabled');
      if (!nextRunTime) return t('schedule.status.notScheduled');
    
    try {
      return new Date(nextRunTime).toLocaleString();
    } catch (error) {
      console.error("Error formatting next run time:", error);
      return "Invalid date";
    }
  }

  const getLastRunStatus = () => {
    if (isLoading) {
      return {
        time: t('common.loading'),
        status: "pending",
        recordsProcessed: 0,
        duration: "0s",
      };
    }
    
    if (error) {
      return {
        time: t('common.error'),
        status: "error",
        recordsProcessed: 0,
        duration: "0s",
      };
    }
    
    if (!lastSyncStatus || !lastSyncStatus.timestamp) {
      return {
        time: "Never",
        status: "pending",
        recordsProcessed: 0,
        duration: "0s",
      };
    }
    
    return {
      time: new Date(lastSyncStatus.timestamp).toLocaleString(),
      status: lastSyncStatus.success ? "success" : "failed",
      recordsProcessed: lastSyncStatus.recordsProcessed || 0,
      duration: lastSyncStatus.duration || "0s",
    };
  }

  const lastRun = getLastRunStatus()

  return (
    <>
      <div className={`space-y-6 ${locale === 'ar' ? 'rtl' : 'ltr'}`}>
        {/* Header Section */}
        <div className="space-y-2">
          <h3 className="text-3xl font-bold tracking-tight">{t('schedule.title')}</h3>
          <p className="text-muted-foreground text-lg">{t('schedule.subtitle')}</p>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          {/* Schedule Configuration */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5" />
                {t('schedule.syncSchedule.title')}
              </CardTitle>
              <CardDescription>{t('schedule.syncSchedule.description')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label className="text-base">{t('schedule.syncSchedule.enable')}</Label>
                  <div className="text-sm text-muted-foreground">{t('schedule.syncSchedule.enableDescription')}</div>
                </div>
                <Switch checked={isEnabled} onCheckedChange={setIsEnabled} />
              </div>

              <div className="space-y-2">
                <Label htmlFor="preset">{t('schedule.syncSchedule.quickPresets')}</Label>
                <Select onValueChange={setCronExpression}>
                  <SelectTrigger>
                    <SelectValue placeholder={t('schedule.syncSchedule.choosePreset')} />
                  </SelectTrigger>
                  <SelectContent>
                    {schedulePresets.map((preset) => (
                      <SelectItem key={preset.value} value={preset.value}>
                        {preset.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="cron">{t('schedule.syncSchedule.cronExpression')}</Label>
                <Input
                  id="cron"
                  value={cronExpression}
                  onChange={(e) => setCronExpression(e.target.value)}
                  placeholder="0 */6 * * *"
                  className="font-mono"
                />
                <div className="text-xs text-muted-foreground">{t('schedule.syncSchedule.cronFormat')}</div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="timezone">{t('schedule.syncSchedule.timezone')}</Label>
                <Select value={timezone} onValueChange={setTimezone}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="UTC">UTC</SelectItem>
                    <SelectItem value="America/New_York">Eastern Time</SelectItem>
                    <SelectItem value="America/Chicago">Central Time</SelectItem>
                    <SelectItem value="America/Denver">Mountain Time</SelectItem>
                    <SelectItem value="America/Los_Angeles">Pacific Time</SelectItem>
                    <SelectItem value="Europe/London">London</SelectItem>
                    <SelectItem value="Europe/Paris">Paris</SelectItem>
                    <SelectItem value="Asia/Tokyo">Tokyo</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex gap-2">
                <Button 
                  className="flex-1" 
                  disabled={!isEnabled || isLoading}
                  onClick={saveScheduleConfiguration}
                >
                  {isLoading ? (
                    <>
                      <Clock className="h-4 w-4 mr-2 animate-spin" />
                      {t('common.saving')}
                    </>
                  ) : (
                    <>
                      <Play className="h-4 w-4 mr-2" />
                      {t('schedule.actions.saveConfig')}
                    </>
                  )}
                </Button>
                <Button 
                  variant="outline" 
                  disabled={!isEnabled || isSyncing || isLoading}
                  onClick={async () => {
                    setIsSyncing(true);
                    try {
                      await executeSync();
                      // Refresh status after sync
                      await fetchScheduleStatus();
                    } catch (error) {
                      const errorMessage = error instanceof Error ? error.message : "An unknown error occurred.";
                      toast.error(errorMessage);
                    } finally {
                      setIsSyncing(false);
                    }
                  }}
                >
                  {isSyncing ? (
                    <>
                      <Clock className="mr-2 h-4 w-4 animate-spin" />
                      {t('schedule.status.testing')}
                    </>
                  ) : (
                    <>
                      <RefreshCw className="mr-2 h-4 w-4" />
                      {t('schedule.actions.test')}
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Status and Next Run */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                {t('schedule.status.title')}
              </CardTitle>
              <CardDescription>{t('schedule.status.description')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">{t('schedule.status.currentStatus')}</span>
                  <Badge
                    className={
                      isEnabled
                        ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
                        : "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200"
                    }
                  >
                    {isEnabled ? t('schedule.status.active') : t('schedule.status.disabled')}
                  </Badge>
                </div>

                <div className="space-y-2">
                  <span className="text-sm font-medium">{t('schedule.status.nextRun')}</span>
                  <div className="text-sm text-muted-foreground">
                    {isEnabled ? getNextRunTime() : t('schedule.status.scheduleDisabled')}
                  </div>
                </div>

                <div className="space-y-2">
                  <span className="text-sm font-medium">{t('schedule.status.lastRun')}</span>
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-sm">
                      <span>{lastRun.time}</span>
                      <Badge className={
                        lastRun.status === "success" 
                          ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
                          : lastRun.status === "failed"
                          ? "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200"
                          : "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200"
                      }>
                        {lastRun.status === "success" ? t('schedule.status.success') : 
                         lastRun.status === "failed" ? t('schedule.status.failed') : 
                         lastRun.status === "pending" ? t('schedule.status.pending') : t('schedule.status.unknown')}
                      </Badge>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {lastRun.status !== "pending" 
                        ? `${t('schedule.status.processedRecords')} ${lastRun.recordsProcessed} ${t('schedule.status.records')} ${t('schedule.status.in')} ${lastRun.duration}`
                        : t('schedule.status.noSyncYet')}
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <span className="text-sm font-medium">{t('schedule.status.scheduleExpression')}</span>
                  <div className="text-sm font-mono bg-muted p-2 rounded">{cronExpression}</div>
                  <div className="text-xs text-muted-foreground">{t('schedule.status.runsEvery6Hours')}</div>
                </div>
              </div>

              {!isEnabled && (
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    {t('schedule.status.disabledMessage')}
                  </AlertDescription>
                </Alert>
              )}

              <div className="pt-2">
                <Button 
                  size="sm" 
                  variant="outline" 
                  className="w-full"
                  disabled={isLoading || isSyncing}
                  onClick={async () => {
                    try {
                      toast.info("Triggering scheduled task...");
                      const response = await fetch('/api/cache/clear', {
                        method: 'POST',
                      });
                      
                      if (!response.ok) {
                        const errorData = await response.json();
                        throw new Error(errorData.message || 'Failed to trigger scheduled task');
                      }
                      
                      const data = await response.json();
                      
                      if (!data.success) {
                        throw new Error(data.message || 'Failed to trigger scheduled task');
                      }
                      
                      toast.success("Scheduled task triggered successfully");
                      
                      // Refresh status after triggering task
                      await fetchScheduleStatus();
                    } catch (error) {
                      const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
                      toast.error(`Failed to trigger scheduled task: ${errorMessage}`);
                    }
                  }}
                >
                  <Clock className="h-4 w-4 mr-2" />
                  {t('schedule.actions.triggerScheduledTask')}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Retry Configuration */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="h-5 w-5" />
                {t('schedule.retryPolicy.title')}
              </CardTitle>
              <CardDescription>{t('schedule.retryPolicy.description')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="retryAttempts">{t('schedule.retryPolicy.retryAttempts')}</Label>
                <Input
                  id="retryAttempts"
                  type="number"
                  value={retryAttempts}
                  onChange={(e) => setRetryAttempts(e.target.value)}
                  min="0"
                  max="10"
                />
                <div className="text-xs text-muted-foreground">{t('schedule.retryPolicy.retryAttemptsDesc')}</div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="retryDelay">{t('schedule.retryPolicy.retryDelay')}</Label>
                <Input
                  id="retryDelay"
                  type="number"
                  value={retryDelay}
                  onChange={(e) => setRetryDelay(e.target.value)}
                  min="1"
                  max="60"
                />
                <div className="text-xs text-muted-foreground">{t('schedule.retryPolicy.retryDelayDesc')}</div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="notifications">{t('schedule.retryPolicy.notificationSettings')}</Label>
                <Textarea
                  id="notifications"
                  placeholder={t('schedule.retryPolicy.notificationPlaceholder')}
                  className="min-h-[80px]"
                />
              </div>

              <Button className="w-full">{t('schedule.retryPolicy.updateRetrySettings')}</Button>
            </CardContent>
          </Card>

          {/* Manual Controls */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Play className="h-5 w-5" />
                {t('schedule.manualControls.title')}
              </CardTitle>
              <CardDescription>
                {t('schedule.manualControls.description')}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label className="font-semibold">{t('schedule.manualControls.triggerManualSync')}</Label>
                <p className="text-sm text-muted-foreground">
                  {t('schedule.manualControls.triggerDescription')}
                </p>
              </div>
              <Button
                className="w-full"
                onClick={handleRunSyncClick}
                disabled={isSyncing || isLoading}
              >
                {isSyncing ? (
                  <>
                    <Clock className="mr-2 h-4 w-4 animate-spin" />
                    {t('schedule.status.syncing')}
                  </>
                ) : (
                  <>
                    <Send className="mr-2 h-4 w-4" />
                    {t('schedule.actions.runSync')}
                  </>
                )}
              </Button>
            </CardContent>
          </Card>

          {/* Sync History */}
          <Card className="md:col-span-2">
            {/* Sync history content */}
          </Card>
        </div>
      </div>

      <Dialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{t('schedule.confirm.title')}</DialogTitle>
            <DialogDescription>
              {t('schedule.confirm.description')}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              onClick={() => runSyncProcess(false)}
              disabled={isSyncing}
            >
              <Send className="mr-2 h-4 w-4" /> {t('schedule.confirm.syncWithCurrentData')}
            </Button>
            <Button
              variant="outline"
              onClick={() => runSyncProcess(true)}
              disabled={isSyncing}
            >
              <RefreshCw className="mr-2 h-4 w-4" /> {t('schedule.confirm.reloadAndSync')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
