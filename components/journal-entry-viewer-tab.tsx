"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Loader2, RefreshCw, FileText, Calculator, Send, CheckCircle, XCircle, Database, AlertTriangle } from "lucide-react"
import { useTranslations } from "@/lib/i18n/hooks"
import { usePathname } from "next/navigation"
import { toast } from "sonner"
import { useOracleData } from "@/lib/oracle-data-context"

interface JournalLine {
  AccountCode?: string;
  ShortName?: string;
  Credit: number;
  Debit: number;
  CostingCode3?: string;
  CostingCode2?: string;
  LineMemo?: string;
  U_B1JE004?: string;
}

interface JournalEntry {
  ReferenceDate: string;
  Memo: string;
  Reference: string;
  JournalEntryLines: JournalLine[];
}

interface BranchJournalEntryItem {
  branch: string;
  journalEntry: JournalEntry;
  totals: any;
  recordCount: number;
}

interface JournalEntryData {
  success: boolean;
  message: string;
  journalEntries?: BranchJournalEntryItem[];
  summary?: {
    totalBranches: number;
    totalRecords: number;
    successfulBranches: number;
  };
  oracleDataCount?: number;
  timestamp?: string;
}

export function JournalEntryViewerTab() {
  const [journalEntryData, setJournalEntryData] = useState<JournalEntryData | null>(null)
  const [syncing, setSyncing] = useState(false)
  const [syncStatus, setSyncStatus] = useState<{
    success?: boolean;
    message?: string;
    docEntry?: any;
    journalNumber?: any;
    timestamp?: string;
    isDuplicate?: boolean;
    existingJournalEntry?: any;
  } | null>(null)
  
  const [queriedJournalEntry, setQueriedJournalEntry] = useState<any>(null)
  const [queryingJE, setQueryingJE] = useState(false)
  
  const pathname = usePathname()
  const locale = pathname.startsWith('/ar') ? 'ar' : 'en'
  const t = useTranslations(locale)
  const isRTL = locale === 'ar'
  
  // Use Oracle data from context (localStorage)
  const { data: oracleData, loading, error, fetchData } = useOracleData()

  // Generate journal entry data from Oracle data in localStorage
  const generateJournalEntryData = async () => {
               if (!oracleData || oracleData.length === 0) {
             toast.error(t('journalEntryViewer.messages.noOracleData'))
             return
           }

    try {
      // Call the API to generate journal entry from Oracle data
      const response = await fetch('/api/journal-entries/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          oracleData,
          locale
        }),
      })

      const result = await response.json()
      
      if (result.success) {
        setJournalEntryData(result)
      } else {
        toast.error(result.message || t('journalEntryViewer.messages.failedToGenerateJournalEntry'))
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : t('journalEntryViewer.messages.unknownError')
      toast.error(`${t('journalEntryViewer.messages.errorGeneratingJournalEntry')} ${errorMessage}`)
    }
  }

  const syncToSAP = async () => {
    if (!journalEntryData?.journalEntries || journalEntryData.journalEntries.length === 0) {
      toast.error(t('journalEntryViewer.messages.noJournalEntry'))
      return
    }

    // Basic validation: ensure each branch JE is balanced
    const allBalanced = journalEntryData.journalEntries.every(item => {
      const totalCredits = item.journalEntry.JournalEntryLines.reduce((sum: number, line: any) => sum + line.Credit, 0)
      const totalDebits = item.journalEntry.JournalEntryLines.reduce((sum: number, line: any) => sum + line.Debit, 0)
      return Math.abs(totalCredits - totalDebits) < 0.01
    })

    if (!allBalanced) {
      toast.error(t('journalEntryViewer.messages.notBalanced'))
      return
    }

    setSyncing(true)
    setSyncStatus(null)
    setQueriedJournalEntry(null)
    
    try {
      // Send to SAP sync endpoint using Oracle data from localStorage (service will handle per-branch posting)
      const syncResponse = await fetch('/api/sap/sync', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          billingData: oracleData
        }),
      })

      const syncResult = await syncResponse.json()
      
      if (syncResult.success) {
        const syncStatusData = {
          success: true,
          message: syncResult.message,
          docEntry: syncResult.docEntries?.[0],
          journalNumber: syncResult.journalNumbers?.[0],
          timestamp: new Date().toISOString()
        }
        
        setSyncStatus(syncStatusData)
        toast.success(t('journalEntryViewer.messages.syncSuccess'))
        
          // Optionally query latest JE; for multiple branches we skip auto-query
      } else if (syncResult.isDuplicate) {
        // Handle duplicate journal entry case
        const syncStatusData = {
          success: false,
          message: syncResult.message,
          docEntry: syncResult.docEntries?.[0],
          journalNumber: syncResult.journalNumbers?.[0],
          timestamp: new Date().toISOString(),
          isDuplicate: true,
          existingJournalEntry: syncResult.existingJournalEntry
        }
        
        setSyncStatus(syncStatusData)
        toast.warning(t('journalEntryViewer.messages.duplicateEntry'))
        
        // Set the existing journal entry data for display
        if (syncResult.existingJournalEntry) {
          setQueriedJournalEntry(syncResult.existingJournalEntry)
        }
      } else {
        setSyncStatus({
          success: false,
          message: syncResult.message,
          timestamp: new Date().toISOString()
        })
        toast.error(`${t('journalEntryViewer.messages.syncFailed')} ${syncResult.message}`)
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : t('journalEntryViewer.messages.unknownError')
      setSyncStatus({
        success: false,
        message: errorMessage,
        timestamp: new Date().toISOString()
      })
      toast.error(`${t('journalEntryViewer.messages.syncFailed')} ${errorMessage}`)
    } finally {
      setSyncing(false)
    }
  }

  const queryLatestJournalEntry = async (journalNumber?: number, transactionNumber?: number) => {
    if (!journalNumber && !transactionNumber) {
      toast.error(t('journalEntryViewer.messages.noJournalNumberForQuery'))
      return
    }

    setQueryingJE(true)
    
    try {
      const queryResponse = await fetch('/api/journal-entries/query', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          journalNumber,
          transactionNumber,
          locale
        }),
      })

      const queryResult = await queryResponse.json()
      
      if (queryResult.success) {
        setQueriedJournalEntry(queryResult.journalEntry)
        toast.success(t('journalEntryViewer.messages.querySuccess'))
      } else {
        toast.error(`${t('journalEntryViewer.messages.queryFailed')} ${queryResult.message}`)
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : t('journalEntryViewer.messages.unknownError')
      toast.error(`${t('journalEntryViewer.messages.queryError')} ${errorMessage}`)
    } finally {
      setQueryingJE(false)
    }
  }

  // Generate journal entry data when Oracle data changes
  useEffect(() => {
    if (oracleData && oracleData.length > 0) {
      generateJournalEntryData()
    }
  }, [oracleData, locale])

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'EGP',
      minimumFractionDigits: 2
    }).format(amount)
  }

  const formatDate = (dateString: string) => {
    // Always use Gregorian calendar format regardless of locale
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    })
  }

  if (loading) {
    return (
      <div className={`flex items-center justify-center p-8 ${isRTL ? 'text-right' : 'text-left'}`}>
        <Loader2 className="h-8 w-8 animate-spin" />
        <span className={`${isRTL ? 'mr-2' : 'ml-2'}`}>{t('journalEntryViewer.messages.loadingOracleData')}</span>
      </div>
    )
  }

  if (error) {
    return (
      <Alert variant="destructive" className={isRTL ? 'text-right' : 'text-left'}>
        <AlertDescription>
          {error}
          <Button 
            variant="outline" 
            size="sm" 
            className={`${isRTL ? 'mr-4' : 'ml-4'}`}
            onClick={() => fetchData(true)}
          >
            <RefreshCw className={`h-4 w-4 ${isRTL ? 'ml-2' : 'mr-2'}`} />
            {t('journalEntryViewer.messages.retry')}
          </Button>
        </AlertDescription>
      </Alert>
    )
  }

  if (!oracleData || oracleData.length === 0) {
    return (
      <Alert className={isRTL ? 'text-right' : 'text-left'}>
        <AlertDescription>
          {t('journalEntryViewer.messages.noOracleData')}
          <Button 
            variant="outline" 
            size="sm" 
            className={`${isRTL ? 'mr-4' : 'ml-4'}`}
            onClick={() => fetchData(true)}
          >
            <Database className={`h-4 w-4 ${isRTL ? 'ml-2' : 'mr-2'}`} />
            {t('journalEntryViewer.messages.loadData')}
          </Button>
        </AlertDescription>
      </Alert>
    )
  }

  if (!journalEntryData?.journalEntries || journalEntryData.journalEntries.length === 0) {
    return (
      <Alert className={isRTL ? 'text-right' : 'text-left'}>
        <AlertDescription>
          {t('journalEntryViewer.messages.generatingView')}
          <Button 
            variant="outline" 
            size="sm" 
            className={`${isRTL ? 'mr-4' : 'ml-4'}`}
            onClick={generateJournalEntryData}
          >
            <RefreshCw className={`h-4 w-4 ${isRTL ? 'ml-2' : 'mr-2'}`} />
            {t('journalEntryViewer.messages.generateView')}
          </Button>
        </AlertDescription>
      </Alert>
    )
  }

  const { journalEntries, summary, oracleDataCount } = journalEntryData

  return (
    <div className={`space-y-6 ${isRTL ? 'text-right' : 'text-left'}`}>
      {/* Header */}
      <div className={`flex items-center justify-between ${isRTL ? 'flex-row-reverse' : ''}`}>
        <div>
          <h3 className="text-2xl font-bold">{t('journalEntryViewer.header.title')}</h3>
          <p className="text-muted-foreground">
            {t('journalEntryViewer.header.description')}
          </p>
        </div>
        <div className={`flex gap-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
          <Button onClick={() => fetchData(true)} disabled={loading}>
            <RefreshCw className={`h-4 w-4 ${isRTL ? 'ml-2' : 'mr-2'} ${loading ? 'animate-spin' : ''}`} />
            {t('journalEntryViewer.actions.refreshOracleData')}
          </Button>
          <Button 
            onClick={generateJournalEntryData} 
            disabled={loading || !oracleData || oracleData.length === 0}
            variant="outline"
          >
            <FileText className={`h-4 w-4 ${isRTL ? 'ml-2' : 'mr-2'}`} />
            {t('journalEntryViewer.actions.generateView')}
          </Button>
          <Button 
            onClick={syncToSAP} 
            disabled={
              loading ||
              syncing ||
              !journalEntryData?.journalEntries ||
              journalEntryData.journalEntries.length === 0
            }
            variant="default"
            className="bg-green-600 hover:bg-green-700"
          >
            {syncing ? (
              <Loader2 className={`h-4 w-4 ${isRTL ? 'ml-2' : 'mr-2'} animate-spin`} />
            ) : (
              <Send className={`h-4 w-4 ${isRTL ? 'ml-2' : 'mr-2'}`} />
            )}
            {t('journalEntryViewer.actions.syncToSAP')}
          </Button>
          
          {syncStatus?.success && (syncStatus.journalNumber || syncStatus.docEntry) && (
            <Button 
              onClick={() => queryLatestJournalEntry(syncStatus.journalNumber, syncStatus.docEntry)}
              disabled={queryingJE}
              variant="outline"
              className="border-blue-500 text-blue-600 hover:bg-blue-50"
            >
              {queryingJE ? (
                <Loader2 className={`h-4 w-4 ${isRTL ? 'ml-2' : 'mr-2'} animate-spin`} />
              ) : (
                <Database className={`h-4 w-4 ${isRTL ? 'ml-2' : 'mr-2'}`} />
              )}
              {t('journalEntryViewer.messages.queryLatestJEData')}
            </Button>
          )}
        </div>
      </div>

      {/* Overall Summary */}
      {summary && (
        <Card className={isRTL ? 'text-right' : 'text-left'}>
          <CardHeader>
            <CardTitle className={`flex items-center gap-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
              <FileText className="h-5 w-5" />
              {t('journalEntryViewer.summary.title')}
            </CardTitle>
            <CardDescription>
              {t('journalEntryViewer.summary.description')}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <label className="text-sm font-medium text-muted-foreground">{t('journalEntryViewer.summaryLabels.branches')}</label>
                <p className="text-lg font-semibold">{summary.totalBranches}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-muted-foreground">{t('journalEntryViewer.summaryLabels.records')}</label>
                <p className="text-lg font-semibold">{summary.totalRecords}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-muted-foreground">{t('journalEntryViewer.summaryLabels.successful')}</label>
                <p className="text-lg font-semibold">{summary.successfulBranches}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-muted-foreground">{t('journalEntryViewer.summaryLabels.locale')}</label>
                <p className="text-lg font-semibold">{locale.toUpperCase()}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Per-branch cards */}
      {journalEntries.map((item) => (
        <Card key={item.branch} className={isRTL ? 'text-right' : 'text-left'}>
          <CardHeader>
            <CardTitle className={`flex items-center gap-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
              <FileText className="h-5 w-5" />
              {t('journalEntryViewer.branchCard.title')
                .replace('{branch}', String(item.branch))
                .replace('{count}', String(item.recordCount))}
            </CardTitle>
            <CardDescription>
              {item.journalEntry.Memo}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="text-sm font-medium text-muted-foreground">{t('journalEntryViewer.summary.referenceDate')}</label>
                <p className="text-lg font-semibold">{formatDate(item.journalEntry.ReferenceDate)}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-muted-foreground">{t('journalEntryViewer.summary.reference')}</label>
                <p className="text-lg font-semibold">{item.journalEntry.Reference}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-muted-foreground">{t('journalEntryViewer.summary.memo')}</label>
                <p className="text-lg font-semibold">{item.journalEntry.Memo}</p>
              </div>
            </div>

      {/* Totals */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <div className="text-center">
                <label className="text-sm font-medium text-muted-foreground">{t('journalEntryViewer.totals.entagtam')}</label>
                <p className="text-lg font-semibold text-green-600">{formatCurrency(item.totals.entagtam)}</p>
              </div>
              <div className="text-center">
                <label className="text-sm font-medium text-muted-foreground">{t('journalEntryViewer.totals.sewer')}</label>
                <p className="text-lg font-semibold text-green-600">{formatCurrency(item.totals.sewer)}</p>
              </div>
              <div className="text-center">
                <label className="text-sm font-medium text-muted-foreground">{t('journalEntryViewer.totals.estdama')}</label>
                <p className="text-lg font-semibold text-green-600">{formatCurrency(item.totals.estdama)}</p>
              </div>
              <div className="text-center">
                <label className="text-sm font-medium text-muted-foreground">{t('journalEntryViewer.totals.taxes')}</label>
                <p className="text-lg font-semibold text-green-600">{formatCurrency(item.totals.taxes)}</p>
              </div>
              <div className="text-center">
                <label className="text-sm font-medium text-muted-foreground">{t('journalEntryViewer.totals.waterConsumption')}</label>
                <p className="text-lg font-semibold text-blue-600">{item.totals.consump ? `${parseInt(item.totals.consump).toLocaleString()} m³` : '0 m³'}</p>
              </div>
            </div>

      {/* Per-branch balance check */}
      {(() => {
        const branchCredits = item.journalEntry.JournalEntryLines.reduce((sum, line) => sum + (Number(line.Credit) || 0), 0)
        const branchDebits = item.journalEntry.JournalEntryLines.reduce((sum, line) => sum + (Number(line.Debit) || 0), 0)
        const branchBalanced = Math.abs(branchCredits - branchDebits) < 0.01
        return (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-center">
            <div className="text-center">
              <label className="text-sm font-medium text-muted-foreground">{t('journalEntryViewer.balanceCheck.totalCredits')}</label>
              <p className="text-lg font-semibold text-green-600">{formatCurrency(branchCredits)}</p>
            </div>
            <div className="text-center">
              <label className="text-sm font-medium text-muted-foreground">{t('journalEntryViewer.balanceCheck.totalDebits')}</label>
              <p className="text-lg font-semibold text-red-600">{formatCurrency(branchDebits)}</p>
            </div>
            <div className="text-center">
              <label className="text-sm font-medium text-muted-foreground">{t('journalEntryViewer.balanceCheck.title')}</label>
              <div className="mt-1">
                <Badge variant={branchBalanced ? 'default' : 'destructive'}>
                  {branchBalanced ? t('journalEntryViewer.balanceCheck.balanced') : t('journalEntryViewer.balanceCheck.notBalanced')}
                </Badge>
              </div>
            </div>
          </div>
        )
      })()}

            {/* Lines */}
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className={isRTL ? 'text-right' : 'text-left'}>{t('journalEntryViewer.journalLines.accountCode')}</TableHead>
                  <TableHead className={isRTL ? 'text-right' : 'text-left'}>{t('journalEntryViewer.journalLines.description')}</TableHead>
                  <TableHead className={isRTL ? 'text-right' : 'text-left'}>{t('journalEntryViewer.journalLines.activity')}</TableHead>
                  <TableHead className={isRTL ? 'text-right' : 'text-left'}>{t('journalEntryViewer.journalLines.branch')}</TableHead>
                  <TableHead className={isRTL ? 'text-left' : 'text-right'}>{t('journalEntryViewer.journalLines.credit')}</TableHead>
                  <TableHead className={isRTL ? 'text-left' : 'text-right'}>{t('journalEntryViewer.journalLines.debit')}</TableHead>
                  <TableHead className={isRTL ? 'text-left' : 'text-right'}>{t('journalEntryViewer.journalLines.consumedWater')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {item.journalEntry.JournalEntryLines.map((line: any, index: number) => (
                  <TableRow key={index}>
                    <TableCell className={`font-mono ${isRTL ? 'text-right' : 'text-left'}`}>{line.AccountCode || line.ShortName}</TableCell>
                    <TableCell className={isRTL ? 'text-right' : 'text-left'}>{line.LineMemo}</TableCell>
                    <TableCell className={isRTL ? 'text-right' : 'text-left'}>
                      {line.CostingCode3 && (
                        <Badge variant="secondary">{line.CostingCode3}</Badge>
                      )}
                    </TableCell>
                    <TableCell className={isRTL ? 'text-right' : 'text-left'}>
                      {line.CostingCode2 && (
                        <Badge variant="outline">{line.CostingCode2}</Badge>
                      )}
                    </TableCell>
                    <TableCell className={`font-mono ${isRTL ? 'text-left' : 'text-right'}`}>
                      {line.Credit > 0 ? formatCurrency(line.Credit) : '-'}
                    </TableCell>
                    <TableCell className={`font-mono ${isRTL ? 'text-left' : 'text-right'}`}>
                      {line.Debit > 0 ? formatCurrency(line.Debit) : '-'}
                    </TableCell>
                    <TableCell className={`font-mono ${isRTL ? 'text-left' : 'text-right'}`}>
                      {line.U_B1JE004 ? (
                        <span className="text-blue-600">
                          {parseInt(line.U_B1JE004).toLocaleString()} m³
                        </span>
                      ) : '-'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ))}

      {/* Note: Per-branch journal lines are displayed within each branch card above */}

      {/* Balance Check */}
      <Card className={isRTL ? 'text-right' : 'text-left'}>
        <CardHeader>
          <CardTitle>{t('journalEntryViewer.balanceCheck.title')}</CardTitle>
          <CardDescription>
            {t('journalEntryViewer.balanceCheck.description')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="text-center">
              <label className="text-sm font-medium text-muted-foreground">{t('journalEntryViewer.balanceCheck.totalCredits')}</label>
              <p className="text-2xl font-bold text-green-600">
                {formatCurrency(
                  journalEntries.reduce((sum, item) => sum + item.journalEntry.JournalEntryLines.reduce((s, line) => s + line.Credit, 0), 0)
                )}
              </p>
            </div>
            <div className="text-center">
              <label className="text-sm font-medium text-muted-foreground">{t('journalEntryViewer.balanceCheck.totalDebits')}</label>
              <p className="text-2xl font-bold text-red-600">
                {formatCurrency(
                  journalEntries.reduce((sum, item) => sum + item.journalEntry.JournalEntryLines.reduce((s, line) => s + line.Debit, 0), 0)
                )}
              </p>
            </div>
          </div>
          
          <div className="mt-4 text-center">
            {(() => {
              const totalCredits = journalEntries.reduce((sum, item) => sum + item.journalEntry.JournalEntryLines.reduce((s, line) => s + line.Credit, 0), 0)
              const totalDebits = journalEntries.reduce((sum, item) => sum + item.journalEntry.JournalEntryLines.reduce((s, line) => s + line.Debit, 0), 0)
              const isBalanced = Math.abs(totalCredits - totalDebits) < 0.01
              
              return (
                <Badge variant={isBalanced ? "default" : "destructive"}>
                  {isBalanced ? t('journalEntryViewer.balanceCheck.balanced') : t('journalEntryViewer.balanceCheck.notBalanced')}
                </Badge>
              )
            })()}
          </div>
        </CardContent>
      </Card>

      {/* Sync Status */}
      {syncStatus && (
        <Card className={isRTL ? 'text-right' : 'text-left'}>
          <CardHeader>
            <CardTitle className={`flex items-center gap-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
              {syncStatus.success ? (
                <CheckCircle className="h-5 w-5 text-green-600" />
              ) : syncStatus.isDuplicate ? (
                <AlertTriangle className="h-5 w-5 text-orange-600" />
              ) : (
                <XCircle className="h-5 w-5 text-red-600" />
              )}
              {syncStatus.isDuplicate ? t('journalEntryViewer.messages.duplicateJournalEntryDetected') : t('journalEntryViewer.syncStatus.title')}
            </CardTitle>
            <CardDescription>
              {t('journalEntryViewer.syncStatus.description')}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-muted-foreground">{t('journalEntryViewer.syncStatus.title')}</label>
                <div className={`flex items-center gap-2 mt-1 ${isRTL ? 'flex-row-reverse' : ''}`}>
                  {syncStatus.success ? (
                    <Badge variant="default" className="bg-green-600">
                      <CheckCircle className={`h-3 w-3 ${isRTL ? 'ml-1' : 'mr-1'}`} />
                      {t('journalEntryViewer.syncStatus.success')}
                    </Badge>
                  ) : syncStatus.isDuplicate ? (
                    <Badge variant="secondary" className="bg-orange-100 text-orange-800 border-orange-300">
                      <AlertTriangle className={`h-3 w-3 ${isRTL ? 'ml-1' : 'mr-1'}`} />
                      {t('journalEntryViewer.messages.duplicateEntryBadge')}
                    </Badge>
                  ) : (
                    <Badge variant="destructive">
                      <XCircle className={`h-3 w-3 ${isRTL ? 'ml-1' : 'mr-1'}`} />
                      {t('journalEntryViewer.syncStatus.failed')}
                    </Badge>
                  )}
                </div>
              </div>
              
              {syncStatus.docEntry && (
                <div>
                  <label className="text-sm font-medium text-muted-foreground">{t('journalEntryViewer.messages.transactionNumber')}</label>
                  <p className="text-lg font-semibold">{syncStatus.docEntry}</p>
                </div>
              )}
              
              {syncStatus.journalNumber && (
                <div>
                  <label className="text-sm font-medium text-muted-foreground">{t('journalEntryViewer.messages.journalNumber')}</label>
                  <p className="text-lg font-semibold text-blue-600">{syncStatus.journalNumber}</p>
                </div>
              )}
              
              <div>
                <label className="text-sm font-medium text-muted-foreground">{t('journalEntryViewer.syncStatus.message')}</label>
                <p className="text-sm">{syncStatus.message}</p>
              </div>
              
              {syncStatus.timestamp && (
                <div>
                  <label className="text-sm font-medium text-muted-foreground">{t('journalEntryViewer.syncStatus.timestamp')}</label>
                  <p className="text-sm text-muted-foreground">
                    {formatDate(syncStatus.timestamp)}
                  </p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Queried Journal Entry Data */}
      {queriedJournalEntry && (
        <Card className={isRTL ? 'text-right' : 'text-left'}>
          <CardHeader>
            <CardTitle className={`flex items-center gap-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
              {queryingJE ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <Database className="h-5 w-5 text-blue-600" />
              )}
              {t('journalEntryViewer.messages.latestJournalEntryData')}
            </CardTitle>
            <CardDescription>
              {t('journalEntryViewer.messages.realTimeDataDescription')}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="text-sm font-medium text-muted-foreground">{t('journalEntryViewer.messages.transactionNumber')}</label>
                  <p className="text-lg font-semibold text-green-600">{queriedJournalEntry.JdtNum}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">{t('journalEntryViewer.messages.journalNumber')}</label>
                  <p className="text-lg font-semibold text-blue-600">{queriedJournalEntry.Number}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">{t('journalEntryViewer.summary.referenceDate')}</label>
                  <p className="text-lg font-semibold">{formatDate(queriedJournalEntry.ReferenceDate)}</p>
                </div>
              </div>
              
                              <div>
                  <label className="text-sm font-medium text-muted-foreground">{t('journalEntryViewer.summary.memo')}</label>
                  <p className="text-sm font-medium">{queriedJournalEntry.Memo}</p>
                </div>
                
                <div>
                  <label className="text-sm font-medium text-muted-foreground">{t('journalEntryViewer.summary.reference')}</label>
                  <p className="text-sm font-mono">{queriedJournalEntry.Reference}</p>
                </div>
              
              {queriedJournalEntry.JournalEntryLines && (
                <div>
                  <label className="text-sm font-medium text-muted-foreground">{t('journalEntryViewer.messages.journalEntryLines').replace('{count}', queriedJournalEntry.JournalEntryLines.length.toString())}</label>
                  <div className="mt-2 space-y-2">
                    {queriedJournalEntry.JournalEntryLines.map((line: any, index: number) => (
                      <div key={index} className="flex justify-between items-center p-2 bg-muted rounded">
                        <div className="flex-1">
                          <span className="font-mono text-sm">{line.AccountCode || line.ShortName}</span>
                          <span className="text-xs text-muted-foreground ml-2">{line.LineMemo}</span>
                        </div>
                        <div className="text-right">
                          {line.Debit > 0 && (
                            <span className="text-red-600 font-semibold">-{formatCurrency(line.Debit)}</span>
                          )}
                          {line.Credit > 0 && (
                            <span className="text-green-600 font-semibold">+{formatCurrency(line.Credit)}</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
} 