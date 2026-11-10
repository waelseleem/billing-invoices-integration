import { NextResponse } from 'next/server';
import { govJournalIntegration } from '@/lib/services/gov-journal-integration';
import { logger } from '@/lib/services/logger';
import { MonthBillingDto } from '@/lib/types/billing';

export async function POST(request: Request) {
  logger.info('Received request to start GOV SAP journal integration');
  logger.info(`Request method: ${request.method}`);
  logger.info(`Request headers: ${JSON.stringify(Object.fromEntries(request.headers))}`);
  
  try {
    // Read the request body as text
    const rawBody = await request.text();
    
    logger.info(`Raw body length: ${rawBody.length}`);
    logger.info(`Raw body type: ${typeof rawBody}`);
    logger.info(`Raw body starts with: "${rawBody.substring(0, 50)}..."`);
    
    if (!rawBody || rawBody.trim() === '') {
      logger.warn('Request body is empty or contains only whitespace');
      return NextResponse.json({ 
        success: false,
        message: 'Request body is empty. Please ensure data is loaded before syncing.' 
      }, { status: 400 });
    }
    
    // Parse the JSON body
    let body;
    try {
      body = JSON.parse(rawBody);
      logger.info(`Parsed body keys: ${Object.keys(body).join(', ')}`);
    } catch (parseError) {
      logger.error('Failed to parse request body as JSON', { 
        error: parseError instanceof Error ? parseError.message : String(parseError),
        rawBodyPreview: rawBody.substring(0, 200)
      });
      return NextResponse.json({ 
        success: false,
        message: 'Invalid JSON format in request body. The data may be corrupted.' 
      }, { status: 400 });
    }
    
    // Validate the billingData property exists and is an array
    const billingData = body.billingData;
    
    if (!billingData) {
      logger.warn('Missing billingData property in request body');
      return NextResponse.json({ 
        success: false,
        message: 'Missing billingData in request body' 
      }, { status: 400 });
    }
    
    if (!Array.isArray(billingData)) {
      logger.warn('billingData is not an array', { type: typeof billingData });
      return NextResponse.json({ 
        success: false,
        message: 'billingData must be an array' 
      }, { status: 400 });
    }
    
    if (billingData.length === 0) {
      logger.warn('billingData array is empty');
      return NextResponse.json({ 
        success: false,
        message: 'Cannot sync an empty dataset' 
      }, { status: 400 });
    }
    
    logger.info(`Processing ${billingData.length} billing records`);
    logger.info(`First record keys: ${Object.keys(billingData[0]).join(', ')}`);
    
    // Get locale from request headers or default to English
    const acceptLanguage = request.headers.get('accept-language') || '';
    const locale = acceptLanguage.startsWith('ar') ? 'ar' : 'en';
    
    // Process the data
    const result = await govJournalIntegration.createGovJournalEntryFromBillingData(billingData, locale);

    if (result.success) {
      logger.info('SAP synchronization completed successfully', { 
        docEntries: result.docEntries,
        journalNumbers: result.journalNumbers 
      });
      return NextResponse.json(result);
    } else if (result.isDuplicate) {
      logger.warn('SAP synchronization blocked - duplicate journal entry', { 
        message: result.message,
        existingJournalEntry: result.existingJournalEntry 
      });
      return NextResponse.json(result, { status: 409 }); // 409 Conflict for duplicates
    } else {
      logger.error('SAP synchronization failed', { message: result.message });
      return NextResponse.json(result, { status: 500 });
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Unexpected error in SAP journal integration endpoint', { error: errorMessage });
    return NextResponse.json({
      success: false,
      message: 'An unexpected error occurred during SAP journal integration',
      error: errorMessage
    }, { status: 500 });
  }
} 