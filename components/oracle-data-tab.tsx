'use client';

import { useState, useMemo } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { 
  AlertCircle, 
  Loader2, 
  Search, 
  RefreshCw, 
  Download,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  TrendingUp,
  TrendingDown,
  DollarSign,
  Calendar,
  Building,
  Filter,
  Trash2,
  Bug,
  Send,
  Database
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DashboardStats } from './dashboard-stats';
import { useOracleData } from '@/lib/oracle-data-context';
import { toast } from "sonner"
import { MonthBillingDto } from '@/lib/types/billing';
import { usePathname } from 'next/navigation';
import { getLocaleFromPathname } from '@/lib/i18n/utils';
import { useTranslations } from '@/lib/i18n/hooks';

interface OracleRecord {
  CSTYPE: string;
  BRANCHE: string;
  BILNG_DATE: string;
  ENTAGTAM: string;
  SEWER: string;
  TANZEEM: string;
  ESTDAMA: string;
  CONTRACT: string;
  TAXES: string;
  WATERCREDIT: string;
  SEWERCREDIT: string;
  CONSUMP: string;
}

// Helper function to safely parse numbers
function safeParseNumber(value: string | number | null | undefined): number {
  if (value === null || value === undefined) return 0;
  if (typeof value === 'number') return value;
  const parsed = parseFloat(value);
  return isNaN(parsed) ? 0 : parsed;
}

// Helper to sanitize data before sending to the backend
function sanitizeDataForSync(records: any[]): any[] {
  console.log('Sanitizing data. First record keys:', records.length > 0 ? Object.keys(records[0]) : 'No records');
  
  return records.map((rec, index) => {
    // Handle both camelCase (from localStorage) and UPPERCASE (from Oracle API) field names
    const result = {
      lineId: String(rec.lineId || rec.LINE_ID || index + 1),
      csType: String(rec.csType || rec.CSTYPE || ''),
      branche: String(rec.branche || rec.BRANCHE || ''),
      costCenter: String(rec.costCenter || rec.COSTCENTER || ''),
      // Handle date fields carefully
      billingDate: rec.billingDate ? rec.billingDate : 
                  rec.BILNG_DATE ? new Date(rec.BILNG_DATE).toISOString() : 
                  new Date().toISOString(),
      // Handle numeric fields
      entagtam: Number(rec.entagtam || rec.ENTAGTAM || 0),
      sewer: Number(rec.sewer || rec.SEWER || 0),
      tanzeem: Number(rec.tanzeem || rec.TANZEEM || 0),
      estdama: Number(rec.estdama || rec.ESTDAMA || 0),
      contract: Number(rec.contract || rec.CONTRACT || 0),
      taxes: Number(rec.taxes || rec.TAXES || 0),
      rounding: Number(rec.rounding || rec.ROUNDING || 0),
      waterCredit: Number(rec.waterCredit || rec.WATERCREDIT || 0),
      sewerCredit: Number(rec.sewerCredit || rec.SEWERCREDIT || 0),
      waterDebit: Number(rec.waterDebit || rec.WATERDEBIT || 0),
      sewerDebit: Number(rec.sewerDebit || rec.SEWERDEBIT || 0),
      consump: Number(rec.consump || rec.CONSUMP || 0),
    };
    
    // For debugging the first few records
    if (index < 2) {
      console.log(`Record ${index} sanitized:`, result);
    }
    
    return result;
  });
}

// Loading skeleton for table rows
const TableRowSkeleton = () => (
  <TableRow>
    {Array(8).fill(0).map((_, i) => (
      <TableCell key={i}>
        <Skeleton className="h-6 w-full" />
      </TableCell>
    ))}
  </TableRow>
);

interface SortConfig {
  key: keyof OracleRecord;
  direction: 'asc' | 'desc';
}

export default function OracleDataTab() {
  const { data, loading, error, lastUpdated, fetchData, clearLocalData, debugLocalStorage } = useOracleData();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedBranch, setSelectedBranch] = useState<string>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isClearing, setIsClearing] = useState(false);
  const [activeTab, setActiveTab] = useState("data");
  const [sortConfig, setSortConfig] = useState<SortConfig>({ key: 'ENTAGTAM', direction: 'asc' });
  
  // Get locale from pathname for translations
  const pathname = usePathname();
  const locale = getLocaleFromPathname(pathname);
  const t = useTranslations(locale);

  const handleRefresh = async () => {
    toast.info(t('common.loading'));
    try {
      await fetchData(true);
      toast.success(t('common.success'));
    } catch (err) {
      toast.error(t('common.error'));
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-AE', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(value);
  };

  const getValueColor = (value: number) => {
    if (value > 0) return 'text-success';
    if (value < 0) return 'text-error';
    return 'text-foreground';
  };

  const ValueWithIndicator = ({ value }: { value: number }) => {
    const formattedValue = formatCurrency(value);
    return (
      <div className={`flex items-center justify-end gap-1 ${getValueColor(value)}`}>
        {value !== 0 && (
          <span className="text-xs">
            {value > 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
          </span>
        )}
        <span>{formattedValue}</span>
      </div>
    );
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-AE', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const formatNumber = (value: number) => {
    return new Intl.NumberFormat('en-AE').format(value);
  };

  // Get unique branches for filter
  const branches = useMemo(() => {
    const uniqueBranches = [...new Set(data.map(row => row.BRANCHE))].sort();
    return uniqueBranches;
  }, [data]);

  // Filter and search data
  const filteredData = useMemo(() => {
    return data.filter(row => {
      const matchesSearch = searchTerm === '' || 
        Object.values(row).some(value => 
          value && value.toString().toLowerCase().includes(searchTerm.toLowerCase())
        );
      
      const matchesBranch = selectedBranch === 'all' || row.BRANCHE === selectedBranch;
      
      return matchesSearch && matchesBranch;
    });
  }, [data, searchTerm, selectedBranch]);

  // Paginate data
  const paginatedData = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filteredData.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredData, currentPage, itemsPerPage]);

  const totalPages = Math.ceil(filteredData.length / itemsPerPage);

  const exportToCsv = () => {
    const headers = [
      'Line ID', 'Customer Type', 'Branch', 'Cost Center',
      'Entagtam', 'Sewer', 'Tanzeem', 'Estdama', 'Contract', 'Taxes', 'Rounding',
      'Water Credit', 'Sewer Credit', 'Water Debit', 'Sewer Debit', 'Consumption'
    ];
    
    const csvContent = [
      headers.join(','),
      ...filteredData.map(row => [
        row.LINE_ID || '',
        row.CSTYPE,
        row.BRANCHE,
        row.COSTCENTER,
        safeParseNumber(row.ENTAGTAM),
        safeParseNumber(row.SEWER),
        safeParseNumber(row.TANZEEM),
        safeParseNumber(row.ESTDAMA),
        safeParseNumber(row.CONTRACT),
        safeParseNumber(row.TAXES),
        safeParseNumber(row.ROUNDING),
        safeParseNumber(row.WATERCREDIT),
        safeParseNumber(row.SEWERCREDIT),
        safeParseNumber(row.WATERDEBIT),
        safeParseNumber(row.SEWERDEBIT),
        safeParseNumber(row.CONSUMP)
      ].join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `oracle-financial-data-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const handleSyncToSAP = () => {
    // First try to use filtered data from the component
    let dataToSync = filteredData;
    
    // If no data in component state, try to get it directly from localStorage
    if (!dataToSync || dataToSync.length === 0) {
      try {
        const storedData = localStorage.getItem('oracle_billing_data');
        if (storedData) {
          const parsedData = JSON.parse(storedData);
          if (Array.isArray(parsedData) && parsedData.length > 0) {
            dataToSync = parsedData;
            console.log(`Retrieved ${parsedData.length} records directly from localStorage`);
          }
        }
      } catch (err) {
        console.error('Failed to retrieve data from localStorage:', err);
      }
    }

    // Final check if we have data to sync
    if (!dataToSync || dataToSync.length === 0) {
      toast.error('No data to sync. Please refresh data or check localStorage.');
      console.error('No data available for sync. filteredData:', filteredData);
      return;
    }

    console.log(`Starting sync with ${dataToSync.length} records`);
    setIsSyncing(true);
    toast.info(`Starting SAP synchronization for ${dataToSync.length} records...`);

    try {
      // Check if the data is already in the correct format (might happen if from localStorage)
      const needsCleaning = dataToSync.some(item => {
        // Check if it has uppercase keys (from API) or is missing required fields
        const hasUppercaseKeys = 'CSTYPE' in item || 'BILNG_DATE' in item;
        const needsSanitizing = !('billingDate' in item) || !('lineId' in item);
        return hasUppercaseKeys || needsSanitizing;
      });
      
      let cleanedData;
      if (needsCleaning) {
        console.log('Data needs cleaning/sanitizing');
        cleanedData = sanitizeDataForSync(dataToSync);
      } else {
        console.log('Data is already in correct format, skipping sanitization');
        cleanedData = dataToSync;
      }
      
      // Create a safe copy for logging (limit array size for console)
      const logSample = cleanedData.slice(0, 2);
      console.log(`Syncing ${cleanedData.length} records. Sample:`, logSample);

      // Ensure we have valid data to send
      if (!cleanedData || cleanedData.length === 0) {
        throw new Error('Data sanitization resulted in empty dataset');
      }

      const requestBody = JSON.stringify({ billingData: cleanedData });
      console.log(`Request body length: ${requestBody.length}`);

      if (requestBody.length <= 2) {
        throw new Error('Request body is empty after stringification');
      }

      fetch('/api/sap/sync', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: requestBody,
      })
        .then(async (res) => {
          let result;
          try {
            result = await res.json();
          } catch (e) {
            toast.error('Failed to parse server response.');
            return;
          }

          if (res.ok) {
            toast.success('SAP synchronization completed successfully.', {
              description: result.docEntry ? `Document Entry: ${result.docEntry}` : undefined,
            });
          } else {
            toast.error('SAP synchronization failed.', {
              description: result.message || 'An unknown error occurred.',
            });
          }
        })
        .catch((err) => {
          toast.error('Network error during synchronization.', {
            description: err.message,
          });
        })
        .finally(() => {
          setIsSyncing(false);
        });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      toast.error('Data preparation failed.', {
        description: errorMessage,
      });
      setIsSyncing(false);
    }
  };

  // Handle clearing local data
  const handleClearLocalData = () => {
    setIsClearing(true);
    clearLocalData();
    setTimeout(() => setIsClearing(false), 1000);
  };

  // Handle debugging localStorage
  const handleDebugStorage = () => {
    const status = debugLocalStorage();
    toast.info(`LocalStorage status: ${status.hasData ? 'Data found' : 'No data'}`);
  };

  // Handle direct sync from localStorage
  const handleDirectSync = () => {
    try {
      // Get data directly from localStorage
      const storedData = localStorage.getItem('oracle_billing_data');
      if (!storedData) {
        toast.error('No data found in localStorage');
        return;
      }

      // Parse the data
      const parsedData = JSON.parse(storedData);
      if (!Array.isArray(parsedData) || parsedData.length === 0) {
        toast.error('Invalid or empty data in localStorage');
        return;
      }

      setIsSyncing(true);
      toast.info(`Starting direct sync with ${parsedData.length} records...`);

      // Create a simple payload with the raw data
      const payload = {
        billingData: parsedData
      };

      // Log the payload size
      const payloadString = JSON.stringify(payload);
      console.log(`Direct sync payload size: ${payloadString.length} bytes`);
      console.log('First record:', parsedData[0]);

      // Send the request
      fetch('/api/sap/sync', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: payloadString,
      })
      .then(async (res) => {
        try {
          const result = await res.json();
          if (res.ok) {
            toast.success('Direct sync completed successfully', {
              description: result.docEntry ? `Document Entry: ${result.docEntry}` : undefined,
            });
          } else {
            toast.error('Direct sync failed', {
              description: result.message || 'Unknown error',
            });
          }
        } catch (e) {
          toast.error('Failed to parse server response');
        }
      })
      .catch((err) => {
        toast.error('Network error during direct sync', {
          description: err.message,
        });
      })
      .finally(() => {
        setIsSyncing(false);
      });
    } catch (err) {
      toast.error('Error during direct sync', {
        description: err instanceof Error ? err.message : 'Unknown error',
      });
      setIsSyncing(false);
    }
  };

  const handleSort = (key: keyof OracleRecord) => {
    setSortConfig((prevSort) => ({
      key,
      direction: prevSort.key === key && prevSort.direction === 'asc' ? 'desc' : 'asc',
    }));
  };

  const sortedData = useMemo(() => {
    if (!sortConfig.key) return paginatedData;

    return [...paginatedData].sort((a, b) => {
      const aValue = safeParseNumber(a[sortConfig.key]);
      const bValue = safeParseNumber(b[sortConfig.key]);
      
      if (sortConfig.direction === 'asc') {
        return aValue - bValue;
      }
      return bValue - aValue;
    });
  }, [paginatedData, sortConfig]);

    return (
    <div className={`space-y-6 ${locale === 'ar' ? 'rtl' : 'ltr'}`}>
      {/* Header Section */}
      <div className="space-y-2">
        <h3 className="text-3xl font-bold tracking-tight">{t('oracleData.title')}</h3>
        <p className="text-muted-foreground text-lg">{t('oracleData.subtitle')}</p>
      </div>

      {/* Stats Cards */}
      <div className="w-full overflow-x-auto">
        <DashboardStats data={data} isLoading={loading} error={error} />
      </div>

      {/* Data Table Section */}
      <Card className="overflow-hidden">
        <CardHeader className="px-2 py-4">
          <CardTitle className="flex items-center justify-between">
            <span>{t('oracleData.table.headers.type')}</span>
            <div className="flex items-center gap-2">
              {loading ? (
                <Skeleton className="h-5 w-40" />
              ) : (
                <Badge variant={lastUpdated ? "outline" : "secondary"} className="text-xs">
                  {lastUpdated 
                    ? `${t('oracleData.status.lastUpdated')}: ${new Date(lastUpdated).toLocaleString()}` 
                    : t('oracleData.status.notSyncedYet')}
                </Badge>
              )}
              <Button variant="outline" size="sm" onClick={handleRefresh} disabled={loading}>
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              </Button>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent className="px-1">
          {/* Search and Filters */}
          <div className="flex flex-col sm:flex-row gap-2 mb-4 w-full">
            <div className="relative flex-1">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                placeholder={t('oracleData.actions.search')}
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-8"
                disabled={loading}
                />
            </div>
            <Select 
              value={selectedBranch} 
              onValueChange={setSelectedBranch}
              disabled={loading}
            >
              <SelectTrigger className="w-[180px]">
                  <Filter className="h-4 w-4 mr-2" />
                  <SelectValue placeholder={t('oracleData.actions.filterByBranch')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t('oracleData.actions.allBranches')}</SelectItem>
                  {branches.map(branch => (
                  <SelectItem key={branch} value={branch}>{branch}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            <Button 
              variant="outline" 
              className="flex items-center gap-2" 
              onClick={exportToCsv}
              disabled={loading || data.length === 0}
            >
              <Download className="h-4 w-4" />
              {t('oracleData.actions.export')}
            </Button>
          </div>

          {/* Error State */}
          {error && (
            <Alert variant="destructive" className="mb-4">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>{t('common.error')}</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* Table Section */}
          <div className="rounded-md border w-full overflow-hidden">
            <ScrollArea className="h-[700px] w-full" type="always">
              <Table>
                <TableHeader>
                  <TableRow className="bg-[#354A5F] hover:bg-[#354A5F]">
                    <TableHead className="min-w-[50px] px-2 text-white font-medium h-11 cursor-pointer group">
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger>
                            <div className="flex items-center">
                              {t('oracleData.table.headers.type')}
                              <ChevronDown className="h-4 w-4 opacity-0 group-hover:opacity-100 transition-opacity ml-1" />
                            </div>
                          </TooltipTrigger>
                          <TooltipContent className="bg-[#354A5F] text-white border-[#4A6583]">
                            <p>{t('oracleData.table.tooltips.type')}</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </TableHead>
                    <TableHead className="min-w-[50px] px-2 text-white font-medium h-11 cursor-pointer group">
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger>
                            <div className="flex items-center">
                              {t('oracleData.table.headers.branch')}
                              <ChevronDown className="h-4 w-4 opacity-0 group-hover:opacity-100 transition-opacity ml-1" />
                            </div>
                          </TooltipTrigger>
                          <TooltipContent className="bg-[#354A5F] text-white border-[#4A6583]">
                            <p>{t('oracleData.table.tooltips.branch')}</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </TableHead>

                    <TableHead 
                      className="min-w-[120px] px-2 text-white font-medium text-right h-11 cursor-pointer group"
                      onClick={() => handleSort('ENTAGTAM')}
                    >
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger>
                            <div className="flex items-center justify-end">
                              {t('oracleData.table.headers.revenue')}
                              <ChevronDown 
                                className={`h-4 w-4 transition-all ml-1 ${
                                  sortConfig.key === 'ENTAGTAM' 
                                    ? 'opacity-100' + (sortConfig.direction === 'desc' ? ' rotate-180' : '')
                                    : 'opacity-0 group-hover:opacity-100'
                                }`} 
                              />
                            </div>
                          </TooltipTrigger>
                          <TooltipContent className="bg-[#354A5F] text-white border-[#4A6583]">
                            <p>{t('oracleData.table.tooltips.revenue')}</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </TableHead>
                    <TableHead className="min-w-[120px] px-2 text-white font-medium text-right h-11 cursor-pointer group">
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger>
                            <div className="flex items-center justify-end">
                              {t('oracleData.table.headers.sewer')}
                              <ChevronDown className="h-4 w-4 opacity-0 group-hover:opacity-100 transition-opacity ml-1" />
                            </div>
                          </TooltipTrigger>
                          <TooltipContent className="bg-[#354A5F] text-white border-[#4A6583]">
                            <p>{t('oracleData.table.tooltips.sewer')}</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </TableHead>
                    <TableHead className="min-w-[120px] px-2 text-white font-medium text-right h-11 cursor-pointer group">
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger>
                            <div className="flex items-center justify-end">
                              {t('oracleData.table.headers.tanzeem')}
                              <ChevronDown className="h-4 w-4 opacity-0 group-hover:opacity-100 transition-opacity ml-1" />
                            </div>
                          </TooltipTrigger>
                          <TooltipContent className="bg-[#354A5F] text-white border-[#4A6583]">
                            <p>{t('oracleData.table.tooltips.tanzeem')}</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </TableHead>
                    <TableHead className="min-w-[120px] px-2 text-white font-medium text-right h-11 cursor-pointer group">
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger>
                            <div className="flex items-center justify-end">
                              {t('oracleData.table.headers.estdama')}
                              <ChevronDown className="h-4 w-4 opacity-0 group-hover:opacity-100 transition-opacity ml-1" />
                            </div>
                          </TooltipTrigger>
                          <TooltipContent className="bg-[#354A5F] text-white border-[#4A6583]">
                            <p>{t('oracleData.table.tooltips.estdama')}</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </TableHead>
                    <TableHead className="min-w-[120px] px-2 text-white font-medium text-right h-11 cursor-pointer group">
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger>
                            <div className="flex items-center justify-end">
                              {t('oracleData.table.headers.contract')}
                              <ChevronDown className="h-4 w-4 opacity-0 group-hover:opacity-100 transition-opacity ml-1" />
                            </div>
                          </TooltipTrigger>
                          <TooltipContent className="bg-[#354A5F] text-white border-[#4A6583]">
                            <p>{t('oracleData.table.tooltips.contract')}</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </TableHead>
                    <TableHead className="min-w-[120px] px-2 text-white font-medium text-right h-11 cursor-pointer group">
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger>
                            <div className="flex items-center justify-end">
                              {t('oracleData.table.headers.taxes')}
                              <ChevronDown className="h-4 w-4 opacity-0 group-hover:opacity-100 transition-opacity ml-1" />
                            </div>
                          </TooltipTrigger>
                          <TooltipContent className="bg-[#354A5F] text-white border-[#4A6583]">
                            <p>{t('oracleData.table.tooltips.taxes')}</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </TableHead>
                    <TableHead className="min-w-[120px] px-2 text-white font-medium text-right h-11 cursor-pointer group">
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger>
                            <div className="flex items-center justify-end">
                              {t('oracleData.table.headers.waterCredit')}
                              <ChevronDown className="h-4 w-4 opacity-0 group-hover:opacity-100 transition-opacity ml-1" />
                            </div>
                          </TooltipTrigger>
                          <TooltipContent className="bg-[#354A5F] text-white border-[#4A6583]">
                            <p>{t('oracleData.table.tooltips.waterCredit')}</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </TableHead>
                    <TableHead className="min-w-[120px] px-2 text-white font-medium text-right h-11 cursor-pointer group">
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger>
                            <div className="flex items-center justify-end">
                              {t('oracleData.table.headers.sewerCredit')}
                              <ChevronDown className="h-4 w-4 opacity-0 group-hover:opacity-100 transition-opacity ml-1" />
                            </div>
                          </TooltipTrigger>
                          <TooltipContent className="bg-[#354A5F] text-white border-[#4A6583]">
                            <p>{t('oracleData.table.tooltips.sewerCredit')}</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </TableHead>
                    <TableHead className="min-w-[120px] px-2 text-white font-medium text-right h-11 cursor-pointer group">
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger>
                            <div className="flex items-center justify-end">
                              {t('oracleData.table.headers.consumption')}
                              <ChevronDown className="h-4 w-4 opacity-0 group-hover:opacity-100 transition-opacity ml-1" />
                            </div>
                          </TooltipTrigger>
                          <TooltipContent className="bg-[#354A5F] text-white border-[#4A6583]">
                            <p>{t('oracleData.table.tooltips.consumption')}</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    // Loading state with shimmer effect
                    Array(itemsPerPage).fill(0).map((_, index) => (
                      <TableRow key={`loading-${index}`} className={`animate-pulse ${index % 2 === 0 ? 'bg-[#FDF4E0]' : 'bg-white'}`}>
                        <TableCell className="px-2"><Skeleton className="h-6 w-24" /></TableCell>
                        <TableCell className="px-2"><Skeleton className="h-6 w-32" /></TableCell>
                        <TableCell className="px-2"><Skeleton className="h-6 w-24 ml-auto" /></TableCell>
                        <TableCell className="px-2"><Skeleton className="h-6 w-24 ml-auto" /></TableCell>
                        <TableCell className="px-2"><Skeleton className="h-6 w-24 ml-auto" /></TableCell>
                        <TableCell className="px-2"><Skeleton className="h-6 w-24 ml-auto" /></TableCell>
                        <TableCell className="px-2"><Skeleton className="h-6 w-24 ml-auto" /></TableCell>
                        <TableCell className="px-2"><Skeleton className="h-6 w-24 ml-auto" /></TableCell>
                        <TableCell className="px-2"><Skeleton className="h-6 w-24 ml-auto" /></TableCell>
                        <TableCell className="px-2"><Skeleton className="h-6 w-24 ml-auto" /></TableCell>
                        <TableCell className="px-2"><Skeleton className="h-6 w-24 ml-auto" /></TableCell>
                      </TableRow>
                    ))
                  ) : error ? (
                    // Error state
                    <TableRow>
                      <TableCell colSpan={11} className="h-[400px] text-center bg-white">
                        <div className="flex flex-col items-center gap-2">
                          <AlertCircle className="h-8 w-8 text-red-500" />
                          <p className="text-red-500 font-medium">{t('oracleData.status.errorLoading')}</p>
                          <p className="text-sm text-muted-foreground">{error}</p>
                          <Button variant="outline" size="sm" onClick={handleRefresh}>
                            {t('common.tryAgain')}
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : data.length === 0 ? (
                    // Empty state
                    <TableRow>
                      <TableCell colSpan={11} className="h-[400px] text-center bg-white">
                        <div className="flex flex-col items-center gap-2">
                          <Database className="h-8 w-8 text-muted-foreground" />
                          <p className="text-muted-foreground">{t('oracleData.status.noData')}</p>
                          <Button variant="outline" size="sm" onClick={handleRefresh}>
                            {t('common.refreshData')}
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : (
                    // Data state
                    sortedData.map((row, index) => (
                      <TableRow 
                        key={index} 
                        className={`
                          ${index % 2 === 0 ? 'bg-secondary' : 'bg-card'}
                          hover:bg-accent transition-colors
                        `}
                      >
                        <TableCell className="px-2">
                          <Badge 
                            variant="outline" 
                            className="bg-primary/5 text-primary border-primary/20"
                          >
                            {row.CSTYPE}
                          </Badge>
                        </TableCell>
                        <TableCell className="px-2 font-medium text-foreground">{row.BRANCHE}</TableCell>
                        <TableCell className="text-right px-2 font-medium">
                          <ValueWithIndicator value={safeParseNumber(row.ENTAGTAM)} />
                        </TableCell>
                        <TableCell className="text-right px-2">
                          <ValueWithIndicator value={safeParseNumber(row.SEWER)} />
                        </TableCell>
                        <TableCell className="text-right px-2">
                          <ValueWithIndicator value={safeParseNumber(row.TANZEEM)} />
                        </TableCell>
                        <TableCell className="text-right px-2">
                          <ValueWithIndicator value={safeParseNumber(row.ESTDAMA)} />
                        </TableCell>
                        <TableCell className="text-right px-2">
                          <ValueWithIndicator value={safeParseNumber(row.CONTRACT)} />
                        </TableCell>
                        <TableCell className="text-right px-2">
                          <ValueWithIndicator value={safeParseNumber(row.TAXES)} />
                        </TableCell>
                        <TableCell className="text-right px-2">
                          <ValueWithIndicator value={safeParseNumber(row.WATERCREDIT)} />
                        </TableCell>
                        <TableCell className="text-right px-2">
                          <ValueWithIndicator value={safeParseNumber(row.SEWERCREDIT)} />
                        </TableCell>
                        <TableCell className="text-right px-2 font-medium text-foreground">
                          {formatNumber(safeParseNumber(row.CONSUMP))}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </ScrollArea>
          </div>

      {/* Pagination */}
          {!loading && !error && data.length > 0 && (
            <div className="flex items-center justify-between py-4">
          <p className="text-sm text-muted-foreground">
                {t('common.showing')} {((currentPage - 1) * itemsPerPage) + 1} {t('common.to')} {Math.min(currentPage * itemsPerPage, filteredData.length)} {t('common.of')} {filteredData.length} {t('common.records')}
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
              disabled={currentPage === 1}
            >
                  <ChevronLeft className="h-4 w-4 mr-1" />
              {t('common.previous')}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
              disabled={currentPage === totalPages}
            >
              {t('common.next')}
                  <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
        </div>
      )}
        </CardContent>
        {/*<CardFooter className="flex justify-between">
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={handleClearLocalData}
              disabled={loading || isClearing || data.length === 0}
              className="text-red-500 hover:text-red-600"
            >
              {isClearing ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  {t('oracleData.status.clearing')}
                </>
              ) : (
                <>
                  <Trash2 className="h-4 w-4 mr-2" />
                  {t('oracleData.actions.clearLocalData')}
                </>
              )}
            </Button>
            <Button
              variant="outline"
              onClick={handleDebugStorage}
              disabled={loading}
            >
              <Bug className="h-4 w-4 mr-2" />
              {t('oracleData.actions.debugStorage')}
            </Button>
          </div>
          <Button
            onClick={handleDirectSync}
            disabled={loading || isSyncing || data.length === 0}
            className="bg-primary hover:bg-primary/90"
          >
            {isSyncing ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                {t('oracleData.status.syncing')}
              </>
            ) : (
              <>
                <Send className="h-4 w-4 mr-2" />
                {t('oracleData.actions.directSync')}
              </>
            )}
          </Button>
        </CardFooter>*/}
      </Card>
    </div>
  );
}