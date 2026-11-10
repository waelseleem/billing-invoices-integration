"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Skeleton } from "@/components/ui/skeleton"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Search, Filter, Download, MoreHorizontal, RefreshCw, Eye, Loader2 } from "lucide-react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"

interface OracleRecord {
  CSTYPE: string
  BRANCHE: string
  COSTCENTER: string
  BILNG_DATE: string
  ENTAGTAM: number
  SEWER: number
  TANZEEM: number
  ESTDAMA: number
  CONTRACT: string
  TAXES: number
  ROUNDING: number
  WATERCREDIT: number
  SEWERCREDIT: number
  WATERDEBIT: number
  SEWERDEBIT: number
  CONSUMP: number
}

export function DataViewTab() {
  const [searchTerm, setSearchTerm] = useState("")
  const [currentPage, setCurrentPage] = useState(1)
  const [isLoading, setIsLoading] = useState(true) // Start with loading true
  const [loadingProgress, setLoadingProgress] = useState<string>("Initializing...")
  const [error, setError] = useState<string | null>(null)
  const [data, setData] = useState<OracleRecord[]>([])
  const itemsPerPage = 5

  const fetchData = async () => {
    setIsLoading(true)
    setError(null)
    setLoadingProgress("Connecting to Oracle database...")
    let eventSource: EventSource | null = null;
    
    try {
      // Set up event source for progress updates first
      eventSource = new EventSource('/api/oracle-data')
      eventSource.onmessage = (event) => {
        console.log('Progress update:', event.data) // Debug log
        if (event.data === 'still calculating...') {
          setLoadingProgress("Oracle view is calculating (this typically takes 5-6 minutes)...")
        } else {
          setLoadingProgress(event.data)
        }
      }

      eventSource.onerror = (error) => {
        console.error('EventSource error:', error)
        eventSource?.close()
      }

      // Then start the actual data fetch
      const response = await fetch('/api/oracle-data')
      const result = await response.json()
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to fetch data')
      }
      
      setData(result.data || [])
      
      // Only close EventSource after successful data fetch
      if (eventSource) {
        eventSource.close()
      }
      setLoadingProgress("Data loaded successfully!")
      setTimeout(() => setLoadingProgress(null), 2000) // Clear success message after 2 seconds
    } catch (err: any) {
      console.error('Fetch error:', err)
      setError(err.message || 'An error occurred while fetching data')
      if (eventSource) {
        eventSource.close()
      }
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
    return () => {
      // Cleanup function to close EventSource if component unmounts
      const eventSource = new EventSource('/api/oracle-data')
      if (eventSource) {
        eventSource.close()
      }
    }
  }, [])

  const filteredData = data.filter((item) => {
    const matchesSearch =
      item.CONTRACT?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.BRANCHE?.toLowerCase().includes(searchTerm.toLowerCase())
    return matchesSearch
  })

  const totalPages = Math.ceil(filteredData.length / itemsPerPage)
  const startIndex = (currentPage - 1) * itemsPerPage
  const paginatedData = filteredData.slice(startIndex, startIndex + itemsPerPage)

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-2xl font-bold tracking-tight">Data View</h3>
        <p className="text-muted-foreground">View and manage billing records from Oracle to SAP B1 integration</p>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Billing Records</span>
            {isLoading && <Loader2 className="h-5 w-5 animate-spin" />}
          </CardTitle>
          <CardDescription>All invoice records and their sync status</CardDescription>
        </CardHeader>
        <CardContent>
          {/* Filters and Search */}
          <div className="flex flex-col sm:flex-row gap-4 mb-6">
            <div className="relative flex-1">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by contract or branch..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-8"
                disabled={isLoading}
              />
            </div>
            <Button 
              variant="outline" 
              className="flex items-center gap-2" 
              onClick={fetchData}
              disabled={isLoading}
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
              {isLoading ? 'Loading...' : 'Refresh'}
            </Button>
          </div>

          {/* Loading Progress */}
          {loadingProgress && (
            <Alert className="mb-4">
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
              <AlertDescription>{loadingProgress}</AlertDescription>
            </Alert>
          )}

          {/* Data Table */}
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Contract</TableHead>
                  <TableHead>Branch</TableHead>
                  <TableHead>Billing Date</TableHead>
                  <TableHead>Water Amount</TableHead>
                  <TableHead>Sewer Amount</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  // Loading skeletons
                  Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell><Skeleton className="h-4 w-[100px]" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-[120px]" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-[100px]" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-[80px]" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-[80px]" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-[40px]" /></TableCell>
                    </TableRow>
                  ))
                ) : paginatedData.length > 0 ? (
                  paginatedData.map((record, index) => (
                    <TableRow key={index}>
                      <TableCell className="font-medium">{record.CONTRACT}</TableCell>
                      <TableCell>{record.BRANCHE}</TableCell>
                      <TableCell>{record.BILNG_DATE}</TableCell>
                      <TableCell>{record.WATERDEBIT.toFixed(2)}</TableCell>
                      <TableCell>{record.SEWERDEBIT.toFixed(2)}</TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" className="h-8 w-8 p-0">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuLabel>Actions</DropdownMenuLabel>
                            <DropdownMenuItem>
                              <Eye className="mr-2 h-4 w-4" />
                              View Details
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-4">
                      {isLoading ? 'Loading data...' : 'No records found'}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>

          {/* Pagination */}
          {!isLoading && paginatedData.length > 0 && (
            <div className="flex items-center justify-between space-x-2 py-4">
              <div className="text-sm text-muted-foreground">
                Showing {startIndex + 1} to {Math.min(startIndex + itemsPerPage, filteredData.length)} of{" "}
                {filteredData.length} results
              </div>
              <div className="flex items-center space-x-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
                  disabled={currentPage === 1}
                >
                  Previous
                </Button>
                <div className="flex items-center gap-1">
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                    <Button
                      key={page}
                      variant={currentPage === page ? "default" : "outline"}
                      size="sm"
                      onClick={() => setCurrentPage(page)}
                      className="w-8 h-8 p-0"
                    >
                      {page}
                    </Button>
                  ))}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
                  disabled={currentPage === totalPages}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
