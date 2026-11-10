import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { logger } from '@/lib/services/logger';

export async function DELETE(request: Request) {
  try {
    // Get query parameters
    const url = new URL(request.url);
    const type = url.searchParams.get('type') || 'all';
    
    // Define log paths
    const logPath = path.join(process.cwd(), 'logs');
    const billingLogPath = path.join(logPath, 'billing-integration.log');
    const errorLogPath = path.join(logPath, 'error.log');
    
    // Check if log directory exists
    if (!fs.existsSync(logPath)) {
      return NextResponse.json({ 
        success: false, 
        message: 'Logs directory not found' 
      }, { status: 404 });
    }
    
    // Delete logs based on type
    if (type === 'all' || type === 'billing') {
      if (fs.existsSync(billingLogPath)) {
        // Clear the file by writing an empty string
        fs.writeFileSync(billingLogPath, '');
        console.log('Billing integration logs cleared');
      }
    }
    
    if (type === 'all' || type === 'error') {
      if (fs.existsSync(errorLogPath)) {
        // Clear the file by writing an empty string
        fs.writeFileSync(errorLogPath, '');
        console.log('Error logs cleared');
      }
    }
    
    // Log the action to console only, not to log files
    console.log(`Logs cleared (type: ${type})`);
    
    return NextResponse.json({ 
      success: true, 
      message: `Logs cleared successfully (type: ${type})` 
    });
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error clearing logs:', errorMessage);
    
    return NextResponse.json({ 
      success: false, 
      message: 'Failed to clear logs', 
      error: errorMessage 
    }, { status: 500 });
  }
} 