import { NextRequest, NextResponse } from 'next/server';
import { govJournalIntegration } from '@/lib/services/gov-journal-integration';
import { logger } from '@/lib/services/logger';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { oracleData, locale = 'en' } = body;

    logger.info('Generating GOV journal entries (branch-based) from provided Oracle data', {
      recordCount: oracleData?.length || 0,
      locale
    });

    if (!oracleData || oracleData.length === 0) {
      return NextResponse.json({
        success: false,
        message: 'No Oracle data provided to generate journal entry',
      });
    }

    // Generate the Gov journal entries data (per branch)
    const result = await govJournalIntegration.getGovJournalEntryData(oracleData, locale);

    return NextResponse.json({
      success: result.success,
      message: result.message,
      journalEntries: result.journalEntries,
      summary: result.summary,
      oracleDataCount: oracleData.length,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('Error generating GOV journal entry data', { error });
    return NextResponse.json(
      {
        success: false,
        message: 'Failed to generate GOV journal entry data',
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
