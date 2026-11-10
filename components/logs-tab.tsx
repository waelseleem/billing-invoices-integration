"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Search, Filter, Download, RefreshCw, AlertTriangle, Info, CheckCircle, XCircle, Loader2, Trash2, MoreHorizontal } from "lucide-react"
import { toast } from "sonner"
import { usePathname } from 'next/navigation';
import { getLocaleFromPathname } from '@/lib/i18n/utils';
import { useTranslations } from '@/lib/i18n/hooks';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Calendar } from "@/components/ui/calendar"
import { CalendarIcon } from "lucide-react"
import { format } from "date-fns"

interface LogEntry {
  id: string
  timestamp: string
  level: "info" | "warning" | "error" | "success"
  message: string
  details?: string
  source: string
}

export function LogsTab() {
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [searchTerm, setSearchTerm] = useState("")
  const [levelFilter, setLevelFilter] = useState("all")
  const [autoRefresh, setAutoRefresh] = useState(true)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isClearing, setIsClearing] = useState(false)
  const [startDate, setStartDate] = useState<Date | undefined>(undefined)
  const [endDate, setEndDate] = useState<Date | undefined>(undefined)
  const [showDateFilter, setShowDateFilter] = useState(false)
  
  // Get locale from pathname for translations
  const pathname = usePathname();
  const locale = getLocaleFromPathname(pathname);
  const t = useTranslations(locale);

  // Fetch logs from API with retry mechanism
  const fetchLogs = async (retryCount = 0) => {
    try {
      setIsLoading(true)
      setError(null)
      
      // Build query parameters
      const params = new URLSearchParams()
      if (levelFilter !== 'all') params.append('level', levelFilter)
      if (searchTerm) params.append('search', searchTerm)
      if (startDate) params.append('startDate', startDate.toISOString())
      if (endDate) params.append('endDate', endDate.toISOString())
      params.append('limit', '100')
      
      const response = await fetch(`/api/logs?${params.toString()}`, {
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        },
      })
      
      // Check if response is JSON
      const contentType = response.headers.get('content-type')
      if (!contentType || !contentType.includes('application/json')) {
        throw new Error('Server returned non-JSON response. Please try again.')
      }
      
      if (!response.ok) {
        try {
          const errorData = await response.json()
          throw new Error(errorData.message || `HTTP ${response.status}: Failed to fetch logs`)
        } catch (parseError) {
          throw new Error(`HTTP ${response.status}: Failed to fetch logs`)
        }
      }
      
      const data = await response.json()
      
      if (!data.success) {
        throw new Error(data.message || 'Failed to fetch logs')
      }
      
      setLogs(data.logs || [])
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred'
      
      // Retry logic for network errors
      if (retryCount < 2 && (errorMessage.includes('fetch') || errorMessage.includes('network'))) {
        console.log(`Retrying logs fetch (attempt ${retryCount + 1})...`)
        setTimeout(() => fetchLogs(retryCount + 1), 1000 * (retryCount + 1))
        return
      }
      
      setError(errorMessage)
      toast.error(`Failed to load logs: ${errorMessage}`)
      console.error('Logs fetch error:', error)
    } finally {
      setIsLoading(false)
    }
  }

  // Initial fetch and auto-refresh
  useEffect(() => {
    fetchLogs()

    if (autoRefresh) {
    const interval = setInterval(() => {
        fetchLogs()
      }, 10000) // Refresh every 10 seconds
      
      return () => clearInterval(interval)
    }
  }, [autoRefresh, levelFilter, searchTerm])

  // Export logs to CSV
  const exportLogs = async (type: string = 'current') => {
    try {
      if (type === 'current' && logs.length === 0) {
        toast.warning("No logs to export");
        return;
      }
      
      let dataToExport: LogEntry[] = [];
      
      if (type === 'current') {
        dataToExport = logs;
      } else {
        // For other types, we'll need to fetch all logs first
        toast.info("Preparing logs for export...");
        try {
          const response = await fetch(`/api/logs?type=${type}&limit=1000`);
          
          // Check if response is JSON
          const contentType = response.headers.get('content-type');
          if (!contentType || !contentType.includes('application/json')) {
            throw new Error('Server returned non-JSON response');
          }
          
          if (!response.ok) {
            throw new Error(`HTTP ${response.status}: Failed to fetch logs for export`);
          }
          
          const data = await response.json();
          
          if (data.success && data.logs && data.logs.length > 0) {
            exportLogsToCSV(data.logs, type);
          } else {
            toast.warning(`No ${type} logs to export`);
          }
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
          toast.error(`Failed to export logs: ${errorMessage}`);
          console.error('Export fetch error:', error);
        }
        return;
      }
      
      exportLogsToCSV(dataToExport, type);
    } catch (error) {
      toast.error(t('logs.failedToExport'));
      console.error("Export error:", error);
    }
  }
  
  // Helper function to export logs to CSV
  const exportLogsToCSV = (logsToExport: LogEntry[], type: string) => {
    if (logsToExport.length === 0) {
      toast.warning("No logs to export");
      return;
    }
    
    // Create CSV content
    const headers = ["Timestamp", "Level", "Source", "Message", "Details"];
    const csvRows = [headers.join(",")];
    
    logsToExport.forEach(log => {
      // Escape CSV fields properly
      const escapeCsvField = (field: string) => {
        if (!field) return '';
        // Replace double quotes with two double quotes and wrap in quotes
        return `"${field.replace(/"/g, '""')}"`;
      }
      
      const row = [
        escapeCsvField(log.timestamp),
        escapeCsvField(log.level),
        escapeCsvField(log.source),
        escapeCsvField(log.message),
        escapeCsvField(log.details || '')
      ];
      
      csvRows.push(row.join(","));
    });
    
    const csvContent = csvRows.join("\n");
    
    // Create download link
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `billing-integration-logs-${type}-${new Date().toISOString().slice(0, 10)}.csv`);
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    toast.success(`${logsToExport.length} logs exported successfully`);
  }

  // Clear logs
  const clearLogs = async (type: string = 'all') => {
    try {
      setIsClearing(true);
      
      const response = await fetch(`/api/logs/clear?type=${type}`, {
        method: 'DELETE',
      });
      
      // Check if response is JSON
      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        throw new Error('Server returned non-JSON response');
      }
      
      if (!response.ok) {
        try {
          const errorData = await response.json();
          throw new Error(errorData.message || `HTTP ${response.status}: Failed to clear logs`);
        } catch (parseError) {
          throw new Error(`HTTP ${response.status}: Failed to clear logs`);
        }
      }
      
      const data = await response.json();
      
      if (!data.success) {
        throw new Error(data.message || 'Failed to clear logs');
      }
      
      toast.success(data.message || t('logs.logsClearedSuccessfully'));
      
      // Refresh logs after clearing
      await fetchLogs();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
      toast.error(`${t('logs.failedToClearLogs')}: ${errorMessage}`);
      console.error('Clear logs error:', error);
    } finally {
      setIsClearing(false);
    }
  };

  // Clear date filters
  const clearDateFilters = () => {
    setStartDate(undefined)
    setEndDate(undefined)
    setShowDateFilter(false)
    // Refresh logs without date filters
    fetchLogs()
  }

  const getLevelIcon = (level: string) => {
    switch (level) {
      case "success":
        return <CheckCircle className="h-4 w-4 text-green-600" />
      case "error":
        return <XCircle className="h-4 w-4 text-red-600" />
      case "warning":
        return <AlertTriangle className="h-4 w-4 text-yellow-600" />
      case "info":
        return <Info className="h-4 w-4 text-blue-600" />
      default:
        return <Info className="h-4 w-4 text-gray-600" />
    }
  }

  const getLevelBadge = (level: string) => {
    const variants = {
      success: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
      error: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
      warning: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
      info: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
    }

    return (
      <Badge className={variants[level as keyof typeof variants] || "bg-gray-100 text-gray-800"}>
        {level.toUpperCase()}
      </Badge>
    )
  }



  // Function to format log message for better readability
  const formatLogMessage = (message: string) => {
    if (!message) return message;

    // Enhanced formatting for better readability - NO HTML generation
    let formattedMessage = message
      // Add line breaks and structure for common patterns
      .replace(/(\w+):\s*{/g, '\n📋 $1: {')
      .replace(/(\w+):\s*"/g, '\n📋 $1: "')
      .replace(/(\w+):\s*(\d+)/g, '\n📊 $1: $2')
      .replace(/(\w+):\s*([A-Z][a-z]+)/g, '\n📋 $1: $2')
      .replace(/(\w+):\s*([A-Z]+)/g, '\n📋 $1: $2')
      // Clean up multiple line breaks
      .replace(/\n\s*\n/g, '\n')
      .trim();

    return formattedMessage;
  }

  // Function to format details with better structure
  const formatDetails = (details: string) => {
    if (!details) return '';
    
    // Check if it contains "Additional Data:" section
    if (details.includes('Additional Data:')) {
      const parts = details.split('Additional Data:');
      const mainDetails = parts[0].trim();
      const additionalData = parts[1]?.trim();
      
      let formatted = '';
      
      if (mainDetails) {
        formatted += `📝 Main Details:\n${mainDetails}\n\n`;
      }
      
      if (additionalData) {
        formatted += `📊 Additional Data:\n${additionalData}`;
      }
      
      return formatted;
    }
    
    return details;
  }

  // Component to render highlighted text safely
  const HighlightedText = ({ text, className = "" }: { text: string; className?: string }) => {
    if (!text) return null;

    // Define service names and their colors
    const serviceHighlights = [
      { name: 'billing-integration', color: 'text-blue-600 font-semibold' },
      { name: 'SAPService', color: 'text-purple-600 font-semibold' },
      { name: 'SAP B1', color: 'text-purple-600 font-semibold' },
      { name: 'Oracle', color: 'text-orange-600 font-semibold' },
      { name: 'OracleService', color: 'text-orange-600 font-semibold' },
      { name: 'Journal Entry', color: 'text-green-600 font-semibold' },
      { name: 'JournalEntries', color: 'text-green-600 font-semibold' },
      { name: 'Contract', color: 'text-indigo-600 font-semibold' },
      { name: 'C1002', color: 'text-indigo-600 font-semibold' },
      { name: 'SSL verification', color: 'text-orange-600 font-semibold' },
      { name: 'Service', color: 'text-cyan-600 font-semibold' },
      { name: 'Integration', color: 'text-blue-600 font-semibold' },
    ];

    // Sort by length (longest first) to avoid partial matches
    serviceHighlights.sort((a, b) => b.name.length - a.name.length);

    // Create a simple highlighting function
    const highlightText = (inputText: string) => {
      let result = inputText;
      
      // First, highlight service names
      serviceHighlights.forEach(({ name, color }) => {
        const escapedName = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const regex = new RegExp(`\\b${escapedName}\\b`, 'gi');
        result = result.replace(regex, `__HIGHLIGHT_${color}__$&__END__`);
      });

      // Then highlight status words
      const statusPatterns = [
        { pattern: /\b(successfully|completed|initialized|generated|created|posted)\b/gi, color: 'text-green-600 font-semibold' },
        { pattern: /\b(failed|error|warning|disabled)\b/gi, color: 'text-red-600 font-semibold' },
        { pattern: /\b(SSL verification)\b/gi, color: 'text-yellow-600 font-semibold' },
      ];

      statusPatterns.forEach(({ pattern, color }) => {
        result = result.replace(pattern, `__HIGHLIGHT_${color}__$&__END__`);
      });

      return result;
    };

    const highlightedText = highlightText(text);
    const parts = highlightedText.split(/(__HIGHLIGHT_.*?__.*?__END__)/);

    return (
      <span className={className}>
        {parts.map((part, index) => {
          const match = part.match(/__HIGHLIGHT_(.*?)__(.*?)__END__/);
          if (match) {
            const [, color, text] = match;
            return (
              <span key={index} className={color}>
                {text}
              </span>
            );
          }
          return <span key={index}>{part}</span>;
        })}
      </span>
    );
  };

  // Function to extract and format JSON details
  const formatJsonDetails = (details: string) => {
    if (!details) return '';

    try {
      // Try to parse as JSON and format it with better structure
      const parsed = JSON.parse(details);
      
      // Add visual indicators for different data types
      let formattedJson = JSON.stringify(parsed, null, 2);
      
      // Add color coding for JSON structure
      formattedJson = formattedJson
        .replace(/"([^"]+)":/g, '<span class="text-purple-600 font-semibold">"$1"</span>:')
        .replace(/: "([^"]+)"/g, ': <span class="text-green-600">"$1"</span>')
        .replace(/: (\d+\.\d+)/g, ': <span class="text-blue-600 font-mono">$1</span>')
        .replace(/: (\d+)/g, ': <span class="text-indigo-600 font-mono">$1</span>')
        .replace(/: (true|false)/g, ': <span class="text-orange-600 font-semibold">$1</span>')
        .replace(/: (null)/g, ': <span class="text-gray-500 font-semibold">$1</span>');
      
      return formattedJson;
    } catch {
      // If not valid JSON, format as plain text with structure
      return details
        .replace(/(\w+):/g, '<span class="text-purple-600 font-semibold">$1:</span>')
        .replace(/"([^"]+)"/g, '<span class="text-green-600">"$1"</span>')
        .replace(/(\d+\.\d+)/g, '<span class="text-blue-600 font-mono">$1</span>')
        .replace(/(\d+)/g, '<span class="text-indigo-600 font-mono">$1</span>');
    }
  }

  // Function to categorize log messages
  const getMessageCategory = (message: string) => {
    const lowerMessage = message.toLowerCase();
    
    if (lowerMessage.includes('successfully') || lowerMessage.includes('completed') || lowerMessage.includes('balanced')) {
      return 'success';
    } else if (lowerMessage.includes('failed') || lowerMessage.includes('error')) {
      return 'error';
    } else if (lowerMessage.includes('warning')) {
      return 'warning';
    } else if (lowerMessage.includes('initialized') || lowerMessage.includes('generated') || lowerMessage.includes('created')) {
      return 'info';
    } else {
      return 'default';
    }
  }

  // Function to get message icon
  const getMessageIcon = (message: string) => {
    const category = getMessageCategory(message);
    
    switch (category) {
      case 'success':
        return '✅';
      case 'error':
        return '❌';
      case 'warning':
        return '⚠️';
      case 'info':
        return 'ℹ️';
      default:
        return '📝';
    }
  }

  return (
    <div className={`space-y-6 ${locale === 'ar' ? 'rtl' : 'ltr'}`}>
      {/* Header Section */}
      <div className="space-y-2">
        <h3 className="text-2xl md:text-3xl font-bold tracking-tight">{t('logs.title')}</h3>
        <p className="text-muted-foreground text-base md:text-lg">{t('logs.subtitle')}</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <span className="text-xl md:text-2xl">{t('logs.title')}</span>
            <div className="flex items-center gap-2">
              <Badge variant={autoRefresh ? "default" : "secondary"} className="text-xs">
                {autoRefresh ? t('logs.status.live') : t('logs.status.paused')}
              </Badge>
              <Button variant="outline" size="sm" onClick={() => setAutoRefresh(!autoRefresh)}>
                {autoRefresh ? t('logs.actions.pause') : t('logs.actions.resume')}
              </Button>
            </div>
          </CardTitle>
          <CardDescription>{t('logs.description')}</CardDescription>
        </CardHeader>
        <CardContent>
          {/* Filters and Search - Responsive Layout */}
          <div className="space-y-4 mb-6">
            {/* Search Bar - Full Width */}
            <div className="relative w-full">
              <Search className={`absolute top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground ${locale === 'ar' ? 'right-3' : 'left-3'}`} />
              <Input
                placeholder={t('logs.actions.search')}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className={`h-10 ${locale === 'ar' ? 'pr-10' : 'pl-10'}`}
                dir="ltr"
              />
            </div>

            {/* Filter Controls - Responsive Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {/* Level Filter */}
              <Select value={levelFilter} onValueChange={setLevelFilter}>
                <SelectTrigger className="h-10">
                  <Filter className={`h-4 w-4 ${locale === 'ar' ? 'ml-2' : 'mr-2'}`} />
                  <SelectValue placeholder={t('logs.actions.filterByLevel')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t('logs.levels.all')}</SelectItem>
                  <SelectItem value="success">{t('logs.levels.success')}</SelectItem>
                  <SelectItem value="info">{t('logs.levels.info')}</SelectItem>
                  <SelectItem value="warning">{t('logs.levels.warning')}</SelectItem>
                  <SelectItem value="error">{t('logs.levels.error')}</SelectItem>
                </SelectContent>
              </Select>

              {/* Date Filter */}
              <Popover open={showDateFilter} onOpenChange={setShowDateFilter}>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={`h-10 flex items-center gap-2 ${startDate || endDate ? 'border-blue-500' : ''}`}>
                    <CalendarIcon className="h-4 w-4" />
                    <span className="hidden sm:inline">
                      {startDate || endDate ? t('logs.actions.dateFilterActive') : t('logs.actions.dateRange')}
                    </span>
                    <span className="sm:hidden">Date</span>
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align={locale === 'ar' ? 'start' : 'end'}>
                  <div className="p-4 space-y-4">
                    <div className="space-y-2">
                      <h4 className="font-medium text-sm">{t('logs.dateFilter.startDate')}</h4>
                      <Calendar
                        mode="single"
                        selected={startDate}
                        onSelect={setStartDate}
                        initialFocus
                      />
                    </div>
                    <div className="space-y-2">
                      <h4 className="font-medium text-sm">{t('logs.dateFilter.endDate')}</h4>
                      <Calendar
                        mode="single"
                        selected={endDate}
                        onSelect={setEndDate}
                        initialFocus
                      />
                    </div>
                    <div className="flex justify-between">
                      <Button variant="outline" size="sm" onClick={clearDateFilters}>
                        {t('common.clear')}
                      </Button>
                      <Button size="sm" onClick={() => {
                        setShowDateFilter(false)
                        fetchLogs()
                      }}>
                        {t('logs.actions.applyFilter')}
                      </Button>
                    </div>
                  </div>
                </PopoverContent>
              </Popover>

              {/* Export Dropdown */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" className="h-10 flex items-center gap-2 bg-transparent">
                    <Download className="h-4 w-4" />
                    <span className="hidden sm:inline">{t('logs.actions.export')}</span>
                    <span className="sm:hidden">Export</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  <DropdownMenuItem onClick={() => exportLogs('current')}>
                    {t('logs.export.currentView')}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => exportLogs('all')}>
                    {t('logs.export.allLogs')}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => exportLogs('error')}>
                    {t('logs.export.errorLogs')}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              {/* Action Buttons */}
              <div className="flex gap-2">
                <Button variant="outline" size="icon" onClick={() => fetchLogs()} disabled={isLoading} className="h-10 w-10">
                  {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                </Button>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="outline" size="icon" className="h-10 w-10 text-red-500 hover:text-red-600" disabled={isClearing}>
                      {isClearing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>{t('logs.actions.clear')}</AlertDialogTitle>
                      <AlertDialogDescription>
                        {t('logs.clear.description')}
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <div className="grid gap-4 py-4">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <Button 
                          variant="outline" 
                          onClick={() => {
                            clearLogs('billing');
                            document.querySelector<HTMLButtonElement>('[data-alert-dialog-close]')?.click();
                          }}
                          className="w-full"
                        >
                          {t('logs.clear.billingLogs')}
                        </Button>
                        <Button 
                          variant="outline" 
                          onClick={() => {
                            clearLogs('error');
                            document.querySelector<HTMLButtonElement>('[data-alert-dialog-close]')?.click();
                          }}
                          className="w-full"
                        >
                          {t('logs.clear.errorLogs')}
                        </Button>
                      </div>
                    </div>
                    <AlertDialogFooter>
                      <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
                      <AlertDialogAction 
                        onClick={() => {
                          clearLogs('all');
                        }} 
                        className="bg-red-500 hover:bg-red-600"
                      >
                        {t('logs.clear.clearAllLogs')}
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </div>
          </div>

          {/* Date filter indicators */}
          {(startDate || endDate) && (
            <div className="flex flex-wrap items-center gap-2 mb-4 text-sm">
              <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                {t('logs.dateFilterActive')}: 
                {startDate && ` ${t('logs.dateFilter.from')} ${format(startDate, 'MMM dd, yyyy')}`}
                {endDate && ` ${t('logs.dateFilter.to')} ${format(endDate, 'MMM dd, yyyy')}`}
              </Badge>
              <Button variant="ghost" size="sm" className="h-6 px-2" onClick={clearDateFilters}>
                <XCircle className="h-4 w-4" />
              </Button>
            </div>
          )}

          {/* Log Stream - Responsive Height */}
          <ScrollArea className="h-[400px] md:h-[500px] lg:h-[600px] w-full rounded-md border p-4">
            {isLoading && logs.length === 0 ? (
              <div className="flex items-center justify-center h-full">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                <span className="ml-2 text-muted-foreground">{t('logs.loading')}</span>
              </div>
            ) : error ? (
              <div className="flex flex-col items-center justify-center h-full text-center">
                <XCircle className="h-12 w-12 text-red-500 mb-2" />
                <h3 className="text-lg font-medium">{t('logs.failedToLoad')}</h3>
                <p className="text-muted-foreground mb-4">{error}</p>
                <Button onClick={() => fetchLogs()}>{t('common.tryAgain')}</Button>
              </div>
            ) : logs.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center">
                <Info className="h-12 w-12 text-blue-500 mb-2" />
                <h3 className="text-lg font-medium">{t('logs.noLogsFound')}</h3>
                <p className="text-muted-foreground">{t('logs.tryChangingCriteria')}</p>
              </div>
            ) : (
            <div className="space-y-3">
                {logs.map((log) => (
                <div
                  key={log.id}
                  className="flex flex-col gap-3 p-3 sm:p-4 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
                >
                  {/* Header with timestamp, level, and source */}
                  <div className="flex items-center gap-3 flex-shrink-0">
                    <div className="mt-1">{getLevelIcon(log.level)}</div>
                    <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                      <span className="text-xs sm:text-sm font-mono text-muted-foreground" dir="ltr">
                        {new Date(log.timestamp).toLocaleString()}
                      </span>
                      {getLevelBadge(log.level)}
                                              <Badge variant="outline" className="text-xs w-fit" dir="ltr">
                          <HighlightedText text={log.source} />
                        </Badge>
                    </div>
                  </div>
                  
                  {/* Message on new line with enhanced formatting */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start gap-2">
                      <span className="text-lg mt-0.5">{getMessageIcon(log.message)}</span>
                                              <div 
                          className="text-sm font-medium break-words whitespace-pre-line flex-1" 
                          dir="ltr" 
                          style={{ textAlign: 'left' }}
                        >
                          <HighlightedText text={formatLogMessage(log.message)} />
                        </div>
                    </div>
                  </div>
                  
                  {/* Details on separate line if exists */}
                  {log.details && (
                    <div className="flex-1 min-w-0">
                      <div className="text-xs text-muted-foreground bg-muted p-3 rounded border-l-4 border-blue-500">
                        <div className="font-semibold text-blue-600 mb-2 flex items-center gap-2">
                          <span>🔍</span>
                          Complete Log Data:
                        </div>
                        <pre 
                          className="overflow-x-auto whitespace-pre-wrap break-words text-xs" 
                          dir="ltr" 
                          style={{ textAlign: 'left', direction: 'ltr' }}
                        >
                          <HighlightedText text={log.details} />
                        </pre>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
            )}
          </ScrollArea>

          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mt-4 text-sm text-muted-foreground gap-2">
            <span>{t('logs.showingEntries').replace('{count}', logs.length.toString())}</span>
            <span>{t('logs.autoRefresh')}: {autoRefresh ? t('logs.on') : t('logs.off')}</span>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
