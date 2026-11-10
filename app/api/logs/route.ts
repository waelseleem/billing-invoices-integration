import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { logger } from '@/lib/services/logger';

interface LogEntry {
  id: string;
  timestamp: string;
  level: 'info' | 'warning' | 'error' | 'success';
  message: string;
  details?: string;
  source: string;
}

export async function GET(request: Request) {
  try {
    // Get query parameters
    const url = new URL(request.url);
    const level = url.searchParams.get('level') || 'all';
    const limit = parseInt(url.searchParams.get('limit') || '100', 10);
    const search = url.searchParams.get('search') || '';
    const type = url.searchParams.get('type') || 'billing';
    const startDate = url.searchParams.get('startDate') || '';
    const endDate = url.searchParams.get('endDate') || '';
    
    // Define log paths
    const billingLogPath = path.join(process.cwd(), 'logs', 'billing-integration.log');
    const errorLogPath = path.join(process.cwd(), 'logs', 'error.log');
    
    // Determine which log files to read
    let logEntries: LogEntry[] = [];
    
    if (type === 'all') {
      // Read both log files
      if (fs.existsSync(billingLogPath)) {
        const billingLogs = parseLogFile(billingLogPath, level, search, limit, startDate, endDate);
        logEntries = [...logEntries, ...billingLogs];
      }
      
      if (fs.existsSync(errorLogPath)) {
        const errorLogs = parseLogFile(errorLogPath, level, search, limit, startDate, endDate);
        logEntries = [...logEntries, ...errorLogs];
      }
      
      // Sort combined logs by timestamp (newest first)
      logEntries.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      
      // Apply limit after combining
      if (logEntries.length > limit) {
        logEntries = logEntries.slice(0, limit);
      }
    } else {
      // Read a single log file
      const logPath = type === 'error' ? errorLogPath : billingLogPath;
      
      if (!fs.existsSync(logPath)) {
        return NextResponse.json({ 
          success: false, 
          message: 'Log file not found' 
        }, { status: 404 });
      }
      
      logEntries = parseLogFile(logPath, level, search, limit, startDate, endDate);
    }
    
    return NextResponse.json({ 
      success: true, 
      logs: logEntries 
    });
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Error fetching logs', { error: errorMessage });
    
    return NextResponse.json({ 
      success: false, 
      message: 'Failed to fetch logs', 
      error: errorMessage 
    }, { status: 500 });
  }
}

// Helper function to parse log files
function parseLogFile(
  filePath: string, 
  level: string, 
  search: string, 
  limit: number,
  startDate?: string,
  endDate?: string
): LogEntry[] {
  const logEntries: LogEntry[] = [];
  
  try {
    const logContent = fs.readFileSync(filePath, 'utf-8');
    const logLines = logContent.split('\n').filter(line => line.trim().length > 0);
    
    // Get the log type from the file path
    const isErrorLog = filePath.includes('error.log');
    
    // Parse start and end dates if provided
    const startDateTime = startDate ? new Date(startDate).getTime() : 0;
    const endDateTime = endDate ? new Date(endDate).getTime() : Date.now();
    
    for (let i = logLines.length - 1; i >= 0; i--) {
      try {
        const logData = JSON.parse(logLines[i]);
        
        // Map winston log level to our log level
        let mappedLevel: 'info' | 'warning' | 'error' | 'success' = 'info';
        if (logData.level === 'warn') mappedLevel = 'warning';
        else if (logData.level === 'error') mappedLevel = 'error';
        else if (logData.message && logData.message.toLowerCase().includes('success')) mappedLevel = 'success';
        
        // For error logs, force the level to error
        if (isErrorLog) {
          mappedLevel = 'error';
        }
        
        // Extract source from message or use service name
        let source = logData.service || 'System';
        if (logData.message) {
          if (logData.message.includes('SAP')) source = 'SAPService';
          else if (logData.message.includes('Oracle')) source = 'OracleService';
          else if (logData.message.includes('sync')) source = 'SyncService';
        }
        
        // Extract details from error object if present
        let details = '';
        if (logData.error) {
          if (typeof logData.error === 'string') {
            details = logData.error;
          } else if (typeof logData.error === 'object') {
            details = JSON.stringify(logData.error, null, 2);
          }
        }
        
        if (logData.errorStack) {
          details += '\n' + logData.errorStack;
        }
        
        if (logData.details) {
          details += '\n' + (typeof logData.details === 'string' ? logData.details : JSON.stringify(logData.details, null, 2));
        }

        // Extract all additional data from the log entry
        const additionalData: any = {};
        
        // Extract totals if present
        if (logData.totals) {
          additionalData.totals = logData.totals;
        }
        
        // Extract amounts and financial data
        if (logData.totalAmount !== undefined) additionalData.totalAmount = logData.totalAmount;
        if (logData.totalCredit !== undefined) additionalData.totalCredit = logData.totalCredit;
        if (logData.totalDebit !== undefined) additionalData.totalDebit = logData.totalDebit;
        if (logData.totalLines !== undefined) additionalData.totalLines = logData.totalLines;
        if (logData.consumption !== undefined) additionalData.consumption = logData.consumption;
        if (logData.contract !== undefined) additionalData.contract = logData.contract;
        if (logData.entagtam !== undefined) additionalData.entagtam = logData.entagtam;
        if (logData.estdama !== undefined) additionalData.estdama = logData.estdama;
        if (logData.rounding !== undefined) additionalData.rounding = logData.rounding;
        if (logData.sewer !== undefined) additionalData.sewer = logData.sewer;
        if (logData.sewerCredit !== undefined) additionalData.sewerCredit = logData.sewerCredit;
        if (logData.sewerDebit !== undefined) additionalData.sewerDebit = logData.sewerDebit;
        if (logData.tanzeem !== undefined) additionalData.tanzeem = logData.tanzeem;
        if (logData.taxes !== undefined) additionalData.taxes = logData.taxes;
        if (logData.waterCredit !== undefined) additionalData.waterCredit = logData.waterCredit;
        if (logData.waterDebit !== undefined) additionalData.waterDebit = logData.waterDebit;
        
        // Extract reference and memo data
        if (logData.reference) additionalData.reference = logData.reference;
        if (logData.referenceDate) additionalData.referenceDate = logData.referenceDate;
        if (logData.memo) additionalData.memo = logData.memo;
        
        // Extract record count and other metadata
        if (logData.recordCount !== undefined) additionalData.recordCount = logData.recordCount;
        if (logData.locale) additionalData.locale = logData.locale;
        if (logData.endpoint) additionalData.endpoint = logData.endpoint;
        if (logData.dataKeys) additionalData.dataKeys = logData.dataKeys;
        if (logData.linesCount !== undefined) additionalData.linesCount = logData.linesCount;
        if (logData.date) additionalData.date = logData.date;
        if (logData.docEntries) additionalData.docEntries = logData.docEntries;
        
        // Extract sample data
        if (logData.firstRecord) additionalData.firstRecord = logData.firstRecord;
        if (logData.sampleBillingData) additionalData.sampleBillingData = logData.sampleBillingData;
        
        // Extract request/response data
        if (logData.requestMethod) additionalData.requestMethod = logData.requestMethod;
        if (logData.requestHeaders) additionalData.requestHeaders = logData.requestHeaders;
        if (logData.rawBodyLength) additionalData.rawBodyLength = logData.rawBodyLength;
        if (logData.rawBodyType) additionalData.rawBodyType = logData.rawBodyType;
        if (logData.rawBodyStarts) additionalData.rawBodyStarts = logData.rawBodyStarts;
        if (logData.parsedBodyKeys) additionalData.parsedBodyKeys = logData.parsedBodyKeys;
        if (logData.responseStatus) additionalData.responseStatus = logData.responseStatus;
        
        // Combine all additional data into details
        if (Object.keys(additionalData).length > 0) {
          const additionalDetails = JSON.stringify(additionalData, null, 2);
          details = details ? `${details}\n\nAdditional Data:\n${additionalDetails}` : `Additional Data:\n${additionalDetails}`;
        }
        
        const logEntry: LogEntry = {
          id: `log-${Date.now()}-${isErrorLog ? 'error' : 'billing'}-${i}`,
          timestamp: logData.timestamp || new Date().toISOString(),
          level: mappedLevel,
          message: logData.message || 'No message',
          source,
          ...(details ? { details } : {})
        };
        
        // Apply date filter if dates are provided
        const logTime = new Date(logEntry.timestamp).getTime();
        if ((startDate && logTime < startDateTime) || (endDate && logTime > endDateTime)) {
          continue;
        }
        
        // Apply level filter
        if (level !== 'all' && logEntry.level !== level) continue;
        
        // Apply search filter
        if (search && !logEntry.message.toLowerCase().includes(search.toLowerCase()) && 
            !logEntry.source.toLowerCase().includes(search.toLowerCase()) &&
            !(logEntry.details && logEntry.details.toLowerCase().includes(search.toLowerCase()))) {
          continue;
        }
        
        logEntries.push(logEntry);
        
        // Limit the number of entries
        if (logEntries.length >= limit) break;
        
      } catch (parseError) {
        // Skip invalid JSON lines
        continue;
      }
    }
  } catch (error) {
    logger.error(`Error parsing log file: ${filePath}`, { error });
  }
  
  return logEntries;
} 