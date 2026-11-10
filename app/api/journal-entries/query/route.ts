import { NextRequest, NextResponse } from 'next/server';
import { SapJournalIntegration } from '@/lib/services/sap-journal-integration';
import { logger } from '@/lib/services/logger';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { journalNumber, transactionNumber, locale = 'en' } = body;
    
    logger.info('Querying journal entry data from SAP', { 
      journalNumber,
      transactionNumber,
      locale 
    });

    const sapJournalIntegration = new SapJournalIntegration();
    
    // Query the journal entry data
    const result = await sapJournalIntegration.getLatestJournalEntryData(journalNumber, transactionNumber);

    if (result.success) {
      return NextResponse.json({
        success: true,
        message: result.message,
        journalEntry: result.journalEntry,
        timestamp: new Date().toISOString()
      });
    } else {
      return NextResponse.json({
        success: false,
        message: result.message,
        error: result.error,
        timestamp: new Date().toISOString()
      }, { status: 404 });
    }

  } catch (error) {
    logger.error('Error querying journal entry data', { error });
    return NextResponse.json(
      {
        success: false,
        message: 'Failed to query journal entry data',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const journalNumber = searchParams.get('journalNumber');
    const transactionNumber = searchParams.get('transactionNumber');
    const locale = searchParams.get('locale') || 'en';
    
    logger.info('Querying journal entry data from SAP (GET)', { 
      journalNumber,
      transactionNumber,
      locale 
    });

    const sapJournalIntegration = new SapJournalIntegration();
    
    // Query the journal entry data
    const result = await sapJournalIntegration.getLatestJournalEntryData(
      journalNumber ? parseInt(journalNumber) : undefined,
      transactionNumber ? parseInt(transactionNumber) : undefined
    );

    if (result.success) {
      return NextResponse.json({
        success: true,
        message: result.message,
        journalEntry: result.journalEntry,
        timestamp: new Date().toISOString()
      });
    } else {
      return NextResponse.json({
        success: false,
        message: result.message,
        error: result.error,
        timestamp: new Date().toISOString()
      }, { status: 404 });
    }

  } catch (error) {
    logger.error('Error querying journal entry data (GET)', { error });
    return NextResponse.json(
      {
        success: false,
        message: 'Failed to query journal entry data',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  }
} 