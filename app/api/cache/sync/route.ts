import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { logger } from '@/lib/services/logger';

export async function POST(request: Request) {
  try {
    const configPath = path.join(process.cwd(), 'data');
    
    // Create data directory if it doesn't exist
    if (!fs.existsSync(configPath)) {
      fs.mkdirSync(configPath, { recursive: true });
    }
    
    // Parse request body
    const body = await request.json();
    
    // Determine what type of data we're saving
    if (body.type === 'schedule-config') {
      const schedulePath = path.join(configPath, 'schedule-config.json');
      
      // Validate required fields
      if (!body.config) {
        return NextResponse.json({ 
          success: false, 
          message: 'Missing config data' 
        }, { status: 400 });
      }
      
      // Add timestamp
      const config = {
        ...body.config,
        lastSaved: new Date().toISOString()
      };
      
      // Save to file
      fs.writeFileSync(schedulePath, JSON.stringify(config, null, 2));
      
      logger.info('Schedule configuration saved', { config });
      
      return NextResponse.json({
        success: true,
        message: 'Schedule configuration saved successfully'
      });
    } 
    else if (body.type === 'sync-status') {
      const statusPath = path.join(configPath, 'last-sync-status.json');
      
      // Validate required fields
      if (!body.status) {
        return NextResponse.json({ 
          success: false, 
          message: 'Missing status data' 
        }, { status: 400 });
      }
      
      // Add timestamp if not present
      const status = {
        ...body.status,
        timestamp: body.status.timestamp || new Date().toISOString()
      };
      
      // Save to file
      fs.writeFileSync(statusPath, JSON.stringify(status, null, 2));
      
      logger.info('Sync status saved', { status });
      
      return NextResponse.json({
        success: true,
        message: 'Sync status saved successfully'
      });
    }
    else {
      return NextResponse.json({ 
        success: false, 
        message: 'Invalid data type. Expected "schedule-config" or "sync-status"' 
      }, { status: 400 });
    }
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Error saving cache data', { error: errorMessage });
    
    return NextResponse.json({
      success: false,
      message: 'Failed to save data',
      error: errorMessage
    }, { status: 500 });
  }
} 