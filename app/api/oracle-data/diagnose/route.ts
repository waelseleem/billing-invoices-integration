import { NextResponse } from 'next/server';
import { diagnoseConnection } from '@/lib/services/oracle-service';
import { logger } from '@/lib/services/logger';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    logger.info('Starting Oracle connection diagnosis');
    
    const diagnostics = await diagnoseConnection();
    
    logger.info('Oracle diagnosis completed', { diagnostics });
    
    return NextResponse.json({
      success: true,
      message: 'Oracle connection diagnosis completed',
      diagnostics
    });

  } catch (error: any) {
    logger.error('Error during Oracle diagnosis:', error);
    
    return NextResponse.json({
      success: false,
      error: error.message,
      details: 'Failed to perform Oracle connection diagnosis'
    }, {
      status: 500
    });
  }
} 