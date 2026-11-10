import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function GET() {
  try {
    // Check if schedule config exists in localStorage on server side
    // Since we can't access localStorage directly on server, we'll check if a config file exists
    const configPath = path.join(process.cwd(), 'data');
    const schedulePath = path.join(configPath, 'schedule-config.json');
    const statusPath = path.join(configPath, 'last-sync-status.json');
    
    // Create data directory if it doesn't exist
    if (!fs.existsSync(configPath)) {
      fs.mkdirSync(configPath, { recursive: true });
    }
    
    // Default values
    let scheduleConfig = {
      isEnabled: false,
      cronExpression: "0 */6 * * *",
      timezone: "UTC",
      retryAttempts: "3",
      retryDelay: "5",
      lastSaved: new Date().toISOString()
    };
    
    let lastSyncStatus = {
      timestamp: null,
      success: null,
      recordsProcessed: 0,
      duration: "0s",
      message: "No sync has been performed yet"
    };
    
    // Read config if it exists
    if (fs.existsSync(schedulePath)) {
      try {
        const configContent = fs.readFileSync(schedulePath, 'utf-8');
        scheduleConfig = JSON.parse(configContent);
      } catch (err) {
        console.error('Error reading schedule config:', err);
      }
    } else {
      // Create default config file
      fs.writeFileSync(schedulePath, JSON.stringify(scheduleConfig, null, 2));
    }
    
    // Read status if it exists
    if (fs.existsSync(statusPath)) {
      try {
        const statusContent = fs.readFileSync(statusPath, 'utf-8');
        lastSyncStatus = JSON.parse(statusContent);
      } catch (err) {
        console.error('Error reading sync status:', err);
      }
    } else {
      // Create default status file
      fs.writeFileSync(statusPath, JSON.stringify(lastSyncStatus, null, 2));
    }
    
    // Calculate next run time based on cron expression
    let nextRunTime = null;
    
    if (scheduleConfig.isEnabled) {
      // Simple parsing for common patterns
      const now = new Date();
      let hoursToAdd = 6; // Default
      
      if (scheduleConfig.cronExpression.includes("*/15")) {
        hoursToAdd = 0.25; // 15 minutes
      } else if (scheduleConfig.cronExpression.includes("*/30")) {
        hoursToAdd = 0.5; // 30 minutes
      } else if (scheduleConfig.cronExpression.includes("* * * *")) {
        hoursToAdd = 1; // Every hour
      } else if (scheduleConfig.cronExpression.includes("*/6")) {
        hoursToAdd = 6; // Every 6 hours
      } else if (scheduleConfig.cronExpression.includes("0 0 * * *")) {
        hoursToAdd = 24; // Daily at midnight
      }
      
      const lastSaved = scheduleConfig.lastSaved ? new Date(scheduleConfig.lastSaved) : now;
      nextRunTime = new Date(lastSaved.getTime() + hoursToAdd * 60 * 60 * 1000).toISOString();
    }
    
    return NextResponse.json({
      success: true,
      scheduleConfig,
      lastSyncStatus,
      nextRunTime
    });
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    return NextResponse.json({
      success: false,
      message: 'Failed to get cache status',
      error: errorMessage
    }, { status: 500 });
  }
} 